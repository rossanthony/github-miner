import redis, { RedisClient } from 'redis';
import { RedisService } from '../src/RedisService';
import { Neo4jClient } from '../src/Neo4jClient';
import { InsertDataHelper } from '../src/InsertDataHelper';
import { v1 as neo4j } from 'neo4j-driver';
import fs from 'fs-extra';
import * as packageJsonExample from '../examples/example-package.json'
import * as packageJsonParsedExample from '../examples/example-parsed-package.json'

jest.mock('fs-extra');
// jest.mock('../src/Neo4jClient');
global.console = {
    log: jest.fn()
};

describe('InsertDataHelper', () => {
    let insertDataHelper: InsertDataHelper;
    let mockOra = { text: '' };
    let mockRedisService = RedisService.prototype;
    let mockNeo4jClient = Neo4jClient.prototype;
    let mockNeo4jDriver = neo4j.prototype;

    beforeEach(() => {
        insertDataHelper = new InsertDataHelper(mockOra, mockRedisService, mockNeo4jClient);
        mockNeo4jClient.close = jest.fn().mockReturnValue(null);
    });

    describe('insertData method', () => {
        test('reads files in ./data/repos and skips if repo exists in cache', async () => {
            mockRedisService.sismember = jest.fn().mockResolvedValueOnce(true);
            fs.readdirSync
                .mockReturnValueOnce(['foo']])
                .mockReturnValueOnce(['bar']]);
            const res = await insertDataHelper.insertData();
            expect(console.log).toBeCalledWith(`foo/bar exists is cache, skipping...`);
            expect(res).toBe(undefined);
        });

        test('reads files in ./data/repos and calls ', async () => {
            mockRedisService.sismember = jest.fn().mockResolvedValueOnce(false);
            fs.readdirSync
                .mockReturnValueOnce(['foo']])
                .mockReturnValue(['bar']]);
            fs.readFile
                .mockResolvedValueOnce('{"full_name": "foo/bar"}')
                .mockResolvedValue(JSON.stringify(packageJsonExample.default));

            mockNeo4jClient.getGitRepo = jest.fn().mockResolvedValueOnce(null);
            mockNeo4jClient.saveGitRepoAndUser = jest.fn().mockResolvedValueOnce(null);
            mockNeo4jClient.saveNodeModulesUsedByGitRepo = jest.fn().mockResolvedValueOnce(null);

            const res = await insertDataHelper.insertData();
            expect(mockNeo4jClient.saveGitRepoAndUser).toHaveBeenCalledWith(
                { full_name: 'foo/bar' },
            );
            expect(mockNeo4jClient.saveNodeModulesUsedByGitRepo).toHaveBeenCalledWith(
                'foo/bar',
                packageJsonParsedExample.default,
            );
            expect(res).toBe(undefined);
        });
    });
});
