/**
 * Order-Related Notification Middleware
 * Placeholder for order notifications - will be populated based on existing code
 */

const notificationService = require('../../services/NotificationService');
const LoggerService = require('../../services/logger');

class OrderNotifications {
    static async onOrderCreated(req, res, next) {
        try {
            const order = res.locals.order;
            const user = res.locals.user;

            if (order && user) {
                await notificationService.create({
                    recipient: user._id,
                    type: 'ORDER_CREATED',
                    title: 'Order Placed',
                    message: `Your order #${order.orderNumber || order._id} has been placed successfully.`,
                    data: { orderId: order._id, orderNumber: order.orderNumber, total: order.total },
                    channels: ['IN_APP', 'EMAIL'],
                    priority: 'HIGH',
                    metadata: { category: 'order', relatedResource: order._id, resourceModel: 'Order' },
                });
            }
        } catch (error) {
            LoggerService.error('Error creating order notification:', { error });
        }
        next();
    }

    static async onOrderStatusUpdate(req, res, next) {
        try {
            const order = res.locals.order;
            const user = res.locals.user;

            if (order && user) {
                await notificationService.create({
                    recipient: user._id,
                    type: 'ORDER_STATUS_UPDATED',
                    title: 'Order Status Updated',
                    message: `Your order #${order.orderNumber || order._id} status has been updated to ${order.status}.`,
                    data: { orderId: order._id, orderNumber: order.orderNumber, status: order.status },
                    channels: ['IN_APP', 'EMAIL'],
                    priority: 'MEDIUM',
                    metadata: { category: 'order', relatedResource: order._id, resourceModel: 'Order' },
                });
            }
        } catch (error) {
            LoggerService.error('Error creating order status notification:', { error });
        }
        next();
    }

    static async onOrderShipped(req, res, next) {
        try {
            const order = res.locals.order;
            const user = res.locals.user;

            if (order && user) {
                await notificationService.create({
                    recipient: user._id,
                    type: 'ORDER_SHIPPED',
                    title: 'Order Shipped',
                    message: `Your order #${order.orderNumber || order._id} has been shipped.`,
                    data: {
                        orderId: order._id,
                        orderNumber: order.orderNumber,
                        trackingNumber: res.locals.trackingNumber,
                        carrier: res.locals.carrier,
                    },
                    channels: ['IN_APP', 'EMAIL'],
                    priority: 'HIGH',
                    metadata: { category: 'order', relatedResource: order._id, resourceModel: 'Order' },
                });
            }
        } catch (error) {
            LoggerService.error('Error creating order shipped notification:', { error });
        }
        next();
    }

    static async onOrderDelivered(req, res, next) {
        try {
            const order = res.locals.order;
            const user = res.locals.user;

            if (order && user) {
                await notificationService.create({
                    recipient: user._id,
                    type: 'ORDER_DELIVERED',
                    title: 'Order Delivered',
                    message: `Your order #${order.orderNumber || order._id} has been delivered.`,
                    data: { orderId: order._id, orderNumber: order.orderNumber, deliveredAt: new Date() },
                    channels: ['IN_APP', 'EMAIL'],
                    priority: 'MEDIUM',
                    metadata: { category: 'order', relatedResource: order._id, resourceModel: 'Order' },
                });
            }
        } catch (error) {
            LoggerService.error('Error creating order delivered notification:', { error });
        }
        next();
    }

    static async onOrderCancelled(req, res, next) {
        try {
            const order = res.locals.order;
            const user = res.locals.user;

            if (order && user) {
                await notificationService.create({
                    recipient: user._id,
                    type: 'ORDER_CANCELLED',
                    title: 'Order Cancelled',
                    message: `Your order #${order.orderNumber || order._id} has been cancelled.`,
                    data: {
                        orderId: order._id,
                        orderNumber: order.orderNumber,
                        cancelReason: res.locals.cancelReason,
                        refundAmount: res.locals.refundAmount,
                    },
                    channels: ['IN_APP', 'EMAIL'],
                    priority: 'HIGH',
                    metadata: { category: 'order', relatedResource: order._id, resourceModel: 'Order' },
                });
            }
        } catch (error) {
            LoggerService.error('Error creating order cancelled notification:', { error });
        }
        next();
    }
}

module.exports = OrderNotifications;
