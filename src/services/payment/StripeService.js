
// services/StripeService.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

class StripeService {
    constructor() {
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    }

    async createPayment(paymentData) {
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(paymentData.amount * 100), // Convert to cents
                currency: paymentData.currency || 'usd',
                metadata: {
                    order_id: paymentData.orderId,
                    payment_id: paymentData.paymentId
                },
                description: paymentData.description || 'Payment for order',
                receipt_email: paymentData.customerEmail,
                confirm: false // Manual confirmation
            });

            return {
                success: true,
                paymentId: paymentIntent.id,
                clientSecret: paymentIntent.client_secret,
                status: paymentIntent.status,
                data: paymentIntent
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                status: 'failed'
            };
        }
    }

    async confirmPayment(paymentIntentId, paymentMethodId) {
        try {
            const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
                payment_method: paymentMethodId
            });

            return {
                success: true,
                status: paymentIntent.status,
                data: paymentIntent
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                status: 'failed'
            };
        }
    }

    async capturePayment(paymentIntentId) {
        try {
            const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

            return {
                success: true,
                captureId: paymentIntent.id,
                status: paymentIntent.status,
                data: paymentIntent
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                status: 'failed'
            };
        }
    }

    async refundPayment(paymentIntentId, refundData) {
        try {
            const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: Math.round(refundData.amount * 100), // Convert to cents
                metadata: {
                    refund_id: refundData.refundId,
                    reason: refundData.reason
                },
                reason: this.mapRefundReason(refundData.reason)
            });

            return {
                success: true,
                refundId: refund.id,
                status: refund.status,
                data: refund
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                status: 'failed'
            };
        }
    }

    verifyWebhook(headers, body) {
        try {
            const signature = headers['stripe-signature'];

            const event = stripe.webhooks.constructEvent(
                body,
                signature,
                this.webhookSecret
            );

            return {
                isValid: true,
                event
            };
        } catch (error) {
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    async getPaymentStatus(paymentIntentId) {
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            return {
                success: true,
                status: paymentIntent.status,
                data: paymentIntent
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    mapRefundReason(reason) {
        const reasonMap = {
            'customer_request': 'requested_by_customer',
            'order_cancelled': 'requested_by_customer',
            'duplicate_payment': 'duplicate',
            'fraud': 'fraudulent'
        };

        return reasonMap[reason] || 'requested_by_customer';
    }

    async createSetupIntent(customerId) {
        try {
            const setupIntent = await stripe.setupIntents.create({
                customer: customerId,
                usage: 'off_session'
            });

            return {
                success: true,
                setupIntent
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = StripeService;
