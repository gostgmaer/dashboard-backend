// services/RazorpayService.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { payment } = require('../../config/setting');
const Setting = require('../../models/Setting');

class RazorpayService {
    constructor() {
        // Constructor is kept minimal to avoid synchronous boot dependency
    }

    async getClient() {
        const siteKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
        const dbSettings = await Setting.getSettingsBySite(siteKey);

        const key_id = dbSettings?.razorpayKeyId || payment?.razorpay?.publicKey;
        const key_secret = dbSettings?.razorpayKeySecret || payment?.razorpay?.secretKey;

        if (!key_id || !key_secret) {
            throw new Error('Razorpay keys are not configured');
        }

        return new Razorpay({ key_id, key_secret });
    }

    async createPayment(paymentData) {
        try {
            const razorpay = await this.getClient();
            const orderOptions = {
                amount: Math.round(paymentData.amount * 100), // Convert to paise
                currency: paymentData.currency || 'INR',
                receipt: paymentData.paymentId,
                payment_capture: 1, // Auto capture
                notes: {
                    order_id: paymentData.orderId,
                    payment_id: paymentData.paymentId
                }
            };

            const order = await razorpay.orders.create(orderOptions);

            return {
                success: true,
                paymentId: order.id,
                amount: order.amount,
                currency: order.currency,
                status: order.status,
                data: order
            };
        } catch (error) {
            return {
                success: false,
                error: error.error || error.message,
                status: 'failed'
            };
        }
    }

    async capturePayment(paymentId, amount) {
        try {
            const razorpay = await this.getClient();
            const paymentDoc = await razorpay.payments.capture(
                paymentId, 
                Math.round(amount * 100)
            );

            return {
                success: true,
                captureId: paymentDoc.id,
                status: paymentDoc.status,
                data: paymentDoc
            };
        } catch (error) {
            return {
                success: false,
                error: error.error || error.message,
                status: 'failed'
            };
        }
    }

    async refundPayment(paymentId, refundData) {
        try {
            const razorpay = await this.getClient();
            const refundOptions = {
                amount: Math.round(refundData.amount * 100), // Convert to paise
                speed: 'optimum',
                notes: {
                    refund_id: refundData.refundId,
                    reason: refundData.reason
                },
                receipt: refundData.refundId
            };

            const refund = await razorpay.payments.refund(paymentId, refundOptions);

            return {
                success: true,
                refundId: refund.id,
                status: refund.status,
                data: refund
            };
        } catch (error) {
            return {
                success: false,
                error: error.error || error.message,
                status: 'failed'
            };
        }
    }

    async verifyWebhook(headers, body) {
        try {
            const siteKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
            const dbSettings = await Setting.getSettingsBySite(siteKey);
            const webhookSecret = dbSettings?.razorpayWebhookSecret || payment?.razorpay?.webhookSecret;

            if (!webhookSecret) {
                throw new Error('Razorpay webhook secret is not configured');
            }

            const signature = headers['x-razorpay-signature'];

            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(body)
                .digest('hex');

            const isValid = crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );

            return {
                isValid,
                signature,
                expectedSignature
            };
        } catch (error) {
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    async verifyPaymentSignature(orderId, paymentId, signature) {
        try {
            const siteKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
            const dbSettings = await Setting.getSettingsBySite(siteKey);
            const key_secret = dbSettings?.razorpayKeySecret || payment?.razorpay?.secretKey;

            if (!key_secret) {
                throw new Error('Razorpay secret key is not configured');
            }

            const body = `${orderId}|${paymentId}`;

            const expectedSignature = crypto
                .createHmac('sha256', key_secret)
                .update(body)
                .digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature)
            );
        } catch (error) {
            return false;
        }
    }

    async getPaymentStatus(paymentId) {
        try {
            const razorpay = await this.getClient();
            const paymentDoc = await razorpay.payments.fetch(paymentId);

            return {
                success: true,
                status: paymentDoc.status,
                data: paymentDoc
            };
        } catch (error) {
            return {
                success: false,
                error: error.error || error.message
            };
        }
    }

    async getOrderStatus(orderId) {
        try {
            const razorpay = await this.getClient();
            const order = await razorpay.orders.fetch(orderId);

            return {
                success: true,
                status: order.status,
                data: order
            };
        } catch (error) {
            return {
                success: false,
                error: error.error || error.message
            };
        }
    }
}

module.exports = RazorpayService;
