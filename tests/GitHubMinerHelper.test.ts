import { RedisClient } from 'redis';
import { RedisService } from '../src/RedisService';
import { GithubApiClient } from '../src/GithubApiClient';
import { GitHubMinerHelper } from '../src/GitHubMinerHelper';
import * as request from 'request';
import fs from 'fs-extra';

jest.mock('fs-extra');
jest.mock('request');
global.console = {
    log: jest.fn()
};

describe('GitHubMinerHelper', () => {
    let gitHubMinerHelper: GitHubMinerHelper;
    const mockGithubApiClient = GithubApiClient.prototype;
    const mockRedisClient = RedisClient.prototype;

    beforeEach(() => {
        gitHubMinerHelper = new GitHubMinerHelper(
            mockGithubApiClient,
            mockRedisClient,
        );
        fs.outputFile.mockResolvedValue(null);
        mockRedisClient.sismember = jest.fn().mockResolvedValue(null);
    });

    describe('fetchGithubDataForRepo method', () => {
        test('saves github.json file if repo exists on github', async () => {
            mockGithubApiClient.getRepo = jest.fn().mockResolvedValueOnce('{"full_name":"foo/bar"}');
            const res = await gitHubMinerHelper.fetchGithubDataForRepo('foo', 'bar');
            expect(res).toBe(true);
        });

        test('returns false if repo does NOT exists on github', async () => {
            mockGithubApiClient.getRepo = jest.fn().mockRejectedValue(new Error('Boom!'));
            const res = await gitHubMinerHelper.fetchGithubDataForRepo('foo', 'bar');
            expect(res).toBe(false);
            expect(console.log).toBeCalled();
        });
    });

    describe('fetchPackageJsonFromGit method', () => {
        test('returns true and saves package.json file if one exists in the github repo', async () => {
            request.get.mockImplementation((url, config, cb) => {
                cb(null, { statusCode: 200 }, '{"name":"foo", "dependencies": { "bar": "1.0.1" }}');
            });
            mockRedisClient.sadd = jest.fn().mockResolvedValue(1);
            const res = await gitHubMinerHelper.fetchPackageJsonFromGit('foo/bar');
            expect(res).toBe(true);
        });

        test('returns false if there are no dependencies', async () => {
            request.get.mockImplementation((url, config, cb) => {
                cb(null, { statusCode: 200 }, '{"name":"foo", "dependencies": { }}');
            });
            mockRedisClient.sadd = jest.fn().mockResolvedValue(1);
            const res = await gitHubMinerHelper.fetchPackageJsonFromGit('foo/bar');
            expect(res).toBe(false);
        });

        test('returns false if repo does NOT contain a package.json file', async () => {
            request.get.mockImplementation((url, config, cb) => {
                cb(null, { statusCode: 404 });
            });
            const res = await gitHubMinerHelper.fetchPackageJsonFromGit('foo/bar');
            expect(res).toBe(false);
        });

        test('returns false if body is empty', async () => {
            request.get.mockImplementation((url, config, cb) => {
                cb(null, { statusCode: 200 }, null);
            });
            const res = await gitHubMinerHelper.fetchPackageJsonFromGit('foo/bar');
            expect(res).toBe(false);
        });

        test('logs error and returns false if request throws', async () => {
            const expectedError = new Error('Boom');
            request.get.mockImplementation((url, config, cb) => {
                cb(expectedError);
            });
            const res = await gitHubMinerHelper.fetchPackageJsonFromGit('foo/bar');
            expect(res).toBe(false);
            expect(console.log).toBeCalledWith(`error for foo/bar`, expectedError);
        });

        test('logs error and returns false if writing file to disk fails', async () => {
            request.get.mockImplementation((url, config, cb) => {
                cb(null, { statusCode: 200 }, '{"name":"foo", "dependencies": { "bar": "1.0.1" }}');
            });
            const expectedError = new Error('disk full!');
            fs.outputFile.mockRejectedValue(expectedError);
            const res = await gitHubMinerHelper.fetchPackageJsonFromGit('foo/bar');
            expect(res).toBe(false);
            expect(console.log).toBeCalledWith(`Writing file for foo/bar failed`, expectedError);
        });
    });

    describe('mineGithubForPackageJsons method', () => {
        test('returns result immediately if a 403 is encountered from github api', async () => {
            mockGithubApiClient.searchRepos = jest.fn().mockResolvedValueOnce({
                body: ''
                headers: { 'x-ratelimit-remaining': 0 },
                status: 403,
            });
            const res = await gitHubMinerHelper.mineGithubForPackageJsons();
            expect(res.rateRemaining).toBe(0);
            expect(mockRedisClient.sismember).not.toHaveBeenCalled();
        });
    });
});
