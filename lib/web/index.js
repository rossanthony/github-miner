var   express = require('express')
    , bodyParser = require('body-parser')
    , path = require('path')
    , _ = require('lodash')
    ;

// Shared modules and middleware
var errors = require('./errors');
var logs = require('./logs');

// Routers
// var events = require('./events/router');


// module.exports = function Web(app, config) {
//   var web = express();
//   var errs = errors(config.verbose);

//   // Shared middleware
//   web
//     .use(logs(config.verbose))
//     .use(bodyParser.json({ type: 'application/*+json' }))
//     .use('*', function (req, res, next) {
//       //
//       return next();
//     })
//     ;

//   // Routers
//   web
//     .use(events(app))
//     ;

//   // Shared error handling
//   web
//     .use(errs.notFound)
//     .use(errs.log)
//     .use(errs.json)
//     ;

//   return web;
// };
