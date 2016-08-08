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

github.authenticate({
    type: "oauth",
    token: process.env.GITHUB_TOKEN
});



var stars = 0,
    reached_end = false,
    results_returned = 0;


while (stars < 100000 && !reached_end) {

    for (var i = 1; i <= 10; i++) {
        
        // stars = i < 10 ? 0 : Math.floor(i/10);

        console.log('i', i);
        console.log('stars', stars);
        console.log('-------------------');

        // reset vars
        results_returned = 0;

        github.search.repos({
            q: "stars:>=" + stars,
            // q: "forks:>=" + forks,
            sort: "stars",
            order: "desc",
            per_page: 100,
            page: i

        }, function(err, res) {

            if (err) {
                return console.log('error', err)
            }

            if (typeof res === 'undefined' || !_.has(res, 'items')) {
                return console.log('no results')
            }

            results_returned = res.items.length;

            _.each(res.items, function(repo) {
                var repo_filtered = _.pickBy(repo, function(value, key) {
                    return !_.endsWith(key, "_url");
                });

                var owner = {
                    id: repo.owner.id,
                    login: repo.owner.login,
                    type: repo.owner.type,
                    site_admin: repo.owner.site_admin
                }

                delete repo_filtered.owner;

                repo_filtered.owner = owner;

                console.log(repo_filtered);

                es_create(repo_filtered);
            });

            // if we're on page 10 (the last accessible page - due to github restrictions)
            // get the stargazers_count for the last item in the set

            if (i == 10 && res.items.length == 100) {
               stars = _.last(res.items).stargazers_count;
            }

            if (res.items.length < 100) {
                reached_end = true;
                break;
            }


            console.log('total_count', res.total_count);
            console.log('incomplete_results', res.incomplete_results);
            console.log('meta', res.meta);

            // Keys available:
            // - total_count
            // - incomplete_results
            // - items
            // - meta

            // for (var itemKey in res['items']) {
            //     var item = res['items'][itemKey];
            //     var url = item['html_url'];
            //     var star_count = item['stargazers_count'];
            //     console.log(url + " (" + star_count + ")");
            // }

            //console.log(res['items'][0]);
        });
    }

    stars++;
}




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
