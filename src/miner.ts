import {v1 as neo4j} from 'neo4j-driver';
import { Driver, Session } from 'neo4j-driver/types/v1';
import { Neo4jClient } from './Neo4jClient';
import { GithubApiClient } from './GithubApiClient';
import * as request from 'request';
import { Response } from 'request';
import * as moment from 'moment';
import * as fs from 'fs-extra';
import { isEmpty, get, cloneDeep } from 'lodash';
import { Moment } from 'moment';
import * as ora from 'ora';

const driver: Driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'password')
);
const session: Session = driver.session();

const neo4jClient = new Neo4jClient(
    driver,
    session,
);
const githubApiClient = new GithubApiClient();

const mineGithubForPackageJsons = async (page: number = 1, lastPushed: string = '>=2019-01-01') => {
    const githubResults = await githubApiClient.searchRepos(page, 100, lastPushed);

    const rateReset = get(githubResults, 'headers.x-ratelimit-reset');
    const result = {
        totalCount: get(githubResults, 'body.total_count', null),
        results: get(githubResults, 'body.items.length', null),
        rateRemaining: get(githubResults, 'headers.x-ratelimit-remaining'),
        rateReset,
        timestampNow: moment().unix(),
        timeUntilReset: rateReset - moment().unix(),
    };

    if (githubResults.status === 403) {
        return result;
    }

    if (!githubResults.body) {
        console.error('githubResults', githubResults);
        throw Error('No results found!');
    }

    if (isEmpty(githubResults.body.items)) {
        throw Error('No items in body, status code: ' + githubResults.status);
    }

    if (githubResults.body.total_count > 1000) {
        console.log('\n\n***** OVER 1000 RESULTS RETURNED! *****\n\n')
    }

    console.log('githubResults > total >', githubResults.body.total_count);
    console.log('githubResults > items.length >', githubResults.body.items.length);
    
    const promises = githubResults.body.items.map(async (item: any) => {
        // console.log('forks >>>', item.forks_count);

        const filePath = `${__dirname}/../data/repos/${item.owner.login}/${item.name}`;
        const packageJsonFile = await fs.readFile(`${filePath}/package.json`, 'utf8').catch(() => null);
        const gitHubFile = await fs.readFile(`${filePath}/github.json`, 'utf8').catch(() => null);

        if (packageJsonFile && gitHubFile) {
            console.log('Files already exist in:', filePath);
            return;
        }

        const fileUrl = `https://raw.githubusercontent.com/${item.full_name}/master/package.json`;
        console.log('Fetching file:', fileUrl);

        return request.get(fileUrl, {}, async (error: Error, response: Response, body: any) => {
            // console.log(`Response headers from ${fileUrl}`, response.headers);
        
            if (error) {
                console.log(`error for ${item.full_name}`, error);
                return;
            }
            if (response.statusCode !== 200) {
                console.log('non-200 response for:', item.full_name, {status: response.statusCode});
                return;
            }
            if (!body) {
                console.log(`no body for ${item.full_name}`, error);
                return;
            }
            try {
                const json = JSON.parse(body);
                if (isEmpty(json.dependencies) && isEmpty(json.devDependencies)) {
                    console.log('No dependencies in package.json for', item.full_name);
                    return;
                }
                
                console.log('Writing files for:', item.full_name, 'to path:', filePath);
                await fs.outputFile(`${filePath}/package.json`, body);
                await fs.outputFile(`${filePath}/github.json`, JSON.stringify(item, null, 2));
            } catch (error) {
                console.log(`Writing file for ${item.full_name} failed`, error);
            }
        });
    });

    await Promise.all(promises);

    return result;

    // const record = await neo4jClient.saveRepository();
    // console.log('record', record);

    // on application exit:
    // driver.close();
};

const totalPages = 10;

const mineMaxPagesForDate = async (startPage: number, lastUpdated: string) => {
    
    if (startPage > totalPages) {
        console.log('Done!');
        return;
    }

    let pages = Array.from(Array(totalPages), (e, i) => i + 1);

    if (startPage) {
        pages = pages.splice(startPage - 1);
        console.log(`\nresuming from page ${startPage}`, pages, '\n');
    } else {
        console.log('\nstarting from page 1', pages, '\n');
    }

    let res: any = {
        rateRemaining: 30,
    };

    for (let page of pages) {
        console.log('Processing page:', page);
        res = await mineGithubForPackageJsons(+page, lastUpdated).catch((e) => console.log('Error caught:', e));

        console.log(`res for page ${page} of ${lastUpdated}`, res);
        
        if (!res || res.results < 100 || res.totalCount <= 100) {
            break;
        }

        let timeout = 0;
        if (res && +res.rateRemaining === 0) {
            timeout = res.timeUntilReset;
            console.log(`\nHit rate limit on page ${page} of ${lastUpdated}.\nWaiting ${timeout}s until ratelimit has been reset by GitHub's API...\n`);
            setTimeout(() => {
                mineMaxPagesForDate(page, lastUpdated);
            }, timeout * 1000);
            break;
        }

        console.log(`\nResult from page ${page}:\n`, res);
        continue;
    }

    console.log(`\nAll pages processed for ${lastUpdated}, last res:\n`, res);
    return res;
};

let lastDateProcessed;

const mineByLastUpdatedDates = async (lastUpdatedDates: string[]) => {
    for (let date of lastUpdatedDates) {
        lastDateProcessed = date;
        console.log('\n\n+++++++\nMining github for repos last updated:', date, '\n');
        const res = await mineMaxPagesForDate(1, date).catch((e) => console.log('Error caught::', e));

        console.log(`res for date ${date}`, res);

        
        let timeout = 0;
        if (res && +res.rateRemaining === 0) {
            timeout = res.timeUntilReset;
            console.log(`\nHit rate limit while querying for ${date}.\nWaiting ${timeout}s until ratelimit has been reset by GitHub's API...\n`);
            // console.log('will resume from...', lastUpdatedDates.splice(lastUpdatedDates.indexOf(date) + 1)[0]);

            const datesRemaining = cloneDeep(lastUpdatedDates);

            setTimeout(() => {
                mineByLastUpdatedDates(datesRemaining.splice(datesRemaining.indexOf(date) + 1))
            }, timeout * 1000);
            break;
        }
    }
};

const buildDates = (daysBack: number, startFrom: number = 1): string[] => {
    let dates = [];
    let count = startFrom;
    let startDate: Moment;
    let endDate: Moment;

    while (count <= daysBack) {
        startDate = moment().subtract('day', count + 1);
        endDate = moment().subtract('day', count);
        dates.push(
            `${startDate.format('YYYY-MM-DD')}..${endDate.format('YYYY-MM-DD')}`,
        );
        count++;
    }

    return dates;
}

// const dates = buildDates(50, 1);
const dates = buildDates(250, 1);
// const dates = buildDates(150, 101);
// const dates = buildDates(200, 151);
// const dates = buildDates(250, 201);

console.log(dates);
// console.log(dates.length);
// console.log(dates.splice(dates.indexOf('2019-06-02..2019-06-03')));

const spinner = ora('Processing...').start();

function wait () {
    spinner.color = 'yellow';
    spinner.text = `Processing...`;
    // console.log('wait:', {
    //     lastDateProcessed,
    //     indexOf: dates.indexOf(lastDateProcessed),
    //     dates: dates,
    //     length: dates.length,
    // });
    if (dates.indexOf(lastDateProcessed) !== dates.length - 1) {
        spinner.text = `Processing... ${lastDateProcessed}`;
        setTimeout(wait, 1000);
    }

    if (dates.indexOf(lastDateProcessed) === dates.length - 1) {
        process.exit(0);
    }
}

mineByLastUpdatedDates(dates)
    .catch((e) => console.log('Error caught', e))
    .finally(() => {
        wait();
    });
