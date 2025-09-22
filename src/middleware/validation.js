
// middleware/validation.js
const { body, validationResult } = require('express-validator');

const validatePaymentRequest = [
    body('orderId')
        .notEmpty()
        .withMessage('Order ID is required')
        .isMongoId()
        .withMessage('Invalid Order ID format'),

    body('gateway')
        .notEmpty()
        .withMessage('Payment gateway is required')
        .isIn(['paypal', 'razorpay', 'stripe', 'cod'])
        .withMessage('Invalid payment gateway'),

    body('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Amount must be a positive number'),

    body('currency')
        .optional()
        .isLength({ min: 3, max: 3 })
        .withMessage('Currency must be a 3-letter code'),

    body('method')
        .optional()
        .isIn(['credit_card', 'debit_card', 'net_banking', 'wallet', 'upi', 'cod'])
        .withMessage('Invalid payment method'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors.array()
            });
        }
        next();
    }
];

const validateRefundRequest = [
    body('paymentId')
        .notEmpty()
        .withMessage('Payment ID is required'),

    body('amount')
        .isFloat({ min: 0.01 })
        .withMessage('Refund amount must be a positive number'),

    body('reason')
        .notEmpty()
        .withMessage('Refund reason is required')
        .isIn(['customer_request', 'order_cancelled', 'duplicate_payment', 'fraud', 'other'])
        .withMessage('Invalid refund reason'),

    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors.array()
            });
        }
        next();
    }
];

module.exports = {
    validatePaymentRequest,
    validateRefundRequest
};
