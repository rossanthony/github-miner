var   jackrabbit = require('jackrabbit')
    , config          = require('dotenv').config()
    , GitHubApi = require("github")
    , _ = require("lodash")


var rabbit = jackrabbit(process.env.RABBIT_MQ_URL);
var exchange = rabbit.default();

// Setup the queue
rabbit
    .default()
    .queue({ 
        name: 'get-repo-details',
        durable: true
    })
    .consume(getRepo, { noAck: true });


// Setup github API client and auth
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
 * getRepo
 * called when new messages are plucked from the queue
 */
var getRepo = function (id) {

    github.repos.getById({
        id: id
    }).then(function(res) {

        //return console.log(res);

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
                setTimeout(getRepo(last_id), timeout * 60);
                return;
            } else {
                // Reached the end, exit
                return console.log('The end, total iterations:', iterations);
            }
        }

        // @TODO - add the repo object to the elasticsearch queue

    }).catch(function(err){
        if (err) {
            return console.log('getRepo error', err)
        } else {
            return console.log('Uncaught error thrown in getRepos');
        }
    });
};

// rabbit
//   .default()
//   .publish('Hello World!', { key: 'hello' })
//   .on('drain', rabbit.close);