
const { PaymentModel } = require('../models/payment'); // Adjust path as needed
const { body, query, param } = require('express-validator');
const { validationResult } = require('express-validator');
const { Logger } = require('../utils/logger');
const mongoose = require('mongoose');
const csvWriter = require('csv-writer').createObjectCsvWriter; // For export, install: npm i csv-writer
const fs = require('fs');

const logger = new Logger('PaymentsController');

// Validation Functions
const createPaymentValidator = [
  body('orderId').isMongoId().withMessage('Invalid order ID'),
  body('amount').isFloat({ min: 0 }).toFloat().withMessage('Amount must be a positive number'),
  body('currency').isIn(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']).withMessage('Invalid currency'),
  body('paymentMethod').isIn(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'UPI']).withMessage('Invalid payment method'),
  body('paymentProvider').optional().isIn(['STRIPE', 'PAYPAL', 'RAZORPAY', 'INTERNAL']).withMessage('Invalid payment provider'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object'),
  body('billingAddress').optional().isObject().withMessage('Billing address must be an object'),
  body('billingAddress.country').optional().isString().withMessage('Country must be a string'),
];

const updateStatusValidator = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  body('status').isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'),
  body('note').optional().isString().trim().withMessage('Note must be a string'),
];

const addRefundValidator = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  body('amount').isFloat({ min: 0 }).toFloat().withMessage('Refund amount must be a positive number'),
  body('reason').optional().isString().trim().withMessage('Reason must be a string'),
];

const getPaymentsValidator = [
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'),
  query('paymentMethod').optional().isIn(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'UPI']).withMessage('Invalid payment method'),
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
  query('sortBy').optional().isIn(['createdAt', 'amount', 'status']).withMessage('Invalid sortBy field'),
  query('sortOrder').optional().isIn(['1', '-1']).toInt().withMessage('SortOrder must be 1 or -1'),
];

const exportPaymentsValidator = [
  query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
  query('status').optional().isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt().withMessage('Limit must be between 1 and 1000'),
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
];

const resolveDisputeValidator = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  body('disputeId').isString().trim().notEmpty().withMessage('Dispute ID must be a non-empty string'),
  body('status').isIn(['WON', 'LOST']).withMessage('Dispute status must be WON or LOST'),
  body('resolvedAt').optional().isISO8601().toDate().withMessage('Invalid resolvedAt format'),
  body('note').optional().isString().trim().withMessage('Note must be a string'),
];

const updateDisputeValidator = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  body('disputeId').isString().trim().notEmpty().withMessage('Dispute ID must be a non-empty string'),
  body('status').isIn(['OPEN', 'WON', 'LOST', 'PENDING']).withMessage('Invalid dispute status'),
  body('note').optional().isString().trim().withMessage('Note must be a string'),
];

const getRecurringPaymentsValidator = [
  query('subscriptionId').optional().isMongoId().withMessage('Invalid subscription ID'),
  query('status').optional().isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
];

const calculateRiskScoreValidator = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
];

const getProcessingTimeStatsValidator = [
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
];

const getRefundRatesValidator = [
  query('paymentProvider').optional().isIn(['STRIPE', 'PAYPAL', 'RAZORPAY', 'INTERNAL']).withMessage('Invalid payment provider'),
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
];

const getSuccessRateByProviderValidator = [
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
];

const getAverageAmountByMethodValidator = [
  query('paymentMethod').optional().isIn(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'UPI']).withMessage('Invalid payment method'),
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
];

const getCurrencyBreakdownValidator = [
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
];

const getFeeSummaryValidator = [
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
  query('paymentProvider').optional().isIn(['STRIPE', 'PAYPAL', 'RAZORPAY', 'INTERNAL']).withMessage('Invalid payment provider'),
];

const getDisputeAnalyticsValidator = [
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
];

const getTimelineStatsValidator = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  query('status').optional().isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'),
];

const getPaymentsByCurrencyValidator = [
  query('currency').isIn(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']).withMessage('Invalid currency'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
];

const getVolumeByPeriodValidator = [
  query('period').isIn(['day', 'week', 'month']).withMessage('Period must be day, week, or month'),
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
];

const getTopCustomersValidator = [
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt().withMessage('Limit must be between 1 and 50'),
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
];

const simulatePaymentFailureValidator = [
  body('paymentId').isMongoId().withMessage('Invalid payment ID'),
  body('reason').optional().isString().trim().withMessage('Reason must be a string'),
];

const getMethodSuccessRatesOverTimeValidator = [
  query('paymentMethod').optional().isIn(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'UPI']).withMessage('Invalid payment method'),
  query('granularity').isIn(['daily', 'weekly', 'monthly']).withMessage('Granularity must be daily, weekly, or monthly'),
  query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'),
  query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'),
];

const getPaymentsByIPValidator = [
  query('ipAddress').isIP().withMessage('Invalid IP address'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
];

const bulkProcessRefundsValidator = [
  body('paymentIds').isArray({ min: 1 }).withMessage('Payment IDs must be a non-empty array'),
  body('paymentIds.*').isMongoId().withMessage('Each payment ID must be a valid MongoID'),
  body('amountPercentage').isFloat({ min: 0, max: 100 }).toFloat().withMessage('Amount percentage must be between 0 and 100'),
  body('reason').optional().isString().trim().withMessage('Reason must be a string'),
];

const addTagValidator = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  body('tag').isString().trim().notEmpty().withMessage('Tag must be a non-empty string'),
];

const removeTagValidator = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  body('tag').isString().trim().notEmpty().withMessage('Tag must be a non-empty string'),
];

const updateNotesValidator = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  body('notes').isString().trim().withMessage('Notes must be a string'),
];

const addTimelineEntryValidator = [
  param('id').isMongoId().withMessage('Invalid payment ID'),
  body('status').isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'),
  body('note').optional().isString().trim().withMessage('Note must be a string'),
  body('updatedBy').optional().isString().trim().withMessage('UpdatedBy must be a string'),
  body('additionalData').optional().isObject().withMessage('Additional data must be an object'),
];

const bulkAddTagsValidator = [
  body('paymentIds').isArray({ min: 1 }).withMessage('Payment IDs must be a non-empty array'),
  body('paymentIds.*').isMongoId().withMessage('Each payment ID must be a valid MongoID'),
  body('tag').isString().trim().notEmpty().withMessage('Tag must be a non-empty string'),
];

const getPaymentsByCountryValidator = [
  query('country').isString().trim().notEmpty().withMessage('Country must be a non-empty string'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
];

const searchByNotesValidator = [
  query('notes').isString().trim().notEmpty().withMessage('Notes must be a non-empty string'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
];

const getPaymentsByTagValidator = [
  query('tag').isString().trim().notEmpty().withMessage('Tag must be a non-empty string'),
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'),
];

// Helper function to handle errors
const handleError = (res, err, defaultMessage = 'Internal server error') => {
  logger.error(err.message, { stack: err.stack });
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.message });
  }
  if (err.name === 'CastError' || err.name === 404) {
    return res.status(404).json({ error: 'Resource not found' });
  }
  res.status(500).json({ error: defaultMessage });
};

// Helper to check permissions
const checkPaymentOwnership = (req, payment) => {
  if (req.user.role !== 'admin' && payment.customerId.toString() !== req.user.id) {
    throw new Error('Unauthorized access to payment');
  }
};

// Controller Functions
const createPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { orderId, amount, currency = 'USD', paymentMethod, paymentProvider = 'INTERNAL', ...rest } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const paymentData = {
      orderId,
      customerId: req.user.id,
      amount,
      currency,
      paymentMethod,
      paymentProvider,
      status: 'PENDING',
      ...rest,
      metadata: {
        ...rest.metadata,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id,
      },
    };

    const payment = await PaymentModel.create(paymentData);
    const formattedPayment = payment.toAPIResponse();

    logger.info('Payment created', { paymentId: payment.paymentId, customerId: req.user.id });
    res.status(201).json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to create payment');
  }
};

const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const payment = await PaymentModel.findById(id).populate('orderId customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);

    const formattedPayment = payment.toAPIResponse();
    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err);
  }
};

const listPayments = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { page = 1, limit = 20, status, paymentMethod, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = -1 } = req.query;
    const options = { page: parseInt(page), limit: parseInt(limit), status, paymentMethod, dateFrom, dateTo, sortBy, sortOrder: parseInt(sortOrder) };

    if (req.user.role !== 'admin') {
      options.customerId = req.user.id;
    }

    const result = await PaymentModel.findByCustomer(req.user.id, options);
    res.json({ success: true, data: result.payments, pagination: result.pagination });
  } catch (err) {
    handleError(res, err, 'Failed to fetch payments');
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { status, note = '', updatedBy = req.user.role || 'customer' } = req.body;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);

    const allowedTransitions = {
      PENDING: ['PROCESSING', 'FAILED', 'CANCELLED', 'EXPIRED'],
      PROCESSING: ['AUTHORIZED', 'COMPLETED', 'FAILED'],
      AUTHORIZED: ['COMPLETED', 'FAILED', 'CANCELLED'],
    };
    if (!allowedTransitions[payment.status]?.includes(status)) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    await payment.updateStatus(status, note, updatedBy);
    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    logger.info('Payment status updated', { paymentId: id, newStatus: status, updatedBy });
    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to update payment status');
  }
};

const addRefund = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { amount, reason, createdBy = req.user.id } = req.body;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);
    if (!payment.canRefund()) {
      return res.status(400).json({ error: 'Payment cannot be refunded' });
    }
    if (amount > payment.refundableAmount) {
      return res.status(400).json({ error: 'Refund amount exceeds refundable amount' });
    }

    await payment.addRefund({ amount, reason, createdBy });
    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    logger.info('Refund added', { paymentId: id, refundAmount: amount });
    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to add refund');
  }
};

const addDispute = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { amount, reason, providerDisputeId } = req.body;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);

    await payment.addDispute({ amount, reason, providerDisputeId });
    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    logger.info('Dispute added', { paymentId: id, disputeAmount: amount });
    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to add dispute');
  }
};

const capturePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { note = 'Payment captured', updatedBy = req.user.role || 'merchant' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);
    if (!payment.canCapture()) {
      return res.status(400).json({ error: 'Payment cannot be captured' });
    }

    await payment.capturePayment(note, updatedBy);
    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    logger.info('Payment captured', { paymentId: id });
    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to capture payment');
  }
};

const getAnalytics = async (req, res) => {
  try {
    const { dateFrom, dateTo, customerId, paymentProvider } = req.query;
    const filters = { dateFrom: dateFrom ? new Date(dateFrom) : undefined, dateTo: dateTo ? new Date(dateTo) : undefined };

    if (customerId && customerId !== req.user.id) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      filters.customerId = customerId;
    }
    if (paymentProvider) filters.paymentProvider = paymentProvider;

    const analytics = await PaymentModel.getAnalytics(filters);
    res.json({ success: true, data: analytics });
  } catch (err) {
    handleError(res, err, 'Failed to fetch analytics');
  }
};

const getSuspiciousPayments = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { limit = 50, minRiskScore = 70 } = req.query;
    const options = { limit: parseInt(limit), minRiskScore: parseInt(minRiskScore) };

    const payments = await PaymentModel.findSuspicious(options);
    res.json({ success: true, data: payments });
  } catch (err) {
    handleError(res, err, 'Failed to fetch suspicious payments');
  }
};

const getPaymentsRequiringAction = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const payments = await PaymentModel.findRequiringAction();
    res.json({ success: true, data: payments });
  } catch (err) {
    handleError(res, err, 'Failed to fetch payments requiring action');
  }
};

const bulkUpdateStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { paymentIds } = req.body;
    const { status, updatedBy = 'admin', note = '' } = req.body;

    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({ error: 'Invalid payment IDs' });
    }

    const result = await PaymentModel.bulkUpdateStatus(paymentIds, status, updatedBy, note);
    logger.info('Bulk status update', { paymentIds: paymentIds.length, newStatus: status });
    res.json({ success: true, data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount } });
  } catch (err) {
    handleError(res, err, 'Failed to bulk update status');
  }
};

const bulkCancelPayments = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { paymentIds } = req.body;
    const { reason = 'Cancelled by system', updatedBy = 'system' } = req.body;

    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({ error: 'Invalid payment IDs' });
    }

    const result = await PaymentModel.bulkCancelPayments(paymentIds, reason, updatedBy);
    logger.info('Bulk cancel', { paymentIds: paymentIds.length });
    res.json({ success: true, data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount } });
  } catch (err) {
    handleError(res, err, 'Failed to bulk cancel payments');
  }
};

const getPaymentSummary = async (req, res) => {
  try {
    const { dateFrom, dateTo, customerId, status, paymentMethod, paymentProvider } = req.query;
    const filters = { dateFrom: dateFrom ? new Date(dateFrom) : undefined, dateTo: dateTo ? new Date(dateTo) : undefined };

    if (customerId && customerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (customerId) filters.customerId = customerId;
    if (status) filters.status = status;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (paymentProvider) filters.paymentProvider = paymentProvider;

    const summary = await PaymentModel.getPaymentSummary(filters);
    res.json({ success: true, data: summary });
  } catch (err) {
    handleError(res, err, 'Failed to fetch payment summary');
  }
};

const getTrackingHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);

    const history = await PaymentModel.getTrackingHistory(id);
    res.json({ success: true, data: history });
  } catch (err) {
    handleError(res, err, 'Failed to fetch tracking history');
  }
};

const getFailedAttemptsSummary = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { dateFrom, dateTo } = req.query;
    const options = { dateFrom: dateFrom ? new Date(dateFrom) : undefined, dateTo: dateTo ? new Date(dateTo) : undefined };

    const summary = await PaymentModel.getFailedAttemptsSummary(options);
    res.json({ success: true, data: summary });
  } catch (err) {
    handleError(res, err, 'Failed to fetch failed attempts summary');
  }
};

const getRecentPayments = async (req, res) => {
  try {
    const { limit = 50, hours = 24 } = req.query;
    const options = { limit: parseInt(limit), hours: parseInt(hours) };

    const payments = await PaymentModel.getRecentPayments(options);
    res.json({ success: true, data: payments });
  } catch (err) {
    handleError(res, err, 'Failed to fetch recent payments');
  }
};

const findByProviderTransactionId = async (req, res) => {
  try {
    const { providerTransactionId } = req.params;

    const payment = await PaymentModel.findByProviderTransactionId(providerTransactionId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (req.user.role !== 'admin' && payment.customerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const formattedPayment = payment.toAPIResponse();
    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err);
  }
};

const findPaymentsByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const { page = 1, limit = 20, status, sortBy = 'createdAt', sortOrder = -1 } = req.query;
    const options = { page: parseInt(page), limit: parseInt(limit), status, sortBy, sortOrder: parseInt(sortOrder) };

    const result = await PaymentModel.findByOrder(orderId, options);
    res.json({ success: true, data: result.payments, pagination: result.pagination });
  } catch (err) {
    handleError(res, err, 'Failed to fetch payments by order');
  }
};

const findPaymentsByPaymentMethod = async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = -1 } = req.query;
    const options = { page: parseInt(page), limit: parseInt(limit), sortBy, sortOrder: parseInt(sortOrder) };

    const result = await PaymentModel.findByPaymentMethod(sourceId, options);
    res.json({ success: true, data: result.payments, pagination: result.pagination });
  } catch (err) {
    handleError(res, err, 'Failed to fetch payments by payment method');
  }
};

const incrementAttempts = async (req, res) => {
  try {
    const { id } = req.params;
    const { note = 'Payment attempt failed' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);

    await payment.incrementAttempts(note);
    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to increment attempts');
  }
};

const markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { note = 'Payment marked as paid' } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);

    await payment.markAsPaid(note);
    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    logger.info('Payment marked as paid', { paymentId: id });
    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to mark payment as paid');
  }
};

const updateMetadata = async (req, res) => {
  try {
    const { id } = req.params;
    const metadataUpdate = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await payment.updateMetadata(metadataUpdate);
    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to update metadata');
  }
};

const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);
    if (payment.status !== 'PENDING' && req.user.role !== 'admin') {
      return res.status(400).json({ error: 'Only pending payments can be deleted' });
    }

    await PaymentModel.deleteOne({ _id: id });
    logger.info('Payment deleted', { paymentId: id });
    res.json({ success: true, message: 'Payment deleted successfully' });
  } catch (err) {
    handleError(res, err, 'Failed to delete payment');
  }
};

const exportPayments = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { page = 1, limit = 1000, status, dateFrom, dateTo } = req.query;
    const options = { page: parseInt(page), limit: parseInt(limit), status, dateFrom, dateTo };

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await PaymentModel.findByCustomer(null, options);
    const payments = result.payments;

    const format = req.query.format || 'json';
    if (format === 'json') {
      res.json({ success: true, data: payments });
    } else if (format === 'csv') {
      const fileName = `payments_export_${Date.now()}.csv`;
      const csv = csvWriter.createObjectCsvWriter({
        path: fileName,
        header: [
          { id: 'paymentId', title: 'Payment ID' },
          { id: 'amount', title: 'Amount' },
          { id: 'status', title: 'Status' },
          { id: 'createdAt', title: 'Created At' },
        ],
      });

      await csv.writeRecords(payments.map(p => ({ ...p, createdAt: p.createdAt.toISOString() })));
      res.download(fileName, (err) => {
        if (err) logger.error('Export error', err);
        fs.unlinkSync(fileName);
      });
    }
  } catch (err) {
    handleError(res, err, 'Failed to export payments');
  }
};

const resolveDispute = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { disputeId, status, resolvedAt = new Date(), note = '' } = req.body;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const dispute = payment.disputes.find(d => d.disputeId === disputeId);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    dispute.status = status;
    dispute.resolvedAt = resolvedAt;
    await payment.save();

    await payment.addTimelineEntry(`Dispute ${status.toLowerCase()}`, note, 'admin', { disputeId });

    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    logger.info('Dispute resolved', { paymentId: id, disputeId, status });
    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to resolve dispute');
  }
};

const updateDisputeStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { disputeId, status, note = '' } = req.body;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const dispute = payment.disputes.find(d => d.disputeId === disputeId);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    dispute.status = status;
    await payment.save();

    await payment.addTimelineEntry(`Dispute status updated to ${status}`, note, 'admin', { disputeId });

    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to update dispute status');
  }
};

const getRecurringPayments = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { page = 1, limit = 20, subscriptionId, status } = req.query;
    const options = { page: parseInt(page), limit: parseInt(limit), status };

    const query = { isRecurring: true };
    if (subscriptionId) query.subscriptionId = subscriptionId;
    if (status) query.status = status;

    const totalCount = await PaymentModel.countDocuments(query);
    const payments = await PaymentModel.find(query)
      .populate('subscriptionId', 'planId status')
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (err) {
    handleError(res, err, 'Failed to fetch recurring payments');
  }
};

const calculateRiskScore = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);

    const riskScore = payment.calculateRiskScore();
    await payment.save();

    await payment.addTimelineEntry('Risk score calculated', `New score: ${riskScore}`, 'system');

    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    res.json({ success: true, data: { riskScore, payment: formattedPayment } });
  } catch (err) {
    handleError(res, err, 'Failed to calculate risk score');
  }
};

const getProcessingTimeStats = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { dateFrom, dateTo } = req.query;
    const matchStage = {
      status: 'COMPLETED',
      createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
    };

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await PaymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          avgProcessingTime: {
            $avg: { $subtract: ['$processedAt', '$createdAt'] }
          },
          maxProcessingTime: {
            $max: { $subtract: ['$processedAt', '$createdAt'] }
          },
          minProcessingTime: {
            $min: { $subtract: ['$processedAt', '$createdAt'] }
          },
          totalPayments: { $sum: 1 }
        }
      },
      {
        $project: {
          avgProcessingTimeMs: '$avgProcessingTime',
          avgProcessingTimeSeconds: { $divide: ['$avgProcessingTime', 1000] },
          maxProcessingTimeMs: '$maxProcessingTime',
          minProcessingTimeMs: '$minProcessingTime',
          totalPayments: 1
        }
      }
    ]);

    res.json({ success: true, data: stats[0] || { totalPayments: 0 } });
  } catch (err) {
    handleError(res, err, 'Failed to fetch processing time stats');
  }
};

const getRefundRates = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { dateFrom, dateTo, paymentProvider } = req.query;
    const matchStage = {
      createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
    };
    if (paymentProvider) matchStage.paymentProvider = paymentProvider;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const rates = await PaymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$paymentProvider',
          totalPayments: { $sum: 1 },
          totalRefundedAmount: {
            $sum: {
              $sum: {
                $filter: {
                  input: '$refunds',
                  cond: { $eq: ['$$this.status', 'COMPLETED'] }
                }
              }
            }
          },
          refundedPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'REFUNDED'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          provider: '$_id',
          refundRate: { $multiply: [{ $divide: ['$refundedPayments', '$totalPayments'] }, 100] },
          avgRefundAmount: { $divide: ['$totalRefundedAmount', { $add: ['$refundedPayments', 1] }] },
          totalPayments: 1
        }
      }
    ]);

    res.json({ success: true, data: rates });
  } catch (err) {
    handleError(res, err, 'Failed to fetch refund rates');
  }
};

const getSuccessRateByProvider = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { dateFrom, dateTo } = req.query;
    const matchStage = {
      createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
    };

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const rates = await PaymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$paymentProvider',
          totalPayments: { $sum: 1 },
          successfulPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          provider: '$_id',
          successRate: { $multiply: [{ $divide: ['$successfulPayments', '$totalPayments'] }, 100] },
          totalPayments: 1,
          successfulPayments: 1
        }
      }
    ]);

    res.json({ success: true, data: rates });
  } catch (err) {
    handleError(res, err, 'Failed to fetch success rates by provider');
  }
};

const getAverageAmountByMethod = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { paymentMethod, dateFrom, dateTo } = req.query;
    const matchStage = {
      createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
    };
    if (paymentMethod) matchStage.paymentMethod = paymentMethod;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const avgs = await PaymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$paymentMethod',
          avgAmount: { $avg: '$amount' },
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({ success: true, data: avgs });
  } catch (err) {
    handleError(res, err, 'Failed to fetch average amounts by method');
  }
};

const getCurrencyBreakdown = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { dateFrom, dateTo } = req.query;
    const matchStage = {
      createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
    };

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const breakdown = await PaymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$currency',
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          successfulPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          currency: '$_id',
          totalPayments: 1,
          totalAmount: 1,
          successRate: { $multiply: [{ $divide: ['$successfulPayments', '$totalPayments'] }, 100] }
        }
      }
    ]);

    res.json({ success: true, data: breakdown });
  } catch (err) {
    handleError(res, err, 'Failed to fetch currency breakdown');
  }
};

const getFeeSummary = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { dateFrom, dateTo, paymentProvider } = req.query;
    const matchStage = {
      createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
    };
    if (paymentProvider) matchStage.paymentProvider = paymentProvider;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const summary = await PaymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalProcessingFees: { $sum: '$fees.processingFee' },
          totalPlatformFees: { $sum: '$fees.platformFee' },
          totalTax: { $sum: '$fees.taxAmount' },
          totalFees: { $sum: '$fees.totalFees' },
          totalPayments: { $sum: 1 }
        }
      },
      {
        $project: {
          totalProcessingFees: 1,
          totalPlatformFees: 1,
          totalTax: 1,
          totalFees: 1,
          avgFeesPerPayment: { $divide: ['$totalFees', { $add: ['$totalPayments', 1] }] }
        }
      }
    ]);

    res.json({ success: true, data: summary[0] || {} });
  } catch (err) {
    handleError(res, err, 'Failed to fetch fee summary');
  }
};

const getDisputeAnalytics = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { dateFrom, dateTo } = req.query;
    const matchStage = {
      'disputes.createdAt': { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
    };

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const analytics = await PaymentModel.aggregate([
      { $match: matchStage },
      { $unwind: '$disputes' },
      {
        $group: {
          _id: '$disputes.status',
          count: { $sum: 1 },
          totalDisputedAmount: { $sum: '$disputes.amount' },
          resolvedCount: { $sum: { $cond: [{ $ne: ['$disputes.resolvedAt', null] }, 1, 0] } }
        }
      }
    ]);

    res.json({ success: true, data: analytics });
  } catch (err) {
    handleError(res, err, 'Failed to fetch dispute analytics');
  }
};

const getTimelineStats = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.query;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);

    let timeline = payment.timeline;
    if (status) {
      timeline = timeline.filter(event => event.status === status);
    }

    const stats = {
      totalEvents: timeline.length,
      uniqueStatuses: [...new Set(timeline.map(e => e.status))],
      avgTimeBetweenEvents: timeline.length > 1 ? 
        timeline.reduce((sum, _, i, arr) => i < arr.length - 1 ? 
          sum + (arr[i+1].timestamp - arr[i].timestamp) : sum, 0) / (timeline.length - 1) : 0,
      eventsByUpdater: timeline.reduce((acc, event) => {
        acc[event.updatedBy] = (acc[event.updatedBy] || 0) + 1;
        return acc;
      }, {})
    };

    res.json({ success: true, data: { stats, timeline } });
  } catch (err) {
    handleError(res, err, 'Failed to fetch timeline stats');
  }
};

const handleWebhook = async (req, res) => {
  try {
    const { providerTransactionId, status, providerPaymentId, providerResponse } = req.body;

    const payment = await PaymentModel.findByProviderTransactionId(providerTransactionId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify signature if needed

    const updateData = {
      status,
      'paymentDetails.providerPaymentId': providerPaymentId,
      'paymentDetails.providerResponse': providerResponse,
      metadata: { ...payment.metadata, webhookReceivedAt: new Date() }
    };

    await payment.updateStatus(status, `Webhook from provider: ${status}`, 'webhook');
    await PaymentModel.updateOne({ _id: payment._id }, updateData);

    logger.info('Webhook processed', { paymentId: payment.paymentId, status });
    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (err) {
    logger.error('Webhook error', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

const addTimelineEntry = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { status, note, updatedBy = 'admin', additionalData = {} } = req.body;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await payment.addTimelineEntry(status, note, updatedBy, additionalData);
    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to add timeline entry');
  }
};

const checkExpired = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);

    const isExpired = payment.isExpired();
    res.json({ success: true, data: { isExpired, expiresAt: payment.expiresAt } });
  } catch (err) {
    handleError(res, err, 'Failed to check expiration');
  }
};

const getTagsUsage = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const usage = await PaymentModel.aggregate([
      {
        $unwind: { path: '$tags', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({ success: true, data: usage });
  } catch (err) {
    handleError(res, err, 'Failed to fetch tags usage');
  }
};

const searchByNotes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { notes, page = 1, limit = 20 } = req.query;

    const payments = await PaymentModel.find({ notes: { $regex: notes, $options: 'i' } })
      .populate('customerId', 'name email')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const totalCount = await PaymentModel.countDocuments({ notes: { $regex: notes, $options: 'i' } });

    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount
      }
    });
  } catch (err) {
    handleError(res, err, 'Failed to search payments by notes');
  }
};

const getPaymentsByTag = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { tag, page = 1, limit = 20 } = req.query;

    const query = { tags: tag };
    const totalCount = await PaymentModel.countDocuments(query);
    const payments = await PaymentModel.find(query)
      .populate('customerId', 'name email')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount
      }
    });
  } catch (err) {
    handleError(res, err, 'Failed to fetch payments by tag');
  }
};

const addTag = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { tag } = req.body;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!payment.tags.includes(tag)) {
      payment.tags.push(tag);
      await payment.save();
      await payment.addTimelineEntry('Tag added', `Added tag: ${tag}`, 'admin');
    }

    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to add tag');
  }
};

const removeTag = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { tag } = req.body;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    payment.tags = payment.tags.filter(t => t !== tag);
    await payment.save();
    await payment.addTimelineEntry('Tag removed', `Removed tag: ${tag}`, 'admin');

    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to remove tag');
  }
};

const updateNotes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { id } = req.params;
    const { notes } = req.body;

    const payment = await PaymentModel.findById(id).populate('customerId');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    checkPaymentOwnership(req, payment);

    payment.notes = notes;
    await payment.save();
    await payment.addTimelineEntry('Notes updated', '', 'admin');

    const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
    const formattedPayment = updatedPayment.toAPIResponse();

    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to update notes');
  }
};

const getFraudFlagsStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await PaymentModel.aggregate([
      { $unwind: { path: '$metadata.fraudFlags', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$metadata.fraudFlags',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({ success: true, data: stats });
  } catch (err) {
    handleError(res, err, 'Failed to fetch fraud flags stats');
  }
};

const bulkAddTags = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { paymentIds, tag } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await PaymentModel.updateMany(
      { _id: { $in: paymentIds } },
      { $addToSet: { tags: tag } }
    );

    logger.info('Bulk tags added', { paymentIds: paymentIds.length, tag });
    res.json({ success: true, data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount } });
  } catch (err) {
    handleError(res, err, 'Failed to bulk add tags');
  }
};

const getPaymentsByCountry = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { country, page = 1, limit = 20 } = req.query;

    const query = { 'billingAddress.country': country };
    const totalCount = await PaymentModel.countDocuments(query);
    const payments = await PaymentModel.find(query)
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount
      }
    });
  } catch (err) {
    handleError(res, err, 'Failed to fetch payments by country');
  }
};

const getPaymentsByCurrency = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { currency, page = 1, limit = 20 } = req.query;

    const query = { currency };
    const totalCount = await PaymentModel.countDocuments(query);
    const payments = await PaymentModel.find(query)
      .populate('customerId', 'name email')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (err) {
    handleError(res, err, 'Failed to fetch payments by currency');
  }
};

const getVolumeByPeriod = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { period = 'day', dateFrom, dateTo } = req.query;
    const matchStage = {
      createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
    };

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let groupBy;
    switch (period) {
      case 'day':
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
      case 'week':
        groupBy = { $dateToString: { format: '%Y-%U', date: '$createdAt' } };
        break;
      case 'month':
        groupBy = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      default:
        return res.status(400).json({ error: 'Invalid period' });
    }

    const volume = await PaymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupBy,
          totalVolume: { $sum: '$amount' },
          paymentCount: { $sum: 1 },
          successfulVolume: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$amount', 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success: true, data: volume });
  } catch (err) {
    handleError(res, err, 'Failed to fetch volume by period');
  }
};

const getTopCustomers = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { limit = 10, dateFrom, dateTo } = req.query;
    const matchStage = {
      createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
      status: 'COMPLETED'
    };

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const topCustomers = await PaymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$customerId',
          totalAmount: { $sum: '$amount' },
          paymentCount: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'customer',
          pipeline: [{ $project: { name: 1, email: 1 } }]
        }
      },
      { $unwind: '$customer' }
    ]);

    res.json({ success: true, data: topCustomers });
  } catch (err) {
    handleError(res, err, 'Failed to fetch top customers');
  }
};

const simulatePaymentFailure = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { paymentId, reason = 'Simulated failure' } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const payment = await PaymentModel.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    await payment.incrementAttempts(reason);
    const updatedPayment = await PaymentModel.findById(paymentId);
    const formattedPayment = updatedPayment.toAPIResponse();

    logger.info('Payment failure simulated', { paymentId, reason });
    res.json({ success: true, data: formattedPayment });
  } catch (err) {
    handleError(res, err, 'Failed to simulate payment failure');
  }
};
const getMethodSuccessRatesOverTime = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { paymentMethod, granularity = 'daily', dateFrom, dateTo } = req.query;
    const matchStage = {};
    if (dateFrom) matchStage.createdAt = { $gte: new Date(dateFrom) };
    if (dateTo) matchStage.createdAt = { ...matchStage.createdAt, $lte: new Date(dateTo) };
    if (paymentMethod) matchStage.paymentMethod = paymentMethod;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    let groupBy;
    switch (granularity) {
      case 'daily':
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
      case 'weekly':
        groupBy = { $dateToString: { format: '%Y-%U', date: '$createdAt' } };
        break;
      case 'monthly':
        groupBy = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      default:
        return res.status(400).json({ error: 'Invalid granularity' });
    }

    const rates = await PaymentModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { period: groupBy, paymentMethod: '$paymentMethod' },
          totalPayments: { $sum: 1 },
          successfulPayments: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          period: '$_id.period',
          paymentMethod: '$_id.paymentMethod',
          successRate: {
            $multiply: [{ $divide: ['$successfulPayments', '$totalPayments'] }, 100]
          },
          totalPayments: 1,
          successfulPayments: 1,
          _id: 0
        }
      },
      { $sort: { period: 1, paymentMethod: 1 } }
    ]);

    res.json({ success: true, data: rates });
  } catch (err) {
    handleError(res, err, 'Failed to fetch success rates over time');
  }
};

const getPaymentsByIP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { ipAddress, page = 1, limit = 20 } = req.query;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const query = { 'metadata.ipAddress': ipAddress };
    const totalCount = await PaymentModel.countDocuments(query);
    const payments = await PaymentModel.find(query)
      .populate('customerId', 'name email')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNextPage: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (err) {
    handleError(res, err, 'Failed to fetch payments by IP address');
  }
};

const bulkProcessRefunds = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { paymentIds, amountPercentage, reason = 'Bulk refund', createdBy = req.user.id } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const payments = await PaymentModel.find({ _id: { $in: paymentIds } });
    if (payments.length !== paymentIds.length) {
      return res.status(404).json({ error: 'One or more payments not found' });
    }

    const results = [];
    for (const payment of payments) {
      if (!payment.canRefund()) {
        results.push({ paymentId: payment._id, status: 'failed', message: 'Payment cannot be refunded' });
        continue;
      }
      const refundAmount = payment.amount * (amountPercentage / 100);
      if (refundAmount > payment.refundableAmount) {
        results.push({ paymentId: payment._id, status: 'failed', message: 'Refund amount exceeds refundable amount' });
        continue;
      }

      await payment.addRefund({ amount: refundAmount, reason, createdBy });
      results.push({ paymentId: payment._id, status: 'success', refundAmount });
    }

    logger.info('Bulk refunds processed', { paymentCount: paymentIds.length, amountPercentage });
    res.json({ success: true, data: results });
  } catch (err) {
    handleError(res, err, 'Failed to process bulk refunds');
  }
};

// Export all controller functions with their validators
module.exports = {
  createPayment: [createPaymentValidator, createPayment],
  getPaymentById,
  listPayments: [getPaymentsValidator, listPayments],
  updatePaymentStatus: [updateStatusValidator, updatePaymentStatus],
  addRefund: [addRefundValidator, addRefund],
  addDispute: [addRefundValidator, addDispute], // Reusing addRefundValidator as it fits
  capturePayment,
  getAnalytics,
  getSuspiciousPayments,
  getPaymentsRequiringAction,
  bulkUpdateStatus,
  bulkCancelPayments,
  getPaymentSummary,
  getTrackingHistory,
  getFailedAttemptsSummary,
  getRecentPayments,
  findByProviderTransactionId,
  findPaymentsByOrder,
  findPaymentsByPaymentMethod,
  incrementAttempts,
  markAsPaid,
  updateMetadata,
  deletePayment,
  exportPayments: [exportPaymentsValidator, exportPayments],
  resolveDispute: [resolveDisputeValidator, resolveDispute],
  updateDisputeStatus: [updateDisputeValidator, updateDisputeStatus],
  getRecurringPayments: [getRecurringPaymentsValidator, getRecurringPayments],
  calculateRiskScore: [calculateRiskScoreValidator, calculateRiskScore],
  getProcessingTimeStats: [getProcessingTimeStatsValidator, getProcessingTimeStats],
  getRefundRates: [getRefundRatesValidator, getRefundRates],
  getSuccessRateByProvider: [getSuccessRateByProviderValidator, getSuccessRateByProvider],
  getAverageAmountByMethod: [getAverageAmountByMethodValidator, getAverageAmountByMethod],
  getCurrencyBreakdown: [getCurrencyBreakdownValidator, getCurrencyBreakdown],
  getFeeSummary: [getFeeSummaryValidator, getFeeSummary],
  getDisputeAnalytics: [getDisputeAnalyticsValidator, getDisputeAnalytics],
  getTimelineStats: [getTimelineStatsValidator, getTimelineStats],
  handleWebhook,
  addTimelineEntry: [addTimelineEntryValidator, addTimelineEntry],
  checkExpired,
  getTagsUsage,
  searchByNotes: [searchByNotesValidator, searchByNotes],
  getPaymentsByTag: [getPaymentsByTagValidator, getPaymentsByTag],
  addTag: [addTagValidator, addTag],
  removeTag: [removeTagValidator, removeTag],
  updateNotes: [updateNotesValidator, updateNotes],
  getFraudFlagsStats,
  bulkAddTags: [bulkAddTagsValidator, bulkAddTags],
  getPaymentsByCountry: [getPaymentsByCountryValidator, getPaymentsByCountry],
  getPaymentsByCurrency: [getPaymentsByCurrencyValidator, getPaymentsByCurrency],
  getVolumeByPeriod: [getVolumeByPeriodValidator, getVolumeByPeriod],
  getTopCustomers: [getTopCustomersValidator, getTopCustomers],
  simulatePaymentFailure: [simulatePaymentFailureValidator, simulatePaymentFailure],
  getMethodSuccessRatesOverTime: [getMethodSuccessRatesOverTimeValidator, getMethodSuccessRatesOverTime],
  getPaymentsByIP: [getPaymentsByIPValidator, getPaymentsByIP],
  bulkProcessRefunds: [bulkProcessRefundsValidator, bulkProcessRefunds]
};