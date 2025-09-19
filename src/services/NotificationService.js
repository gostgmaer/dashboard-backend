// services/NotificationService.js
const Notification = require('../models/notification');

class NotificationService {
  static async notify(eventType, payload) {
    switch(eventType) {
      case 'USER_REGISTERED':
        return Notification.sendSystemNotification({
          title: 'Welcome!',
          message: `Hi ${payload.username}, thanks for registering.`,
          type: 'system',
          priority: 'low',
          recipients: [{ userId: payload.userId, userRole: payload.role }],
          template: { templateId: payload.templateId, variables: payload.templateVars }
        });
      case 'ORDER_SHIPPED':
        return Notification.sendSystemNotification({
          title: `Order #${payload.orderId} Shipped`,
          message: `Your order is on its way!`,
          type: 'order',
          priority: 'high',
          recipients: [{ userId: payload.userId, userRole: 'customer' }],
          relatedEntity: { entityType: 'order', entityId: payload.orderId },
          actions: [{ text: 'Track Order', url: payload.trackingUrl }]
        });
      case 'NEW_REVIEW':
        return Notification.broadcastToRoles(
          ['vendor','support'],
          {
            title: 'New Product Review',
            message: `${payload.username} left a review.`,
            type: 'review',
            priority: 'medium',
            recipients: [] // roles broadcast
          }
        );
      // Add more eventType cases as needed
      default:
        throw new Error(`No handler for event type ${eventType}`);
    }
  }
}

module.exports = NotificationService;
