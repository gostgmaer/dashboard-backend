const userAgentParser = require('ua-parser-js');
const Log = require('../models/logs');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
require('dotenv').config();

// Parse user agent for device metadata
function parseUserAgent(ua) {
  if (!ua) return {};
  const parser = new userAgentParser(ua);
  return {
    browser: parser.browser.name || 'Unknown',
    os: parser.os.name || 'Unknown',
    is_mobile: parser.device.type === 'mobile' || parser.os.name.includes('Android') || parser.os.name.includes('iOS'),
  };
}

// Fetch geolocation data (using ipapi.co; replace with MaxMind for production)
async function getLocation(ip) {
  try {
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    if (response.status === 200) {
      return {
        country: response.data.country_name || 'Unknown',
        city: response.data.city || 'Unknown',
        lat: response.data.latitude || null,
        lon: response.data.longitude || null,
      };
    }
  } catch (err) {
    console.error('Geolocation error:', err.message);
  }
  return { country: 'Unknown', city: 'Unknown', lat: null, lon: null };
}

// Determine operation type based on HTTP method
function getOperation(method) {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'read';
  }
}

// Logger middleware
async function loggerMiddleware(req, res, next) {
  const startTime = Date.now();

  // Capture request metadata
  const method = req.method;
  const endpoint = req.path;
  const queryParams = req.query;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgentStr = req.headers['user-agent'];
  const deviceMetadata = parseUserAgent(userAgentStr);

  // User metadata (from JWT and database)
  let userId = null;
  let userFullname = 'Unknown';
  let userMetadata = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findOne({ email: decoded.email }).lean();
      if (user) {
        userId = user._id;
        userFullname = user.fullname || 'Unknown';
        userMetadata = { email: user.email, role: user.role || 'user', fullname: userFullname };
      }
    } catch (err) {
      console.error('JWT decode or user fetch error:', err.message);
    }
  }

  // Request body (clone to avoid stream issues)
  const requestBody = req.body ? JSON.parse(JSON.stringify(req.body)) : null;

  // Get location
  const location = await getLocation(ipAddress);

  // Capture response metadata
  let responseBody = null;
  let responseStatus = null;
  let responseHeaders = null;

  // Override res.send to capture response body
  const originalSend = res.send;
  res.send = function (body) {
    responseBody = typeof body === 'string' ? JSON.parse(body) : body;
    responseStatus = res.statusCode;
    responseHeaders = { ...res.getHeaders() };
    originalSend.call(this, body);
  };

  // Log after response is sent
  res.on('finish', async () => {
    const processTimeMs = Date.now() - startTime;

    // Log entry
    const logEntry = new Log({
      user_id: userId,
      user_fullname: userFullname,
      user_metadata: userMetadata,
      action: `${method} ${endpoint}`,
      operation: getOperation(method),
      method,
      endpoint,
      query_params: queryParams,
      request_headers: req.headers,
      request_body: requestBody,
      ip_address: ipAddress,
      response_status: responseStatus,
      response_headers: responseHeaders,
      response_body: responseBody,
      user_agent: userAgentStr,
      device_metadata: deviceMetadata,
      location,
      process_time_ms: processTimeMs,
    });

    try {
      await logEntry.save();
    } catch (err) {
      console.error('MongoDB logging error:', err);
    }
  });

  next();
}

module.exports = { loggerMiddleware, getLocation };
