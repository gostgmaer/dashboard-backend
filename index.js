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
const { app: appConfig, features } = require("./src/config/setting");
const connectDB = require("./src/config/dbConnact");
const socketService = require("./src/services/socketService");
const LoggerService = require("./src/services/logger");

const PORT = appConfig.port;

async function startServer() {
  try {
    const server = http.createServer(app);

    // Initialize Socket.IO

    if (features.socketingEnabled) { socketService.initialize(server) };


    server.listen(PORT, () => {
      LoggerService.info(`Server running on port ${PORT}`);
      LoggerService.info(`Environment: ${appConfig.environment}`);
    });

    LoggerService.info('Connecting to database...');
    connectDB({
      retry: true,
      exitOnError: false,
    }).then((connected) => {
      if (!connected) {
        LoggerService.warn('MongoDB not reachable yet. Running in degraded mode until reconnection.');
      }
    }).catch((error) => {
      // Retry mode should not throw, but keep this as a safety net.
      LoggerService.error('Unexpected MongoDB initialization error:', { error });
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
