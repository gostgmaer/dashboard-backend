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
const { isSocketingEnabled } = require("./src/config/setting");
const connectDB = require("./src/config/dbConnact");
const socketService = require("./src/services/socketService");

const PORT = process.env.PORT || 3500;

async function startServer() {
  try {
    console.log("⏳ Connecting to database...");
    await connectDB();
    console.log("✅ Database connected");

    const server = http.createServer(app);

    // Initialize Socket.IO
    
      if (isSocketingEnabled){ socketService.initialize(server)};


    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
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
