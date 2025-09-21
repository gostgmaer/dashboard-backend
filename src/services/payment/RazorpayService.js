
// services/RazorpayService.js
const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayService {
    constructor() {
        this.razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
        this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    }

    async createPayment(paymentData) {
        try {
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

            const order = await this.razorpay.orders.create(orderOptions);

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
            const payment = await this.razorpay.payments.capture(
                paymentId, 
                Math.round(amount * 100)
            );

            return {
                success: true,
                captureId: payment.id,
                status: payment.status,
                data: payment
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
            const refundOptions = {
                amount: Math.round(refundData.amount * 100), // Convert to paise
                speed: 'optimum',
                notes: {
                    refund_id: refundData.refundId,
                    reason: refundData.reason
                },
                receipt: refundData.refundId
            };

            const refund = await this.razorpay.payments.refund(paymentId, refundOptions);

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

    verifyWebhook(headers, body) {
        try {
            const signature = headers['x-razorpay-signature'];

            const expectedSignature = crypto
                .createHmac('sha256', this.webhookSecret)
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

    verifyPaymentSignature(orderId, paymentId, signature) {
        try {
            const body = `\${orderId}|\${paymentId}`;

            const expectedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
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
            const payment = await this.razorpay.payments.fetch(paymentId);

            return {
                success: true,
                status: payment.status,
                data: payment
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
            const order = await this.razorpay.orders.fetch(orderId);

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
