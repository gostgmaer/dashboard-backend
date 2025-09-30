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
                queuedAt: Date.now()
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
        const userAgent = req.get('User-Agent') || 'unknown';
        const ip = this.getClientIP(req);
        const parsedUA = new UAParser(userAgent);
        const location = this.getLocationFromIP(ip);

        return {
            userId: req.user?.id || req.user?._id || null,
            action: options.action || this.generateDefaultAction(req),
            route: req.route ? req.route.path : req.path,
            method: req.method,
            ip: ip,
            userAgent: userAgent,
            additionalData: options.additionalData || null,

            // Performance metrics
            responseTime: options.responseTime || null,
            statusCode: res.statusCode,
            requestSize: req.get('Content-Length') ? parseInt(req.get('Content-Length')) : null,

            // Session and device info
            sessionId: req.sessionID || req.session?.id || null,
            deviceId: req.deviceId || req.headers['x-device-id'] || null,

            // Parsed browser/device info
            browser: {
                name: parsedUA.getBrowser().name || null,
                version: parsedUA.getBrowser().version || null,
            },
            os: {
                name: parsedUA.getOS().name || null,
                version: parsedUA.getOS().version || null,
            },
            device: {
                type: this.getDeviceType(parsedUA),
                vendor: parsedUA.getDevice().vendor || null,
                model: parsedUA.getDevice().model || null,
            },

            // Location (if available)
            location: location,

            // Auto-categorization
            category: options.category || this.categorizeRoute(req.path),
            priority: options.priority || this.getPriority(req.method, options.isSensitive),
            isSensitive: options.isSensitive || this.isSensitiveRoute(req.path),
        };
    }

    /**
     * Get client IP address from request
     */
    getClientIP(req) {
        return req.ip ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
            req.headers['x-forwarded-for']?.split(',')[0] ||
            req.headers['x-real-ip'] ||
            '127.0.0.1';
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
        const method = req.method.toLowerCase();
        const path = req.path.toLowerCase();

        // Authentication routes
        if (path.includes('/login')) return 'user login';
        if (path.includes('/logout')) return 'user logout';
        if (path.includes('/register')) return 'user registration';
        if (path.includes('/reset-password')) return 'password reset';

        // Profile routes
        if (path.includes('/profile')) {
            switch (method) {
                case 'get': return 'viewed profile';
                case 'put':
                case 'patch': return 'updated profile';
                case 'delete': return 'deleted profile';
                default: return 'profile action';
            }
        }

        // Product routes
        if (path.includes('/product')) {
            switch (method) {
                case 'get': return path.includes('/:id') ? 'viewed product' : 'browsed products';
                case 'post': return 'created product';
                case 'put':
                case 'patch': return 'updated product';
                case 'delete': return 'deleted product';
                default: return 'product action';
            }
        }

        // Order routes
        if (path.includes('/order')) {
            switch (method) {
                case 'get': return path.includes('/:id') ? 'viewed order' : 'browsed orders';
                case 'post': return 'created order';
                case 'put':
                case 'patch': return 'updated order';
                case 'delete': return 'cancelled order';
                default: return 'order action';
            }
        }

        // Cart routes
        if (path.includes('/cart')) {
            switch (method) {
                case 'get': return 'viewed cart';
                case 'post': return 'added to cart';
                case 'put':
                case 'patch': return 'updated cart';
                case 'delete': return 'removed from cart';
                default: return 'cart action';
            }
        }

        // Wishlist routes
        if (path.includes('/wishlist')) {
            switch (method) {
                case 'get': return 'viewed wishlist';
                case 'post': return 'added to wishlist';
                case 'delete': return 'removed from wishlist';
                default: return 'wishlist action';
            }
        }

        // Default action
        return `${method} ${path}`;
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
        } if (lowerPath.includes('/payment')) {
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
        const sensitivePaths = [
            '/password',
            '/reset',
            '/delete',
            '/admin',
            '/payment',
            '/order',
            '/sensitive'
        ];

        return sensitivePaths.some(sensitive =>
            path.toLowerCase().includes(sensitive)
        );
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
            const validLogs = batch.filter(log => log.userId);

            if (validLogs.length > 0) {
                await UserActivityLog.insertMany(validLogs, { ordered: false });
                console.log(`Successfully logged ${validLogs.length} activities`);
            }

            // Log anonymous actions to a different collection or ignore
            const anonymousLogs = batch.filter(log => !log.userId);
            if (anonymousLogs.length > 0) {
                console.log(`Skipped ${anonymousLogs.length} anonymous activities`);
                // Optionally: await AnonymousActivityLog.insertMany(anonymousLogs);
            }

        } catch (error) {
            console.error('Error processing activity log batch:', error);

            // Put failed logs back in queue for retry (optional)
            if (error.code !== 11000) { // Not duplicate key error
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
            await new Promise(resolve => setTimeout(resolve, 100));
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
