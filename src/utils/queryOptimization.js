/**
 * Database Query Optimization Helpers
 * Utilities for optimizing MongoDB queries
 */

/**
 * Apply lean() to query for better performance
 * Use this for read-only operations where you don't need Mongoose documents
 * 
 * @param {Query} query - Mongoose query object
 * @returns {Query} Query with lean() applied
 */
const applyLean = (query) => {
    return query.lean();
};

/**
 * Add default pagination to query
 * 
 * @param {Query} query - Mongoose query object
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Query} Query with pagination applied
 */
const applyPagination = (query, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    return query.skip(skip).limit(limit);
};

/**
 * Add sorting to query with validation
 * 
 * @param {Query} query - Mongoose query object
 * @param {string} sortBy - Field to sort by
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Query} Query with sorting applied
 */
const applySorting = (query, sortBy = 'createdAt', order = 'desc') => {
    const sortOrder = order === 'asc' ? 1 : -1;
    return query.sort({ [sortBy]: sortOrder });
};

/**
 * Apply field selection to reduce data transfer
 * 
 * @param {Query} query - Mongoose query object
 * @param {string|Array} fields - Fields to select
 * @returns {Query} Query with field selection applied
 */
const applyFieldSelection = (query, fields) => {
    if (!fields) {
        return query;
    }

    if (Array.isArray(fields)) {
        return query.select(fields.join(' '));
    }

    return query.select(fields);
};

/**
 * Optimize query with common best practices
 * 
 * @param {Query} query - Mongoose query object
 * @param {Object} options - Optimization options
 * @param {boolean} options.lean - Apply lean() (default: true)
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @param {string} options.sortBy - Field to sort by
 * @param {string} options.order - Sort order
 * @param {string|Array} options.select - Fields to select
 * @returns {Query} Optimized query
 */
const optimizeQuery = (query, options = {}) => {
    const {
        lean = true,
        page,
        limit = 20,
        sortBy = 'createdAt',
        order = 'desc',
        select,
    } = options;

    // Apply lean for read-only operations
    if (lean) {
        query = applyLean(query);
    }

    // Apply field selection if specified
    if (select) {
        query = applyFieldSelection(query, select);
    }

    // Apply sorting
    query = applySorting(query, sortBy, order);

    // Apply pagination if page is specified
    if (page) {
        query = applyPagination(query, page, limit);
    }

    return query;
};

/**
 * Get paginated results with metadata
 * 
 * @param {Model} model - Mongoose model
 * @param {Object} filter - Query filter
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Paginated results with metadata
 */
const getPaginatedResults = async (model, filter = {}, options = {}) => {
    const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        order = 'desc',
        select,
        lean = true,
    } = options;

    // Count total documents
    const total = await model.countDocuments(filter);

    // Build optimized query
    let query = model.find(filter);
    query = optimizeQuery(query, { lean, page, limit, sortBy, order, select });

    // Execute query
    const data = await query;

    // Calculate metadata
    const totalPages = Math.ceil(total / limit);

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
    };
};

/**
 * Common index recommendations for models
 * Add these to your schema definitions
 */
const RECOMMENDED_INDEXES = {
    // User model
    user: [
        { email: 1 }, // Unique index
        { username: 1 }, // Unique index
        { role: 1 },
        { createdAt: -1 },
        { 'email': 1, 'isEmailVerified': 1 }, // Compound index
    ],

    // Product model
    product: [
        { slug: 1 }, // Unique index
        { category: 1 },
        { price: 1 },
        { createdAt: -1 },
        { 'category': 1, 'price': 1 }, // Compound index for filtering
        { name: 'text', description: 'text' }, // Text index for search
    ],

    // Order model
    order: [
        { userId: 1 },
        { status: 1 },
        { createdAt: -1 },
        { orderNumber: 1 }, // Unique index
        { 'userId': 1, 'status': 1 }, // Compound index
    ],

    // Session/Token model
    session: [
        { token: 1 }, // Unique index
        { userId: 1 },
        { expiresAt: 1 }, // For TTL index
    ],
};

module.exports = {
    applyLean,
    applyPagination,
    applySorting,
    applyFieldSelection,
    optimizeQuery,
    getPaginatedResults,
    RECOMMENDED_INDEXES,
};
