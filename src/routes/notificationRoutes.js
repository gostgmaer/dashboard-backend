// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controller/notificationController');
const { body } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Validation middleware
const createNotificationValidation = [
  body('recipient').isMongoId().withMessage('Valid recipient ID is required'),
  body('type').isIn([
    'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
    'ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_SHIPPED', 'ORDER_DELIVERED',
    'PAYMENT_SUCCESS', 'PAYMENT_FAILED',
    'PRODUCT_CREATED', 'PRODUCT_UPDATED',
    'ROLE_ASSIGNED', 'SYSTEM_ALERT', 'CUSTOM'
  ]).withMessage('Valid notification type is required'),
  body('title').optional().isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
  body('message').optional().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1-1000 characters'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority level'),
  body('channels').optional().isArray().withMessage('Channels must be an array')
];

// Routes
router.get('/', authMiddleware, notificationController.getAll);
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);
router.get('/:id', authMiddleware, notificationController.getSingle);
router.patch('/:id/read', authMiddleware, notificationController.markAsRead);
router.patch('/read-all', authMiddleware, notificationController.markAllAsRead);
router.delete('/:id', authMiddleware, notificationController.remove);

// // Admin routes
router.post('/', authMiddleware, authorize('notifications', 'write'), createNotificationValidation, notificationController.create);
router.post('/bulk', authMiddleware, authorize('notifications', 'write'), notificationController.createBulk);

module.exports  = { notificationRoute: router };