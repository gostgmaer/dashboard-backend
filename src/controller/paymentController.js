const { PaymentModel, Payment } = require('../models/payment'); // Adjust path as needed
const Order = require('../models/orders');
const TransactionLog = require('../models/TransactionLog');
const PaypalService = require('../services/payment/PaypalService');
const RazorpayService = require('../services/payment/RazorpayService');
const StripeService = require('../services/payment/StripeService');
const { body, query, param } = require('express-validator');
const { validationResult } = require('express-validator');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../utils/apiUtils');
const mongoose = require('mongoose');
const fs = require('fs');
const { client } = require('../config/setting');

let csvWriter = null;
try {
  csvWriter = require('csv-writer');
} catch (error) {
  console.warn('csv-writer is not installed. CSV export will be unavailable.');
}

const safeApiCall = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res, next);
  } catch (error) {
    return handleError(res, error, error.message || 'Internal server error');
  }
};

const createGatewayClient = (ServiceClass, gatewayName) => {
  try {
    return new ServiceClass();
  } catch (error) {
    console.error(`Failed to initialize ${gatewayName} gateway client:`, error.message);
    return null;
  }
};

// Validation Functions
const createPaymentValidator = [body('orderId').isMongoId().withMessage('Invalid order ID'), body('amount').isFloat({ min: 0 }).toFloat().withMessage('Amount must be a positive number'), body('currency').isIn(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']).withMessage('Invalid currency'), body('paymentMethod').isIn(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'UPI']).withMessage('Invalid payment method'), body('paymentProvider').optional().isIn(['STRIPE', 'PAYPAL', 'RAZORPAY', 'INTERNAL']).withMessage('Invalid payment provider'), body('metadata').optional().isObject().withMessage('Metadata must be an object'), body('billingAddress').optional().isObject().withMessage('Billing address must be an object'), body('billingAddress.country').optional().isString().withMessage('Country must be a string')];

const updateStatusValidator = [param('id').isMongoId().withMessage('Invalid payment ID'), body('status').isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'), body('note').optional().isString().trim().withMessage('Note must be a string')];

const addRefundValidator = [param('id').isMongoId().withMessage('Invalid payment ID'), body('amount').isFloat({ min: 0 }).toFloat().withMessage('Refund amount must be a positive number'), body('reason').optional().isString().trim().withMessage('Reason must be a string')];

const getPaymentsValidator = [query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'), query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100'), query('status').optional().isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'), query('paymentMethod').optional().isIn(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'UPI']).withMessage('Invalid payment method'), query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'), query('sortBy').optional().isIn(['createdAt', 'amount', 'status']).withMessage('Invalid sortBy field'), query('sortOrder').optional().isIn(['1', '-1']).toInt().withMessage('SortOrder must be 1 or -1')];

const exportPaymentsValidator = [query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'), query('status').optional().isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'), query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'), query('limit').optional().isInt({ min: 1, max: 1000 }).toInt().withMessage('Limit must be between 1 and 1000'), query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format')];

const resolveDisputeValidator = [param('id').isMongoId().withMessage('Invalid payment ID'), body('disputeId').isString().trim().notEmpty().withMessage('Dispute ID must be a non-empty string'), body('status').isIn(['WON', 'LOST']).withMessage('Dispute status must be WON or LOST'), body('resolvedAt').optional().isISO8601().toDate().withMessage('Invalid resolvedAt format'), body('note').optional().isString().trim().withMessage('Note must be a string')];

const updateDisputeValidator = [param('id').isMongoId().withMessage('Invalid payment ID'), body('disputeId').isString().trim().notEmpty().withMessage('Dispute ID must be a non-empty string'), body('status').isIn(['OPEN', 'WON', 'LOST', 'PENDING']).withMessage('Invalid dispute status'), body('note').optional().isString().trim().withMessage('Note must be a string')];

const getRecurringPaymentsValidator = [query('subscriptionId').optional().isMongoId().withMessage('Invalid subscription ID'), query('status').optional().isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'), query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'), query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100')];

const calculateRiskScoreValidator = [param('id').isMongoId().withMessage('Invalid payment ID')];

const getProcessingTimeStatsValidator = [query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format')];

const getRefundRatesValidator = [query('paymentProvider').optional().isIn(['STRIPE', 'PAYPAL', 'RAZORPAY', 'INTERNAL']).withMessage('Invalid payment provider'), query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format')];

const getSuccessRateByProviderValidator = [query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format')];

const getAverageAmountByMethodValidator = [query('paymentMethod').optional().isIn(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'UPI']).withMessage('Invalid payment method'), query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format')];

const getCurrencyBreakdownValidator = [query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format')];

const getFeeSummaryValidator = [query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format'), query('paymentProvider').optional().isIn(['STRIPE', 'PAYPAL', 'RAZORPAY', 'INTERNAL']).withMessage('Invalid payment provider')];

const getDisputeAnalyticsValidator = [query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format')];

const getTimelineStatsValidator = [param('id').isMongoId().withMessage('Invalid payment ID'), query('status').optional().isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status')];

const getPaymentsByCurrencyValidator = [query('currency').isIn(['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']).withMessage('Invalid currency'), query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'), query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100')];

const getVolumeByPeriodValidator = [query('period').isIn(['day', 'week', 'month']).withMessage('Period must be day, week, or month'), query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format')];

const getTopCustomersValidator = [query('limit').optional().isInt({ min: 1, max: 50 }).toInt().withMessage('Limit must be between 1 and 50'), query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format')];

const simulatePaymentFailureValidator = [body('paymentId').isMongoId().withMessage('Invalid payment ID'), body('reason').optional().isString().trim().withMessage('Reason must be a string')];

const getMethodSuccessRatesOverTimeValidator = [query('paymentMethod').optional().isIn(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'UPI']).withMessage('Invalid payment method'), query('granularity').isIn(['daily', 'weekly', 'monthly']).withMessage('Granularity must be daily, weekly, or monthly'), query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format'), query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format')];

const getPaymentsByIPValidator = [query('ipAddress').isIP().withMessage('Invalid IP address'), query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'), query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100')];

const bulkProcessRefundsValidator = [body('paymentIds').isArray({ min: 1 }).withMessage('Payment IDs must be a non-empty array'), body('paymentIds.*').isMongoId().withMessage('Each payment ID must be a valid MongoID'), body('amountPercentage').isFloat({ min: 0, max: 100 }).toFloat().withMessage('Amount percentage must be between 0 and 100'), body('reason').optional().isString().trim().withMessage('Reason must be a string')];

const addTagValidator = [param('id').isMongoId().withMessage('Invalid payment ID'), body('tag').isString().trim().notEmpty().withMessage('Tag must be a non-empty string')];

const removeTagValidator = [param('id').isMongoId().withMessage('Invalid payment ID'), body('tag').isString().trim().notEmpty().withMessage('Tag must be a non-empty string')];

const updateNotesValidator = [param('id').isMongoId().withMessage('Invalid payment ID'), body('notes').isString().trim().withMessage('Notes must be a string')];

const addTimelineEntryValidator = [param('id').isMongoId().withMessage('Invalid payment ID'), body('status').isIn(['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']).withMessage('Invalid status'), body('note').optional().isString().trim().withMessage('Note must be a string'), body('updated_by').optional().isString().trim().withMessage('updated_by must be a string'), body('additionalData').optional().isObject().withMessage('Additional data must be an object')];

const bulkAddTagsValidator = [body('paymentIds').isArray({ min: 1 }).withMessage('Payment IDs must be a non-empty array'), body('paymentIds.*').isMongoId().withMessage('Each payment ID must be a valid MongoID'), body('tag').isString().trim().notEmpty().withMessage('Tag must be a non-empty string')];

const getPaymentsByCountryValidator = [query('country').isString().trim().notEmpty().withMessage('Country must be a non-empty string'), query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'), query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100')];

const searchByNotesValidator = [query('notes').isString().trim().notEmpty().withMessage('Notes must be a non-empty string'), query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'), query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100')];

const getPaymentsByTagValidator = [query('tag').isString().trim().notEmpty().withMessage('Tag must be a non-empty string'), query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer'), query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100')];

// Helper function to handle errors
const handleError = (res, err, defaultMessage = 'Internal server error') => {
  //logger.error(err.message, { stack: err.stack });
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

// PaymentController class
class PaymentController {
  // Static services for gateway operations (from Artifact B)
  static paypalService = createGatewayClient(PaypalService, 'paypal');
  static razorpayService = createGatewayClient(RazorpayService, 'razorpay');
  static stripeService = createGatewayClient(StripeService, 'stripe');

  static getIdempotencyKey(req) {
    const rawValue = req.headers['idempotency-key'] || req.body?.idempotencyKey || '';
    return String(rawValue).trim().slice(0, 128);
  }

  // POST /payment/initiate
  static initiatePayment = safeApiCall(async (req, res) => {
    const { orderId, gateway, amount, currency, returnUrl, cancelUrl } = req.body;
    const normalizedAmount = Number(amount);
    const gatewayLower = String(gateway || '').toLowerCase();
    const gatewayUpper = gatewayLower.toUpperCase();
    const idempotencyKey = this.getIdempotencyKey(req);

    const respondWithExistingPayment = (existing, message = 'Idempotent replay detected, returning existing payment') =>
      res.status(200).json({
        success: true,
        message,
        payment: {
          paymentId: existing.paymentId,
          gatewayPaymentId: existing.gatewayPaymentId,
          status: existing.status,
          gateway: existing.gateway,
          amount: existing.amount,
          currency: existing.currency,
        },
      });

    // Validate required fields
    if (!orderId || !gateway || Number.isNaN(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid required fields: orderId, gateway, amount',
      });
    }

    // Validate gateway
    const supportedGateways = ['paypal', 'razorpay', 'stripe', 'cod'];
    if (!supportedGateways.includes(gatewayLower)) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported payment gateway',
      });
    }

    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Validate payment amount matches order total
    if (Math.abs(normalizedAmount - order.total) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (${normalizedAmount}) does not match order total (${order.total})`,
      });
    }

    // Check if payment already exists for this order
    if (idempotencyKey) {
      const idempotentPayment = await Payment.findOne({
        orderId,
        'metadata.idempotencyKey': idempotencyKey,
      });

      if (idempotentPayment) {
        return respondWithExistingPayment(idempotentPayment);
      }
    }

    const existingPayment = await Payment.findOne({
      orderId,
      status: { $in: ['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED'] },
    });

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: 'Payment already exists for this order',
        payment: existingPayment,
      });
    }

    // Generate unique payment ID
    const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Handle COD payments
    if (gatewayLower === 'cod') {
      const payment = new Payment({
        orderId,
        paymentId,
        gateway: 'COD',
        amount: normalizedAmount,
        currency: currency || 'INR',
        status: 'PENDING',
        method: 'COD',
        metadata: {
          idempotencyKey: idempotencyKey || undefined,
        },
      });

      try {
        await payment.save();
      } catch (saveError) {
        if (saveError?.code === 11000 && idempotencyKey) {
          const existingByKey = await Payment.findOne({ orderId, 'metadata.idempotencyKey': idempotencyKey });
          if (existingByKey) {
            return respondWithExistingPayment(existingByKey);
          }
        }
        throw saveError;
      }

      // Log transaction
      await this.logTransaction({
        orderId,
        paymentId: payment._id,
        eventType: 'payment_initiated',
        gateway: 'cod',
        status: 'pending',
        data: { amount: normalizedAmount, currency },
      });

      return res.json({
        success: true,
        message: 'COD payment initiated',
        payment: {
          paymentId: payment.paymentId,
          status: payment.status,
          gateway: payment.gateway,
          amount: payment.amount,
          currency: payment.currency,
        },
      });
    }

    // Create payment record
    const payment = new Payment({
      orderId,
      paymentId,
      gateway: gatewayUpper,
      amount: normalizedAmount,
      currency: currency || (gatewayLower === 'razorpay' ? 'INR' : 'USD'),
      status: 'PENDING',
      method: this.determinePaymentMethod(req.body.method),
      metadata: {
        idempotencyKey: idempotencyKey || undefined,
      },
    });

    try {
      await payment.save();
    } catch (saveError) {
      if (saveError?.code === 11000 && idempotencyKey) {
        const existingByKey = await Payment.findOne({ orderId, 'metadata.idempotencyKey': idempotencyKey });
        if (existingByKey) {
          return respondWithExistingPayment(existingByKey);
        }
      }
      throw saveError;
    }

    // Prepare payment data
    const paymentData = {
      orderId,
      paymentId,
      amount: normalizedAmount,
      currency: payment.currency,
      returnUrl: returnUrl || `${client.url}/payment/success`,
      cancelUrl: cancelUrl || `${client.url}/payment/cancel`,
      description: `Payment for Order #${order.orderNumber || orderId}`,
      customerEmail: req.user?.email,
    };

    let result;

    // Process payment based on gateway
    switch (gatewayLower) {
      case 'paypal':
        result = await this.paypalService.createPayment(paymentData);
        break;
      case 'razorpay':
        result = await this.razorpayService.createPayment(paymentData);
        break;
      case 'stripe':
        result = await this.stripeService.createPayment(paymentData);
        break;
    }

    if (result.success) {
      // Update payment with gateway response
      payment.gatewayPaymentId = result.paymentId;
      payment.status = 'PROCESSING';
      payment.metadata = result.data;
      if (idempotencyKey) {
        payment.metadata = { ...payment.metadata, idempotencyKey };
      }
      await payment.save();

      // Log transaction
      await this.logTransaction({
        orderId,
        paymentId: payment._id,
        eventType: 'payment_initiated',
        gateway,
        status: 'processing',
        data: result.data,
      });

      return res.json({
        success: true,
        message: 'Payment initiated successfully',
        payment: {
          paymentId: payment.paymentId,
          gatewayPaymentId: result.paymentId,
          status: 'PROCESSING',
          gateway: gatewayUpper,
          amount: normalizedAmount,
          currency: payment.currency,
          approvalUrl: result.approvalUrl,
          clientSecret: result.clientSecret,
        },
      });
    } else {
      // Update payment status to failed
      payment.status = 'FAILED';
      payment.failureReason = result.error;
      await payment.save();

      // Log failed transaction
      await this.logTransaction({
        orderId,
        paymentId: payment._id,
        eventType: 'payment_failed',
        gateway,
        status: 'failed',
        errorDetails: result.error,
      });

      return res.status(400).json({
        success: false,
        message: 'Payment initiation failed',
        error: result.error,
      });
    }
  });

  // POST /payment/verify
  static verifyPayment = safeApiCall(async (req, res) => {
    const { paymentId, gatewayPaymentId, signature } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required',
      });
    }

    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    if (payment.status === 'COMPLETED') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        payment: {
          paymentId: payment.paymentId,
          status: payment.status,
          amount: payment.amount,
          gateway: payment.gateway,
          completedAt: payment.completedAt,
        },
      });
    }

    const gatewayLower = String(payment.gateway || '').toLowerCase();
    const resolvedGatewayPaymentId = gatewayPaymentId || payment.gatewayPaymentId;

    let verificationResult;

    switch (gatewayLower) {
      case 'razorpay':
        if (!signature) {
          return res.status(400).json({
            success: false,
            message: 'Signature is required for Razorpay verification',
          });
        }
        if (!resolvedGatewayPaymentId || !payment.gatewayPaymentId) {
          return res.status(400).json({
            success: false,
            message: 'Gateway payment ID is required for Razorpay verification',
          });
        }
        const isValid = this.razorpayService.verifyPaymentSignature(payment.gatewayPaymentId, resolvedGatewayPaymentId, signature);
        verificationResult = { success: isValid };
        break;

      case 'paypal':
        if (!resolvedGatewayPaymentId) {
          return res.status(400).json({
            success: false,
            message: 'Gateway payment ID is required for PayPal verification',
          });
        }
        verificationResult = await this.paypalService.capturePayment(resolvedGatewayPaymentId);
        break;

      case 'stripe':
        if (!resolvedGatewayPaymentId) {
          return res.status(400).json({
            success: false,
            message: 'Gateway payment ID is required for Stripe verification',
          });
        }
        verificationResult = await this.stripeService.getPaymentStatus(resolvedGatewayPaymentId);
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported gateway for verification',
        });
    }

    if (verificationResult.success) {
      const session = await mongoose.startSession();
      let updatedPayment = null;

      try {
        await session.withTransaction(async () => {
          const paymentDoc = await Payment.findById(payment._id).session(session);
          if (!paymentDoc) {
            throw new Error('Payment not found during verification update');
          }

          if (paymentDoc.status === 'COMPLETED') {
            updatedPayment = paymentDoc;
            return;
          }

          paymentDoc.status = 'COMPLETED';
          paymentDoc.completedAt = new Date();
          paymentDoc.metadata = { ...paymentDoc.metadata, verification: verificationResult.data };
          await paymentDoc.save({ session });
          updatedPayment = paymentDoc;

          await Order.findByIdAndUpdate(
            paymentDoc.orderId,
            {
              payment_status: 'paid',
              paymentStatus: 'paid',
              status: 'processing',
            },
            { session }
          );

          await this.logTransaction({
            orderId: paymentDoc.orderId,
            paymentId: paymentDoc._id,
            eventType: 'payment_completed',
            gateway: paymentDoc.gateway,
            status: 'completed',
            data: verificationResult.data,
            session,
          });
        });
      } finally {
        session.endSession();
      }

      return res.json({
        success: true,
        message: 'Payment verified and completed successfully',
        payment: {
          paymentId: updatedPayment.paymentId,
          status: updatedPayment.status,
          amount: updatedPayment.amount,
          gateway: updatedPayment.gateway,
          completedAt: updatedPayment.completedAt,
        },
      });
    } else {
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          const paymentDoc = await Payment.findById(payment._id).session(session);
          if (!paymentDoc) {
            throw new Error('Payment not found during verification failure update');
          }

          paymentDoc.status = 'FAILED';
          paymentDoc.failureReason = verificationResult.error;
          await paymentDoc.save({ session });

          await Order.findByIdAndUpdate(
            paymentDoc.orderId,
            {
              payment_status: 'failed',
              paymentStatus: 'failed',
              status: 'payment-failed',
            },
            { session }
          );

          await this.logTransaction({
            orderId: paymentDoc.orderId,
            paymentId: paymentDoc._id,
            eventType: 'payment_failed',
            gateway: paymentDoc.gateway,
            status: 'failed',
            errorDetails: verificationResult.error,
            session,
          });
        });
      } finally {
        session.endSession();
      }

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        error: verificationResult.error,
      });
    }
  });

  // POST /payment/retry
  static retryPayment = safeApiCall(async (req, res) => {
    const { paymentId, gateway } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required',
      });
    }

    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    // Check if payment can be retried
    if (!payment.canRetry) {
      return res.status(400).json({
        success: false,
        message: 'Payment cannot be retried. Maximum retry limit reached or retry cooldown active.',
      });
    }

    // Use new gateway if provided, otherwise use original
    const retryGatewayLower = String(gateway || payment.gateway || '').toLowerCase();
    const retryGatewayUpper = retryGatewayLower.toUpperCase();

    if (retryGatewayLower === 'cod') {
      return res.status(400).json({
        success: false,
        message: 'COD payments cannot be retried',
      });
    }

    // Increment retry count
    const session = await mongoose.startSession();
    let retryPaymentDoc = null;

    try {
      await session.withTransaction(async () => {
        const paymentDoc = await Payment.findOne({ paymentId }).session(session);
        if (!paymentDoc) {
          throw new Error('Payment not found');
        }

        if (!paymentDoc.canRetry) {
          throw new Error('Payment cannot be retried. Maximum retry limit reached or retry cooldown active.');
        }

        paymentDoc.retryCount += 1;
        paymentDoc.lastRetryAt = new Date();
        paymentDoc.status = 'PROCESSING';

        if (gateway && retryGatewayUpper !== String(paymentDoc.gateway || '').toUpperCase()) {
          paymentDoc.gateway = retryGatewayUpper;
          paymentDoc.gatewayPaymentId = null; // Reset gateway payment ID
        }

        await paymentDoc.save({ session });

        await Order.findByIdAndUpdate(
          paymentDoc.orderId,
          {
            paymentStatus: 'pending',
            payment_status: 'pending',
            status: 'processing',
          },
          { session }
        );

        retryPaymentDoc = paymentDoc;
      });
    } finally {
      session.endSession();
    }

    // Get order details for retry
    const order = await Order.findById(retryPaymentDoc.orderId);

    const paymentData = {
      orderId: retryPaymentDoc.orderId.toString(),
      paymentId: retryPaymentDoc.paymentId,
      amount: retryPaymentDoc.amount,
      currency: retryPaymentDoc.currency,
      returnUrl: `${client.url}/payment/success`,
      cancelUrl: `${client.url}/payment/cancel`,
      description: `Retry Payment for Order #${order.orderNumber || retryPaymentDoc.orderId}`,
      customerEmail: req.user?.email,
    };

    let result;

    // Process retry payment
    switch (retryGatewayLower) {
      case 'paypal':
        result = await this.paypalService.createPayment(paymentData);
        break;
      case 'razorpay':
        result = await this.razorpayService.createPayment(paymentData);
        break;
      case 'stripe':
        result = await this.stripeService.createPayment(paymentData);
        break;
    }

    if (result.success) {
      // Update payment with new gateway response
      const updateSession = await mongoose.startSession();
      try {
        await updateSession.withTransaction(async () => {
          const paymentDoc = await Payment.findOne({ paymentId }).session(updateSession);
          if (!paymentDoc) {
            throw new Error('Payment not found');
          }

          paymentDoc.gatewayPaymentId = result.paymentId;
          paymentDoc.metadata = { ...paymentDoc.metadata, retry: result.data };
          await paymentDoc.save({ session: updateSession });

          await this.logTransaction({
            orderId: paymentDoc.orderId,
            paymentId: paymentDoc._id,
            eventType: 'retry_attempted',
            gateway: retryGatewayLower,
            status: 'processing',
            data: { retryCount: paymentDoc.retryCount, ...result.data },
            session: updateSession,
          });
        });
      } finally {
        updateSession.endSession();
      }

      return res.json({
        success: true,
        message: 'Payment retry initiated successfully',
        payment: {
          paymentId: retryPaymentDoc.paymentId,
          gatewayPaymentId: result.paymentId,
          gateway: retryGatewayUpper,
          retryCount: retryPaymentDoc.retryCount,
          status: 'PROCESSING',
          approvalUrl: result.approvalUrl,
          clientSecret: result.clientSecret,
        },
      });
    } else {
      // Update payment status back to failed
      const failSession = await mongoose.startSession();
      try {
        await failSession.withTransaction(async () => {
          const paymentDoc = await Payment.findOne({ paymentId }).session(failSession);
          if (!paymentDoc) {
            throw new Error('Payment not found');
          }

          paymentDoc.status = 'FAILED';
          paymentDoc.failureReason = result.error;
          await paymentDoc.save({ session: failSession });

          await Order.findByIdAndUpdate(
            paymentDoc.orderId,
            {
              paymentStatus: 'failed',
              payment_status: 'failed',
            },
            { session: failSession }
          );

          await this.logTransaction({
            orderId: paymentDoc.orderId,
            paymentId: paymentDoc._id,
            eventType: 'retry_attempted',
            gateway: retryGatewayLower,
            status: 'failed',
            errorDetails: result.error,
            data: { retryCount: paymentDoc.retryCount },
            session: failSession,
          });
        });
      } finally {
        failSession.endSession();
      }

      return res.status(400).json({
        success: false,
        message: 'Payment retry failed',
        error: result.error,
        retryCount: retryPaymentDoc.retryCount,
      });
    }
  });

  // POST /payment/refund - UPDATED FOR INTEGRATED REFUNDS
  static processRefund = safeApiCall(async (req, res) => {
    const { paymentId, amount, reason, description } = req.body;
    const normalizedAmount = Number(amount);

    if (!paymentId || Number.isNaN(normalizedAmount) || normalizedAmount <= 0 || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: paymentId, amount, reason',
      });
    }

    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    const supportedRefundGateways = ['PAYPAL', 'RAZORPAY', 'STRIPE'];
    const refundGatewayLower = String(payment.gateway || '').toLowerCase();
    if (!supportedRefundGateways.includes(String(payment.gateway || '').toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Gateway ${payment.gateway} does not support refunds`,
      });
    }

    // Check if refund is possible
    const refundCheck = payment.canRefund(normalizedAmount);
    if (!refundCheck.canRefund) {
      return res.status(400).json({
        success: false,
        message: refundCheck.reason,
      });
    }

    const refundId = `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const refundData = {
      refundId,
      amount: normalizedAmount,
      currency: payment.currency,
      reason,
      description,
    };

    let result;

    // Process refund based on gateway
    switch (refundGatewayLower) {
      case 'paypal':
        result = await this.paypalService.refundPayment(payment.gatewayPaymentId, refundData);
        break;
      case 'razorpay':
        result = await this.razorpayService.refundPayment(payment.gatewayPaymentId, refundData);
        break;
      case 'stripe':
        result = await this.stripeService.refundPayment(payment.gatewayPaymentId, refundData);
        break;
    }

    if (result.success) {
      const normalizedRefundStatus = result.status === 'succeeded' || result.status === 'processed' ? 'COMPLETED' : 'PROCESSING';
      const session = await mongoose.startSession();
      let updatedRefund = null;
      let updatedPayment = null;

      try {
        await session.withTransaction(async () => {
          const paymentDoc = await Payment.findOne({ paymentId }).session(session);
          if (!paymentDoc) {
            throw new Error('Payment not found while applying refund');
          }

          const createdRefund = paymentDoc.addRefund({
            amount: normalizedAmount,
            reason,
            description,
          });
          createdRefund.refundId = refundId;

          paymentDoc.updateRefundStatus(createdRefund.refundId, normalizedRefundStatus, result.refundId, result.data);
          await paymentDoc.save({ session });

          updatedRefund = paymentDoc.getRefund(createdRefund.refundId);
          updatedPayment = paymentDoc;

          if (normalizedRefundStatus === 'COMPLETED') {
            const isFullyRefunded = paymentDoc.totalRefunded >= paymentDoc.amount;
            const paymentState = isFullyRefunded ? 'refunded' : 'partial';
            const orderUpdate = {
              payment_status: paymentState,
              paymentStatus: paymentState,
            };

            if (isFullyRefunded) {
              orderUpdate.status = 'refunded';
            }

            await Order.findByIdAndUpdate(paymentDoc.orderId, orderUpdate, { session });
          }

          await this.logTransaction({
            orderId: paymentDoc.orderId,
            paymentId: paymentDoc._id,
            eventType: 'refund_initiated',
            gateway: paymentDoc.gateway,
            status: normalizedRefundStatus.toLowerCase(),
            data: { refundId, ...result.data },
            session,
          });
        });
      } finally {
        session.endSession();
      }

      return res.json({
        success: true,
        message: 'Refund processed successfully',
        refund: {
          refundId: updatedRefund.refundId,
          amount: updatedRefund.amount,
          status: updatedRefund.status,
          gatewayRefundId: updatedRefund.gatewayRefundId,
          reason: updatedRefund.reason,
        },
        payment: {
          paymentId: updatedPayment.paymentId,
          status: updatedPayment.status,
          totalRefunded: updatedPayment.totalRefunded,
          refundableAmount: updatedPayment.refundableAmount,
        },
      });
    } else {
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          const paymentDoc = await Payment.findOne({ paymentId }).session(session);
          if (!paymentDoc) {
            throw new Error('Payment not found while handling refund failure');
          }

          const failedRefund = paymentDoc.addRefund({
            amount: normalizedAmount,
            reason,
            description,
          });
          failedRefund.refundId = refundId;

          paymentDoc.updateRefundStatus(failedRefund.refundId, 'FAILED');
          const failedDoc = paymentDoc.getRefund(failedRefund.refundId);
          failedDoc.failureReason = result.error;
          await paymentDoc.save({ session });

          await this.logTransaction({
            orderId: paymentDoc.orderId,
            paymentId: paymentDoc._id,
            eventType: 'refund_failed',
            gateway: paymentDoc.gateway,
            status: 'failed',
            errorDetails: result.error,
            data: { refundId },
            session,
          });
        });
      } finally {
        session.endSession();
      }

      return res.status(400).json({
        success: false,
        message: 'Refund processing failed',
        error: result.error,
        refund: {
          refundId,
          status: 'failed',
          failureReason: result.error,
        },
      });
    }
  });

  // GET /payment/:paymentId - Get payment details with refunds
  static getPaymentDetails = safeApiCall(async (req, res) => {
    const { paymentId } = req.params;

    const payment = await Payment.findOne({ paymentId }).populate('orderId', 'orderNumber status').select('+refunds');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    return res.json({
      success: true,
      payment: {
        paymentId: payment.paymentId,
        orderId: payment.orderId,
        gateway: payment.gateway,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        completedAt: payment.completedAt,
        refunds: payment.refunds,
        totalRefunded: payment.totalRefunded,
        refundableAmount: payment.refundableAmount,
        refundStatus: payment.refundStatus,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      },
    });
  });

  static async createPayment(req, res) {
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

      // logger.info('Payment created', { paymentId: payment.paymentId, customerId: req.user.id });
      res.status(201).json({ success: true, data: formattedPayment });
    } catch (err) {
      handleError(res, err, 'Failed to create payment');
    }
  }

  // Helper: Determine payment method (from Artifact B)
  static determinePaymentMethod(method) {
    const methodMap = {
      card: 'CREDIT_CARD',
      credit_card: 'CREDIT_CARD',
      debit_card: 'DEBIT_CARD',
      netbanking: 'BANK_TRANSFER',
      bank_transfer: 'BANK_TRANSFER',
      wallet: 'DIGITAL_WALLET',
      upi: 'UPI',
      paypal: 'PAYPAL',
      cod: 'COD',
    };

    return methodMap[String(method || '').toLowerCase()] || 'CREDIT_CARD';
  }

  // Helper: Log transaction (from Artifact B)
  static async logTransaction(logData) {
    try {
      const normalizedGateway = String(logData.gateway || '').toLowerCase();
      const transactionLog = new TransactionLog({
        orderId: logData.orderId,
        paymentId: logData.paymentId,
        eventType: logData.eventType,
        gateway: normalizedGateway,
        status: logData.status,
        previousStatus: logData.previousStatus,
        data: logData.data,
        errorDetails: logData.errorDetails,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
      });

      if (logData.session) {
        await transactionLog.save({ session: logData.session });
      } else {
        await transactionLog.save();
      }
    } catch (error) {
      //logger.error('Failed to log transaction', { error });
    }
  }

  static async getPaymentById(req, res) {
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
  }

  static async listPayments(req, res) {
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
  }

  static async updatePaymentStatus(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { id } = req.params;
      const { status, note = '', updated_by = req.user.role || 'customer' } = req.body;

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

      const session = await mongoose.startSession();
      let updatedPayment = null;

      try {
        await session.withTransaction(async () => {
          const paymentDoc = await PaymentModel.findById(id).session(session).populate('customerId');
          if (!paymentDoc) {
            throw new Error('Payment not found');
          }

          checkPaymentOwnership(req, paymentDoc);

          paymentDoc.updateStatus(status, note, updated_by);
          await paymentDoc.save({ session });

          const orderUpdate = {};
          if (status === 'COMPLETED') {
            orderUpdate.payment_status = 'paid';
            orderUpdate.paymentStatus = 'paid';
            orderUpdate.status = 'processing';
          } else if (status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED') {
            orderUpdate.payment_status = 'failed';
            orderUpdate.paymentStatus = 'failed';
          }

          if (Object.keys(orderUpdate).length > 0) {
            await Order.findByIdAndUpdate(paymentDoc.orderId, orderUpdate, { session });
          }

          updatedPayment = paymentDoc;
        });
      } finally {
        session.endSession();
      }

      const formattedPayment = updatedPayment.toAPIResponse();

      // logger.info('Payment status updated', { paymentId: id, newStatus: status, updated_by });
      res.json({ success: true, data: formattedPayment });
    } catch (err) {
      handleError(res, err, 'Failed to update payment status');
    }
  }

  static async addRefund(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { id } = req.params;
      const { amount, reason, created_by = req.user.id } = req.body;

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

      const session = await mongoose.startSession();
      let updatedPayment = null;

      try {
        await session.withTransaction(async () => {
          const paymentDoc = await PaymentModel.findById(id).session(session).populate('customerId');
          if (!paymentDoc) {
            throw new Error('Payment not found');
          }

          checkPaymentOwnership(req, paymentDoc);
          if (!paymentDoc.canRefund()) {
            throw new Error('Payment cannot be refunded');
          }
          if (amount > paymentDoc.refundableAmount) {
            throw new Error('Refund amount exceeds refundable amount');
          }

          paymentDoc.addRefund({ amount, reason, created_by });
          await paymentDoc.save({ session });

          const orderUpdate = {
            payment_status: paymentDoc.totalRefunded >= paymentDoc.amount ? 'refunded' : 'partial',
            paymentStatus: paymentDoc.totalRefunded >= paymentDoc.amount ? 'refunded' : 'partial',
          };
          if (paymentDoc.totalRefunded >= paymentDoc.amount) {
            orderUpdate.status = 'refunded';
          }

          await Order.findByIdAndUpdate(paymentDoc.orderId, orderUpdate, { session });
          updatedPayment = paymentDoc;
        });
      } finally {
        session.endSession();
      }

      const formattedPayment = updatedPayment.toAPIResponse();

      // logger.info('Refund added', { paymentId: id, refundAmount: amount });
      res.json({ success: true, data: formattedPayment });
    } catch (err) {
      handleError(res, err, 'Failed to add refund');
    }
  }

  static async addDispute(req, res) {
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

      // logger.info('Dispute added', { paymentId: id, disputeAmount: amount });
      res.json({ success: true, data: formattedPayment });
    } catch (err) {
      handleError(res, err, 'Failed to add dispute');
    }
  }

  static async capturePayment(req, res) {
    try {
      const { id } = req.params;
      const { note = 'Payment captured', updated_by = req.user.role || 'merchant' } = req.body;

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

      await payment.capturePayment(note, updated_by);
      const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
      const formattedPayment = updatedPayment.toAPIResponse();

      // logger.info('Payment captured', { paymentId: id });
      res.json({ success: true, data: formattedPayment });
    } catch (err) {
      handleError(res, err, 'Failed to capture payment');
    }
  }

  static async getAnalytics(req, res) {
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
  }

  static async getSuspiciousPayments(req, res) {
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
  }

  static async getPaymentsRequiringAction(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const payments = await PaymentModel.findRequiringAction();
      res.json({ success: true, data: payments });
    } catch (err) {
      handleError(res, err, 'Failed to fetch payments requiring action');
    }
  }

  static async bulkUpdateStatus(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { paymentIds } = req.body;
      const { status, updated_by = 'admin', note = '' } = req.body;

      if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ error: 'Invalid payment IDs' });
      }

      const result = await PaymentModel.bulkUpdateStatus(paymentIds, status, updated_by, note);
      // logger.info('Bulk status update', { paymentIds: paymentIds.length, newStatus: status });
      res.json({ success: true, data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount } });
    } catch (err) {
      handleError(res, err, 'Failed to bulk update status');
    }
  }

  static async bulkCancelPayments(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { paymentIds } = req.body;
      const { reason = 'Cancelled by system', updated_by = 'system' } = req.body;

      if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ error: 'Invalid payment IDs' });
      }

      const result = await PaymentModel.bulkCancelPayments(paymentIds, reason, updated_by);
      // logger.info('Bulk cancel', { paymentIds: paymentIds.length });
      res.json({ success: true, data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount } });
    } catch (err) {
      handleError(res, err, 'Failed to bulk cancel payments');
    }
  }

  static async getPaymentSummary(req, res) {
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
  }

  static async getTrackingHistory(req, res) {
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
  }

  static async getFailedAttemptsSummary(req, res) {
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
  }

  static async getRecentPayments(req, res) {
    try {
      const { limit = 50, hours = 24 } = req.query;
      const options = { limit: parseInt(limit), hours: parseInt(hours) };

      const payments = await PaymentModel.getRecentPayments(options);
      res.json({ success: true, data: payments });
    } catch (err) {
      handleError(res, err, 'Failed to fetch recent payments');
    }
  }

  static async findByProviderTransactionId(req, res) {
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
  }

  static async findPaymentsByOrder(req, res) {
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
  }

  static async findPaymentsByPaymentMethod(req, res) {
    try {
      const { sourceId } = req.params;
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = -1 } = req.query;
      const options = { page: parseInt(page), limit: parseInt(limit), sortBy, sortOrder: parseInt(sortOrder) };

      const result = await PaymentModel.findByPaymentMethod(sourceId, options);
      res.json({ success: true, data: result.payments, pagination: result.pagination });
    } catch (err) {
      handleError(res, err, 'Failed to fetch payments by payment method');
    }
  }

  static async incrementAttempts(req, res) {
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
  }

  static async markAsPaid(req, res) {
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

      const session = await mongoose.startSession();
      let updatedPayment = null;

      try {
        await session.withTransaction(async () => {
          const paymentDoc = await PaymentModel.findById(id).session(session).populate('customerId');
          if (!paymentDoc) {
            throw new Error('Payment not found');
          }

          checkPaymentOwnership(req, paymentDoc);
          paymentDoc.markAsPaid(note);
          await paymentDoc.save({ session });

          await Order.findByIdAndUpdate(
            paymentDoc.orderId,
            {
              payment_status: 'paid',
              paymentStatus: 'paid',
              status: 'processing',
            },
            { session }
          );

          updatedPayment = paymentDoc;
        });
      } finally {
        session.endSession();
      }

      const formattedPayment = updatedPayment.toAPIResponse();

      // logger.info('Payment marked as paid', { paymentId: id });
      res.json({ success: true, data: formattedPayment });
    } catch (err) {
      handleError(res, err, 'Failed to mark payment as paid');
    }
  }

  static async updateMetadata(req, res) {
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
  }

  static async deletePayment(req, res) {
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
      // logger.info('Payment deleted', { paymentId: id });
      res.json({ success: true, message: 'Payment deleted successfully' });
    } catch (err) {
      handleError(res, err, 'Failed to delete payment');
    }
  }

  static async exportPayments(req, res) {
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
        if (!csvWriter || typeof csvWriter.createObjectCsvWriter !== 'function') {
          return res.status(503).json({ error: 'CSV export is not available on this server' });
        }
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

        await csv.writeRecords(payments.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })));
        res.download(fileName, (err) => {
          if (err)
            //logger.error('Export error', err);
            fs.unlinkSync(fileName);
        });
      }
    } catch (err) {
      handleError(res, err, 'Failed to export payments');
    }
  }

  static async resolveDispute(req, res) {
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

      const dispute = payment.disputes.find((d) => d.disputeId === disputeId);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }

      dispute.status = status;
      dispute.resolvedAt = resolvedAt;
      await payment.save();

      await payment.addTimelineEntry(`Dispute ${status.toLowerCase()}`, note, 'admin', { disputeId });

      const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
      const formattedPayment = updatedPayment.toAPIResponse();

      // logger.info('Dispute resolved', { paymentId: id, disputeId, status });
      res.json({ success: true, data: formattedPayment });
    } catch (err) {
      handleError(res, err, 'Failed to resolve dispute');
    }
  }

  static async updateDisputeStatus(req, res) {
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

      const dispute = payment.disputes.find((d) => d.disputeId === disputeId);
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
  }

  static async getRecurringPayments(req, res) {
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
          hasPrevPage: parseInt(page) > 1,
        },
      });
    } catch (err) {
      handleError(res, err, 'Failed to fetch recurring payments');
    }
  }

  static async calculateRiskScore(req, res) {
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
  }

  static async getProcessingTimeStats(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { dateFrom, dateTo } = req.query;
      const matchStage = {
        status: 'COMPLETED',
        createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
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
              $avg: { $subtract: ['$processedAt', '$createdAt'] },
            },
            maxProcessingTime: {
              $max: { $subtract: ['$processedAt', '$createdAt'] },
            },
            minProcessingTime: {
              $min: { $subtract: ['$processedAt', '$createdAt'] },
            },
            totalPayments: { $sum: 1 },
          },
        },
        {
          $project: {
            avgProcessingTimeMs: '$avgProcessingTime',
            avgProcessingTimeSeconds: { $divide: ['$avgProcessingTime', 1000] },
            maxProcessingTimeMs: '$maxProcessingTime',
            minProcessingTimeMs: '$minProcessingTime',
            totalPayments: 1,
          },
        },
      ]);

      res.json({ success: true, data: stats[0] || { totalPayments: 0 } });
    } catch (err) {
      handleError(res, err, 'Failed to fetch processing time stats');
    }
  }

  static async getRefundRates(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { dateFrom, dateTo, paymentProvider } = req.query;
      const matchStage = {
        createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
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
                    cond: { $eq: ['$$this.status', 'COMPLETED'] },
                  },
                },
              },
            },
            refundedPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'REFUNDED'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            provider: '$_id',
            refundRate: { $multiply: [{ $divide: ['$refundedPayments', '$totalPayments'] }, 100] },
            avgRefundAmount: { $divide: ['$totalRefundedAmount', { $add: ['$refundedPayments', 1] }] },
            totalPayments: 1,
          },
        },
      ]);

      res.json({ success: true, data: rates });
    } catch (err) {
      handleError(res, err, 'Failed to fetch refund rates');
    }
  }

  static async getSuccessRateByProvider(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { dateFrom, dateTo } = req.query;
      const matchStage = {
        createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
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
              $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            provider: '$_id',
            successRate: { $multiply: [{ $divide: ['$successfulPayments', '$totalPayments'] }, 100] },
            totalPayments: 1,
            successfulPayments: 1,
          },
        },
      ]);

      res.json({ success: true, data: rates });
    } catch (err) {
      handleError(res, err, 'Failed to fetch success rates by provider');
    }
  }

  static async getAverageAmountByMethod(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { paymentMethod, dateFrom, dateTo } = req.query;
      const matchStage = {
        createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
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
            totalAmount: { $sum: '$amount' },
          },
        },
      ]);

      res.json({ success: true, data: avgs });
    } catch (err) {
      handleError(res, err, 'Failed to fetch average amounts by method');
    }
  }

  static async getCurrencyBreakdown(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { dateFrom, dateTo } = req.query;
      const matchStage = {
        createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
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
              $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            currency: '$_id',
            totalPayments: 1,
            totalAmount: 1,
            successRate: { $multiply: [{ $divide: ['$successfulPayments', '$totalPayments'] }, 100] },
          },
        },
      ]);

      res.json({ success: true, data: breakdown });
    } catch (err) {
      handleError(res, err, 'Failed to fetch currency breakdown');
    }
  }

  static async getFeeSummary(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { dateFrom, dateTo, paymentProvider } = req.query;
      const matchStage = {
        createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
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
            totalPayments: { $sum: 1 },
          },
        },
        {
          $project: {
            totalProcessingFees: 1,
            totalPlatformFees: 1,
            totalTax: 1,
            totalFees: 1,
            avgFeesPerPayment: { $divide: ['$totalFees', { $add: ['$totalPayments', 1] }] },
          },
        },
      ]);

      res.json({ success: true, data: summary[0] || {} });
    } catch (err) {
      handleError(res, err, 'Failed to fetch fee summary');
    }
  }

  static async getDisputeAnalytics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { dateFrom, dateTo } = req.query;
      const matchStage = {
        'disputes.createdAt': { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
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
            resolvedCount: { $sum: { $cond: [{ $ne: ['$disputes.resolvedAt', null] }, 1, 0] } },
          },
        },
      ]);

      res.json({ success: true, data: analytics });
    } catch (err) {
      handleError(res, err, 'Failed to fetch dispute analytics');
    }
  }

  static async getTimelineStats(req, res) {
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
        timeline = timeline.filter((event) => event.status === status);
      }

      const stats = {
        totalEvents: timeline.length,
        uniqueStatuses: [...new Set(timeline.map((e) => e.status))],
        avgTimeBetweenEvents: timeline.length > 1 ? timeline.reduce((sum, _, i, arr) => (i < arr.length - 1 ? sum + (arr[i + 1].timestamp - arr[i].timestamp) : sum), 0) / (timeline.length - 1) : 0,
        eventsByUpdater: timeline.reduce((acc, event) => {
          acc[event.updated_by] = (acc[event.updated_by] || 0) + 1;
          return acc;
        }, {}),
      };

      res.json({ success: true, data: { stats, timeline } });
    } catch (err) {
      handleError(res, err, 'Failed to fetch timeline stats');
    }
  }

  static async handleWebhook(req, res) {
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
        metadata: { ...payment.metadata, webhookReceivedAt: new Date() },
      };

      await payment.updateStatus(status, `Webhook from provider: ${status}`, 'webhook');
      await PaymentModel.updateOne({ _id: payment._id }, updateData);

      // logger.info('Webhook processed', { paymentId: payment.paymentId, status });
      res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (err) {
      //logger.error('Webhook error', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  static async addTimelineEntry(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { id } = req.params;
      const { status, note, updated_by = 'admin', additionalData = {} } = req.body;

      const payment = await PaymentModel.findById(id).populate('customerId');
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      await payment.addTimelineEntry(status, note, updated_by, additionalData);
      const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
      const formattedPayment = updatedPayment.toAPIResponse();

      res.json({ success: true, data: formattedPayment });
    } catch (err) {
      handleError(res, err, 'Failed to add timeline entry');
    }
  }

  static async checkExpired(req, res) {
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
  }

  static async getTagsUsage(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const usage = await PaymentModel.aggregate([
        {
          $unwind: { path: '$tags', preserveNullAndEmptyArrays: true },
        },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);

      res.json({ success: true, data: usage });
    } catch (err) {
      handleError(res, err, 'Failed to fetch tags usage');
    }
  }

  static async searchByNotes(req, res) {
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
          totalCount,
        },
      });
    } catch (err) {
      handleError(res, err, 'Failed to search payments by notes');
    }
  }

  static async getPaymentsByTag(req, res) {
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
          totalCount,
        },
      });
    } catch (err) {
      handleError(res, err, 'Failed to fetch payments by tag');
    }
  }

  static async addTag(req, res) {
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
  }

  static async removeTag(req, res) {
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

      payment.tags = payment.tags.filter((t) => t !== tag);
      await payment.save();
      await payment.addTimelineEntry('Tag removed', `Removed tag: ${tag}`, 'admin');

      const updatedPayment = await PaymentModel.findById(id).populate('orderId customerId');
      const formattedPayment = updatedPayment.toAPIResponse();

      res.json({ success: true, data: formattedPayment });
    } catch (err) {
      handleError(res, err, 'Failed to remove tag');
    }
  }

  static async updateNotes(req, res) {
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
  }

  static async getFraudFlagsStats(req, res) {
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
            totalAmount: { $sum: '$amount' },
          },
        },
        { $sort: { count: -1 } },
      ]);

      res.json({ success: true, data: stats });
    } catch (err) {
      handleError(res, err, 'Failed to fetch fraud flags stats');
    }
  }

  static async bulkAddTags(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { paymentIds, tag } = req.body;

      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await PaymentModel.updateMany({ _id: { $in: paymentIds } }, { $addToSet: { tags: tag } });

      // logger.info('Bulk tags added', { paymentIds: paymentIds.length, tag });
      res.json({ success: true, data: { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount } });
    } catch (err) {
      handleError(res, err, 'Failed to bulk add tags');
    }
  }

  static async getPaymentsByCountry(req, res) {
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
          totalCount,
        },
      });
    } catch (err) {
      handleError(res, err, 'Failed to fetch payments by country');
    }
  }

  static async getPaymentsByCurrency(req, res) {
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
          hasPrevPage: parseInt(page) > 1,
        },
      });
    } catch (err) {
      handleError(res, err, 'Failed to fetch payments by currency');
    }
  }

  static async getVolumeByPeriod(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { period = 'day', dateFrom, dateTo } = req.query;
      const matchStage = {
        createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
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
            successfulVolume: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$amount', 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      res.json({ success: true, data: volume });
    } catch (err) {
      handleError(res, err, 'Failed to fetch volume by period');
    }
  }

  static async getTopCustomers(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { limit = 10, dateFrom, dateTo } = req.query;
      const matchStage = {
        createdAt: { $gte: new Date(dateFrom), $lte: new Date(dateTo) },
        status: 'COMPLETED',
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
            paymentCount: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'customer',
            pipeline: [{ $project: { name: 1, email: 1 } }],
          },
        },
        { $unwind: '$customer' },
      ]);

      res.json({ success: true, data: topCustomers });
    } catch (err) {
      handleError(res, err, 'Failed to fetch top customers');
    }
  }

  static async simulatePaymentFailure(req, res) {
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

      // logger.info('Payment failure simulated', { paymentId, reason });
      res.json({ success: true, data: formattedPayment });
    } catch (err) {
      handleError(res, err, 'Failed to simulate payment failure');
    }
  }

  static async getMethodSuccessRatesOverTime(req, res) {
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
              $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            period: '$_id.period',
            paymentMethod: '$_id.paymentMethod',
            successRate: {
              $cond: [{ $eq: ['$totalPayments', 0] }, 0, { $multiply: [{ $divide: ['$successfulPayments', '$totalPayments'] }, 100] }],
            },
            totalPayments: 1,
            successfulPayments: 1,
          },
        },
        { $sort: { period: 1, paymentMethod: 1 } },
      ]);

      // Format the response to group by period
      const formattedRates = rates.reduce((acc, curr) => {
        const { period, paymentMethod, successRate, totalPayments, successfulPayments } = curr;
        if (!acc[period]) {
          acc[period] = { period, methods: {} };
        }
        acc[period].methods[paymentMethod] = {
          successRate: parseFloat(successRate.toFixed(2)),
          totalPayments,
          successfulPayments,
        };
        return acc;
      }, {});

      const result = Object.values(formattedRates).sort((a, b) => a.period.localeCompare(b.period));

      // logger.info('Fetched payment method success rates over time', {
      //   granularity,
      //   paymentMethod,
      //   dateFrom,
      //   dateTo,
      //   totalPeriods: result.length
      // });

      res.json({ success: true, data: result });
    } catch (err) {
      handleError(res, err, 'Failed to fetch payment method success rates');
    }
  }

  static async getPaymentsByIP(req, res) {
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
          hasPrevPage: parseInt(page) > 1,
        },
      });
    } catch (err) {
      handleError(res, err, 'Failed to fetch payments by IP address');
    }
  }
  static async bulkProcessRefunds(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { paymentIds, amountPercentage, reason = 'Bulk refund', created_by = req.user.id } = req.body;

      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const payments = await PaymentModel.find({ _id: { $in: paymentIds } });
      if (payments.length !== paymentIds.length) {
        return res.status(404).json({ error: 'One or more payments not found' });
      }

      const results = [];
      for (const payment of payments) {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const paymentDoc = await PaymentModel.findById(payment._id).session(session).populate('customerId');
            if (!paymentDoc) {
              results.push({ paymentId: payment._id, status: 'failed', message: 'Payment not found' });
              return;
            }

            if (!paymentDoc.canRefund()) {
              results.push({ paymentId: payment._id, status: 'failed', message: 'Payment cannot be refunded' });
              return;
            }

            const refundAmount = paymentDoc.amount * (amountPercentage / 100);
            if (refundAmount > paymentDoc.refundableAmount) {
              results.push({ paymentId: payment._id, status: 'failed', message: 'Refund amount exceeds refundable amount' });
              return;
            }

            paymentDoc.addRefund({ amount: refundAmount, reason, created_by });
            await paymentDoc.save({ session });

            const orderUpdate = {
              payment_status: paymentDoc.totalRefunded >= paymentDoc.amount ? 'refunded' : 'partial',
              paymentStatus: paymentDoc.totalRefunded >= paymentDoc.amount ? 'refunded' : 'partial',
            };
            if (paymentDoc.totalRefunded >= paymentDoc.amount) {
              orderUpdate.status = 'refunded';
            }
            await Order.findByIdAndUpdate(paymentDoc.orderId, orderUpdate, { session });

            results.push({ paymentId: payment._id, status: 'success', refundAmount });
          });
        } finally {
          session.endSession();
        }
      }

      // logger.info('Bulk refunds processed', { paymentCount: paymentIds.length, amountPercentage });
      res.json({ success: true, data: results });
    } catch (err) {
      handleError(res, err, 'Failed to process bulk refunds');
    }
  }
}

module.exports = PaymentController;
