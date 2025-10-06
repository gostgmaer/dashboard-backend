
// models/TransactionLog.js
const mongoose = require('mongoose');

const TransactionLogSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        index: true
    },
    refundId: {
        type: String, // This will now store the refundId from the embedded refund
        index: true
    },
    eventType: {
        type: String,
        enum: ['payment_initiated', 'payment_processing', 'payment_completed', 'payment_failed', 
               'payment_cancelled', 'refund_initiated', 'refund_completed', 'refund_failed',
               'webhook_received', 'retry_attempted'],
        required: true,
        index: true
    },
    gateway: {
        type: String,
        enum: ['paypal', 'razorpay', 'stripe', 'cod'],
        required: true
    },
    status: {
        type: String,
        required: true
    },
    previousStatus: {
        type: String
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    errorDetails: {
        type: mongoose.Schema.Types.Mixed
    },
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    }
},   {   timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true } });

// Indexes for efficient querying
TransactionLogSchema.index({ orderId: 1, createdAt: -1 });
TransactionLogSchema.index({ paymentId: 1, createdAt: -1 });
TransactionLogSchema.index({ eventType: 1, createdAt: -1 });
TransactionLogSchema.index({ gateway: 1, createdAt: -1 });
TransactionLogSchema.index({ refundId: 1, createdAt: -1 });

module.exports = mongoose.model('TransactionLog', TransactionLogSchema);
