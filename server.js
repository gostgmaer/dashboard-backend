/**
 * Application Entry Point
 * ----------------------------------------------------
 * - Loads environment variables
 * - Connects to database
 * - Starts HTTP + Socket server
 * - Handles crashes & graceful shutdown
 * - Production safe (Node 20 / Docker / PM2)
 */

require('dotenv').config();

const http = require('http');
const app = require('./app');

const { serverPort } = require('./src/config/setting');
const connectDB = require('./src/config/dbConnact');
const socketService = require('./src/services/socketService');

/* =========================
   Global Process Guards
========================= */
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
  process.exit(1);
});

/* =========================
   Bootstrap Server
========================= */
async function startServer() {
  let server;

  try {
    /* 1️⃣ Database Connection */
    // console.log('⏳ Connecting to database...');
    await connectDB();
    // console.log('✅ Database connected');

    /* 2️⃣ Create HTTP Server */
    server = http.createServer(app);

    /* 3️⃣ Initialize Socket Service */
    socketService.initialize(server);

    /* 4️⃣ Start Listening */
    const PORT = serverPort || process.env.PORT || 3500;

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    /* =========================
       Server Error Handling
    ========================= */
    server.on('error', (error) => {
      console.error('🚨 Server error:', error);
      process.exit(1);
    });

    /* =========================
       Graceful Shutdown
    ========================= */
    const shutdown = (signal) => {
      console.log(`⏳ Received ${signal}. Starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });

      // Force exit if shutdown hangs
      setTimeout(() => {
        console.error('❌ Forced shutdown after 10 seconds');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGINT', shutdown); // Ctrl+C
    process.on('SIGTERM', shutdown); // Docker / Kubernetes / PM2
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/* =========================
   Start Application
========================= */
startServer();

module.exports = { startServer };
