// src/config/db.js

const mongoose = require('mongoose');
const { dbUrl, enviroment } = require('./setting');
require('dotenv').config();

const { EventEmitter } = require('events');

require('dotenv').config();

const connectDB = async () => {
  try {
    // Enable mongoose debug mode for detailed query logs (optional)
    if (enviroment === 'development') {
      mongoose.set('debug', true);
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
