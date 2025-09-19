const Notification = require('../models/notification');
const mongoose = require('mongoose');

module.exports = {
  // Create a single notification
  create: async (req, res, next) => {
    try {
      const data = req.body;
      // Optionally set current user for auditing
      Notification.setCurrentUser(req.user?.id);
      const notification = new Notification(data);
      await notification.save();
      res.status(201).json(notification);
    } catch (err) {
      next(err);
    }
  },

  // Bulk create notifications
  createBulk: async (req, res, next) => {
    try {
      Notification.setCurrentUser(req.user?.id);
      const notifications = req.body.notifications;
      const saved = await Notification.createBulk(notifications);
      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  },

  // Get all notifications with advanced filters
  getAll: async (req, res, next) => {
    try {
      const { filter, pagination, sorting, selectFields, populateFields, excludeReadByUser, useCursor, cursor } = req.query;
      const result = await Notification.getAll({
        filter: JSON.parse(filter || '{}'),
        pagination: JSON.parse(pagination || '{}'),
        sorting: JSON.parse(sorting || '{}'),
        selectFields: selectFields ? selectFields.split(',').join(' ') : null,
        populateFields: populateFields ? JSON.parse(populateFields) : [],
        excludeReadByUser: excludeReadByUser || null,
        useCursor: useCursor === 'true',
        cursor: cursor || null
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // Get notifications for one user
  getForUser: async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const options = req.query;
      const notifications = await Notification.findForUser(userId, options);
      res.json(notifications);
    } catch (err) {
      next(err);
    }
  },

  // Search notifications (simple wrapper)
  search: async (req, res, next) => {
    try {
      const { term, userId, type, priority, limit, skip } = req.query;
      const results = await Notification.search(term, { userId, type, priority, limit, skip });
      res.json(results);
    } catch (err) {
      next(err);
    }
  },

  // Get trending notifications
  getTrending: async (req, res, next) => {
    try {
      const { timeframe, limit } = req.query;
      const trending = await Notification.getTrending(timeframe, Number(limit) || 10);
      res.json(trending);
    } catch (err) {
      next(err);
    }
  },

  // Analytics summary
  getAnalyticsSummary: async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      const summary = await Notification.getAnalyticsSummary({ startDate, endDate });
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },

  // Get unread count for a user
  getUnreadCount: async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const count = await Notification.getUnreadCount(userId);
      res.json({ count });
    } catch (err) {
      next(err);
    }
  },

  // Mark notifications as read (bulk or all)
  markAsReadForUser: async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const { notificationIds } = req.body;
      const result = await Notification.markAsReadForUser(userId, notificationIds);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // Retry failed deliveries
  retryFailedDeliveries: async (req, res, next) => {
    try {
      const { maxRetries } = req.query;
      const results = await Notification.retryFailedDeliveries(Number(maxRetries) || 3);
      res.json(results);
    } catch (err) {
      next(err);
    }
  },

  // Cleanup expired & old notifications
  cleanupExpired: async (req, res, next) => {
    try {
      const result = await Notification.cleanupExpired();
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  archiveOld: async (req, res, next) => {
    try {
      const { days } = req.query;
      const result = await Notification.archiveOld(Number(days) || 90);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // Find by entity
  findByEntity: async (req, res, next) => {
    try {
      const { entityType, entityId } = req.params;
      const notifications = await Notification.findByEntity(entityType, mongoose.Types.ObjectId(entityId));
      res.json(notifications);
    } catch (err) {
      next(err);
    }
  },

  // Broadcast to roles
  broadcastToRoles: async (req, res, next) => {
    try {
      const { roles, data } = req.body;
      const notification = await Notification.broadcastToRoles(roles, data);
      res.status(201).json(notification);
    } catch (err) {
      next(err);
    }
  },

  // Send system notification
  sendSystemNotification: async (req, res, next) => {
    try {
      const data = req.body;
      const notification = await Notification.sendSystemNotification(data);
      res.status(201).json(notification);
    } catch (err) {
      next(err);
    }
  },

  // Update delivery status atomic
  updateDeliveryStatus: async (req, res, next) => {
    try {
      const { notificationId, channel, status, error, externalId } = req.body;
      const result = await Notification.updateDeliveryStatus(notificationId, channel, status, { error, externalId });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  // Bulk archive, purge, tag find, counts
  bulkArchive: async (req, res, next) => {
    try {
      const { ids } = req.body;
      const result = await Notification.bulkArchive(ids);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  purgeOldArchived: async (req, res, next) => {
    try {
      const { days } = req.query;
      const result = await Notification.purgeOldArchived(Number(days) || 365);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  countGroupedByTypeAndStatus: async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      const result = await Notification.countGroupedByTypeAndStatus({ startDate, endDate });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  findPendingRetryFailures: async (req, res, next) => {
    try {
      const { hours } = req.query;
      const result = await Notification.findPendingRetryFailures(Number(hours) || 24);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  bulkUpdateStatus: async (req, res, next) => {
    try {
      const { ids, status } = req.body;
      const result = await Notification.bulkUpdateStatus(ids, status);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  getRecentSummaryByUser: async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const { days } = req.query;
      const result = await Notification.getRecentSummaryByUser(userId, Number(days) || 30);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  findByTags: async (req, res, next) => {
    try {
      const { tags, limit, skip } = req.query;
      const notifications = await Notification.findByTags(tags, { limit: Number(limit), skip: Number(skip) });
      res.json(notifications);
    } catch (err) {
      next(err);
    }
  },

  dailyNotificationCount: async (req, res, next) => {
    try {
      const { days } = req.query;
      const report = await Notification.dailyNotificationCount(Number(days) || 30);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }
};
