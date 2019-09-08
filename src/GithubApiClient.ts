import * as request from 'request';
import { Response, RequestAPI, Request, CoreOptions, RequiredUriUrl } from 'request';
import dotenv from 'dotenv';

dotenv.config();

export class GithubApiClient {
    private _request: RequestAPI<Request, CoreOptions, RequiredUriUrl>;

    constructor(
        private readonly githubBaseUrl: string = process.env.GITHUB_API_BASE_URL,
        private readonly githubToken: string = process.env.GITHUB_TOKEN,
        private readonly githubUsername: string = process.env.GITHUB_USERNAME,
        private readonly timeout: number = 10000,
    ) {
        this._request = request.defaults({
            baseUrl: this.githubBaseUrl,
            timeout: this.timeout,
            json: true,
            headers: {
                accept: 'application/json',
                host: 'api.github.com',
                authorization: this.githubToken,
                'user-agent': this.githubUsername,
                'cache-control': 'no-cache',
                'accept-encoding': 'application/json',
            }
        });
    }

    public searchCode(page: number = 1): Promise<any> {
        const url = '/search/code?'
            + 'q=dependencies+filename:package.json+path:/'
            + '&per_page=100'
            + '&page=' + page
            
        return this.getRequest(url);
    }

    public searchRepos(page: number = 1, lastPushed: string = '>=2019-01-01'): Promise<any> {
        const url = '/search/repositories?'
            + 'per_page=100'
            + '&sort=forks'
            + '&order=asc'
            + '&q=language:javascript+forks:>=50+pushed:' + lastPushed
            + '&page=' + page;

        return this.getRequest(url);
    }

    private getRequest(url: string): Promise<any> {
        return new Promise((resolve, reject): void => {
            this._request.get(url, (error: Error, response: Response, body: any) => {
                if (error) {
                    return reject(error);
                }
                if (response.statusCode === 403) {
                    return resolve({
                        headers: response.headers,
                        status: response.statusCode,
                    });
                }
                if (response.statusCode !== 200) {
                    console.log('Unexpected status code from github API', {
                        headers: response.headers,
                        status: response.statusCode,
                        url,
                        body,
                    });
                    return reject(new Error(`Invalid status code: ${response.statusCode}, url: ${url}`));
                }
                if (!body) {
                    return reject(new Error(`Response body from github API is empty!`));
                }
                return resolve({
                    body,
                    headers: response.headers,
                    status: response.statusCode,
                });
            });
        });
    }
}
