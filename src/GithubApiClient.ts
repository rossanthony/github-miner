import * as request from 'request';
import { Response } from 'request';

export class GithubApiClient {
    constructor() {}

    public searchCode(page: number = 1): Promise<any> {
        const url = 'https://api.github.com/search/code'
            + '?per_page=100'
            + '&page=' + page
            + '&q=dependencies+filename:package.json+path:/';        

        return this.getRequest(url);
    }

    public searchRepos(page: number = 1, perPage: number = 100, lastPushed: string = '>=2019-01-01'): Promise<any> {
        const url = 'https://api.github.com/search/repositories'
            + '?q=language:javascript+forks:>=250+pushed:2018-01-01..2019-01-01' //+ lastPushed
            + '&sort=forks'
            + '&order=asc'
            + '&per_page=' + perPage
            + '&page=' + page;

        console.log('fetching from github api:', url);

        return this.getRequest(url);
    }

    private getRequest(url: string): Promise<any> {
        const headers = {
            accept: 'application/json',
            host: 'api.github.com',
            authorization: 'token f739a67b0fcfb52f72611772738a973c45ece1e5',
            'user-agent': 'rossanthony',
            'cache-control': 'no-cache',
            'accept-encoding': 'application/json',
        };
        const config = {
            headers,
            timeout: 10000,
            json: true,
        };

        return new Promise((resolve, reject): void => {
            request.get(url, config, (error: Error, response: Response, body: any) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (response.statusCode === 403) {
                    resolve({
                        headers: response.headers,
                        status: response.statusCode,
                    });
                    return;
                }
                if (response.statusCode !== 200) {
                    console.log('Error from github API', {
                        headers: response.headers,
                        status: response.statusCode,
                        url,
                        body,
                    })
                    reject(new Error(`Invalid status code: ${response.statusCode}, url: ${url}`));
                    return;
                }
                if (!body) {
                    reject(new Error(`Response body from github API is empty!`));
                    return;
                }
                resolve({
                    body,
                    headers: response.headers,
                    status: response.statusCode,
                });
            });
        });
    }
}
