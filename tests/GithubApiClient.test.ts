import { GithubApiClient } from '../src/GithubApiClient';
import * as request from 'request';
import { Request, Response, RequestAPI, CoreOptions, UriOptions } from 'request';
import nock from 'nock';

describe('GithubApiClient public methods', () => {
    const githubBaseUrl = 'https://api.github.com';
    const githubClientId = 'CLIENT_ID';
    const githubClientSecret = 'CLIENT_TOKEN';
    const githubUsername = 'Username';
    const timeout = 100;
    const repoSearchUrlPrefix = '/search/repositories?per_page=100&sort=forks&order=asc&client_id=CLIENT_ID&client_secret=CLIENT_TOKEN&q=language%3Ajavascript+';
    let githubApiClient: GithubApiClient;

    beforeEach(() => {
        githubApiClient = new GithubApiClient(
            githubBaseUrl,
            githubClientId,
            githubClientSecret,
            githubUsername,
            timeout,
        );
        nock.cleanAll();
    });

    test('GithubApiClient can be newed up without passing any params', async () => {
        expect(new GithubApiClient()).toBeInstanceOf(GithubApiClient);
    });

    test('searchRepos uses "page=1" and "pushed:>=2019-01-01" as defaults', async () => {
        nock(githubBaseUrl)
            .get(repoSearchUrlPrefix + 'forks%3A%3E%3D100+pushed%3A%3E%3D2019-01-01&page=1')
            .reply(200, JSON.stringify({ foo: 'bar' }), { 'content-type': 'application/json', });

        const result = await githubApiClient.searchRepos();

        expect(result).toMatchObject({
            body: { foo: 'bar' },
            headers: {
                'content-type': 'application/json',
            },
            status: 200,
        });
    });

    test('searchRepos uses page and pushed date from params if passed', async () => {
        const page = 13;
        const pushed = '2019-01-01';
        nock(githubBaseUrl)
            .get(repoSearchUrlPrefix + `forks%3A%3E%3D100+pushed%3A${pushed}&page=${page}`)
            .reply(200, JSON.stringify({ foo: 'bar' }), { 'content-type': 'application/json', });

        const result = await githubApiClient.searchRepos(page, pushed);

        expect(result).toMatchObject({
            body: { foo: 'bar' },
            headers: {
                'content-type': 'application/json',
            },
            status: 200,
        });
    });

    test('searchRepos resolves when github returns a 403 (indicating rate limit is reached)', async () => {
        nock(githubBaseUrl)
            .get(repoSearchUrlPrefix + 'forks%3A%3E%3D100+pushed%3A%3E%3D2019-01-01&page=1')
            .reply(403);

        const result = await githubApiClient.searchRepos();

        expect(result).toMatchObject({
            headers: {},
            status: 403,
        });
    });

    test('searchRepos rejects if github returns an unexpected status code', async () => {
        nock(githubBaseUrl)
            .get(repoSearchUrlPrefix + 'forks%3A%3E%3D100+pushed%3A%3E%3D2019-01-01&page=1')
            .reply(502);

        try {
            await githubApiClient.searchRepos();
            throw Error('expected searchRepos to reject');
        } catch (error) {
            expect(error).toMatchObject(
                new Error('Invalid status code: 502, url: /search/repositories'),
            );    
        }
    });

    test('searchRepos rejects if github returns no body', async () => {
        nock(githubBaseUrl)
            .get(repoSearchUrlPrefix + 'forks%3A%3E%3D100+pushed%3A%3E%3D2019-01-01&page=1')
            .reply(200, undefined);

        try {
            await githubApiClient.searchRepos();
            throw Error('expected searchRepos to reject');
        } catch (error) {
            expect(error).toMatchObject(
                new Error(`Response body from github API is empty!`),
            );    
        }
    });

    test('searchRepos rejects if there is some other error with the request such as timeout', async () => {
        nock(githubBaseUrl)
            .get(repoSearchUrlPrefix + 'forks%3A%3E%3D100+pushed%3A%3E%3D2019-01-01&page=1')
            .delay(timeout * 20)
            .reply(200, undefined);

        try {
            await githubApiClient.searchRepos();
            throw Error('expected searchRepos to reject with ESOCKETTIMEDOUT');
        } catch (error) {
            expect(error).toMatchObject(
                new Error('ESOCKETTIMEDOUT'),
            );    
        }
    });
});
