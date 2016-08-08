function EventNotFound() {
  Error.call(this);
  Error.captureStackTrace(this, EventNotFound);
  this.name = 'EventNotFound';
  this.message = 'Event Not Found';
}
EventNotFound.prototype = Object.create(Error.prototype);


function EventProcessFailed() {
  Error.call(this);
  Error.captureStackTrace(this, EventProcessFailed);
  this.name = 'EventProcessFailed';
  this.message = 'Event Process Failed';
}
EventNotFound.prototype = Object.create(Error.prototype);


module.exports = {
  EventNotFound: EventNotFound,
  EventProcessFailed: EventProcessFailed
};
