// utils/activityHelpers.js
const activityLogService = require('../services/activityLogService');

/**
 * Helper function for manual activity logging in controllers
 */
class ActivityHelper {
  /**
   * Log a custom activity
   * @param {Object} req - Express request object
   * @param {string} action - Action description
   * @param {Object} additionalData - Additional data to log
   * @param {Object} options - Additional options
   */
  static async logActivity(req, action, additionalData = null, options = {}) {
    if (!req.user || !req.user.id) {
      console.warn('Attempted to log activity for unauthenticated user');
      return;
    }

    // Create a mock response object for data extraction
    const mockRes = {
      statusCode: options.statusCode || 200,
    };

    const activityData = activityLogService.extractActivityData(req, mockRes, {
      action,
      additionalData,
      ...options,
    });

    await activityLogService.logActivity(activityData);
  }

  /**
   * Log authentication events
   */
  static async logAuth(req, action, result = 'success', additionalData = {}) {
    const baseData = {
      action: `${action} - ${result}`,
      additionalData: {
        result,
        timestamp: new Date(),
        ...additionalData,
      },
      category: 'authentication',
      priority: result === 'failed' ? 'high' : 'medium',
      isSensitive: true,
    };

    if (result === 'failed') {
      baseData.additionalData.securityAlert = true;
    }

    await this.logActivity(req, baseData.action, baseData.additionalData, {
      category: baseData.category,
      priority: baseData.priority,
      isSensitive: baseData.isSensitive,
    });
  }

  /**
   * Log CRUD operations with entity details
   */
  static async logCRUD(req, entity, operation, entityData = {}) {
    const actions = {
      create: 'created',
      read: 'viewed',
      update: 'updated',
      delete: 'deleted',
    };

    const priorities = {
      delete: 'high',
      create: 'medium',
      update: 'medium',
      read: 'low',
    };

    await this.logActivity(
      req,
      `${actions[operation]} ${entity}`,
      {
        entity,
        operation,
        entityId: entityData.id || entityData._id,
        entityData: entityData,
      },
      {
        priority: priorities[operation],
        isSensitive: operation === 'delete',
      }
    );
  }

  /**
   * Log sensitive operations
   */
  static async logSensitive(req, action, details = {}) {
    await this.logActivity(
      req,
      action,
      {
        sensitive: true,
        timestamp: new Date(),
        ...details,
      },
      {
        priority: 'high',
        isSensitive: true,
      }
    );
  }

  /**
   * Log payment operations
   */
  static async logPayment(req, action, paymentData = {}) {
    await this.logActivity(
      req,
      `payment: ${action}`,
      {
        amount: paymentData.amount,
        currency: paymentData.currency,
        paymentMethod: paymentData.method,
        orderId: paymentData.orderId,
        transactionId: paymentData.transactionId,
        status: paymentData.status,
      },
      {
        category: 'payment',
        priority: 'high',
        isSensitive: true,
      }
    );
  }

  /**
   * Log admin operations
   */
  static async logAdmin(req, action, targetData = {}) {
    await this.logActivity(
      req,
      `admin: ${action}`,
      {
        adminAction: true,
        targetUser: targetData.userId,
        targetEntity: targetData.entity,
        changes: targetData.changes,
      },
      {
        category: 'admin',
        priority: 'critical',
        isSensitive: true,
      }
    );
  }

  /**
   * Bulk log multiple activities (for batch operations)
   */
  static async logBatch(req, activities) {
    const promises = activities.map(activity => 
      this.logActivity(
        req,
        activity.action,
        activity.additionalData,
        activity.options
      )
    );

    await Promise.allSettled(promises);
  }

  /**
   * Get user's recent activities
   */
  static async getUserActivities(userId, options = {}) {
    const {
      limit = 50,
      days = 30,
      category = null,
      priority = null,
    } = options;

    const query = { userId };

    if (days) {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      query.timestamp = { $gte: startDate };
    }

    if (category) {
      query.category = category;
    }

    if (priority) {
      query.priority = priority;
    }

    const UserActivityLog = require('../models/UserActivityLog');
    return await UserActivityLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('userId', 'username email');
  }

  /**
   * Get activity analytics
   */
  static async getAnalytics(userId = null, days = 30) {
    const UserActivityLog = require('../models/UserActivityLog');
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const matchStage = { timestamp: { $gte: startDate } };
    if (userId) {
      matchStage.userId = userId;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            category: "$category",
            method: "$method"
          },
          count: { $sum: 1 },
          avgResponseTime: { $avg: "$responseTime" },
          errors: {
            $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] }
          }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          categories: {
            $push: {
              category: "$_id.category",
              method: "$_id.method",
              count: "$count",
              avgResponseTime: "$avgResponseTime",
              errors: "$errors"
            }
          },
          totalRequests: { $sum: "$count" },
          totalErrors: { $sum: "$errors" }
        }
      },
      { $sort: { _id: -1 } }
    ];

    return await UserActivityLog.aggregate(pipeline);
  }
}

module.exports = ActivityHelper;
