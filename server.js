/**
 * server.js
 * ----------------------------------------------------
 * Local / PM2 / Docker entry
 * - Starts HTTP server
 * - Handles graceful shutdown
 * - Node 20 safe
 */

require("dotenv").config();

const http = require("http");
const app = require("./app");
const { app: appConfig, features } = require("./src/config/setting");
const connectDB = require("./src/config/dbConnact");
const socketService = require("./src/services/socketService");
const seedSettings = require("./src/config/seedSettings");

const PORT = appConfig.port;

async function startServer() {
  try {
    console.log("⏳ Connecting to database...");
    await connectDB();
    console.log("✅ Database connected");

    // Run settings seeds
    await seedSettings();

    // Warm settings cache
    const Setting = require("./src/models/Setting");
    try {
      await Setting.getSettings();
      console.log("✅ Settings cache warmed");
    } catch (err) {
      console.error("⚠️ Failed to warm settings cache:", err.message);
    }

    const server = http.createServer(app);

    // Initialize Socket.IO
    
      if (features.socketingEnabled){ socketService.initialize(server)};


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
