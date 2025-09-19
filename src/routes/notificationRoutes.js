// routes/notificationRoutes.js

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Create
router.post('/notifications', notificationController.create);
router.post('/notifications/bulk', notificationController.createBulk);

// Read (list)
router.get('/notifications', notificationController.getAll);
router.get('/notifications/search', notificationController.search);
router.get('/notifications/trending', notificationController.getTrending);
router.get('/notifications/analytics/summary', notificationController.getAnalyticsSummary);
router.get('/notifications/daily-count', notificationController.dailyNotificationCount);

// Read by user
router.get('/users/:userId/notifications', notificationController.getForUser);
router.get('/users/:userId/notifications/unread-count', notificationController.getUnreadCount);
router.post('/users/:userId/notifications/mark-read', notificationController.markAsReadForUser);
router.get('/users/:userId/notifications/recent-summary', notificationController.getRecentSummaryByUser);

// Read by entity
router.get('/notifications/entity/:entityType/:entityId', notificationController.findByEntity);

// Broadcast & system
router.post('/notifications/broadcast', notificationController.broadcastToRoles);
router.post('/notifications/system', notificationController.sendSystemNotification);

// Update delivery status
router.post('/notifications/delivery-status', notificationController.updateDeliveryStatus);

// Retry & cleanup
router.post('/notifications/retry-failures', notificationController.retryFailedDeliveries);
router.post('/notifications/cleanup-expired', notificationController.cleanupExpired);
router.post('/notifications/archive-old', notificationController.archiveOld);
router.post('/notifications/bulk-archive', notificationController.bulkArchive);
router.post('/notifications/purge-archived', notificationController.purgeOldArchived);

// Bulk operations
router.post('/notifications/bulk-update-status', notificationController.bulkUpdateStatus);

// Analytics grouping
router.get('/notifications/count-by-type-status', notificationController.countGroupedByTypeAndStatus);

// Filters by tags
router.get('/notifications/by-tags', notificationController.findByTags);

module.exports = router;
