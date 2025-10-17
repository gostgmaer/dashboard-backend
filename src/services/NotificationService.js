// services/notificationService.js
const Notification = require('../models/notification');
const socketService = require('./socketService');
const emailService = require('./emailService');

class NotificationService {
  constructor() {
    this.templates = {
      USER_CREATED: {
        title: 'Welcome to our platform!',
        message: 'Your account has been successfully created.',
        priority: 'MEDIUM',
      },
      USER_UPDATED: {
        title: 'Profile Updated',
        message: 'Your profile information has been updated successfully.',
        priority: 'LOW',
      },
      ORDER_CREATED: {
        title: 'Order Placed',
        message: 'Your order #{orderId} has been placed successfully.',
        priority: 'HIGH',
      },
      ORDER_SHIPPED: {
        title: 'Order Shipped',
        message: 'Your order #{orderId} has been shipped.',
        priority: 'HIGH',
      },
      PAYMENT_SUCCESS: {
        title: 'Payment Successful',
        message: 'Your payment of ${amount} has been processed successfully.',
        priority: 'HIGH',
      },
      ROLE_ASSIGNED: {
        title: 'New Role Assigned',
        message: 'You have been assigned the role: {roleName}',
        priority: 'MEDIUM',
      },
    };
  }

  // Create notification
  async create(notificationData) {
    try {
      const { recipient, sender, type, title, message, data = {}, priority = 'MEDIUM', channels = ['IN_APP'], scheduledFor, metadata = {}, template } = notificationData;
      const notification = new Notification({
        recipient,
        sender,
        type,
        title: title,
        message: message,
        data,
        priority: priority,
        channels,
        scheduledFor: scheduledFor || new Date(),
        metadata,
      });

      await notification.save();
      await notification.populate('sender', 'username email avatar');

      // Send real-time notification if scheduled for now
      if (!scheduledFor || scheduledFor <= new Date()) {
        await this.deliver(notification, template);
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Process template with data
  processTemplate(template, data) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  // Deliver notification through various channels
  async deliver(notification) {
    try {
      const channels = notification.channels;

      // In-app notification via Socket.IO
      if (channels.includes('IN_APP')) {
        socketService.sendToUser(notification.recipient, 'new_notification', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          data: notification.data,
          createdAt: notification.createdAt,
          sender: notification.sender,
          metadata: notification.metadata,
        });
      }

      // Email notification
      if (channels.includes('EMAIL')) {
        await emailService.sendNotification(notification);
      }

      // Mark as delivered
      notification.deliveredAt = new Date();
      await notification.save();

      return true;
    } catch (error) {
      console.error('Error delivering notification:', error);
      throw error;
    }
  }

  // Get notifications for user
  async getAll(userId, options = {}) {
    try {
      const { page = 1, limit = 20, status, type, priority, unreadOnly = false } = options;

      const query = { recipient: userId };

      if (status) query.status = status;
      if (type) query.type = type;
      if (priority) query.priority = priority;
      if (unreadOnly) query.status = 'UNREAD';

      const notifications = await Notification.find(query)
        .populate('sender', 'username email avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await Notification.countDocuments(query);
      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        status: 'UNREAD',
      });

      return {
        notifications,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalCount: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        unreadCount,
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        {
          status: 'read',
          readAt: new Date(),
        },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notification not found');
      }

      // Send real-time update
      socketService.sendToUser(userId, 'notification_updated', {
        id: notification._id,
        status: 'read',
        readAt: notification.readAt,
      });

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for user
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { recipient: userId, status: 'UNREAD' },
        {
          status: 'read',
          readAt: new Date(),
        }
      );

      // Send real-time update
      socketService.sendToUser(userId, 'all_notifications_read', {
        updatedCount: result.modifiedCount,
      });

      return result;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete notification
  async remove(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId,
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      // Send real-time update
      socketService.sendToUser(userId, 'notification_deleted', {
        id: notificationId,
      });

      return notification;
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Get unread count for user
  async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({
        recipient: userId,
        status: 'UNREAD',
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  // Bulk operations
  async createBulk(notifications) {
    try {
      const createdNotifications = await Notification.insertMany(notifications);

      // Send real-time notifications
      for (const notification of createdNotifications) {
        await this.deliver(notification);
      }

      return createdNotifications;
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      throw error;
    }
  }

  // Clean old notifications
  async cleanup(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        status: { $in: ['read', 'ARCHIVED'] },
      });

      console.log(`Cleaned up ${result.deletedCount} old notifications`);
      return result;
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
