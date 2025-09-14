const express = require('express');
const router = express.Router();
const categoryController = require('../controller/categories/categories');
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
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
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const categoryValidation = {
  create: [
    body('name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('parentId').optional().isMongoId().withMessage('Parent ID must be a valid MongoDB ID'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
    body('image').optional().isURL().withMessage('Image must be a valid URL'),
    body('slug').optional().isString().withMessage('Slug must be a string').isLength({ min: 1, max: 100 }).withMessage('Slug must be between 1 and 100 characters')
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid category ID'),
    body('name').optional().isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('parentId').optional().isMongoId().withMessage('Parent ID must be a valid MongoDB ID'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
    body('image').optional().isURL().withMessage('Image must be a valid URL'),
    body('slug').optional().isString().withMessage('Slug must be a string').isLength({ min: 1, max: 100 }).withMessage('Slug must be between 1 and 100 characters')
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'name']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('search').optional().isString().withMessage('Search must be a string').isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters')
  ],

  bulkStatus: [
    body('categoryIds').isArray({ min: 1 }).withMessage('Category IDs array is required'),
    body('categoryIds.*').isMongoId().withMessage('Invalid category ID in array'),
    body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
  ],

  search: [
    query('keyword').isString().withMessage('Keyword must be a string').isLength({ min: 1, max: 100 }).withMessage('Keyword must be between 1 and 100 characters'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// POST /api/categories - Create a new category
router.post('/', 
  authMiddleware,
  roleMiddleware(['admin']),
  categoryValidation.create,
  categoryController.createCategory
);

// GET /api/categories - Get all categories with pagination and filters
router.get('/', 
  authMiddleware,
  categoryValidation.query,
  categoryController.getCategories
);

// GET /api/categories/:id - Get a category by ID
router.get('/:id', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid category ID'),
  categoryController.getCategoryById
);

// PUT /api/categories/:id - Update a category
router.put('/:id', 
  authMiddleware,
  roleMiddleware(['admin']),
  categoryValidation.update,
  categoryController.updateCategory
);

// DELETE /api/categories/:id - Delete a category
router.delete('/:id', 
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid category ID'),
  categoryController.deleteCategory
);

// ========================================
// 🔍 FILTER & SEARCH OPERATIONS
// ========================================

// GET /api/categories/active - Get all active categories
router.get('/active', 
  authMiddleware,
  categoryValidation.query,
  categoryController.getActiveCategories
);

// GET /api/categories/featured - Get featured categories
router.get('/featured', 
  authMiddleware,
  categoryValidation.query,
  categoryController.getFeaturedCategories
);

// GET /api/categories/search - Search categories by keyword
router.get('/search', 
  authMiddleware,
  categoryValidation.search,
  categoryController.searchCategories
);

// GET /api/categories/tree - Get category tree (hierarchical structure)
router.get('/tree', 
  authMiddleware,
  categoryValidation.query,
  categoryController.getCategoryTree
);

// ========================================
// 📊 STATISTICS
// ========================================

// GET /api/categories/stats - Get category statistics
router.get('/stats', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  categoryValidation.query,
  categoryController.getCategoryStatistics
);

// ========================================
// 📦 BULK OPERATIONS
// ========================================

// PATCH /api/categories/bulk-status - Bulk update category status
router.patch('/bulk-status', 
  authMiddleware,
  roleMiddleware(['admin']),
  categoryValidation.bulkStatus,
  categoryController.bulkUpdateStatus
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones
  if (req.path.startsWith('/active') || 
      req.path.startsWith('/featured') || 
      req.path.startsWith('/search') || 
      req.path.startsWith('/tree') || 
      req.path.startsWith('/stats') || 
      req.path.startsWith('/bulk-status')) {
    return next();
  }

  next();
};

// Apply the middleware to all routes
router.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

router.get('/docs/routes', (req, res) => {
  if (enviroment !== 'development') {
    return res.status(404).json({
      success: false,
      message: 'Route documentation only available in development mode'
    });
  }

  const routes = {
    crud: [
      'POST   /api/categories                          - Create a new category',
      'GET    /api/categories                          - Get all categories with pagination and filters',
      'GET    /api/categories/:id                      - Get a category by ID',
      'PUT    /api/categories/:id                      - Update a category',
      'DELETE /api/categories/:id                      - Delete a category'
    ],
    filterSearch: [
      'GET    /api/categories/active                   - Get all active categories',
      'GET    /api/categories/featured                 - Get featured categories',
      'GET    /api/categories/search                   - Search categories by keyword',
      'GET    /api/categories/tree                     - Get category tree (hierarchical structure)'
    ],
    statistics: [
      'GET    /api/categories/stats                    - Get category statistics'
    ],
    bulkOperations: [
      'PATCH  /api/categories/bulk-status              - Bulk update category status'
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
});

module.exports = {categoryRoute:router};