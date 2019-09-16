import * as request from 'request';
import { Response, RequestAPI, Request, CoreOptions, RequiredUriUrl } from 'request';
import dotenv from 'dotenv';

dotenv.config();

export class GithubApiClient {
    private _request: RequestAPI<Request, CoreOptions, RequiredUriUrl>;

    constructor(
        private readonly githubBaseUrl: string = process.env.GITHUB_API_BASE_URL,
        private readonly githubClientId: string = process.env.GITHUB_CLIENT_ID,
        private readonly githubClientSecret: string = process.env.GITHUB_CLIENT_SECRET,
        private readonly githubUsername: string = process.env.GITHUB_USERNAME,
        private readonly timeout: number = 10000,
    ) {
        this._request = request.defaults({
            baseUrl: this.githubBaseUrl,
            timeout: this.timeout,
            json: true,
            qs: {
                per_page: 100, // 100 results per API call is the max
                sort: 'forks',
                order: 'asc',
                client_id: this.githubClientId,
                client_secret: this.githubClientSecret,
            },
            qsStringifyOptions: {
                format : 'RFC1738',
            },
            headers: {
                accept: 'application/json',
                host: 'api.github.com',
                'user-agent': this.githubUsername,
                'cache-control': 'no-cache',
                'accept-encoding': 'application/json',
            },
        });
    }

    public searchRepos(page: number = 1, lastPushed: string = '>=2019-01-01', forks: string = '>=100'): Promise<any> {
        return this.getRequest('/search/repositories', {
            q: `language:javascript forks:${forks} pushed:${lastPushed}`,
            page,
        });
    }

    public async getRepo(username: string, repo: string): Promise<any> {
        const response = await this.getRequest(`/repos/${username}/${repo}`);
        return response.body;
    }

    private getRequest(url: string, qs: any = {}): Promise<any> {
        // url += `&client_id=${this.githubClientId}&client_secret=${this.githubClientSecret}`;
        return new Promise((resolve, reject): void => {
            this._request.get(url, {qs}, (error: Error, response: Response, body: any) => {
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
