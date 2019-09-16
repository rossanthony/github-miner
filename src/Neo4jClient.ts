import { Driver, Session, Record, StatementResult } from 'neo4j-driver/types/v1';
import _ from 'lodash';
import * as fs from 'fs-extra';
import { RedisService } from './RedisService';

const NpmApi = require('npm-api');

export class Neo4jClient {
    constructor(
        private readonly driver: Driver,
        private readonly session: Session,
        private readonly redisService: RedisService,
    ) {}

    public close(): void {
        this.driver.close();
        this.session.close();
    }

    public async getNodeModule(name: string): Promise<Record | null> {
        const resultPromise: StatementResult = await this.session.run(
            'MATCH (a:NodeModule {name: $name}) RETURN a', { name }
        );
        return resultPromise.records && resultPromise.records.length > 0
            ? resultPromise.records[0]
            : null;
    }

    public async getGitRepo(full_name: string): Promise<Record | null> {
        const resultPromise: StatementResult = await this.session.run(
            'MATCH (a:GitRepo {full_name: $full_name}) RETURN a', { full_name }
        );
        return resultPromise.records && resultPromise.records.length > 0
            ? resultPromise.records[0]
            : null;
    }

    public async getGitUser(username: string): Promise<Record | null> {
        const resultPromise: StatementResult = await this.session.run(
            `MATCH (a:GitUser {username: $username}) RETURN a`, { username }
        );
        return resultPromise.records && resultPromise.records.length > 0
            ? resultPromise.records[0]
            : null;
    }

    public async saveGitRepo(data: any): Promise<Record | null> {
        const dataToSave = {
            name: data.name,
            full_name: data.full_name,
            ownerUsername: data.owner.login,
            size: data.size,
            stargazers_count: data.stargazers_count,
            watchers_count: data.watchers_count,
            forks_count: data.forks_count,
            open_issues_count: data.open_issues_count,
            created_at: data.created_at,
            updated_at: data.updated_at,
            pushed_at: data.pushed_at,
        };
        const fields = Object.keys(dataToSave).map((field: string) => `${field}: $${field}`).join(',');
        const name = _.snakeCase(data.full_name);
        const query = `CREATE (_${name}:GitRepo {${fields}}) RETURN _${name}`;

        // console.log('Saving GitRepo to neo4j...', {
        //     query, dataToSave,
        // });

        const resultPromise: StatementResult = await this.session.run(query, dataToSave);

        await this.saveGitUser(data.owner, dataToSave);

        // console.log('Saved owner:', owner);

        return resultPromise.records && resultPromise.records.length > 0
            ? resultPromise.records[0]
            : null;
    }

    public async saveGitUser(user: any, repo: any): Promise<any> {
        let query;
        let existingUser = await this.getGitUser(user.login);

        if (!existingUser) {
            const fieldsToSave = [
                'htmlUrl',
                'username',
            ];
            const fields = fieldsToSave.map((field: string) => `${field}: $${field}`).join(',');
            const dataToSave = {
                htmlUrl: user.html_url,
                username: user.login,
            };

            const name = _.snakeCase(user.login);

            query = `CREATE (_${name}:GitUser {${fields}})\n`;

            // console.log('Saving GitUser to neo4j...', {query, dataToSave});
            
            const resultPromise: StatementResult = await this.session.run(query, dataToSave);

            existingUser = resultPromise.records && resultPromise.records.length > 0
                ? resultPromise.records[0]
                : null;
        }

        query = `MATCH (a:GitUser {username:'${user.login}'}), (b:GitRepo {full_name:'${repo.full_name}'})
                CREATE (a)-[:OWNS {created_at:'${repo.created_at}'}]->(b)`;

        // console.log('Saving relationship to neo4j...', {query});

        await this.session.run(query);

        // console.log('relationshipResult >>>', JSON.stringify(relationshipResult, null, 2));
        
        return existingUser;
    }

    
    // public async saveNodeModules(repoName: string, packageJson: any): Promise<any> {
    //     console.log('saveNodeModules >>> for repo:', repoName);
    //     await this.saveNodeModule(packageJson, repoName);

    //     for (let dependency in packageJson.dependencies) {
    //         console.log(`${repoName} > dependencies[${dependency}] ver:`, packageJson.dependencies[dependency]);
    //         await this.saveNodeModule({ name: dependency }, repoName, packageJson.dependencies[dependency]);
    //     }
    // }

    /**
     * Save records for all node modules listed within the package.json of one repo
     */
    public async saveNodeModulesUsedByGitRepo(
        repoName: string,
        packageJson: any,
    ): Promise<void> {
        if (!packageJson || !packageJson.name) {
            return;
        }
        // let existingModule = await this.getNodeModule(packageJson.name);

        // if (existingModule) {
        //     console.log('NodeModule record already exists for:', packageJson.name);
        //     // Add relationships
        //     await this.setRelationBetweenNodeModuleAndGitRepo(
        //         packageJson.name,
        //         repoName,
        //         'HOSTED_ON',
        //     );
        //     return;
        // }

        console.log('saveNodeModulesUsedByGitRepo >', repoName);

        // 1. check if this repo is a hosted package on npm...
        const npmData = await this.getNpmData(packageJson.name, true);

        // if (npmData && !npmData.error) {
        //     if (npmData.repository && npmData.repository.url && npmData.repository.type === 'git') {
        //         const github = npmData.repository.url.match(/github\.com\/(\S+)\/(\S+)\.git/);

        //         console.log('npmData.repository -->', npmData.repository);

        //         if (github && github.length >= 3) {
        //             const githubUser = github[1];
        //             const githubRepo = github[2];

        //             console.log('github user/repo -->', {
        //                 githubUser,
        //                 githubRepo,
        //             });

        //             if (githubRepo && githubUser) {
        //                 const githubJson: string|null = await fs.readFile(`./data/repos/${githubUser}/${githubRepo}/github.json`, 'utf8').catch(() => null);
        //                 const packageJson: string|null = await fs.readFile(`./data/repos/${githubUser}/${githubRepo}/package.json`, 'utf8').catch(() => null);

        //                 if (githubJson) {
        //                     console.log('githubJson >', githubJson);
        //                     await this.saveGitRepo(JSON.parse(githubJson));
        //                 } else {
        //                     console.log(`\n\n*********\n\nnpm module dependency without github reference: \n${githubUser}/${githubRepo}\n\n`)
        //                 }
        //                 if (packageJson) {
        //                     await this.saveNodeModules(githubRepo, JSON.parse(packageJson));
        //                 }
        //             }
        //         }
        //     }
        // }

        if (!npmData || npmData.error) {
            // GitRepo is not a known package on NPM
            // Just save it's dependencies...
            console.log(`${packageJson.name} is not an npm package, saving dependencies...`);

            for (let dependency in packageJson.dependencies) {
                // for each dependency save it and save a relationship between the git repo and the module
                try {
                    const npmData = await this.getNpmData(dependency);
                    await this.saveNodeModule(npmData);
                    await this.setRelationBetweenGitRepoAndNodeModule(
                        repoName,
                        dependency,
                        'DEPENDS_ON',
                        packageJson.dependencies[dependency], // version
                    );
                    // attempt to save sub-dependencies...
                    await this.saveDepsOfNodeModule(npmData);
                    await this.redisService.sadd('dependencies-saved', npmData.name);
                } catch (error) {
                    console.error(`Error caught while saving dependency: ${dependency}`, error);
                }
            }

            for (let devDependency in packageJson.devDependencies) {
                // for each dev dependency save it and save a relationship between the git repo and the module
                try {
                    const npmData = await this.getNpmData(devDependency);
                    await this.saveNodeModule(npmData);
                    await this.setRelationBetweenGitRepoAndNodeModule(
                        repoName,
                        devDependency,
                        'DEV_DEPENDS_ON',
                        packageJson.devDependencies[devDependency], // version
                    );
                    // attempt to save sub-dependencies...
                    await this.saveDepsOfNodeModule(npmData);
                    await this.redisService.sadd('dependencies-saved', npmData.name);
                } catch (error) {
                    console.error(`Error caught while saving devDependency: ${devDependency}`, error);
                }
            }
            return;
        }

        // if (version) {
        //     const relationshipCreated = await this.setRelationBetweenGitRepoAndNodeModule(
        //         repoName,
        //         packageJson.name,
        //         'DEPENDS_ON',
        //         version,
        //     );
        // }

        if (npmData) {
            console.log(`GitRepo: ${repoName} found on npm, name on npm:`, npmData.name);

            // this repo is itself a package hosted on NPM, so save it...
            await this.saveNodeModule(npmData);
            await this.setRelationBetweenNodeModuleAndGitRepo(
                npmData.name,
                repoName,
                'HOSTED_ON',
            );
            // and save it's dependencies...
            await this.saveDepsOfNodeModule(npmData, repoName);
            await this.redisService.sadd('dependencies-saved', npmData.name); 
            await this.saveDevDepsOfNodeModule(npmData, repoName);
            await this.redisService.sadd('dev-dependencies-saved', npmData.name); 
        }

        await this.redisService.sadd('github-repos-inserted', repoName);
    }

    public async saveNodeModule(npmData: any): Promise<void> {
        if (!await this.getNodeModule(npmData.name)) {
            console.log('adding new NodeModule record for >>>', npmData.name);
            const name = _.snakeCase(npmData.name);
            const query = `CREATE (_${name}:NodeModule {name: '${npmData.name}'})\n`;
            console.log('Saving NodeModule to neo4j...', {query});
            await this.session.run(query);
        }
    }

    public async saveDepsOfNodeModule(
        npmData: any,
        dependencyOfGitRepo?: string,
        callCount: number = 1,
    ): Promise<any> {
        if (!npmData || !npmData.name || !npmData.dependencies) {
            return;
        }

        const existsInCache = await this.redisService.sismember('dependencies-saved', npmData.name);
        if (existsInCache === 1) {
            console.log(`\nSkipping ${npmData.name}, already in cache\n`);
            return;
        }

        for (let dependency in npmData.dependencies) {
            console.log(`dependencies[${dependency}] ver:`, npmData.dependencies[dependency]);
            try {
                // const saveToCache = await this.redisService.sadd('dependencies-saved', dependency);
                const alreadyExistsInCache = await this.redisService.sismember('dependencies-saved', dependency);
                if (!dependencyOfGitRepo && alreadyExistsInCache) {
                    console.log(`\nCall count: ${callCount} / Not direct deps of repo / Deps of ${dependency} already in cache, save relation and continue...\n`);
                    await this.setRelationBetweenNodeModules(
                        npmData.name,
                        dependency,
                        'DEPENDS_ON',
                        npmData.dependencies[dependency],
                    );
                    continue;
                }

                // const dependencyNpmData = await this.getNpmData(dependency);
                // await this.saveNodeModule(dependencyNpmData);
                await this.saveNodeModule({ name: dependency });

                if (dependencyOfGitRepo) {
                    await this.setRelationBetweenGitRepoAndNodeModule(
                        dependencyOfGitRepo,
                        dependency,
                        'DEPENDS_ON',
                        npmData.dependencies[dependency],
                    );
                    console.log(`\nSaved relationship between ${dependencyOfGitRepo} -> ${dependency}\n`);
                }

                const relationshipCreated = await this.setRelationBetweenNodeModules(
                    npmData.name,
                    dependency,
                    'DEPENDS_ON',
                    npmData.dependencies[dependency],
                );

                if (!relationshipCreated || alreadyExistsInCache) {
                    console.log(`\nCall count: ${callCount} / Deps of ${dependency} already in cache, skipping...\n`);
                    continue;
                }

                if (relationshipCreated && !alreadyExistsInCache) {
                    // To avoid getting stuck in a loop due to circular dependencies, only attempt to fetch
                    // the dependencies of this dependencies if the relationship was created for the first time.
                    const dependencyNpmData = await this.getNpmData(dependency);
                    await this.saveDepsOfNodeModule(dependencyNpmData, undefined, callCount + 1);
                    await this.redisService.sadd('dependencies-saved', dependency); 
                }
            } catch (error) {
                console.error(`There was an error parsing npm data for dependency: ${dependency}`);
            }
        }
    }

    public async saveDevDepsOfNodeModule(
        npmData: any,
        dependencyOfGitRepo?: string,
        callCount: number = 1,
    ): Promise<any> {
        if (!npmData || !npmData.name || !npmData.devDependencies) {
            return;
        }

        // const saveToCache = await this.redisService.sadd('dev-dependencies-saved', npmData.name);
        // const alreadyExistsInCache = (saveToCache === 0);

        for (let dependency in npmData.devDependencies) {
            console.log(`dependencies[${dependency}] ver:`, npmData.devDependencies[dependency]);
            try {
                // const saveToCache = await this.redisService.sadd('dev-dependencies-saved', dependency);
                const alreadyExistsInCache = await this.redisService.sismember('dev-dependencies-saved', dependency);
                if (!dependencyOfGitRepo && alreadyExistsInCache) {
                    console.log(`\nCall count: ${callCount} / Not direct dev-deps of repo / dev-deps of ${dependency} already in cache, save relation and continue...\n`);
                    await this.setRelationBetweenNodeModules(
                        npmData.name,
                        dependency,
                        'DEV_DEPENDS_ON',
                        npmData.devDependencies[dependency],
                    );
                    continue;
                }

                await this.saveNodeModule({ name: dependency });

                if (dependencyOfGitRepo) {
                    await this.setRelationBetweenGitRepoAndNodeModule(
                        dependencyOfGitRepo,
                        dependency,
                        'DEV_DEPENDS_ON',
                        npmData.devDependencies[dependency],
                    );
                    console.log(`\nSaved relationship between ${dependencyOfGitRepo} -> ${dependency}\n`);
                }

                const relationshipCreated = await this.setRelationBetweenNodeModules(
                    npmData.name,
                    dependency,
                    'DEV_DEPENDS_ON',
                    npmData.devDependencies[dependency],
                );

                if (!relationshipCreated || alreadyExistsInCache) {
                    console.log(`\nCall count: ${callCount} / Dev-deps of ${dependency} already in cache, skipping...\n`);
                    continue;
                }

                if (relationshipCreated && !alreadyExistsInCache) {
                    // When saving dev dependencies, only save one level deep, but do recursively fetch the
                    // main deps (because these would be required when developing in this repo locally)
                    const dependencyNpmData = await this.getNpmData(dependency);
                    await this.saveDepsOfNodeModule(dependencyNpmData, undefined, callCount + 1);
                    await this.redisService.sadd('dependencies-saved', dependency);
                }
            } catch (error) {
                console.error(`There was an error parsing npm data for dependency: ${dependency}`);
            }
        }
    }

    public async setRelationBetweenNodeModules(a: string, b: string, relationship: string, version: string = ''): Promise<boolean> {
        console.log('setRelationBetweenNodeModules >');
        const result = await this.session.run(
            `MATCH  (a:NodeModule {name:'${a}'}), (b:NodeModule {name:'${b}'})\n` +
            `RETURN EXISTS((a)-[:${relationship}]-(b))`,
        );
        console.log(
            'relationshipExists?',
            `(a:NodeModule {name:'${a}'})-[:${relationship}]-(b:NodeModule {name:'${b}'})`,
            _.get(result, 'records[0]._fields[0]'),
        );
        if (!_.get(result, 'records[0]._fields[0]')) {
            await this.session.run(
                `MATCH (a:NodeModule {name:'${a}'}), (b:NodeModule {name:'${b}'})\n` +
                `CREATE (a)-[:${relationship} {version:'${version}'}]->(b)`,
            );
            return true;
        }
        return false;
    }

    public async setRelationBetweenGitRepoAndNodeModule(a: string, b: string, relationship: string, version: string = ''): Promise<boolean> {
        const result = await this.session.run(
            `MATCH  (a:GitRepo {full_name:'${a}'}), (b:NodeModule {name:'${b}'})\n` +
            `RETURN EXISTS((a)-[:${relationship}]-(b))`,
        );
        console.log(
            'relationshipExists?',
            `(a:GitRepo {full_name:'${a}'})-[:${relationship}]-(b:NodeModule {name:'${b}'})`,
            _.get(result, 'records[0]._fields[0]'),
        );
        if (!_.get(result, 'records[0]._fields[0]')) {
            await this.session.run(
                `MATCH (a:GitRepo {full_name:'${a}'}), (b:NodeModule {name:'${b}'})\n` +
                `CREATE (a)-[:${relationship} {version:'${version}'}]->(b)`,
            );
            return true;
        }
        return false;
    }

    public async setRelationBetweenNodeModuleAndGitRepo(a: string, b: string, relationship: string) {
        const result = await this.session.run(
            `MATCH  (a:NodeModule {name:'${a}'}), (b:GitRepo {full_name:'${b}'})\n` +
            `RETURN EXISTS((a)-[:${relationship}]-(b))`,
        );
        console.log(
            'relationshipExists?',
            `(a:NodeModule {name:'${a}'})-[:${relationship}]-(b:GitRepo {full_name:'${b}'})`,
            _.get(result, 'records[0]._fields[0]'),
        );
        if (!_.get(result, 'records[0]._fields[0]')) {
            await this.session.run(
                `MATCH (a:NodeModule {name:'${a}'}), (b:GitRepo {full_name:'${b}'})\n` +
                `CREATE (a)-[:${relationship}]->(b)`,
            );
            return true;
        }
        return false;
    }

    private async getNpmData(name: string, includeDevDependencies: boolean = false): Promise<any> {
        console.time(`getNpmData ${name}`);
        let dependencyNpmData = null;
        try {
            const filePath = `./data/npm/${name}/data.json`;
            console.timeLog(`getNpmData ${name}`, {step: 'read file'});
            const fileContents: string|null = await fs.readFile(filePath, 'utf8').catch(() => null);
            if (fileContents) {
                console.timeLog(`getNpmData ${name}`, {step: 'parsing file to json object'});
                dependencyNpmData = JSON.parse(fileContents);
            }
            if (!dependencyNpmData) {
                // console.timeLog(`getNpmData ${name}`, {step: 'exec npm view -json'});
                // const output = shell.exec(`npm view -json ${name}`, {silent:true});
                console.timeLog(`getNpmData ${name}`, {step: 'npm api call'});
                let npm = new NpmApi();
                const repo = npm.repo(name);
                console.timeLog(`getNpmData ${name}`, {step: 'npm repo fetched'});
                dependencyNpmData = {
                    ...repo,
                    dependencies: await repo.dependencies(),
                    devDependencies: includeDevDependencies ? await repo.devDependencies() : null,
                };
                console.timeLog(`getNpmData ${name}`, {step: 'npm dependencies fetched'});
                // console.log('\nnpm output >>>>>>>>>>>>', JSON.stringify(dependencyNpmData, null, 2));
                console.timeLog(`getNpmData ${name}`, {step: 'saving to file'});
                await fs.outputFile(filePath, JSON.stringify(dependencyNpmData, null, 2));
                console.timeLog(`getNpmData ${name}`, {step: 'saved to file'});
            }
        } catch (error) {
            console.log(`Error caught trying to fetch npm data for ${name}`, error);
        }
        console.timeEnd(`getNpmData ${name}`);
        return dependencyNpmData;
    }
}
