const express = require('express');
const router = express.Router();
const orderController = require('../controller/orderController');
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
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
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const orderValidation = {
  create: [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
    body('items.*.productId').isMongoId().withMessage('Invalid product ID'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('shippingAddress').isObject().withMessage('Shipping address must be an object'),
    body('shippingAddress.street').isString().withMessage('Street must be a string').isLength({ max: 100 }).withMessage('Street cannot exceed 100 characters'),
    body('shippingAddress.city').isString().withMessage('City must be a string').isLength({ max: 50 }).withMessage('City cannot exceed 50 characters'),
    body('shippingAddress.country').isString().withMessage('Country must be a string').isLength({ max: 50 }).withMessage('Country cannot exceed 50 characters'),
    body('paymentMethod').isIn(['credit_card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
    body('couponCode').optional().isString().withMessage('Coupon code must be a string').isLength({ max: 20 }).withMessage('Coupon code cannot exceed 20 characters')
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('shippingAddress').optional().isObject().withMessage('Shipping address must be an object'),
    body('shippingAddress.street').optional().isString().withMessage('Street must be a string').isLength({ max: 100 }).withMessage('Street cannot exceed 100 characters'),
    body('shippingAddress.city').optional().isString().withMessage('City must be a string').isLength({ max: 50 }).withMessage('City cannot exceed 50 characters'),
    body('shippingAddress.country').optional().isString().withMessage('Country must be a string').isLength({ max: 50 }).withMessage('Country cannot exceed 50 characters'),
    body('status').optional().isIn(['pending', 'processing', 'shipped', 'delivered', 'canceled']).withMessage('Invalid status')
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'totalAmount']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('status').optional().isIn(['pending', 'processing', 'shipped', 'delivered', 'canceled']).withMessage('Invalid status'),
    query('userId').optional().isMongoId().withMessage('Invalid user ID'),
    query('search').optional().isString().withMessage('Search must be a string')
  ],

  bulkUpdate: [
    body('orderIds').isArray({ min: 1 }).withMessage('Order IDs array is required'),
    body('orderIds.*').isMongoId().withMessage('Invalid order ID in array'),
    body('updates').isObject().withMessage('Updates must be an object'),
    body('updates.status').optional().isIn(['pending', 'processing', 'shipped', 'delivered', 'canceled']).withMessage('Invalid status')
  ],

  export: [
    query('format').optional().isIn(['json', 'csv']).withMessage('Invalid format'),
    query('fields').optional().isString().withMessage('Fields must be a comma-separated string')
  ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// POST /api/orders - Create a new order
router.post('/', 
  authMiddleware,
  orderValidation.create,
  orderController.createOrder
);

// GET /api/orders/:id - Get order by ID
router.get('/:id', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.getOrderById
);

// GET /api/orders - Get all orders with filtering
router.get('/', 
  authMiddleware,
  orderValidation.query,
  orderController.getOrders
);

// PUT /api/orders/:id - Update order
router.put('/:id', 
  authMiddleware,
  orderValidation.update,
  orderController.updateOrder
);

// DELETE /api/orders/:id - Delete order
router.delete('/:id', 
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.deleteOrder
);

// ========================================
// 💸 PAYMENT & TRANSACTIONS
// ========================================

// PUT /api/orders/:id/pay - Mark order as paid
router.put('/:id/pay', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.markAsPaid
);

// PUT /api/orders/:id/refund - Refund order
router.put('/:id/refund', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.refundOrder
);

// PUT /api/orders/bulk-refund - Bulk refund orders
router.put('/bulk-refund', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.bulkUpdate,
  orderController.bulkRefundOrders
);

// PUT /api/orders/:id/redeem-points - Redeem loyalty points
router.put('/:id/redeem-points', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('points').isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  orderController.redeemLoyaltyPoints
);

// ========================================
// 🚚 ORDER STATE & FULFILLMENT
// ========================================

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'canceled']).withMessage('Invalid status'),
  orderController.updateOrderStatus
);

// PUT /api/orders/bulk-status - Bulk update order status
router.put('/bulk-status', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.bulkUpdate,
  orderController.bulkUpdateOrderStatus
);

// POST /api/orders/:id/split - Split order
router.post('/:id/split', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('splitItems').isArray({ min: 1 }).withMessage('Split items array is required'),
  orderController.splitOrder
);

// PUT /api/orders/:id/tracking - Add tracking info
router.put('/:id/tracking', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('trackingNumber').isString().withMessage('Tracking number must be a string'),
  orderController.addTrackingInfo
);

// PUT /api/orders/:id/mark-delivered - Mark order as delivered
router.put('/:id/mark-delivered', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.markOrderAsDelivered
);

// PUT /api/orders/:id/priority - Set priority level
router.put('/:id/priority', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('priority').isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
  orderController.setPriorityLevel
);

// ========================================
// 🛒 CART & ITEM MANAGEMENT
// ========================================

// PUT /api/orders/:id/items/:itemIndex/quantity - Update item quantity
router.put('/:id/items/:itemIndex/quantity', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  param('itemIndex').isInt({ min: 0 }).withMessage('Invalid item index'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  orderController.updateItemQuantity
);

// PUT /api/orders/:id/gift-message - Add gift message
router.put('/:id/gift-message', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('message').isString().isLength({ max: 500 }).withMessage('Gift message cannot exceed 500 characters'),
  orderController.addGiftMessage
);

// PUT /api/orders/:id/apply-coupon - Apply coupon
router.put('/:id/apply-coupon', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('couponCode').isString().withMessage('Coupon code must be a string').isLength({ max: 20 }).withMessage('Coupon code cannot exceed 20 characters'),
  orderController.applyCoupon
);

// ========================================
// 🔄 RETURNS & AFTER-SALES
// ========================================

// POST /api/orders/:id/request-return - Request return
router.post('/:id/request-return', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  orderController.requestReturn
);

// PUT /api/orders/:id/resolve-return - Resolve return request
router.put('/:id/resolve-return', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('status').isIn(['approved', 'rejected']).withMessage('Invalid return status'),
  orderController.resolveReturnRequest
);

// GET /api/orders/return-requests - Get return requests
router.get('/return-requests', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getReturnRequests
);

// ========================================
// 🎯 LOYALTY & ENGAGEMENT
// ========================================

// GET /api/orders/top-customers - Get top customers
router.get('/top-customers', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  orderController.getTopCustomers
);

// GET /api/orders/user/:userId/history - Get customer order history
router.get('/user/:userId/history', 
  authMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  orderValidation.query,
  orderController.getCustomerOrderHistory
);

// ========================================
// 📊 ANALYTICS & REPORTING
// ========================================

// GET /api/orders/analytics/stats - Get order statistics
router.get('/analytics/stats', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getOrderStats
);

// GET /api/orders/analytics/trends - Get order trends
router.get('/analytics/trends', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getOrderTrends
);

// GET /api/orders/analytics/revenue-by-source - Get revenue by source
router.get('/analytics/revenue-by-source', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getRevenueBySource
);

// GET /api/orders/analytics/product-performance - Get product performance
router.get('/analytics/product-performance', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getProductPerformance
);

// GET /api/orders/analytics/conversion-funnel - Get order conversion funnel
router.get('/analytics/conversion-funnel', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getOrderConversionFunnel
);

// GET /api/orders/featured - Get featured orders
router.get('/featured', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getFeaturedOrders
);

// GET /api/orders/low-stock - Get low stock orders
router.get('/low-stock', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getLowStockOrders
);

// GET /api/orders/analytics/average-order-value - Get average order value
router.get('/analytics/average-order-value', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getAverageOrderValue
);

// GET /api/orders/search-by-customer - Search orders by customer name
router.get('/search-by-customer', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  query('name').isString().withMessage('Name must be a string'),
  orderValidation.query,
  orderController.searchOrdersByCustomerName
);

// GET /api/orders/analytics/by-payment-method - Get orders by payment method
router.get('/analytics/by-payment-method', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getOrdersByPaymentMethod
);

// GET /api/orders/analytics/delayed-orders - Get delayed orders
router.get('/analytics/delayed-orders', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getDelayedOrders
);

// GET /api/orders/analytics/loyalty-points-summary - Get loyalty points summary
router.get('/analytics/loyalty-points-summary', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getLoyaltyPointsSummary
);

// ========================================
// 📬 CUSTOMER & SHIPPING UTILITIES
// ========================================

// GET /api/orders/:id/estimate-delivery - Estimate delivery
router.get('/:id/estimate-delivery', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.estimateDelivery
);

// GET /api/orders/:id/summary - Get order summary
router.get('/:id/summary', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.getOrderSummary
);

// POST /api/orders/:id/reorder - Reorder
router.post('/:id/reorder', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.reorder
);

// ========================================
// 🛡️ FRAUD & COMPLIANCE
// ========================================

// GET /api/orders/fraudulent - Get fraudulent orders
router.get('/fraudulent', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getFraudulentOrders
);

// GET /api/orders/:id/compliance-check - Check order compliance
router.get('/:id/compliance-check', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.checkOrderCompliance
);

// PUT /api/orders/:id/flag - Flag order
router.put('/:id/flag', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  orderController.flagOrder
);

// ========================================
// 📦 BULK/UTILITY
// ========================================

// POST /api/orders/validate-stock - Validate stock in bulk
router.post('/validate-stock', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  body('items').isArray({ min: 1 }).withMessage('Items array is required'),
  body('items.*.productId').isMongoId().withMessage('Invalid product ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  orderController.validateStockBulk
);

// POST /api/orders/update-stock - Update stock in bulk
router.post('/update-stock', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  body('items').isArray({ min: 1 }).withMessage('Items array is required'),
  body('items.*.productId').isMongoId().withMessage('Invalid product ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  orderController.updateStockBulk
);

// GET /api/orders/export - Export orders report
router.get('/export', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.export,
  orderController.exportOrdersReport
);

// POST /api/orders/import - Import orders in bulk
router.post('/import', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  body('orders').isArray({ min: 1 }).withMessage('Orders array is required'),
  orderController.importOrdersBulk
);

// ========================================
// 🏢 ENTERPRISE-LEVEL OPERATIONS
// ========================================

// GET /api/orders/:id/audit - Audit order changes
router.get('/:id/audit', 
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.auditOrderChanges
);

// POST /api/orders/status-notification - Push status notification
router.post('/status-notification', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  body('orderId').isMongoId().withMessage('Invalid order ID'),
  body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'canceled']).withMessage('Invalid status'),
  orderController.pushStatusNotification
);

// POST /api/orders/:id/log-event - Log order event
router.post('/:id/log-event', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('event').isString().withMessage('Event must be a string').isLength({ max: 500 }).withMessage('Event cannot exceed 500 characters'),
  orderController.logOrderEvent
);

// PUT /api/orders/:id/restore - Restore canceled order
router.put('/:id/restore', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.restoreCanceledOrder
);

// POST /api/orders/archive-completed - Archive completed orders
router.post('/archive-completed', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderController.archiveCompletedOrders
);

// POST /api/orders/:id/send-invoice - Send order invoice
router.post('/:id/send-invoice', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.sendOrderInvoice
);

// GET /api/orders/historical-data - Get historical order data
router.get('/historical-data', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getHistoricalOrderData
);

// GET /api/orders/growth-stats - Get order growth stats
router.get('/growth-stats', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  orderValidation.query,
  orderController.getOrderGrowthStats
);

// POST /api/orders/:id/rate-items - Rate order items
router.post('/:id/rate-items', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('ratings').isArray({ min: 1 }).withMessage('Ratings array is required'),
  body('ratings.*.productId').isMongoId().withMessage('Invalid product ID'),
  body('ratings.*.rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  orderController.rateOrderItems
);

// POST /api/orders/:id/review - Review order experience
router.post('/:id/review', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('review').isString().withMessage('Review must be a string').isLength({ max: 1000 }).withMessage('Review cannot exceed 1000 characters'),
  orderController.reviewOrderExperience
);

// GET /api/orders/:id/events-timeline - Get order events timeline
router.get('/:id/events-timeline', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.getOrderEventsTimeline
);

// PUT /api/orders/:id/assign-agent - Assign order to agent
router.put('/:id/assign-agent', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('agentId').isMongoId().withMessage('Invalid agent ID'),
  orderController.assignOrderToAgent
);

// GET /api/orders/:id/track-route - Track order route
router.get('/:id/track-route', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.trackOrderRoute
);

// GET /api/orders/:id/calculate-profit - Calculate order profit
router.get('/:id/calculate-profit', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.calculateOrderProfit
);

// GET /api/orders/:id/payment-reconciliation - Check payment reconciliation
router.get('/:id/payment-reconciliation', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.checkOrderPaymentReconciliation
);

// POST /api/orders/:id/flag-return-abuse - Flag suspected return abuse
router.post('/:id/flag-return-abuse', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  orderController.flagSuspectedReturnAbuse
);

// POST /api/orders/:id/escalate - Handle order escalation
router.post('/:id/escalate', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  orderController.handleOrderEscalation
);

// POST /api/orders/:id/sync-erp - Sync order with ERP
router.post('/:id/sync-erp', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.syncOrderWithERP
);

// POST /api/orders/:id/integrate-crm - Integrate order with CRM
router.post('/:id/integrate-crm', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.integrateOrderWithCRM
);

// PUT /api/orders/:id/lock-audit - Lock order for audit
router.put('/:id/lock-audit', 
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.lockOrderForAudit
);

// PUT /api/orders/:id/release-lock - Release order lock
router.put('/:id/release-lock', 
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  orderController.releaseOrderLock
);

// PUT /api/orders/:id/cancel-admin - Cancel order by admin
router.put('/:id/cancel-admin', 
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  orderController.cancelOrderByAdmin
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones
  if (req.path.startsWith('/analytics/') || 
      req.path.startsWith('/bulk/') || 
      req.path.startsWith('/user/') || 
      req.path.startsWith('/return-requests') || 
      req.path.startsWith('/fraudulent') || 
      req.path.startsWith('/export') || 
      req.path.startsWith('/import') || 
      req.path.startsWith('/validate-stock') || 
      req.path.startsWith('/update-stock') || 
      req.path.startsWith('/historical-data') || 
      req.path.startsWith('/growth-stats') || 
      req.path.startsWith('/search-by-customer') || 
      req.path.startsWith('/top-customers') || 
      req.path.startsWith('/featured') || 
      req.path.startsWith('/low-stock')) {
    return next();
  }

  next();
};

// Apply the middleware to all routes
router.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

router.get('/docs/routes', (req, res) => {
  if (enviroment !== 'development') {
    return res.status(404).json({
      success: false,
      message: 'Route documentation only available in development mode'
    });
  }

  const routes = {
    crud: [
      'POST   /api/orders                          - Create a new order',
      'GET    /api/orders/:id                     - Get order by ID',
      'GET    /api/orders                         - Get all orders with filtering',
      'PUT    /api/orders/:id                     - Update order',
      'DELETE /api/orders/:id                     - Delete order'
    ],
    paymentTransactions: [
      'PUT    /api/orders/:id/pay                 - Mark order as paid',
      'PUT    /api/orders/:id/refund             - Refund order',
      'PUT    /api/orders/bulk-refund            - Bulk refund orders',
      'PUT    /api/orders/:id/redeem-points      - Redeem loyalty points'
    ],
    orderStateFulfillment: [
      'PUT    /api/orders/:id/status             - Update order status',
      'PUT    /api/orders/bulk-status            - Bulk update order status',
      'POST   /api/orders/:id/split              - Split order',
      'PUT    /api/orders/:id/tracking           - Add tracking info',
      'PUT    /api/orders/:id/mark-delivered     - Mark order as delivered',
      'PUT    /api/orders/:id/priority           - Set priority level'
    ],
    cartItemManagement: [
      'PUT    /api/orders/:id/items/:itemIndex/quantity - Update item quantity',
      'PUT    /api/orders/:id/gift-message       - Add gift message',
      'PUT    /api/orders/:id/apply-coupon       - Apply coupon'
    ],
    returnsAfterSales: [
      'POST   /api/orders/:id/request-return     - Request return',
      'PUT    /api/orders/:id/resolve-return     - Resolve return request',
      'GET    /api/orders/return-requests        - Get return requests'
    ],
    loyaltyEngagement: [
      'GET    /api/orders/top-customers          - Get top customers',
      'GET    /api/orders/user/:userId/history   - Get customer order history'
    ],
    analyticsReporting: [
      'GET    /api/orders/analytics/stats        - Get order statistics',
      'GET    /api/orders/analytics/trends       - Get order trends',
      'GET    /api/orders/analytics/revenue-by-source - Get revenue by source',
      'GET    /api/orders/analytics/product-performance - Get product performance',
      'GET    /api/orders/analytics/conversion-funnel - Get order conversion funnel',
      'GET    /api/orders/featured                - Get featured orders',
      'GET    /api/orders/low-stock              - Get low stock orders',
      'GET    /api/orders/analytics/average-order-value - Get average order value',
      'GET    /api/orders/search-by-customer      - Search orders by customer name',
      'GET    /api/orders/analytics/by-payment-method - Get orders by payment method',
      'GET    /api/orders/analytics/delayed-orders - Get delayed orders',
      'GET    /api/orders/analytics/loyalty-points-summary - Get loyalty points summary'
    ],
    customerShippingUtilities: [
      'GET    /api/orders/:id/estimate-delivery  - Estimate delivery',
      'GET    /api/orders/:id/summary            - Get order summary',
      'POST   /api/orders/:id/reorder            - Reorder'
    ],
    fraudCompliance: [
      'GET    /api/orders/fraudulent             - Get fraudulent orders',
      'GET    /api/orders/:id/compliance-check   - Check order compliance',
      'PUT    /api/orders/:id/flag               - Flag order'
    ],
    bulkUtility: [
      'POST   /api/orders/validate-stock         - Validate stock in bulk',
      'POST   /api/orders/update-stock           - Update stock in bulk',
      'GET    /api/orders/export                 - Export orders report',
      'POST   /api/orders/import                 - Import orders in bulk'
    ],
    enterpriseOperations: [
      'GET    /api/orders/:id/audit              - Audit order changes',
      'POST   /api/orders/status-notification    - Push status notification',
      'POST   /api/orders/:id/log-event          - Log order event',
      'PUT    /api/orders/:id/restore            - Restore canceled order',
      'POST   /api/orders/archive-completed      - Archive completed orders',
      'POST   /api/orders/:id/send-invoice       - Send order invoice',
      'GET    /api/orders/historical-data        - Get historical order data',
      'GET    /api/orders/growth-stats           - Get order growth stats',
      'POST   /api/orders/:id/rate-items         - Rate order items',
      'POST   /api/orders/:id/review             - Review order experience',
      'GET    /api/orders/:id/events-timeline    - Get order events timeline',
      'PUT    /api/orders/:id/assign-agent       - Assign order to agent',
      'GET    /api/orders/:id/track-route        - Track order route',
      'GET    /api/orders/:id/calculate-profit   - Calculate order profit',
      'GET    /api/orders/:id/payment-reconciliation - Check payment reconciliation',
      'POST   /api/orders/:id/flag-return-abuse  - Flag suspected return abuse',
      'POST   /api/orders/:id/escalate           - Handle order escalation',
      'POST   /api/orders/:id/sync-erp           - Sync order with ERP',
      'POST   /api/orders/:id/integrate-crm      - Integrate order with CRM',
      'PUT    /api/orders/:id/lock-audit         - Lock order for audit',
      'PUT    /api/orders/:id/release-lock       - Release order lock',
      'PUT    /api/orders/:id/cancel-admin       - Cancel order by admin'
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
});

module.exports = {orderRoutes:router};