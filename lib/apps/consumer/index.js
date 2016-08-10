var jackrabbit = require('jackrabbit')
    , config          = require('dotenv').config();

var rabbit = jackrabbit(process.env.RABBIT_MQ_URL);

rabbit
  .default()
  .queue({ name: 'hello' })
  .consume(onMessage, { noAck: true });

function onMessage(data) {
  console.log('received:', data);
}

setTimeout(function(){
    rabbit
      .default()
      .publish('Hello there', { key: 'hello' })
      ; //.on('drain', rabbit.close);
}, 2000);


setTimeout(function(){
    rabbit
      .default()
      .publish('Hello again', { key: 'hello' })
      ; //.on('drain', rabbit.close);
}, 5000);