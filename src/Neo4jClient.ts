import { Driver, Session, Record, StatementResult } from 'neo4j-driver/types/v1';
import * as _ from 'lodash';

export class Neo4jClient {
    constructor(
        private readonly driver: Driver,
        private readonly session: Session,
    ) {}

    public async getNodeModule(name: string): Promise<Record | null> {
        const resultPromise: StatementResult = await this.session.run(
            'MATCH (a:NodeModule {name: $name}) RETURN a', { name }
        );
        return resultPromise.records && resultPromise.records.length > 0
            ? resultPromise.records[0]
            : null;
    }

    public async getGitRepo(name: string): Promise<Record | null> {
        const resultPromise: StatementResult = await this.session.run(
            'MATCH (a:GitRepo {name: $name}) RETURN a', { name }
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
        const fieldsToSave = [
            'name',
            'ownerUsername',
            'size',
            'stargazers',
            'watchers',
            'forks',
            'openIssues',
            'createdAt',
            'updatedAt',
            'pushedAt',
        ];
        const fields = fieldsToSave.map((field: string) => `${field}: $${field}`).join(',');
        const dataToSave = {
            name: data.name,
            ownerUsername: data.owner.login,
            size: data.size,
            stargazers: data.stargazers_count,
            watchers: data.watchers_count,
            forks: data.forks_count,
            openIssues: data.open_issues_count,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            pushedAt: data.pushed_at,
        };

        const name = _.snakeCase(data.name);
        const query = `CREATE (_${name}:GitRepo {${fields}}) RETURN _${name}`;

        console.log('Saving GitRepo to neo4j...', {
            query, dataToSave,
        });

        const resultPromise: StatementResult = await this.session.run(query, dataToSave);

        const owner = await this.saveGitUser(data.owner, data.name);

        console.log('Saved owner:', owner);

        return resultPromise.records && resultPromise.records.length > 0
            ? resultPromise.records[0]
            : null;
    }

    public async saveGitUser(user: any, repoName: string): Promise<any> {
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

            console.log('Saving GitUser to neo4j...', {query, dataToSave});
            
            const resultPromise: StatementResult = await this.session.run(query, dataToSave);

            existingUser = resultPromise.records && resultPromise.records.length > 0
                ? resultPromise.records[0]
                : null;
        }

        query = `MATCH (a:GitUser {username:'${user.login}'}), (b:GitRepo {name:'${repoName}'})
                CREATE (a)-[:OWNS]->(b)`;

        console.log('Saving relationship to neo4j...', {query});

        const relationshipResult: StatementResult = await this.session.run(query);

        console.log('relationshipResult >>>', JSON.stringify(relationshipResult, null, 2));
        
        return existingUser;
    }

    public async saveNodeModules(repo: any, packageJson: any): Promise<any> {
        console.log('packageJson >>>', packageJson);

        // only run this if git repo itself is a node module hosted on npm...

        // let existingModule = await this.getNodeModule(packageJson.name);

        // if (!existingModule) {
        //     console.log('adding new NodeModule record for >>>', repo);
        //     await this.saveNodeModule(packageJson, repo);
        // }

        for (let dependency in packageJson.dependencies) {
            console.log('dependency >>>', dependency);
            console.log('packageJson.dependencies[dependency] >>>', packageJson.dependencies[dependency]);
            await this.saveNodeModule({ name: dependency }, repo, packageJson.dependencies[dependency]);
        }
    }

    public async saveNodeModule(
        packageJson: any,
        dependencyOfGitRepo?: string,
        version?: string,
    ): Promise<any> {
        console.log('packageJson >>>', packageJson);

        let query;
        let existingModule = await this.getNodeModule(packageJson.name);

        if (!existingModule && dependencyOfGitRepo) {
            console.log('adding new NodeModule record for >>>', dependencyOfGitRepo);
            const name = _.snakeCase(packageJson.name);
            query = `CREATE (_${name}:NodeModule {name: '${packageJson.name}'})\n`;
            console.log('Saving NodeModule to neo4j...', {query});
            await this.session.run(query);
        }

        if (dependencyOfGitRepo && version) {
            query = `MATCH (a:GitRepo {name:'${dependencyOfGitRepo}'}), (b:NodeModule {name:'${packageJson.name}'})
                    CREATE (a)-[:DEPENDS_ON {version:'${version}'}]->(b)`;

            console.log('Saving relationship to neo4j...', {query});

            const relationshipResult: StatementResult = await this.session.run(query);

            console.log('relationshipResult >>>', JSON.stringify(relationshipResult, null, 2));
        }

        return existingModule;
    }
}
