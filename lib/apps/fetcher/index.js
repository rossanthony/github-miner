var   GitHubApi = require("github")
    // , request = require("request")
    , config          = require('dotenv').config()
    , es = require('./adapters/elasticsearch').init()
    , es_create = require('./elasticsearch/create')
    , _ = require("lodash")
    ;

// var env = process.env;

// console.log('es', es);


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


// Basic auth (to aquire a token)
// github.authenticate({
//     type: "basic",
//     username: 'rossanthony',
//     password: process.env.GITHUB_PASSWORD
// });

// Create auth token
// github.authorization.create({
//     scopes: ["public_repo"],
//     note: "My app",
//     // headers: {
//     //     "X-GitHub-OTP": "two-factor-code"
//     // },
//     // client_id: process.env.GITHUB_CLIENT_ID,
//     // client_secret: process.env.GITHUB_CLIENT_SECRET

// }, function(err, res) {
//     if (err) {
//         return console.log('err', err);
//     }
//     if (res.token) {
//         //save and use res.token as in the Oauth process above from now on
//         token = res.token
//         console.log('token', token);
//     }
// });











var getFromGH = function () {
    var stars = 0,
    reached_end = false,
    results_returned = 0,
    iterations = 0,
    page = 1;
    
    
    // reset vars
    results_returned = 0;

    github.search.repos({
        q: "stars:>=" + stars,
        // q: "forks:>=" + forks,
        sort: "stars",
        order: "desc",
        per_page: 100,
        page: page

    }).then(function(res) {

        if (typeof res === 'undefined' || !_.has(res, 'items')) {
            return console.log('no results')
        }

        console.log('-------------------');
        console.log('page', page);
        console.log('stars', stars);

        console.log('total_count', res.total_count);
        console.log('incomplete_results', res.incomplete_results);
        console.log('x-ratelimit-remaining', res.meta['x-ratelimit-remaining']);

        results_returned = res.items.length;

        

        // if we're on page 10 (the last accessible page - due to github restrictions)
        // get the stargazers_count for the last item in the set

        console.log('res.items.length', res.items.length);

        if (page == 10 && res.items.length == 100) {
           var last_item = _.last(res.items);
           console.log('last_item.stargazers_count', last_item.stargazers_count);
           stars = last_item.stargazers_count;
        }

        if (res.items.length < 100) {
            reached_end = true;
            return;
        }

        // Keys available:
        // - total_count
        // - incomplete_results
        // - items
        // - meta

        if (page > 10) {
            page = 1;
        } else {
            page++;    
        }
        
        iterations++;

    }).catch(function(err){
        if (err) {
            return console.log('error', err)
        }
    });
    
    console.log('completed iteration', iterations);

};






// github.authenticate({
//     type: "oauth",
//     token: token
// });

// OAuth2 Key/Secret (to get a token)
// github.authenticate({
//     type: "oauth",
//     key: process.env.GITHUB_CLIENT_ID,
//     secret: process.env.GITHUB_CLIENT_SECRET
// });



/*

for (var currentPage = 1; currentPage <= 100; currentPage++) {
    //console.log('currentPage', currentPage);
}

var currentPage = 1;

//github.search.repos({
//github.repos.getAll({
// github.repos.getPublic({
github.users.getAll({
//github.users.getFollowingForUser({
    // optional:
    // headers: {
    //     "cookie": "blahblah"
    // },
    // user: "rossanthony"

//    q: '',
    // sort: 'stars',
    // order: 'desc',
    // page: currentPage,
    // per_page: 100

    since: 1

}, function(err, res) {

    // total_count
    // incomplete_results
    // items
    // meta
    if (err) {
        return console.log(JSON.stringify(err));
    }

    // Loop over the users, get their public repos

    _.each(res, function (user) {
        console.log(user);

        // github.users.getById({
        //     id: user.id
        // }, function (err, res) {
        //     console.log('err', err);
        //     console.log('res', res);
        // });

        return false;
    });

    
    // if (res.total_count > 0) {
    //     var i = 0;
    //     _.each(res.items, function (repo) {
    //         i++;
    //         //console.log('repo '+i, repo);

            

    //         es_create(repo);          
    //     });
    // }
    
    // _.each(res, function (v, k) {
    //     console.log('k', k);
    // });

    // console.log(res[0]);

    // console.log(JSON.stringify(res));
});




*/
