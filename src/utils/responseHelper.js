/**
 * Unified Response Helper
 * Standard response format for all API endpoints
 */

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};

// Error Codes
const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    BAD_REQUEST: 'BAD_REQUEST',
};

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {*} options.data - Response data (optional)
 * @param {string} options.message - Success message
 * @param {number} options.statusCode - HTTP status code (default: 200)
 * @param {Object} options.meta - Additional metadata (optional)
 */
const sendSuccess = (res, { data = null, message = 'Success', statusCode = HTTP_STATUS.OK, meta = null } = {}) => {
    const response = {
        success: true,
        statusCode,
        message,
    };

    if (data !== null) {
        response.data = data;
    }

    if (meta !== null) {
        response.meta = meta;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {string} options.message - Error message
 * @param {number} options.statusCode - HTTP status code (default: 500)
 * @param {string} options.code - Error code (optional)
 * @param {*} options.details - Error details (optional, shown in dev only)
 * @param {*} options.errors - Validation errors array (optional)
 */
const sendError = (res, { message = 'Internal server error', statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, code = ERROR_CODES.INTERNAL_ERROR, details = null, errors = null } = {}) => {
    const response = {
        success: false,
        statusCode,
        message,
        error: {
            code,
        },
    };

    // Include validation errors if present
    if (errors !== null) {
        response.error.errors = errors;
    }

    // Include details only in development
    if (details !== null && process.env.NODE_ENV === 'development') {
        response.error.details = details;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {Array} options.data - Array of items
 * @param {number} options.page - Current page
 * @param {number} options.limit - Items per page
 * @param {number} options.total - Total items count
 * @param {string} options.message - Success message
 */
const sendPaginated = (res, { data, page, limit, total, message = 'Data retrieved successfully' }) => {
    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, {
        data,
        message,
        statusCode: HTTP_STATUS.OK,
    });
};

/**
 * Send created response (201)
 */
const sendCreated = (res, { data = null, message = 'Created successfully' } = {}) => {
    return sendSuccess(res, { data, message, statusCode: HTTP_STATUS.CREATED });
};

/**
 * Send no content response (204)
 */
const sendNoContent = (res) => {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
};

/**
 * @deprecated Use sendSuccess or sendError instead
 * Backward compatibility wrapper for standardResponse pattern
 * @param {Object} res - Express response object
 * @param {boolean} success - Success flag
 * @param {*} data - Response data
 * @param {string} message - Response message
 * @param {number} statusCode - HTTP status code
 * @param {Object} meta - Additional metadata
 */
const standardResponse = (res, success, data, message, statusCode = 200, meta = {}) => {
    if (success) {
        return sendSuccess(res, { data, message, statusCode, meta });
    } else {
        return sendError(res, {
            message,
            statusCode,
            details: data,
        });
    }
};

/**
 * @deprecated Use sendError instead
 * Backward compatibility wrapper for errorResponse pattern
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {*} error - Error details
 */
const errorResponse = (res, message, statusCode = 500, error = null) => {
    return sendError(res, {
        message,
        statusCode,
        details: error,
    });
};

module.exports = {
    HTTP_STATUS,
    ERROR_CODES,
    sendSuccess,
    sendError,
    sendPaginated,
    sendCreated,
    sendNoContent,
    // Backward compatibility (deprecated)
    standardResponse,
    errorResponse,
};