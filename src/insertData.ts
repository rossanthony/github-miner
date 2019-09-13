import * as readJson from 'read-package-json';
import * as shell from 'shelljs';
import * as fs from 'fs-extra';
import { get } from 'lodash'; 
import { Driver, Session } from 'neo4j-driver/types/v1';
import {v1 as neo4j} from 'neo4j-driver';
import { Neo4jClient } from './Neo4jClient';

const driver: Driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password')
);
const session: Session = driver.session();

const neo4jClient = new Neo4jClient(
    driver,
    session,
);

const parsePackageJson = async (username: string, repo: string) => {
    return new Promise((resolve, reject) => {
        readJson(`./data/repos/${username}/${repo}/package.json`, console.error, false, function (er: any, data: any) {
            if (er) {
                console.error("There was an error reading", `./data/repos/${username}/${repo}/package.json`)
                return resolve();
            }

            console.log(`\n${username}/${repo} > raw file`, JSON.stringify(data, null, 2));

            // const output = shell.exec(`npm view -json ${repo}`, {silent:true});
            // console.log(`\nnpm view -json ${repo}`, JSON.stringify(data, null, 2));

            if (data.name !== repo) {
                console.log('\nnames do not match!!!\n', {
                    repo,
                    name: data.name,
                });
            }

            return resolve({
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
            });
        
            // console.info('the package data is', data.dependencies);
    
            for (let key in data.dependencies) {
                console.log('key', key);
                const output = shell.exec(`npm view -json ${key}`, {silent:true});
    
                if (output.code === 0) {
                    let npmMeta: any;
                    try {
                        npmMeta = JSON.parse(output);
                    } catch (error) {
                        console.error(`failed to parse JSON for ${key}`, error);
                        return;
                    }
    
                    const dataToSave = {
                        maintainers: npmMeta.maintainers,
                        author: npmMeta.author,
                        repository: npmMeta.repository,
                        modified: npmMeta.time.modified,
                        created: npmMeta.time.created,
                        dependencies: npmMeta.dependencies,
                        devDependencies: npmMeta.devDependencies,
                        version: npmMeta.version,
                        homepage: npmMeta.homepage,
                        keywords: npmMeta.keywords,
                        engines: npmMeta.engines,
                    };
    
                    console.log(`found ${key} in npm`, dataToSave);
    
    
                } else if (output.code === 0) {
                    console.log(`failed to find ${key} in npm`);
                } else {
                    console.error(`unexpected code for ${key}`, output.code);
                }
            }
        });
    });
}

const insertData = async () => {
    const users = fs.readdirSync('./data/repos/');
    console.log('folders in /data/repos', users.length);

    // const record = await neo4jClient.getNodeModule('123');
    // console.log('record', JSON.stringify(record, null, 2));

    let i = 0;

    for (let username of users) {
        if (username === '.DS_Store') {
            continue;
        }

        const repos = fs.readdirSync(`./data/repos/${username}`);
        console.log(`./data/repos/${username}`, repos);

        for (let repo of repos) {
            if (repo === '.DS_Store') {
                continue;
            }

            const filePath = `./data/repos/${username}/${repo}/github.json`;
            const fileContents = await fs.readFile(filePath, 'utf8').catch(() => null);

            if (!fileContents) {
                console.log('no file found:', filePath);
                continue;
            }

            let gitHubJson;
            try {
                gitHubJson = JSON.parse(fileContents);
            } catch (error) {
                console.log('unable to parse json in:', filePath);
                continue;
            }

            // console.log(`${username}/${repo}/github.json`, JSON.stringify(gitHubJson, null, 2));

            i++;
            const record = await neo4jClient.getGitRepo(repo);
            if (!record) {
                await neo4jClient.saveGitRepoAndUser(gitHubJson);
                console.log(`record saved for ${repo}`, JSON.stringify(record, null, 2));
            } else {
                console.log(`record exists for ${repo}`, JSON.stringify(record, null, 2));
            }

            const packageJson = await parsePackageJson(username, repo);
            if (packageJson) {
                await neo4jClient.saveNodeModules(repo, packageJson);
            }
            // if (i > 500) {
            //     break;
            // }
        }
        // if (i > 500) {
        //     break;
        // }
    }

    // on application exit:
    driver.close();
};

insertData()
    .catch((e) => console.log('Error caught', e))
    .finally(() => {
        console.log('Done.');
    });

