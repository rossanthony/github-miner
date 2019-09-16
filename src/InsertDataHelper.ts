import * as fs from 'fs-extra';
import { get } from 'lodash'; 
import { Driver } from 'neo4j-driver/types/v1';
import { v1 as neo4j } from 'neo4j-driver';
import { Neo4jClient } from './Neo4jClient';
import { RedisService } from './RedisService';
import redis from 'redis';
import { Ora } from 'ora';

export class InsertDataHelper {
    private _neo4jClient: Neo4jClient;
    private _driver: Driver;
    private _redisService: RedisService;

    constructor(
        private _spinner: Ora,
    ) {
        this._driver = neo4j.driver(
            'bolt://localhost:7687',
            neo4j.auth.basic('neo4j', 'password')
        );
        this._redisService = new RedisService(
            redis.createClient({
                host: process.env.REDIS_HOST || '127.0.0.1',
                port: +process.env.REDIS_PORT || 6379,
            }),
        );
        this._neo4jClient = new Neo4jClient(
            this._driver,
            this._driver.session(),
            this._redisService,
        );
    }

    public async insertData(): Promise<void> {
        const users: string[] = fs.readdirSync('./data/repos/');
        // console.log('folder count in in /data/repos', users.length);
    
        // const record = await neo4jClient.getNodeModule('123');
        // console.log('record', JSON.stringify(record, null, 2));
    
        let i = 0;
        let found = 0;
        let foundArr: string[] = [];
    
        for (let username of users) {
            if (username === '.DS_Store') {
                continue;
            }
    
            const repos: string[] = fs.readdirSync(`./data/repos/${username}`);
            // console.log(`./data/repos/${username}`, repos);
    
            for (let repo of repos) {
                if (repo === '.DS_Store') {
                    continue;
                }
                await this.insertDataForRepo(username, repo);
                i++;
                // if (i > 500) {
                //     break;
                // }
            }
            // if (i > 500) {
            //     break;
            // }
        }

        // close neo4j connection on exit:
        this._neo4jClient.close();

        return Promise.resolve();
    }

    public async insertDataForRepo(username: string, repo: string): Promise<void> {
        const saveToCache = await this._redisService.sadd('github-repos-inserted', `${username}/${repo}`);
        const alreadyExistsInCache = (saveToCache === 0);
        if (alreadyExistsInCache) {
            // console.log(`${repo} exists is cache, skipping...`)
            // return;
        } else {
            console.log(`${repo} did not exist is cache`)
        }

        const filePath = `./data/repos/${username}/${repo}/github.json`;
        this._spinner.text = `Processing ./data/repos/${username}/${repo}/github.json`;
        const fileContents: string|null = await fs.readFile(filePath, 'utf8').catch(() => null);

        if (!fileContents) {
            console.log('ERROR: no file found:', filePath);
            return;
        }

        let gitHubJson: any;
        try {
            gitHubJson = JSON.parse(fileContents);
        } catch (error) {
            console.log('ERROR: unable to parse json in:', filePath);
            return;
        }

        // console.log(`${username}/${repo}/github.json`, JSON.stringify(gitHubJson, null, 2));

        const record = await this._neo4jClient.getGitRepo(gitHubJson.full_name);
        if (!record) {
            await this._neo4jClient.saveGitRepo(gitHubJson);
        }

        const packageJson = await this.parsePackageJson(username, repo);
        if (packageJson) {
            this._spinner.text = `Saving dependencies for ${gitHubJson.full_name}`;
            await this._neo4jClient.saveNodeModulesUsedByGitRepo(gitHubJson.full_name, packageJson);
        }
    }

    private async parsePackageJson(username: string, repo: string): Promise<any> {
        let data: any;
        try {
            const rawJsonFileContents = await fs.readFile(`./data/repos/${username}/${repo}/package.json`, 'utf8');
            data = JSON.parse(rawJsonFileContents);
        } catch (error) {
            console.error("There was an error reading/parsing", `./data/repos/${username}/${repo}/package.json`)
        }
    
        // if (data.name !== repo) {
        //     console.log('\nnames do not match!!!\n', {
        //         repo,
        //         name: data.name,
        //     });
        // }
    
        return {
            username,
            repo,
            name: data.name,
            description: data.description,
            maintainers: data.maintainers,
            author: data.author,
            repository: data.repository,
            modified: get(data, 'time.modified'),
            created: get(data, 'time.created'),
            dependencies: data.dependencies,
            devDependencies: data.devDependencies,
            version: data.version,
            homepage: data.homepage,
            keywords: data.keywords,
            engines: data.engines,
        };
    }
}
