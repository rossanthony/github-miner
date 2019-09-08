import { GithubApiClient } from '../src/GithubApiClient';
import * as request from 'request';
import { Request, Response, RequestAPI, CoreOptions, UriOptions } from 'request';
import nock from 'nock';

describe('GithubApiClient public methods', () => {
    const githubBaseUrl = 'https://api.github.com';
    const githubToken = 'TOKEN';
    const githubUsername = 'Username';
    const timeout = 100;
    const codeSearchUri = '/search/code?q=dependencies+filename:package.json+path:/&per_page=100&page=';
    const repoSearchUri = '/search/repositories?per_page=100&sort=forks&order=asc&q=language:javascript+forks:>=50+pushed:';
    let githubApiClient: GithubApiClient;

    beforeEach(() => {
        githubApiClient = new GithubApiClient(
            githubBaseUrl,
            githubToken,
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
            .get(repoSearchUri + '>=2019-01-01&page=1')
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
        const pushed = '>=2019-01-01';
        nock(githubBaseUrl)
            .get(repoSearchUri + `${pushed}&page=${page}`)
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

    test('searchCode inserts page 1 into query string by default', async () => {
        nock(githubBaseUrl)
            .get(codeSearchUri + '1')
            .reply(200, JSON.stringify({ foo: 'bar' }), { 'content-type': 'application/json', });

        const result = await githubApiClient.searchCode();

        expect(result).toMatchObject({
            body: { foo: 'bar' },
            headers: {
                'content-type': 'application/json',
            },
            status: 200,
        });
    });

    test('searchCode passes page param into the query string of the URI', async () => {
        const page = 99;
        nock(githubBaseUrl)
            .get(codeSearchUri + page)
            .reply(200, JSON.stringify({ foo: 'bar' }), { 'content-type': 'application/json', });

        const result = await githubApiClient.searchCode(page);

        expect(result).toMatchObject({
            body: { foo: 'bar' },
            headers: {
                'content-type': 'application/json',
            },
            status: 200,
        });
    });

    test('searchCode resolves when github returns a 403 (indicating rate limit is reached)', async () => {
        nock(githubBaseUrl)
            .get(codeSearchUri + '1')
            .reply(403);

        const result = await githubApiClient.searchCode();

        expect(result).toMatchObject({
            headers: {},
            status: 403,
        });
    });

    test('searchCode rejects if github returns an unexpected status code', async () => {
        nock(githubBaseUrl)
            .get(codeSearchUri + '1')
            .reply(502);

        try {
            await githubApiClient.searchCode();
            throw Error('expected searchCode to reject');
        } catch (error) {
            expect(error).toMatchObject(
                new Error(`Invalid status code: 502, url: ${codeSearchUri}1`),
            );    
        }
    });

    test('searchCode rejects if github returns no body', async () => {
        nock(githubBaseUrl)
            .get(codeSearchUri + '1')
            .reply(200, undefined);

        try {
            await githubApiClient.searchCode();
            throw Error('expected searchCode to reject');
        } catch (error) {
            expect(error).toMatchObject(
                new Error(`Response body from github API is empty!`),
            );    
        }
    });

    test('searchCode rejects if there is some other error with the request such as timeout', async () => {
        nock(githubBaseUrl)
            .get(codeSearchUri + '1')
            .delay(timeout * 20)
            .reply(200, undefined);

        try {
            await githubApiClient.searchCode();
            throw Error('expected searchCode to reject with ESOCKETTIMEDOUT');
        } catch (error) {
            expect(error).toMatchObject(
                new Error('ESOCKETTIMEDOUT'),
            );    
        }
    });
});
