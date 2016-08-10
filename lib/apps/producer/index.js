var   jackrabbit = require('jackrabbit')
    , GitHubApi = require("github")
    , config          = require('dotenv').config()
    // , es = require('../adapters/elasticsearch').init()
    // , es_create = require('./elasticsearch/create')
    , _ = require("lodash")
    ;

var rabbit = jackrabbit(process.env.RABBIT_MQ_URL);
var exchange = rabbit.default();

var iterations = 1,
    last_item = {},
    comparator = '>='
    ;

var github = new GitHubApi({
    // optional
    debug: true,
    protocol: "https",
    host: "api.github.com", // should be api.github.com for GitHub
    // pathPrefix: "/v3", // for some GHEs; none for GitHub
    // headers: {
    //     "user-agent": "My-Cool-GitHub-App" // GitHub is happy with a unique user agent
    // },
    Promise: require('bluebird'),
    followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
    timeout: 5000
});

github.authenticate({
    type: "oauth",
    token: process.env.GITHUB_TOKEN
});

/**
 *  Recursive function
 */
var getReposListing = function (last_id) {

    // reset vars
    last_item = {};
    //comparator = stars > 0 ? '<=' : '>=';

    // github.search.repos({
    github.repos.getPublic({
        since: last_id
        // q: "stars:" + comparator + stars,
        // sort: "stars",
        // order: "desc",
        // per_page: 100,
        // page: page

    }).then(function(res) {

        return console.log(res);

        if (typeof res === 'undefined' || !_.has(res, 'items') || _.isEmpty(res.items)) {
            if (_.has(res, 'meta') 
                && _.has(res.meta, 'x-ratelimit-remaining')
                && res.meta['x-ratelimit-remaining'] == 0
                ) {
                // Hit the API rate limit
                if (_.has(res, 'message')) {
                    console.log('message', message);
                }
                var d = new Date();
                var timeout = parseInt(res.meta['x-ratelimit-reset']) - Math.ceil(d.getTime() / 1000);
                console.log('timeout', timeout);
                // back off until the API rate limit has been reset...
                setTimeout(getRepos(page, stars), timeout * 60);
                return;
            } else {
                // Reached the end, exit
                return console.log('The end, total iterations:', iterations);
            }
        }

        console.log('-------------------', iterations);
        console.log('page', page);
        console.log('stars', stars);
        console.log('total_count', res.total_count);
        console.log('incomplete_results', res.incomplete_results);
        console.log('x-ratelimit-remaining', res.meta['x-ratelimit-remaining']);
        console.log('x-ratelimit-reset', res.meta['x-ratelimit-reset']);
        console.log('res.items.length', res.items.length);

        addReposToElasticsearch(res);

        if (res.items.length == 100) {
            if (page == 10) {
                // if we're on page 10 (the last accessible page - due to github restrictions)
                // get the stargazers_count for the last item in the set
                last_item = _.last(res.items);
                if (_.has(last_item, 'stargazers_count')) {
                    console.log('last_item.stargazers_count', last_item.stargazers_count);
                    stars = last_item.stargazers_count;    
                } else {
                    return console.log('error, stargazers_count not found!');
                }
                // start on first page, now 'stars' value has been updated
                page = 1;
            } else {
                // otherwise just increment the page number
                page++;
            }
            getReposListing();
        }
        iterations++;

    }).catch(function(err){
        if (err) {
            return console.log('error', err)
        } else {
            return console.log('Uncaught error thrown in getRepos');
        }
    });
};

// Kick off data mining
getReposListing(0);


var addReposToElasticsearch = function (data) {

    console.log('sending to ES queue, count:', data.items.length);

    _.each(data.items, function(repo) {
        var repo_filtered = _.pickBy(repo, function(value, key) {
            return !_.endsWith(key, "_url");
        });
        // Save a trimmed down copy of the owner object within the repo object
        var owner = {
            id: repo.owner.id,
            login: repo.owner.login,
            type: repo.owner.type,
            site_admin: repo.owner.site_admin
        }
        delete repo_filtered.owner;
        repo_filtered.owner = owner;
        // console.log(repo_filtered);
        
        exchange.publish(repo_filtered, {key:'add-repos-to-elasticsearch'});
    });
}





