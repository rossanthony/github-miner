import * as fs from 'fs-extra';
import { get } from 'lodash'; 
import { Neo4jClient } from './Neo4jClient';
import { RedisService } from './RedisService';
import { Ora } from 'ora';

export class InsertDataHelper {
    constructor(
        private _spinner: Ora,
        private _redisService: RedisService,
        private _neo4jClient: Neo4jClient,
    ) {}

    public async insertData(): Promise<void> {
        const users: string[] = fs.readdirSync('./data/repos/');
        let usersCount = 1;
        let reposTotalCount = 1;
    
        for (let username of users) {
            if (username === '.DS_Store') {
                continue;
            }
            const repos: string[] = fs.readdirSync(`./data/repos/${username}`);
            let reposCount = 1;

            for (let repo of repos) {
                if (repo === '.DS_Store') {
                    continue;
                }
                this._spinner.text = `Processing ${username}/${repo}\n[user ${usersCount} of ${users.length}`
                    + ` | repo ${reposCount} of ${repos.length} | total repos inserted: ${reposTotalCount}]`;

                try {
                    await this.insertDataForRepo(username, repo);
                } catch (error) {
                    console.log(`Error caught during ${username}/${repo}\n`, error);
                    continue;
                }
                reposCount++;
                reposTotalCount++;
            }
            usersCount++;
        }

        // close neo4j connection on exit:
        this._neo4jClient.close();

        return Promise.resolve();
    }

    public async insertDataForRepo(username: string, repo: string): Promise<void> {
        if (await this._redisService.sismember('github-repos-inserted', `${username}/${repo}`)) {
            console.log(`${username}/${repo} exists is cache, skipping...`)
            return;
        } else {
            console.log(`${username}/${repo} does not exist is cache`)
        }

        const filePath = `./data/repos/${username}/${repo}/github.json`;
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
            await this._neo4jClient.saveGitRepoAndUser(gitHubJson);
        }

        const packageJson = await this.parsePackageJson(username, repo);
        if (packageJson) {
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
            peerDependencies: data.peerDependencies,
            version: data.version,
            homepage: data.homepage,
            keywords: data.keywords,
            engines: data.engines,
        };
    }
}
