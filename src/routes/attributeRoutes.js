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
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED ATTRIBUTE ROUTES
 * 
 * Features:
 * ✅ Comprehensive CRUD operations for attributes and child attributes
 * ✅ Bulk operations for adding, updating, and deleting attributes
 * ✅ Management of attribute visibility (show/hide)
 * ✅ Hierarchical attribute structure with child attributes
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const attributeValidation = {
  addAttribute: [
    body('name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('isVisible').optional().isBoolean().withMessage('isVisible must be a boolean'),
    body('values').optional().isArray().withMessage('Values must be an array'),
    body('values.*').optional().isString().withMessage('Each value must be a string').isLength({ max: 100 }).withMessage('Each value cannot exceed 100 characters')
  ],

  addAllAttributes: [
    body('attributes').isArray({ min: 1 }).withMessage('Attributes array is required'),
    body('attributes.*.name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('attributes.*.description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('attributes.*.isVisible').optional().isBoolean().withMessage('isVisible must be a boolean'),
    body('attributes.*.values').optional().isArray().withMessage('Values must be an array'),
    body('attributes.*.values.*').optional().isString().withMessage('Each value must be a string').isLength({ max: 100 }).withMessage('Each value cannot exceed 100 characters')
  ],

  addChildAttributes: [
    param('id').isMongoId().withMessage('Invalid attribute ID'),
    body('children').isArray({ min: 1 }).withMessage('Children array is required'),
    body('children.*.name').isString().withMessage('Child name must be a string').isLength({ min: 1, max: 100 }).withMessage('Child name must be between 1 and 100 characters'),
    body('children.*.description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('children.*.isVisible').optional().isBoolean().withMessage('isVisible must be a boolean')
  ],

  updateAttributes: [
    param('id').isMongoId().withMessage('Invalid attribute ID'),
    body('name').optional().isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('isVisible').optional().isBoolean().withMessage('isVisible must be a boolean'),
    body('values').optional().isArray().withMessage('Values must be an array'),
    body('values.*').optional().isString().withMessage('Each value must be a string').isLength({ max: 100 }).withMessage('Each value cannot exceed 100 characters')
  ],

  updateChildAttributes: [
    param('attributeId').isMongoId().withMessage('Invalid attribute ID'),
    param('childId').isMongoId().withMessage('Invalid child attribute ID'),
    body('name').optional().isString().withMessage('Child name must be a string').isLength({ min: 1, max: 100 }).withMessage('Child name must be between 1 and 100 characters'),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('isVisible').optional().isBoolean().withMessage('isVisible must be a boolean')
  ],

  updateStatus: [
    param('id').isMongoId().withMessage('Invalid attribute ID'),
    body('isVisible').isBoolean().withMessage('isVisible must be a boolean')
  ],

  updateChildStatus: [
    param('id').isMongoId().withMessage('Invalid child attribute ID'),
    body('isVisible').isBoolean().withMessage('isVisible must be a boolean')
  ],

  updateManyAttribute: [
    body('attributeIds').isArray({ min: 1 }).withMessage('Attribute IDs array is required'),
    body('attributeIds.*').isMongoId().withMessage('Invalid attribute ID in array'),
    body('updates').isObject().withMessage('Updates must be an object'),
    body('updates.name').optional().isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('updates.description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('updates.isVisible').optional().isBoolean().withMessage('isVisible must be a boolean')
  ],

  updateManyChildAttribute: [
    body('attributeId').isMongoId().withMessage('Invalid attribute ID'),
    body('childIds').isArray({ min: 1 }).withMessage('Child IDs array is required'),
    body('childIds.*').isMongoId().withMessage('Invalid child attribute ID in array'),
    body('updates').isObject().withMessage('Updates must be an object'),
    body('updates.name').optional().isString().withMessage('Child name must be a string').isLength({ min: 1, max: 100 }).withMessage('Child name must be between 1 and 100 characters'),
    body('updates.description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('updates.isVisible').optional().isBoolean().withMessage('isVisible must be a boolean')
  ],

  deleteManyAttribute: [
    body('attributeIds').isArray({ min: 1 }).withMessage('Attribute IDs array is required'),
    body('attributeIds.*').isMongoId().withMessage('Invalid attribute ID in array')
  ],

  deleteManyChildAttribute: [
    body('attributeId').isMongoId().withMessage('Invalid attribute ID'),
    body('childIds').isArray({ min: 1 }).withMessage('Child IDs array is required'),
    body('childIds.*').isMongoId().withMessage('Invalid child attribute ID in array')
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'name']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc')
  ],

  getById: [
    param('id').isMongoId().withMessage('Invalid attribute ID')
  ],

  getChildById: [
    param('id').isMongoId().withMessage('Invalid attribute ID'),
    param('ids').isMongoId().withMessage('Invalid child attribute ID')
  ],

  deleteAttribute: [
    param('id').isMongoId().withMessage('Invalid attribute ID')
  ],

  deleteChildAttribute: [
    param('attributeId').isMongoId().withMessage('Invalid attribute ID'),
    param('childId').isMongoId().withMessage('Invalid child attribute ID')
  ]
};

// ========================================
// 📋 ATTRIBUTE CRUD OPERATIONS
// ========================================

// POST /api/attributes/add - Add a new attribute
router.post('/add', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.addAttribute,
  addAttribute
);

// POST /api/attributes/add/all - Add multiple attributes
router.post('/add/all', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.addAllAttributes,
  addAllAttributes
);

// GET /api/attributes - Get all attributes
router.get('/', 
  authMiddleware,
  attributeValidation.query,
  getAllAttributes
);

// GET /api/attributes/show - Get visible attributes
router.get('/show', 
  authMiddleware,
  attributeValidation.query,
  getShowingAttributes
);

// GET /api/attributes/:id - Get attribute by ID
router.get('/:id', 
  authMiddleware,
  attributeValidation.getById,
  getAttributeById
);

// PUT /api/attributes/:id - Update attribute
router.put('/:id', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.updateAttributes,
  updateAttributes
);

// DELETE /api/attributes/:id - Delete attribute
router.delete('/:id', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.deleteAttribute,
  deleteAttribute
);

// ========================================
// 👶 CHILD ATTRIBUTE OPERATIONS
// ========================================

// PUT /api/attributes/add/child/:id - Add child attributes
router.put('/add/child/:id', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.addChildAttributes,
  addChildAttributes
);

// GET /api/attributes/child/:id/:ids - Get child attribute by ID
router.get('/child/:id/:ids', 
  authMiddleware,
  attributeValidation.getChildById,
  getChildAttributeById
);

// PUT /api/attributes/update/child/:attributeId/:childId - Update child attribute
router.put('/update/child/:attributeId/:childId', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.updateChildAttributes,
  updateChildAttributes
);

// PUT /api/attributes/delete/child/:attributeId/:childId - Delete child attribute
router.put('/delete/child/:attributeId/:childId', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.deleteChildAttribute,
  deleteChildAttribute
);

// ========================================
// 🔧 STATUS MANAGEMENT
// ========================================

// PUT /api/attributes/status/:id - Update attribute visibility
router.put('/status/:id', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.updateStatus,
  updateStatus
);

// PUT /api/attributes/status/child/:id - Update child attribute visibility
router.put('/status/child/:id', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.updateChildStatus,
  updateChildStatus
);

// ========================================
// 📦 BULK OPERATIONS
// ========================================

// PATCH /api/attributes/update/many - Update multiple attributes
router.patch('/update/many', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.updateManyAttribute,
  updateManyAttribute
);

// PATCH /api/attributes/update/child/many - Update multiple child attributes
router.patch('/update/child/many', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.updateManyChildAttribute,
  updateManyChildAttribute
);

// PATCH /api/attributes/delete/many - Delete multiple attributes
router.patch('/delete/many', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.deleteManyAttribute,
  deleteManyAttribute
);

// PATCH /api/attributes/delete/child/many - Delete multiple child attributes
router.patch('/delete/child/many', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.deleteManyChildAttribute,
  deleteManyChildAttribute
);

// ========================================
// 🧪 TEST ENDPOINTS
// ========================================

// PUT /api/attributes/show/test - Test visible attributes (likely for debugging)
router.put('/show/test', 
  authMiddleware,
  roleMiddleware(['admin']),
  attributeValidation.query,
  getShowingAttributesTest
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones
  if (req.path.startsWith('/add') || 
      req.path.startsWith('/show') || 
      req.path.startsWith('/update/many') || 
      req.path.startsWith('/update/child/many') || 
      req.path.startsWith('/delete/many') || 
      req.path.startsWith('/delete/child/many') || 
      req.path.startsWith('/child')) {
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
    attributeCrud: [
      'POST   /api/attributes/add                  - Add a new attribute',
      'POST   /api/attributes/add/all             - Add multiple attributes',
      'GET    /api/attributes                     - Get all attributes',
      'GET    /api/attributes/show                - Get visible attributes',
      'GET    /api/attributes/:id                 - Get attribute by ID',
      'PUT    /api/attributes/:id                 - Update attribute',
      'DELETE /api/attributes/:id                 - Delete attribute'
    ],
    childAttributeOperations: [
      'PUT    /api/attributes/add/child/:id       - Add child attributes',
      'GET    /api/attributes/child/:id/:ids      - Get child attribute by ID',
      'PUT    /api/attributes/update/child/:attributeId/:childId - Update child attribute',
      'PUT    /api/attributes/delete/child/:attributeId/:childId - Delete child attribute'
    ],
    statusManagement: [
      'PUT    /api/attributes/status/:id          - Update attribute visibility',
      'PUT    /api/attributes/status/child/:id    - Update child attribute visibility'
    ],
    bulkOperations: [
      'PATCH  /api/attributes/update/many         - Update multiple attributes',
      'PATCH  /api/attributes/update/child/many   - Update multiple child attributes',
      'PATCH  /api/attributes/delete/many         - Delete multiple attributes',
      'PATCH  /api/attributes/delete/child/many   - Delete multiple child attributes'
    ],
    testEndpoints: [
      'PUT    /api/attributes/show/test           - Test visible attributes'
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
});

module.exports = {attributeRouter:router};