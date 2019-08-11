/**
 * Establishes a RabbitMQ queue,
 * which consumes incoming messages containing a repo Id
 * upon consumption of the message it calls the github api
 * to fetch the full details for the repo.
 * The object containing the repo data is then sent to the 
 * elasticsearch queue.
 */
var   jackrabbit = require('jackrabbit')
    , config     = require('dotenv').config()
    , GitHubApi  = require("github")
    , moment     = require('moment')
    , _          = require("lodash")


var rabbit = jackrabbit(process.env.RABBIT_MQ_URL);
var exchange = rabbit.default();


// Setup github API client and auth
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


var currentId = 0;

// called when new messages are plucked from the queue
var getRepo = function (id) {

    currentId = id;
    console.log('fetching repo '+id);

    github.repos.getById({
        id: id
    }).then(function(res) {

        //return console.log(res);

        if (typeof res === 'undefined' || _.isEmpty(res)) {
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
                setTimeout(getRepo(id), timeout * 60);
                return;
            } 
            // Reached the end, exit
            return console.log('The end, total iterations:', iterations);
        }

        // add the repo object to the elasticsearch queue
        addRepoToElasticsearch(res);

    }).catch(function(err){
        if (err) {
            var timeout = 0;
            // Hit the API rate limit?
            if (_.has(err, 'message')) {
                console.log('message', err.message);
                if (_.has(err.message, 'block') && _.has(err.message.block, 'reason')) {
                    if (err.message.block.reason == 'unavailable') {
                        console.log('- repo skipped...');
                        return;
                    }
                }
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
            console.log('waiting for '+ humanisedDuration +'mins before retrying...');

            // back off until the API rate limit has been reset...
            setTimeout(function () {
                getRepo(currentId)
            }, timeout);
            return;

        } else {
            return console.log('Uncaught error thrown in getRepos');
        }
    });
};


var addRepoToElasticsearch = function (repo) {

    console.log('sending repo '+repo.id+' to ES queue');

    var repo_filtered = _.pickBy(repo, function(value, key) {
        return !_.endsWith(key, "_url");
    });
    // Save a trimmed down copy of the owner object within the repo object
    var owner = {
        id: repo.owner.id,
        login: repo.owner.login,
        type: repo.owner.type,
        site_admin: repo.owner.site_admin
    };
    // Remove superfluous data from object before commiting to the DB to save space
    delete repo_filtered.meta;
    delete repo_filtered.permissions;
    delete repo_filtered.owner;

    repo_filtered.owner = owner;
    // console.log(repo_filtered);
    
    exchange.publish(repo_filtered, {key:'add-repo-to-elasticsearch'});
}


// Setup the queue
exchange
    .queue({ 
        name: 'get-repo-details',
        durable: true
    })
    .consume(getRepo, { noAck: true });
