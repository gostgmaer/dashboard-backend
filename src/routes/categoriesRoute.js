const express = require('express');
const router = express.Router();
const categoryController = require('../controller/categories/categories');
const { body, query, param, validationResult } = require('express-validator');
const {authMiddleware} = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');
const Category = require('../models/categories');

const bulkOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many requests, please try again later' }
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const categoryId = req.params.id;
    if (categoryId && !req.user.isSuperadmin) {
    
      const category = await Category.findById(categoryId);
      if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
      if (category.created_by.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s category' });
      }
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during instance check' });
  }
};

// Validation schemas for create, update and others (trimmed for brevity)
const categoryValidation = {
    create: [
    body('title').isString().isLength({ min: 1, max: 100 }).trim().escape(),
    body('descriptions').optional().isString().isLength({ max: 1000 }).trim().escape(),
    body('parent').optional().isMongoId(),
    body('status').optional().isIn(['active', 'inactive', 'draft', 'pending', 'archived', 'published']),
    body('isFeatured').optional().isBoolean(),
    body('slug').optional().isString().isLength({ min: 1, max: 100 }).trim().escape(),
    validate
  ],
  update: [
    param('id').isMongoId(),
    body('title').optional().isString().isLength({ min: 1, max: 100 }).trim().escape(),
    body('descriptions').optional().isString().isLength({ max: 1000 }).trim().escape(),
    body('parent').optional().isMongoId(),
    body('status').optional().isIn(['active', 'inactive', 'draft', 'pending', 'archived', 'published']),
    body('isFeatured').optional().isBoolean(),
    body('slug').optional().isString().isLength({ min: 1, max: 100 }).trim().escape(),
    validate
  ],
  id: [
    param('id').isMongoId(),
    validate
  ],
  query: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('sortBy').optional().isIn(['title', 'createdAt', 'updatedAt']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('search').optional().isString().isLength({ max: 100 }).trim().escape(),
    validate
  ],
  bulkStatus: [
    body('ids').isArray({ min: 1 }),
    body('ids.*').isMongoId(),
    body('status').isIn(['active', 'inactive']),
    validate
  ]
};

// === CRUD Routes ===

router.post('/',
  authMiddleware,

  // categoryValidation.create,
  categoryController.create
);

router.get('/active',
  authMiddleware,

  categoryController.getActiveCategories
);
router.get('/',
  authMiddleware,

  categoryValidation.query,
  categoryController.getAll
);

router.get('/:id',
  authMiddleware,

  instanceCheckMiddleware,
  categoryValidation.id,
  categoryController.getSingle
);

router.put('/:id',
  authMiddleware,

  instanceCheckMiddleware,
  categoryValidation.update,
  categoryController.update
);

router.delete('/:id',
  authMiddleware,

  instanceCheckMiddleware,
  categoryValidation.id,
  categoryController.delete
);

// === Filtering & Search ===



router.get('/featured',
  authMiddleware,

  categoryController.getFeaturedCategories
);

router.get('/search',
  authMiddleware,

  query('keyword').isString().isLength({ min: 1, max: 100 }).trim().escape(),
  validate,
  categoryController.searchCategories
);

router.get('/tree',
  authMiddleware,

  categoryController.getTree
);

// === Statistics ===

router.get('/stats',
  authMiddleware,

  categoryController.getStats
);

router.get('/featured-stats',
  authMiddleware,

  categoryController.featuredStats
);

router.get('/aggregate-status',
  authMiddleware,

  categoryController.aggregateByStatus
);

// === Bulk Operations ===

router.patch('/bulk-status',
  authMiddleware,

  bulkOperationLimiter,
  categoryValidation.bulkStatus,
  categoryController.bulkUpdateStatus
);

router.post('/import-bulk',
  authMiddleware,

  bulkOperationLimiter,
  categoryController.importBulk
);

router.patch('/batch-update-display-orders',
  authMiddleware,

  bulkOperationLimiter,
  categoryController.batchUpdateDisplayOrders
);

router.post('/soft-delete-many',
  authMiddleware,

  bulkOperationLimiter,
  categoryController.softDeleteMany
);

// === Route Documentation Endpoint ===

router.get('/docs/routes',
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      CRUD: [
        'POST /api/categories - Create a category',
        'GET /api/categories - List categories with pagination/filtering',
        'GET /api/categories/:id - Get category by ID',
        'PUT /api/categories/:id - Update category',
        'DELETE /api/categories/:id - Delete category'
      ],
      FilteringSearch: [
        'GET /api/categories/active - List active categories',
        'GET /api/categories/featured - List featured categories',
        'GET /api/categories/search - Search categories',
        'GET /api/categories/tree - Get category tree'
      ],
      Stats: [
        'GET /api/categories/stats - Get category stats',
        'GET /api/categories/featured-stats - Get featured categories stats',
        'GET /api/categories/aggregate-status - Aggregate statuses'
      ],
      Bulk: [
        'PATCH /api/categories/bulk-status - Bulk update status',
        'POST /api/categories/import-bulk - Bulk import',
        'PATCH /api/categories/batch-update-display-orders - Batch update display orders',
        'POST /api/categories/soft-delete-many - Soft delete many categories'
      ]
    };

    res.status(200).json({
      success: true,
      message: 'Category API routes documentation',
      data: {
        totalRoutes: Object.values(routes).flat().length,
        routes
      }
    });
  }
);

module.exports = { categoryRoute: router };
  