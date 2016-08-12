/**
 * Create new document in Elastic Search with any associated relations (if defined in config)
 */

var   _ = require('lodash')
    , async = require('async')
    , colors = require('colors')
    , es = require('../../../adapters/elasticsearch').instance
    ;

module.exports = function (repo) {

    var es_create_request = {
        index   : 'github-data',
        type    : 'repos',
        id      : repo.id,
        body    : repo
    };


    es.create(es_create_request, function (error, response) {
        if (error) {
            // @todo add to failed redis queue
            return console.log('[ES] [update failed]'.red, {error: error});
        }

        console.log('[ES] [create successful]'.green, response);
    });
    
};
