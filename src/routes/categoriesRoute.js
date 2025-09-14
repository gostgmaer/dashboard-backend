const express = require('express');
const router = express.Router();
const categoryController = require('../controller/categories/categories');
const { body, query, param, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const  authorize  = require('../middleware/authorize'); // Assuming authorize is exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED CATEGORY ROUTES
 * 
 * Features:
 * ✅ Comprehensive CRUD operations for categories
 * ✅ Filtering for active and featured categories
 * ✅ Search and hierarchical tree retrieval
 * ✅ Statistical insights for categories
 * ✅ Bulk status updates
 * ✅ Permission-based access control via authorize middleware
 * ✅ Comprehensive validation schemas with sanitization
 * ✅ Rate limiting for bulk operations
 * ✅ Instance-level checks for IDOR prevention
 * ✅ Performance optimized routes
 */

/**
 * Rate limiter for high-risk bulk operations
 * Limits to 10 requests per 15 minutes per IP
 */
const bulkOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many requests, please try again later' }
});

/**
 * Middleware to check instance-level access for category-specific routes
 * Ensures the user has permission to access/modify the specific category
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const categoryId = req.params.id;
    if (categoryId && !req.user.isSuperadmin) { // Superadmin bypass in authorize
      const Category = require('../models/Category'); // Assumed Category model
      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      if (category.userId.toString() !== req.user.id) { // Restrict to own categories
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s category' });
      }
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during instance check' });
  }
};

/**
 * Middleware to handle validation errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const categoryValidation = {
  create: [
    body('title').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters').trim().escape(),
    body('descriptions').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters').trim().escape(),
    body('parentId').optional().isMongoId().withMessage('Parent ID must be a valid MongoDB ID'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
    body('image').optional().isURL().withMessage('Image must be a valid URL').trim(),
    body('slug').optional().isString().withMessage('Slug must be a string').isLength({ min: 1, max: 100 }).withMessage('Slug must be between 1 and 100 characters').trim().escape(),
    validate
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid category ID'),
    body('name').optional().isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters').trim().escape(),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters').trim().escape(),
    body('parentId').optional().isMongoId().withMessage('Parent ID must be a valid MongoDB ID'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
    body('image').optional().isURL().withMessage('Image must be a valid URL').trim(),
    body('slug').optional().isString().withMessage('Slug must be a string').isLength({ min: 1, max: 100 }).withMessage('Slug must be between 1 and 100 characters').trim().escape(),
    validate
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'name']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('search').optional().isString().withMessage('Search must be a string').isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters').trim().escape(),
    validate
  ],

  bulkStatus: [
    body('categoryIds').isArray({ min: 1 }).withMessage('Category IDs array is required'),
    body('categoryIds.*').isMongoId().withMessage('Invalid category ID in array'),
    body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
  ],

  search: [
    query('keyword').isString().withMessage('Keyword must be a string').isLength({ min: 1, max: 100 }).withMessage('Keyword must be between 1 and 100 characters').trim().escape(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    validate
  ],

  id: [
    param('id').isMongoId().withMessage('Invalid category ID'),
    validate
  ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// POST /api/categories - Create a new category
router.post('/', 
  authMiddleware,
  authorize('categories', 'write'),
  instanceCheckMiddleware,
  categoryValidation.create,
  categoryController.createCategory
);

// GET /api/categories - Get all categories with pagination and filters
router.get('/', 
  authMiddleware,
  authorize('categories', 'read'),
  categoryValidation.query,
  categoryController.getCategories
);

// GET /api/categories/:id - Get a category by ID
router.get('/:id', 
  authMiddleware,
  authorize('categories', 'read'),
  instanceCheckMiddleware,
  categoryValidation.id,
  categoryController.getCategoryById
);

// PUT /api/categories/:id - Update a category
router.put('/:id', 
  authMiddleware,
  authorize('categories', 'update'),
  instanceCheckMiddleware,
  categoryValidation.update,
  categoryController.updateCategory
);

// DELETE /api/categories/:id - Delete a category
router.delete('/:id', 
  authMiddleware,
  authorize('categories', 'update'),
  instanceCheckMiddleware,
  categoryValidation.id,
  categoryController.deleteCategory
);

// ========================================
// 🔍 FILTER & SEARCH OPERATIONS
// ========================================

// GET /api/categories/active - Get all active categories
router.get('/active', 
  authMiddleware,
  authorize('categories', 'read'),
  categoryValidation.query,
  categoryController.getActiveCategories
);

// GET /api/categories/featured - Get featured categories
router.get('/featured', 
  authMiddleware,
  authorize('categories', 'read'),
  categoryValidation.query,
  categoryController.getFeaturedCategories
);

// GET /api/categories/search - Search categories by keyword
router.get('/search', 
  authMiddleware,
  authorize('categories', 'read'),
  categoryValidation.search,
  categoryController.searchCategories
);

// GET /api/categories/tree - Get category tree (hierarchical structure)
router.get('/tree', 
  authMiddleware,
  authorize('categories', 'read'),
  categoryValidation.query,
  categoryController.getCategoryTree
);

// ========================================
// 📊 STATISTICS
// ========================================

// GET /api/categories/stats - Get category statistics
router.get('/stats', 
  authMiddleware,
  authorize('categories', 'report'),
  categoryValidation.query,
  categoryController.getCategoryStatistics
);

// ========================================
// 📦 BULK OPERATIONS
// ========================================

// PATCH /api/categories/bulk-status - Bulk update category status
router.patch('/bulk-status', 
  authMiddleware,
  authorize('categories', 'update'),
  bulkOperationLimiter,
  categoryValidation.bulkStatus,
  categoryController.bulkUpdateStatus
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  const path = req.path.toLowerCase(); // Case-insensitive matching
  if (path.startsWith('/active') || 
      path.startsWith('/featured') || 
      path.startsWith('/search') || 
      path.startsWith('/tree') || 
      path.startsWith('/stats') || 
      path.startsWith('/bulk-status')) {
    return next();
  }

  next();
};

// Apply the middleware to all routes
router.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

router.get('/docs/routes',
  authMiddleware,
  authorize('categories', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      crud: [
        'POST   /api/categories                          - Create a new category (write, instance check)',
        'GET    /api/categories                          - Get all categories with pagination and filters (read)',
        'GET    /api/categories/:id                      - Get a category by ID (read, instance check)',
        'PUT    /api/categories/:id                      - Update a category (update, instance check)',
        'DELETE /api/categories/:id                      - Delete a category (update, instance check)'
      ],
      filterSearch: [
        'GET    /api/categories/active                   - Get all active categories (read)',
        'GET    /api/categories/featured                 - Get featured categories (read)',
        'GET    /api/categories/search                   - Search categories by keyword (read)',
        'GET    /api/categories/tree                     - Get category tree (hierarchical structure) (read)'
      ],
      statistics: [
        'GET    /api/categories/stats                    - Get category statistics (report)'
      ],
      bulkOperations: [
        'PATCH  /api/categories/bulk-status              - Bulk update category status (update, rate-limited)'
      ],
      documentation: [
        'GET    /api/categories/docs/routes              - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Category API routes documentation'
    });
  }
);

module.exports = { categoryRoute: router };