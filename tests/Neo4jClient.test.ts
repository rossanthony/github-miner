import { Neo4jClient } from '../src/Neo4jClient';

describe('Neo4jClient', () => {
    const driver: any = {};
    let session: any = {};
    let redisService: any = {};
    let npmApi: any = {};
    let neo4jClient: Neo4jClient;

    beforeEach(() => {
        neo4jClient = new Neo4jClient(driver, session, redisService, npmApi);
    });

    describe('getNodeModule', () => {
        test('returns null if no record is found', async () => {
            session.run = jest.fn().mockResolvedValueOnce({ records: [] });
            expect(await neo4jClient.getNodeModule('foo')).toBe(null);
            expect(session.run).toBeCalledWith('MATCH (a:NodeModule {name: $name}) RETURN a', {"name": "foo"});
        });

        test('returns record if found', async () => {
            session.run = jest.fn().mockResolvedValueOnce({ records: [{ name: 'foo' }] });
            expect(await neo4jClient.getNodeModule('foo')).toMatchObject({ name: 'foo' });
            expect(session.run).toBeCalledWith('MATCH (a:NodeModule {name: $name}) RETURN a', {"name": "foo"});
        });
    });

    describe('getGitRepo', () => {
        test('returns null if no record is found', async () => {
            session.run = jest.fn().mockResolvedValueOnce({ records: [] });
            expect(await neo4jClient.getGitRepo('foo')).toBe(null);
            expect(session.run).toBeCalledWith('MATCH (a:GitRepo {full_name: $full_name}) RETURN a', {"full_name": "foo"});
        });

        test('returns record if found', async () => {
            session.run = jest.fn().mockResolvedValueOnce({ records: [{ name: 'foo' }] });
            expect(await neo4jClient.getGitRepo('foo')).toMatchObject({ name: 'foo' });
            expect(session.run).toBeCalledWith('MATCH (a:GitRepo {full_name: $full_name}) RETURN a', {"full_name": "foo"});
        });
    });

    describe('getGitUser', () => {
        test('returns null if no record is found', async () => {
            session.run = jest.fn().mockResolvedValueOnce({ records: [] });
            expect(await neo4jClient.getGitUser('foo')).toBe(null);
            expect(session.run).toBeCalledWith('MATCH (a:GitUser {username: $username}) RETURN a', {"username": "foo"});
        });

        test('returns record if found', async () => {
            session.run = jest.fn().mockResolvedValueOnce({ records: [{ name: 'foo' }] });
            expect(await neo4jClient.getGitUser('foo')).toMatchObject({ name: 'foo' });
            expect(session.run).toBeCalledWith('MATCH (a:GitUser {username: $username}) RETURN a', {"username": "foo"});
        });
    });

    describe('saveGitRepo', () => {
        const gitHubJson = {
            name: 'foo',
            full_name: 'bar/foo',
            owner: {
                login: 'bar',
                html_url: 'http://localhost/bar/foo',
            },
            size: 123,
            stargazers_count: 900,
            watchers_count: 800,
            forks_count: 700,
            open_issues_count: 600,
            created_at: '2019-01-01T00:01:01',
            updated_at: '2019-10-09T04:24:14',
            pushed_at: '2019-10-08T12:12:12',
        };
        const expectedGitRepoDataSaved = {
            name: gitHubJson.name,
            full_name: gitHubJson.full_name,
            ownerUsername: gitHubJson.owner.login,
            size: gitHubJson.size,
            stargazers_count: gitHubJson.stargazers_count,
            watchers_count: gitHubJson.watchers_count,
            forks_count: gitHubJson.forks_count,
            open_issues_count: gitHubJson.open_issues_count,
            created_at: gitHubJson.created_at,
            updated_at: gitHubJson.updated_at,
            pushed_at: gitHubJson.pushed_at,
        }

        test('saves records for all node modules in a package.json', async () => {
            session.run = jest.fn().mockResolvedValue({ records: [] });
            await neo4jClient.saveGitRepoAndUser(gitHubJson);
            expect(session.run.mock.calls.length).toBe(4);

            expect(session.run.mock.calls[0]).toEqual([
                'CREATE (_bar_foo:GitRepo {name: $name,full_name: $full_name,ownerUsername: $ownerUsername,size: $size,stargazers_count: $stargazers_count,watchers_count: $watchers_count,forks_count: $forks_count,open_issues_count: $open_issues_count,created_at: $created_at,updated_at: $updated_at,pushed_at: $pushed_at}) RETURN _bar_foo',
                expectedGitRepoDataSaved,
            ]);
            expect(session.run.mock.calls[1]).toEqual([
                'MATCH (a:GitUser {username: $username}) RETURN a',
                {
                    username: gitHubJson.owner.login,
                },
            ]);
            expect(session.run.mock.calls[2]).toEqual([
                'CREATE (_bar:GitUser {htmlUrl: $htmlUrl,username: $username})',
                {
                    htmlUrl: gitHubJson.owner.html_url,
                    username: gitHubJson.owner.login,
                },
            ]);
            expect(session.run.mock.calls[3]).toEqual([
                `MATCH (a:GitUser {username:\'bar\'}), (b:GitRepo {full_name:\'bar/foo\'})\nCREATE (a)-[:OWNS {created_at:\'2019-01-01T00:01:01\'}]->(b)`,
            ]);
        });

        test('does not save GitUser if record already exists', async () => {
            session.run = jest.fn()
                .mockResolvedValueOnce({ records: [] })
                .mockResolvedValueOnce({
                    records: [{
                        htmlUrl: gitHubJson.owner.html_url,
                        username: gitHubJson.owner.login,
                    }],
                })
                .mockResolvedValueOnce({ records: [] });

            const result = await neo4jClient.saveGitRepoAndUser(gitHubJson);

            expect(result).toBeUndefined();
            expect(session.run.mock.calls.length).toBe(3);
            expect(session.run.mock.calls[0]).toEqual([
                'CREATE (_bar_foo:GitRepo {name: $name,full_name: $full_name,ownerUsername: $ownerUsername,size: $size,stargazers_count: $stargazers_count,watchers_count: $watchers_count,forks_count: $forks_count,open_issues_count: $open_issues_count,created_at: $created_at,updated_at: $updated_at,pushed_at: $pushed_at}) RETURN _bar_foo',
                expectedGitRepoDataSaved,
            ]);
            expect(session.run.mock.calls[1]).toEqual([
                'MATCH (a:GitUser {username: $username}) RETURN a',
                {
                    username: gitHubJson.owner.login,
                },
            ]);
            expect(session.run.mock.calls[2]).toEqual([
                `MATCH (a:GitUser {username:\'bar\'}), (b:GitRepo {full_name:\'bar/foo\'})\nCREATE (a)-[:OWNS {created_at:\'2019-01-01T00:01:01\'}]->(b)`,
            ]);
        });
    });
});
