import * as shell from 'shelljs';
import * as fs from 'fs-extra';
import { get } from 'lodash'; 
import { Driver } from 'neo4j-driver/types/v1';
import { v1 as neo4j } from 'neo4j-driver';
import { Neo4jClient } from './Neo4jClient';

export class InsertDataHelper {
    private _neo4jClient: Neo4jClient;
    private _driver: Driver;

    constructor() {
        this._driver = neo4j.driver(
            'bolt://localhost:7687',
            neo4j.auth.basic('neo4j', 'password')
        );
        this._neo4jClient = new Neo4jClient(
            this._driver,
            this._driver.session(),
        );
    }

    public async insertData(): Promise<void> {
        const users: string[] = fs.readdirSync('./data/repos/');
        console.log('folder count in in /data/repos', users.length);
    
        // const record = await neo4jClient.getNodeModule('123');
        // console.log('record', JSON.stringify(record, null, 2));
    
        let i = 0;
    
        for (let username of users) {
            if (username === '.DS_Store') {
                continue;
            }
    
            const repos: string[] = fs.readdirSync(`./data/repos/${username}`);
            console.log(`./data/repos/${username}`, repos);
    
            for (let repo of repos) {
                if (repo === '.DS_Store') {
                    continue;
                }
    
                const filePath = `./data/repos/${username}/${repo}/github.json`;
                const fileContents: string|null = await fs.readFile(filePath, 'utf8').catch(() => null);
    
                if (!fileContents) {
                    console.log('no file found:', filePath);
                    continue;
                }
    
                let gitHubJson: any;
                try {
                    gitHubJson = JSON.parse(fileContents);
                } catch (error) {
                    console.log('unable to parse json in:', filePath);
                    continue;
                }
    
                // console.log(`${username}/${repo}/github.json`, JSON.stringify(gitHubJson, null, 2));
    
                i++;
                const record = await this._neo4jClient.getGitRepo(repo);
                if (!record) {
                    const record = await this._neo4jClient.saveGitRepo(gitHubJson);
                    console.log(`record saved for ${repo}`, JSON.stringify(record, null, 2));
                } else {
                    console.log(`record exists for ${repo}`, JSON.stringify(record, null, 2));
                }
    
                const { packageJson, npmData } = await this.parsePackageJson(username, repo);
                if (packageJson) {
                    await this._neo4jClient.saveNodeModules(repo, packageJson, npmData);
                }
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

    private async parsePackageJson(username: string, repo: string): Promise<{ packageJson: any; npmData: any }> {
        let data: any;
        try {
            const rawJsonFileContents = await fs.readFile(`./data/repos/${username}/${repo}/package.json`, 'utf8');
            data = JSON.parse(rawJsonFileContents);
        } catch (error) {
            console.error("There was an error reading/parsing", `./data/repos/${username}/${repo}/package.json`)
        }
    
        let npm: any;
        try {
            const output = shell.exec(`npm view -json ${repo}`, {silent:true});
            npm = JSON.parse(output)
        } catch (error) {
            console.error(`There was an error reading/parsing npm data for: ${repo}`);
        }
    
        if (data.name !== repo) {
            console.log('\nnames do not match!!!\n', {
                repo,
                name: data.name,
            });
        }
    
        const packageJson = {
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
        const npmData = !npm.error ? npm : undefined;
    
        return { packageJson, npmData };
    }
}
