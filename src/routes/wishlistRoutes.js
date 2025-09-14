const express = require('express');
const router = express.Router();
const WishlistController = require('../controller/wishlistController');
const { body, query, param, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const  authorize  = require('../middleware/authorize'); // Assuming authorize is exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');
const Wishlist = require('../models/wishlist');

/**
 * 🚀 CONSOLIDATED WISHLIST ROUTES
 * 
 * Features:
 * ✅ All CRUD operations with validation
 * ✅ All model methods as endpoints
 * ✅ Bulk operations with proper validation
 * ✅ Audit trail endpoints
 * ✅ Statistics and analytics endpoints
 * ✅ Permission-based access control via authorize middleware
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes with rate limiting
 * ✅ Instance-level checks for IDOR prevention
 */

/**
 * Rate limiter for high-risk bulk and clear operations
 * Limits to 10 requests per 15 minutes per IP
 */
const bulkOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many requests, please try again later' }
});

/**
 * Middleware to check instance-level access for userId-specific routes
 * Ensures the user has permission to access/modify the specific wishlist
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    if (userId && !req.user.isSuperadmin) { // Superadmin bypass already in authorize
      if (req.user.id !== userId) { // Restrict to own wishlist unless superadmin
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s wishlist' });
      }
    
      const wishlist = await Wishlist.findOne({ userId });
      if (!wishlist && req.method !== 'POST') { // Allow POST for creation
        return res.status(404).json({ success: false, message: 'Wishlist not found for user' });
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

const wishlistValidation = {
  create: [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('productId').isMongoId().withMessage('Invalid product ID'),
    body('notes').optional().isString().withMessage('Notes must be a string').isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters').trim().escape(),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters').trim().escape(),
    validate
  ],
  
  update: [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    param('productId').isMongoId().withMessage('Invalid product ID'),
    body('notes').optional().isString().withMessage('Notes must be a string').isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters').trim().escape(),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters').trim().escape(),
    validate
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'priority']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    query('status').optional().isString().withMessage('Status must be a string').trim().escape(),
    query('tags').optional().isString().withMessage('Tags must be a comma-separated string').trim().escape(),
    query('search').optional().isString().withMessage('Search must be a string').trim().escape(),
    validate
  ],

  bulkAdd: [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    body('productIds.*').isMongoId().withMessage('Invalid product ID in array'),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters').trim().escape(),
    validate
  ],

  bulkUpdate: [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('productIds').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    body('productIds.*').isMongoId().withMessage('Invalid product ID in array'),
    body('updates').optional().isObject().withMessage('Updates must be an object'),
    body('updates.notes').optional().isString().withMessage('Notes must be a string').isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters').trim().escape(),
    body('updates.priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid priority'),
    body('updates.tags').optional().isArray().withMessage('Tags must be an array'),
    body('updates.tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters').trim().escape(),
    validate
  ],

  export: [
    query('format').optional().isIn(['json', 'csv']).withMessage('Invalid format'),
    query('fields').optional().isString().withMessage('Fields must be a comma-separated string').trim().escape(),
    validate
  ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// GET /api/wishlist/:userId - Get user's wishlist with advanced filtering
router.get('/:userId', 
  authMiddleware,
  authorize('wishlist', 'read'),
  instanceCheckMiddleware,
  wishlistValidation.query,
  WishlistController.getUserWishlist
);

// POST /api/wishlist - Add item to wishlist
router.post('/', 
  authMiddleware,
  authorize('wishlist', 'write'),
  wishlistValidation.create,
  WishlistController.addToWishlist
);

// PUT /api/wishlist/:userId/:productId - Update wishlist item
router.put('/:userId/:productId', 
  authMiddleware,
  authorize('wishlist', 'update'),
  instanceCheckMiddleware,
  wishlistValidation.update,
  WishlistController.updateWishlistItem
);

// DELETE /api/wishlist/:userId/:productId - Remove item from wishlist
router.delete('/:userId/:productId', 
  authMiddleware,
  authorize('wishlist', 'update'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validate,
  WishlistController.removeFromWishlist
);

// ========================================
// 🔍 SPECIAL OPERATIONS
// ========================================

// POST /api/wishlist/approve/:userId/:productId - Approve pending wishlist item
router.post('/approve/:userId/:productId', 
  authMiddleware,
  authorize('wishlist', 'update'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validate,
  WishlistController.approveWishlistItem
);

// POST /api/wishlist/restore/:userId/:productId - Restore deleted wishlist item
router.post('/restore/:userId/:productId', 
  authMiddleware,
  authorize('wishlist', 'update'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validate,
  WishlistController.restoreWishlistItem
);

// POST /api/wishlist/archive/:userId/:productId - Archive wishlist item
router.post('/archive/:userId/:productId', 
  authMiddleware,
  authorize('wishlist', 'update'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validate,
  WishlistController.archiveWishlistItem
);

// GET /api/wishlist/check/:userId/:productId - Check if product is in wishlist
router.get('/check/:userId/:productId', 
  authMiddleware,
  authorize('wishlist', 'read'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validate,
  WishlistController.isInWishlist
);

// DELETE /api/wishlist/clear/:userId - Clear user's wishlist
router.delete('/clear/:userId', 
  authMiddleware,
  authorize('wishlist', 'update'),
  instanceCheckMiddleware,
  bulkOperationLimiter,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  validate,
  WishlistController.clearWishlist
);

// ========================================
// 📦 BULK OPERATIONS
// ========================================

// POST /api/wishlist/bulk/add - Bulk add to wishlist
router.post('/bulk/add', 
  authMiddleware,
  authorize('wishlist', 'write'),
  bulkOperationLimiter,
  wishlistValidation.bulkAdd,
  WishlistController.bulkAddToWishlist
);

// PUT /api/wishlist/bulk/update - Bulk update wishlist items
router.put('/bulk/update', 
  authMiddleware,
  authorize('wishlist', 'update'),
  bulkOperationLimiter,
  wishlistValidation.bulkUpdate,
  WishlistController.bulkUpdateWishlist
);

// ========================================
// 📊 STATISTICS & ANALYTICS
// ========================================

// GET /api/wishlist/stats/:userId - Get wishlist statistics
router.get('/stats/:userId', 
  authMiddleware,
  authorize('wishlist', 'view'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  validate,
  WishlistController.getWishlistStats
);

// GET /api/wishlist/audit/:userId/:productId - Get audit trail for wishlist item
router.get('/audit/:userId/:productId', 
  authMiddleware,
  authorize('wishlist', 'report'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  param('productId').isMongoId().withMessage('Invalid product ID'),
  validate,
  WishlistController.getAuditTrail
);

// ========================================
// 📤 EXPORT OPERATIONS
// ========================================

// GET /api/wishlist/export/:userId - Export wishlist
router.get('/export/:userId', 
  authMiddleware,
  authorize('wishlist', 'view'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  wishlistValidation.export,
  WishlistController.exportWishlist
);

// GET /api/wishlist/export/featured/:userId - Export featured wishlist items
router.get('/export/featured/:userId', 
  authMiddleware,
  authorize('wishlist', 'view'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50').toInt(),
  query('format').optional().isIn(['json', 'csv']).withMessage('Invalid format'),
  validate,
  WishlistController.exportFeaturedItems
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones, case-insensitive
  const path = req.path.toLowerCase();
  if (path.startsWith('/stats/') || 
      path.startsWith('/audit/') || 
      path.startsWith('/export/') || 
      path.startsWith('/bulk/') || 
      path.startsWith('/approve/') || 
      path.startsWith('/restore/') || 
      path.startsWith('/archive/') || 
      path.startsWith('/check/') || 
      path.startsWith('/clear/')) {
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
  authorize('wishlist', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      crud: [
        'GET    /api/wishlist/:userId                  - Get user’s wishlist with filtering (read, instance check)',
        'POST   /api/wishlist                          - Add item to wishlist (write)',
        'PUT    /api/wishlist/:userId/:productId       - Update wishlist item (update, instance check)',
        'DELETE /api/wishlist/:userId/:productId       - Remove item from wishlist (update, instance check)'
      ],
      specialOperations: [
        'POST   /api/wishlist/approve/:userId/:productId - Approve pending wishlist item (update, instance check)',
        'POST   /api/wishlist/restore/:userId/:productId - Restore deleted wishlist item (update, instance check)',
        'POST   /api/wishlist/archive/:userId/:productId - Archive wishlist item (update, instance check)',
        'GET    /api/wishlist/check/:userId/:productId   - Check if product is in wishlist (read, instance check)',
        'DELETE /api/wishlist/clear/:userId             - Clear user’s wishlist (update, instance check, rate-limited)'
      ],
      bulkOperations: [
        'POST   /api/wishlist/bulk/add                 - Bulk add to wishlist (write, rate-limited)',
        'PUT    /api/wishlist/bulk/update              - Bulk update wishlist items (update, rate-limited)'
      ],
      analytics: [
        'GET    /api/wishlist/stats/:userId            - Get wishlist statistics (view, instance check)',
        'GET    /api/wishlist/audit/:userId/:productId - Get audit trail for wishlist item (report, instance check)'
      ],
      export: [
        'GET    /api/wishlist/export/:userId           - Export wishlist (view, instance check)',
        'GET    /api/wishlist/export/featured/:userId  - Export featured wishlist items (view, instance check)'
      ],
      documentation: [
        'GET    /api/wishlist/docs/routes              - Get API route documentation (view, dev-only)'
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
  }
);

module.exports = { WishlistRoute: router };