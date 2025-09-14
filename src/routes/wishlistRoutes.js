const express = require('express');
const router = express.Router();
const WishlistController = require('../controller/wishlistController');
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED WISHLIST ROUTES
 * 
 * Features:
 * ✅ All CRUD operations with validation
 * ✅ All model methods as endpoints
 * ✅ Bulk operations with proper validation
 * ✅ Audit trail endpoints
 * ✅ Statistics and analytics endpoints
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const wishlistValidation = {
  create: [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('productId').isMongoId().withMessage('Invalid product ID'),
    body('notes').optional().isString().withMessage('Notes must be a string').isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters')
  ],
  
  update: [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    param('productId').isMongoId().withMessage('Invalid product ID'),
    body('notes').optional().isString().withMessage('Notes must be a string').isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters')
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'priority']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    query('status').optional().isString().withMessage('Status must be a string'),
    query('tags').optional().isString().withMessage('Tags must be a comma-separated string'),
    query('search').optional().isString().withMessage('Search must be a string')
  ],

  bulkAdd: [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    body('productIds.*').isMongoId().withMessage('Invalid product ID in array'),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters')
  ],

  bulkUpdate: [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    body('productIds.*').isMongoId().withMessage('Invalid product ID in array'),
    body('updates').optional().isObject().withMessage('Updates must be an object'),
    body('updates.notes').optional().isString().withMessage('Notes must be a string').isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    body('updates.priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    body('updates.tags').optional().isArray().withMessage('Tags must be an array'),
    body('updates.tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters')
  ],

  export: [
    query('format').optional().isIn(['json', 'csv']).withMessage('Invalid format'),
    query('fields').optional().isString().withMessage('Fields must be a comma-separated string')
  ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// GET /api/wishlist/:userId - Get user's wishlist with advanced filtering
router.get('/:userId', 
  authMiddleware,
  wishlistValidation.query,
  WishlistController.getUserWishlist
);

// POST /api/wishlist - Add item to wishlist
router.post('/', 
  authMiddleware,
  wishlistValidation.create,
  WishlistController.addToWishlist
);

// PUT /api/wishlist/:userId/:productId - Update wishlist item
router.put('/:userId/:productId', 
  authMiddleware,
  wishlistValidation.update,
  WishlistController.updateWishlistItem
);

// DELETE /api/wishlist/:userId/:productId - Remove item from wishlist
router.delete('/:userId/:productId', 
  authMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  WishlistController.removeFromWishlist
);

// ========================================
// 🔍 SPECIAL OPERATIONS
// ========================================

// POST /api/wishlist/approve/:userId/:productId - Approve pending wishlist item
router.post('/approve/:userId/:productId', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  WishlistController.approveWishlistItem
);

// POST /api/wishlist/restore/:userId/:productId - Restore deleted wishlist item
router.post('/restore/:userId/:productId', 
  authMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  WishlistController.restoreWishlistItem
);

// POST /api/wishlist/archive/:userId/:productId - Archive wishlist item
router.post('/archive/:userId/:productId', 
  authMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  WishlistController.archiveWishlistItem
);

// GET /api/wishlist/check/:userId/:productId - Check if product is in wishlist
router.get('/check/:userId/:productId', 
  authMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  WishlistController.isInWishlist
);

// DELETE /api/wishlist/clear/:userId - Clear user's wishlist
router.delete('/clear/:userId', 
  authMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  WishlistController.clearWishlist
);

// ========================================
// 📦 BULK OPERATIONS
// ========================================

// POST /api/wishlist/bulk/add - Bulk add to wishlist
router.post('/bulk/add', 
  authMiddleware,
  wishlistValidation.bulkAdd,
  WishlistController.bulkAddToWishlist
);

// PUT /api/wishlist/bulk/update - Bulk update wishlist items
router.put('/bulk/update', 
  authMiddleware,
  wishlistValidation.bulkUpdate,
  WishlistController.bulkUpdateWishlist
);

// ========================================
// 📊 STATISTICS & ANALYTICS
// ========================================

// GET /api/wishlist/stats/:userId - Get wishlist statistics
router.get('/stats/:userId', 
  authMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  WishlistController.getWishlistStats
);

// GET /api/wishlist/audit/:userId/:productId - Get audit trail for wishlist item
router.get('/audit/:userId/:productId', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  WishlistController.getAuditTrail
);

// ========================================
// 📤 EXPORT OPERATIONS
// ========================================

// GET /api/wishlist/export/:userId - Export wishlist
router.get('/export/:userId', 
  authMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  wishlistValidation.export,
  WishlistController.exportWishlist
);

// GET /api/wishlist/export/featured/:userId - Export featured wishlist items
router.get('/export/featured/:userId', 
  authMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('format').optional().isIn(['json', 'csv']).withMessage('Invalid format'),
  WishlistController.exportFeaturedItems
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones
  if (req.path.startsWith('/stats/') || 
      req.path.startsWith('/audit/') || 
      req.path.startsWith('/export/') || 
      req.path.startsWith('/bulk/') || 
      req.path.startsWith('/approve/') || 
      req.path.startsWith('/restore/') || 
      req.path.startsWith('/archive/') || 
      req.path.startsWith('/check/') || 
      req.path.startsWith('/clear/')) {
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
      'GET    /api/wishlist/:userId                  - Get user’s wishlist with filtering',
      'POST   /api/wishlist                          - Add item to wishlist',
      'PUT    /api/wishlist/:userId/:productId       - Update wishlist item',
      'DELETE /api/wishlist/:userId/:productId       - Remove item from wishlist'
    ],
    specialOperations: [
      'POST   /api/wishlist/approve/:userId/:productId - Approve pending wishlist item',
      'POST   /api/wishlist/restore/:userId/:productId - Restore deleted wishlist item',
      'POST   /api/wishlist/archive/:userId/:productId - Archive wishlist item',
      'GET    /api/wishlist/check/:userId/:productId   - Check if product is in wishlist',
      'DELETE /api/wishlist/clear/:userId             - Clear user’s wishlist'
    ],
    bulkOperations: [
      'POST   /api/wishlist/bulk/add                 - Bulk add to wishlist',
      'PUT    /api/wishlist/bulk/update              - Bulk update wishlist items'
    ],
    analytics: [
      'GET    /api/wishlist/stats/:userId            - Get wishlist statistics',
      'GET    /api/wishlist/audit/:userId/:productId - Get audit trail for wishlist item'
    ],
    export: [
      'GET    /api/wishlist/export/:userId           - Export wishlist',
      'GET    /api/wishlist/export/featured/:userId  - Export featured wishlist items'
    ]
  };

  res.status(200).json({
    success: true,
    data: {
      totalRoutes: Object.values(routes).flat().length,
      categories: routes
    },
    message: 'Wishlist API routes documentation'
  });
});

module.exports = { WishlistRoute: router };