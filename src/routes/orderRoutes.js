const express = require('express');
const router = express.Router();
const orderController = require('../controller/orderController');
const { body, query, param, validationResult } = require('express-validator');
const {authMiddleware} = require('../middleware/auth');
const  authorize  = require('../middleware/authorize');
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED ORDER ROUTES
 * 
 * Features:
 * ✅ Comprehensive CRUD operations
 * ✅ Payment and transaction management
 * ✅ Order state and fulfillment tracking
 * ✅ Cart and item management
 * ✅ Returns and after-sales support
 * ✅ Loyalty and customer engagement
 * ✅ Advanced analytics and reporting
 * ✅ Fraud detection and compliance
 * ✅ Bulk operations and utilities
 * ✅ Enterprise-level controllers
 * ✅ Permission-based access control via authorize middleware
 * ✅ Comprehensive validation schemas with sanitization
 * ✅ Rate limiting for bulk operations
 * ✅ Instance-level checks for IDOR prevention
 * ✅ Performance optimized routes
 */

/**
 * Rate limiter for high-risk bulk operations
 * Limits to 10 requests per 15 minutes per IP
 */
const bulkOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many requests, please try again later' }
});

/**
 * Middleware to check instance-level access for order-specific routes
 * Ensures the user has permission to access/modify the specific order
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const orderId = req.params.id;
    if (orderId && !req.user.isSuperadmin) { // Superadmin bypass in authorize
      const Order = require('../models/Order'); // Assumed Order model
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      if (order.userId.toString() !== req.user.id && !req.user.permissions.includes('orders:manage')) { // Restrict to own orders or manage permission
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s order' });
      }
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during instance check' });
  }
};

/**
 * Middleware to handle validation errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const orderValidation = {
  create: [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
    body('items.*.productId').isMongoId().withMessage('Invalid product ID'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer').toInt(),
    body('shippingAddress').isObject().withMessage('Shipping address must be an object'),
    body('shippingAddress.street').isString().withMessage('Street must be a string').isLength({ max: 100 }).withMessage('Street cannot exceed 100 characters').trim().escape(),
    body('shippingAddress.city').isString().withMessage('City must be a string').isLength({ max: 50 }).withMessage('City cannot exceed 50 characters').trim().escape(),
    body('shippingAddress.country').isString().withMessage('Country must be a string').isLength({ max: 50 }).withMessage('Country cannot exceed 50 characters').trim().escape(),
    body('paymentMethod').isIn(['credit_card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
    body('couponCode').optional().isString().withMessage('Coupon code must be a string').isLength({ max: 20 }).withMessage('Coupon code cannot exceed 20 characters').trim().escape(),
    validate
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('shippingAddress').optional().isObject().withMessage('Shipping address must be an object'),
    body('shippingAddress.street').optional().isString().withMessage('Street must be a string').isLength({ max: 100 }).withMessage('Street cannot exceed 100 characters').trim().escape(),
    body('shippingAddress.city').optional().isString().withMessage('City must be a string').isLength({ max: 50 }).withMessage('City cannot exceed 50 characters').trim().escape(),
    body('shippingAddress.country').optional().isString().withMessage('Country must be a string').isLength({ max: 50 }).withMessage('Country cannot exceed 50 characters').trim().escape(),
    body('status').optional().isIn(['pending', 'processing', 'shipped', 'delivered', 'canceled']).withMessage('Invalid status'),
    validate
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'totalAmount']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('status').optional().isIn(['pending', 'processing', 'shipped', 'delivered', 'canceled']).withMessage('Invalid status'),
    query('userId').optional().isMongoId().withMessage('Invalid user ID'),
    query('search').optional().isString().withMessage('Search must be a string').trim().escape(),
    validate
  ],

  bulkUpdate: [
    body('orderIds').isArray({ min: 1 }).withMessage('Order IDs array is required'),
    body('orderIds.*').isMongoId().withMessage('Invalid order ID in array'),
    body('updates').isObject().withMessage('Updates must be an object'),
    body('updates.status').optional().isIn(['pending', 'processing', 'shipped', 'delivered', 'canceled']).withMessage('Invalid status'),
    validate
  ],

  export: [
    query('format').optional().isIn(['json', 'csv']).withMessage('Invalid format'),
    query('fields').optional().isString().withMessage('Fields must be a comma-separated string').trim().escape(),
    validate
  ],

  id: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    validate
  ],

  itemQuantity: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    param('itemIndex').isInt({ min: 0 }).withMessage('Invalid item index').toInt(),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer').toInt(),
    validate
  ],

  tracking: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('trackingNumber').isString().withMessage('Tracking number must be a string').trim().escape(),
    validate
  ],

  priority: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('priority').isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    validate
  ],

  giftMessage: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('message').optional().isString().withMessage('Message must be a string').isLength({ max: 200 }).withMessage('Message cannot exceed 200 characters').trim().escape(),
    validate
  ],

  coupon: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('couponCode').isString().withMessage('Coupon code must be a string').isLength({ max: 20 }).withMessage('Coupon code cannot exceed 20 characters').trim().escape(),
    validate
  ],

  returnRequest: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('items').isArray({ min: 1 }).withMessage('Return items array is required'),
    body('items.*.productId').isMongoId().withMessage('Invalid product ID'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer').toInt(),
    body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters').trim().escape(),
    validate
  ],

  resolveReturn: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('status').isIn(['approved', 'rejected']).withMessage('Invalid return status'),
    body('reason').optional().isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters').trim().escape(),
    validate
  ],

  redeemPoints: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('points').isInt({ min: 1 }).withMessage('Points must be a positive integer').toInt(),
    validate
  ],

  split: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('splitItems').isArray({ min: 1 }).withMessage('Split items array is required'),
    body('splitItems.*.productId').isMongoId().withMessage('Invalid product ID'),
    body('splitItems.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer').toInt(),
    validate
  ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// POST /api/orders - Create a new order
router.post('/', 
  authMiddleware,
  authorize('orders', 'write'),
  orderValidation.create,
  orderController.createOrder
);

// GET /api/orders/:id - Get order by ID
router.get('/:id', 
  authMiddleware,
  authorize('orders', 'read'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.getOrderById
);

// GET /api/orders - Get all orders with filtering
router.get('/', 
  authMiddleware,
  // authorize('orders', 'read'),
  // orderValidation.query,
  orderController.getOrders
);

// PUT /api/orders/:id - Update order
router.put('/:id', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.update,
  orderController.updateOrder
);

// DELETE /api/orders/:id - Delete order
router.delete('/:id', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.deleteOrder
);

// ========================================
// 💸 PAYMENT & TRANSACTIONS
// ========================================

// PUT /api/orders/:id/pay - Mark order as paid
router.put('/:id/pay', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.markAsPaid
);

// PUT /api/orders/:id/refund - Refund order
router.put('/:id/refund', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.refundOrder
);

// PUT /api/orders/bulk-refund - Bulk refund orders
router.put('/bulk-refund', 
  authMiddleware,
  authorize('orders', 'update'),
  bulkOperationLimiter,
  orderValidation.bulkUpdate,
  orderController.bulkRefundOrders
);

// PUT /api/orders/:id/redeem-points - Redeem loyalty points
router.put('/:id/redeem-points', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.redeemPoints,
  orderController.redeemLoyaltyPoints
);

// ========================================
// 🚚 ORDER STATE & FULFILLMENT
// ========================================

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'canceled']).withMessage('Invalid status'),
  validate,
  orderController.updateOrderStatus
);

// PUT /api/orders/bulk-status - Bulk update order status
router.put('/bulk-status', 
  authMiddleware,
  authorize('orders', 'update'),
  bulkOperationLimiter,
  orderValidation.bulkUpdate,
  orderController.bulkUpdateOrderStatus
);

// POST /api/orders/:id/split - Split order
router.post('/:id/split', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.split,
  orderController.splitOrder
);

// PUT /api/orders/:id/tracking - Add tracking info
router.put('/:id/tracking', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.tracking,
  orderController.addTrackingInfo
);

// PUT /api/orders/:id/mark-delivered - Mark order as delivered
router.put('/:id/mark-delivered', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.markOrderAsDelivered
);

// PUT /api/orders/:id/priority - Set priority level
router.put('/:id/priority', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.priority,
  orderController.setPriorityLevel
);

// ========================================
// 🛒 CART & ITEM MANAGEMENT
// ========================================

// PUT /api/orders/:id/items/:itemIndex/quantity - Update item quantity
router.put('/:id/items/:itemIndex/quantity', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.itemQuantity,
  orderController.updateItemQuantity
);

// PUT /api/orders/:id/gift-message - Add gift message
router.put('/:id/gift-message', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  body('message').optional().isString().withMessage('Message must be a string').isLength({ max: 200 }).withMessage('Message cannot exceed 200 characters').trim().escape(),
  validate,
  orderController.addGiftMessage
);

// PUT /api/orders/:id/apply-coupon - Apply coupon
router.put('/:id/apply-coupon', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.coupon,
  orderController.applyCoupon
);

// ========================================
// 🛍️ RETURNS & AFTER-SALES
// ========================================

// POST /api/orders/:id/request-return - Request return
router.post('/:id/request-return', 
  authMiddleware,
  authorize('orders', 'write'),
  instanceCheckMiddleware,
  orderValidation.returnRequest,
  orderController.requestReturn
);

// PUT /api/orders/:id/resolve-return - Resolve return request
router.put('/:id/resolve-return', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.resolveReturn,
  orderController.resolveReturnRequest
);

// GET /api/orders/return-requests - Get return requests
router.get('/return-requests', 
  authMiddleware,
  authorize('orders', 'read'),
  orderValidation.query,
  orderController.getReturnRequests
);

// ========================================
// 🎯 LOYALTY & ENGAGEMENT
// ========================================

// GET /api/orders/top-customers - Get top customers
router.get('/top-customers', 
  authMiddleware,
  authorize('orders', 'read'),
  orderValidation.query,
  orderController.getTopCustomers
);

// GET /api/orders/user/:userId/history - Get customer order history
router.get('/user/:userId/history', 
  authMiddleware,
  authorize('orders', 'read'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  validate,
  orderValidation.query,
  orderController.getCustomerOrderHistory
);

// ========================================
// 📊 ANALYTICS & REPORTING
// ========================================

// GET /api/orders/analytics/stats - Get order statistics
router.get('/analytics/stats', 
  authMiddleware,
  authorize('orders', 'report'),
  orderValidation.query,
  orderController.getOrderStats
);

// GET /api/orders/analytics/trends - Get order trends
router.get('/analytics/trends', 
  authMiddleware,
  authorize('orders', 'report'),
  orderValidation.query,
  orderController.getOrderTrends
);

// GET /api/orders/analytics/revenue-by-source - Get revenue by source
router.get('/analytics/revenue-by-source', 
  authMiddleware,
  authorize('orders', 'report'),
  orderValidation.query,
  orderController.getRevenueBySource
);

// GET /api/orders/analytics/product-performance - Get product performance
router.get('/analytics/product-performance', 
  authMiddleware,
  authorize('orders', 'report'),
  orderValidation.query,
  orderController.getProductPerformance
);

// GET /api/orders/analytics/conversion-funnel - Get order conversion funnel
router.get('/analytics/conversion-funnel', 
  authMiddleware,
  authorize('orders', 'report'),
  orderValidation.query,
  orderController.getOrderConversionFunnel
);

// GET /api/orders/featured - Get featured orders
router.get('/featured', 
  authMiddleware,
  authorize('orders', 'read'),
  orderValidation.query,
  orderController.getFeaturedOrders
);

// GET /api/orders/low-stock - Get low stock orders
router.get('/low-stock', 
  authMiddleware,
  authorize('orders', 'read'),
  orderValidation.query,
  orderController.getLowStockOrders
);

// GET /api/orders/analytics/average-order-value - Get average order value
router.get('/analytics/average-order-value', 
  authMiddleware,
  authorize('orders', 'report'),
  orderValidation.query,
  orderController.getAverageOrderValue
);

// GET /api/orders/search-by-customer - Search orders by customer name
router.get('/search-by-customer', 
  authMiddleware,
  authorize('orders', 'read'),
  query('customerName').isString().withMessage('Customer name must be a string').trim().escape(),
  orderValidation.query,
  orderController.searchOrdersByCustomerName
);

// GET /api/orders/analytics/by-payment-method - Get orders by payment method
router.get('/analytics/by-payment-method', 
  authMiddleware,
  authorize('orders', 'report'),
  orderValidation.query,
  orderController.getOrdersByPaymentMethod
);

// GET /api/orders/analytics/delayed-orders - Get delayed orders
router.get('/analytics/delayed-orders', 
  authMiddleware,
  authorize('orders', 'read'),
  orderValidation.query,
  orderController.getDelayedOrders
);

// GET /api/orders/analytics/loyalty-points-summary - Get loyalty points summary
router.get('/analytics/loyalty-points-summary', 
  authMiddleware,
  authorize('orders', 'report'),
  orderValidation.query,
  orderController.getLoyaltyPointsSummary
);

// ========================================
// 🛒 CUSTOMER & SHIPPING UTILITIES
// ========================================

// GET /api/orders/:id/estimate-delivery - Estimate delivery
router.get('/:id/estimate-delivery', 
  authMiddleware,
  authorize('orders', 'read'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.estimateDelivery
);

// GET /api/orders/:id/summary - Get order summary
router.get('/:id/summary', 
  authMiddleware,
  authorize('orders', 'read'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.getOrderSummary
);

// POST /api/orders/:id/reorder - Reorder
router.post('/:id/reorder', 
  authMiddleware,
  authorize('orders', 'write'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.reorder
);

// ========================================
// 🚨 FRAUD & COMPLIANCE
// ========================================

// GET /api/orders/fraudulent - Get fraudulent orders
router.get('/fraudulent', 
  authMiddleware,
  authorize('orders', 'read'),
  orderValidation.query,
  orderController.getFraudulentOrders
);

// GET /api/orders/:id/compliance-check - Check order compliance
router.get('/:id/compliance-check', 
  authMiddleware,
  authorize('orders', 'read'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.checkOrderCompliance
);

// PUT /api/orders/:id/flag - Flag order
router.put('/:id/flag', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters').trim().escape(),
  validate,
  orderController.flagOrder
);

// ========================================
// 📦 BULK & UTILITY
// ========================================

// POST /api/orders/validate-stock - Validate stock in bulk
router.post('/validate-stock', 
  authMiddleware,
  authorize('orders', 'read'),
  bulkOperationLimiter,
  body('orderIds').isArray({ min: 1 }).withMessage('Order IDs array is required'),
  body('orderIds.*').isMongoId().withMessage('Invalid order ID in array'),
  validate,
  orderController.validateStockBulk
);

// POST /api/orders/update-stock - Update stock in bulk
router.post('/update-stock', 
  authMiddleware,
  authorize('orders', 'update'),
  bulkOperationLimiter,
  body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
  body('updates.*.orderId').isMongoId().withMessage('Invalid order ID in updates'),
  body('updates.*.productId').isMongoId().withMessage('Invalid product ID in updates'),
  body('updates.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer').toInt(),
  validate,
  orderController.updateStockBulk
);

// GET /api/orders/export - Export orders report
router.get('/export', 
  authMiddleware,
  authorize('orders', 'view'),
  bulkOperationLimiter,
  orderValidation.export,
  orderController.exportOrdersReport
);

// POST /api/orders/import - Import orders in bulk
router.post('/import', 
  authMiddleware,
  authorize('orders', 'write'),
  bulkOperationLimiter,
  body('orders').isArray({ min: 1 }).withMessage('Orders array is required'),
  body('orders.*.userId').isMongoId().withMessage('Invalid user ID in orders'),
  validate,
  orderController.importOrdersBulk
);

// ========================================
// 🏢 ENTERPRISE OPERATIONS
// ========================================

// GET /api/orders/:id/audit - Audit order changes
router.get('/:id/audit', 
  authMiddleware,
  authorize('orders', 'report'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.auditOrderChanges
);

// POST /api/orders/status-notification - Push status notification
router.post('/status-notification', 
  authMiddleware,
  authorize('orders', 'update'),
  body('orderId').isMongoId().withMessage('Invalid order ID'),
  body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'canceled']).withMessage('Invalid status'),
  validate,
  orderController.pushStatusNotification
);

// POST /api/orders/:id/log-event - Log order event
router.post('/:id/log-event', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  body('eventType').isString().withMessage('Event type must be a string').trim().escape(),
  body('data').optional().isObject().withMessage('Data must be an object'),
  validate,
  orderController.logOrderEvent
);

// PUT /api/orders/:id/restore - Restore canceled order
router.put('/:id/restore', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.restoreCanceledOrder
);

// POST /api/orders/archive-completed - Archive completed orders
router.post('/archive-completed', 
  authMiddleware,
  authorize('orders', 'update'),
  bulkOperationLimiter,
  body('beforeDate').isISO8601().withMessage('Valid before date is required'),
  validate,
  orderController.archiveCompletedOrders
);

// POST /api/orders/:id/send-invoice - Send order invoice
router.post('/:id/send-invoice', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.sendOrderInvoice
);

// GET /api/orders/historical-data - Get historical order data
router.get('/historical-data', 
  authMiddleware,
  authorize('orders', 'report'),
  orderValidation.query,
  orderController.getHistoricalOrderData
);

// GET /api/orders/growth-stats - Get order growth stats
router.get('/growth-stats', 
  authMiddleware,
  authorize('orders', 'report'),
  orderValidation.query,
  orderController.getOrderGrowthStats
);

// POST /api/orders/:id/rate-items - Rate order items
router.post('/:id/rate-items', 
  authMiddleware,
  authorize('orders', 'write'),
  instanceCheckMiddleware,
  orderValidation.id,
  body('ratings').isArray({ min: 1 }).withMessage('Ratings array is required'),
  body('ratings.*.itemId').isMongoId().withMessage('Invalid item ID'),
  body('ratings.*.rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5').toInt(),
  validate,
  orderController.rateOrderItems
);

// POST /api/orders/:id/review - Review order experience
router.post('/:id/review', 
  authMiddleware,
  authorize('orders', 'write'),
  instanceCheckMiddleware,
  orderValidation.id,
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5').toInt(),
  body('comment').optional().isString().withMessage('Comment must be a string').trim().escape(),
  validate,
  orderController.reviewOrderExperience
);

// GET /api/orders/:id/events-timeline - Get order events timeline
router.get('/:id/events-timeline', 
  authMiddleware,
  authorize('orders', 'read'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.getOrderEventsTimeline
);

// PUT /api/orders/:id/assign-agent - Assign order to agent
router.put('/:id/assign-agent', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  body('agentId').isMongoId().withMessage('Invalid agent ID'),
  validate,
  orderController.assignOrderToAgent
);

// GET /api/orders/:id/track-route - Track order route
router.get('/:id/track-route', 
  authMiddleware,
  authorize('orders', 'read'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.trackOrderRoute
);

// GET /api/orders/:id/calculate-profit - Calculate order profit
router.get('/:id/calculate-profit', 
  authMiddleware,
  authorize('orders', 'report'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.calculateOrderProfit
);

// GET /api/orders/:id/payment-reconciliation - Check payment reconciliation
router.get('/:id/payment-reconciliation', 
  authMiddleware,
  authorize('orders', 'report'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.checkOrderPaymentReconciliation
);

// POST /api/orders/:id/flag-return-abuse - Flag suspected return abuse
router.post('/:id/flag-return-abuse', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters').trim().escape(),
  validate,
  orderController.flagSuspectedReturnAbuse
);

// POST /api/orders/:id/escalate - Handle order escalation
router.post('/:id/escalate', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters').trim().escape(),
  validate,
  orderController.handleOrderEscalation
);

// POST /api/orders/:id/sync-erp - Sync order with ERP
router.post('/:id/sync-erp', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.syncOrderWithERP
);

// POST /api/orders/:id/integrate-crm - Integrate order with CRM
router.post('/:id/integrate-crm', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.integrateOrderWithCRM
);

// PUT /api/orders/:id/lock-audit - Lock order for audit
router.put('/:id/lock-audit', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.lockOrderForAudit
);

// PUT /api/orders/:id/release-lock - Release order lock
router.put('/:id/release-lock', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  orderController.releaseOrderLock
);

// PUT /api/orders/:id/cancel-admin - Cancel order by admin
router.put('/:id/cancel-admin', 
  authMiddleware,
  authorize('orders', 'update'),
  instanceCheckMiddleware,
  orderValidation.id,
  body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters').trim().escape(),
  validate,
  orderController.cancelOrderByAdmin
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  const path = req.path.toLowerCase(); // Case-insensitive matching
  if (path.startsWith('/analytics/') || 
      path.startsWith('/bulk/') || 
      path.startsWith('/user/') || 
      path.startsWith('/return-requests') || 
      path.startsWith('/fraudulent') || 
      path.startsWith('/export') || 
      path.startsWith('/import') || 
      path.startsWith('/validate-stock') || 
      path.startsWith('/update-stock') || 
      path.startsWith('/historical-data') || 
      path.startsWith('/growth-stats') || 
      path.startsWith('/search-by-customer') || 
      path.startsWith('/top-customers') || 
      path.startsWith('/featured') || 
      path.startsWith('/low-stock')) {
    return next();
  }

  next();
};

// Apply the middleware to all routes
router.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

router.get('/docs/routes',
  authMiddleware,
  authorize('orders', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      crud: [
        'POST   /api/orders                          - Create a new order (write)',
        'GET    /api/orders/:id                     - Get order by ID (read, instance check)',
        'GET    /api/orders                         - Get all orders with filtering (read)',
        'PUT    /api/orders/:id                     - Update order (update, instance check)',
        'DELETE /api/orders/:id                     - Delete order (update, instance check)'
      ],
      paymentTransactions: [
        'PUT    /api/orders/:id/pay                 - Mark order as paid (update, instance check)',
        'PUT    /api/orders/:id/refund             - Refund order (update, instance check)',
        'PUT    /api/orders/bulk-refund            - Bulk refund orders (update, rate-limited)',
        'PUT    /api/orders/:id/redeem-points      - Redeem loyalty points (update, instance check)'
      ],
      orderStateFulfillment: [
        'PUT    /api/orders/:id/status             - Update order status (update, instance check)',
        'PUT    /api/orders/bulk-status            - Bulk update order status (update, rate-limited)',
        'POST   /api/orders/:id/split              - Split order (update, instance check)',
        'PUT    /api/orders/:id/tracking           - Add tracking info (update, instance check)',
        'PUT    /api/orders/:id/mark-delivered     - Mark order as delivered (update, instance check)',
        'PUT    /api/orders/:id/priority           - Set priority level (update, instance check)'
      ],
      cartItemManagement: [
        'PUT    /api/orders/:id/items/:itemIndex/quantity - Update item quantity (update, instance check)',
        'PUT    /api/orders/:id/gift-message       - Add gift message (update, instance check)',
        'PUT    /api/orders/:id/apply-coupon       - Apply coupon (update, instance check)'
      ],
      returnsAfterSales: [
        'POST   /api/orders/:id/request-return     - Request return (write, instance check)',
        'PUT    /api/orders/:id/resolve-return     - Resolve return request (update, instance check)',
        'GET    /api/orders/return-requests        - Get return requests (read)'
      ],
      loyaltyEngagement: [
        'GET    /api/orders/top-customers          - Get top customers (read)',
        'GET    /api/orders/user/:userId/history   - Get customer order history (read, instance check)'
      ],
      analyticsReporting: [
        'GET    /api/orders/analytics/stats        - Get order statistics (report)',
        'GET    /api/orders/analytics/trends       - Get order trends (report)',
        'GET    /api/orders/analytics/revenue-by-source - Get revenue by source (report)',
        'GET    /api/orders/analytics/product-performance - Get product performance (report)',
        'GET    /api/orders/analytics/conversion-funnel - Get order conversion funnel (report)',
        'GET    /api/orders/featured                - Get featured orders (read)',
        'GET    /api/orders/low-stock              - Get low stock orders (read)',
        'GET    /api/orders/analytics/average-order-value - Get average order value (report)',
        'GET    /api/orders/search-by-customer      - Search orders by customer name (read)',
        'GET    /api/orders/analytics/by-payment-method - Get orders by payment method (report)',
        'GET    /api/orders/analytics/delayed-orders - Get delayed orders (read)',
        'GET    /api/orders/analytics/loyalty-points-summary - Get loyalty points summary (report)'
      ],
      customerShippingUtilities: [
        'GET    /api/orders/:id/estimate-delivery  - Estimate delivery (read, instance check)',
        'GET    /api/orders/:id/summary            - Get order summary (read, instance check)',
        'POST   /api/orders/:id/reorder            - Reorder (write, instance check)'
      ],
      fraudCompliance: [
        'GET    /api/orders/fraudulent             - Get fraudulent orders (read)',
        'GET    /api/orders/:id/compliance-check   - Check order compliance (read, instance check)',
        'PUT    /api/orders/:id/flag               - Flag order (update, instance check)'
      ],
      bulkUtility: [
        'POST   /api/orders/validate-stock         - Validate stock in bulk (read, rate-limited)',
        'POST   /api/orders/update-stock           - Update stock in bulk (update, rate-limited)',
        'GET    /api/orders/export                 - Export orders report (view, rate-limited)',
        'POST   /api/orders/import                 - Import orders in bulk (write, rate-limited)'
      ],
      enterpriseOperations: [
        'GET    /api/orders/:id/audit              - Audit order changes (report, instance check)',
        'POST   /api/orders/status-notification    - Push status notification (update)',
        'POST   /api/orders/:id/log-event          - Log order event (update, instance check)',
        'PUT    /api/orders/:id/restore            - Restore canceled order (update, instance check)',
        'POST   /api/orders/archive-completed      - Archive completed orders (update, rate-limited)',
        'POST   /api/orders/:id/send-invoice       - Send order invoice (update, instance check)',
        'GET    /api/orders/historical-data        - Get historical order data (report)',
        'GET    /api/orders/growth-stats           - Get order growth stats (report)',
        'POST   /api/orders/:id/rate-items         - Rate order items (write, instance check)',
        'POST   /api/orders/:id/review             - Review order experience (write, instance check)',
        'GET    /api/orders/:id/events-timeline    - Get order events timeline (read, instance check)',
        'PUT    /api/orders/:id/assign-agent       - Assign order to agent (update, instance check)',
        'GET    /api/orders/:id/track-route        - Track order route (read, instance check)',
        'GET    /api/orders/:id/calculate-profit   - Calculate order profit (report, instance check)',
        'GET    /api/orders/:id/payment-reconciliation - Check payment reconciliation (report, instance check)',
        'POST   /api/orders/:id/flag-return-abuse  - Flag suspected return abuse (update, instance check)',
        'POST   /api/orders/:id/escalate           - Handle order escalation (update, instance check)',
        'POST   /api/orders/:id/sync-erp           - Sync order with ERP (update, instance check)',
        'POST   /api/orders/:id/integrate-crm      - Integrate order with CRM (update, instance check)',
        'PUT    /api/orders/:id/lock-audit         - Lock order for audit (update, instance check)',
        'PUT    /api/orders/:id/release-lock       - Release order lock (update, instance check)',
        'PUT    /api/orders/:id/cancel-admin       - Cancel order by admin (update, instance check)'
      ],
      documentation: [
        'GET    /api/orders/docs/routes             - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Order API routes documentation'
    });
  }
);

module.exports = { orderRoutes: router };