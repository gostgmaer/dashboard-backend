// src/config/db.js

const mongoose = require('mongoose');
const { database, app } = require('./setting');
const LoggerService = require('../services/logger');
require('dotenv').config();

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

  // Retry behavior
  retryWrites: true,
  retryReads: true,

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

  // TLS/SSL if needed
  tls: database.tls,
  tlsAllowInvalidCertificates: database.tlsAllowInvalidCerts,

  // Monitoring
  heartbeatFrequencyMS: database.heartbeatFrequencyMS,
  serverMonitoringMode: 'auto',

  // Index build behavior
  autoIndex: app.environment === 'development', // disable in production for performance
  autoCreate: true,
};

const connectDB = async () => {
  try {
    // Enable mongoose debug mode for detailed query logs (optional)
    if (app.environment === 'development') {
      mongoose.set('debug', false);
    }

    mongoose.connection.on('connected', () => {
      LoggerService.info('Database connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      LoggerService.error('MongoDB connection error:', { error: err });
    });

    mongoose.connection.on('disconnected', () => {
      LoggerService.warn('MongoDB disconnected');
    });

    // Capture termination signals and close connection gracefully
    const gracefulExit = () => {
      mongoose.connection.close(() => {
        LoggerService.info('MongoDB connection closed through app termination');
        process.exit(0);
      });
    };
    process.on('SIGINT', gracefulExit);
    process.on('SIGTERM', gracefulExit);

    await mongoose.connect(database.url, options);
  } catch (error) {
    LoggerService.error('MongoDB connection error:', { error });
    process.exit(1);
  }
};

module.exports = connectDB;
