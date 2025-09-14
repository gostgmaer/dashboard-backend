const express = require('express');
const BrandRoute = express.Router();
const {
  createBrand,
  getBrand,
  updateBrand,
  deleteBrand,
  getActiveBrands,
  getFeaturedBrands,
  searchBrands,
  getTopRatedBrands,
  getBrandsByCountry,
  getBrandsByYearRange,
  getBrandsWithSocialMedia,
  getPaginatedBrands,
  bulkUpdateStatus,
  bulkFeatureToggle,
  softDeleteBrands,
  restoreBrands,
  updateDisplayOrder,
  refreshProductCounts,
  addBrandImage,
  removeBrandImage,
  updateBrandContact,
  updateBrandRating,
} = require('../controller/brands/brand');
const { body, query, param, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const  authorize  = require('../middleware/authorize'); // Assuming authorize is exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED BRAND ROUTES
 * 
 * Features:
 * ✅ Comprehensive CRUD operations for brands
 * ✅ Public routes for listing, filtering, and searching brands
 * ✅ Protected routes for brand management (create, update, delete)
 * ✅ Bulk operations for status, feature toggle, and soft deletion
 * ✅ Specialized endpoints for images, contact, ratings, and product counts
 * ✅ Permission-based access control via authorize middleware
 * ✅ Comprehensive validation schemas with sanitization
 * ✅ Rate limiting for bulk operations
 * ✅ Instance-level checks for IDOR prevention
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

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
 * Middleware to check instance-level access for brand-specific routes
 * Ensures the user has permission to access/modify the specific brand
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const brandId = req.params.id || req.params.idOrSlug;
    if (brandId && !req.user.isSuperadmin) { // Superadmin bypass in authorize
      const Brand = require('../models/Brand'); // Assumed Brand model
      const brand = await Brand.findById(brandId);
      if (!brand) {
        return res.status(404).json({ success: false, message: 'Brand not found' });
      }
      if (brand.userId.toString() !== req.user.id) { // Restrict to own brands
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s brand' });
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

const brandValidation = {
  create: [
    body('name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters').trim().escape(),
    body('slug').isString().withMessage('Slug must be a string').isLength({ min: 1, max: 100 }).withMessage('Slug must be between 1 and 100 characters').trim().escape(),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters').trim().escape(),
    body('country').optional().isString().withMessage('Country must be a string').isLength({ max: 100 }).withMessage('Country cannot exceed 100 characters').trim().escape(),
    body('foundedYear').optional().isInt({ min: 1800, max: new Date().getFullYear() }).withMessage(`Founded year must be between 1800 and ${new Date().getFullYear()}`).toInt(),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
    body('image').optional().isURL().withMessage('Image must be a valid URL').trim(),
    body('socialMedia').optional().isObject().withMessage('Social media must be an object'),
    body('socialMedia.*').optional().isURL().withMessage('Social media links must be valid URLs').trim(),
    body('contact').optional().isObject().withMessage('Contact must be an object'),
    body('contact.email').optional().isEmail().withMessage('Contact email must be valid').normalizeEmail(),
    body('contact.phone').optional().isString().withMessage('Contact phone must be a string').isLength({ max: 20 }).withMessage('Contact phone cannot exceed 20 characters').trim().escape(),
   
    validate
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid brand ID'),
    body('name').optional().isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters').trim().escape(),
    body('slug').optional().isString().withMessage('Slug must be a string').isLength({ min: 1, max: 100 }).withMessage('Slug must be between 1 and 100 characters').trim().escape(),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters').trim().escape(),
    body('country').optional().isString().withMessage('Country must be a string').isLength({ max: 100 }).withMessage('Country cannot exceed 100 characters').trim().escape(),
    body('foundedYear').optional().isInt({ min: 1800, max: new Date().getFullYear() }).withMessage(`Founded year must be between 1800 and ${new Date().getFullYear()}`).toInt(),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
    body('image').optional().isURL().withMessage('Image must be a valid URL').trim(),
    body('socialMedia').optional().isObject().withMessage('Social media must be an object'),
    body('socialMedia.*').optional().isURL().withMessage('Social media links must be valid URLs').trim(),
    body('contact').optional().isObject().withMessage('Contact must be an object'),
    body('contact.email').optional().isEmail().withMessage('Contact email must be valid').normalizeEmail(),
    body('contact.phone').optional().isString().withMessage('Contact phone must be a string').isLength({ max: 20 }).withMessage('Contact phone cannot exceed 20 characters').trim().escape(),
    validate
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'name', 'rating']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('search').optional().isString().withMessage('Search must be a string').isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters').trim().escape(),
    validate
  ],

  search: [
    query('keyword').isString().withMessage('Keyword must be a string').isLength({ min: 1, max: 100 }).withMessage('Keyword must be between 1 and 100 characters').trim().escape(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    validate
  ],

  bulkStatus: [
    body('brandIds').isArray({ min: 1 }).withMessage('Brand IDs array is required'),
    body('brandIds.*').isMongoId().withMessage('Invalid brand ID in array'),
    body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
  ],

  bulkFeature: [
    body('brandIds').isArray({ min: 1 }).withMessage('Brand IDs array is required'),
    body('brandIds.*').isMongoId().withMessage('Invalid brand ID in array'),
    body('isFeatured').isBoolean().withMessage('isFeatured must be a boolean'),
    validate
  ],

  softDelete: [
    body('brandIds').isArray({ min: 1 }).withMessage('Brand IDs array is required'),
    body('brandIds.*').isMongoId().withMessage('Invalid brand ID in array'),
    validate
  ],

  restore: [
    body('brandIds').isArray({ min: 1 }).withMessage('Brand IDs array is required'),
    body('brandIds.*').isMongoId().withMessage('Invalid brand ID in array'),
    validate
  ],

  displayOrder: [
    body('brandIds').isArray({ min: 1 }).withMessage('Brand IDs array is required'),
    body('brandIds.*').isMongoId().withMessage('Invalid brand ID in array'),
    body('order').isArray({ min: 1 }).withMessage('Order array is required'),
    body('order.*').isInt({ min: 0 }).withMessage('Order values must be non-negative integers').toInt(),
    validate
  ],

  image: [
    param('id').isMongoId().withMessage('Invalid brand ID'),
    body('image').isURL().withMessage('Image must be a valid URL').trim(),
    validate
  ],

  contact: [
    param('id').isMongoId().withMessage('Invalid brand ID'),
    body('contact').optional().isObject().withMessage('Contact must be an object'),
    body('contact.email').optional().isEmail().withMessage('Contact email must be valid').normalizeEmail(),
    body('contact.phone').optional().isString().withMessage('Contact phone must be a string').isLength({ max: 20 }).withMessage('Contact phone cannot exceed 20 characters').trim().escape(),
    validate
  ],

  rating: [
    param('id').isMongoId().withMessage('Invalid brand ID'),
    body('rating').isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5').toFloat(),
    validate
  ],

  country: [
    param('country').isString().withMessage('Country must be a string').isLength({ min: 1, max: 100 }).withMessage('Country must be between 1 and 100 characters').trim().escape(),
    validate
  ],

  yearRange: [
    query('startYear').optional().isInt({ min: 1800, max: new Date().getFullYear() }).withMessage(`Start year must be between 1800 and ${new Date().getFullYear()}`).toInt(),
    query('endYear').optional().isInt({ min: 1800, max: new Date().getFullYear() }).withMessage(`End year must be between 1800 and ${new Date().getFullYear()}`).toInt(),
    validate
  ],

  idOrSlug: [
    param('idOrSlug').isString().withMessage('ID or slug must be a string').trim().escape(),
    validate
  ]
};

// ========================================
// 📋 PUBLIC ROUTES
// ========================================

// GET /api/brands - Get paginated brands
BrandRoute.get('/', 
  authorize('brands', 'read'),
  brandValidation.query,
  getPaginatedBrands
);

// GET /api/brands/active - Get active brands
BrandRoute.get('/active', 
  authorize('brands', 'read'),
  brandValidation.query,
  getActiveBrands
);

// GET /api/brands/featured - Get featured brands
BrandRoute.get('/featured', 
  authorize('brands', 'read'),
  brandValidation.query,
  getFeaturedBrands
);

// GET /api/brands/search - Search brands by keyword
BrandRoute.get('/search', 
  authorize('brands', 'read'),
  brandValidation.search,
  searchBrands
);

// GET /api/brands/top-rated - Get top-rated brands
BrandRoute.get('/top-rated', 
  authorize('brands', 'read'),
  brandValidation.query,
  getTopRatedBrands
);

// GET /api/brands/country/:country - Get brands by country
BrandRoute.get('/country/:country', 
  authorize('brands', 'read'),
  brandValidation.country,
  brandValidation.query,
  getBrandsByCountry
);

// GET /api/brands/year-range - Get brands by year range
BrandRoute.get('/year-range', 
  authorize('brands', 'read'),
  brandValidation.yearRange,
  brandValidation.query,
  getBrandsByYearRange
);

// GET /api/brands/social-media - Get brands with social media
BrandRoute.get('/social-media', 
  authorize('brands', 'read'),
  brandValidation.query,
  getBrandsWithSocialMedia
);

// GET /api/brands/:idOrSlug - Get a single brand by ID or slug
BrandRoute.get('/:idOrSlug', 
  authorize('brands', 'read'),
  instanceCheckMiddleware,
  brandValidation.idOrSlug,
  getBrand
);

// ========================================
// 🔒 PROTECTED ROUTES (ADMIN)
// ========================================

// POST /api/brands - Create a new brand
BrandRoute.post('/', 
  authMiddleware,
  authorize('brands', 'write'),
  brandValidation.create,
  createBrand
);

// PUT /api/brands/:id - Update a brand
BrandRoute.put('/:id', 
  authMiddleware,
  authorize('brands', 'update'),
  instanceCheckMiddleware,
  brandValidation.update,
  updateBrand
);

// DELETE /api/brands/:id - Hard delete a brand
BrandRoute.delete('/:id', 
  authMiddleware,
  authorize('brands', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid brand ID'),
  validate,
  deleteBrand
);

// POST /api/brands/bulk-status - Bulk update status
BrandRoute.post('/bulk-status', 
  authMiddleware,
  authorize('brands', 'update'),
  bulkOperationLimiter,
  brandValidation.bulkStatus,
  bulkUpdateStatus
);

// POST /api/brands/bulk-feature - Bulk feature/unfeature
BrandRoute.post('/bulk-feature', 
  authMiddleware,
  authorize('brands', 'update'),
  bulkOperationLimiter,
  brandValidation.bulkFeature,
  bulkFeatureToggle
);

// POST /api/brands/soft-delete - Soft delete brands
BrandRoute.post('/soft-delete', 
  authMiddleware,
  authorize('brands', 'update'),
  bulkOperationLimiter,
  brandValidation.softDelete,
  softDeleteBrands
);

// POST /api/brands/restore - Restore soft-deleted brands
BrandRoute.post('/restore', 
  authMiddleware,
  authorize('brands', 'update'),
  bulkOperationLimiter,
  brandValidation.restore,
  restoreBrands
);

// POST /api/brands/display-order - Update display order
BrandRoute.post('/display-order', 
  authMiddleware,
  authorize('brands', 'update'),
  bulkOperationLimiter,
  brandValidation.displayOrder,
  updateDisplayOrder
);

// POST /api/brands/refresh-products - Refresh product counts
BrandRoute.post('/refresh-products', 
  authMiddleware,
  authorize('brands', 'update'),
  bulkOperationLimiter,
  refreshProductCounts
);

// POST /api/brands/:id/add-image - Add image to brand
BrandRoute.post('/:id/add-image', 
  authMiddleware,
  authorize('brands', 'write'),
  instanceCheckMiddleware,
  brandValidation.image,
  addBrandImage
);

// POST /api/brands/:id/remove-image - Remove image from brand
BrandRoute.post('/:id/remove-image', 
  authMiddleware,
  authorize('brands', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid brand ID'),
  validate,
  removeBrandImage
);

// PUT /api/brands/:id/contact - Update brand contact
BrandRoute.put('/:id/contact', 
  authMiddleware,
  authorize('brands', 'update'),
  instanceCheckMiddleware,
  brandValidation.contact,
  updateBrandContact
);

// PUT /api/brands/:id/rating - Update brand rating
BrandRoute.put('/:id/rating', 
  authMiddleware,
  authorize('brands', 'update'),
  instanceCheckMiddleware,
  brandValidation.rating,
  updateBrandRating
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  const path = req.path.toLowerCase(); // Case-insensitive matching
  if (path.startsWith('/active') || 
      path.startsWith('/featured') || 
      path.startsWith('/search') || 
      path.startsWith('/top-rated') || 
      path.startsWith('/country/') || 
      path.startsWith('/year-range') || 
      path.startsWith('/social-media') || 
      path.startsWith('/bulk-') || 
      path.startsWith('/soft-delete') || 
      path.startsWith('/restore') || 
      path.startsWith('/display-order') || 
      path.startsWith('/refresh-products')) {
    return next();
  }

  next();
};

// Apply the middleware to all routes
BrandRoute.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

BrandRoute.get('/docs/routes', 
  authMiddleware,
  authorize('brands', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      public: [
        'GET    /api/brands                          - Get paginated brands (read)',
        'GET    /api/brands/active                  - Get active brands (read)',
        'GET    /api/brands/featured                - Get featured brands (read)',
        'GET    /api/brands/search                  - Search brands by keyword (read)',
        'GET    /api/brands/top-rated               - Get top-rated brands (read)',
        'GET    /api/brands/country/:country        - Get brands by country (read)',
        'GET    /api/brands/year-range              - Get brands by year range (read)',
        'GET    /api/brands/social-media            - Get brands with social media (read)',
        'GET    /api/brands/:idOrSlug               - Get a single brand by ID or slug (read, instance check)'
      ],
      protected: [
        'POST   /api/brands                          - Create a new brand (write)',
        'PUT    /api/brands/:id                     - Update a brand (update, instance check)',
        'DELETE /api/brands/:id                     - Hard delete a brand (update, instance check)',
        'POST   /api/brands/bulk-status             - Bulk update status (update, rate-limited)',
        'POST   /api/brands/bulk-feature            - Bulk feature/unfeature (update, rate-limited)',
        'POST   /api/brands/soft-delete             - Soft delete brands (update, rate-limited)',
        'POST   /api/brands/restore                 - Restore soft-deleted brands (update, rate-limited)',
        'POST   /api/brands/display-order           - Update display order (update, rate-limited)',
        'POST   /api/brands/refresh-products        - Refresh product counts (update, rate-limited)',
        'POST   /api/brands/:id/add-image           - Add image to brand (write, instance check)',
        'POST   /api/brands/:id/remove-image        - Remove image from brand (update, instance check)',
        'PUT    /api/brands/:id/contact             - Update brand contact (update, instance check)',
        'PUT    /api/brands/:id/rating              - Update brand rating (update, instance check)'
      ],
      documentation: [
        'GET    /api/brands/docs/routes             - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Brand API routes documentation'
    });
  }
);

module.exports = BrandRoute;