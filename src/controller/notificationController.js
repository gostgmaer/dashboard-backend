// controllers/notificationController.js
const notificationService = require('../services/NotificationService');
const { validationResult } = require('express-validator');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../utils/apiUtils');
class NotificationController {
  // Get all notifications for authenticated user
  async getAll(req, res) {
    try {
      const userId = req.user.id;
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        status: req.query.status,
        type: req.query.type,
        priority: req.query.priority,
        unreadOnly: req.query.unreadOnly === 'true'
      };

      const result = await notificationService.getAll(userId, options);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching notifications',
        error: error.message
      });
    }
  }

  // Get single notification
  async getSingle(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOne({
        _id: id,
        recipient: userId
      }).populate('sender', 'username email avatar');

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(200).json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error('Error fetching notification:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching notification',
        error: error.message
      });
    }
  }

  // Mark notification as read
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await notificationService.markAsRead(id, userId);
      
      res.status(200).json({
        success: true,
        data: notification,
        message: 'Notification marked as read'
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error marking notification as read'
      });
    }
  }

  // Mark all notifications as read
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      const result = await notificationService.markAllAsRead(userId);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking all notifications as read',
        error: error.message
      });
    }
  }

  // Delete notification
  async remove(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await notificationService.remove(id, userId);
      
      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error deleting notification'
      });
    }
  }

  // Get unread count
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      const count = await notificationService.getUnreadCount(userId);
      
      res.status(200).json({
        success: true,
        data: { unreadCount: count }
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting unread count',
        error: error.message
      });
    }
  }

  // Create notification (admin only)
  async create(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const notificationData = {
        ...req.body,
        sender: req.user.id
      };

      const notification = await notificationService.create(notificationData);
      
      res.status(201).json({
        success: true,
        data: notification,
        message: 'Notification created successfully'
      });
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating notification',
        error: error.message
      });
    }
  }

  // Bulk create notifications (admin only)
  async createBulk(req, res) {
    try {
      const { notifications } = req.body;
      
      if (!Array.isArray(notifications) || notifications.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Notifications array is required'
        });
      }

      const notificationsWithSender = notifications.map(notification => ({
        ...notification,
        sender: req.user.id
      }));

      const createdNotifications = await notificationService.createBulk(notificationsWithSender);
      
      res.status(201).json({
        success: true,
        data: createdNotifications,
        message: `${createdNotifications.length} notifications created successfully`
      });
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating bulk notifications',
        error: error.message
      });
    }
  }
}

module.exports = new NotificationController();
