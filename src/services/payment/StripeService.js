// services/StripeService.js
const { payment } = require('../../config/setting');
const StripeFactory = require('stripe');
const Setting = require('../../models/Setting');

class StripeService {
    constructor() {
        // Constructor is kept minimal to avoid synchronous boot dependency
    }

    async getClient() {
        const siteKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
        const dbSettings = await Setting.getSettingsBySite(siteKey);
        
        const secretKey = dbSettings?.stripeSecretKey || payment?.stripe?.secretKey;
        if (!secretKey) {
            throw new Error('Stripe client secret key is not configured');
        }
        return StripeFactory(secretKey);
    }

    async createPayment(paymentData) {
        try {
            const stripe = await this.getClient();
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
            const stripe = await this.getClient();
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
            const stripe = await this.getClient();
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
            const stripe = await this.getClient();
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

    async verifyWebhook(headers, body) {
        try {
            const siteKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
            const dbSettings = await Setting.getSettingsBySite(siteKey);
            const stripe = await this.getClient();
            const signature = headers['stripe-signature'];
            const webhookSecret = dbSettings?.stripeWebhookSecret || payment?.stripe?.webhookSecret;

            if (!webhookSecret) {
                throw new Error('Stripe webhook secret is not configured');
            }

            const event = stripe.webhooks.constructEvent(
                body,
                signature,
                webhookSecret
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
            const stripe = await this.getClient();
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
            const stripe = await this.getClient();
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
