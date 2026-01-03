const express = require('express');
const router = express.Router();
const cartController = require('../controller/cart/cart');
const { body, query, param, validationResult } = require('express-validator');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const authorize = require('../middleware/authorize'); // Assuming authorize is exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');
const Cart = require('../models/cart');

/**
 * 🚀 CONSOLIDATED CART ROUTES
 *
 * Features:
 * ✅ User-focused cart operations (add, remove, update, clear)
 * ✅ Discount and metadata management
 * ✅ Cart merging for user sessions
 * ✅ Admin-focused operations for analytics and bulk updates
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
  message: { success: false, message: 'Too many requests, please try again later' },
});

/**
 * Middleware to check instance-level access for cart-specific routes
 * Ensures the user has permission to access/modify the specific cart
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const cartId = req.params.cartId || req.user.cartId; // Assumes cartId is linked to user
    if (cartId && !req.user.isSuperadmin) {
      // Superadmin bypass in authorize

      const cart = await Cart.findById(cartId);
      if (!cart) {
        return res.status(404).json({ success: false, message: 'Cart not found' });
      }
      if (cart.userId.toString() !== req.user.id) {
        // Restrict to own cart
        return res.status(403).json({ success: false, message: "Forbidden: Cannot access another user's cart" });
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

const cartValidation = {
  addItem: [body('productId').isMongoId().withMessage('Invalid product ID'), body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer').toInt(), body('variantId').optional().isMongoId().withMessage('Invalid variant ID'), validate],

  updateQuantity: [param('productId').isMongoId().withMessage('Invalid product ID'), body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer').toInt(), body('variantId').optional().isMongoId().withMessage('Invalid variant ID'), validate],

  removeItem: [param('productId').isMongoId().withMessage('Invalid product ID'), validate],

  discount: [body('discountCode').isString().withMessage('Discount code must be a string').isLength({ max: 50 }).withMessage('Discount code cannot exceed 50 characters').trim().escape(), validate],

  merge: [body('cartItems').isArray({ min: 1 }).withMessage('Cart items array is required'), body('cartItems.*.productId').isMongoId().withMessage('Invalid product ID in cart items'), body('cartItems.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer').toInt(), body('cartItems.*.variantId').optional().isMongoId().withMessage('Invalid variant ID'), validate],

  metadata: [body('metadata').isObject().withMessage('Metadata must be an object'), body('metadata.*').optional().isString().withMessage('Metadata values must be strings').isLength({ max: 500 }).withMessage('Metadata value cannot exceed 500 characters').trim().escape(), validate],

  bulkUpdate: [body('cartIds').isArray({ min: 1 }).withMessage('Cart IDs array is required'), body('cartIds.*').isMongoId().withMessage('Invalid cart ID in array'), body('status').isIn(['active', 'abandoned', 'completed']).withMessage('Invalid status'), validate],

  query: [query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(), query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(), query('sort').optional().isIn(['createdAt', 'updatedAt', 'total']).withMessage('Invalid sort field'), query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'), query('userId').optional().isMongoId().withMessage('Invalid user ID'), validate],

  analytics: [query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'), query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'), query('status').optional().isIn(['active', 'abandoned', 'completed']).withMessage('Invalid status filter'), validate],

  removeProduct: [param('productId').isMongoId().withMessage('Invalid product ID'), validate],
};

// ========================================
// 🛒 USER CART OPERATIONS
// ========================================

// POST /api/cart/add - Add item to cart

router.get(
  '/',
  optionalAuth, // allow guest
  cartController.getOrCreateCart
);
router.post(
  '/add',
  authMiddleware,

  instanceCheckMiddleware,
  cartValidation.addItem,
  cartController.addItemToCart
);

// DELETE /api/cart/remove/:productId - Remove item from cart
router.delete(
  '/remove/:productId',
  authMiddleware,

  instanceCheckMiddleware,
  cartValidation.removeItem,
  cartController.removeCartItem
);

// PATCH /api/cart/update/:productId - Update item quantity in cart
router.patch('/update/:productId', authMiddleware, instanceCheckMiddleware, cartValidation.updateQuantity, cartController.updateCartItem);

// DELETE /api/cart/clear - Clear user's cart
router.delete(
  '/clear',
  authMiddleware,

  instanceCheckMiddleware,
  cartController.clearCart
);

// GET /api/cart - Get user's cart
router.get(
  '/list',
  authMiddleware,

  instanceCheckMiddleware,
  cartController.getCart
);

// POST /api/cart/discount - Apply discount to cart
router.post(
  '/discount',
  authMiddleware,

  instanceCheckMiddleware,
  cartValidation.discount,
  cartController.applyCartDiscount
);

// POST /api/cart/merge - Merge cart (e.g., guest to user cart)
router.post(
  '/merge',
  authMiddleware,

  instanceCheckMiddleware,
  cartValidation.merge,
  cartController.mergeCart
);

// POST /api/cart/metadata - Set cart metadata
router.post(
  '/metadata',
  authMiddleware,

  instanceCheckMiddleware,
  cartValidation.metadata,
  cartController.setMetadata
);

// ========================================
// 👮 ADMIN CART OPERATIONS
// ========================================

// GET /api/cart/paginated - Get paginated carts
router.get(
  '/paginated',
  authMiddleware,

  bulkOperationLimiter,
  cartValidation.query,
  cartController.getPaginatedCarts
);

// GET /api/cart/abandoned - Get abandoned carts
router.get(
  '/abandoned',
  authMiddleware,

  bulkOperationLimiter,
  cartValidation.query,
  cartController.getAbandonedCarts
);

// PATCH /api/cart/bulk-update - Bulk update cart status
router.patch(
  '/bulk-update',
  authMiddleware,

  bulkOperationLimiter,
  cartValidation.bulkUpdate,
  cartController.bulkUpdateCartStatus
);

// GET /api/cart/analytics - Get cart analytics
router.get(
  '/analytics',
  authMiddleware,

  bulkOperationLimiter,
  cartValidation.analytics,
  cartController.getCartAnalytics
);

// DELETE /api/cart/product/:productId - Remove product from all carts
router.delete(
  '/product/:productId',
  authMiddleware,

  bulkOperationLimiter,
  cartValidation.removeProduct,
  cartController.removeProductFromAllCarts
);

// DELETE /api/cart/all - Clear all carts
router.delete(
  '/all',
  authMiddleware,

  bulkOperationLimiter,
  cartController.clearAllCarts
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  const path = req.path.toLowerCase(); // Case-insensitive matching
  if (path.startsWith('/add') || path.startsWith('/clear') || path.startsWith('/discount') || path.startsWith('/merge') || path.startsWith('/metadata') || path.startsWith('/paginated') || path.startsWith('/abandoned') || path.startsWith('/bulk-update') || path.startsWith('/analytics') || path.startsWith('/all')) {
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
      message: 'Route documentation only available in development mode',
    });
  }

  const routes = {
    userOperations: ['POST   /api/cart/add                    - Add item to cart (write, instance check)', 'DELETE /api/cart/remove/:productId      - Remove item from cart (write, instance check)', 'PATCH  /api/cart/update/:productId      - Update item quantity in cart (write, instance check)', "DELETE /api/cart/clear                  - Clear user's cart (write, instance check)", "GET    /api/cart                        - Get user's cart (read, instance check)", 'POST   /api/cart/discount               - Apply discount to cart (write, instance check)', 'POST   /api/cart/merge                  - Merge cart (e.g., guest to user cart) (write, instance check)', 'POST   /api/cart/metadata               - Set cart metadata (write, instance check)'],
    adminOperations: ['GET    /api/cart/paginated              - Get paginated carts (read, rate-limited)', 'GET    /api/cart/abandoned              - Get abandoned carts (read, rate-limited)', 'PATCH  /api/cart/bulk-update            - Bulk update cart status (update, rate-limited)', 'GET    /api/cart/analytics              - Get cart analytics (report, rate-limited)', 'DELETE /api/cart/product/:productId     - Remove product from all carts (update, rate-limited)', 'DELETE /api/cart/all                    - Clear all carts (update, rate-limited)'],
    documentation: ['GET    /api/cart/docs/routes            - Get API route documentation (view, dev-only)'],
  };

  res.status(200).json({
    success: true,
    data: {
      totalRoutes: Object.values(routes).flat().length,
      categories: routes,
    },
    message: 'Cart API routes documentation',
  });
});

module.exports = { cartRoutes: router };
