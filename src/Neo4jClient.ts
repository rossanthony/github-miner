import { Driver, Session, Record, StatementResult } from 'neo4j-driver/types/v1';
import _ from 'lodash';
import { exec, ExecFunction } from 'shelljs';


export class Neo4jClient {
    constructor(
        private readonly driver: Driver,
        private readonly session: Session,
        private readonly shellExec: ExecFunction = exec,
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

    public async saveGitRepoAndUser(gitHubJson: any): Promise<void> {
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
            name: gitHubJson.name,
            ownerUsername: gitHubJson.owner.login,
            size: gitHubJson.size,
            stargazers: gitHubJson.stargazers_count,
            watchers: gitHubJson.watchers_count,
            forks: gitHubJson.forks_count,
            openIssues: gitHubJson.open_issues_count,
            createdAt: gitHubJson.created_at,
            updatedAt: gitHubJson.updated_at,
            pushedAt: gitHubJson.pushed_at,
        };

        const name = _.snakeCase(gitHubJson.name);
        const query = `CREATE (_${name}:GitRepo {${fields}}) RETURN _${name}`;

        console.log('Saving GitRepo to neo4j...', {
            query, dataToSave,
        });

        await this.session.run(query, dataToSave);
        const owner = await this.saveGitUser(gitHubJson.owner, gitHubJson.name);

        console.log('Saved owner:', owner);
    }

    public async saveGitUser(user: any, repoName: string): Promise<void> {
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

            console.log('Saving GitUser to neo4j...', {query, dataToSave});

            await this.session.run(query, dataToSave);
        }

        query = `MATCH (a:GitUser {username:'${user.login}'}), (b:GitRepo {name:'${repoName}'})\nCREATE (a)-[:OWNS]->(b)`;

        console.log('Saving relationship to neo4j...', {query});

        const relationshipResult: StatementResult = await this.session.run(query);

        console.log('relationshipResult >>>', JSON.stringify(relationshipResult, null, 2));
    }

    public async saveNodeModules(repo: string, packageJson: any): Promise<void> {
        console.log('packageJson >>>', packageJson);
        let npmJson: any;
        try {
            const npmMeta = this.shellExec(`npm view -json ${repo}`, { silent: true });
            console.log('npmMeta >', npmMeta);
            npmJson = JSON.parse(npmMeta);
        } catch (error) {
            console.log('npm cli lookup failed:', error);
        }
        console.log('npmJson >', npmJson);

        if (npmJson && !npmJson.error && npmJson.name) {
            // only run this if git repo itself is a node module hosted on npm...
            console.log('adding new NodeModule record for >>>', repo);
            await this.saveNodeModule(npmJson, repo);
        }

        for (let dependency in packageJson.dependencies) {
            console.log('dependency >>>', dependency);
            console.log('packageJson.dependencies[dependency] >>>', packageJson.dependencies[dependency]);
            await this.saveNodeModule({ name: dependency }, repo, packageJson.dependencies[dependency]);
        }
    }

    private async saveNodeModule(
        packageJson: any,
        dependencyOfGitRepo: string,
        version?: string,
    ): Promise<any> {
        console.log('packageJson >>>', packageJson);

        let query;
        let existingModule = await this.getNodeModule(packageJson.name);

        console.log('existingModule', existingModule);

        if (!existingModule) {
            console.log('adding new NodeModule record for >>>', dependencyOfGitRepo);
            const name = _.snakeCase(packageJson.name);
            query = `CREATE (_${name}:NodeModule {name: '${packageJson.name}'})`;
            console.log('Saving NodeModule to neo4j...', {query});
            await this.session.run(query);
        }

        if (version) {
            query = `MATCH (a:GitRepo {name:'${dependencyOfGitRepo}'}), (b:NodeModule {name:'${packageJson.name}'})\n`
                  + `CREATE (a)-[:DEPENDS_ON {version:'${version}'}]->(b)`;

            console.log('Saving relationship to neo4j...', {query});

            const relationshipResult: StatementResult = await this.session.run(query);

            console.log('relationshipResult >>>', JSON.stringify(relationshipResult, null, 2));
        }
    }
}
