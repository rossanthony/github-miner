var logger = require('logfmt');
var Promise = require('promise');
var uuid = require('node-uuid');
var EventEmitter = require('events').EventEmitter;

var connections = require('./connections');
var EventModel = require('./event-model');

var EVENT_QUEUE = 'jobs.event';
var HIDE_QUEUE = 'jobs.hide';

function App(config) {
  EventEmitter.call(this);

  this.config = config;
  this.connections = connections(config.mongo_url, config.rabbit_url);
  this.connections.once('ready', this.onConnected.bind(this));
  this.connections.once('lost', this.onLost.bind(this));
}

module.exports = function createApp(config) {
  return new App(config);
};

App.prototype = Object.create(EventEmitter.prototype);

App.prototype.onConnected = function() {
  var queues = 0;
  this.Event = EventModel(this.connections.db, this.config.mongo_cache);
  this.connections.queue.create(EVENT_QUEUE, { prefetch: 5 }, onCreate.bind(this));
  this.connections.queue.create(HIDE_QUEUE, { prefetch: 5 }, onCreate.bind(this));

  function onCreate() {
    if (++queues === 2) this.onReady();
  }
};

App.prototype.onReady = function() {
  logger.log({ type: 'info', msg: 'app.ready' });
  this.emit('ready');
};

App.prototype.onLost = function() {
  logger.log({ type: 'info', msg: 'app.lost' });
  this.emit('lost');
};

App.prototype.addEvent = function(locals, attr, related) {
  var id = uuid.v1();
  logger.log({
    type: attr.type,
    user_id: locals.auth.user_id,
    api_key_id: locals.auth.api_key_id
  });
  this.connections.queue.publish(EVENT_QUEUE, {
    _id: id,
    instance_id: locals.instance_id || null,
    user_id: locals.auth.user_id || null,
    api_key_id: locals.auth.api_key_id || null,
    type: attr.type,
    entities: related.entities.data
  });
  return Promise.resolve(id);
};

App.prototype.processEvent = function(event) {
  return this.Event.process(event);
};

App.prototype.supressEvent = function(userId, eventId) {
  this.connections.queue.publish(HIDE_QUEUE, { userId: userId, eventId: eventId });
  return Promise.resolve(eventId);
};

App.prototype.purgePendingEvents = function() {
  logger.log({ type: 'info', msg: 'app.purgePendingEvents' });

  return new Promise(function(resolve, reject) {
    this.connections.queue.purge(EVENT_QUEUE, onPurge);

    function onPurge(err, count) {
      if (err) return reject(err);
      resolve(count);
    }
  }.bind(this));
};

App.prototype.getEvent = function(id) {
  return this.Event.get(id);
};

App.prototype.listEvents = function(userId, n, fresh) {
  return this.Event.list(userId, n, fresh);
};

App.prototype.startAggregatingEvents = function() {
  this.connections.queue.handle(EVENT_QUEUE, this.handleEventJob.bind(this));
  this.connections.queue.handle(HIDE_QUEUE, this.handleHideJob.bind(this));
  return this;
};

App.prototype.handleEventJob = function(job, ack) {
  logger.log({ type: 'info', msg: 'handling job', queue: EVENT_QUEUE, type: job.type });

  this
    .processEvent(job)
    .then(onSuccess, onError);

  function onSuccess() {
    logger.log({ type: 'info', msg: 'job complete', status: 'success', url: job.url });
    ack();
  }

  function onError() {
    logger.log({ type: 'info', msg: 'job complete', status: 'failure', url: job.url });
    ack();
  }
};

App.prototype.handleHideJob = function(job, ack) {
  logger.log({ type: 'info', msg: 'handling job', queue: HIDE_QUEUE, eventId: job.eventId });

  this
    .supressEvent(job.userId, job.eventId)
    .then(onSuccess, onError);

  function onSuccess() {
    logger.log({ type: 'info', msg: 'job complete', queue: HIDE_QUEUE, status: 'success' });
    ack();
  }

  function onError(err) {
    logger.log({ type: 'info', msg: 'job complete', queue: HIDE_QUEUE, status: 'failure', error: err });
    ack();
  }
};

App.prototype.stopProcessing = function() {
  this.connections.queue.ignore(EVENT_QUEUE);
  this.connections.queue.ignore(HIDE_QUEUE);
  return this;
};

App.prototype.deleteAllEvents = function() {
  logger.log({ type: 'info', msg: 'app.deleteAllEvents' });
  return this.Event.deleteAll();
};
