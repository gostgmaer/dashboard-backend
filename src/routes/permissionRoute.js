const express = require('express');
const router = express.Router();
const permissionController = require('../controller/permission');
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { enviroment } = require('../config/setting');
const authorize = require('../middleware/authorize');

/**
 * 🚀 CONSOLIDATED PERMISSION ROUTES
 * 
 * Features:
 * ✅ Comprehensive CRUD operations for permissions
 * ✅ Bulk operations for creation, enabling, disabling, and deletion
 * ✅ Search and filtering by name, category, and status
 * ✅ Permission management (enable, disable, rename, categorize)
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const permissionValidation = {
  create: [
    body('name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('category').optional().isString().withMessage('Category must be a string').isLength({ max: 50 }).withMessage('Category cannot exceed 50 characters'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid permission ID'),
    body('name').optional().isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('category').optional().isString().withMessage('Category must be a string').isLength({ max: 50 }).withMessage('Category cannot exceed 50 characters'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'name']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('category').optional().isString().withMessage('Category must be a string').isLength({ max: 50 }).withMessage('Category cannot exceed 50 characters')
  ],

  search: [
    query('keyword').isString().withMessage('Keyword must be a string').isLength({ min: 1, max: 100 }).withMessage('Keyword must be between 1 and 100 characters'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],

  bulk: [
    body('permissionIds').isArray({ min: 1 }).withMessage('Permission IDs array is required'),
    body('permissionIds.*').isMongoId().withMessage('Invalid permission ID in array')
  ],

  bulkCreate: [
    body('permissions').isArray({ min: 1 }).withMessage('Permissions array is required'),
    body('permissions.*.name').isString().withMessage('Permission name must be a string').isLength({ min: 1, max: 100 }).withMessage('Permission name must be between 1 and 100 characters'),
    body('permissions.*.description').optional().isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
    body('permissions.*.category').optional().isString().withMessage('Category must be a string').isLength({ max: 50 }).withMessage('Category cannot exceed 50 characters'),
    body('permissions.*.isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],

  category: [
    param('category').isString().withMessage('Category must be a string').isLength({ max: 50 }).withMessage('Category cannot exceed 50 characters')
  ],

  rename: [
    param('id').isMongoId().withMessage('Invalid permission ID'),
    body('name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters')
  ],

  description: [
    param('id').isMongoId().withMessage('Invalid permission ID'),
    body('description').isString().withMessage('Description must be a string').isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters')
  ],

  changeCategory: [
    param('id').isMongoId().withMessage('Invalid permission ID'),
    body('category').isString().withMessage('Category must be a string').isLength({ max: 50 }).withMessage('Category cannot exceed 50 characters')
  ]
};

// ========================================
// 📋 CORE CRUD OPERATIONS
// ========================================

// POST /api/permission - Create a new permission
router.post('/',
  authMiddleware,
  authorize('permission', 'write'),
  permissionValidation.create,
  permissionController.createPermission
);

// GET /api/permission - Get all permissions (with optional filters)
router.get('/',
  authMiddleware,
  authorize('permission', 'read'),
  permissionValidation.query,
  permissionController.getAllPermissions
);

router.get('/states',
  authMiddleware,
  authorize('permission', 'read'),
  permissionValidation.query,
  permissionController.getGroupedPermissions
);
// GET /api/permission/:id - Get a single permission by ID
router.get('/:id',
  authMiddleware,
  authorize('permission', 'read'),
  param('id').isMongoId().withMessage('Invalid permission ID'),
  permissionController.getSinglePermission
);

// PUT /api/permission/:id - Update a permission by ID
router.put('/:id',
  authMiddleware,
  authorize('permission', 'update'),
  permissionValidation.update,
  permissionController.updatePermission
);
// PATCH /api/permission/:id - Update a permission by ID
router.patch('/:id',
  authMiddleware,
  authorize('permission', 'update'),
  permissionValidation.update,
  permissionController.updatePermission
);

// DELETE /api/permission/:id - Soft-delete (deactivate) a permission by ID
router.delete('/:id',
  authMiddleware,
  authorize('permission', 'delete'),
  param('id').isMongoId().withMessage('Invalid permission ID'),
  permissionController.deletePermission
);

// ========================================
// 🔍 SEARCH & FILTER OPERATIONS
// ========================================

// GET /api/permission/active - Get all active permissions
router.get('/active',
  authMiddleware,
  authorize('permission', 'read'),
  permissionValidation.query,
  permissionController.getActivePermissions
);

// GET /api/permission/inactive - Get inactive permissions
router.get('/inactive',
  authMiddleware,
  authorize('permission', 'read'),
  permissionValidation.query,
  permissionController.getInactivePermissions
);

// GET /api/permission/search/name - Search permissions by name
router.get('/search/name',
  authMiddleware,
  authorize('permission', 'read'),
  permissionValidation.search,
  permissionController.searchPermissionsByName
);

// GET /api/permission/search - Search permissions by name or description
router.get('/search',
  authMiddleware,
  authorize('permission', 'read'),
  permissionValidation.search,
  permissionController.searchPermissions
);

// GET /api/permission/category/:category - Get permissions by category
router.get('/category/:category',
  authMiddleware,
  authorize('permission', 'read'),
  permissionValidation.category,
  permissionValidation.query,
  permissionController.getPermissionsByCategory
);

// GET /api/permission/grouped - Get permissions grouped by category
router.get('/grouped',
  authMiddleware,
  authorize('permission', 'report'),
  permissionValidation.query,
  permissionController.getPermissionsGrouped
);

// ========================================
// 📦 BULK OPERATIONS
// ========================================

// POST /api/permission/bulk - Bulk create permissions
router.post('/bulk',
  authMiddleware,
  authorize('permission', 'write'),
  permissionValidation.bulkCreate,
  permissionController.bulkCreatePermissions
);

// PATCH /api/permission/bulk-enable - Bulk enable permissions
router.patch('/bulk-enable',
  authMiddleware,
  authorize('permission', 'update'),
  permissionValidation.bulk,
  permissionController.bulkEnablePermissions
);

// PATCH /api/permission/bulk-disable - Bulk disable permissions
router.patch('/bulk-disable',
  authMiddleware,
  authorize('permission', 'update'),
  permissionValidation.bulk,
  permissionController.bulkDisablePermissions
);

// DELETE /api/permission/bulk - Bulk delete permissions
router.delete('/bulk',
  authMiddleware,
  authorize('permission', 'delete'),
  permissionValidation.bulk,
  permissionController.bulkDeletePermissions
);

// ========================================
// 🛠 PERMISSION MANAGEMENT
// ========================================

// GET /api/permission/exists/:name - Check if a permission exists by name
router.get('/exists/:name',
  authMiddleware,
  authorize('permission', 'report'),
  param('name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
  permissionController.checkPermissionExists
);

// POST /api/permission/create-if-not-exists - Create a permission if it doesn't exist
router.post('/create-if-not-exists',
  authMiddleware,
  authorize('permission', 'write'),
  permissionValidation.create,
  permissionController.createIfNotExists
);

// PATCH /api/permission/:id/disable - Disable a permission
router.patch('/:id/disable',
  authMiddleware,
  authorize('permission', 'update'),
  param('id').isMongoId().withMessage('Invalid permission ID'),
  permissionController.disablePermission
);

// PATCH /api/permission/:id/enable - Enable a permission
router.patch('/:id/enable',
  authMiddleware,
  authorize('permission', 'update'),
  param('id').isMongoId().withMessage('Invalid permission ID'),
  permissionController.enablePermission
);

// PATCH /api/permission/:id/rename - Rename a permission
router.patch('/:id/rename',
  authMiddleware,
  authorize('permission', 'update'),
  permissionValidation.rename,
  permissionController.renamePermission
);

// PATCH /api/permission/:id/description - Update permission description
router.patch('/:id/description',
  authMiddleware,
  authorize('permission', 'update'),
  permissionValidation.description,
  permissionController.updatePermissionDescription
);

// PATCH /api/permission/:id/category - Change permission category
router.patch('/:id/category',
  authMiddleware,
  authorize('permission', 'update'),
  permissionValidation.changeCategory,
  permissionController.changePermissionCategory
);

// PATCH /api/permission/:id/toggle-active - Toggle active/inactive status of a permission
router.patch('/:id/toggle-active',
  authMiddleware,
  authorize('permission', 'update'),
  param('id').isMongoId().withMessage('Invalid permission ID'),
  permissionController.togglePermissionActive
);

// GET /api/permission/:id/api-response - Get formatted API response for a permission
router.get('/:id/api-response',
  authMiddleware,
  authorize('permission', 'update'),
  param('id').isMongoId().withMessage('Invalid permission ID'),
  permissionController.getPermissionAPIResponse
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones
  if (req.path.startsWith('/active') ||
    req.path.startsWith('/inactive') ||
    req.path.startsWith('/search') ||
    req.path.startsWith('/category/') ||
    req.path.startsWith('/grouped') ||
    req.path.startsWith('/bulk') ||
    req.path.startsWith('/exists/') ||
    req.path.startsWith('/create-if-not-exists')) {
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
      'POST   /api/permission                          - Create a new permission',
      'GET    /api/permission                          - Get all permissions (with optional filters)',
      'GET    /api/permission/:id                      - Get a single permission by ID',
      'PUT    /api/permission/:id                      - Update a permission by ID',
      'DELETE /api/permission/:id                      - Soft-delete (deactivate) a permission by ID'
    ],
    searchFilter: [
      'GET    /api/permission/active                   - Get all active permissions',
      'GET    /api/permission/inactive                 - Get inactive permissions',
      'GET    /api/permission/search/name              - Search permissions by name',
      'GET    /api/permission/search                   - Search permissions by name or description',
      'GET    /api/permission/category/:category       - Get permissions by category',
      'GET    /api/permission/grouped                  - Get permissions grouped by category'
    ],
    bulkOperations: [
      'POST   /api/permission/bulk                     - Bulk create permissions',
      'PATCH  /api/permission/bulk-enable              - Bulk enable permissions',
      'PATCH  /api/permission/bulk-disable             - Bulk disable permissions',
      'DELETE /api/permission/bulk                     - Bulk delete permissions'
    ],
    permissionManagement: [
      'GET    /api/permission/exists/:name             - Check if a permission exists by name',
      'POST   /api/permission/create-if-not-exists     - Create a permission if it doesn’t exist',
      'PATCH  /api/permission/:id/disable              - Disable a permission',
      'PATCH  /api/permission/:id/enable               - Enable a permission',
      'PATCH  /api/permission/:id/rename               - Rename a permission',
      'PATCH  /api/permission/:id/description          - Update permission description',
      'PATCH  /api/permission/:id/category             - Change permission category',
      'PATCH  /api/permission/:id/toggle-active        - Toggle active/inactive status of a permission',
      'GET    /api/permission/:id/api-response         - Get formatted API response for a permission'
    ]
  };

  res.status(200).json({
    success: true,
    data: {
      totalRoutes: Object.values(routes).flat().length,
      categories: routes
    },
    message: 'Permission API routes documentation'
  });
});

module.exports = { permissionRoute: router };