// src/config/db.js

const mongoose = require('mongoose');
const { dbUrl, enviroment } = require('./setting');
require('dotenv').config();

const options = {
  // Connection pool
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 20, // increase pool size
  minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2, // ensure warm connections
  maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000, // close idle sockets

  // Timeouts
  serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
  socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
  connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,

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
  // tls: process.env.DB_TLS === "true" || false,
  // tlsAllowInvalidCertificates:
  //   process.env.DB_TLS_ALLOW_INVALID_CERTS === "true" || false,

  // Monitoring
  heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT) || 10000,
  serverMonitoringMode: 'auto',

  // Index build behavior
  autoIndex: enviroment === 'development', // disable in production for performance
  autoCreate: true,
};

const connectDB = async () => {
  try {
    // Enable mongoose debug mode for detailed query logs (optional)
    if (enviroment === 'development') {
      mongoose.set('debug', false);
    }

    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB connected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('🚨 MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    // Capture termination signals and close connection gracefully
    const gracefulExit = () => {
      mongoose.connection.close(() => {
        console.log('🛑 MongoDB connection closed through app termination');
        process.exit(0);
      });
    };
    process.on('SIGINT', gracefulExit);
    process.on('SIGTERM', gracefulExit);

    await mongoose.connect(dbUrl, {});
  } catch (error) {
    console.error('🚨 MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
