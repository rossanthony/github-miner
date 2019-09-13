import { Neo4jClient } from '../src/Neo4jClient';

describe('Neo4jClient', () => {
    const driver: any = {};
    let session: any = {};
    let shellExec: any = {};
    let neo4jClient: Neo4jClient;

    beforeEach(() => {
        neo4jClient = new Neo4jClient(driver, session);
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
            expect(session.run).toBeCalledWith('MATCH (a:GitRepo {name: $name}) RETURN a', {"name": "foo"});
        });

        test('returns record if found', async () => {
            session.run = jest.fn().mockResolvedValueOnce({ records: [{ name: 'foo' }] });
            expect(await neo4jClient.getGitRepo('foo')).toMatchObject({ name: 'foo' });
            expect(session.run).toBeCalledWith('MATCH (a:GitRepo {name: $name}) RETURN a', {"name": "foo"});
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
            ownerUsername: gitHubJson.owner.login,
            size: gitHubJson.size,
            stargazers: gitHubJson.stargazers_count,
            watchers: gitHubJson.watchers_count,
            forks: gitHubJson.forks_count,
            openIssues: gitHubJson.open_issues_count,
            createdAt: gitHubJson.created_at,
            updatedAt: gitHubJson.updated_at,
            pushedAt: gitHubJson.pushed_at,
        }

        test('saves records for all node modules in a package.json', async () => {
            session.run = jest.fn().mockResolvedValue({ records: [] });

            const result = await neo4jClient.saveGitRepoAndUser(gitHubJson);

            expect(result).toBeUndefined();
            expect(session.run.mock.calls.length).toBe(4);

            expect(session.run.mock.calls[0]).toEqual([
                'CREATE (_foo:GitRepo {name: $name,ownerUsername: $ownerUsername,size: $size,stargazers: $stargazers,watchers: $watchers,forks: $forks,openIssues: $openIssues,createdAt: $createdAt,updatedAt: $updatedAt,pushedAt: $pushedAt}) RETURN _foo',
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
                `MATCH (a:GitUser {username:'bar'}), (b:GitRepo {name:'foo'})\nCREATE (a)-[:OWNS]->(b)`,
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
                'CREATE (_foo:GitRepo {name: $name,ownerUsername: $ownerUsername,size: $size,stargazers: $stargazers,watchers: $watchers,forks: $forks,openIssues: $openIssues,createdAt: $createdAt,updatedAt: $updatedAt,pushedAt: $pushedAt}) RETURN _foo',
                expectedGitRepoDataSaved,
            ]);
            expect(session.run.mock.calls[1]).toEqual([
                'MATCH (a:GitUser {username: $username}) RETURN a',
                {
                    username: gitHubJson.owner.login,
                },
            ]);
            expect(session.run.mock.calls[2]).toEqual([
                `MATCH (a:GitUser {username:'bar'}), (b:GitRepo {name:'foo'})\nCREATE (a)-[:OWNS]->(b)`,
            ]);
        });
    });

    describe('saveNodeModules for github repo NOT found on npm', () => {
        beforeEach(() => {
            shellExec = jest.fn().mockReturnValueOnce(
                '{"error": {"code": "E404", "summary": "\'foo-bar-abc\' is not in the npm registry."}}',
            );
            neo4jClient = new Neo4jClient(driver, session, shellExec);
        });
        test('saves records for all node modules in a package.json', async () => {
            const packageJson = {
                dependencies: {
                    'foo-bar': '1.0.0',
                },
            };
            session.run = jest.fn().mockResolvedValue({ records: [] });
            const result = await neo4jClient.saveNodeModules(
                'testing-123',
                packageJson,
            );
            expect(result).toBeUndefined();
            expect(session.run.mock.calls.length).toBe(3);

            expect(session.run.mock.calls.pop()).toEqual([
                'MATCH (a:GitRepo {name:\'testing-123\'}), (b:NodeModule {name:\'foo-bar\'})\nCREATE (a)-[:DEPENDS_ON {version:\'1.0.0\'}]->(b)',
            ]);
            expect(session.run.mock.calls.pop()).toEqual([
                'CREATE (_foo_bar:NodeModule {name: \'foo-bar\'})',
            ]);
            expect(session.run.mock.calls.pop()).toEqual([
                'MATCH (a:NodeModule {name: $name}) RETURN a',
                { name: 'foo-bar' },
            ]);
        });
    });

    describe('saveNodeModules for github repo which is found on npm and not yet saved to neo4j', () => {
        beforeEach(() => {
            shellExec = jest.fn().mockReturnValueOnce(
                '{"_id": "foo-bar@0.0.1", "name": "foo-bar"}',
            );
            neo4jClient = new Neo4jClient(driver, session);
        });
        test('saves records for all node modules in a package.json', async () => {
            const packageJson = {
                dependencies: {
                    'another-package': '2.5.1',
                },
            };
            session.run = jest.fn().mockResolvedValue({ records: [] });
            const result = await neo4jClient.saveNodeModules(
                'foo-bar',
                packageJson,
            );
            expect(result).toBeUndefined();
            expect(session.run.mock.calls.length).toBe(5);

            expect(session.run.mock.calls[0]).toEqual([
                'MATCH (a:NodeModule {name: $name}) RETURN a',
                { name: 'foo-bar' },
            ]);
            expect(session.run.mock.calls[1]).toEqual([
                'CREATE (_foo_bar:NodeModule {name: \'foo-bar\'})',
            ]);
            expect(session.run.mock.calls[2]).toEqual([
                'MATCH (a:NodeModule {name: $name}) RETURN a',
                { name: 'another-package' }
            ]);
            expect(session.run.mock.calls[3]).toEqual([
                'CREATE (_another_package:NodeModule {name: \'another-package\'})',
            ]);
            expect(session.run.mock.calls[4]).toEqual([
                'MATCH (a:GitRepo {name:\'foo-bar\'}), (b:NodeModule {name:\'another-package\'})\nCREATE (a)-[:DEPENDS_ON {version:\'2.5.1\'}]->(b)',
            ]);
        });
    });

    describe('saveNodeModules does not save module if record already exists', () => {
        beforeEach(() => {
            shellExec = jest.fn().mockReturnValueOnce(
                '{"_id": "foo-bar@0.0.1", "name": "foo-bar"}',
            );
            neo4jClient = new Neo4jClient(driver, session);
        });
        test('saves records for all node modules in a package.json', async () => {
            const packageJson = {
                dependencies: {
                    'another-package': '2.5.1',
                },
            };
            session.run = jest.fn()
                .mockResolvedValueOnce({ records: [{ name: 'foo-bar' }] })
                .mockResolvedValue({ records: [] });

            const result = await neo4jClient.saveNodeModules(
                'foo-bar',
                packageJson,
            );
            expect(result).toBeUndefined();
            expect(session.run.mock.calls.length).toBe(4);

            expect(session.run.mock.calls[0]).toEqual([
                'MATCH (a:NodeModule {name: $name}) RETURN a',
                { name: 'foo-bar' },
            ]);
            expect(session.run.mock.calls[1]).toEqual([
                'MATCH (a:NodeModule {name: $name}) RETURN a',
                { name: 'another-package' }
            ]);
            expect(session.run.mock.calls[2]).toEqual([
                'CREATE (_another_package:NodeModule {name: \'another-package\'})',
            ]);
            expect(session.run.mock.calls[3]).toEqual([
                'MATCH (a:GitRepo {name:\'foo-bar\'}), (b:NodeModule {name:\'another-package\'})\nCREATE (a)-[:DEPENDS_ON {version:\'2.5.1\'}]->(b)',
            ]);
        });
    });

    describe('saveNodeModules for github repo, gracefully handle npm cli error', () => {
        beforeEach(() => {
            shellExec = jest.fn().mockReturnValueOnce('<!-- malforned json -->');
            neo4jClient = new Neo4jClient(driver, session, shellExec);
        });
        test('saves records for all node modules in a package.json', async () => {
            const packageJson = {
                dependencies: {
                    'foo-bar': '1.0.0',
                },
            };
            session.run = jest.fn().mockResolvedValue({ records: [] });
            const result = await neo4jClient.saveNodeModules(
                'testing-123',
                packageJson,
            );
            expect(result).toBeUndefined();
            expect(session.run.mock.calls.length).toBe(3);

            expect(session.run.mock.calls.pop()).toEqual([
                'MATCH (a:GitRepo {name:\'testing-123\'}), (b:NodeModule {name:\'foo-bar\'})\nCREATE (a)-[:DEPENDS_ON {version:\'1.0.0\'}]->(b)',
            ]);
            expect(session.run.mock.calls.pop()).toEqual([
                'CREATE (_foo_bar:NodeModule {name: \'foo-bar\'})',
            ]);
            expect(session.run.mock.calls.pop()).toEqual([
                'MATCH (a:NodeModule {name: $name}) RETURN a',
                { name: 'foo-bar' },
            ]);
        });
    });
});
