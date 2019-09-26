import moment from 'moment';
import { cloneDeep } from 'lodash';
import { Moment } from 'moment';
import ora from 'ora';
import { GitHubMinerHelper } from './GitHubMinerHelper';
import { GithubApiClient } from './GithubApiClient';
import { RedisService } from './RedisService';
import redis from 'redis';

const spinner = ora('Processing...').start();

if (process.env.LOG_LEVEL !== 'verbose') {
    // disable verbose logs by default, unless expicitly enabled in .env
    console.log = (): null => null;
}

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

const mineMaxPagesForDate = async (
    startPage: number,
    lastUpdated: string,
    forks: string = '>=100',
    stars: string = '',
) => {
    const totalPages = 10; // max search results = 1000 (10 pages of 100)
    if (startPage > totalPages) {
        return;
    }
    let res: any = { rateRemaining: '' };
    let pages = Array.from(Array(totalPages), (e, i) => i + 1);

    if (startPage) {
        pages = pages.splice(startPage - 1);
    }
    const key = `forks:${forks}|pushed:${lastUpdated}|stars:${stars}`;

    for (let page of pages) {
        const totalMined = await redisService.scard('github-repos');
        spinner.color = 'yellow';
        spinner.text = `Processing page ${page} of ${key}.\nTotal repos mined: ${totalMined} / Rate-limit remaining: ${res.rateRemaining}`;
        res = await gitHubMinerHelper.mineGithubForPackageJsons(+page, lastUpdated, forks, stars)
            .catch((e) => console.log('Error caught:', e));

        if (!res || res.results < 100 || res.totalCount <= 100) {
            break;
        }

        let timeout = 0;
        if (res && +res.rateRemaining === 0) {
            timeout = res.timeUntilReset;
            spinner.color = 'red';
            spinner.text = `Hit rate limit on page ${page} while querying for ${key}`;
            setTimeout(() => mineMaxPagesForDate(page, lastUpdated, forks, stars), timeout * 1000);
            break;
        }

        continue;
    }

    const totalMined = await redisService.scard('github-repos');
    spinner.text = `All pages processed for ${key}.\nTotal repos mined: ${totalMined}, ratelimit remaining: ${res.rateRemaining}`;
    return res;
};

let timeout = 0;

const mineByLastUpdatedDates = async (lastUpdatedDates: string[], forks: string, stars: string = '') => {
    
    spinner.text = `Starting forks:${forks}|stars:${stars} for a total of ${lastUpdatedDates.length} dates...`;

    for (let date of lastUpdatedDates) {
        console.time(`forks:${forks}|pushed:${date}|stars:${stars}`);
        const key = `forks:${forks}|pushed:${date}|stars:${stars}`;
        if (await redisService.sismember('processed-date-ranges', key)) {
            console.log(`Already processed ${key}, skipping...`);
            continue;
        }
        const res = await mineMaxPagesForDate(1, date, forks, stars).catch((e) => console.log('Error caught::', e));
        console.log(`\n\nResults.........\n`, JSON.stringify({
            ...res,
            key,
            forks,
            stars,
            date,
        }, null, 2));

        if (res && +res.rateRemaining === 0) {
            timeout = res.timeUntilReset;
            spinner.color = 'red';
            spinner.text = `Hit rate limit while querying for ${key}`;
            const datesRemaining = cloneDeep(lastUpdatedDates);
            setTimeout(() => {
                mineByLastUpdatedDates(
                    datesRemaining.splice(datesRemaining.indexOf(date)),
                    forks,
                    stars,
                )
            }, timeout * 1000);
            break;
        }

        // date complete, add to redis...
        await redisService.sadd('processed-date-ranges', key);
        console.log('\n\n');
        console.timeLog(`forks:${forks}|pushed:${date}|stars:${stars}`, res);
        console.timeEnd(`forks:${forks}|pushed:${date}|stars:${stars}`);
    }

    spinner.text = `Done forks:${forks}|stars:${stars} for a total of ${lastUpdatedDates.length} dates `;
};

const buildDates = async (
    daysBack: number,
    startFrom: number = 0,
    range: number = 0,
): Promise<string[]> => {
    let dates = [];
    let count = startFrom;
    let startDate: Moment;
    let endDate: Moment;

    while (count <= daysBack) {
        if (range > 0) {
            startDate = moment().subtract(count + range, 'day');
            endDate = moment().subtract(count, 'day');
            dates.push(
                `${startDate.format('YYYY-MM-DD')}..${endDate.format('YYYY-MM-DD')}`,
            );
            count += range + 1;
        } else {
            dates.push(
                moment().subtract(count, 'day').format('YYYY-MM-DD'),
            );
            count++;
        }
        if (count > 2 && count < 5) {
            range = 1;
        } else if (count >= 5 && count < 10) {
            range = 2;
        } else if (count >= 10 && count < 20) {
            range = 3;
        } else if (count >= 20 && count < 30) {
            range = 5;
        } else if (count >= 30 && count < 50) {
            range = 8;
        } else if (count >= 50 && count < 75) {
            range = 13;
        } else if (count >= 75) {
            range = 21;
        }
    }
    return dates;
}

let totalDateRanges: number;
const daysBack = 365;

const wait = async () => {
    const datesProcessed = await redisService.scard('processed-date-ranges');

    if (datesProcessed >= totalDateRanges) {
        const totalMined = await redisService.scard('github-repos');
        spinner.stop();
        console.log(`\nDone!\nTotal repos mined: ${totalMined}`);
        process.exit(0);
    }
    if (timeout && timeout > 0) {
        spinner.text = `Waiting ${timeout}s until limit has been reset by GitHub's API...`;
        timeout--;
    }
    setTimeout(wait, 1000);
};

const mineReposBeforeDate = async (daysBack: number, forks: string, stars: string): Promise<void> => {
    const boundaryDate = '<=' + moment().subtract(daysBack, 'day').format('YYYY-MM-DD');
    if (stars) {
        const starRanges = [
            '>500', '351..500', '276..350', '241..275', '211..240', '191..210', '171..190',
            '171..190', '156..170', '141..155', '131..140', '121..130', '111..120', '105..110', '100..104'
        ];
        for (const stars of starRanges) {
            const key = `updated:${boundaryDate}|stars:${stars}`;
            if (await redisService.sismember('processed-date-ranges', key)) {
                console.log(`date/stars range already processed for [${key}], skipping...`)
                continue;
            }
            console.time(`updated:${boundaryDate}|forks:${forks}|stars:${stars}`);
            await mineByLastUpdatedDates([boundaryDate], forks, stars);
            console.log('\n\n');
            console.timeEnd(`updated:${boundaryDate}|forks:${forks}|stars:${stars}`);
            console.log(`date/stars range [${key}] done, adding to cache...`)
            await redisService.sadd('processed-date-ranges', key);
        }
        return;
    }
    if (forks) {
        const forkRanges = ['>300', '201..300', '151..200', '126..150', '111..125', '100..110'];
        for (const range of forkRanges) {
            const key = `updated:${boundaryDate}|forks:${range}`;
            if (await redisService.sismember('processed-date-ranges', key)) {
                console.log(`date/fork range already processed for [${key}], skipping...`)
                continue;
            }
            console.time(`updated:${boundaryDate}|forks:${range}`);
            await mineByLastUpdatedDates([boundaryDate], range);
            console.log('\n\n');
            console.timeEnd(`updated:${boundaryDate}|forks:${range}`);
            console.log(`date/fork range [${key}] done, adding to cache...`)
            await redisService.sadd('processed-date-ranges', key);
        }
    }
    return;
}

let forks = '>=100';
if (process.argv.length > 2) {
    forks = process.argv[2];
}
let stars = '';
if (process.argv.length > 3) {
    stars = process.argv[3];
}

buildDates(daysBack, 0, 0)
    .then(async (dates) => {
        console.log(dates);
        await mineReposBeforeDate(daysBack, forks, stars);
        await mineByLastUpdatedDates(dates, forks, stars);
    })
    .catch((error) => console.log('Error caught:', error))
    .finally(async () => await wait());
