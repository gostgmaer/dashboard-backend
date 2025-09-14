const express = require('express');
const discountRoute = express.Router();
const ctrl = require('../controller/discount');
const { body, param, query, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const  authorize  = require('../middleware/authorize'); // Assuming authorize is exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED DISCOUNT ROUTES
 * 
 * Features:
 * ✅ CRUD operations for discount rules
 * ✅ Promo code management (create, update, apply)
 * ✅ Discount rule preview and checkout integration
 * ✅ Permission-based access control via authorize middleware
 * ✅ Comprehensive validation schemas with sanitization
 * ✅ Rate limiting for high-risk operations
 * ✅ Instance-level checks for IDOR prevention
 * ✅ Performance optimized routes
 */

/**
 * Rate limiter for high-risk operations
 * Limits to 10 requests per 15 minutes per IP
 */
const operationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many requests, please try again later' }
});

/**
 * Middleware to check instance-level access for discount-specific routes
 * Ensures the user has permission to access/modify the specific discount rule or promo
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (id && !req.user.isSuperadmin) { // Superadmin bypass in authorize
      const Discount = require('../models/Discount'); // Assumed Discount model
      const discount = await Discount.findById(id);
      if (!discount) {
        return res.status(404).json({ success: false, message: 'Discount rule or promo not found' });
      }
      if (discount.userId.toString() !== req.user.id) { // Restrict to own discounts
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s discount' });
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

const discountValidation = {
  rule: [
    body('name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters').trim().escape(),
    body('type').isIn(['percentage', 'fixed', 'buy_x_get_y']).withMessage('Type must be percentage, fixed, or buy_x_get_y'),
    body('value').isFloat({ min: 0 }).withMessage('Value must be a non-negative number').toFloat(),
    body('conditions').isObject().withMessage('Conditions must be an object'),
    body('conditions.minPurchase').optional().isFloat({ min: 0 }).withMessage('Minimum purchase must be a non-negative number').toFloat(),
    body('conditions.products').optional().isArray().withMessage('Products must be an array'),
    body('conditions.products.*').optional().isMongoId().withMessage('Invalid product ID in conditions'),
    body('conditions.categories').optional().isArray().withMessage('Categories must be an array'),
    body('conditions.categories.*').optional().isMongoId().withMessage('Invalid category ID in conditions'),
    body('startDate').isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    body('endDate').isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('userId').isMongoId().withMessage('Valid user ID is required'),
    validate
  ],

  toggle: [
    param('id').isMongoId().withMessage('Invalid discount rule ID'),
    body('isActive').isBoolean().withMessage('isActive must be a boolean'),
    validate
  ],

  promo: [
    body('code').isString().withMessage('Code must be a string').isLength({ min: 1, max: 50 }).withMessage('Code must be between 1 and 50 characters').trim().escape(),
    body('discountType').isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
    body('discountValue').isFloat({ min: 0 }).withMessage('Discount value must be a non-negative number').toFloat(),
    body('startDate').isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    body('endDate').isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    body('products').optional().isArray().withMessage('Products must be an array'),
    body('products.*').optional().isMongoId().withMessage('Invalid product ID in products array'),
    body('minPurchase').optional().isFloat({ min: 0 }).withMessage('Minimum purchase must be a non-negative number').toFloat(),
    body('maxDiscount').optional().isFloat({ min: 0 }).withMessage('Maximum discount must be a non-negative number').toFloat(),
    body('usageLimit').optional().isInt({ min: 1 }).withMessage('Usage limit must be a positive integer').toInt(),
    body('userId').isMongoId().withMessage('Valid user ID is required'),
    validate
  ],

  applyPromo: [
    body('code').isString().withMessage('Code must be a string').isLength({ min: 1, max: 50 }).withMessage('Code must be between 1 and 50 characters').trim().escape(),
    body('cartId').isMongoId().withMessage('Invalid cart ID'),
    validate
  ],

  checkout: [
    body('cartId').isMongoId().withMessage('Invalid cart ID'),
    body('discounts').optional().isArray().withMessage('Discounts must be an array'),
    body('discounts.*.code').optional().isString().withMessage('Discount code must be a string').isLength({ min: 1, max: 50 }).withMessage('Discount code must be between 1 and 50 characters').trim().escape(),
    body('discounts.*.ruleId').optional().isMongoId().withMessage('Invalid rule ID in discounts'),
    validate
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'name']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    validate
  ],

  preview: [
    body('cartId').isMongoId().withMessage('Invalid cart ID'),
    body('ruleIds').isArray().withMessage('Rule IDs must be an array'),
    body('ruleIds.*').isMongoId().withMessage('Invalid rule ID in array'),
    validate
  ]
};

// ========================================
// 📋 DISCOUNT RULE ROUTES
// ========================================

// POST /api/discount/rules - Create or update a discount rule
discountRoute.post('/rules',
  authMiddleware,
  authorize('discount.rule', 'write'),
  operationLimiter,
  discountValidation.rule,
  ctrl.upsertDiscountRule
);

// PUT /api/discount/rules/:id - Update a discount rule
discountRoute.put('/rules/:id',
  authMiddleware,
  authorize('discount.rule', 'update'),
  instanceCheckMiddleware,
  operationLimiter,
  discountValidation.rule,
  ctrl.upsertDiscountRule
);

// GET /api/discount/rules - List discount rules
discountRoute.get('/rules',
  authMiddleware,
  authorize('discount.rule', 'read'),
  discountValidation.query,
  ctrl.listDiscountRules
);

// PATCH /api/discount/rules/:id/toggle - Toggle discount rule active status
discountRoute.patch('/rules/:id/toggle',
  authMiddleware,
  authorize('discount.rule', 'update'),
  instanceCheckMiddleware,
  discountValidation.toggle,
  ctrl.toggleRuleActive
);

// ========================================
// 📋 PROMO CODE ROUTES
// ========================================

// POST /api/discount/promo - Create or update a promo code
discountRoute.post('/promo',
  authMiddleware,
  authorize('promo', 'write'),
  operationLimiter,
  discountValidation.promo,
  ctrl.upsertPromoCode
);

// PUT /api/discount/promo/:id - Update a promo code
discountRoute.put('/promo/:id',
  authMiddleware,
  authorize('promo', 'update'),
  instanceCheckMiddleware,
  operationLimiter,
  discountValidation.promo,
  ctrl.upsertPromoCode
);

// POST /api/discount/promo/apply - Apply promo code to cart
discountRoute.post('/promo/apply',
  authMiddleware,
  authorize('promo', 'write'),
  discountValidation.applyPromo,
  ctrl.applyPromoToCart
);

// ========================================
// 📋 CHECKOUT & PREVIEW ROUTES
// ========================================

// POST /api/discount/preview/rules - Preview rules pricing
discountRoute.post('/preview/rules',
  authMiddleware,
  authorize('discount.rule', 'read'),
  discountValidation.preview,
  ctrl.previewRulesPricing
);

// POST /api/discount/checkout/discounts - Checkout with discounts
discountRoute.post('/checkout/discounts',
  authMiddleware,
  authorize('discount', 'write'),
  discountValidation.checkout,
  ctrl.checkoutWithDiscounts
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  const path = req.path.toLowerCase(); // Case-insensitive matching
  if (path.startsWith('/rules') ||
      path.startsWith('/promo') ||
      path.startsWith('/preview') ||
      path.startsWith('/checkout')) {
    return next();
  }

  next();
};

// Apply the middleware to all routes
discountRoute.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

discountRoute.get('/docs/routes',
  authMiddleware,
  authorize('discount', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      discountRules: [
        'POST   /api/discount/rules              - Create or update a discount rule (write, rate-limited)',
        'PUT    /api/discount/rules/:id          - Update a discount rule (update, instance check, rate-limited)',
        'GET    /api/discount/rules              - List discount rules (read)',
        'PATCH  /api/discount/rules/:id/toggle   - Toggle discount rule active status (update, instance check)'
      ],
      promoCodes: [
        'POST   /api/discount/promo              - Create or update a promo code (write, rate-limited)',
        'PUT    /api/discount/promo/:id          - Update a promo code (update, instance check, rate-limited)',
        'POST   /api/discount/promo/apply        - Apply promo code to cart (write)'
      ],
      previewCheckout: [
        'POST   /api/discount/preview/rules      - Preview rules pricing (read)',
        'POST   /api/discount/checkout/discounts - Checkout with discounts (write)'
      ],
      documentation: [
        'GET    /api/discount/docs/routes        - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Discount API routes documentation'
    });
  }
);

module.exports = discountRoute;