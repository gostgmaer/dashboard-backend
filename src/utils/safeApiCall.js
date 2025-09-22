
// utils/safeApiCall.js
const TransactionLog = require('../models/TransactionLog');

/**
 * Wrapper function for API calls with comprehensive error handling
 * @param {Function} fn - The async function to wrap
 * @returns {Function} - Wrapped function with error handling
 */
const safeApiCall = (fn) => {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        } catch (error) {
            console.error('API Error:', error);

            // Log error for debugging
            await logError(error, req);

            // Determine error type and respond accordingly
            const errorResponse = handleError(error);

            res.status(errorResponse.status).json({
                success: false,
                message: errorResponse.message,
                ...(process.env.NODE_ENV === 'development' && { 
                    stack: error.stack 
                })
            });
        }
    };
};

/**
 * Handle different types of errors and return appropriate response
 * @param {Error} error - The error object
 * @returns {Object} - Error response object
 */
const handleError = (error) => {
    // MongoDB/Mongoose errors
    if (error.name === 'ValidationError') {
        return {
            status: 400,
            message: 'Validation failed',
            details: Object.values(error.errors).map(e => e.message)
        };
    }

    if (error.name === 'CastError') {
        return {
            status: 400,
            message: 'Invalid ID format'
        };
    }

    if (error.code === 11000) {
        return {
            status: 409,
            message: 'Duplicate entry - resource already exists'
        };
    }

    // JWT errors
    if (error.name === 'JsonWebTokenError') {
        return {
            status: 401,
            message: 'Invalid token'
        };
    }

    if (error.name === 'TokenExpiredError') {
        return {
            status: 401,
            message: 'Token expired'
        };
    }

    // Payment gateway specific errors
    if (error.message.includes('PayPal') || error.message.includes('Stripe') || error.message.includes('Razorpay')) {
        return {
            status: 422,
            message: 'Payment gateway error',
            details: error.message
        };
    }

    // Rate limiting errors
    if (error.status === 429) {
        return {
            status: 429,
            message: 'Too many requests, please try again later'
        };
    }

    // Network/timeout errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return {
            status: 503,
            message: 'Service temporarily unavailable'
        };
    }

    // Default server error
    return {
        status: 500,
        message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message
    };
};

/**
 * Log error details for debugging and monitoring
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 */
const logError = async (error, req) => {
    try {
        const errorLog = {
            eventType: 'api_error',
            gateway: 'system',
            status: 'error',
            errorDetails: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                url: req.originalUrl,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                userId: req.user?.id,
                timestamp: new Date()
            }
        };

        // Only log to database if it's not a database error
        if (!error.message.includes('MongoError') && !error.message.includes('mongoose')) {
            await TransactionLog.create(errorLog);
        } else {
            // Log to file or external service if database is down
            console.error('Database Error - Cannot log to DB:', errorLog);
        }
    } catch (logError) {
        console.error('Failed to log error:', logError);
    }
};

/**
 * Retry mechanism for payment operations
 * @param {Function} operation - The operation to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Promise} - Result of the operation
 */
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            // Don't retry for certain error types
            if (error.status === 400 || error.status === 401 || error.status === 403) {
                throw error;
            }

            if (attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff with jitter
            const backoffDelay = delay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
    }

    throw lastError;
};

/**
 * Circuit breaker pattern for external service calls
 */
class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000) {
        this.threshold = threshold;
        this.timeout = timeout;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    }

    async call(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.threshold) {
            this.state = 'OPEN';
        }
    }
}

module.exports = {
    safeApiCall,
    handleError,
    logError,
    retryOperation,
    CircuitBreaker
};
