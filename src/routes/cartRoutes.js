const express = require('express');
const router = express.Router();
const cartController = require('../controller/cart/cart');
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED CART ROUTES
 * 
 * Features:
 * ✅ User-focused cart operations (add, remove, update, clear)
 * ✅ Discount and metadata management
 * ✅ Cart merging for user sessions
 * ✅ Admin-focused operations for analytics and bulk updates
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const cartValidation = {
  addItem: [
    body('productId').isMongoId().withMessage('Invalid product ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('variantId').optional().isMongoId().withMessage('Invalid variant ID')
  ],

  updateQuantity: [
    param('productId').isMongoId().withMessage('Invalid product ID'),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
    body('variantId').optional().isMongoId().withMessage('Invalid variant ID')
  ],

  removeItem: [
    param('productId').isMongoId().withMessage('Invalid product ID')
  ],

  discount: [
    body('discountCode').isString().withMessage('Discount code must be a string').isLength({ max: 50 }).withMessage('Discount code cannot exceed 50 characters')
  ],

  merge: [
    body('cartItems').isArray({ min: 1 }).withMessage('Cart items array is required'),
    body('cartItems.*.productId').isMongoId().withMessage('Invalid product ID in cart items'),
    body('cartItems.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('cartItems.*.variantId').optional().isMongoId().withMessage('Invalid variant ID')
  ],

  metadata: [
    body('metadata').isObject().withMessage('Metadata must be an object'),
    body('metadata.*').optional().isString().withMessage('Metadata values must be strings').isLength({ max: 500 }).withMessage('Metadata value cannot exceed 500 characters')
  ],

  bulkUpdate: [
    body('cartIds').isArray({ min: 1 }).withMessage('Cart IDs array is required'),
    body('cartIds.*').isMongoId().withMessage('Invalid cart ID in array'),
    body('status').isIn(['active', 'abandoned', 'completed']).withMessage('Invalid status')
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'total']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('userId').optional().isMongoId().withMessage('Invalid user ID')
  ],

  analytics: [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    query('status').optional().isIn(['active', 'abandoned', 'completed']).withMessage('Invalid status filter')
  ],

  removeProduct: [
    param('productId').isMongoId().withMessage('Invalid product ID')
  ]
};

// ========================================
// 🛒 USER CART OPERATIONS
// ========================================

// POST /api/cart/add - Add item to cart
router.post('/add',
  authMiddleware,
  cartValidation.addItem,
  cartController.addItem
);

// DELETE /api/cart/remove/:productId - Remove item from cart
router.delete('/remove/:productId',
  authMiddleware,
  cartValidation.removeItem,
  cartController.removeItem
);

// PATCH /api/cart/update/:productId - Update item quantity in cart
router.patch('/update/:productId',
  authMiddleware,
  cartValidation.updateQuantity,
  cartController.updateQuantity
);

// DELETE /api/cart/clear - Clear user's cart
router.delete('/clear',
  authMiddleware,
  cartController.clearCart
);

// GET /api/cart - Get user's cart
router.get('/',
  authMiddleware,
  cartController.getCart
);

// POST /api/cart/discount - Apply discount to cart
router.post('/discount',
  authMiddleware,
  cartValidation.discount,
  cartController.applyDiscount
);

// POST /api/cart/merge - Merge cart (e.g., guest to user cart)
router.post('/merge',
  authMiddleware,
  cartValidation.merge,
  cartController.mergeCart
);

// POST /api/cart/metadata - Set cart metadata
router.post('/metadata',
  authMiddleware,
  cartValidation.metadata,
  cartController.setMetadata
);

// ========================================
// 👮 ADMIN CART OPERATIONS
// ========================================

// GET /api/cart/paginated - Get paginated carts
router.get('/paginated',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  cartValidation.query,
  cartController.getPaginatedCarts
);

// GET /api/cart/abandoned - Get abandoned carts
router.get('/abandoned',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  cartValidation.query,
  cartController.getAbandonedCarts
);

// PATCH /api/cart/bulk-update - Bulk update cart status
router.patch('/bulk-update',
  authMiddleware,
  roleMiddleware(['admin']),
  cartValidation.bulkUpdate,
  cartController.bulkUpdateCartStatus
);

// GET /api/cart/analytics - Get cart analytics
router.get('/analytics',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  cartValidation.analytics,
  cartController.getCartAnalytics
);

// DELETE /api/cart/product/:productId - Remove product from all carts
router.delete('/product/:productId',
  authMiddleware,
  roleMiddleware(['admin']),
  cartValidation.removeProduct,
  cartController.removeProductFromAllCarts
);

// DELETE /api/cart/all - Clear all carts
router.delete('/all',
  authMiddleware,
  roleMiddleware(['admin']),
  cartController.clearAllCarts
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones
  if (req.path.startsWith('/add') ||
    req.path.startsWith('/clear') ||
    req.path.startsWith('/discount') ||
    req.path.startsWith('/merge') ||
    req.path.startsWith('/metadata') ||
    req.path.startsWith('/paginated') ||
    req.path.startsWith('/abandoned') ||
    req.path.startsWith('/bulk-update') ||
    req.path.startsWith('/analytics') ||
    req.path.startsWith('/all')) {
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
    userOperations: [
      'POST   /api/cart/add                    - Add item to cart',
      'DELETE /api/cart/remove/:productId      - Remove item from cart',
      'PATCH  /api/cart/update/:productId      - Update item quantity in cart',
      'DELETE /api/cart/clear                  - Clear user\'s cart',
      'GET    /api/cart                        - Get user\'s cart',
      'POST   /api/cart/discount               - Apply discount to cart',
      'POST   /api/cart/merge                  - Merge cart (e.g., guest to user cart)',
      'POST   /api/cart/metadata               - Set cart metadata'
    ],
    adminOperations: [
      'GET    /api/cart/paginated              - Get paginated carts',
      'GET    /api/cart/abandoned              - Get abandoned carts',
      'PATCH  /api/cart/bulk-update            - Bulk update cart status',
      'GET    /api/cart/analytics              - Get cart analytics',
      'DELETE /api/cart/product/:productId     - Remove product from all carts',
      'DELETE /api/cart/all                    - Clear all carts'
    ]
  };

  res.status(200).json({
    success: true,
    data: {
      totalRoutes: Object.values(routes).flat().length,
      categories: routes
    },
    message: 'Cart API routes documentation'
  });
});

module.exports = { cartRoutes: router };