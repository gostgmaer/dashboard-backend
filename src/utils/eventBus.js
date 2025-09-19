// utils/eventBus.js
const EventEmitter = require('events');
class NotificationBus extends EventEmitter {}
module.exports = new NotificationBus();
