var elasticsearch = require('elasticsearch')
    ;

//
// Initialise a single connection, which can be accessed anywhere by the instance property
//
module.exports = {

    // Property to hold the connection
    instance: undefined,

    // Init function
    init: function() {

        this.instance = new elasticsearch.Client({
            host:   process.env.ES_CNN,
            log:    process.env.ES_LOG_LEVEL // trace|error
        });

        return this.instance;
    }
};