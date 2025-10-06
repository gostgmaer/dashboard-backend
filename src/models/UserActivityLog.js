// models/UserActivityLog.js
const mongoose = require('mongoose');

const userActivityLogSchema = new mongoose.Schema(
  {
    // Core fields
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Index for performance
    },

    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    route: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    method: {
      type: String,
      required: true,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      uppercase: true,
    },

    // Request details
    ip: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          // Basic IP validation (IPv4 and IPv6)
          const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          const ipv6 = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ipv4.test(v) || ipv6.test(v) || v === '::1' || v === 'localhost';
        },
        message: 'Invalid IP address format'
      }
    },

    userAgent: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    // Optional fields
    additionalData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      validate: {
        validator: function(v) {
          // Ensure additionalData is not too large (prevent MongoDB doc size issues)
          return !v || JSON.stringify(v).length <= 10000; // 10KB limit
        },
        message: 'Additional data exceeds maximum size limit'
      }
    },

    // Performance and analytics fields
    responseTime: {
      type: Number,
      min: 0,
      default: null, // in milliseconds
    },

    statusCode: {
      type: Number,
      min: 100,
      max: 599,
      default: null,
    },

    // Request size in bytes (optional)
    requestSize: {
      type: Number,
      min: 0,
      default: null,
    },

    // Response size in bytes (optional)
    responseSize: {
      type: Number,
      min: 0,
      default: null,
    },

    // Error details (if any)
    error: {
      message: {
        type: String,
        maxlength: 500,
        default: null,
      },
      stack: {
        type: String,
        maxlength: 2000,
        default: null,
      },
    },

    // Security and tracking
    sessionId: {
      type: String,
      default: null,
      maxlength: 100,
    },

    deviceId: {
      type: String,
      default: null,
      maxlength: 100,
    },

    // Location data (if available)
    location: {
      country: {
        type: String,
        default: null,
        maxlength: 100,
      },
      region: {
        type: String,
        default: null,
        maxlength: 100,
      },
      city: {
        type: String,
        default: null,
        maxlength: 100,
      },
      coordinates: {
        lat: {
          type: Number,
          min: -90,
          max: 90,
          default: null,
        },
        lng: {
          type: Number,
          min: -180,
          max: 180,
          default: null,
        },
      },
    },

    // Browser and device info (parsed from userAgent)
    browser: {
      name: {
        type: String,
        default: null,
        maxlength: 50,
      },
      version: {
        type: String,
        default: null,
        maxlength: 20,
      },
    },

    os: {
      name: {
        type: String,
        default: null,
        maxlength: 50,
      },
      version: {
        type: String,
        default: null,
        maxlength: 20,
      },
    },

    device: {
      type: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet', 'bot', 'unknown'],
        default: 'unknown',
      },
      vendor: {
        type: String,
        default: null,
        maxlength: 50,
      },
      model: {
        type: String,
        default: null,
        maxlength: 50,
      },
    },

    // Activity categorization
    category: {
      type: String,
      enum: [
        'authentication', 
        'profile', 
        'product', 
        'order', 
        'cart', 
        'wishlist', 
        'address', 
        'payment', 
        'admin',
        'api',
        'other'
      ],
      default: 'other',
    },

    // Priority level for the action
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },

    // Whether this is a sensitive operation
    isSensitive: {
      type: Boolean,
      default: false,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      // index: true, // Index for performance when querying by time
    },
  },
  {
    timestamps: false, // We're using custom timestamp field
    collection: 'user_activity_logs',

    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes for efficient querying
userActivityLogSchema.index({ userId: 1, timestamp: -1 }); // User activities by time
userActivityLogSchema.index({ userId: 1, category: 1, timestamp: -1 }); // User activities by category
userActivityLogSchema.index({ method: 1, route: 1 }); // Route analytics
// userActivityLogSchema.index({ timestamp: -1 }); // Recent activities
userActivityLogSchema.index({ priority: 1, timestamp: -1 }); // High priority activities
userActivityLogSchema.index({ isSensitive: 1, timestamp: -1 }); // Sensitive operations

// TTL index to automatically delete old logs (optional - 90 days)
userActivityLogSchema.index(
  { timestamp: 1 }, 
  { 
    expireAfterSeconds: 90 * 24 * 60 * 60 // 90 days
  }
);

// Static methods for analytics and reporting
userActivityLogSchema.statics = {
  // Get user activity summary
  async getUserActivitySummary(userId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const pipeline = [
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            category: "$category"
          },
          count: { $sum: 1 },
          methods: { $addToSet: "$method" },
          avgResponseTime: { $avg: "$responseTime" }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          categories: {
            $push: {
              category: "$_id.category",
              count: "$count",
              methods: "$methods",
              avgResponseTime: "$avgResponseTime"
            }
          },
          totalActions: { $sum: "$count" }
        }
      },
      { $sort: { _id: -1 } }
    ];

    return await this.aggregate(pipeline);
  },

  // Get most accessed routes
  async getPopularRoutes(days = 7, limit = 10) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await this.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: { route: "$route", method: "$method" },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: "$userId" },
          avgResponseTime: { $avg: "$responseTime" }
        }
      },
      {
        $project: {
          route: "$_id.route",
          method: "$_id.method",
          count: 1,
          uniqueUsers: { $size: "$uniqueUsers" },
          avgResponseTime: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
  },

  // Get security events (high priority activities)
  async getSecurityEvents(days = 7) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await this.find({
      timestamp: { $gte: startDate },
      $or: [
        { priority: { $in: ['high', 'critical'] } },
        { isSensitive: true },
        { category: 'authentication' }
      ]
    })
    .populate('userId', 'username email')
    .sort({ timestamp: -1 })
    .limit(100);
  }
};

// Instance methods
userActivityLogSchema.methods = {
  // Check if this activity is suspicious
  isSuspicious() {
    // Define suspicious patterns
    const suspiciousPatterns = [
      // Multiple failed login attempts
      this.action.includes('failed') && this.category === 'authentication',
      // Access to sensitive routes
      this.isSensitive && this.method === 'DELETE',
      // Unusual response times
      this.responseTime && this.responseTime > 10000, // > 10 seconds
      // Error responses
      this.statusCode && this.statusCode >= 400,
    ];

    return suspiciousPatterns.some(pattern => pattern);
  }
};

// Pre-save middleware
userActivityLogSchema.pre('save', function(next) {
  // Auto-categorize based on route if not set
  if (this.category === 'other') {
    if (this.route.includes('/auth')) {
      this.category = 'authentication';
    } else if (this.route.includes('/profile') || this.route.includes('/user')) {
      this.category = 'profile';
    } else if (this.route.includes('/product')) {
      this.category = 'product';
    } else if (this.route.includes('/order')) {
      this.category = 'order';
    } else if (this.route.includes('/cart')) {
      this.category = 'cart';
    } else if (this.route.includes('/wishlist')) {
      this.category = 'wishlist';
    } else if (this.route.includes('/address')) {
      this.category = 'address';
    } else if (this.route.includes('/payment')) {
      this.category = 'payment';
    } else if (this.route.includes('/admin')) {
      this.category = 'admin';
    } else if (this.route.includes('/api')) {
      this.category = 'api';
    }
  }

  // Auto-set priority based on method and sensitivity
  if (this.priority === 'low') {
    if (this.method === 'DELETE' || this.isSensitive) {
      this.priority = 'high';
    } else if (this.method === 'POST' || this.method === 'PUT' || this.method === 'PATCH') {
      this.priority = 'medium';
    }
  }

  next();
});

module.exports = mongoose.model('UserActivityLog', userActivityLogSchema);
