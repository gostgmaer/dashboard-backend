// utils/adminDashboard.js - Admin dashboard utilities
const UserActivityLog = require('../models/UserActivityLog');
const User = require('../models/user');

class AdminDashboard {
  /**
   * Get comprehensive dashboard statistics
   */
  static async getDashboardStats(days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const [
        totalActivities,
        activeUsers,
        topUsers,
        activityByCategory,
        activityByHour,
        errorStats,
        securityEvents,
        performanceStats
      ] = await Promise.all([
        // Total activities
        UserActivityLog.countDocuments({ timestamp: { $gte: startDate } }),

        // Active users count
        UserActivityLog.distinct('userId', { timestamp: { $gte: startDate } }),

        // Top 10 most active users
        UserActivityLog.aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          { $group: { _id: '$userId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: '$user' },
          {
            $project: {
              userId: '$_id',
              username: '$user.username',
              email: '$user.email',
              activityCount: '$count'
            }
          }
        ]),

        // Activity by category
        UserActivityLog.aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Activity by hour of day
        UserActivityLog.aggregate([
          { $match: { timestamp: { $gte: startDate } } },
          {
            $group: {
              _id: { $hour: '$timestamp' },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),

        // Error statistics
        UserActivityLog.aggregate([
          { 
            $match: { 
              timestamp: { $gte: startDate },
              statusCode: { $gte: 400 }
            }
          },
          {
            $group: {
              _id: {
                status: '$statusCode',
                route: '$route',
                method: '$method'
              },
              count: { $sum: 1 },
              users: { $addToSet: '$userId' }
            }
          },
          {
            $project: {
              status: '$_id.status',
              route: '$_id.route',
              method: '$_id.method',
              count: 1,
              affectedUsers: { $size: '$users' }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 20 }
        ]),

        // Security events
        UserActivityLog.countDocuments({
          timestamp: { $gte: startDate },
          $or: [
            { priority: { $in: ['high', 'critical'] } },
            { isSensitive: true }
          ]
        }),

        // Performance statistics
        UserActivityLog.aggregate([
          { 
            $match: { 
              timestamp: { $gte: startDate },
              responseTime: { $exists: true, $ne: null }
            }
          },
          {
            $group: {
              _id: null,
              avgResponseTime: { $avg: '$responseTime' },
              minResponseTime: { $min: '$responseTime' },
              maxResponseTime: { $max: '$responseTime' },
              slowRequests: {
                $sum: { $cond: [{ $gt: ['$responseTime', 5000] }, 1, 0] }
              }
            }
          }
        ])
      ]);

      return {
        overview: {
          totalActivities,
          activeUsersCount: activeUsers.length,
          securityEventsCount: securityEvents,
          averageResponseTime: performanceStats[0]?.avgResponseTime || 0,
          slowRequestsCount: performanceStats[0]?.slowRequests || 0,
        },
        topUsers,
        activityByCategory,
        activityByHour,
        errorStats,
        performanceStats: performanceStats[0] || {},
        timeRange: {
          startDate,
          endDate: new Date(),
          days
        }
      };
    } catch (error) {
      console.error('Error generating dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get real-time activity feed
   */
  static async getRecentActivities(limit = 50) {
    return await UserActivityLog.find()
      .populate('userId', 'username email')
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  /**
   * Get user activity timeline
   */
  static async getUserTimeline(userId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await UserActivityLog.find({
      userId,
      timestamp: { $gte: startDate }
    })
    .sort({ timestamp: -1 })
    .limit(1000);
  }

  /**
   * Get suspicious activity alerts
   */
  static async getSuspiciousActivities(days = 7) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return await UserActivityLog.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          $or: [
            { statusCode: { $gte: 400 } },
            { priority: 'critical' },
            { 'additionalData.suspiciousActivity': true },
            { action: /failed|error|unauthorized/i }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          timestamp: 1,
          action: 1,
          route: 1,
          method: 1,
          ip: 1,
          statusCode: 1,
          username: '$user.username',
          email: '$user.email',
          suspicionScore: {
            $add: [
              { $cond: [{ $gte: ['$statusCode', 500] }, 3, 0] },
              { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] },
              { $cond: [{ $eq: ['$priority', 'critical'] }, 2, 0] },
              { $cond: ['$additionalData.suspiciousActivity', 2, 0] }
            ]
          }
        }
      },
      { $sort: { suspicionScore: -1, timestamp: -1 } },
      { $limit: 100 }
    ]);
  }
}

module.exports = AdminDashboard;
