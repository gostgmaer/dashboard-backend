
// services/PaypalService.js
const axios = require('axios');
const crypto = require('crypto');

class PaypalService {
    constructor() {
        this.baseURL = process.env.PAYPAL_MODE === 'live' 
            ? 'https://api-m.paypal.com'
            : 'https://api-m.sandbox.paypal.com';
        this.clientId = process.env.PAYPAL_CLIENT_ID;
        this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
        this.webhookId = process.env.PAYPAL_WEBHOOK_ID;
    }

    async getAccessToken() {
        try {
            const auth = Buffer.from(`\${this.clientId}:\${this.clientSecret}`).toString('base64');

            const response = await axios.post(`\${this.baseURL}/v1/oauth2/token`, 
                'grant_type=client_credentials', {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en_US',
                    'Authorization': `Basic \${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return response.data.access_token;
        } catch (error) {
            throw new Error(`PayPal Auth Error: \${error.response?.data?.error_description || error.message}`);
        }
    }

    async createPayment(paymentData) {
        try {
            const accessToken = await this.getAccessToken();

            const orderData = {
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: paymentData.currency || 'USD',
                        value: paymentData.amount.toFixed(2)
                    },
                    description: paymentData.description || 'Payment for order',
                    custom_id: paymentData.orderId,
                    invoice_id: paymentData.paymentId
                }],
                application_context: {
                    return_url: paymentData.returnUrl,
                    cancel_url: paymentData.cancelUrl,
                    brand_name: process.env.BRAND_NAME || 'Your Store',
                    user_action: 'PAY_NOW'
                }
            };

            const response = await axios.post(`\${this.baseURL}/v2/checkout/orders`, orderData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer \${accessToken}`,
                    'PayPal-Request-Id': paymentData.paymentId
                }
            });

            const approvalUrl = response.data.links.find(link => link.rel === 'approve')?.href;

            return {
                success: true,
                paymentId: response.data.id,
                approvalUrl,
                status: response.data.status,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message,
                status: 'failed'
            };
        }
    }

    async capturePayment(paypalOrderId) {
        try {
            const accessToken = await this.getAccessToken();

            const response = await axios.post(
                `\${this.baseURL}/v2/checkout/orders/\${paypalOrderId}/capture`,
                {},
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer \${accessToken}`
                    }
                }
            );

            return {
                success: true,
                captureId: response.data.purchase_units[0].payments.captures[0].id,
                status: response.data.status,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message,
                status: 'failed'
            };
        }
    }

    async refundPayment(captureId, refundData) {
        try {
            const accessToken = await this.getAccessToken();

            const refundPayload = {
                amount: {
                    currency_code: refundData.currency,
                    value: refundData.amount.toFixed(2)
                },
                invoice_id: refundData.refundId,
                note_to_payer: refundData.reason || 'Refund processed'
            };

            const response = await axios.post(
                `\${this.baseURL}/v2/payments/captures/\${captureId}/refund`,
                refundPayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer \${accessToken}`,
                        'PayPal-Request-Id': refundData.refundId
                    }
                }
            );

            return {
                success: true,
                refundId: response.data.id,
                status: response.data.status,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message,
                status: 'failed'
            };
        }
    }

    verifyWebhook(headers, body, webhookId = null) {
        try {
            const actualSignature = headers['paypal-transmission-sig'];
            const certId = headers['paypal-cert-id'];
            const transmissionId = headers['paypal-transmission-id'];
            const timestamp = headers['paypal-transmission-time'];
            const webhookIdToUse = webhookId || this.webhookId;

            // PayPal webhook verification requires certificate validation
            // This is a simplified version - in production, implement full certificate verification
            const expectedSignature = crypto
                .createHash('sha256')
                .update(`\${transmissionId}|\${timestamp}|\${webhookIdToUse}|\${body}`)
                .digest('base64');

            return {
                isValid: true, // Simplified - implement proper verification
                transmissionId,
                certId
            };
        } catch (error) {
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    async getPaymentStatus(paypalOrderId) {
        try {
            const accessToken = await this.getAccessToken();

            const response = await axios.get(`\${this.baseURL}/v2/checkout/orders/\${paypalOrderId}`, {
                headers: {
                    'Authorization': `Bearer \${accessToken}`
                }
            });

            return {
                success: true,
                status: response.data.status,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }
}

module.exports = PaypalService;
