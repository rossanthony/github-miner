import moment from 'moment';
import { cloneDeep, difference } from 'lodash';
import { Moment } from 'moment';
import ora from 'ora';
import { GitHubMinerHelper } from './GitHubMinerHelper';
import { GithubApiClient } from './GithubApiClient';
import { RedisService } from './RedisService';
import redis from 'redis';

const spinner = ora('Processing...').start();

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

const mineMaxPagesForDate = async (startPage: number, lastUpdated: string, forks: string = '>=100') => {
    const totalPages = 10; // max search results = 1000 (10 pages of 100)
    
    if (startPage > totalPages) {
        // console.log('Done!');
        return;
    }

    let pages = Array.from(Array(totalPages), (e, i) => i + 1);

    if (startPage) {
        pages = pages.splice(startPage - 1);
    }

    let res: any = {
        rateRemaining: '',
    };

    for (let page of pages) {
        const totalMined = await redisService.scard('github-repos');
        spinner.color = 'yellow';
        spinner.text = `Processing page ${page} of forks:${forks}, pushed:${lastUpdated} / Total repos mined: ${totalMined} / Rate-limit remaining: ${res.rateRemaining}`;
        res = await gitHubMinerHelper.mineGithubForPackageJsons(+page, lastUpdated, forks)
            .catch((e) => console.log('Error caught:', e));

        if (!res || res.results < 100 || res.totalCount <= 100) {
            break;
        }

        let timeout = 0;
        if (res && +res.rateRemaining === 0) {
            timeout = res.timeUntilReset;
            spinner.color = 'red';
            spinner.text = `Hit rate limit on page ${page} while querying for forks:${forks} / pushed:${lastUpdated}`;
            setTimeout(() => mineMaxPagesForDate(page, lastUpdated), timeout * 1000);
            break;
        }

        continue;
    }

    const totalMined = await redisService.scard('github-repos');
    spinner.text = `All pages processed for ${forks} / ${lastUpdated}. Total repos mined: ${totalMined} / ratelimit remaining: ${res.rateRemaining}`;
    return res;
};

let lastDateProcessed: string;
let timeout = 0;

const mineByLastUpdatedDates = async (lastUpdatedDates: string[], forks: string) => {
    spinner.text = `Starting forks:${forks} for a total of ${lastUpdatedDates.length} dates...`;

    for (let date of lastUpdatedDates) {
        lastDateProcessed = date;

        const res = await mineMaxPagesForDate(1, date, forks).catch((e) => console.log('Error caught::', e));
        console.log(`\n\nResults for forks:${forks} / pushed:${date}\n`, JSON.stringify(res, null, 2));

        if (res && +res.rateRemaining === 0) {
            timeout = res.timeUntilReset;
            spinner.color = 'red';
            spinner.text = `Hit rate limit while querying for forks:${forks} / pushed:${date}`;
            const datesRemaining = cloneDeep(lastUpdatedDates);
            setTimeout(() => {
                mineByLastUpdatedDates(
                    datesRemaining.splice(datesRemaining.indexOf(date)),
                    forks,
                )
            }, timeout * 1000);
            break;
        }

        // date complete, add to redis...
        await redisService.sadd('processed-date-ranges', date);
    }

    spinner.text = `Done forks:${forks} for a total of ${lastUpdatedDates.length} dates `;
};

const buildDates = async (
    daysBack: number,
    startFrom: number = 0,
    range: number = 0,
    forks: string = '>=100',
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
            // console.log('count before', count);
            count += range + 1;
            // count++;
            // console.log('count after', count);
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
        console.log({count, range});
    }

    await redisService.del('processed-date-ranges');
    const datesProcessed = await redisService.smembers('processed-date-ranges');
    console.log('dates >', dates);
    console.log('datesProcessed >', datesProcessed);

    return difference(dates, datesProcessed);
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

const mineReposBeforeDate = async (daysBack: number): Promise<void> => {
    const boundaryDate = '<=' + moment().subtract(daysBack, 'day').format('YYYY-MM-DD');
    const forkRanges = ['>300', '201..300', '151..200', '126..150', '111..125', '100..110'];
    for (const range of forkRanges) {
        await mineByLastUpdatedDates([boundaryDate], range);
    }
    return;
}

let forks = '>=100';
if (process.argv.length > 2) {
    forks = process.argv[2];
}

buildDates(daysBack, 0, 0, forks)
    .then(async (dates) => {
        console.log(dates);
        process.exit(1);
        totalDateRanges = dates.length;
        // await redisService.del('processed-date-ranges');
        // await mineReposBeforeDate(daysBack);
        // await mineByLastUpdatedDates(dates, forks);
    })
    .catch((error) => console.log('Error caught:', error))
    .finally(async () => await wait());
