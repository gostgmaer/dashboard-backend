const express = require('express');
const router = express.Router();
const {
  addAttribute,
  addAllAttributes,
  getAllAttributes,
  getShowingAttributes,
  getAttributeById,
  updateAttributes,
  updateStatus,
  deleteAttribute,
  getShowingAttributesTest,
  updateChildStatus,
  deleteChildAttribute,
  addChildAttributes,
  updateChildAttributes,
  getChildAttributeById,
  updateManyAttribute,
  deleteManyAttribute,
  updateManyChildAttribute,
  deleteManyChildAttribute,
} = require('../controller/attributes/attributeController');
const { body, query, param, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const  authorize  = require('../middleware/authorize'); // Assumed exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED ATTRIBUTE ROUTES
 * 
 * Features:
 * ✅ Comprehensive CRUD operations for attributes and child attributes
 * ✅ Bulk operations for adding, updating, and deleting attributes
 * ✅ Management of attribute visibility (show/hide)
 * ✅ Hierarchical attribute structure with child attributes
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
 * Middleware to check instance-level access for attribute-specific routes
 * Ensures the user has permission to access/modify the specific attribute
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const attributeId = req.params.id || req.params.attributeId || req.params.ids;
    if (attributeId && !req.user.isSuperadmin) { // Superadmin bypass in authorize
      const Attribute = require('../models/Attribute'); // Assumed Attribute model
      const attribute = await Attribute.findById(attributeId);
      if (!attribute) {
        return res.status(404).json({ success: false, message: 'Attribute not found' });
      }
      if (attribute.userId.toString() !== req.user.id) { // Restrict to own attributes
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s attribute' });
      }
    }
    const childId = req.params.childId;
    if (childId && !req.user.isSuperadmin) {
      const Attribute = require('../models/Attribute');
      const attribute = await Attribute.findOne({ 'children._id': childId });
      if (!attribute) {
        return res.status(404).json({ success: false, message: 'Child attribute not found' });
      }
      if (attribute.userId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s child attribute' });
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

const attributeValidation = {
  addAttribute: [
    body('name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters').trim().escape(),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters').trim().escape(),
    body('isVisible').optional().isBoolean().withMessage('isVisible must be a boolean'),
    body('values').optional().isArray().withMessage('Values must be an array'),
    body('values.*').optional().isString().withMessage('Each value must be a string').isLength({ max: 100 }).withMessage('Each value cannot exceed 100 characters').trim().escape(),
    body('userId').isMongoId().withMessage('Valid user ID is required'),
    validate
  ],

  addAllAttributes: [
    body('attributes').isArray({ min: 1 }).withMessage('Attributes array is required'),
    body('attributes.*.name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters').trim().escape(),
    body('attributes.*.description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters').trim().escape(),
    body('attributes.*.isVisible').optional().isBoolean().withMessage('isVisible must be a boolean'),
    body('attributes.*.values').optional().isArray().withMessage('Values must be an array'),
    body('attributes.*.values.*').optional().isString().withMessage('Each value must be a string').isLength({ max: 100 }).withMessage('Each value cannot exceed 100 characters').trim().escape(),
    body('attributes.*.userId').isMongoId().withMessage('Valid user ID is required'),
    validate
  ],

  addChildAttributes: [
    param('id').isMongoId().withMessage('Invalid attribute ID'),
    body('children').isArray({ min: 1 }).withMessage('Children array is required'),
    body('children.*.name').isString().withMessage('Child name must be a string').isLength({ min: 1, max: 100 }).withMessage('Child name must be between 1 and 100 characters').trim().escape(),
    body('children.*.description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters').trim().escape(),
    body('children.*.isVisible').optional().isBoolean().withMessage('isVisible must be a boolean'),
    validate
  ],

  updateAttributes: [
    param('id').isMongoId().withMessage('Invalid attribute ID'),
    body('name').optional().isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters').trim().escape(),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters').trim().escape(),
    body('isVisible').optional().isBoolean().withMessage('isVisible must be a boolean'),
    body('values').optional().isArray().withMessage('Values must be an array'),
    body('values.*').optional().isString().withMessage('Each value must be a string').isLength({ max: 100 }).withMessage('Each value cannot exceed 100 characters').trim().escape(),
    validate
  ],

  updateChildAttributes: [
    param('attributeId').isMongoId().withMessage('Invalid attribute ID'),
    param('childId').isMongoId().withMessage('Invalid child attribute ID'),
    body('name').optional().isString().withMessage('Child name must be a string').isLength({ min: 1, max: 100 }).withMessage('Child name must be between 1 and 100 characters').trim().escape(),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters').trim().escape(),
    body('isVisible').optional().isBoolean().withMessage('isVisible must be a boolean'),
    validate
  ],

  updateStatus: [
    param('id').isMongoId().withMessage('Invalid attribute ID'),
    body('isVisible').isBoolean().withMessage('isVisible must be a boolean'),
    validate
  ],

  updateChildStatus: [
    param('id').isMongoId().withMessage('Invalid child attribute ID'),
    body('isVisible').isBoolean().withMessage('isVisible must be a boolean'),
    validate
  ],

  updateManyAttribute: [
    body('attributeIds').isArray({ min: 1 }).withMessage('Attribute IDs array is required'),
    body('attributeIds.*').isMongoId().withMessage('Invalid attribute ID in array'),
    body('updates').isObject().withMessage('Updates must be an object'),
    body('updates.name').optional().isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters').trim().escape(),
    body('updates.description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters').trim().escape(),
    body('updates.isVisible').optional().isBoolean().withMessage('isVisible must be a boolean'),
    validate
  ],

  updateManyChildAttribute: [
    body('attributeId').isMongoId().withMessage('Invalid attribute ID'),
    body('childIds').isArray({ min: 1 }).withMessage('Child IDs array is required'),
    body('childIds.*').isMongoId().withMessage('Invalid child attribute ID in array'),
    body('updates').isObject().withMessage('Updates must be an object'),
    body('updates.name').optional().isString().withMessage('Child name must be a string').isLength({ min: 1, max: 100 }).withMessage('Child name must be between 1 and 100 characters').trim().escape(),
    body('updates.description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters').trim().escape(),
    body('updates.isVisible').optional().isBoolean().withMessage('isVisible must be a boolean'),
    validate
  ],

  deleteManyAttribute: [
    body('attributeIds').isArray({ min: 1 }).withMessage('Attribute IDs array is required'),
    body('attributeIds.*').isMongoId().withMessage('Invalid attribute ID in array'),
    validate
  ],

  deleteManyChildAttribute: [
    body('attributeId').isMongoId().withMessage('Invalid attribute ID'),
    body('childIds').isArray({ min: 1 }).withMessage('Child IDs array is required'),
    body('childIds.*').isMongoId().withMessage('Invalid child attribute ID in array'),
    validate
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'name']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    validate
  ],

  getById: [
    param('id').isMongoId().withMessage('Invalid attribute ID'),
    validate
  ],

  getChildById: [
    param('id').isMongoId().withMessage('Invalid attribute ID'),
    param('ids').isMongoId().withMessage('Invalid child attribute ID'),
    validate
  ],

  deleteAttribute: [
    param('id').isMongoId().withMessage('Invalid attribute ID'),
    validate
  ],

  deleteChildAttribute: [
    param('attributeId').isMongoId().withMessage('Invalid attribute ID'),
    param('childId').isMongoId().withMessage('Invalid child attribute ID'),
    validate
  ]
};

// ========================================
// 📋 ATTRIBUTE CRUD OPERATIONS
// ========================================

// POST /api/attributes - Add a new attribute
router.post('/',
  authMiddleware,
  authorize('attributes', 'write'),
  attributeValidation.addAttribute,
  addAttribute
);

// POST /api/attributes/bulk - Add multiple attributes
router.post('/bulk',
  authMiddleware,
  authorize('attributes', 'write'),
  bulkOperationLimiter,
  attributeValidation.addAllAttributes,
  addAllAttributes
);

// GET /api/attributes - Get all attributes
router.get('/',
  authMiddleware,
  authorize('attributes', 'read'),
  attributeValidation.query,
  getAllAttributes
);

// GET /api/attributes/visible - Get visible attributes
router.get('/visible',
  authMiddleware,
  authorize('attributes', 'read'),
  attributeValidation.query,
  getShowingAttributes
);

// GET /api/attributes/:id - Get attribute by ID
router.get('/:id',
  authMiddleware,
  authorize('attributes', 'read'),
  instanceCheckMiddleware,
  attributeValidation.getById,
  getAttributeById
);

// PUT /api/attributes/:id - Update attribute
router.put('/:id',
  authMiddleware,
  authorize('attributes', 'update'),
  instanceCheckMiddleware,
  attributeValidation.updateAttributes,
  updateAttributes
);

// DELETE /api/attributes/:id - Delete attribute
router.delete('/:id',
  authMiddleware,
  authorize('attributes', 'update'),
  instanceCheckMiddleware,
  attributeValidation.deleteAttribute,
  deleteAttribute
);

// ========================================
// 👶 CHILD ATTRIBUTE OPERATIONS
// ========================================

// POST /api/attributes/:id/children - Add child attributes
router.post('/:id/children',
  authMiddleware,
  authorize('attributes', 'write'),
  instanceCheckMiddleware,
  attributeValidation.addChildAttributes,
  addChildAttributes
);

// GET /api/attributes/:id/children/:ids - Get child attribute by ID
router.get('/:id/children/:ids',
  authMiddleware,
  authorize('attributes', 'read'),
  instanceCheckMiddleware,
  attributeValidation.getChildById,
  getChildAttributeById
);

// PUT /api/attributes/:attributeId/children/:childId - Update child attribute
router.put('/:attributeId/children/:childId',
  authMiddleware,
  authorize('attributes', 'update'),
  instanceCheckMiddleware,
  attributeValidation.updateChildAttributes,
  updateChildAttributes
);

// PATCH /api/attributes/:attributeId/children/:childId - Delete child attribute
router.patch('/:attributeId/children/:childId',
  authMiddleware,
  authorize('attributes', 'update'),
  instanceCheckMiddleware,
  attributeValidation.deleteChildAttribute,
  deleteChildAttribute
);

// ========================================
// 🔧 STATUS MANAGEMENT
// ========================================

// PATCH /api/attributes/:id/status - Update attribute visibility
router.patch('/:id/status',
  authMiddleware,
  authorize('attributes', 'update'),
  instanceCheckMiddleware,
  attributeValidation.updateStatus,
  updateStatus
);

// PATCH /api/attributes/children/:id/status - Update child attribute visibility
router.patch('/children/:id/status',
  authMiddleware,
  authorize('attributes', 'update'),
  instanceCheckMiddleware,
  attributeValidation.updateChildStatus,
  updateChildStatus
);

// ========================================
// 📦 BULK OPERATIONS
// ========================================

// PATCH /api/attributes/bulk/update - Update multiple attributes
router.patch('/bulk/update',
  authMiddleware,
  authorize('attributes', 'update'),
  bulkOperationLimiter,
  attributeValidation.updateManyAttribute,
  updateManyAttribute
);

// PATCH /api/attributes/bulk/children/update - Update multiple child attributes
router.patch('/bulk/children/update',
  authMiddleware,
  authorize('attributes', 'update'),
  bulkOperationLimiter,
  attributeValidation.updateManyChildAttribute,
  updateManyChildAttribute
);

// PATCH /api/attributes/bulk/delete - Delete multiple attributes
router.patch('/bulk/delete',
  authMiddleware,
  authorize('attributes', 'update'),
  bulkOperationLimiter,
  attributeValidation.deleteManyAttribute,
  deleteManyAttribute
);

// PATCH /api/attributes/bulk/children/delete - Delete multiple child attributes
router.patch('/bulk/children/delete',
  authMiddleware,
  authorize('attributes', 'update'),
  bulkOperationLimiter,
  attributeValidation.deleteManyChildAttribute,
  deleteManyChildAttribute
);

// ========================================
// 🧪 TEST ENDPOINTS
// ========================================

// GET /api/attributes/visible/test - Test visible attributes (likely for debugging)
router.get('/visible/test',
  authMiddleware,
  authorize('attributes', 'view'),
  attributeValidation.query,
  getShowingAttributesTest
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  const path = req.path.toLowerCase(); // Case-insensitive matching
  if (path.startsWith('/bulk') ||
      path.startsWith('/visible') ||
      path.startsWith('/children') ||
      path === '/docs/routes') {
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
  authorize('attributes', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      attributeCrud: [
        'POST   /api/attributes                          - Add a new attribute (write)',
        'POST   /api/attributes/bulk                     - Add multiple attributes (write, rate-limited)',
        'GET    /api/attributes                          - Get all attributes (read)',
        'GET    /api/attributes/visible                  - Get visible attributes (read)',
        'GET    /api/attributes/:id                      - Get attribute by ID (read, instance check)',
        'PUT    /api/attributes/:id                      - Update attribute (update, instance check)',
        'DELETE /api/attributes/:id                      - Delete attribute (update, instance check)'
      ],
      childAttributeOperations: [
        'POST   /api/attributes/:id/children             - Add child attributes (write, instance check)',
        'GET    /api/attributes/:id/children/:ids        - Get child attribute by ID (read, instance check)',
        'PUT    /api/attributes/:attributeId/children/:childId - Update child attribute (update, instance check)',
        'PATCH  /api/attributes/:attributeId/children/:childId - Delete child attribute (update, instance check)'
      ],
      statusManagement: [
        'PATCH  /api/attributes/:id/status               - Update attribute visibility (update, instance check)',
        'PATCH  /api/attributes/children/:id/status      - Update child attribute visibility (update, instance check)'
      ],
      bulkOperations: [
        'PATCH  /api/attributes/bulk/update              - Update multiple attributes (update, rate-limited)',
        'PATCH  /api/attributes/bulk/children/update     - Update multiple child attributes (update, rate-limited)',
        'PATCH  /api/attributes/bulk/delete              - Delete multiple attributes (update, rate-limited)',
        'PATCH  /api/attributes/bulk/children/delete     - Delete multiple child attributes (update, rate-limited)'
      ],
      testEndpoints: [
        'GET    /api/attributes/visible/test             - Test visible attributes (view)'
      ],
      documentation: [
        'GET    /api/attributes/docs/routes              - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Attribute API routes documentation'
    });
  }
);

module.exports = { attributeRouter: router };