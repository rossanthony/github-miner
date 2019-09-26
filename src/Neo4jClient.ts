import { Driver, Session, Record, StatementResult } from 'neo4j-driver/types/v1';
import { v1 as neo4j } from 'neo4j-driver';
import _ from 'lodash';
import * as fs from 'fs-extra';
import { RedisService } from './RedisService';

const NpmApi = require('npm-api');

export class Neo4jClient {
    private driver: Driver;
    private session: Session;

    constructor(
        private readonly redisService: RedisService,
        private readonly npmApi: any = new NpmApi(),
    ) {
        this.driver = neo4j.driver(
            'bolt://localhost:7687',
            neo4j.auth.basic('neo4j', 'password')
        ),
        this.session = this.driver.session();
    }

    public close(): void {
        this.driver.close();
        this.session.close();
    }

    public async getNodeModule(name: string): Promise<any> {
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

    public async saveGitRepoAndUser(data: any): Promise<void> {
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
        await this.session.run(`CREATE (_${name}:GitRepo {${fields}}) RETURN _${name}`, dataToSave);
        await this.saveGitUser(data.owner, dataToSave);
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
            query = `CREATE (_${name}:GitUser {${fields}})`;
            await this.session.run(query, dataToSave);
        }
        query = `MATCH (a:GitUser {username:'${user.login}'}), (b:GitRepo {full_name:'${repo.full_name}'})\n`
              + `CREATE (a)-[:OWNS {created_at:'${repo.created_at}'}]->(b)`;
        await this.session.run(query);
        return existingUser;
    }

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

        let nodeModule = await this.getNodeModule(packageJson.name);

        if (!nodeModule) {
            // 1. check if this repo is a hosted package on npm...
            const npmData = await this.getNpmData(packageJson.name);

            if (npmData) {
                nodeModule = await this.saveNodeModule(npmData);
                await this.setRelationBetweenNodeModuleAndGitRepo(
                    nodeModule.name,
                    repoName,
                    'HOSTED_ON',
                );
                // and save it's dependencies...
                await this.saveDepsOfNodeModule(npmData, repoName);
                await this.redisService.sadd('dependencies-saved', nodeModule.name); 
                await this.saveDevDepsOfNodeModule(npmData, repoName);
                await this.redisService.sadd('dev-dependencies-saved', nodeModule.name);
                await this.savePeerDepsOfNodeModule(npmData, repoName);
                await this.redisService.sadd('peer-dependencies-saved', nodeModule.name);
                await this.redisService.sadd('github-repos-inserted', repoName);
                return;
            }
        }

        // GitRepo is not a known package on NPM (or we've already saved it)
        // Just save it's dependencies...
        console.log(`\n${packageJson.name} is not an npm package, saving dependencies...`);

        for (let dependency in packageJson.dependencies) {
            // for each dependency save it and save a relationship between the git repo and the module
            try {
                let nodeModule = await this.getNodeModule(dependency);
                if (!nodeModule) {
                    const npmData = await this.getNpmData(dependency);
                    if (npmData) {
                        nodeModule = await this.saveNodeModule(npmData);
                        await this.saveDepsOfNodeModule(npmData);
                        await this.redisService.sadd('dependencies-saved', dependency);
                    } else {
                        throw new Error('No data found in npm');
                    }
                }
                if (nodeModule) {
                    await this.setRelationBetweenGitRepoAndNodeModule(
                        repoName,
                        dependency,
                        'DEPENDS_ON',
                        packageJson.dependencies[dependency], // version
                    );
                }
            } catch (error) {
                console.error(`Error caught while saving dependency: ${dependency}`, error);
            }
        }

        for (let devDependency in packageJson.devDependencies) {
            // for each dev dependency save it and save a relationship between the git repo and the module
            try {
                let nodeModule = await this.getNodeModule(devDependency);
                if (!nodeModule) {
                    const npmData = await this.getNpmData(devDependency);
                    if (npmData) {
                        nodeModule = await this.saveNodeModule(npmData);
                        // attempt to save sub-dependencies
                        // note: intentionally fetching dependencies here (not devDependencies)
                        // fetching devDependencies of devDependencies recursively is excessively intensive,
                        // when a library is installed it only pulls in the dependencies, so no need to traverse
                        // devDependencies any further than 1 level
                        await this.saveDepsOfNodeModule(npmData);
                        await this.redisService.sadd('dependencies-saved', devDependency);
                    } else {
                        throw new Error('No data found in npm');
                    }
                }
                if (nodeModule) {
                    await this.setRelationBetweenGitRepoAndNodeModule(
                        repoName,
                        devDependency,
                        'DEV_DEPENDS_ON',
                        packageJson.devDependencies[devDependency], // version
                    );
                }
            } catch (error) {
                console.error(`Error caught while saving devDependency: ${devDependency}`, error);
            }
        }

        console.log('packageJson.peerDependencies >>>', packageJson.peerDependencies);

        for (let peerDependency in packageJson.peerDependencies) {
            // for each peer dependency save it and save a relationship between the git repo and the module
            try {
                let nodeModule = await this.getNodeModule(peerDependency);
                if (!nodeModule) {
                    const npmData = await this.getNpmData(peerDependency);
                    if (npmData) {
                        nodeModule = await this.saveNodeModule(npmData);
                        // attempt to save sub-dependencies
                        // note: intentionally fetching dependencies here (not peerDependencies)
                        // fetching peerDependencies of peerDependencies recursively is unnecessary,
                        // when a library is installed it only pulls in the dependencies, so no need to traverse
                        // peerDependencies any further than 1 level
                        await this.saveDepsOfNodeModule(npmData);
                        await this.redisService.sadd('dependencies-saved', peerDependency);
                    } else {
                        throw new Error('No data found in npm');
                    }
                }
                if (nodeModule) {
                    await this.setRelationBetweenGitRepoAndNodeModule(
                        repoName,
                        peerDependency,
                        'PEER_DEPENDS_ON',
                        packageJson.peerDependencies[peerDependency], // version
                    );
                }
            } catch (error) {
                console.error(`Error caught while saving peerDependency: ${peerDependency}`, error);
            }
        }
        await this.redisService.sadd('github-repos-inserted', repoName);
    }

    private async saveNodeModule(npmData: any): Promise<any> {
        const existingModule = await this.getNodeModule(npmData.name);
        if (existingModule) {
            return existingModule;
        }
        const dataToSave: any = {
            name: npmData.name,
            description: _.get(npmData, 'description'),
            version: _.get(npmData, 'version'),
            repositoryType: _.get(npmData, 'repository.type'),
            repositoryUrl: _.get(npmData, 'repository.url'),
            dependenciesTotal: Object.keys(_.get(npmData, 'dependencies', {})).length,
            devDependenciesTotal: Object.keys(_.get(npmData, 'devDependencies', {})).length,
            peerDependenciesTotal: Object.keys(_.get(npmData, 'peerDependencies', {})).length,
        };
        const fields = Object.keys(dataToSave)
            .filter((value: string) => dataToSave[value] !== undefined)
            .map((field: string) => `${field}: $${field}`)
            .join(',');

        console.log(`saveNodeModule > ${npmData.name}`, { fields, dataToSave });
        const name = _.snakeCase(npmData.name);
        await this.session.run(
            `CREATE (_${name}:NodeModule {${fields}})`,
            dataToSave,
        );
        return dataToSave;
    }

    private async saveDepsOfNodeModule(
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
            try {
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
                
                if (!alreadyExistsInCache && !await this.getNodeModule(dependency)) {
                    await this.saveNodeModule(
                        await this.getNpmData(dependency),
                    );
                }

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

    private async saveDevDepsOfNodeModule(
        npmData: any,
        dependencyOfGitRepo: string,
        callCount: number = 1,
    ): Promise<any> {
        if (!npmData || !npmData.name || !npmData.devDependencies || _.isEmpty(npmData.devDependencies)) {
            return;
        }

        console.log(`Saving devDependencies for ${dependencyOfGitRepo}`, npmData.devDependencies)

        for (let dependency in npmData.devDependencies) {
            try {
                const devDepsExistsInCache = await this.redisService.sismember('dev-dependencies-saved', dependency);
                if (!devDepsExistsInCache && !await this.getNodeModule(dependency)) {
                    await this.saveNodeModule(
                        await this.getNpmData(dependency),
                    );
                }
                await this.setRelationBetweenGitRepoAndNodeModule(
                    dependencyOfGitRepo,
                    dependency,
                    'DEV_DEPENDS_ON',
                    npmData.devDependencies[dependency],
                );
                console.log(`\nSaved relationship between ${dependencyOfGitRepo} -> ${dependency}\n`);

                const relationshipCreated = await this.setRelationBetweenNodeModules(
                    npmData.name,
                    dependency,
                    'DEV_DEPENDS_ON',
                    npmData.devDependencies[dependency],
                );

                const depsExistsInCache = await this.redisService.sismember('dependencies-saved', dependency);

                if (!relationshipCreated || depsExistsInCache) {
                    console.log(`\nCall count: ${callCount} / deps of dev-dep ${dependency} already in cache, skipping...\n`);
                    continue;
                }

                if (relationshipCreated && !depsExistsInCache) {
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

    private async savePeerDepsOfNodeModule(
        npmData: any,
        dependencyOfGitRepo: string,
        callCount: number = 1,
    ): Promise<any> {
        if (!npmData || !npmData.name || !npmData.peerDependencies || _.isEmpty(npmData.peerDependencies)) {
            console.log(`No peerDependencies for ${dependencyOfGitRepo}`, npmData.peerDependencies);
            return;
        }

        console.log(`Saving peerDependencies for ${dependencyOfGitRepo}`, npmData.peerDependencies);

        for (let dependency in npmData.peerDependencies) {
            try {
                const peerDepsExistsInCache = await this.redisService.sismember('peer-dependencies-saved', dependency);
                if (!peerDepsExistsInCache && !await this.getNodeModule(dependency)) {
                    await this.saveNodeModule(
                        await this.getNpmData(dependency),
                    );
                }
                await this.setRelationBetweenGitRepoAndNodeModule(
                    dependencyOfGitRepo,
                    dependency,
                    'PEER_DEPENDS_ON',
                    npmData.peerDependencies[dependency],
                );
                console.log(`\nSaved relationship between ${dependencyOfGitRepo} -> ${dependency}\n`);

                const relationshipCreated = await this.setRelationBetweenNodeModules(
                    npmData.name,
                    dependency,
                    'PEER_DEPENDS_ON',
                    npmData.devDependencies[dependency],
                );

                const depsExistsInCache = await this.redisService.sismember('dependencies-saved', dependency);

                if (!relationshipCreated || depsExistsInCache) {
                    console.log(`\nCall count: ${callCount} / deps of peer-dep ${dependency} already in cache, skipping...\n`);
                    continue;
                }

                if (relationshipCreated && !depsExistsInCache) {
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

    private async setRelationBetweenNodeModules(a: string, b: string, relationship: string, version: string = ''): Promise<boolean> {
        console.log('\nsetRelationBetweenNodeModules >');
        const result = await this.session.run(
            `MATCH  (a:NodeModule {name:'${a}'}), (b:NodeModule {name:'${b}'})\n` +
            `RETURN EXISTS((a)-[:${relationship}]->(b))`,
        );
        console.log(
            '\nrelationshipExists?',
            `(a:NodeModule {name:'${a}'})-[:${relationship}]->(b:NodeModule {name:'${b}'})`,
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

    private async setRelationBetweenGitRepoAndNodeModule(a: string, b: string, relationship: string, version: string = ''): Promise<boolean> {
        const result = await this.session.run(
            `MATCH  (a:GitRepo {full_name:'${a}'}), (b:NodeModule {name:'${b}'})\n` +
            `RETURN EXISTS((a)-[:${relationship}]->(b))`,
        );
        console.log(
            '\nrelationshipExists?',
            `(a:GitRepo {full_name:'${a}'})-[:${relationship}]->(b:NodeModule {name:'${b}'})`,
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

    private async setRelationBetweenNodeModuleAndGitRepo(a: string, b: string, relationship: string) {
        // const query = `MATCH (a:NodeModule {name:'${a}'})\n` +
        //               `MATCH (b:GitRepo {full_name:'${b}'})\n` +
        //               `MERGE (a)-[:${relationship}]->(b)`;

        // const result = await this.session.run(query);
        // console.log(`\nSetting relationship:\n${query}`, result);

        // if (!_.get(result, 'records[0]._fields[0]')) {
        //     return true;
        // }
        // return false;

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

    private async getNpmData(name: string): Promise<any> {
        console.time(`getNpmData ${name}`);
        let npmData = null;
        const filePath = `./data/npm/${name}/data.json`;
        try {
            console.timeLog(`getNpmData ${name}`, {step: 'read file'});
            const fileContents: string|null = await fs.readFile(filePath, 'utf8').catch(() => null);
            if (fileContents) {
                console.timeLog(`getNpmData ${name}`, {step: 'parsing file to json object'});
                npmData = JSON.parse(fileContents);
            }
            if (!npmData || !npmData.repository) {
                console.timeLog(`getNpmData ${name}`, {step: 'npm api call'});
                const repo = await this.npmApi.repo(name);
                console.timeLog(`getNpmData ${name}`, {step: 'npm repo fetched'});
                npmData = await repo.package();
                console.timeLog(`getNpmData ${name}`, {step: 'npm dependencies fetched'});
                console.timeLog(`getNpmData ${name}`, {step: 'saving to file'});
                await fs.outputFile(filePath, JSON.stringify(npmData, null, 2));
                console.timeLog(`getNpmData ${name}`, {step: 'saved to file'});
            }
        } catch (error) {
            console.log(`\nError caught trying to fetch npm data for ${name}`, error);
            return;
        }
        console.timeEnd(`getNpmData ${name}`);
        // console.log(`getNpmData ${name}`, {
        //     npmData,
        //     includeDevDependencies,
        //     name,
        //     filePath,
        // });
        return npmData;
    }
}
