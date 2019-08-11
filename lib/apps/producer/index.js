var   jackrabbit = require('jackrabbit')
    , GitHubApi = require("github")
    , config          = require('dotenv').config()
    , es = require('../../adapters/elasticsearch').init()
    , moment = require('moment')
    , _ = require("lodash")
    ;


var rabbit = jackrabbit(process.env.RABBIT_MQ_URL);
var exchange = rabbit.default();

var iterations = 1,
    last_item = {},
    comparator = '>=',
    includeForks = false,
    startId = 323444
    ;

var github = new GitHubApi({
    // optional
    debug: false,
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

        
        // console.log('total', res.length);
        // console.log('meta', res.meta);
        // console.log('res[99]', res[99]);

        // _.each(res, function(v, k) {
        //     console.log('k', k);
        //     console.log('v', v);
        // });

        // return false; //console.log(JSON.stringify(res, null, 4));

        if (typeof res === 'undefined' || _.isEmpty(res)) {
            console.log('-------------------', iterations);
            console.log('total_count', res.total_count);
            console.log('incomplete_results', res.incomplete_results);
            console.log('x-ratelimit-remaining', res.meta['x-ratelimit-remaining']);
            console.log('x-ratelimit-reset', res.meta['x-ratelimit-reset']);
            console.log('res.length', res.length);

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
                timeout = (timeout * 60) + 10;
                console.log('waiting for '+timeout+'ms before retrying...');
                // back off until the API rate limit has been reset...
                setTimeout(getRepoListing(startId), timeout);
                return;
            } 
            // Reached the end, exit
            return console.log('The end, total iterations:', iterations);
        }

        _.each(res, function(repo) {
            if (!includeForks && repo.fork) {
                console.log('- repo '+repo.full_name+' ('+repo.id+') is a fork, skipping...');
                return;
            }
            if (repo.stargazers_count == 0) {
                console.log('- repo '+repo.full_name+' ('+repo.id+') has zero stars, skipping...');
                return;   
            }
            console.log('+ sending repo '+repo.full_name+' ('+repo.id+') to "get-repo-details" queue')
            // push request to get repo into the queue...
            exchange.publish(repo.id, {key:'get-repo-details'});
        });

        

        // Get the next batch of results, if the current set is a full one
        if (res.length == 100) {
            // get the startId
            last_item = _.last(res);
            if (_.has(last_item, 'id')) {
                console.log('============= Reached last repo in the set, id: ', last_item.id + '=============');
                startId = last_item.id;    
            } else {
                return console.log('error, id not found!');
            }

            //return console.log('Done!');

            getRepoListing(startId);
        }

        iterations++;
        return console.log('The end.');

    }).catch(function(err){
        if (err) {
            var timeout = 0;
            // Hit the API rate limit?
            if (_.has(err, 'message')) {
                console.log('message', err.message);
                //if (_.has(err.message, 'message') && err.message.message == "You have triggered an abuse detection mechanism. Please wait a few minutes before you try again.")
                timeout = 10800; // 3mins
            }
            var epochReset = moment.unix(parseInt(err.headers['x-ratelimit-reset'])).utc();
            var epochNow = moment.utc();
            var diff = moment.utc(moment(epochReset,"DD/MM/YYYY HH:mm:ss").diff(moment(epochNow,"DD/MM/YYYY HH:mm:ss"))).format("HH:mm:ss")
            var duration = moment.duration(diff);
            var humanisedDuration =  Math.ceil(duration.asMinutes());
            if (timeout > 0) {
                humanisedDuration = 3;
            } else {
                timeout = duration.asMilliseconds();
            }
            console.log('waiting for '+ humanisedDuration +'mins ('+timeout+'ms) before retrying...');
            // back off until the API rate limit has been reset...
            setTimeout(function () {
                getRepoListing(startId)
            }, timeout);
            return;
               
        } else {
            return console.log('Uncaught error thrown in getRepos');
        }
    });
};

// Kick off data mining
getRepoListing(startId);

