// middleware/activityLogger.js
const activityLogService = require('../services/activityLogService');

/**
 * Global activity logging middleware
 * Automatically logs all requests for authenticated users
 */
function activityLogger(options = {}) {
  const {
    excludeRoutes = ['/health', '/favicon.ico', '/robots.txt', '/sitemap.xml'],
    excludeMethods = ['OPTIONS', 'HEAD'],
    logAnonymous = false, // Set to true if you want to log non-authenticated requests
    skipSuccessfulGET = false, // Set to true to skip successful GET requests for performance
  } = options;

  return (req, res, next) => {
    // Skip excluded routes
    if (excludeRoutes.some(route => req.path.includes(route))) {
      return next();
    }

    // Skip excluded methods
    if (excludeMethods.includes(req.method)) {
      return next();
    }

    // Skip if user is not authenticated (unless logAnonymous is true)
    if (!logAnonymous && (!req.user || !req.user.id)) {
      return next();
    }

    // Skip successful GET requests if configured
    if (skipSuccessfulGET && req.method === 'GET') {
      return next();
    }

    // Track request start time
    const startTime = Date.now();

    // Store original res.end to capture response data
    const originalEnd = res.end;

    res.end = function(chunk, encoding) {
      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Get response size
      const responseSize = chunk ? Buffer.byteLength(chunk, encoding) : 0;

      // Extract activity data
      const activityData = activityLogService.extractActivityData(req, res, {
        responseTime,
        responseSize,
        // These can be overridden by controller-specific logging
        action: req.activityAction,
        additionalData: req.activityData,
        category: req.activityCategory,
        priority: req.activityPriority,
        isSensitive: req.activitySensitive,
      });

      // Log the activity (non-blocking)
      activityLogService.logActivity(activityData);

      // Call original res.end
      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Middleware to set custom activity data from controllers
 * Usage: req.setActivity('created product', { productId: '123' });
 */
function attachActivityHelpers(req, res, next) {
  req.setActivity = function(action, additionalData = null, options = {}) {
    req.activityAction = action;
    req.activityData = additionalData;
    req.activityCategory = options.category;
    req.activityPriority = options.priority;
    req.activitySensitive = options.isSensitive;
  };

  req.setActivityCategory = function(category) {
    req.activityCategory = category;
  };

  req.setActivityPriority = function(priority) {
    req.activityPriority = priority;
  };

  req.markSensitive = function() {
    req.activitySensitive = true;
  };

  next();
}

/**
 * Express error handler integration for logging errors
 */
function errorActivityLogger(err, req, res, next) {
  // Log error activity if user is authenticated
  if (req.user && req.user.id) {
    const activityData = activityLogService.extractActivityData(req, res, {
      action: req.activityAction || `error: ${err.message}`,
      additionalData: {
        error: {
          message: err.message,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
          code: err.code,
          status: err.status || err.statusCode,
        },
        ...(req.activityData || {}),
      },
      priority: 'high',
      isSensitive: true,
    });

    activityLogService.logActivity(activityData);
  }

  next(err);
}

module.exports = {
  activityLogger,
  attachActivityHelpers,
  errorActivityLogger,
};
