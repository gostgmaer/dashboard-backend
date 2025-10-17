const express = require('express');
const router = express.Router();
const ActivityHelper = require('../utils/activityHelpers');
const activityLogService = require('../services/activityLogService');
const { authMiddleware } = require('../middleware/auth'); // Single auth middleware

// Get current user's activities
router.use(authMiddleware);

router.get('/my-activities', async (req, res) => {
  try {
    const { limit = 50, page, days = 30, category, priority, operation, action } = req.query;
    const query = { userId: req.user._id };

    // Optional filters
    if (operation) query.operation = operation.toLowerCase();
    if (action) query.action = { $regex: new RegExp(action, 'i') };
    const activities = await ActivityHelper.getUserActivities(req.user.id, {
      limit: parseInt(limit),
      days: parseInt(days),
      category,
      priority,
      query,
    });

    res.json({ success: true, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user activity analytics
router.get('/analytics', async (req, res) => {
  try {
    const { userId, days = 30 } = req.query;

    const analytics = await ActivityHelper.getAnalytics(userId || null, parseInt(days));

    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get popular routes
router.get('/popular-routes', async (req, res) => {
  try {
    const { days = 7, limit = 10 } = req.query;

    const routes = await activityLogService.getPopularRoutes(parseInt(days), parseInt(limit));

    res.json({ success: true, data: routes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get security events
router.get('/security-events', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const events = await activityLogService.getSecurityEvents(parseInt(days));

    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user activity summary
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const summary = await activityLogService.getUserActivityStats(userId, parseInt(days));

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export user activities
router.get('/export/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30, format = 'json' } = req.query;

    const UserActivityLog = require('../models/UserActivityLog');
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const query = { timestamp: { $gte: startDate } };
    if (userId) {
      query.userId = userId;
    }

    const activities = await UserActivityLog.find(query).populate('userId', 'username email').sort({ timestamp: -1 });

    if (format === 'csv') {
      const csv = ['Timestamp,User,Email,Action,Route,Method,IP,Status,Response Time', ...activities.map((activity) => [activity.timestamp.toISOString(), activity.userId?.username || 'Unknown', activity.userId?.email || 'Unknown', activity.action, activity.route, activity.method, activity.ip, activity.statusCode || 'N/A', activity.responseTime || 'N/A'].join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="activity-log-${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.json({ success: true, data: activities });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { userActivityroute: router };
