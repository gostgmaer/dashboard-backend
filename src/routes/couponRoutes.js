const express = require('express');
const couponRouter = express.Router();
const {
  addCoupon,
  addAllCoupon,
  getAllCoupons,
  getShowingCoupons,
  getCouponById,
  updateCoupon,
  updateStatus,
  deleteCoupon,
  updateManyCoupons,
  applyCouponToProduct,
  deleteManyCoupons,
} = require('../controller/coupon/couponController');
const { body, query, param, validationResult } = require('express-validator');
const {authMiddleware} = require('../middleware/auth');
const  authorize  = require('../middleware/authorize');// Assuming authorize is exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED COUPON ROUTES
 * 
 * Features:
 * ✅ Comprehensive CRUD operations for coupons
 * ✅ Bulk operations for adding, updating, and deleting coupons
 * ✅ Status management (show/hide) for coupons
 * ✅ Coupon application to products
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
 * Middleware to check instance-level access for coupon-specific routes
 * Ensures the user has permission to access/modify the specific coupon
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const couponId = req.params.id;
    if (couponId && !req.user.isSuperadmin) { // Superadmin bypass in authorize
      const Coupon = require('../models/Coupon'); // Assumed Coupon model
      const coupon = await Coupon.findById(couponId);
      if (!coupon) {
        return res.status(404).json({ success: false, message: 'Coupon not found' });
      }
      if (coupon.userId.toString() !== req.user.id) { // Restrict to own coupons
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s coupon' });
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

const couponValidation = {
  addCoupon: [
    body('code').isString().withMessage('Code must be a string').isLength({ min: 1, max: 50 }).withMessage('Code must be between 1 and 50 characters').trim().escape(),
    body('discountType').isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
    body('discountValue').isFloat({ min: 0 }).withMessage('Discount value must be a positive number').toFloat(),
    body('minOrderValue').optional().isFloat({ min: 0 }).withMessage('Minimum order value must be a positive number').toFloat(),
    body('maxUses').optional().isInt({ min: 0 }).withMessage('Max uses must be a non-negative integer').toInt(),
    body('maxUsesPerUser').optional().isInt({ min: 0 }).withMessage('Max uses per user must be a non-negative integer').toInt(),
    body('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    body('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('applicableProducts').optional().isArray().withMessage('Applicable products must be an array'),
    body('applicableProducts.*').optional().isMongoId().withMessage('Invalid product ID'),
    body('userId').isMongoId().withMessage('Valid user ID is required'),
    validate
  ],

  addAllCoupon: [
    body('coupons').isArray({ min: 1 }).withMessage('Coupons array is required'),
    body('coupons.*.code').isString().withMessage('Code must be a string').isLength({ min: 1, max: 50 }).withMessage('Code must be between 1 and 50 characters').trim().escape(),
    body('coupons.*.discountType').isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
    body('coupons.*.discountValue').isFloat({ min: 0 }).withMessage('Discount value must be a positive number').toFloat(),
    body('coupons.*.minOrderValue').optional().isFloat({ min: 0 }).withMessage('Minimum order value must be a positive number').toFloat(),
    body('coupons.*.maxUses').optional().isInt({ min: 0 }).withMessage('Max uses must be a non-negative integer').toInt(),
    body('coupons.*.maxUsesPerUser').optional().isInt({ min: 0 }).withMessage('Max uses per user must be a non-negative integer').toInt(),
    body('coupons.*.startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    body('coupons.*.endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    body('coupons.*.isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('coupons.*.applicableProducts').optional().isArray().withMessage('Applicable products must be an array'),
    body('coupons.*.applicableProducts.*').optional().isMongoId().withMessage('Invalid product ID'),
    body('coupons.*.userId').isMongoId().withMessage('Valid user ID is required'),
    validate
  ],

  getAllCoupons: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'code']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    query('search').optional().isString().withMessage('Search must be a string').isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters').trim().escape(),
    validate
  ],

  getShowingCoupons: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    validate
  ],

  getCouponById: [
    param('id').isMongoId().withMessage('Invalid coupon ID'),
    validate
  ],

  updateCoupon: [
    param('id').isMongoId().withMessage('Invalid coupon ID'),
    body('code').optional().isString().withMessage('Code must be a string').isLength({ min: 1, max: 50 }).withMessage('Code must be between 1 and 50 characters').trim().escape(),
    body('discountType').optional().isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
    body('discountValue').optional().isFloat({ min: 0 }).withMessage('Discount value must be a positive number').toFloat(),
    body('minOrderValue').optional().isFloat({ min: 0 }).withMessage('Minimum order value must be a positive number').toFloat(),
    body('maxUses').optional().isInt({ min: 0 }).withMessage('Max uses must be a non-negative integer').toInt(),
    body('maxUsesPerUser').optional().isInt({ min: 0 }).withMessage('Max uses per user must be a non-negative integer').toInt(),
    body('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    body('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('applicableProducts').optional().isArray().withMessage('Applicable products must be an array'),
    body('applicableProducts.*').optional().isMongoId().withMessage('Invalid product ID'),
    validate
  ],

  updateStatus: [
    param('id').isMongoId().withMessage('Invalid coupon ID'),
    body('isActive').isBoolean().withMessage('isActive must be a boolean'),
    validate
  ],

  updateManyCoupons: [
    body('couponIds').isArray({ min: 1 }).withMessage('Coupon IDs array is required'),
    body('couponIds.*').isMongoId().withMessage('Invalid coupon ID in array'),
    body('updates').isObject().withMessage('Updates must be an object'),
    body('updates.code').optional().isString().withMessage('Code must be a string').isLength({ min: 1, max: 50 }).withMessage('Code must be between 1 and 50 characters').trim().escape(),
    body('updates.discountType').optional().isIn(['percentage', 'fixed']).withMessage('Invalid discount type'),
    body('updates.discountValue').optional().isFloat({ min: 0 }).withMessage('Discount value must be a positive number').toFloat(),
    body('updates.isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    validate
  ],

  applyCouponToProduct: [
    body('couponCode').isString().withMessage('Coupon code must be a string').isLength({ min: 1, max: 50 }).withMessage('Coupon code must be between 1 and 50 characters').trim().escape(),
    body('productId').isMongoId().withMessage('Invalid product ID'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer').toInt(),
    validate
  ],

  deleteManyCoupons: [
    body('couponIds').isArray({ min: 1 }).withMessage('Coupon IDs array is required'),
    body('couponIds.*').isMongoId().withMessage('Invalid coupon ID in array'),
    validate
  ],

  id: [
    param('id').isMongoId().withMessage('Invalid coupon ID'),
    validate
  ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// POST /api/coupons - Add a new coupon
couponRouter.post('/coupons',
  authMiddleware,
  authorize('coupons', 'write'),
  instanceCheckMiddleware,
  couponValidation.addCoupon,
  addCoupon
);

// POST /api/coupons/apply - Apply coupon to product
couponRouter.post('/coupons/apply',
  authMiddleware,
  authorize('coupons', 'write'),
  couponValidation.applyCouponToProduct,
  applyCouponToProduct
);

// POST /api/coupons/bulk - Add multiple coupons
couponRouter.post('/coupons/bulk',
  authMiddleware,
  authorize('coupons', 'write'),
  bulkOperationLimiter,
  couponValidation.addAllCoupon,
  addAllCoupon
);

// GET /api/coupons - Get all coupons
couponRouter.get('/coupons',
  authMiddleware,
  authorize('coupons', 'read'),
  couponValidation.getAllCoupons,
  getAllCoupons
);

// GET /api/coupons/active - Get only enabled coupons (showing)
couponRouter.get('/coupons/active',
  authMiddleware,
  authorize('coupons', 'read'),
  couponValidation.getShowingCoupons,
  getShowingCoupons
);

// GET /api/coupons/:id - Get a single coupon by ID
couponRouter.get('/coupons/:id',
  authMiddleware,
  authorize('coupons', 'read'),
  instanceCheckMiddleware,
  couponValidation.id,
  getCouponById
);

// PUT /api/coupons/:id - Update a single coupon by ID
couponRouter.put('/coupons/:id',
  authMiddleware,
  authorize('coupons', 'update'),
  instanceCheckMiddleware,
  couponValidation.updateCoupon,
  updateCoupon
);

// PATCH /api/coupons/bulk/update - Update many coupons
couponRouter.patch('/coupons/bulk/update',
  authMiddleware,
  authorize('coupons', 'update'),
  bulkOperationLimiter,
  couponValidation.updateManyCoupons,
  updateManyCoupons
);

// PUT /api/coupons/:id/status - Show/hide a coupon (update status)
couponRouter.put('/coupons/:id/status',
  authMiddleware,
  authorize('coupons', 'update'),
  instanceCheckMiddleware,
  couponValidation.updateStatus,
  updateStatus
);

// DELETE /api/coupons/:id - Delete a single coupon by ID
couponRouter.delete('/coupons/:id',
  authMiddleware,
  authorize('coupons', 'update'),
  instanceCheckMiddleware,
  couponValidation.id,
  deleteCoupon
);

// PATCH /api/coupons/bulk/delete - Delete multiple coupons
couponRouter.patch('/coupons/bulk/delete',
  authMiddleware,
  authorize('coupons', 'update'),
  bulkOperationLimiter,
  couponValidation.deleteManyCoupons,
  deleteManyCoupons
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  const path = req.path.toLowerCase(); // Case-insensitive matching
  if (path.startsWith('/apply') ||
      path.startsWith('/bulk') ||
      path.startsWith('/active') ||
      path === '/docs/routes') {
    return next();
  }

  next();
};

// Apply the middleware to all routes
couponRouter.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

couponRouter.get('/docs/routes',
  authMiddleware,
  authorize('coupons', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      crud: [
        'POST   /api/coupons                          - Add a new coupon (write, instance check)',
        'GET    /api/coupons                          - Get all coupons (read)',
        'GET    /api/coupons/:id                      - Get a single coupon by ID (read, instance check)',
        'PUT    /api/coupons/:id                      - Update a single coupon by ID (update, instance check)',
        'DELETE /api/coupons/:id                      - Delete a single coupon by ID (update, instance check)'
      ],
      bulk: [
        'POST   /api/coupons/bulk                     - Add multiple coupons (write, rate-limited)',
        'PATCH  /api/coupons/bulk/update              - Update many coupons (update, rate-limited)',
        'PATCH  /api/coupons/bulk/delete              - Delete multiple coupons (update, rate-limited)'
      ],
      status: [
        'PUT    /api/coupons/:id/status               - Show/hide a coupon (update status) (update, instance check)'
      ],
      showing: [
        'GET    /api/coupons/active                   - Get only enabled coupons (showing) (read)'
      ],
      application: [
        'POST   /api/coupons/apply                    - Apply coupon to product (write)'
      ],
      documentation: [
        'GET    /api/coupons/docs/routes              - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Coupon API routes documentation'
    });
  }
);

module.exports = couponRouter;