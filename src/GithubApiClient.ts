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

    public searchRepos(page: number = 1): Promise<any> {
        const url = 'https://api.github.com/search/repositories'
            + '?q=language:javascript+forks:>=1+pushed:>2019-01-01'
            + '&sort=pushed'
            + '&order=desc'
            + '&per_page=100'
            + '&page=' + page;

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

        return new Promise((resolve, reject): void => {
            request.get(url, {timeout: 10000, headers}, (error: Error, response: Response, body: any) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Invalid status code: ${response.statusCode}, url: ${url}`));
                    return;
                }
                if (!body) {
                    reject(new Error(`Response body from github API is empty!`));
                    return;
                }
                try {
                    resolve(JSON.parse(body));    
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
}
