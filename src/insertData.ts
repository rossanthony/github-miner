import { InsertDataHelper } from './InsertDataHelper';
import ora = require('ora');
import { RedisService } from './RedisService';
import redis from 'redis';
import { GithubApiClient } from './GithubApiClient';
import { GitHubMinerHelper } from './GitHubMinerHelper';

const spinner = ora('Initialising...').start();

const insertDataHelper = new InsertDataHelper(spinner);

let username = '';
if (process.argv.length > 2) {
    username = process.argv[2];
}
let repo = '';
if (process.argv.length > 3) {
    repo = process.argv[3];
}

if (username && repo) {
    spinner.text = `Attempting to pull data from GitHub for ${username}/${repo}`;
    const redisService = new RedisService(
        redis.createClient({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: +process.env.REDIS_PORT || 6379,
        }),
    );
    const gitHubMinerHelper = new GitHubMinerHelper(
        new GithubApiClient(),
        redisService,
    );
    gitHubMinerHelper.fetchPackageJsonFromGit(`${username}/${repo}`)
        .then(async () => {
            await gitHubMinerHelper.fetchGithubDataForRepo(username, repo);

            insertDataHelper.insertDataForRepo(username, repo)
                .catch((e) => console.log('Error caught', e))
                .finally(() => {
                    spinner.text = 'Done.';
                    process.exit(0);
                });
        });

} else {
    insertDataHelper.insertData()
        .catch((e) => console.log('Error caught', e))
        .finally(() => {
            spinner.text = 'Done.';
            process.exit(0);
        });
}
