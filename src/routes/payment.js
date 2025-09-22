const express = require('express');
const router = express.Router();
const paymentsController = require('../controller/paymentController'); // Adjust path as needed
const { body, query, param, validationResult } = require('express-validator');
const {authMiddleware} = require('../middleware/auth');
const authorize = require('../middleware/authorize'); // Assuming authorize is exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting'); // Assuming environment config
const Payment = require('../models/payment'); // Assuming Payment model exists

/**
 * 🚀 CONSOLIDATED PAYMENT ROUTES
 * 
 * Features:
 * ✅ User-focused payment operations (create, retrieve, refund, dispute)
 * ✅ Admin-focused operations for analytics, bulk updates, and disputes
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
 * Middleware to check instance-level access for payment-specific routes
 * Ensures the user has permission to access/modify the specific payment
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const paymentId = req.params.id || req.user.paymentId; // Assumes paymentId may be linked to user
    if (paymentId && !req.user.isSuperadmin) { // Superadmin bypass in authorize
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }
      if (payment.userId.toString() !== req.user.id) { // Restrict to own payment
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s payment' });
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

const paymentValidation = {
  createPayment: [
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number').toFloat(),
    body('currency').isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code').trim().toUpperCase(),
    body('orderId').isMongoId().withMessage('Invalid order ID'),
    body('paymentMethodId').isMongoId().withMessage('Invalid payment method ID'),
    validate
  ],

  getPayment: [
    param('id').isMongoId().withMessage('Invalid payment ID'),
    validate
  ],

  listPayments: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'amount', 'status']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    validate
  ],

  updateStatus: [
    param('id').isMongoId().withMessage('Invalid payment ID'),
    body('status').isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Invalid status'),
    validate
  ],

  refund: [
    param('id').isMongoId().withMessage('Invalid payment ID'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('Refund amount must be a positive number').toFloat(),
    validate
  ],

  dispute: [
    param('id').isMongoId().withMessage('Invalid payment ID'),
    body('reason').isString().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters').trim().escape(),
    validate
  ],

  capture: [
    param('id').isMongoId().withMessage('Invalid payment ID'),
    validate
  ],

  analytics: [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    query('status').optional().isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Invalid status filter'),
    validate
  ],

  bulkUpdateStatus: [
    body('paymentIds').isArray({ min: 1 }).withMessage('Payment IDs array is required'),
    body('paymentIds.*').isMongoId().withMessage('Invalid payment ID in array'),
    body('status').isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Invalid status'),
    validate
  ],

  bulkCancel: [
    body('paymentIds').isArray({ min: 1 }).withMessage('Payment IDs array is required'),
    body('paymentIds.*').isMongoId().withMessage('Invalid payment ID in array'),
    validate
  ],

  providerTransaction: [
    param('providerTransactionId').isString().isLength({ min: 1, max: 100 }).withMessage('Invalid provider transaction ID').trim(),
    validate
  ],

  orderPayments: [
    param('orderId').isMongoId().withMessage('Invalid order ID'),
    validate
  ],

  paymentMethod: [
    param('sourceId').isMongoId().withMessage('Invalid payment method ID'),
    validate
  ],

  metadata: [
    param('id').isMongoId().withMessage('Invalid payment ID'),
    body('metadata').isObject().withMessage('Metadata must be an object'),
    body('metadata.*').optional().isString().isLength({ max: 500 }).withMessage('Metadata value cannot exceed 500 characters').trim().escape(),
    validate
  ],

  tags: [
    param('id').isMongoId().withMessage('Invalid payment ID'),
    body('tags').isArray({ min: 1 }).withMessage('Tags array is required'),
    body('tags.*').isString().isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters').trim().escape(),
    validate
  ],

  bulkTags: [
    body('paymentIds').isArray({ min: 1 }).withMessage('Payment IDs array is required'),
    body('paymentIds.*').isMongoId().withMessage('Invalid payment ID in array'),
    body('tags').isArray({ min: 1 }).withMessage('Tags array is required'),
    body('tags.*').isString().isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters').trim().escape(),
    validate
  ],

  country: [
    param('country').isString().isLength({ min: 2, max: 2 }).withMessage('Country must be a 2-letter code').trim().toUpperCase(),
    validate
  ],

  currency: [
    param('currency').isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code').trim().toUpperCase(),
    validate
  ]
};

// ========================================
// 💸 USER PAYMENT OPERATIONS
// ========================================


// Payment Management Routes (Authenticated)
router.post('/initiate', 
    authenticateToken,
    paymentRateLimit,
    validatePaymentRequest,
    paymentsController.initiatePayment
);

router.post('/verify',
    authenticateToken,
    paymentsController.verifyPayment
);

router.post('/retry',
    authenticateToken,
    paymentRateLimit,
    paymentsController.retryPayment
);

router.post('/refund',
    authenticateToken,
    authorize('admin', 'manager'),
    validateRefundRequest,
    paymentsController.processRefund
);

// NEW: Get payment details with refunds
router.get('/:paymentId',
    authenticateToken,
    paymentsController.getPaymentDetails
);

// Webhook Routes (Public - no auth required)
router.post('/webhook/paypal',
    webhookRateLimit,
    WebhookController.handlePaypalWebhook
);

router.post('/webhook/razorpay',
    webhookRateLimit,
    WebhookController.handleRazorpayWebhook
);

router.post('/webhook/stripe',
    webhookRateLimit,
    WebhookController.handleStripeWebhook
);


// POST /api/payments - Create a new payment
router.post('/',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.createPayment,
  paymentsController.createPayment
);

// GET /api/payments/:id - Get payment by ID
router.get('/:id',
  authMiddleware,
  authorize('payment', 'read'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.getPaymentById
);

// PUT /api/payments/:id/status - Update payment status
router.put('/:id/status',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.updateStatus,
  paymentsController.updatePaymentStatus
);

// POST /api/payments/:id/refund - Request a refund
router.post('/:id/refund',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.refund,
  paymentsController.addRefund
);

// POST /api/payments/:id/dispute - Create a dispute
router.post('/:id/dispute',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.dispute,
  paymentsController.addDispute
);

// POST /api/payments/:id/capture - Capture a payment
router.post('/:id/capture',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.capture,
  paymentsController.capturePayment
);

// GET /api/payments/:id/history - Get payment tracking history
router.get('/:id/history',
  authMiddleware,
  authorize('payment', 'read'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.getTrackingHistory
);

// POST /api/payments/:id/attempts - Increment payment attempts
router.post('/:id/attempts',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.incrementAttempts
);

// POST /api/payments/:id/mark-paid - Mark payment as paid
router.post('/:id/mark-paid',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.markAsPaid
);

// PUT /api/payments/:id/metadata - Update payment metadata
router.put('/:id/metadata',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.metadata,
  paymentsController.updateMetadata
);

// POST /api/payments/:id/tags - Add tags to payment
router.post('/:id/tags',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.tags,
  paymentsController.addTag
);

// DELETE /api/payments/:id/tags - Remove tags from payment
router.delete('/:id/tags',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.tags,
  paymentsController.removeTag
);

// PUT /api/payments/:id/notes - Update payment notes
router.put('/:id/notes',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.updateNotes
);

// ========================================
// 👮 ADMIN PAYMENT OPERATIONS
// ========================================

// GET /api/payments - List all payments (paginated)
router.get('/',
  authMiddleware,
  authorize('payment', 'read'),
  bulkOperationLimiter,
  paymentValidation.listPayments,
  paymentsController.listPayments
);

// GET /api/analytics - Get payment analytics
router.get('/analytics',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentValidation.analytics,
  paymentsController.getAnalytics
);

// GET /api/suspicious - Get suspicious payments
router.get('/suspicious',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentValidation.listPayments,
  paymentsController.getSuspiciousPayments
);

// GET /api/requiring-action - Get payments requiring action
router.get('/requiring-action',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentValidation.listPayments,
  paymentsController.getPaymentsRequiringAction
);

// PUT /api/bulk-update-status - Bulk update payment status
router.put('/bulk-update-status',
  authMiddleware,
  authorize('payment', 'update'),
  bulkOperationLimiter,
  paymentValidation.bulkUpdateStatus,
  paymentsController.bulkUpdateStatus
);

// POST /api/bulk-cancel - Bulk cancel payments
router.post('/bulk-cancel',
  authMiddleware,
  authorize('payment', 'update'),
  bulkOperationLimiter,
  paymentValidation.bulkCancel,
  paymentsController.bulkCancelPayments
);

// GET /api/summary - Get payment summary
router.get('/summary',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getPaymentSummary
);

// GET /api/failed-attempts - Get failed attempts summary
router.get('/failed-attempts',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getFailedAttemptsSummary
);

// GET /api/recent - Get recent payments
router.get('/recent',
  authMiddleware,
  authorize('payment', 'read'),
  bulkOperationLimiter,
  paymentValidation.listPayments,
  paymentsController.getRecentPayments
);

// GET /api/provider-transaction/:providerTransactionId - Find payment by provider transaction ID
router.get('/provider-transaction/:providerTransactionId',
  authMiddleware,
  authorize('payment', 'read'),
  paymentValidation.providerTransaction,
  paymentsController.findByProviderTransactionId
);

// GET /api/order/:orderId - Find payments by order
router.get('/order/:orderId',
  authMiddleware,
  authorize('payment', 'read'),
  paymentValidation.orderPayments,
  paymentsController.findPaymentsByOrder
);

// GET /api/payment-method/:sourceId - Find payments by payment method
router.get('/payment-method/:sourceId',
  authMiddleware,
  authorize('payment', 'read'),
  paymentValidation.paymentMethod,
  paymentsController.findPaymentsByPaymentMethod
);

// DELETE /api/payments/:id - Delete a payment
router.delete('/:id',
  authMiddleware,
  authorize('payment', 'delete'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.deletePayment
);

// GET /api/export - Export payments
router.get('/export',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.exportPayments
);

// PUT /api/payments/:id/dispute/resolve - Resolve a dispute
router.put('/:id/dispute/resolve',
  authMiddleware,
  authorize('payment', 'update'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.resolveDispute
);

// PUT /api/payments/:id/dispute/status - Update dispute status
router.put('/:id/dispute/status',
  authMiddleware,
  authorize('payment', 'update'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.updateDisputeStatus
);

// GET /api/recurring - Get recurring payments
router.get('/recurring',
  authMiddleware,
  authorize('payment', 'read'),
  bulkOperationLimiter,
  paymentValidation.listPayments,
  paymentsController.getRecurringPayments
);

// GET /api/payments/:id/risk-score - Calculate risk score
router.get('/:id/risk-score',
  authMiddleware,
  authorize('payment', 'report'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.calculateRiskScore
);

// GET /api/stats/processing-time - Get processing time stats
router.get('/stats/processing-time',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getProcessingTimeStats
);

// GET /api/stats/refund-rates - Get refund rates
router.get('/stats/refund-rates',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getRefundRates
);

// GET /api/stats/success-rate-provider - Get success rate by provider
router.get('/stats/success-rate-provider',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getSuccessRateByProvider
);

// GET /api/stats/average-amount-method - Get average amount by method
router.get('/stats/average-amount-method',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getAverageAmountByMethod
);

// GET /api/stats/currency-breakdown - Get currency breakdown
router.get('/stats/currency-breakdown',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getCurrencyBreakdown
);

// GET /api/stats/fee-summary - Get fee summary
router.get('/stats/fee-summary',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getFeeSummary
);

// GET /api/stats/dispute-analytics - Get dispute analytics
router.get('/stats/dispute-analytics',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getDisputeAnalytics
);

// GET /api/payments/:id/timeline-stats - Get timeline stats
router.get('/:id/timeline-stats',
  authMiddleware,
  authorize('payment', 'report'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.getTimelineStats
);

// POST /api/webhook - Handle webhook
router.post('/webhook',
  paymentsController.handleWebhook // No auth required for webhooks
);

// POST /api/payments/:id/timeline - Add timeline entry
router.post('/:id/timeline',
  authMiddleware,
  authorize('payment', 'write'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.addTimelineEntry
);

// GET /api/payments/:id/expired - Check if payment is expired
router.get('/:id/expired',
  authMiddleware,
  authorize('payment', 'read'),
  instanceCheckMiddleware,
  paymentValidation.getPayment,
  paymentsController.checkExpired
);

// GET /api/tags-usage - Get tags usage
router.get('/tags-usage',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getTagsUsage
);

// GET /api/search/notes - Search payments by notes
router.get('/search/notes',
  authMiddleware,
  authorize('payment', 'read'),
  bulkOperationLimiter,
  query('q').isString().isLength({ max: 500 }).withMessage('Search query cannot exceed 500 characters').trim().escape(),
  validate,
  paymentsController.searchByNotes
);

// GET /api/tags/:tag - Get payments by tag
router.get('/tags/:tag',
  authMiddleware,
  authorize('payment', 'read'),
  bulkOperationLimiter,
  param('tag').isString().isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters').trim().escape(),
  validate,
  paymentsController.getPaymentsByTag
);

// POST /api/bulk-tags - Bulk add tags
router.post('/bulk-tags',
  authMiddleware,
  authorize('payment', 'update'),
  bulkOperationLimiter,
  paymentValidation.bulkTags,
  paymentsController.bulkAddTags
);

// GET /api/country/:country - Get payments by country
router.get('/country/:country',
  authMiddleware,
  authorize('payment', 'read'),
  bulkOperationLimiter,
  paymentValidation.country,
  paymentsController.getPaymentsByCountry
);

// GET /api/currency/:currency - Get payments by currency
router.get('/currency/:currency',
  authMiddleware,
  authorize('payment', 'read'),
  bulkOperationLimiter,
  paymentValidation.currency,
  paymentsController.getPaymentsByCurrency
);

// GET /api/stats/volume - Get volume by period
router.get('/stats/volume',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentValidation.analytics,
  paymentsController.getVolumeByPeriod
);

// GET /api/stats/top-customers - Get top customers
router.get('/stats/top-customers',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentsController.getTopCustomers
);

// POST /api/simulate-failure - Simulate payment failure
router.post('/simulate-failure',
  authMiddleware,
  authorize('payment', 'write'),
  bulkOperationLimiter,
  paymentsController.simulatePaymentFailure
);

// GET /api/stats/success-rates-time - Get success rates over time
router.get('/stats/success-rates-time',
  authMiddleware,
  authorize('payment', 'report'),
  bulkOperationLimiter,
  paymentValidation.analytics,
  paymentsController.getMethodSuccessRatesOverTime
);

// GET /api/ip/:ipAddress - Get payments by IP
router.get('/ip/:ipAddress',
  authMiddleware,
  authorize('payment', 'read'),
  bulkOperationLimiter,
  param('ipAddress').isIP().withMessage('Invalid IP address'),
  validate,
  paymentsController.getPaymentsByIP
);

// POST /api/bulk-refunds - Bulk process refunds
router.post('/bulk-refunds',
  authMiddleware,
  authorize('payment', 'update'),
  bulkOperationLimiter,
  paymentValidation.bulkCancel,
  paymentsController.bulkProcessRefunds
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  const path = req.path.toLowerCase(); // Case-insensitive matching
  if (path.startsWith('/webhook')) {
    return next(); // Webhook does not require auth
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
  authorize('payment', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      userOperations: [
        'POST   /api/payments                        - Create a new payment (write, instance check)',
        'GET    /api/payments/:id                    - Get payment by ID (read, instance check)',
        'PUT    /api/payments/:id/status             - Update payment status (write, instance check)',
        'POST   /api/payments/:id/refund             - Request a refund (write, instance check)',
        'POST   /api/payments/:id/dispute            - Create a dispute (write, instance check)',
        'POST   /api/payments/:id/capture            - Capture a payment (write, instance check)',
        'GET    /api/payments/:id/history            - Get payment tracking history (read, instance check)',
        'POST   /api/payments/:id/attempts           - Increment payment attempts (write, instance check)',
        'POST   /api/payments/:id/mark-paid          - Mark payment as paid (write, instance check)',
        'PUT    /api/payments/:id/metadata           - Update payment metadata (write, instance check)',
        'POST   /api/payments/:id/tags               - Add tags to payment (write, instance check)',
        'DELETE /api/payments/:id/tags               - Remove tags from payment (write, instance check)',
        'PUT    /api/payments/:id/notes              - Update payment notes (write, instance check)'
      ],
      adminOperations: [
        'GET    /api/payments                        - List all payments (read, rate-limited)',
        'GET    /api/analytics                       - Get payment analytics (report, rate-limited)',
        'GET    /api/suspicious                      - Get suspicious payments (report, rate-limited)',
        'GET    /api/requiring-action                - Get payments requiring action (report, rate-limited)',
        'PUT    /api/bulk-update-status              - Bulk update payment status (update, rate-limited)',
        'POST   /api/bulk-cancel                     - Bulk cancel payments (update, rate-limited)',
        'GET    /api/summary                         - Get payment summary (report, rate-limited)',
        'GET    /api/failed-attempts                 - Get failed attempts summary (report, rate-limited)',
        'GET    /api/recent                          - Get recent payments (read, rate-limited)',
        'GET    /api/provider-transaction/:providerTransactionId - Find payment by provider transaction ID (read)',
        'GET    /api/order/:orderId                  - Find payments by order (read)',
        'GET    /api/payment-method/:sourceId        - Find payments by payment method (read)',
        'DELETE /api/payments/:id                    - Delete a payment (delete, instance check)',
        'GET    /api/export                          - Export payments (report, rate-limited)',
        'PUT    /api/payments/:id/dispute/resolve    - Resolve a dispute (update, instance check)',
        'PUT    /api/payments/:id/dispute/status     - Update dispute status (update, instance check)',
        'GET    /api/recurring                       - Get recurring payments (read, rate-limited)',
        'GET    /api/payments/:id/risk-score         - Calculate risk score (report, instance check)',
        'GET    /api/stats/processing-time           - Get processing time stats (report, rate-limited)',
        'GET    /api/stats/refund-rates              - Get refund rates (report, rate-limited)',
        'GET    /api/stats/success-rate-provider     - Get success rate by provider (report, rate-limited)',
        'GET    /api/stats/average-amount-method     - Get average amount by method (report, rate-limited)',
        'GET    /api/stats/currency-breakdown        - Get currency breakdown (report, rate-limited)',
        'GET    /api/stats/fee-summary               - Get fee summary (report, rate-limited)',
        'GET    /api/stats/dispute-analytics         - Get dispute analytics (report, rate-limited)',
        'GET    /api/payments/:id/timeline-stats     - Get timeline stats (report, instance check)',
        'POST   /api/payments/:id/timeline           - Add timeline entry (write, instance check)',
        'GET    /api/payments/:id/expired            - Check if payment is expired (read, instance check)',
        'GET    /api/tags-usage                      - Get tags usage (report, rate-limited)',
        'GET    /api/search/notes                    - Search payments by notes (read, rate-limited)',
        'GET    /api/tags/:tag                       - Get payments by tag (read, rate-limited)',
        'POST   /api/bulk-tags                       - Bulk add tags (update, rate-limited)',
        'GET    /api/country/:country                - Get payments by country (read, rate-limited)',
        'GET    /api/currency/:currency              - Get payments by currency (read, rate-limited)',
        'GET    /api/stats/volume                    - Get volume by period (report, rate-limited)',
        'GET    /api/stats/top-customers             - Get top customers (report, rate-limited)',
        'POST   /api/simulate-failure                - Simulate payment failure (write, rate-limited)',
        'GET    /api/stats/success-rates-time        - Get success rates over time (report, rate-limited)',
        'GET    /api/ip/:ipAddress                   - Get payments by IP (read, rate-limited)',
        'POST   /api/bulk-refunds                    - Bulk process refunds (update, rate-limited)'
      ],
      webhook: [
        'POST   /api/webhook                        - Handle webhook (no auth)'
      ],
      documentation: [
        'GET    /api/docs/routes                    - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Payment API routes documentation'
    });
  }
);

module.exports = { paymentRoutes: router };