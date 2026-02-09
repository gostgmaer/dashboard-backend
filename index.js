/**
 * server.js
 * ----------------------------------------------------
 * Local / PM2 / Docker entry
 * - Starts HTTP server
 * - Handles graceful shutdown
 * - Node 20 safe
 */

require("dotenv").config();

const validateEnv = require("./src/config/validateEnv");

// Validate environment variables before starting server
validateEnv();

const http = require("http");
const app = require("./app");
const { isSocketingEnabled } = require("./src/config/setting");
const connectDB = require("./src/config/dbConnact");
const socketService = require("./src/services/socketService");
const LoggerService = require("./src/services/logger");

const PORT = process.env.PORT || 3500;

async function startServer() {
  try {
    LoggerService.info('Connecting to database...');
    await connectDB();
    LoggerService.info('Database connected');

    const server = http.createServer(app);

    // Initialize Socket.IO

    if (isSocketingEnabled) { socketService.initialize(server) };


    server.listen(PORT, () => {
      LoggerService.info(`Server running on port ${PORT}`);
      LoggerService.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    });

    /* =========================
       Graceful Shutdown
    ========================= */
    const shutdown = (signal) => {
      LoggerService.info(`Received ${signal}. Shutting down...`);
      server.close(() => {
        LoggerService.info('HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        LoggerService.error('Forced shutdown');
        process.exit(1);
      }, 10_000);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    LoggerService.error('Server startup failed:', { error });
    process.exit(1);
  }
}

startServer();
