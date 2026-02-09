/**
 * Notification Middleware - Main Entry Point
 * 
 * This module exports notification middleware functions organized by category.
 * The middleware is split into separate modules for better maintainability:
 * - userNotifications: User account operations (create, update, delete, profile)
 * - securityNotifications: Security events (login, logout, password, 2FA)
 * - orderNotifications: Order lifecycle events (created, shipped, delivered)
 * 
 * Each notification function is Express middleware that creates notifications
 * based on data in res.locals set by the route handler.
 * 
 * @module notificationMiddleware
 */

const UserNotifications = require('./userNotifications');
const OrderNotifications = require('./orderNotifications');
const SecurityNotifications = require('./securityNotifications');

/**
 * Export all notification middleware organized by category
 */
module.exports = {
    // User-related notifications
    ...userNotifications,

    // Order-related notifications
    ...orderNotifications,

    // Security-related notifications
    ...securityNotifications,
};
