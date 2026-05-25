// controllers/WebhookController.js
const mongoose = require('mongoose');
const Payment = require('../models/payment');
const TransactionLog = require('../models/TransactionLog');
const Order = require('../models/orders');
const PaypalService = require('../services/payment/PaypalService');
const RazorpayService = require('../services/payment/RazorpayService');
const StripeService = require('../services/payment/StripeService');
const { sendSuccess, sendError, HTTP_STATUS, ERROR_CODES } = require('../utils/responseHelper');
const AppError = require('../utils/appError');
const { catchAsync } = require('../middleware/errorHandler');

const createGatewayClient = (ServiceClass, gatewayName) => {
    try {
        return new ServiceClass();
    } catch (error) {
        console.error(`Failed to initialize ${gatewayName} gateway client:`, error.message);
        return null;
    }
};

class WebhookController {
    constructor() {
        this.paypalService = createGatewayClient(PaypalService, 'paypal');
        this.razorpayService = createGatewayClient(RazorpayService, 'razorpay');
        this.stripeService = createGatewayClient(StripeService, 'stripe');
    }

    getWebhookEventId(gateway, event, headers = {}) {
        if (gateway === 'paypal') {
            return event?.id || headers['paypal-transmission-id'] || null;
        }
        if (gateway === 'razorpay') {
            return headers['x-razorpay-event-id'] || event?.payload?.payment?.entity?.id || event?.payload?.refund?.entity?.id || null;
        }
        if (gateway === 'stripe') {
            return event?.id || headers['stripe-signature'] || null;
        }
        return null;
    }

    extractOrderIdFromWebhook(gateway, event) {
        if (gateway === 'paypal') {
            return event?.resource?.custom_id || null;
        }
        if (gateway === 'stripe') {
            return event?.data?.object?.metadata?.order_id || null;
        }
        return null;
    }

    async registerWebhook(gateway, eventType, eventData, headers = {}) {
        const webhookEventId = this.getWebhookEventId(gateway, eventData, headers);
        const orderId = this.extractOrderIdFromWebhook(gateway, eventData);

        if (webhookEventId) {
            const existing = await TransactionLog.findOne({ gateway, webhookEventId, eventType: 'webhook_received' });
            if (existing) {
                return { duplicate: true, webhookEventId };
            }
        }

        const webhookLog = new TransactionLog({
            orderId,
            eventType: 'webhook_received',
            gateway,
            status: eventType,
            webhookEventId: webhookEventId || undefined,
            data: eventData,
        });

        try {
            await webhookLog.save();
        } catch (error) {
            if (error?.code === 11000 && webhookEventId) {
                return { duplicate: true, webhookEventId };
            }
            throw error;
        }

        return { duplicate: false, webhookEventId };
    }

    async syncPaymentAndOrderAsPaid(payment, metadataPatch = {}) {
        const session = await mongoose.startSession();
        try {
            await session.startTransaction();

            const paymentDoc = await Payment.findById(payment._id).session(session);
            if (!paymentDoc) {
                await session.abortTransaction();
                return;
            }

            if (paymentDoc.status !== 'COMPLETED') {
                paymentDoc.status = 'COMPLETED';
                paymentDoc.completedAt = new Date();
                paymentDoc.metadata = { ...paymentDoc.metadata, ...metadataPatch };
                await paymentDoc.save({ session });
            }

            await Order.findByIdAndUpdate(
                paymentDoc.orderId,
                {
                    payment_status: 'paid',
                    status: 'processing',
                    paymentStatus: 'paid',
                },
                { session }
            );

            await this.logTransaction(paymentDoc, 'payment_completed', 'COMPLETED', null, session);
            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // POST /webhook/paypal
    handlePaypalWebhook = catchAsync(async (req, res) => {
        if (!this.paypalService) {
            return res.status(503).json({ success: false, message: 'PayPal webhook service is unavailable' });
        }
        const verification = this.paypalService.verifyWebhook(req.headers, req.rawBody);

        if (!verification.isValid) {
            console.error('Invalid PayPal webhook signature');
            throw AppError.badRequest('Invalid signature');
        }

        const event = req.body;
        const webhookRegistration = await this.registerWebhook('paypal', event.event_type, event, req.headers);
        if (webhookRegistration.duplicate) {
            return sendSuccess(res, {
                data: { received: true, duplicate: true },
                message: 'Duplicate PayPal webhook ignored',
            });
        }
        console.log('PayPal Webhook Event:', event.event_type);

        switch (event.event_type) {
            case 'CHECKOUT.ORDER.APPROVED':
                await this.handlePaypalOrderApproved(event);
                break;
            case 'PAYMENT.CAPTURE.COMPLETED':
                await this.handlePaypalPaymentCompleted(event);
                break;
            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.CAPTURE.DECLINED':
                await this.handlePaypalPaymentFailed(event);
                break;
            case 'PAYMENT.CAPTURE.REFUNDED':
                await this.handlePaypalRefundCompleted(event);
                break;
            default:
                console.log('Unhandled PayPal event:', event.event_type);
        }

        return sendSuccess(res, {
            data: { received: true },
            message: 'PayPal webhook processed',
        });
    });

    // POST /webhook/razorpay
    handleRazorpayWebhook = catchAsync(async (req, res) => {
        if (!this.razorpayService) {
            return res.status(503).json({ success: false, message: 'Razorpay webhook service is unavailable' });
        }
        const verification = this.razorpayService.verifyWebhook(req.headers, req.rawBody);

        if (!verification.isValid) {
            console.error('Invalid Razorpay webhook signature');
            throw AppError.badRequest('Invalid signature');
        }

        const event = req.body;
        const webhookRegistration = await this.registerWebhook('razorpay', event.event, event, req.headers);
        if (webhookRegistration.duplicate) {
            return sendSuccess(res, {
                data: { received: true, duplicate: true },
                message: 'Duplicate Razorpay webhook ignored',
            });
        }
        console.log('Razorpay Webhook Event:', event.event);

        switch (event.event) {
            case 'payment.authorized':
                await this.handleRazorpayPaymentAuthorized(event);
                break;
            case 'payment.captured':
                await this.handleRazorpayPaymentCaptured(event);
                break;
            case 'payment.failed':
                await this.handleRazorpayPaymentFailed(event);
                break;
            case 'order.paid':
                await this.handleRazorpayOrderPaid(event);
                break;
            case 'refund.created':
                await this.handleRazorpayRefundCreated(event);
                break;
            case 'refund.processed':
                await this.handleRazorpayRefundProcessed(event);
                break;
            case 'refund.failed':
                await this.handleRazorpayRefundFailed(event);
                break;
            default:
                console.log('Unhandled Razorpay event:', event.event);
        }

        return sendSuccess(res, {
            data: { received: true },
            message: 'Razorpay webhook processed',
        });
    });

    // POST /webhook/stripe
    handleStripeWebhook = catchAsync(async (req, res) => {
        if (!this.stripeService) {
            return res.status(503).json({ success: false, message: 'Stripe webhook service is unavailable' });
        }
        const verification = this.stripeService.verifyWebhook(req.headers, req.rawBody);

        if (!verification.isValid) {
            console.error('Invalid Stripe webhook signature');
            throw AppError.badRequest('Invalid signature');
        }

        const event = verification.event;
        const webhookRegistration = await this.registerWebhook('stripe', event.type, event, req.headers);
        if (webhookRegistration.duplicate) {
            return sendSuccess(res, {
                data: { received: true, duplicate: true },
                message: 'Duplicate Stripe webhook ignored',
            });
        }
        console.log('Stripe Webhook Event:', event.type);

        switch (event.type) {
            case 'payment_intent.succeeded':
                await this.handleStripePaymentSucceeded(event);
                break;
            case 'payment_intent.payment_failed':
                await this.handleStripePaymentFailed(event);
                break;
            case 'payment_intent.canceled':
                await this.handleStripePaymentCanceled(event);
                break;
            case 'charge.dispute.created':
                await this.handleStripeDisputeCreated(event);
                break;
            case 'invoice.payment_succeeded':
                await this.handleStripeInvoicePaymentSucceeded(event);
                break;
            default:
                console.log('Unhandled Stripe event:', event.type);
        }

        return sendSuccess(res, {
            data: { received: true },
            message: 'Stripe webhook processed',
        });
    });

    // PayPal webhook handlers
    async handlePaypalOrderApproved(event) {
        const orderId = event.resource.id;
        const payment = await Payment.findOne({ gatewayPaymentId: orderId });

        if (payment) {
            payment.status = 'PROCESSING';
            payment.metadata = { ...payment.metadata, approval: event.resource };
            await payment.save();

            await this.logTransaction(payment, 'payment_processing', 'PROCESSING');
        }
    }

    async handlePaypalPaymentCompleted(event) {
        const captureId = event.resource.id;
        const customId = event.resource.custom_id;

        const payment = await Payment.findOne({ orderId: customId });

        if (payment) {
            await this.syncPaymentAndOrderAsPaid(payment, { capture: event.resource });
        }
    }

    async handlePaypalPaymentFailed(event) {
        const orderId = event.resource.supplementary_data?.related_ids?.order_id;
        const payment = await Payment.findOne({ gatewayPaymentId: orderId });

        if (payment) {
            payment.status = 'FAILED';
            payment.failureReason = event.resource.reason_code || 'Payment denied';
            await payment.save();

            await this.logTransaction(payment, 'payment_failed', 'FAILED');
        }
    }

    async handlePaypalRefundCompleted(event) {
        const refundId = event.resource.id;
        const invoiceId = event.resource.invoice_id;

        const payment = await Payment.findOne({ 'refunds.refundId': invoiceId });

        if (payment) {
            payment.updateRefundStatus(invoiceId, 'completed', refundId, event.resource);
            await payment.save();

            await this.logTransaction(payment, 'refund_completed', 'COMPLETED', invoiceId);
        }
    }

    // Razorpay webhook handlers
    async handleRazorpayPaymentAuthorized(event) {
        const paymentData = event.payload.payment.entity;
        const payment = await Payment.findOne({ gatewayPaymentId: paymentData.order_id });

        if (payment) {
            payment.status = 'PROCESSING';
            payment.metadata = { ...payment.metadata, authorization: paymentData };
            await payment.save();

            await this.logTransaction(payment, 'payment_processing', 'PROCESSING');
        }
    }

    async handleRazorpayPaymentCaptured(event) {
        const paymentData = event.payload.payment.entity;
        const payment = await Payment.findOne({ gatewayPaymentId: paymentData.order_id });

        if (payment) {
            await this.syncPaymentAndOrderAsPaid(payment, { capture: paymentData });
        }
    }

    async handleRazorpayPaymentFailed(event) {
        const paymentData = event.payload.payment.entity;
        const payment = await Payment.findOne({ gatewayPaymentId: paymentData.order_id });

        if (payment) {
            payment.status = 'FAILED';
            payment.failureReason = paymentData.error_description || 'Payment failed';
            await payment.save();

            await this.logTransaction(payment, 'payment_failed', 'FAILED');
        }
    }

    async handleRazorpayOrderPaid(event) {
        const orderData = event.payload.order.entity;
        const payment = await Payment.findOne({ gatewayPaymentId: orderData.id });

        if (payment) {
            await this.syncPaymentAndOrderAsPaid(payment, { orderPaid: orderData });
        }
    }

    async handleRazorpayRefundCreated(event) {
        const refundData = event.payload.refund.entity;
        const payment = await Payment.findOne({ 'refunds.gatewayRefundId': refundData.id });

        if (payment) {
            const refund = payment.refunds.find((r) => r.gatewayRefundId === refundData.id);
            if (refund) {
                refund.status = 'processing';
                refund.metadata = refundData;
                await payment.save();

                await this.logTransaction(payment, 'refund_processing', 'PROCESSING', refund.refundId);
            }
        }
    }

    async handleRazorpayRefundProcessed(event) {
        const refundData = event.payload.refund.entity;
        const payment = await Payment.findOne({ 'refunds.gatewayRefundId': refundData.id });

        if (payment) {
            const refund = payment.refunds.find((r) => r.gatewayRefundId === refundData.id);
            if (refund) {
                refund.status = 'completed';
                refund.processedAt = new Date();
                refund.metadata = refundData;
                await payment.save();

                await this.logTransaction(payment, 'refund_completed', 'COMPLETED', refund.refundId);
            }
        }
    }

    async handleRazorpayRefundFailed(event) {
        const refundData = event.payload.refund.entity;
        const payment = await Payment.findOne({ 'refunds.gatewayRefundId': refundData.id });

        if (payment) {
            const refund = payment.refunds.find((r) => r.gatewayRefundId === refundData.id);
            if (refund) {
                refund.status = 'failed';
                refund.failureReason = refundData.error_description || 'Refund failed';
                await payment.save();

                await this.logTransaction(payment, 'refund_failed', 'FAILED', refund.refundId);
            }
        }
    }

    // Stripe webhook handlers
    async handleStripePaymentSucceeded(event) {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.order_id;

        const payment = await Payment.findOne({ orderId });

        if (payment) {
            await this.syncPaymentAndOrderAsPaid(payment, { paymentIntent });
        }
    }

    async handleStripePaymentFailed(event) {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.order_id;

        const payment = await Payment.findOne({ orderId });

        if (payment) {
            payment.status = 'FAILED';
            payment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
            await payment.save();

            await this.logTransaction(payment, 'payment_failed', 'FAILED');
        }
    }

    async handleStripePaymentCanceled(event) {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.order_id;

        const payment = await Payment.findOne({ orderId });

        if (payment) {
            payment.status = 'CANCELLED';
            payment.failureReason = 'Payment cancelled by user';
            await payment.save();

            await this.logTransaction(payment, 'payment_cancelled', 'CANCELLED');
        }
    }

    async handleStripeDisputeCreated(event) {
        const dispute = event.data.object;
        const chargeId = dispute.charge;
        console.log('Stripe dispute created for charge:', chargeId);
    }

    async handleStripeInvoicePaymentSucceeded(event) {
        const invoice = event.data.object;
        console.log('Stripe invoice payment succeeded:', invoice.id);
    }

    // Helper methods
    async logTransaction(payment, eventType, status, refundId = null, session = null) {
        try {
            const logData = {
                orderId: payment.orderId,
                paymentId: payment._id,
                refundId: refundId,
                eventType,
                gateway: String(payment.gateway || '').toLowerCase(),
                status,
                data: { webhook: true },
            };

            const transactionLog = new TransactionLog(logData);
            await transactionLog.save(session ? { session } : undefined);
        } catch (error) {
            console.error('Failed to log webhook transaction:', error);
        }
    }
}

module.exports = new WebhookController();
