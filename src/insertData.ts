import { InsertDataHelper } from './InsertDataHelper';
import ora = require('ora');
import { RedisService } from './RedisService';
import redis from 'redis';
import { GithubApiClient } from './GithubApiClient';
import { GitHubMinerHelper } from './GitHubMinerHelper';

const spinner = ora('Initialising...').start();
const insertDataHelper = new InsertDataHelper(spinner);

if (process.env.LOG_LEVEL !== 'verbose') {
    // disable verbose logs by default, unless expicitly enabled in .env
    console.log = (): null => null;
}

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

            await insertDataHelper.insertDataForRepo(username, repo)
                .catch((e: Error) => console.log('Error caught', e))
                .finally(() => {
                    process.stdout.write('Done.\n\n'
                        + `Try opening http://localhost:7474 and running the following cypher query:\n\n`
                        + `MATCH (repo:GitRepo {\n`
                        + `   full_name:'${username}/${repo}'}\n`
                        + `)-[:DEPENDS_ON*]->(n)\n`
                        + `RETURN repo, n\n\n`);
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
