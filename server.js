/**
 * Application Entry Point (Serverless Compatible)
 * ----------------------------------------------------
 * - Loads environment variables
 * - Connects to database (once per cold start)
 * - Creates HTTP + Socket server
 * - Exports a handler function (REQUIRED by serverless)
 * - Node 20 compatible
 */

require('dotenv').config();

const http = require('http');
const app = require('./app');

const connectDB = require('./src/config/dbConnact');
const socketService = require('./src/services/socketService');

/* =========================
   Internal State
========================= */
let server;
let isInitialized = false;

/* =========================
   Bootstrap (runs once per cold start)
========================= */
async function bootstrap() {
  if (isInitialized) return;

  try {
    console.log('⏳ Connecting to database...');
    await connectDB();
    console.log('✅ Database connected');

    server = http.createServer(app);

    // Initialize sockets only once
    socketService.initialize(server);

    isInitialized = true;
    console.log('🚀 Server initialized (serverless mode)');
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    throw error;
  }
}

/* =========================
   REQUIRED SERVERLESS EXPORT
========================= */
module.exports = async function handler(req, res) {
  try {
    await bootstrap();

    // Forward request to Express
    server.emit('request', req, res);
  } catch (error) {
    console.error('🔥 Request handling error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};
