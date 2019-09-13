import { GithubApiClient } from './GithubApiClient';
import * as request from 'request';
import { Response } from 'request';
import moment from 'moment';
import fs from 'fs-extra';
import { isEmpty, get } from 'lodash';
import { RedisService } from './RedisService';

export interface MinerReturnType {
    totalCount: number | null;
    results: number | null;
    rateRemaining: number | undefined;
    rateReset: number | undefined;
    timestampNow: number;
    timeUntilReset: number;
}

export class GitHubMinerHelper {
    private totalApiCalls: number = 0;

    constructor(
        private githubApiClient: GithubApiClient,
        private redisService: RedisService,
    ) {}

    public async mineGithubForPackageJsons(
        page: number = 1,
        lastPushed: string = '>=2019-01-01',
        forks: string = '>=100',
    ): Promise<MinerReturnType> {
        const githubResults = await this.githubApiClient.searchRepos(page, lastPushed, forks);

        const rateReset = get(githubResults, 'headers.x-ratelimit-reset');
        const result = {
            totalCount: get(githubResults, 'body.total_count', null),
            results: get(githubResults, 'body.items.length', null),
            rateRemaining: get(githubResults, 'headers.x-ratelimit-remaining'),
            rateReset,
            timestampNow: moment().unix(),
            timeUntilReset: rateReset - moment().unix(),
            totalApiCalls: this.totalApiCalls++,
        };

        if (githubResults.status === 403) {
            return result;
        }

        if (!githubResults.body) {
            console.error('githubResults', githubResults);
            throw Error('No results found!');
        }

        if (isEmpty(githubResults.body.items)) {
            throw Error('No items in body, status code: ' + githubResults.status);
        }

        if (githubResults.body.total_count > 1000) {
            await this.redisService.sadd(
                'github-searches-over-1000',
                `page=${page},pushed=${lastPushed},forks=${forks}`,
            );
            console.log('\n\n***** OVER 1000 RESULTS RETURNED! *****\n\n')
        }

        await Promise.all(githubResults.body.items.map(async (item: any) => {
            if (await this.redisService.sismember('github-repos', item.full_name)) {
                // already set in cache
                console.log(`existsInCache >>> ${item.full_name}`);
                return;
            } else {
                console.log(`not in cache >>> ${item.full_name}`);
            }

            const filePath = `${__dirname}/../data/repos/${item.owner.login}/${item.name}`;
            const packageJsonFile = await fs.readFile(`${filePath}/package.json`, 'utf8').catch(() => null);
            const gitHubFile = await fs.readFile(`${filePath}/github.json`, 'utf8').catch(() => null);

            if (packageJsonFile && gitHubFile) {
                console.log('Files already exist in:', filePath, `adding ${item.full_name} to cache`);
                await this.redisService.sadd('github-repos', item.full_name);
                return;
            }

            const fileSaved = await this.fetchPackageJsonFromGit(item.full_name);
            if (fileSaved) {
                await fs.outputFile(`${filePath}/github.json`, JSON.stringify(item, null, 2));
            }
        }));

        return result;
    }

    public fetchPackageJsonFromGit(full_name: string): Promise<boolean> {
        const fileUrl = `https://raw.githubusercontent.com/${full_name}/master/package.json`;
        const filePath = `${__dirname}/../data/repos/${full_name}`;

        return new Promise((resolve) => {
            request.get(fileUrl, {}, async (error: Error, response: Response, body: any) => {
                // console.log(`Response headers from ${fileUrl}`, response.headers);
            
                if (error) {
                    console.log(`error for ${full_name}`, error);
                    return resolve(false);
                }
                if (response.statusCode !== 200) {
                    console.log('non-200 response for:', full_name, {status: response.statusCode});
                    return resolve(false);
                }
                if (!body) {
                    console.log(`no body for ${full_name}`, error);
                    return resolve(false);
                }
                try {
                    const json = JSON.parse(body);
                    if (isEmpty(json.dependencies) && isEmpty(json.devDependencies)) {
                        console.log('No dependencies in package.json for', full_name);
                        return resolve(false);
                    }
                    console.log('Writing files for:', full_name, 'to path:', filePath);
                    await fs.outputFile(`${filePath}/package.json`, body);
                    await this.redisService.sadd('github-repos', full_name);
                    return resolve(true);
                } catch (error) {
                    console.log(`Writing file for ${full_name} failed`, error);
                }
                return resolve(false);
            });
        });
    }

    public async fetchGithubDataForRepo(username: string, repo: string): Promise<boolean> {
        const filePath = `${__dirname}/../data/repos/${username}/${repo}`;
        try {
            const data = await this.githubApiClient.getRepo(username, repo);
            await fs.outputFile(`${filePath}/github.json`, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.log('Error: caught in fetchGithubDataForRepo', error);
            return false;
        }
    }
}