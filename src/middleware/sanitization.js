/**
 * Input Sanitization Middleware
 * Sanitizes user input to prevent XSS and injection attacks
 */

/**
 * Sanitize string by removing potentially dangerous characters
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (input) => {
    if (typeof input !== 'string') {
        return input;
    }

    return input
        .trim()
        .replace(/[<>]/g, '') // Remove < and > to prevent XSS
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=
};

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj) => {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }

    return obj;
};

/**
 * Middleware to sanitize request body, query, and params
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const sanitizeInput = (req, res, next) => {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }

    // Sanitize route parameters
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
    }

    next();
};

/**
 * Strict sanitization for specific fields (e.g., email, username)
 * Use this for fields that should only contain alphanumeric characters
 */
const sanitizeAlphanumeric = (req, res, next) => {
    const fieldsToSanitize = ['username', 'slug', 'code'];

    if (req.body) {
        fieldsToSanitize.forEach(field => {
            if (req.body[field]) {
                req.body[field] = req.body[field].replace(/[^a-zA-Z0-9_-]/g, '');
            }
        });
    }

    next();
};

/**
 * Sanitize email addresses
 */
const sanitizeEmail = (req, res, next) => {
    if (req.body && req.body.email) {
        // Convert to lowercase and trim
        req.body.email = req.body.email.toLowerCase().trim();

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(req.body.email)) {
            req.body.email = ''; // Clear invalid email
        }
    }

    next();
};

/**
 * Remove dangerous MongoDB operators from query
 * Prevents NoSQL injection
 */
const sanitizeMongoQuery = (req, res, next) => {
    const sanitize = (obj) => {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (typeof obj === 'object') {
            for (const key in obj) {
                if (key.startsWith('$')) {
                    delete obj[key]; // Remove MongoDB operators
                } else {
                    obj[key] = sanitize(obj[key]);
                }
            }
        }

        return obj;
    };

    if (req.body) {
        req.body = sanitize(req.body);
    }

    if (req.query) {
        req.query = sanitize(req.query);
    }

    next();
};

module.exports = {
    sanitizeInput,
    sanitizeAlphanumeric,
    sanitizeEmail,
    sanitizeMongoQuery,
    sanitizeString,
    sanitizeObject,
};
