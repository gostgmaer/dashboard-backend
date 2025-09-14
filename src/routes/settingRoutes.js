const express = require('express');
const settingRoute = express.Router();
const settingsCtrl = require('../controller/setting');
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
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
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const settingsValidation = {
  create: [
    body('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters'),
    body('branding').optional().isObject().withMessage('Branding must be an object'),
    body('branding.logoUrl').optional().isURL().withMessage('Logo URL must be a valid URL'),
    body('branding.primaryColor').optional().isHexColor().withMessage('Primary color must be a valid hex color'),
    body('seo').optional().isObject().withMessage('SEO must be an object'),
    body('seo.metaTitle').optional().isString().isLength({ max: 60 }).withMessage('Meta title cannot exceed 60 characters'),
    body('paymentMethods').optional().isArray().withMessage('Payment methods must be an array'),
    body('paymentMethods.*').optional().isIn(['credit_card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
    body('contactInfo').optional().isObject().withMessage('Contact info must be an object'),
    body('contactInfo.email').optional().isEmail().withMessage('Invalid email'),
    body('shippingOptions').optional().isArray().withMessage('Shipping options must be an array'),
    body('currency').optional().isString().isLength({ max: 3 }).withMessage('Currency must be a valid ISO 4217 code (e.g., USD)'),
    body('tax').optional().isObject().withMessage('Tax must be an object'),
    body('loyalty').optional().isObject().withMessage('Loyalty program must be an object'),
    body('policies').optional().isObject().withMessage('Policies must be an object')
  ],

  update: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters'),
    body('branding').optional().isObject().withMessage('Branding must be an object'),
    body('seo').optional().isObject().withMessage('SEO must be an object'),
    body('paymentMethods').optional().isArray().withMessage('Payment methods must be an array'),
    body('contactInfo').optional().isObject().withMessage('Contact info must be an object'),
    body('shippingOptions').optional().isArray().withMessage('Shipping options must be an array'),
    body('currency').optional().isString().isLength({ max: 3 }).withMessage('Currency must be a valid ISO 4217 code'),
    body('tax').optional().isObject().withMessage('Tax must be an object'),
    body('loyalty').optional().isObject().withMessage('Loyalty program must be an object'),
    body('policies').optional().isObject().withMessage('Policies must be an object')
  ],

  sectionUpdate: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters'),
    body().isObject().withMessage('Update body must be an object')
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'siteKey']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc')
  ],

  paymentMethod: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters'),
    body('method').isIn(['credit_card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method')
  ],

  featureToggle: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters'),
    body('feature').isString().withMessage('Feature must be a string').isLength({ max: 50 }).withMessage('Feature cannot exceed 50 characters'),
    body('enabled').isBoolean().withMessage('Enabled must be a boolean')
  ],

  reset: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters')
  ],

  section: [
    param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters'),
    param('section').isString().withMessage('Section must be a string').isIn(['branding', 'seo', 'paymentMethods', 'contactInfo', 'shippingOptions', 'emailTemplates', 'analytics', 'currency', 'tax', 'loyalty', 'policies', 'featuredCategories', 'orderLimits']).withMessage('Invalid section')
  ]
};

// ========================================
// 📋 CORE CRUD OPERATIONS
// ========================================

// POST /api/setting - Create new settings for a site/app
settingRoute.post('/', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.create,
  settingsCtrl.createSettings
);

// GET /api/setting - List all settings (all sites/apps)
settingRoute.get('/', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  settingsValidation.query,
  settingsCtrl.listAllSettings
);

// GET /api/setting/:siteKey - Get settings for a specific site/app
settingRoute.get('/:siteKey', 
  authMiddleware,
  param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters'),
  settingsCtrl.getSettingsBySite
);

// PUT /api/setting/:siteKey - Update settings for a specific site/app
settingRoute.put('/:siteKey', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.update,
  settingsCtrl.updateSettingsBySite
);

// DELETE /api/setting/:siteKey - Delete settings for a specific site/app
settingRoute.delete('/:siteKey', 
  authMiddleware,
  roleMiddleware(['admin']),
  param('siteKey').isString().withMessage('Site key must be a string').isLength({ min: 1, max: 50 }).withMessage('Site key must be between 1 and 50 characters'),
  settingsCtrl.deleteSettingsBySite
);

// ========================================
// 🔍 SECTION-BASED UPDATES
// ========================================

// PATCH /api/setting/:siteKey/branding - Update branding settings
settingRoute.patch('/:siteKey/branding', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('logoUrl').optional().isURL().withMessage('Logo URL must be a valid URL'),
  body('primaryColor').optional().isHexColor().withMessage('Primary color must be a valid hex color'),
  settingsCtrl.updateBranding
);

// PATCH /api/setting/:siteKey/branding/field - Update specific branding field
settingRoute.patch('/:siteKey/branding/field', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('field').isString().withMessage('Field must be a string'),
  body('value').exists().withMessage('Value is required'),
  settingsCtrl.updateBrandingField
);

// PATCH /api/setting/:siteKey/seo - Update SEO settings
settingRoute.patch('/:siteKey/seo', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('metaTitle').optional().isString().isLength({ max: 60 }).withMessage('Meta title cannot exceed 60 characters'),
  body('metaDescription').optional().isString().isLength({ max: 160 }).withMessage('Meta description cannot exceed 160 characters'),
  settingsCtrl.updateSEO
);

// PATCH /api/setting/:siteKey/payment-methods - Update payment methods
settingRoute.patch('/:siteKey/payment-methods', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('methods').isArray().withMessage('Methods must be an array'),
  body('methods.*').isIn(['credit_card', 'paypal', 'bank_transfer']).withMessage('Invalid payment method'),
  settingsCtrl.updatePaymentMethods
);

// POST /api/setting/:siteKey/payment-methods - Add payment method
settingRoute.post('/:siteKey/payment-methods', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.paymentMethod,
  settingsCtrl.addPaymentMethod
);

// DELETE /api/setting/:siteKey/payment-methods - Remove payment method
settingRoute.delete('/:siteKey/payment-methods', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.paymentMethod,
  settingsCtrl.removePaymentMethod
);

// PATCH /api/setting/:siteKey/contact-info - Update contact info
settingRoute.patch('/:siteKey/contact-info', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('phone').optional().isString().withMessage('Phone must be a string').isLength({ max: 20 }).withMessage('Phone cannot exceed 20 characters'),
  settingsCtrl.updateContactInfo
);

// PATCH /api/setting/:siteKey/shipping-options - Update shipping options
settingRoute.patch('/:siteKey/shipping-options', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('options').isArray().withMessage('Shipping options must be an array'),
  settingsCtrl.updateShippingOptions
);

// PATCH /api/setting/:siteKey/email-templates - Update email templates
settingRoute.patch('/:siteKey/email-templates', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('templates').isObject().withMessage('Templates must be an object'),
  settingsCtrl.updateEmailTemplates
);

// PATCH /api/setting/:siteKey/analytics - Update analytics settings
settingRoute.patch('/:siteKey/analytics', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('trackingId').optional().isString().withMessage('Tracking ID must be a string'),
  settingsCtrl.updateAnalytics
);

// PATCH /api/setting/:siteKey/currency-tax - Update currency and tax
settingRoute.patch('/:siteKey/currency-tax', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('currency').optional().isString().isLength({ max: 3 }).withMessage('Currency must be a valid ISO 4217 code'),
  body('tax').optional().isObject().withMessage('Tax must be an object'),
  settingsCtrl.updateCurrencyAndTax
);

// PATCH /api/setting/:siteKey/currency - Update currency
settingRoute.patch('/:siteKey/currency', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('currency').isString().isLength({ max: 3 }).withMessage('Currency must be a valid ISO 4217 code'),
  settingsCtrl.updateCurrency
);

// PATCH /api/setting/:siteKey/loyalty - Update loyalty program
settingRoute.patch('/:siteKey/loyalty', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('pointsPerDollar').optional().isFloat({ min: 0 }).withMessage('Points per dollar must be a positive number'),
  settingsCtrl.updateLoyaltyProgram
);

// PATCH /api/setting/:siteKey/loyalty/increment - Increment loyalty points
settingRoute.patch('/:siteKey/loyalty/increment', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('increment').isFloat({ min: 0 }).withMessage('Increment must be a positive number'),
  settingsCtrl.incrementLoyaltyPoints
);

// PATCH /api/setting/:siteKey/policies - Update policies
settingRoute.patch('/:siteKey/policies', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('policies').isObject().withMessage('Policies must be an object'),
  settingsCtrl.updatePolicies
);

// PATCH /api/setting/:siteKey/policy - Update specific policy
settingRoute.patch('/:siteKey/policy', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('policyType').isString().withMessage('Policy type must be a string'),
  body('content').isString().withMessage('Content must be a string').isLength({ max: 5000 }).withMessage('Content cannot exceed 5000 characters'),
  settingsCtrl.updatePolicy
);

// PATCH /api/setting/:siteKey/featured-categories - Update featured categories
settingRoute.patch('/:siteKey/featured-categories', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('categories').isArray().withMessage('Categories must be an array'),
  body('categories.*').isMongoId().withMessage('Invalid category ID'),
  settingsCtrl.updateFeaturedCategories
);

// PATCH /api/setting/:siteKey/order-limits - Update order limits
settingRoute.patch('/:siteKey/order-limits', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('maxOrderValue').optional().isFloat({ min: 0 }).withMessage('Max order value must be a positive number'),
  body('minOrderValue').optional().isFloat({ min: 0 }).withMessage('Min order value must be a positive number'),
  settingsCtrl.updateOrderLimits
);

// ========================================
// 🔄 TOGGLES & FEATURES
// ========================================

// PATCH /api/setting/:siteKey/maintenance - Toggle maintenance mode
settingRoute.patch('/:siteKey/maintenance', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  settingsCtrl.toggleMaintenanceMode
);

// PATCH /api/setting/:siteKey/maintenance-with-reason - Set maintenance mode with reason
settingRoute.patch('/:siteKey/maintenance-with-reason', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  body('reason').optional().isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  settingsCtrl.setMaintenanceMode
);

// PATCH /api/setting/:siteKey/live - Toggle live status
settingRoute.patch('/:siteKey/live', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  settingsCtrl.toggleLiveStatus
);

// PATCH /api/setting/:siteKey/feature - Toggle feature flag
settingRoute.patch('/:siteKey/feature', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.featureToggle,
  settingsCtrl.toggleFeature
);

// ========================================
// 🛠 UTILITIES
// ========================================

// GET /api/setting/:siteKey/public - Get public (safe) settings
settingRoute.get('/:siteKey/public', 
  settingsValidation.reset, // No auth required for public settings
  settingsCtrl.getPublicSettings
);

// GET /api/setting/:siteKey/section/:section - Get a specific section
settingRoute.get('/:siteKey/section/:section', 
  authMiddleware,
  settingsValidation.section,
  settingsCtrl.getSection
);

// POST /api/setting/:siteKey/reset - Reset all settings to defaults
settingRoute.post('/:siteKey/reset', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.reset,
  settingsCtrl.resetToDefaults
);

// POST /api/setting/:siteKey/reset-section - Reset a specific section to default
settingRoute.post('/:siteKey/reset-section', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.section,
  settingsCtrl.resetSection
);

// PATCH /api/setting/:siteKey/audit-update - Audit-aware generic update
settingRoute.patch('/:siteKey/audit-update', 
  authMiddleware,
  roleMiddleware(['admin']),
  settingsValidation.sectionUpdate,
  body('changes').isObject().withMessage('Changes must be an object'),
  body('auditNote').optional().isString().withMessage('Audit note must be a string').isLength({ max: 500 }).withMessage('Audit note cannot exceed 500 characters'),
  settingsCtrl.updateWithAudit
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones
  if (req.path.includes('/public') || 
      req.path.includes('/section/') || 
      req.path.includes('/reset') || 
      req.path.includes('/audit-update') || 
      req.path.includes('/branding') || 
      req.path.includes('/seo') || 
      req.path.includes('/payment-methods') || 
      req.path.includes('/contact-info') || 
      req.path.includes('/shipping-options') || 
      req.path.includes('/email-templates') || 
      req.path.includes('/analytics') || 
      req.path.includes('/currency') || 
      req.path.includes('/loyalty') || 
      req.path.includes('/policies') || 
      req.path.includes('/featured-categories') || 
      req.path.includes('/order-limits') || 
      req.path.includes('/maintenance') || 
      req.path.includes('/live') || 
      req.path.includes('/feature')) {
    return next();
  }

  next();
};

// Apply the middleware to all routes
settingRoute.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

settingRoute.get('/docs/routes', (req, res) => {
  if (enviroment !== 'development') {
    return res.status(404).json({
      success: false,
      message: 'Route documentation only available in development mode'
    });
  }

  const routes = {
    crud: [
      'POST   /api/setting                          - Create new settings for a site/app',
      'GET    /api/setting                          - List all settings (all sites/apps)',
      'GET    /api/setting/:siteKey                 - Get settings for a specific site/app',
      'PUT    /api/setting/:siteKey                 - Update settings for a specific site/app',
      'DELETE /api/setting/:siteKey                 - Delete settings for a specific site/app'
    ],
    sectionBasedUpdates: [
      'PATCH  /api/setting/:siteKey/branding        - Update branding settings',
      'PATCH  /api/setting/:siteKey/branding/field  - Update specific branding field',
      'PATCH  /api/setting/:siteKey/seo            - Update SEO settings',
      'PATCH  /api/setting/:siteKey/payment-methods - Update payment methods',
      'POST   /api/setting/:siteKey/payment-methods - Add payment method',
      'DELETE /api/setting/:siteKey/payment-methods - Remove payment method',
      'PATCH  /api/setting/:siteKey/contact-info   - Update contact info',
      'PATCH  /api/setting/:siteKey/shipping-options - Update shipping options',
      'PATCH  /api/setting/:siteKey/email-templates - Update email templates',
      'PATCH  /api/setting/:siteKey/analytics      - Update analytics settings',
      'PATCH  /api/setting/:siteKey/currency-tax   - Update currency and tax',
      'PATCH  /api/setting/:siteKey/currency       - Update currency',
      'PATCH  /api/setting/:siteKey/loyalty        - Update loyalty program',
      'PATCH  /api/setting/:siteKey/loyalty/increment - Increment loyalty points',
      'PATCH  /api/setting/:siteKey/policies       - Update policies',
      'PATCH  /api/setting/:siteKey/policy         - Update specific policy',
      'PATCH  /api/setting/:siteKey/featured-categories - Update featured categories',
      'PATCH  /api/setting/:siteKey/order-limits   - Update order limits'
    ],
    togglesFeatures: [
      'PATCH  /api/setting/:siteKey/maintenance    - Toggle maintenance mode',
      'PATCH  /api/setting/:siteKey/maintenance-with-reason - Set maintenance mode with reason',
      'PATCH  /api/setting/:siteKey/live           - Toggle live status',
      'PATCH  /api/setting/:siteKey/feature        - Toggle feature flag'
    ],
    utilities: [
      'GET    /api/setting/:siteKey/public         - Get public (safe) settings',
      'GET    /api/setting/:siteKey/section/:section - Get a specific section',
      'POST   /api/setting/:siteKey/reset          - Reset all settings to defaults',
      'POST   /api/setting/:siteKey/reset-section  - Reset a specific section to default',
      'PATCH  /api/setting/:siteKey/audit-update   - Audit-aware generic update'
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
});

module.exports = settingRoute;