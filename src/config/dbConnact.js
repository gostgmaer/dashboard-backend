// src/config/db.js

const mongoose = require('mongoose');
const tls = require('tls');
const { database, app } = require('./setting');
const LoggerService = require('../services/logger');
require('dotenv').config();

const DEFAULT_RETRY_DELAY_MS = 5000;
const DEFAULT_MAX_RETRY_DELAY_MS = 60000;

let isListenersBound = false;
let isShutdownHookBound = false;
let inFlightConnection = null;
let retryTimer = null;
let retryAttempt = 0;

const options = {
  // Connection pool
  maxPoolSize: database.maxPoolSize,
  minPoolSize: database.minPoolSize,
  maxIdleTimeMS: database.maxIdleTimeMS,

  // Timeouts
  serverSelectionTimeoutMS: database.serverSelectionTimeoutMS,
  socketTimeoutMS: database.socketTimeoutMS,
  connectTimeoutMS: database.connectTimeoutMS,

  // Buffering
  bufferCommands: false,

  // Compression (helps reduce network traffic for large workloads)
  compressors: ['zlib'],

  // Read preference
  readPreference: 'primaryPreferred',

  // Write concern
  writeConcern: {
    w: 'majority',
    j: true,
    wtimeout: 10000,
  },

  // TLS/SSL if needed. Keep undefined values out of the options object
  // to avoid conflicting with query params already present in DATABASE_URL.
  ...(typeof database.tls === 'boolean' ? { tls: database.tls } : {}),
  ...(database.enforceTls ? { secureContext: tls.createSecureContext({ minVersion: database.tlsMinVersion }) } : {}),
  ...(typeof database.tlsAllowInvalidCerts === 'boolean'
    ? { tlsAllowInvalidCertificates: database.tlsAllowInvalidCerts }
    : {}),

  // Monitoring
  heartbeatFrequencyMS: database.heartbeatFrequencyMS,
  serverMonitoringMode: 'auto',

  // Index build behavior
  autoIndex: app.environment === 'development', // disable in production for performance
  autoCreate: true,
};

const bindConnectionListeners = () => {
  if (isListenersBound) return;
  isListenersBound = true;

  mongoose.connection.on('connected', () => {
    retryAttempt = 0;
    LoggerService.info('Database connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    LoggerService.error('MongoDB connection error:', { error: err });
  });

  mongoose.connection.on('disconnected', () => {
    LoggerService.warn('MongoDB disconnected');
  });
};

const bindShutdownHooks = () => {
  if (isShutdownHookBound) return;
  isShutdownHookBound = true;

  // Capture termination signals and close connection gracefully
  const gracefulExit = () => {
    mongoose.connection.close(() => {
      LoggerService.info('MongoDB connection closed through app termination');
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulExit);
  process.on('SIGTERM', gracefulExit);
};

const scheduleReconnect = (config) => {
  if (!config.retry) return;
  if (retryTimer) return;
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;

  const backoffMultiplier = 2 ** retryAttempt;
  const delay = Math.min(config.retryDelayMs * backoffMultiplier, config.maxRetryDelayMs);
  retryAttempt += 1;

  LoggerService.warn(`Retrying MongoDB connection in ${delay}ms (attempt ${retryAttempt})`);

  retryTimer = setTimeout(() => {
    retryTimer = null;
    connectDB(config).catch(() => {
      // Errors are logged in connectDB. Avoid unhandled rejection in timer context.
    });
  }, delay);
};

const connectDB = async (config = {}) => {
  const mergedConfig = {
    retry: false,
    exitOnError: true,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    maxRetryDelayMs: DEFAULT_MAX_RETRY_DELAY_MS,
    ...config,
  };

  // Enable mongoose debug mode for detailed query logs (optional)
  if (app.environment === 'development') {
    mongoose.set('debug', false);
  }

  bindConnectionListeners();
  bindShutdownHooks();

  const isUriExplicitlyInsecure = /(?:\?|&)(?:tls|ssl)=false(?:&|$)/i.test(database.url || '');
  if (database.enforceTls && (database.tls === false || isUriExplicitlyInsecure)) {
    const error = new Error('Only secure MongoDB connections are supported. TLS 1.2 or higher is required.');
    LoggerService.error('MongoDB connection error:', { error });
    if (mergedConfig.exitOnError) process.exit(1);
    throw error;
  }

  if (mongoose.connection.readyState === 1) return true;
  if (inFlightConnection) return inFlightConnection;

  inFlightConnection = mongoose.connect(database.url, options)
    .then(() => true)
    .catch((error) => {
      LoggerService.error('MongoDB connection error:', { error });

      if (mergedConfig.retry) {
        scheduleReconnect(mergedConfig);
        return false;
      }

      if (mergedConfig.exitOnError) {
        process.exit(1);
      }

      throw error;
    })
    .finally(() => {
      inFlightConnection = null;
    });

  return inFlightConnection;
};

module.exports = connectDB;
