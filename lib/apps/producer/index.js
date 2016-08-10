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
var getRepoListing = function (last_id) {

    // reset vars
    last_item = {};
    
    github.repos.getPublic({
        since: last_id
    }).then(function(res) {

        return console.log(res);

        if (typeof res === 'undefined' || !_.has(res, 'items') || _.isEmpty(res.items)) {
            if (_.has(res, 'meta') 
                && _.has(res.meta, 'x-ratelimit-remaining')
                && res.meta['x-ratelimit-remaining'] == 0
                ) {
                // Hit the API rate limit?
                if (_.has(res, 'message')) {
                    console.log('message', message);
                }
                var d = new Date();
                var timeout = parseInt(res.meta['x-ratelimit-reset']) - Math.ceil(d.getTime() / 1000);
                console.log('timeout', timeout);
                // back off until the API rate limit has been reset...
                setTimeout(getRepoListing(last_id), timeout * 60);
                return;
            } else {
                // Reached the end, exit
                return console.log('The end, total iterations:', iterations);
            }
        }

        console.log('-------------------', iterations);
        // console.log('page', page);
        // console.log('stars', stars);
        console.log('total_count', res.total_count);
        console.log('incomplete_results', res.incomplete_results);
        console.log('x-ratelimit-remaining', res.meta['x-ratelimit-remaining']);
        console.log('x-ratelimit-reset', res.meta['x-ratelimit-reset']);
        console.log('res.items.length', res.items.length);

        getRepos(res);

        if (res.items.length == 100) {
            // get the last_id
            last_item = _.last(res.items);
            if (_.has(last_item, 'id')) {
                console.log('last_item.id', last_item.id);
                last_id = last_item.id;    
            } else {
                return console.log('error, id not found!');
            }
             
            getRepoListing();
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
getRepoListing(0);


var getRepos = function (data) {

    _.each(data.items, function(repo) {
        
        // push request to get repo into the queue...
        

    });
};


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





