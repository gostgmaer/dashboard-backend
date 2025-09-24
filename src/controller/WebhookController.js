
// controllers/WebhookController.js
const Payment = require('../models/payment');
const TransactionLog = require('../models/TransactionLog');
const Order = require('../models/order');
const PaypalService = require('../services/payment/PaypalService');
const RazorpayService = require('../services/payment/PaypalService');
const StripeService = require('../services/payment/StripeService');
const { safeApiCall } = require('../utils/safeApiCall');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../utils/apiUtils');
class WebhookController {
    constructor() {
        this.paypalService = new PaypalService();
        this.razorpayService = new RazorpayService();
        this.stripeService = new StripeService();
    }

    // POST /webhook/paypal
    handlePaypalWebhook = safeApiCall(async (req, res) => {
        const verification = this.paypalService.verifyWebhook(req.headers, req.rawBody);

        if (!verification.isValid) {
            console.error('Invalid PayPal webhook signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = req.body;
        console.log('PayPal Webhook Event:', event.event_type);

        try {
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

            await this.logWebhookEvent('paypal', event.event_type, event);
            res.status(200).json({ received: true });
        } catch (error) {
            console.error('PayPal webhook error:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    });

    // POST /webhook/razorpay
    handleRazorpayWebhook = safeApiCall(async (req, res) => {
        const verification = this.razorpayService.verifyWebhook(req.headers, req.rawBody);

        if (!verification.isValid) {
            console.error('Invalid Razorpay webhook signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = req.body;
        console.log('Razorpay Webhook Event:', event.event);

        try {
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

            await this.logWebhookEvent('razorpay', event.event, event);
            res.status(200).json({ received: true });
        } catch (error) {
            console.error('Razorpay webhook error:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    });

    // POST /webhook/stripe
    handleStripeWebhook = safeApiCall(async (req, res) => {
        const verification = this.stripeService.verifyWebhook(req.headers, req.rawBody);

        if (!verification.isValid) {
            console.error('Invalid Stripe webhook signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = verification.event;
        console.log('Stripe Webhook Event:', event.type);

        try {
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

            await this.logWebhookEvent('stripe', event.type, event);
            res.status(200).json({ received: true });
        } catch (error) {
            console.error('Stripe webhook error:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    });

    // PayPal webhook handlers
    async handlePaypalOrderApproved(event) {
        const orderId = event.resource.id;
        const payment = await Payment.findOne({ gatewayPaymentId: orderId });

        if (payment) {
            payment.status = 'processing';
            payment.metadata = { ...payment.metadata, approval: event.resource };
            await payment.save();

            await this.logTransaction(payment, 'payment_processing', 'processing');
        }
    }

    async handlePaypalPaymentCompleted(event) {
        const captureId = event.resource.id;
        const customId = event.resource.custom_id;

        const payment = await Payment.findOne({ orderId: customId });

        if (payment) {
            payment.status = 'completed';
            payment.completedAt = new Date();
            payment.metadata = { ...payment.metadata, capture: event.resource };
            await payment.save();

            await Order.findByIdAndUpdate(payment.orderId, {
                paymentStatus: 'paid',
                status: 'confirmed'
            });

            await this.logTransaction(payment, 'payment_completed', 'completed');
        }
    }

    async handlePaypalPaymentFailed(event) {
        const orderId = event.resource.supplementary_data?.related_ids?.order_id;
        const payment = await Payment.findOne({ gatewayPaymentId: orderId });

        if (payment) {
            payment.status = 'failed';
            payment.failureReason = event.resource.reason_code || 'Payment denied';
            await payment.save();

            await this.logTransaction(payment, 'payment_failed', 'failed');
        }
    }

    async handlePaypalRefundCompleted(event) {
        const refundId = event.resource.id;
        const invoiceId = event.resource.invoice_id;

        // Find payment with matching refund
        const payment = await Payment.findOne({ 'refunds.refundId': invoiceId });

        if (payment) {
            payment.updateRefundStatus(invoiceId, 'completed', refundId, event.resource);
            await payment.save();

            await this.logTransaction(payment, 'refund_completed', 'completed', invoiceId);
        }
    }

    // Razorpay webhook handlers
    async handleRazorpayPaymentAuthorized(event) {
        const paymentData = event.payload.payment.entity;
        const payment = await Payment.findOne({ gatewayPaymentId: paymentData.order_id });

        if (payment) {
            payment.status = 'processing';
            payment.metadata = { ...payment.metadata, authorization: paymentData };
            await payment.save();

            await this.logTransaction(payment, 'payment_processing', 'processing');
        }
    }

    async handleRazorpayPaymentCaptured(event) {
        const paymentData = event.payload.payment.entity;
        const payment = await Payment.findOne({ gatewayPaymentId: paymentData.order_id });

        if (payment) {
            payment.status = 'completed';
            payment.completedAt = new Date();
            payment.metadata = { ...payment.metadata, capture: paymentData };
            await payment.save();

            await Order.findByIdAndUpdate(payment.orderId, {
                paymentStatus: 'paid',
                status: 'confirmed'
            });

            await this.logTransaction(payment, 'payment_completed', 'completed');
        }
    }

    async handleRazorpayPaymentFailed(event) {
        const paymentData = event.payload.payment.entity;
        const payment = await Payment.findOne({ gatewayPaymentId: paymentData.order_id });

        if (payment) {
            payment.status = 'failed';
            payment.failureReason = paymentData.error_description || 'Payment failed';
            await payment.save();

            await this.logTransaction(payment, 'payment_failed', 'failed');
        }
    }

    async handleRazorpayOrderPaid(event) {
        const orderData = event.payload.order.entity;
        const payment = await Payment.findOne({ gatewayPaymentId: orderData.id });

        if (payment && payment.status !== 'completed') {
            payment.status = 'completed';
            payment.completedAt = new Date();
            payment.metadata = { ...payment.metadata, orderPaid: orderData };
            await payment.save();

            await Order.findByIdAndUpdate(payment.orderId, {
                paymentStatus: 'paid',
                status: 'confirmed'
            });

            await this.logTransaction(payment, 'payment_completed', 'completed');
        }
    }

    async handleRazorpayRefundCreated(event) {
        const refundData = event.payload.refund.entity;
        const payment = await Payment.findOne({ 'refunds.gatewayRefundId': refundData.id });

        if (payment) {
            const refund = payment.refunds.find(r => r.gatewayRefundId === refundData.id);
            if (refund) {
                refund.status = 'processing';
                refund.metadata = refundData;
                await payment.save();

                await this.logTransaction(payment, 'refund_processing', 'processing', refund.refundId);
            }
        }
    }

    async handleRazorpayRefundProcessed(event) {
        const refundData = event.payload.refund.entity;
        const payment = await Payment.findOne({ 'refunds.gatewayRefundId': refundData.id });

        if (payment) {
            const refund = payment.refunds.find(r => r.gatewayRefundId === refundData.id);
            if (refund) {
                refund.status = 'completed';
                refund.processedAt = new Date();
                refund.metadata = refundData;
                await payment.save();

                await this.logTransaction(payment, 'refund_completed', 'completed', refund.refundId);
            }
        }
    }

    async handleRazorpayRefundFailed(event) {
        const refundData = event.payload.refund.entity;
        const payment = await Payment.findOne({ 'refunds.gatewayRefundId': refundData.id });

        if (payment) {
            const refund = payment.refunds.find(r => r.gatewayRefundId === refundData.id);
            if (refund) {
                refund.status = 'failed';
                refund.failureReason = refundData.error_description || 'Refund failed';
                await payment.save();

                await this.logTransaction(payment, 'refund_failed', 'failed', refund.refundId);
            }
        }
    }

    // Stripe webhook handlers
    async handleStripePaymentSucceeded(event) {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.order_id;

        const payment = await Payment.findOne({ orderId });

        if (payment) {
            payment.status = 'completed';
            payment.completedAt = new Date();
            payment.metadata = { ...payment.metadata, paymentIntent };
            await payment.save();

            await Order.findByIdAndUpdate(payment.orderId, {
                paymentStatus: 'paid',
                status: 'confirmed'
            });

            await this.logTransaction(payment, 'payment_completed', 'completed');
        }
    }

    async handleStripePaymentFailed(event) {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.order_id;

        const payment = await Payment.findOne({ orderId });

        if (payment) {
            payment.status = 'failed';
            payment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
            await payment.save();

            await this.logTransaction(payment, 'payment_failed', 'failed');
        }
    }

    async handleStripePaymentCanceled(event) {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.order_id;

        const payment = await Payment.findOne({ orderId });

        if (payment) {
            payment.status = 'cancelled';
            payment.failureReason = 'Payment cancelled by user';
            await payment.save();

            await this.logTransaction(payment, 'payment_cancelled', 'cancelled');
        }
    }

    async handleStripeDisputeCreated(event) {
        const dispute = event.data.object;
        const chargeId = dispute.charge;

        // Handle dispute logic - update payment status, notify admin, etc.
        console.log('Stripe dispute created for charge:', chargeId);
    }

    async handleStripeInvoicePaymentSucceeded(event) {
        const invoice = event.data.object;
        console.log('Stripe invoice payment succeeded:', invoice.id);
        // Handle recurring payment logic
    }

    // Helper methods
    async logTransaction(payment, eventType, status, refundId = null) {
        try {
            const logData = {
                orderId: payment.orderId,
                paymentId: payment._id,
                refundId: refundId, // This is now the refundId string, not ObjectId
                eventType,
                gateway: payment.gateway,
                status,
                data: { webhook: true }
            };

            const transactionLog = new TransactionLog(logData);
            await transactionLog.save();
        } catch (error) {
            console.error('Failed to log webhook transaction:', error);
        }
    }

    async logWebhookEvent(gateway, eventType, eventData) {
        try {
            const webhookLog = new TransactionLog({
                eventType: 'webhook_received',
                gateway,
                status: eventType,
                data: eventData
            });

            await webhookLog.save();
        } catch (error) {
            console.error('Failed to log webhook event:', error);
        }
    }
}

module.exports = new WebhookController();
