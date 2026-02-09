// controllers/notificationController.js
const notificationService = require('../services/NotificationService');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError, sendCreated, HTTP_STATUS, ERROR_CODES } = require('../utils/responseHelper');
const AppError = require('../utils/appError');
const { catchAsync } = require('../middleware/errorHandler');

class NotificationController {
  // Get all notifications for authenticated user
  getAll = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
      type: req.query.type,
      priority: req.query.priority,
      unreadOnly: req.query.unreadOnly === 'true',
    };

    const result = await notificationService.getAll(userId, options);

    return sendSuccess(res, {
      data: result,
      message: 'Notifications retrieved successfully',
    });
  });

  // Get single notification
  getSingle = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      _id: id,
      recipient: userId,
    }).populate('sender', 'username email avatar');

    if (!notification) {
      throw AppError.notFound('Notification not found');
    }

    return sendSuccess(res, {
      data: notification,
      message: 'Notification retrieved successfully',
    });
  });

  // Mark notification as read
  markAsRead = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await notificationService.markAsRead(id, userId);

    return sendSuccess(res, {
      data: notification,
      message: 'Notification marked as read',
    });
  });

  // Mark all notifications as read
  markAllAsRead = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const result = await notificationService.markAllAsRead(userId);

    return sendSuccess(res, {
      data: result,
      message: 'All notifications marked as read',
    });
  });

  // Delete notification
  remove = catchAsync(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    await notificationService.remove(id, userId);

    return sendSuccess(res, {
      message: 'Notification deleted successfully',
    });
  });

  // Get unread count
  getUnreadCount = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const count = await notificationService.getUnreadCount(userId);

    return sendSuccess(res, {
      data: { unreadCount: count },
      message: 'Unread count retrieved successfully',
    });
  });

  // Create notification (admin only)
  create = catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation errors', errors.array());
    }

    const notificationData = {
      ...req.body,
      sender: req.user.id,
    };

    const notification = await notificationService.create(notificationData);

    return sendCreated(res, {
      data: notification,
      message: 'Notification created successfully',
    });
  });

  // Bulk create notifications (admin only)
  createBulk = catchAsync(async (req, res) => {
    const { notifications } = req.body;

    if (!Array.isArray(notifications) || notifications.length === 0) {
      throw AppError.badRequest('Notifications array is required');
    }

    const notificationsWithSender = notifications.map((notification) => ({
      ...notification,
      sender: req.user.id,
    }));

    const createdNotifications = await notificationService.createBulk(notificationsWithSender);

    return sendCreated(res, {
      data: createdNotifications,
      message: `${createdNotifications.length} notifications created successfully`,
    });
  });
}

module.exports = new NotificationController();
