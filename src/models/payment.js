const mongoose = require('mongoose');
const crypto = require('crypto');
const { Logger } = require('../utils/logger');

const logger = new Logger('PaymentModel');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
   isDeleted: { type: Boolean, default: true },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD']
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'BANK_TRANSFER', 'COD', 'DIGITAL_WALLET', 'CRYPTO', 'NET_BANKING']
  },
  paymentProvider: {
    type: String,
    required: true,
    enum: ['STRIPE', 'PAYPAL', 'RAZORPAY', 'SQUARE', 'ADYEN', 'PAYU', 'CASHFREE', 'INTERNAL']
  },
  status: {
    type: String,
    required: true,
    default: 'PENDING',
    enum: ['PENDING', 'PROCESSING', 'AUTHORIZED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'EXPIRED']
  },
  disputes: [{
  disputeId: { type: String, required: true },
  amount: { type: Number, required: true },
  reason: String,
  status: { type: String, enum: ['OPEN', 'WON', 'LOST', 'PENDING'], default: 'PENDING' },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date,
  providerDisputeId: String
}],
isRecurring: {
  type: Boolean,
  default: false
},
subscriptionId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Subscription',
  index: true
},
sourceId: {
  type: String,
  index: true
},
paymentIntentId: {
  type: String,
  index: true
},
  paymentDetails: {
    providerPaymentId: String,
    providerTransactionId: String,
    providerResponse: mongoose.Schema.Types.Mixed,
    last4: String,
    cardBrand: String,
    expiryMonth: Number,
    expiryYear: Number,
    bankName: String,
    upiId: String,
    walletType: String
  },
  billingAddress: {
    name: String,
    email: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  fees: {
    processingFee: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalFees: { type: Number, default: 0 }
  },
  refunds: [{
    refundId: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    reason: String,
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PENDING'
    },
    processedAt: Date,
    providerRefundId: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
    fingerprint: String,
    riskScore: { type: Number, min: 0, max: 100 },
    fraudFlags: [String],
    deviceInfo: mongoose.Schema.Types.Mixed,
    sessionId: String
  },
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String,
    updatedBy: {
      type: String,
      enum: ['system', 'webhook', 'admin', 'customer', 'merchant']
    },
    additionalData: mongoose.Schema.Types.Mixed
  }],
  attempts: {
    type: Number,
    default: 1
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  processedAt: Date,
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },
  tags: [String],
  notes: String
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for performance optimization
paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ paymentProvider: 1, status: 1 });
paymentSchema.index({ 'paymentDetails.providerPaymentId': 1 });
paymentSchema.index({ paymentMethod: 1, status: 1 });
paymentSchema.index({ amount: 1, currency: 1 });
paymentSchema.index({ 'metadata.riskScore': 1 });
paymentSchema.index({ expiresAt: 1 });

// Virtual for total refunded amount
paymentSchema.virtual('totalRefunded').get(function() {
  return this.refunds
    .filter(refund => refund.status === 'COMPLETED')
    .reduce((total, refund) => total + refund.amount, 0);
});

// Virtual for remaining refundable amount
paymentSchema.virtual('refundableAmount').get(function() {
  if (this.status !== 'COMPLETED') return 0;
  return this.amount - this.totalRefunded;
});

// Virtual for payment age in hours
paymentSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
});

// Virtual for total amount including fees
paymentSchema.virtual('totalAmountWithFees').get(function() {
  return this.amount + this.fees.totalFees;
});

// STATIC METHODS

// Generate unique payment ID
paymentSchema.statics.generatePaymentId = function() {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `PAY_${timestamp}_${randomBytes}`;
};

// Find payments by customer with pagination
paymentSchema.statics.findByCustomer = async function(customerId, options = {}) {
  const {
    page = 1,
    limit = 20,
    status,
    paymentMethod,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;

  const query = { customerId };

  if (status) query.status = status;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const totalCount = await this.countDocuments(query);
  const payments = await this.find(query)
    .populate('orderId', 'orderNumber items.name pricing.total')
    .sort({ [sortBy]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    payments,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    }
  };
};

// Get payment analytics
paymentSchema.statics.getAnalytics = async function(filters = {}) {
  const {
    dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    dateTo = new Date(),
    customerId,
    paymentProvider
  } = filters;

  const matchStage = {
    createdAt: { $gte: dateFrom, $lte: dateTo }
  };

  if (customerId) matchStage.customerId = new mongoose.Types.ObjectId(customerId);
  if (paymentProvider) matchStage.paymentProvider = paymentProvider;

  const analytics = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' },
        successfulPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
        },
        failedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
        },
        totalRefunded: {
          $sum: {
            $sum: {
              $filter: {
                input: '$refunds',
                cond: { $eq: ['$$this.status', 'COMPLETED'] }
              }
            }
          }
        },
        paymentMethods: { $addToSet: '$paymentMethod' },
        paymentProviders: { $addToSet: '$paymentProvider' },
        currencies: { $addToSet: '$currency' }
      }
    }
  ]);

  const statusBreakdown = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  const methodBreakdown = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        successRate: {
          $avg: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
        }
      }
    }
  ]);

  return {
    overview: analytics[0] || {},
    statusBreakdown,
    methodBreakdown,
    successRate: analytics[0] ? (analytics[0].successfulPayments / analytics[0].totalPayments * 100) : 0
  };
};


paymentSchema.statics.getFailedAttemptsSummary = async function(options = {}) {
  const { dateFrom, dateTo } = options;
  const matchStage = {};
  if (dateFrom || dateTo) {
    matchStage.createdAt = {};
    if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
    if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
  }
  return this.aggregate([
    { $match: { ...matchStage, attempts: { $gt: 1 } } },
    {
      $group: {
        _id: '$paymentMethod',
        totalAttempts: { $sum: '$attempts' },
        failedPayments: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
        averageAttempts: { $avg: '$attempts' }
      }
    }
  ]);
};

paymentSchema.statics.bulkCancelPayments = async function(paymentIds, reason = 'Cancelled by system', updatedBy = 'system') {
  return this.updateMany(
    { _id: { $in: paymentIds }, status: { $in: ['PENDING', 'AUTHORIZED'] } },
    {
      $set: { status: 'CANCELLED', updatedAt: new Date() },
      $push: {
        timeline: {
          status: 'CANCELLED',
          timestamp: new Date(),
          note: reason,
          updatedBy
        }
      }
    }
  );
};
paymentSchema.statics.getRecentPayments = async function(options = {}) {
  const { limit = 50, hours = 24 } = options;
  return this.find({
    createdAt: { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) }
  })
    .populate('customerId', 'name email')
    .populate('orderId', 'orderNumber')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

paymentSchema.statics.findByProviderTransactionId = async function(providerTransactionId) {
  return this.findOne({ 'paymentDetails.providerTransactionId': providerTransactionId })
    .populate('customerId', 'name email')
    .populate('orderId', 'orderNumber')
    .lean();
};

paymentSchema.statics.findByOrder = async function(orderId, options = {}) {
  const { page = 1, limit = 20, status, sortBy = 'createdAt', sortOrder = -1 } = options;
  const query = { orderId };
  if (status) query.status = status;
  const totalCount = await this.countDocuments(query);
  const payments = await this.find(query)
    .populate('customerId', 'name email')
    .sort({ [sortBy]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  return {
    payments,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    }
  };
};

// Find suspicious payments
paymentSchema.statics.findSuspicious = async function(options = {}) {
  const { limit = 50, minRiskScore = 70 } = options;

  return this.find({
    $or: [
      { 'metadata.riskScore': { $gte: minRiskScore } },
      { 'metadata.fraudFlags': { $exists: true, $ne: [] } },
      { attempts: { $gt: 2 } },
      { status: 'FAILED' }
    ]
  })
  .populate('customerId', 'name email')
  .populate('orderId', 'orderNumber')
  .sort({ 'metadata.riskScore': -1, createdAt: -1 })
  .limit(limit);
};

// Find payments requiring action
paymentSchema.statics.findRequiringAction = async function() {
  return this.find({
    $or: [
      { status: 'AUTHORIZED' },
      { status: 'PROCESSING' },
      { 
        status: 'PENDING', 
        createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) } // Older than 30 minutes
      }
    ]
  })
  .populate('customerId', 'name email')
  .populate('orderId', 'orderNumber')
  .sort({ createdAt: 1 });
};

// Bulk update payment status
paymentSchema.statics.bulkUpdateStatus = async function(paymentIds, newStatus, updatedBy = 'system', note = '') {
  return this.updateMany(
    { _id: { $in: paymentIds } },
    { 
      $set: { status: newStatus, updatedAt: new Date() },
      $push: {
        timeline: {
          status: newStatus,
          timestamp: new Date(),
          note,
          updatedBy
        }
      }
    }
  );
};

paymentSchema.statics.findByPaymentMethod = async function(sourceId, options = {}) {
  const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = -1 } = options;
  const query = { sourceId };
  const totalCount = await this.countDocuments(query);
  const payments = await this.find(query)
    .populate('customerId', 'name email')
    .populate('orderId', 'orderNumber')
    .sort({ [sortBy]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  return {
    payments,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    }
  };
};
// Get payment summary
paymentSchema.statics.getPaymentSummary = async function(filters = {}) {
  const {
    dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    dateTo = new Date(),
    customerId,
    status,
    paymentMethod,
    paymentProvider
  } = filters;

  const matchStage = {
    createdAt: { $gte: dateFrom, $lte: dateTo }
  };

  if (customerId) matchStage.customerId = new mongoose.Types.ObjectId(customerId);
  if (status) matchStage.status = status;
  if (paymentMethod) matchStage.paymentMethod = paymentMethod;
  if (paymentProvider) matchStage.paymentProvider = paymentProvider;

  const summary = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: '$fees.totalFees' },
        totalNetAmount: { $sum: { $add: ['$amount', '$fees.totalFees'] } },
        totalRefunded: {
          $sum: {
            $sum: {
              $filter: {
                input: '$refunds',
                cond: { $eq: ['$$this.status', 'COMPLETED'] }
              }
            }
          }
        },
        averageAmount: { $avg: '$amount' },
        paymentCountByStatus: {
          $push: {
            status: '$status',
            count: 1
          }
        }
      }
    },
    {
      $project: {
        totalPayments: 1,
        totalAmount: 1,
        totalFees: 1,
        totalNetAmount: 1,
        totalRefunded: 1,
        averageAmount: 1,
        statusBreakdown: {
          $arrayToObject: {
            $map: {
              input: { $setUnion: ['$paymentCountByStatus.status'] },
              as: 'status',
              in: {
                k: '$$status',
                v: {
                  $sum: {
                    $map: {
                      input: '$paymentCountByStatus',
                      as: 'item',
                      in: { $cond: [{ $eq: ['$$item.status', '$$status'] }, 1, 0] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  ]);

  return summary[0] || {
    totalPayments: 0,
    totalAmount: 0,
    totalFees: 0,
    totalNetAmount: 0,
    totalRefunded: 0,
    averageAmount: 0,
    statusBreakdown: {}
  };
};

// Get tracking history
paymentSchema.statics.getTrackingHistory = async function(paymentId) {
  const payment = await this.findById(paymentId)
    .select('timeline paymentId status amount customerId orderId')
    .populate('customerId', 'name email')
    .populate('orderId', 'orderNumber')
    .lean();

  if (!payment) {
    throw new Error('Payment not found');
  }

  return {
    paymentId: payment.paymentId,
    status: payment.status,
    amount: payment.amount,
    customer: payment.customerId,
    order: payment.orderId,
    timeline: payment.timeline.map(event => ({
      status: event.status,
      timestamp: event.timestamp,
      note: event.note,
      updatedBy: event.updatedBy,
      additionalData: event.additionalData
    }))
  };
};

// INSTANCE METHODS

// Add timeline entry
paymentSchema.methods.addTimelineEntry = function(status, note, updatedBy = 'system', additionalData = {}) {
  this.timeline.push({
    status,
    timestamp: new Date(),
    note,
    updatedBy,
    additionalData
  });
  return this.save();
};

// Update payment status with timeline
paymentSchema.methods.updateStatus = function(newStatus, note = '', updatedBy = 'system') {
  if (this.status !== newStatus) {
    this.status = newStatus;
    this.updatedAt = new Date();

    if (newStatus === 'COMPLETED') {
      this.processedAt = new Date();
    }

    return this.addTimelineEntry(newStatus, note, updatedBy);
  }
  return this; // Return unchanged if status is the same
};

// Add refund

paymentSchema.methods.addDispute = function(disputeData) {
  const dispute = {
    disputeId: `DIS_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    ...disputeData,
    createdAt: new Date()
  };
  this.disputes.push(dispute);
  return this.save();
};

paymentSchema.methods.addRefund = function(refundData) {
  const refund = {
    refundId: `REF_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    ...refundData,
    createdAt: new Date()
  };

  this.refunds.push(refund);

  // Update payment status if fully refunded
  if (this.totalRefunded >= this.amount) {
    this.status = 'REFUNDED';
  } else if (this.refunds.length > 0) {
    this.status = 'PARTIALLY_REFUNDED';
  }

  return this.save();
};

paymentSchema.methods.incrementAttempts = function(note = 'Payment attempt failed', updatedBy = 'system') {
  this.attempts += 1;
  if (this.attempts >= this.maxAttempts) {
    this.status = 'FAILED';
    note = `${note} - Max attempts reached`;
  }
  return this.addTimelineEntry(this.status, note, updatedBy);
};

paymentSchema.methods.capturePayment = function(note = 'Payment captured', updatedBy = 'system') {
  if (!this.canCapture()) {
    throw new Error('Payment cannot be captured');
  }
  this.status = 'COMPLETED';
  this.processedAt = new Date();
  return this.addTimelineEntry('COMPLETED', note, updatedBy);
};

// Check if payment can be captured
paymentSchema.methods.canCapture = function() {
  return this.status === 'AUTHORIZED' && this.ageInHours < 168; // Within 7 days
};

// Check if payment can be refunded
paymentSchema.methods.canRefund = function() {
  return this.status === 'COMPLETED' && this.refundableAmount > 0;
};

// Check if payment is expired
paymentSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

// Calculate risk score
paymentSchema.methods.calculateRiskScore = function() {
  let score = 0;

  // Base score on payment amount
  if (this.amount > 10000) score += 20;
  else if (this.amount > 5000) score += 10;

  // Failed attempts
  if (this.attempts > 1) score += (this.attempts - 1) * 15;

  // Payment method risk
  const methodRisk = {
    'CRYPTO': 30,
    'BANK_TRANSFER': 5,
    'CREDIT_CARD': 10,
    'DEBIT_CARD': 8,
    'UPI': 5,
    'COD': 2
  };
  score += methodRisk[this.paymentMethod] || 0;

  // Time-based risk (very quick payments might be suspicious)
  if (this.ageInHours < 0.1) score += 15; // Less than 6 minutes

  // Update the risk score
  this.metadata.riskScore = Math.min(score, 100);

  return this.metadata.riskScore;
};

paymentSchema.methods.updateMetadata = function(metadataUpdate, note = 'Metadata updated', updatedBy = 'system') {
  this.metadata = { ...this.metadata, ...metadataUpdate };
  return this.addTimelineEntry(this.status, note, updatedBy);
};

// Format payment for API response
paymentSchema.methods.toAPIResponse = function() {
  const payment = this.toObject({ virtuals: true });

  // Remove sensitive data
  delete payment.paymentDetails?.providerResponse;
  delete payment.metadata?.deviceInfo;

  // Format amounts
  payment.formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: payment.currency
  }).format(payment.amount);

  payment.formattedTotalAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: payment.currency
  }).format(payment.totalAmountWithFees);

  return payment;
};

// Mark payment as paid
paymentSchema.methods.markAsPaid = function(note = 'Payment marked as paid', updatedBy = 'system') {
  if (this.status !== 'COMPLETED') {
    this.status = 'COMPLETED';
    this.processedAt = new Date();
    return this.addTimelineEntry('COMPLETED', note, updatedBy);
  }
  return this; // Return unchanged if already completed
};

// Pre-save middleware
paymentSchema.pre('save', function(next) {
  if (this.isNew && !this.paymentId) {
    this.paymentId = this.constructor.generatePaymentId();
  }

  // Calculate fees
  if (this.isModified('amount') || this.isNew) {
    this.fees.processingFee = this.amount * 0.029; // 2.9%
    this.fees.platformFee = this.amount * 0.005; // 0.5%
    this.fees.totalFees = this.fees.processingFee + this.fees.platformFee;
  }

  // Set expiry for pending payments
  if (this.status === 'PENDING' && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }

  // Validate amount and fees
  if (this.amount < 0) {
    return next(new Error('Amount cannot be negative'));
  }
  if (this.fees.totalFees !== this.fees.processingFee + this.fees.platformFee) {
    return next(new Error('Total fees do not match processing and platform fees'));
  }

  // Auto-expire payments
  if (this.isExpired() && this.status === 'PENDING') {
    this.status = 'EXPIRED';
    this.timeline.push({
      status: 'EXPIRED',
      timestamp: new Date(),
      note: 'Payment expired automatically',
      updatedBy: 'system'
    });
  }

  next();
});

// Post-save middleware
paymentSchema.post('save', function(doc) {
  logger.info('Payment saved', {
    paymentId: doc.paymentId,
    status: doc.status,
    amount: doc.amount,
    currency: doc.currency
  });
});

// Create and export model
const Payment = mongoose.model('Payment', paymentSchema);

// Static instance for singleton pattern
let paymentInstance = null;

class PaymentModel {
  constructor() {
    if (paymentInstance) {
      return paymentInstance;
    }

    this.model = Payment;
    paymentInstance = this;
  }

  // Proxy methods to the model
  create(data) {
    return this.model.create(data);
  }

  findById(id) {
    return this.model.findById(id);
  }

  findOne(query) {
    return this.model.findOne(query);
  }

  find(query) {
    return this.model.find(query);
  }

  updateOne(filter, update) {
    return this.model.updateOne(filter, update);
  }

  deleteOne(filter) {
    return this.model.deleteOne(filter);
  }

  // Static methods proxy
  generatePaymentId() {
    return this.model.generatePaymentId();
  }

  findByCustomer(customerId, options) {
    return this.model.findByCustomer(customerId, options);
  }

  getAnalytics(filters) {
    return this.model.getAnalytics(filters);
  }

  findSuspicious(options) {
    return this.model.findSuspicious(options);
  }

  findRequiringAction() {
    return this.model.findRequiringAction();
  }

  bulkUpdateStatus(paymentIds, newStatus, updatedBy, note) {
    return this.model.bulkUpdateStatus(paymentIds, newStatus, updatedBy, note);
  }

  getPaymentSummary(filters) {
    return this.model.getPaymentSummary(filters);
  }

  getTrackingHistory(paymentId) {
    return this.model.getTrackingHistory(paymentId);
  }
}

module.exports = { Payment, PaymentModel: new PaymentModel() };