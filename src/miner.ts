import {v1 as neo4j} from 'neo4j-driver';
import { Driver, Session } from 'neo4j-driver/types/v1';
import { Neo4jClient } from './Neo4jClient';
import { GithubApiClient } from './GithubApiClient';
import * as request from 'request';
import { Response } from 'request';
import * as fs from 'fs';

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

const hasOwnProperty = Object.prototype.hasOwnProperty;

const isEmpty = (obj: any): boolean => {

    // null and undefined are "empty"
    if (obj == null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length > 0)    return false;
    if (obj.length === 0)  return true;

    // If it isn't an object at this point
    // it is empty, but it can't be anything *but* empty
    // Is it empty?  Depends on your application.
    if (typeof obj !== "object") return true;

    // Otherwise, does it have any properties of its own?
    // Note that this doesn't handle
    // toString and valueOf enumeration bugs in IE < 9
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }

    return true;
}

(async () => {
    const githubResults = await githubApiClient.searchRepos(3);
    console.log('total', githubResults.total_count);

    githubResults.items.forEach((item: any) => {
        request.get(`https://raw.githubusercontent.com/${item.full_name}/master/package.json`, {}, (error: Error, response: Response, body: any) => {
            if (error) {
                console.log(`error for ${item.full_name}`, error);
                return;
            }
            if (response.statusCode !== 200) {
                console.log('non-200 response for:', item.full_name);
                return;
            }
            if (!body) {
                console.log(`no body for ${item.full_name}`, error);
                return;
            }
            try {
                const json = JSON.parse(body);
                if (isEmpty(json.dependencies)) {
                    console.log('No dependencies in package.json:', item.full_name, json.dependencies);
                    return;
                }
                console.log('Writing package.json for:', item.full_name)
                fs.writeFileSync(`${__dirname}/../data/packageJsons/${item.name}.${item.id}.package.json`, body);
            } catch (error) {
                console.log(`Writing file for ${item.full_name} failed`, error);
            }
        });
    });

    // const record = await neo4jClient.saveRepository();
    // console.log('record', record);

    // on application exit:
    driver.close();
})();

