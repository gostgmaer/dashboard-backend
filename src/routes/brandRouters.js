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
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
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
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const brandValidation = {
  create: [
    body('name').isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('slug').isString().withMessage('Slug must be a string').isLength({ min: 1, max: 100 }).withMessage('Slug must be between 1 and 100 characters'),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('country').optional().isString().withMessage('Country must be a string').isLength({ max: 100 }).withMessage('Country cannot exceed 100 characters'),
    body('foundedYear').optional().isInt({ min: 1800, max: new Date().getFullYear() }).withMessage(`Founded year must be between 1800 and ${new Date().getFullYear()}`),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
    body('image').optional().isURL().withMessage('Image must be a valid URL'),
    body('socialMedia').optional().isObject().withMessage('Social media must be an object'),
    body('socialMedia.*').optional().isURL().withMessage('Social media links must be valid URLs'),
    body('contact').optional().isObject().withMessage('Contact must be an object'),
    body('contact.email').optional().isEmail().withMessage('Contact email must be valid'),
    body('contact.phone').optional().isString().withMessage('Contact phone must be a string').isLength({ max: 20 }).withMessage('Contact phone cannot exceed 20 characters')
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid brand ID'),
    body('name').optional().isString().withMessage('Name must be a string').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
    body('slug').optional().isString().withMessage('Slug must be a string').isLength({ min: 1, max: 100 }).withMessage('Slug must be between 1 and 100 characters'),
    body('description').optional().isString().withMessage('Description must be a string').isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('country').optional().isString().withMessage('Country must be a string').isLength({ max: 100 }).withMessage('Country cannot exceed 100 characters'),
    body('foundedYear').optional().isInt({ min: 1800, max: new Date().getFullYear() }).withMessage(`Founded year must be between 1800 and ${new Date().getFullYear()}`),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean'),
    body('image').optional().isURL().withMessage('Image must be a valid URL'),
    body('socialMedia').optional().isObject().withMessage('Social media must be an object'),
    body('socialMedia.*').optional().isURL().withMessage('Social media links must be valid URLs'),
    body('contact').optional().isObject().withMessage('Contact must be an object'),
    body('contact.email').optional().isEmail().withMessage('Contact email must be valid'),
    body('contact.phone').optional().isString().withMessage('Contact phone must be a string').isLength({ max: 20 }).withMessage('Contact phone cannot exceed 20 characters')
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'name', 'rating']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('search').optional().isString().withMessage('Search must be a string').isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters')
  ],

  search: [
    query('keyword').isString().withMessage('Keyword must be a string').isLength({ min: 1, max: 100 }).withMessage('Keyword must be between 1 and 100 characters'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],

  bulkStatus: [
    body('brandIds').isArray({ min: 1 }).withMessage('Brand IDs array is required'),
    body('brandIds.*').isMongoId().withMessage('Invalid brand ID in array'),
    body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
  ],

  bulkFeature: [
    body('brandIds').isArray({ min: 1 }).withMessage('Brand IDs array is required'),
    body('brandIds.*').isMongoId().withMessage('Invalid brand ID in array'),
    body('isFeatured').isBoolean().withMessage('isFeatured must be a boolean')
  ],

  softDelete: [
    body('brandIds').isArray({ min: 1 }).withMessage('Brand IDs array is required'),
    body('brandIds.*').isMongoId().withMessage('Invalid brand ID in array')
  ],

  restore: [
    body('brandIds').isArray({ min: 1 }).withMessage('Brand IDs array is required'),
    body('brandIds.*').isMongoId().withMessage('Invalid brand ID in array')
  ],

  displayOrder: [
    body('brandIds').isArray({ min: 1 }).withMessage('Brand IDs array is required'),
    body('brandIds.*').isMongoId().withMessage('Invalid brand ID in array'),
    body('order').isArray({ min: 1 }).withMessage('Order array is required'),
    body('order.*').isInt({ min: 0 }).withMessage('Order values must be non-negative integers')
  ],

  image: [
    param('id').isMongoId().withMessage('Invalid brand ID'),
    body('image').isURL().withMessage('Image must be a valid URL')
  ],

  contact: [
    param('id').isMongoId().withMessage('Invalid brand ID'),
    body('contact').isObject().withMessage('Contact must be an object'),
    body('contact.email').optional().isEmail().withMessage('Contact email must be valid'),
    body('contact.phone').optional().isString().withMessage('Contact phone must be a string').isLength({ max: 20 }).withMessage('Contact phone cannot exceed 20 characters')
  ],

  rating: [
    param('id').isMongoId().withMessage('Invalid brand ID'),
    body('rating').isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5')
  ],

  country: [
    param('country').isString().withMessage('Country must be a string').isLength({ max: 100 }).withMessage('Country cannot exceed 100 characters')
  ],

  yearRange: [
    query('startYear').optional().isInt({ min: 1800, max: new Date().getFullYear() }).withMessage(`Start year must be between 1800 and ${new Date().getFullYear()}`),
    query('endYear').optional().isInt({ min: 1800, max: new Date().getFullYear() }).withMessage(`End year must be between 1800 and ${new Date().getFullYear()}`)
  ]
};

// ========================================
// 🌍 PUBLIC ROUTES
// ========================================

// GET /api/brands - Get paginated brands
BrandRoute.get('/', 
  brandValidation.query,
  getPaginatedBrands
);

// GET /api/brands/active - Get active brands
BrandRoute.get('/active', 
  brandValidation.query,
  getActiveBrands
);

// GET /api/brands/featured - Get featured brands
BrandRoute.get('/featured', 
  brandValidation.query,
  getFeaturedBrands
);

// GET /api/brands/search - Search brands by keyword
BrandRoute.get('/search', 
  brandValidation.search,
  searchBrands
);

// GET /api/brands/top-rated - Get top-rated brands
BrandRoute.get('/top-rated', 
  brandValidation.query,
  getTopRatedBrands
);

// GET /api/brands/country/:country - Get brands by country
BrandRoute.get('/country/:country', 
  brandValidation.country,
  brandValidation.query,
  getBrandsByCountry
);

// GET /api/brands/year-range - Get brands by year range
BrandRoute.get('/year-range', 
  brandValidation.yearRange,
  brandValidation.query,
  getBrandsByYearRange
);

// GET /api/brands/social-media - Get brands with social media
BrandRoute.get('/social-media', 
  brandValidation.query,
  getBrandsWithSocialMedia
);

// GET /api/brands/:idOrSlug - Get a single brand by ID or slug
BrandRoute.get('/:idOrSlug', 
  param('idOrSlug').isString().withMessage('ID or slug must be a string'),
  getBrand
);

// ========================================
// 🔒 PROTECTED ROUTES (ADMIN)
// ========================================

// POST /api/brands - Create a new brand
BrandRoute.post('/', 
  authMiddleware,
  roleMiddleware(['admin']),
  brandValidation.create,
  createBrand
);

// PUT /api/brands/:id - Update a brand
BrandRoute.put('/:id', 
  authMiddleware,
  roleMiddleware(['admin']),
  brandValidation.update,
  updateBrand
);

// DELETE /api/brands/:id - Hard delete a brand
BrandRoute.delete('/:id', 
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid brand ID'),
  deleteBrand
);

// POST /api/brands/bulk-status - Bulk update status
BrandRoute.post('/bulk-status', 
  authMiddleware,
  roleMiddleware(['admin']),
  brandValidation.bulkStatus,
  bulkUpdateStatus
);

// POST /api/brands/bulk-feature - Bulk feature/unfeature
BrandRoute.post('/bulk-feature', 
  authMiddleware,
  roleMiddleware(['admin']),
  brandValidation.bulkFeature,
  bulkFeatureToggle
);

// POST /api/brands/soft-delete - Soft delete brands
BrandRoute.post('/soft-delete', 
  authMiddleware,
  roleMiddleware(['admin']),
  brandValidation.softDelete,
  softDeleteBrands
);

// POST /api/brands/restore - Restore soft-deleted brands
BrandRoute.post('/restore', 
  authMiddleware,
  roleMiddleware(['admin']),
  brandValidation.restore,
  restoreBrands
);

// POST /api/brands/display-order - Update display order
BrandRoute.post('/display-order', 
  authMiddleware,
  roleMiddleware(['admin']),
  brandValidation.displayOrder,
  updateDisplayOrder
);

// POST /api/brands/refresh-products - Refresh product counts
BrandRoute.post('/refresh-products', 
  authMiddleware,
  roleMiddleware(['admin']),
  refreshProductCounts
);

// POST /api/brands/:id/add-image - Add image to brand
BrandRoute.post('/:id/add-image', 
  authMiddleware,
  roleMiddleware(['admin']),
  brandValidation.image,
  addBrandImage
);

// POST /api/brands/:id/remove-image - Remove image from brand
BrandRoute.post('/:id/remove-image', 
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid brand ID'),
  removeBrandImage
);

// PUT /api/brands/:id/contact - Update brand contact
BrandRoute.put('/:id/contact', 
  authMiddleware,
  roleMiddleware(['admin']),
  brandValidation.contact,
  updateBrandContact
);

// PUT /api/brands/:id/rating - Update brand rating
BrandRoute.put('/:id/rating', 
  authMiddleware,
  roleMiddleware(['admin']),
  brandValidation.rating,
  updateBrandRating
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones
  if (req.path.startsWith('/active') || 
      req.path.startsWith('/featured') || 
      req.path.startsWith('/search') || 
      req.path.startsWith('/top-rated') || 
      req.path.startsWith('/country/') || 
      req.path.startsWith('/year-range') || 
      req.path.startsWith('/social-media') || 
      req.path.startsWith('/bulk-') || 
      req.path.startsWith('/soft-delete') || 
      req.path.startsWith('/restore') || 
      req.path.startsWith('/display-order') || 
      req.path.startsWith('/refresh-products')) {
    return next();
  }

  next();
};

// Apply the middleware to all routes
BrandRoute.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

BrandRoute.get('/docs/routes', (req, res) => {
  if (enviroment !== 'development') {
    return res.status(404).json({
      success: false,
      message: 'Route documentation only available in development mode'
    });
  }

  const routes = {
    public: [
      'GET    /api/brands                          - Get paginated brands',
      'GET    /api/brands/active                  - Get active brands',
      'GET    /api/brands/featured                - Get featured brands',
      'GET    /api/brands/search                  - Search brands by keyword',
      'GET    /api/brands/top-rated               - Get top-rated brands',
      'GET    /api/brands/country/:country        - Get brands by country',
      'GET    /api/brands/year-range              - Get brands by year range',
      'GET    /api/brands/social-media            - Get brands with social media',
      'GET    /api/brands/:idOrSlug               - Get a single brand by ID or slug'
    ],
    protected: [
      'POST   /api/brands                          - Create a new brand',
      'PUT    /api/brands/:id                     - Update a brand',
      'DELETE /api/brands/:id                     - Hard delete a brand',
      'POST   /api/brands/bulk-status             - Bulk update status',
      'POST   /api/brands/bulk-feature            - Bulk feature/unfeature',
      'POST   /api/brands/soft-delete             - Soft delete brands',
      'POST   /api/brands/restore                 - Restore soft-deleted brands',
      'POST   /api/brands/display-order           - Update display order',
      'POST   /api/brands/refresh-products        - Refresh product counts',
      'POST   /api/brands/:id/add-image           - Add image to brand',
      'POST   /api/brands/:id/remove-image        - Remove image from brand',
      'PUT    /api/brands/:id/contact             - Update brand contact',
      'PUT    /api/brands/:id/rating              - Update brand rating'
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
});

module.exports = BrandRoute;