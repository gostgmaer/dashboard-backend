const winston = require('winston');
require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: 'info',
  transports: [
    // Rotate info logs daily
    new winston.transports.DailyRotateFile({
      filename: 'logs/info-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'info',
    }),

    // Rotate error logs daily
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
    }),

    new winston.transports.Console()
  ]
});

module.exports = logger;
