/**
 * server.js
 * ----------------------------------------------------
 * Local / PM2 / Docker entry
 * - Starts HTTP server
 * - Handles graceful shutdown
 * - Node 20 safe
 *
 * STARTUP ORDER:
 * 1. dotenv — loads essential infrastructure env vars
 * 2. connectDB — establishes the MongoDB connection
 * 3. seedSettings — populates default key-value settings
 * 4. Setting.getSettings() — warms the in-memory settings cache
 * 5. require('./app') — Express app (uses Proxy-backed config)
 * 6. server.listen() — starts accepting requests
 *
 * Steps 2-4 ensure the settings cache is warm before any
 * Proxy-backed config section (email, payment, storage, etc.)
 * is first accessed by middleware or route handlers.
 */

require("dotenv").config();

const http = require("http");
const connectDB = require("./src/config/dbConnact");
const seedSettings = require("./src/config/seedSettings");

async function startServer() {
  try {
    console.log("⏳ Connecting to database...");
    await connectDB();
    console.log("✅ Database connected");

    // Run settings seeds (idempotent — skips existing keys)
    await seedSettings();

    // Warm settings cache so Proxy-backed sections resolve from DB
    const Setting = require("./src/models/Setting");
    try {
      await Setting.getSettings();
      console.log("✅ Settings cache warmed");
    } catch (err) {
      console.error("⚠️ Failed to warm settings cache:", err.message);
    }

    // Now load the Express app — all Proxy sections will resolve from cache
    const app = require("./app");
    const { app: appConfig, features } = require("./src/config/setting");
    const socketService = require("./src/services/socketService");

    const PORT = appConfig.port;
    const server = http.createServer(app);

    // Initialize Socket.IO
    if (features.socketingEnabled) {
      socketService.initialize(server);
    }

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${appConfig.environment}`);
    });

    /* =========================
       Graceful Shutdown
    ========================= */
    const shutdown = (signal) => {
      console.log(`⏳ Received ${signal}. Shutting down...`);
      server.close(() => {
        console.log("✅ HTTP server closed");
        process.exit(0);
      });

      setTimeout(() => {
        console.error("❌ Forced shutdown");
        process.exit(1);
      }, 10_000);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
}

startServer();
