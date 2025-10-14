// services/activityLogService.js
const UserActivityLog = require('../models/UserActivityLog');
const UAParser = require('ua-parser-js'); // npm install ua-parser-js
const geoip = require('geoip-lite'); // npm install geoip-lite (optional for location)
class ActivityLogService {
  constructor() {
    this.queue = []; // In-memory queue for non-blocking logging
    this.isProcessing = false;
    this.batchSize = 10;
    this.flushInterval = 5000; // 5 seconds

    // Start the batch processor
    this.startBatchProcessor();
  }

  /**
   * Main method to log user activity
   * @param {Object} logData - Activity log data
   */
  async logActivity(logData) {
    try {
      // Add to queue for non-blocking processing
      this.queue.push({
        ...logData,
        timestamp: new Date(),
        queuedAt: Date.now(),
      });

      // Process immediately if queue is getting large
      if (this.queue.length >= this.batchSize && !this.isProcessing) {
        this.processBatch();
      }
    } catch (error) {
      console.error('Error queueing activity log:', error);
      // Don't throw - logging should never break the main flow
    }
  }

  /**
   * Extract user activity data from Express request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Object} options - Additional options
   */
  extractActivityData(req, res, options = {}) {
    const { deviceInfo } = req;

    return {
      userId: req.user?.id || req.user?._id || null,
      action: options.action || this.generateDefaultAction(req),
      route: req.baseUrl ? req.originalUrl : req.path,
      method: req.method,
      ip: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      additionalData: options.additionalData || null,

      // Performance metrics
      responseTime: options.responseTime || null,
      statusCode: res.statusCode,
      requestSize: req.get('Content-Length') ? parseInt(req.get('Content-Length')) : null,

      // Session and device info
      sessionId: req.sessionID || req.session?.id || null,
      deviceId: deviceInfo.deviceId || req.headers['x-device-id'] || null,
      deviceType: deviceInfo.device.type,
      deviceFingerprint: deviceInfo.fingerprint || null,

      // Parsed browser/device info
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      device: deviceInfo.device,
      location: deviceInfo.location,

      // Auto-categorization
      category: options.category || this.getResource(req),
      priority: options.priority || this.getPriority(req.method, options.isSensitive),
      isSensitive: options.isSensitive || this.isSensitiveRoute(req.path),
    };
  }

  /**
   * Get client IP address from request
   */
  getClientIP(req) {
    return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || (req.connection?.socket ? req.connection.socket.remoteAddress : null) || req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || '127.0.0.1';
  }

  /**
   * Get location from IP address
   */
  getLocationFromIP(ip) {
    try {
      // Skip for local IPs
      if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
        return null;
      }

      const geo = geoip.lookup(ip);
      if (geo) {
        return {
          country: geo.country,
          region: geo.region,
          city: geo.city,
          coordinates: {
            lat: geo.ll[0],
            lng: geo.ll[1],
          },
        };
      }
    } catch (error) {
      console.error('Error getting location from IP:', error);
    }
    return null;
  }

  /**
   * Generate default action based on route and method
   */
  generateDefaultAction(req) {
    if (!req || !req.method || !req.originalUrl) return 'unknown action';
    const method = req.method.toLowerCase();
    const path = req.originalUrl.split('?')[0]; // remove query params
    const resource = this.getResource(req) || 'unknown';
    const specialRoutes = [
      { pattern: '/login', action: 'user login' },
      { pattern: '/logout', action: 'user logout' },
      { pattern: '/register', action: 'user registration' },
      { pattern: '/reset-password', action: 'password reset' },
      { pattern: '/checkout', action: 'checkout initiated' },
      { pattern: '/apply-coupon', action: 'applied coupon' },
      { pattern: '/wishlist/clear', action: 'cleared wishlist' },
    ];
    for (const route of specialRoutes) {
      if (path.includes(route.pattern)) return route.action;
    }
    // CRUD mapping
    const crudActions = {
      get: 'viewed',
      post: 'created',
      put: 'updated',
      patch: 'updated',
      delete: 'deleted',
    };
    let action = crudActions[method] || method;
    const isSingle = method === 'get' && (path.match(/\/[0-9a-fA-F]{24}/) || path.match(/\/\d+/)); // Mongo ObjectId or numeric ID
    if (method === 'get') {
      action = isSingle ? `viewed ${resource}` : `browsed ${resource}`;
    } else {
      action = `${resource} ${action}`;
    }
    return action;
  }

  getResource(req) {
    if (typeof req.baseUrl !== 'string' || !req.baseUrl.startsWith('/api/')) return null;
    const parts = req.baseUrl.split('/').filter(Boolean);
    const index = parts[1] === 'v1' || parts[1] === 'v2' ? 2 : 1;
    return parts[index] || null;
  }
  /**
   * Categorize route based on path
   */
  categorizeRoute(path) {
    const lowerPath = path.toLowerCase();

    if (lowerPath.includes('/auth') || lowerPath.includes('/login') || lowerPath.includes('/register')) {
      return 'authentication';
    }
    if (lowerPath.includes('/profile') || lowerPath.includes('/user')) {
      return 'profile';
    }
    if (lowerPath.includes('/product')) {
      return 'product';
    }
    if (lowerPath.includes('/order')) {
      return 'order';
    }
    if (lowerPath.includes('/cart')) {
      return 'cart';
    }
    if (lowerPath.includes('/wishlist')) {
      return 'wishlist';
    }
    if (lowerPath.includes('/address')) {
      return 'address';
    }
    if (lowerPath.includes('/payment')) {
      return 'payment';
    }
    if (lowerPath.includes('/users')) {
      return 'user';
    }
    if (lowerPath.includes('/payment')) {
      return 'payment';
    }
    if (lowerPath.includes('/admin')) {
      return 'admin';
    }
    if (lowerPath.includes('/api')) {
      return 'api';
    }

    return 'other';
  }

  /**
   * Determine if route is sensitive
   */
  isSensitiveRoute(path) {
    const sensitivePaths = ['/password', '/reset', '/delete', '/admin', '/payment', '/order', '/sensitive'];

    return sensitivePaths.some((sensitive) => path.toLowerCase().includes(sensitive));
  }

  /**
   * Get priority level based on method and sensitivity
   */
  getPriority(method, isSensitive) {
    if (isSensitive || method === 'DELETE') {
      return 'high';
    }
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get device type from parsed user agent
   */
  getDeviceType(parsedUA) {
    const device = parsedUA.getDevice();
    if (device.type) {
      return device.type;
    }

    // Fallback detection
    const ua = parsedUA.getUA().toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return 'mobile';
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return 'tablet';
    }
    if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
      return 'bot';
    }

    return 'desktop';
  }

  /**
   * Process queued logs in batches
   */
  async processBatch() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      // Filter out logs without userId (optional - you might want to log anonymous actions too)
      const validLogs = batch.filter((log) => log.userId);

      if (validLogs.length > 0) {
        await UserActivityLog.insertMany(validLogs, { ordered: false });
        console.log(`Successfully logged ${validLogs.length} activities`);
      }

      // Log anonymous actions to a different collection or ignore
      const anonymousLogs = batch.filter((log) => !log.userId);
      if (anonymousLogs.length > 0) {
        console.log(`Skipped ${anonymousLogs.length} anonymous activities`);
        // Optionally: await AnonymousActivityLog.insertMany(anonymousLogs);
      }
    } catch (error) {
      console.error('Error processing activity log batch:', error);

      // Put failed logs back in queue for retry (optional)
      if (error.code !== 11000) {
        // Not duplicate key error
        this.queue.unshift(...batch);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start the batch processor interval
   */
  startBatchProcessor() {
    setInterval(() => {
      if (this.queue.length > 0 && !this.isProcessing) {
        this.processBatch();
      }
    }, this.flushInterval);
  }

  /**
   * Flush all remaining logs (call on app shutdown)
   */
  async flush() {
    while (this.queue.length > 0) {
      await this.processBatch();
      // Small delay to prevent overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Get activity statistics for a user
   */
  async getUserActivityStats(userId, days = 30) {
    return await UserActivityLog.getUserActivitySummary(userId, days);
  }

  /**
   * Get popular routes
   */
  async getPopularRoutes(days = 7, limit = 10) {
    return await UserActivityLog.getPopularRoutes(days, limit);
  }

  /**
   * Get security events
   */
  async getSecurityEvents(days = 7) {
    return await UserActivityLog.getSecurityEvents(days);
  }
}

// Export singleton instance
module.exports = new ActivityLogService();
