
// config/payment.js
const { payment } = require('./setting');

const paymentConfig = {
    // Gateway configurations
    gateways: {
        paypal: {
            enabled: payment.paypal.enabled,
            mode: payment.paypal.mode,
            clientId: payment.paypal.clientId,
            clientSecret: payment.paypal.clientSecret,
            webhookId: payment.paypal.webhookId,
            supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
            limits: {
                min: 0.01,
                max: 10000
            }
        },
        razorpay: {
            enabled: payment.razorpay.enabled,
            keyId: payment.razorpay.publicKey,
            keySecret: payment.razorpay.secretKey,
            webhookSecret: payment.razorpay.webhookSecret,
            supportedCurrencies: ['INR'],
            limits: {
                min: 1,
                max: 1500000 // 15 lakh INR
            }
        },
        stripe: {
            enabled: payment.stripe.enabled,
            secretKey: payment.stripe.secretKey,
            publishableKey: payment.stripe.publicKey,
            webhookSecret: payment.stripe.webhookSecret,
            supportedCurrencies: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'],
            limits: {
                min: 0.50,
                max: 999999.99
            }
        }
    },

    // Payment settings
    settings: {
        defaultCurrency: 'INR',
        paymentTimeout: 30 * 60 * 1000, // 30 minutes
        maxRetries: 3,
        retryCooldown: 60 * 1000, // 1 minute
        refundTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days

        // Security settings
        encryptionKey: payment.encryptionKey,
        sessionTimeout: 15 * 60 * 1000, // 15 minutes

        // Webhook settings
        webhookRetries: 3,
        webhookTimeout: 30000, // 30 seconds

        // Rate limiting
        rateLimits: {
            payment: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 10 // requests per window
            },
            webhook: {
                windowMs: 60 * 1000, // 1 minute
                max: 100
            }
        }
    },

    // Status mappings
    statusMappings: {
        paypal: {
            'CREATED': 'pending',
            'SAVED': 'pending',
            'APPROVED': 'processing',
            'VOIDED': 'cancelled',
            'COMPLETED': 'completed',
            'PAYER_ACTION_REQUIRED': 'pending'
        },
        razorpay: {
            'created': 'pending',
            'attempted': 'processing',
            'paid': 'completed',
            'captured': 'completed',
            'refunded': 'refunded',
            'failed': 'failed'
        },
        stripe: {
            'requires_payment_method': 'pending',
            'requires_confirmation': 'pending',
            'requires_action': 'processing',
            'processing': 'processing',
            'requires_capture': 'processing',
            'canceled': 'cancelled',
            'succeeded': 'completed'
        }
    },

    // Error codes
    errorCodes: {
        PAYMENT_NOT_FOUND: 'PAYMENT_001',
        INVALID_GATEWAY: 'PAYMENT_002',
        AMOUNT_MISMATCH: 'PAYMENT_003',
        CURRENCY_NOT_SUPPORTED: 'PAYMENT_004',
        PAYMENT_ALREADY_PROCESSED: 'PAYMENT_005',
        REFUND_LIMIT_EXCEEDED: 'PAYMENT_006',
        GATEWAY_ERROR: 'PAYMENT_007',
        VERIFICATION_FAILED: 'PAYMENT_008',
        RETRY_LIMIT_EXCEEDED: 'PAYMENT_009',
        WEBHOOK_VERIFICATION_FAILED: 'PAYMENT_010'
    }
};

// Validation functions
const validateGatewayConfig = (gateway) => {
    const config = paymentConfig.gateways[gateway];
    if (!config || !config.enabled) {
        throw new Error(`Gateway ${gateway} is not enabled or configured`);
    }
    return true;
};

const validateAmount = (amount, currency, gateway) => {
    const config = paymentConfig.gateways[gateway];
    if (!config) {
        throw new Error(`Invalid gateway: ${gateway}`);
    }

    if (amount < config.limits.min || amount > config.limits.max) {
        throw new Error(`Amount ${amount} is outside allowed limits for ${gateway}`);
    }

    if (!config.supportedCurrencies.includes(currency)) {
        throw new Error(`Currency ${currency} is not supported by ${gateway}`);
    }

    return true;
};

const getGatewayStatus = (gateway, gatewayStatus) => {
    const mapping = paymentConfig.statusMappings[gateway];
    return mapping[gatewayStatus] || 'unknown';
};

module.exports = {
    paymentConfig,
    validateGatewayConfig,
    validateAmount,
    getGatewayStatus
};
