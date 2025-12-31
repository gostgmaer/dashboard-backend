/**
 * handler.js
 * ----------------------------------------------------
 * Serverless entry
 * - Exports a handler function
 * - NO server.listen()
 * - Node 20 safe
 */

require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./src/config/dbConnact');
const socketService = require('./src/services/socketService');

let server;
let isInitialized = false;

/* =========================
   Bootstrap (cold start only)
========================= */
async function bootstrap() {
  if (isInitialized) return;

  console.log('⏳ Connecting to database...');
  await connectDB();
  console.log('✅ Database connected');

  server = http.createServer(app);

  // Initialize socket once (note: not supported on Vercel)
  socketService.initialize(server);

  isInitialized = true;
  console.log('🚀 Server initialized (serverless)');
}

/* =========================
   REQUIRED EXPORT
========================= */
module.exports = async function handler(req, res) {
  try {
    await bootstrap();
    server.emit('request', req, res);
  } catch (error) {
    console.error('🔥 Handler error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};
