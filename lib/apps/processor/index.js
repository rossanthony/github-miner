var   jackrabbit = require('jackrabbit')
    , config          = require('dotenv').config()
    , es = require('../../../lib/adapters/elasticsearch').init()
    , es_create = require('./elasticsearch/create_repo')
    , _ = require("lodash")

var rabbit = jackrabbit(process.env.RABBIT_MQ_URL);

// console.log('rabbit', rabbit);

rabbit
    .default()
    .queue({ 
        name: 'add-repo-to-elasticsearch',
        durable: true
    })
    .consume(function (repo_filtered) {
        es_create(repo_filtered);
    }, { noAck: true });


// rabbit
//   .default()
//   .publish('Hello World!', { key: 'hello' })
//   .on('drain', rabbit.close);