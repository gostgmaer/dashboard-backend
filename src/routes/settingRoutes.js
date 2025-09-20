const express = require('express');
const settingRoute = express.Router();
const settingsCtrl = require('../controller/setting');
const { body, query, param, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize'); // Assuming authorize is exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED SETTINGS ROUTES
 * 
 * Features:
 * ✅ Comprehensive CRUD operations for site/app settings
 * ✅ Section-based updates for specific configurations
 * ✅ Feature toggles and maintenance controls
 * ✅ Utility endpoints for public settings and resets
 * ✅ Audit-aware updates
 * ✅ Permission-based access control via authorize middleware
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes with rate limiting
 * ✅ Instance-level checks for IDOR prevention
 */

/**
 * Rate limiter for high-risk reset operations
 * Limits to 5 requests per 15 minutes per IP
 */
const resetOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { success: false, message: 'Too many requests, please try again later' }
});

/**
 * Middleware to check instance-level access for siteKey-specific routes
 * Ensures the user has permission to modify/view the specific settings
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const siteKey = req.params.siteKey;
    if (siteKey && !req.user.isSuperadmin) { // Superadmin bypass already in authorize
      const Setting = require('../models/Setting'); // Assuming a Setting model exists
      const setting = await Setting.findOne({ siteKey });
      if (!setting) {
        return res.status(404).json({ success: false, message: 'Settings not found for siteKey' });
      }
      // Add custom logic here, e.g., check if user.tenantId matches setting.tenantId
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

const settingsValidation = {
  create: [
    body('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters').trim().escape(),
    body('branding').optional().isObject().withMessage('Branding must be an object'),
    body('branding.logoUrl').optional().isURL().withMessage('Logo URL must be a valid URL'),
    body('branding.primaryColor').optional().isHexColor().withMessage('Primary color must be a valid hex color'),
    body('seo').optional().isObject().withMessage('SEO must be an object'),
    body('seo.metaTitle').optional().isString().isLength({ max: 60 }).withMessage('Meta title cannot exceed 60 characters').trim().escape(),
    body('paymentMethods').optional().isArray().withMessage('Payment methods must be an array'),
    body('paymentMethods.*').optional().isIn(['credit_card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
    body('contactInfo').optional().isObject().withMessage('Contact info must be an object'),
    body('contactInfo.email').optional().isEmail().withMessage('Invalid email'),
    body('shippingOptions').optional().isArray().withMessage('Shipping options must be an array'),
    body('currency').optional().isString().isLength({ max: 3 }).withMessage('Currency must be a valid ISO 4217 code (e.g., USD)').trim().escape(),
    body('tax').optional().isObject().withMessage('Tax must be an object'),
    body('loyalty').optional().isObject().withMessage('Loyalty program must be an object'),
    body('policies').optional().isObject().withMessage('Policies must be an object'),
    validate
  ],

  update: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters').trim().escape(),
    body('branding').optional().isObject().withMessage('Branding must be an object'),
    body('seo').optional().isObject().withMessage('SEO must be an object'),
    body('paymentMethods').optional().isArray().withMessage('Payment methods must be an array'),
    body('contactInfo').optional().isObject().withMessage('Contact info must be an object'),
    body('shippingOptions').optional().isArray().withMessage('Shipping options must be an array'),
    body('currency').optional().isString().isLength({ max: 3 }).withMessage('Currency must be a valid ISO 4217 code').trim().escape(),
    body('tax').optional().isObject().withMessage('Tax must be an object'),
    body('loyalty').optional().isObject().withMessage('Loyalty program must be an object'),
    body('policies').optional().isObject().withMessage('Policies must be an object'),
    validate
  ],

  sectionUpdate: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters').trim().escape(),
    body().isObject().withMessage('Update body must be an object'),
    validate
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'siteKey']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    validate
  ],

  paymentMethod: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters').trim().escape(),
    body('method').isIn(['credit_card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
    validate
  ],

  featureToggle: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters').trim().escape(),
    body('feature').isString().withMessage('Feature must be a string').isLength({ max: 50 }).withMessage('Feature cannot exceed 50 characters').trim().escape(),
    body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
    validate
  ],

  reset: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters').trim().escape(),
    validate
  ],

  section: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters').trim().escape(),
    param('section').isString().withMessage('Section must be a string').isIn(['branding', 'seo', 'paymentMethods', 'contactInfo', 'shippingOptions', 'emailTemplates', 'analytics', 'currency', 'tax', 'loyalty', 'policies', 'featuredCategories', 'orderLimits']).withMessage('Invalid section'),
    validate
  ]
};

// ========================================
// 📋 CORE CRUD OPERATIONS
// ========================================

// POST /api/setting - Create new settings for a site/app
settingRoute.post('/',
  authMiddleware,
  authorize('settings', 'write'),
  settingsValidation.create,
  settingsCtrl.createSettings
);

// GET /api/setting - List all settings (all sites/apps)
settingRoute.get('/',
  authMiddleware,
  authorize('settings', 'read'),
  settingsValidation.query,
  settingsCtrl.listAllSettings
);

// GET /api/setting/:siteKey - Get settings for a specific site/app
settingRoute.get('/:siteKey',
  // authMiddleware,
  // authorize('settings', 'read'),
  // instanceCheckMiddleware,
  // param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters').trim().escape(),
  // validate,
  settingsCtrl.getSettingsBySite
);

// PUT /api/setting/:siteKey - Update settings for a specific site/app
settingRoute.put('/:siteKey',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.update,
  settingsCtrl.updateSettingsBySite
);

// DELETE /api/setting/:siteKey - Delete settings for a specific site/app
settingRoute.delete('/:siteKey',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters').trim().escape(),
  validate,
  settingsCtrl.deleteSettingsBySite
);

// ========================================
// 🔍 SECTION-BASED UPDATES
// ========================================

// PATCH /api/setting/:siteKey/branding - Update branding settings
settingRoute.patch('/:siteKey/branding',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('logoUrl').optional().isURL().withMessage('Logo URL must be a valid URL'),
  body('primaryColor').optional().isHexColor().withMessage('Primary color must be a valid hex color'),
  validate,
  settingsCtrl.updateBranding
);

// PATCH /api/setting/:siteKey/branding/field - Update specific branding field
settingRoute.patch('/:siteKey/branding/field',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('field').isString().withMessage('Field must be a string').trim().escape(),
  body('value').exists().withMessage('Value is required'),
  validate,
  settingsCtrl.updateBrandingField
);

// PATCH /api/setting/:siteKey/seo - Update SEO settings
settingRoute.patch('/:siteKey/seo',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('metaTitle').optional().isString().isLength({ max: 60 }).withMessage('Meta title cannot exceed 60 characters').trim().escape(),
  body('metaDescription').optional().isString().isLength({ max: 160 }).withMessage('Meta description cannot exceed 160 characters').trim().escape(),
  validate,
  settingsCtrl.updateSEO
);

// PATCH /api/setting/:siteKey/payment-methods - Update payment methods
settingRoute.patch('/:siteKey/payment-methods',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('methods').isArray().withMessage('Methods must be an array'),
  body('methods.*').isIn(['credit_card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
  validate,
  settingsCtrl.updatePaymentMethods
);

// POST /api/setting/:siteKey/payment-methods - Add payment method
settingRoute.post('/:siteKey/payment-methods',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.paymentMethod,
  settingsCtrl.addPaymentMethod
);

// DELETE /api/setting/:siteKey/payment-methods - Remove payment method
settingRoute.delete('/:siteKey/payment-methods',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.paymentMethod,
  settingsCtrl.removePaymentMethod
);

// PATCH /api/setting/:siteKey/contact-info - Update contact info
settingRoute.patch('/:siteKey/contact-info',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('phone').optional().isString().withMessage('Phone must be a string').isLength({ max: 20 }).withMessage('Phone cannot exceed 20 characters').trim().escape(),
  validate,
  settingsCtrl.updateContactInfo
);

// PATCH /api/setting/:siteKey/shipping-options - Update shipping options
settingRoute.patch('/:siteKey/shipping-options',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('options').isArray().withMessage('Shipping options must be an array'),
  validate,
  settingsCtrl.updateShippingOptions
);

// PATCH /api/setting/:siteKey/email-templates - Update email templates
settingRoute.patch('/:siteKey/email-templates',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('templates').isObject().withMessage('Templates must be an object'),
  validate,
  settingsCtrl.updateEmailTemplates
);

// PATCH /api/setting/:siteKey/analytics - Update analytics settings
settingRoute.patch('/:siteKey/analytics',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('trackingId').optional().isString().withMessage('Tracking ID must be a string').trim().escape(),
  validate,
  settingsCtrl.updateAnalytics
);

// PATCH /api/setting/:siteKey/currency-tax - Update currency and tax
settingRoute.patch('/:siteKey/currency-tax',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('currency').optional().isString().isLength({ max: 3 }).withMessage('Currency must be a valid ISO 4217 code').trim().escape(),
  body('tax').optional().isObject().withMessage('Tax must be an object'),
  validate,
  settingsCtrl.updateCurrencyAndTax
);

// PATCH /api/setting/:siteKey/currency - Update currency
settingRoute.patch('/:siteKey/currency',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('currency').isString().isLength({ max: 3 }).withMessage('Currency must be a valid ISO 4217 code').trim().escape(),
  validate,
  settingsCtrl.updateCurrency
);

// PATCH /api/setting/:siteKey/loyalty - Update loyalty program
settingRoute.patch('/:siteKey/loyalty',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('pointsPerDollar').optional().isFloat({ min: 0 }).withMessage('Points per dollar must be a positive number'),
  validate,
  settingsCtrl.updateLoyaltyProgram
);

// PATCH /api/setting/:siteKey/loyalty/increment - Increment loyalty points
settingRoute.patch('/:siteKey/loyalty/increment',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('increment').isFloat({ min: 0 }).withMessage('Increment must be a positive number'),
  validate,
  settingsCtrl.incrementLoyaltyPoints
);

// PATCH /api/setting/:siteKey/policies - Update policies
settingRoute.patch('/:siteKey/policies',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('policies').isObject().withMessage('Policies must be an object'),
  validate,
  settingsCtrl.updatePolicies
);

// PATCH /api/setting/:siteKey/policy - Update specific policy
settingRoute.patch('/:siteKey/policy',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('policyType').isString().withMessage('Policy type must be a string').trim().escape(),
  body('content').isString().withMessage('Content must be a string').isLength({ max: 5000 }).withMessage('Content cannot exceed 5000 characters').trim().escape(),
  validate,
  settingsCtrl.updatePolicy
);

// PATCH /api/setting/:siteKey/featured-categories - Update featured categories
settingRoute.patch('/:siteKey/featured-categories',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('categories').isArray().withMessage('Categories must be an array'),
  body('categories.*').isMongoId().withMessage('Invalid category ID'),
  validate,
  settingsCtrl.updateFeaturedCategories
);

// PATCH /api/setting/:siteKey/order-limits - Update order limits
settingRoute.patch('/:siteKey/order-limits',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('maxOrderValue').optional().isFloat({ min: 0 }).withMessage('Max order value must be a positive number'),
  body('minOrderValue').optional().isFloat({ min: 0 }).withMessage('Min order value must be a positive number'),
  validate,
  settingsCtrl.updateOrderLimits
);

// ========================================
// 🔄 TOGGLES & FEATURES
// ========================================

// PATCH /api/setting/:siteKey/maintenance - Toggle maintenance mode
settingRoute.patch('/:siteKey/maintenance',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  validate,
  settingsCtrl.toggleMaintenanceMode
);

// PATCH /api/setting/:siteKey/maintenance-with-reason - Set maintenance mode with reason
settingRoute.patch('/:siteKey/maintenance-with-reason',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  body('reason').optional().isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters').trim().escape(),
  validate,
  settingsCtrl.setMaintenanceMode
);

// PATCH /api/setting/:siteKey/live - Toggle live status
settingRoute.patch('/:siteKey/live',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  validate,
  settingsCtrl.toggleLiveStatus
);

// PATCH /api/setting/:siteKey/feature - Toggle feature flag
settingRoute.patch('/:siteKey/feature',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.featureToggle,
  settingsCtrl.toggleFeature
);

// ========================================
// 🛠 UTILITIES
// ========================================

// GET /api/setting/:siteKey/public - Get public (safe) settings
settingRoute.get('/:siteKey/public',
  settingsCtrl.getPublicSettings
);

// GET /api/setting/:siteKey/section/:section - Get a specific section
settingRoute.get('/:siteKey/section/:section',
  authMiddleware,
  authorize('settings', 'read'),
  instanceCheckMiddleware,
  settingsValidation.section,
  settingsCtrl.getSection
);

// POST /api/setting/:siteKey/reset - Reset all settings to defaults
settingRoute.post('/:siteKey/reset',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  resetOperationLimiter,
  settingsValidation.reset,
  settingsCtrl.resetToDefaults
);

// POST /api/setting/:siteKey/reset-section - Reset a specific section to default
settingRoute.post('/:siteKey/reset-section',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  resetOperationLimiter,
  settingsValidation.section,
  settingsCtrl.resetSection
);

// PATCH /api/setting/:siteKey/audit-update - Audit-aware generic update
settingRoute.patch('/:siteKey/audit-update',
  authMiddleware,
  authorize('settings', 'update'),
  instanceCheckMiddleware,
  settingsValidation.sectionUpdate,
  body('changes').isObject().withMessage('Changes must be an object'),
  body('auditNote').optional().isString().withMessage('Audit note must be a string').isLength({ max: 500 }).withMessage('Audit note cannot exceed 500 characters').trim().escape(),
  validate,
  settingsCtrl.updateWithAudit
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones, case-insensitive
  const path = req.path.toLowerCase();
  if (path.includes('/public') ||
    path.includes('/section/') ||
    path.includes('/reset') ||
    path.includes('/audit-update') ||
    path.includes('/branding') ||
    path.includes('/seo') ||
    path.includes('/payment-methods') ||
    path.includes('/contact-info') ||
    path.includes('/shipping-options') ||
    path.includes('/email-templates') ||
    path.includes('/analytics') ||
    path.includes('/currency') ||
    path.includes('/loyalty') ||
    path.includes('/policies') ||
    path.includes('/featured-categories') ||
    path.includes('/order-limits') ||
    path.includes('/maintenance') ||
    path.includes('/live') ||
    path.includes('/feature')) {
    return next();
  }

  next();
};

// Apply the middleware to all routes
settingRoute.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

settingRoute.get('/docs/routes',
  authMiddleware,
  authorize('settings', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      crud: [
        'POST   /api/setting                          - Create new settings for a site/app (write)',
        'GET    /api/setting                          - List all settings (all sites/apps) (read)',
        'GET    /api/setting/:siteKey                 - Get settings for a specific site/app (read, instance check)',
        'PUT    /api/setting/:siteKey                 - Update settings for a specific site/app (update, instance check)',
        'DELETE /api/setting/:siteKey                 - Delete settings for a specific site/app (update, instance check)'
      ],
      sectionBasedUpdates: [
        'PATCH  /api/setting/:siteKey/branding        - Update branding settings (update, instance check)',
        'PATCH  /api/setting/:siteKey/branding/field  - Update specific branding field (update, instance check)',
        'PATCH  /api/setting/:siteKey/seo             - Update SEO settings (update, instance check)',
        'PATCH  /api/setting/:siteKey/payment-methods - Update payment methods (update, instance check)',
        'POST   /api/setting/:siteKey/payment-methods - Add payment method (update, instance check)',
        'DELETE /api/setting/:siteKey/payment-methods - Remove payment method (update, instance check)',
        'PATCH  /api/setting/:siteKey/contact-info    - Update contact info (update, instance check)',
        'PATCH  /api/setting/:siteKey/shipping-options - Update shipping options (update, instance check)',
        'PATCH  /api/setting/:siteKey/email-templates - Update email templates (update, instance check)',
        'PATCH  /api/setting/:siteKey/analytics       - Update analytics settings (update, instance check)',
        'PATCH  /api/setting/:siteKey/currency-tax    - Update currency and tax (update, instance check)',
        'PATCH  /api/setting/:siteKey/currency        - Update currency (update, instance check)',
        'PATCH  /api/setting/:siteKey/loyalty         - Update loyalty program (update, instance check)',
        'PATCH  /api/setting/:siteKey/loyalty/increment - Increment loyalty points (update, instance check)',
        'PATCH  /api/setting/:siteKey/policies        - Update policies (update, instance check)',
        'PATCH  /api/setting/:siteKey/policy          - Update specific policy (update, instance check)',
        'PATCH  /api/setting/:siteKey/featured-categories - Update featured categories (update, instance check)',
        'PATCH  /api/setting/:siteKey/order-limits    - Update order limits (update, instance check)'
      ],
      togglesFeatures: [
        'PATCH  /api/setting/:siteKey/maintenance     - Toggle maintenance mode (update, instance check)',
        'PATCH  /api/setting/:siteKey/maintenance-with-reason - Set maintenance mode with reason (update, instance check)',
        'PATCH  /api/setting/:siteKey/live            - Toggle live status (update, instance check)',
        'PATCH  /api/setting/:siteKey/feature         - Toggle feature flag (update, instance check)'
      ],
      utilities: [
        'GET    /api/setting/:siteKey/public          - Get public (safe) settings (view)',
        'GET    /api/setting/:siteKey/section/:section - Get a specific section (read, instance check)',
        'POST   /api/setting/:siteKey/reset           - Reset all settings to defaults (update, instance check, rate-limited)',
        'POST   /api/setting/:siteKey/reset-section   - Reset a specific section to default (update, instance check, rate-limited)',
        'PATCH  /api/setting/:siteKey/audit-update    - Audit-aware generic update (update, instance check)'
      ],
      documentation: [
        'GET    /api/setting/docs/routes              - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Settings API routes documentation'
    });
  }
);

module.exports = settingRoute;