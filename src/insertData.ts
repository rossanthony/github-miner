import { InsertDataHelper } from './InsertDataHelper';
import ora = require('ora');
import { RedisService } from './RedisService';
import redis from 'redis';
import { GithubApiClient } from './GithubApiClient';
import { GitHubMinerHelper } from './GitHubMinerHelper';
import { Neo4jClient } from './Neo4jClient';

const spinner = ora('Initialising...').start();
const redisService = new RedisService(
    redis.createClient({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: +process.env.REDIS_PORT || 6379,
    }),
);
const neo4jClient = new Neo4jClient(redisService);
const insertDataHelper = new InsertDataHelper(spinner, redisService, neo4jClient);

if (process.env.LOG_LEVEL !== 'verbose') {
    // disable verbose logs by default, unless expicitly enabled in .env
    console.log = (): null => null;
}

let username = '';
let repo = '';

if (process.argv.length > 2) {
    if (process.argv[2].includes('/')) {
        const parts = process.argv[2].split('/');
        username = parts[0];
        repo = parts[1];
    } else {
        username = process.argv[2];
    }
    if (process.argv.length > 3 && !repo) {
        repo = process.argv[3];
    }
}

if (username && repo) {
    spinner.text = `Attempting to pull data from GitHub for ${username}/${repo}`;
    const gitHubMinerHelper = new GitHubMinerHelper(
        new GithubApiClient(),
        new RedisService(),
    );
    gitHubMinerHelper.fetchPackageJsonFromGit(`${username}/${repo}`)
        .then(async () => {
            const repoRetrieved = await gitHubMinerHelper.fetchGithubDataForRepo(username, repo);
            if (!repoRetrieved) {
                process.stdout.write(`No repository found on github for ${username}/${repo}`);
                process.exit(1);
            }
            await insertDataHelper.insertDataForRepo(username, repo)
                .catch((error: Error) => process.stdout.write('Error: ' + error))
                .finally(() => {
                    process.stdout.write('Done.\n\n'
                        + `Try opening http://localhost:7474 and running the following cypher query:\n\n`
                        + `MATCH (repo:GitRepo {\n`
                        + `   full_name:'${username}/${repo}'}\n`
                        + `)-[:DEPENDS_ON|DEV_DEPENDS_ON*..2]->(n)\n`
                        + `RETURN repo, n\n\n`);
                    process.exit(0);
                });
        });
} else {
    insertDataHelper.insertData()
        .catch((error: Error) => process.stdout.write('Error: ' + error))
        .finally(() => {
            spinner.text = 'Done.';
            process.exit(0);
        });
}
