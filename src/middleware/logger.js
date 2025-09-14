// logMiddleware.js
// const LogEntry = require("../models/logEntry");
// // const { getLocationInfo,getLocalIpAddress } = require("../utils/helper");
// async function logMiddleware(req, res, next) {
//   try {
//     const ip = await getLocalIpAddress()// Get the request's IP address
//     const locationInfo = await getLocationInfo(ip.IPv4);

//     const logEntry = new LogEntry({
//       method: req.method,
//       path: req.originalUrl,
//       body: req.body,
//       query: req.query,
//       useragent: req.get("User-Agent"),
//       params: req.params,
//       ip:ip,
//       location: locationInfo,
//       response: {
//         statusCode: res.statusCode,
//         body: res.locals.responseData || {},
//       },
//     });
//     await logEntry.save();

//   } catch (err) {
//     console.error("Error saving log entry:", err);
//   }

//   res.on('finish', () => {
//     // Execute code after route handler
  
// });
//   next();
// }

// module.exports = logMiddleware;


// middleware/apiLogger.js
// const ApiLog = require('../models/apiLog'); // Assuming you have an ApiLog model defined
// const { getLocationInfo, getLocalIpAddress } = require('../utils/helper');

//  const apiLogger = (req, res, next) => {
//   const chunks = [];
//   const originalSend = res.send;

//   // Capture response body
//   res.send = function (body) {
//     chunks.push(body);
//     res.send = originalSend;
//     return res.send(body);
//   };

//   res.on('finish', async () => {
//     const responseBody = chunks.length ? chunks[0] : null;

//     const log = new ApiLog({
//       method: req.method,
//       url: req.originalUrl,
//       status: res.statusCode,
//       ip: req.ip,
//       userAgent: req.headers['user-agent'],
//       requestBody: req.body,
//       responseBody: responseBody,
//       timestamp: new Date(),
//     });

//     try {
//       await log.save();
//     } catch (err) {
//       console.error('Failed to log API call:', err);
//     }
//   });

//   next();
// };

// module.exports = apiLogger;


// middleware/logger.js
const LogEntry = require('../models/logEntry');

const loggerMiddleware = (req, res, next) => {
  


 const path = req.originalUrl.toLowerCase();

 if (path === '/log' || path.includes('/api/logs')) {
   return next();
 }

  // const start = Date.now();
  const originalSend = res.send;
  let responseBody;

  // Capture response body
  res.send = function (body) {
    responseBody = body;
    res.send = originalSend;
    return res.send(body);
  };

  res.on('finish', async () => {
    const log = new LogEntry({
      method: req.method,
      path: req.originalUrl,
      body: req.body,
      query: req.query,
      params: req.params,
      useragent: req.headers['user-agent'],
      response: tryParseJSON(responseBody),
      ip: req.ip || req.connection.remoteAddress,
      location: {}, // You can populate this using a geo-IP service if needed
    });

    try {
      await log.save();
    } catch (err) {
      console.error('Failed to save log entry:', err);
    }
  });

  next();
};

// Helper to safely parse JSON
function tryParseJSON(data) {
  try {
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch {
    return String(data); // Fallback to string if parsing fails
  }
}

module.exports = loggerMiddleware;
