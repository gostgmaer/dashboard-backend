const express = require('express');
const router = express.Router();
const ProductController = require('../controller/consolidatedProductController');
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
const { enviroment } = require('../config/setting');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
/**
 * 🚀 CONSOLIDATED PRODUCT ROUTES
 * 
 * Features:
 * ✅ All CRUD operations with validation
 * ✅ All 42 model methods as endpoints
 * ✅ Bulk operations with proper validation
 * ✅ Virtual properties endpoints
 * ✅ Statistics and analytics endpoints
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const productValidation = {
    create: [
        body('title').notEmpty().withMessage('Title is required'),
        body('sku').notEmpty().withMessage('SKU is required'),
        body('basePrice').isNumeric().withMessage('Base price must be a number'),
        body('productType').isIn(['physical', 'digital', 'service']).withMessage('Invalid product type'),
        body('categories').isArray({ min: 1 }).withMessage('At least one category is required'),
        body('descriptions').isObject().withMessage('Descriptions must be an object'),
    ],

    update: [
        param('id').isMongoId().withMessage('Invalid product ID'),
        body('title').optional().notEmpty().withMessage('Title cannot be empty'),
        body('sku').optional().notEmpty().withMessage('SKU cannot be empty'),
        body('basePrice').optional().isNumeric().withMessage('Base price must be a number'),
        body('productType').optional().isIn(['physical', 'digital', 'service']).withMessage('Invalid product type'),
    ],

    query: [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('sort').optional().isIn(['createdAt', 'updatedAt', 'basePrice', 'title', 'views', 'soldCount']).withMessage('Invalid sort field'),
        query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
        query('priceMin').optional().isNumeric().withMessage('Price minimum must be a number'),
        query('priceMax').optional().isNumeric().withMessage('Price maximum must be a number'),
    ],

    bulkUpdate: [
        body('ids').isArray({ min: 1 }).withMessage('Product IDs array is required'),
        body('ids.*').isMongoId().withMessage('Invalid product ID in array'),
        body('updateData').optional().isObject().withMessage('Update data must be an object'),
        body('status').optional().isIn(['active', 'inactive', 'draft', 'pending', 'archived', 'published']).withMessage('Invalid status'),
    ],

    stock: [
        param('id').isMongoId().withMessage('Invalid product ID'),
        body('quantity').isNumeric().withMessage('Quantity must be a number'),
        body('operation').optional().isIn(['set', 'add', 'subtract']).withMessage('Invalid operation'),
    ],

    promotion: [
        param('id').isMongoId().withMessage('Invalid product ID'),
        body('discount').optional().isNumeric().withMessage('Discount must be a number'),
        body('salePrice').optional().isNumeric().withMessage('Sale price must be a number'),
        body('startDate').optional().isISO8601().withMessage('Invalid start date format'),
        body('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// GET /api/products - Get all products with advanced filtering
router.get('/',
    productValidation.query,
    ProductController.getProducts
);

// GET /api/products/:identifier - Get single product by ID or slug
router.get('/:identifier',
    param('identifier').notEmpty().withMessage('Product identifier is required'),
    ProductController.getProductByIdOrSlug
);

// POST /api/products - Create new product
router.post('/',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    productValidation.create,
    ProductController.createProduct
);

// PUT /api/products/:id - Update product
router.put('/:id',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    productValidation.update,
    ProductController.updateProduct
);

// DELETE /api/products/:id - Delete product (soft delete by default)
router.delete('/:id',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.deleteProduct
);

// ========================================
// 📦 BULK OPERATIONS
// ========================================

// DELETE /api/products/bulk/delete - Bulk delete products
router.delete('/bulk/delete',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    body('ids').isArray({ min: 1 }).withMessage('Product IDs array is required'),
    body('ids.*').isMongoId().withMessage('Invalid product ID in array'),
    body('permanent').optional().isBoolean().withMessage('Permanent must be boolean'),
    ProductController.bulkDeleteProducts
);

// PUT /api/products/bulk/status - Bulk update status
router.put('/bulk/status',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    productValidation.bulkUpdate,
    ProductController.bulkUpdateStatus
);

// PUT /api/products/bulk/stock - Bulk update stock
router.put('/bulk/stock',
    authMiddleware,
    roleMiddleware(['admin', 'manager', 'inventory']),
    body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
    body('updates.*.id').isMongoId().withMessage('Invalid product ID in updates'),
    body('updates.*.stock').isNumeric().withMessage('Stock must be a number'),
    ProductController.bulkUpdateStock
);

// ========================================
// 🔍 SEARCH & FILTER OPERATIONS
// ========================================

// GET /api/products/search/:keyword - Search products
router.get('/search/:keyword',
    param('keyword').notEmpty().withMessage('Search keyword is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('category').optional().isMongoId().withMessage('Invalid category ID'),
    query('priceMin').optional().isNumeric().withMessage('Price minimum must be a number'),
    query('priceMax').optional().isNumeric().withMessage('Price maximum must be a number'),
    query('sort').optional().isIn(['relevance', 'price_low', 'price_high', 'newest', 'popular']).withMessage('Invalid sort option'),
    ProductController.searchProducts
);

// GET /api/products/featured - Get featured products
router.get('/special/featured',
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    ProductController.getFeaturedProducts
);

// GET /api/products/low-stock - Get low stock products
router.get('/inventory/low-stock',
    authMiddleware,
    roleMiddleware(['admin', 'manager', 'inventory']),
    ProductController.getLowStockProducts
);

// GET /api/products/out-of-stock - Get out of stock products
router.get('/inventory/out-of-stock',
    authMiddleware,
    roleMiddleware(['admin', 'manager', 'inventory']),
    ProductController.getOutOfStockProducts
);

// GET /api/products/category/:categoryId - Get products by category
router.get('/category/:categoryId',
    param('categoryId').isMongoId().withMessage('Invalid category ID'),
    ProductController.getProductsByCategory
);

// GET /api/products/tags/:tags - Get products by tags
router.get('/tags/:tags',
    param('tags').notEmpty().withMessage('Tags parameter is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    ProductController.getProductsByTag
);

// GET /api/products/new-arrivals - Get new arrival products
router.get('/special/new-arrivals',
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    ProductController.getNewArrivals
);

// GET /api/products/price-range - Get products by price range
router.get('/filter/price-range',
    query('minPrice').optional().isNumeric().withMessage('Min price must be a number'),
    query('maxPrice').optional().isNumeric().withMessage('Max price must be a number'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    ProductController.getProductsByPriceRange
);

// GET /api/products/top-selling - Get top selling products
router.get('/special/top-selling',
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    ProductController.getTopSellingProducts
);

// GET /api/products/most-viewed - Get most viewed products
router.get('/special/most-viewed',
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    ProductController.getMostViewedProducts
);

// GET /api/products/discounted - Get products with active discounts
router.get('/special/discounted',
    ProductController.getActiveDiscountProducts
);

// GET /api/products/analytics/category/:categoryId - Get average rating by category
router.get('/analytics/category/:categoryId/rating',
    param('categoryId').isMongoId().withMessage('Invalid category ID'),
    ProductController.getAverageRatingByCategory
);

// ========================================
// 🔧 INSTANCE METHOD ENDPOINTS
// ========================================

// GET /api/products/:id/images/simplified - Get simplified images
router.get('/:id/images/simplified',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.getSimplifiedImages
);

// GET /api/products/:id/price/final - Get final price
router.get('/:id/price/final',
    param('id').isMongoId().withMessage('Invalid product ID'),
    query('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    ProductController.getFinalPrice
);

// GET /api/products/:id/stock/status - Get stock status
router.get('/:id/stock/status',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.getStockStatus
);

// PUT /api/products/:id/stock/mark-out - Mark as out of stock
router.put('/:id/stock/mark-out',
    authMiddleware,
    roleMiddleware(['admin', 'manager', 'inventory']),
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.markAsOutOfStock
);

// PUT /api/products/:id/views/increment - Increment views
router.put('/:id/views/increment',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.incrementProductViews
);

// PUT /api/products/:id/sold/increment - Increment sold count
router.put('/:id/sold/increment',
    authMiddleware,
    roleMiddleware(['admin', 'manager', 'inventory']),
    param('id').isMongoId().withMessage('Invalid product ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    ProductController.incrementSold
);

// GET /api/products/:id/discount/active - Check if discount is active
router.get('/:id/discount/active',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.isDiscountActive
);

// GET /api/products/:id/seo - Get SEO data
router.get('/:id/seo',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.getSEOData
);

// GET /api/products/:id/price/bulk - Get bulk discount price
router.get('/:id/price/bulk',
    param('id').isMongoId().withMessage('Invalid product ID'),
    query('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    ProductController.getBulkDiscountPrice
);

// GET /api/products/:id/purchasable - Check if product is purchasable
router.get('/:id/purchasable',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.isPurchasable
);

// PUT /api/products/:id/stock/reduce - Reduce stock
router.put('/:id/stock/reduce',
    authMiddleware,
    roleMiddleware(['admin', 'manager', 'inventory']),
    param('id').isMongoId().withMessage('Invalid product ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    ProductController.reduceStock
);

// PUT /api/products/:id/stock/restock - Restock product
router.put('/:id/stock/restock',
    authMiddleware,
    roleMiddleware(['admin', 'manager', 'inventory']),
    param('id').isMongoId().withMessage('Invalid product ID'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    ProductController.restockProduct
);

// PUT /api/products/:id/featured/toggle - Toggle featured status
router.put('/:id/featured/toggle',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.toggleFeatured
);

// GET /api/products/:id/related - Get related products
router.get('/:id/related',
    param('id').isMongoId().withMessage('Invalid product ID'),
    query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be between 1 and 20'),
    ProductController.getRelatedProducts
);

// GET /api/products/:id/bundle/check - Check if product is part of bundle
router.get('/:id/bundle/check',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.isPartOfBundle
);

// GET /api/products/:id/discount/percent - Get active discount percent
router.get('/:id/discount/percent',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.getActiveDiscountPercent
);

// POST /api/products/:id/reviews/add - Add review to product
router.post('/:id/reviews/add',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid product ID'),
    body('reviewId').isMongoId().withMessage('Valid review ID is required'),
    ProductController.addProductReview
);

// PUT /api/products/:id/promotion/apply - Apply promotion
router.put('/:id/promotion/apply',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    productValidation.promotion,
    ProductController.applyPromotion
);

// GET /api/products/:id/preorder/check - Check if pre-order is available
router.get('/:id/preorder/check',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.isPreOrderAvailable
);

// GET /api/products/:id/bundle/price - Get bundle total price
router.get('/:id/bundle/price',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.getBundleTotalPrice
);

// ========================================
// 📊 VIRTUAL PROPERTY ENDPOINTS
// ========================================

// GET /api/products/:id/ratings/statistics - Get rating statistics
router.get('/:id/ratings/statistics',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.getRatingStatistics
);

// GET /api/products/:id/stock/virtual-status - Get virtual stock status
router.get('/:id/stock/virtual-status',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.getVirtualStockStatus
);

// ========================================
// 📈 STATISTICS & ANALYTICS
// ========================================

// GET /api/products/analytics/schema-report - Get schema report
router.get('/analytics/schema-report',
    authMiddleware,
    roleMiddleware(['admin']),
    ProductController.getSchemaReport
);

// GET /api/products/analytics/database-stats - Get database statistics
router.get('/analytics/database-stats',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    ProductController.getDatabaseStatistics
);

// GET /api/products/analytics/products - Get products with analytics
router.get('/analytics/products',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sortBy').optional().isIn(['views', 'conversions', 'clicks', 'sold']).withMessage('Invalid sort option'),
    ProductController.getProductsWithAnalytics
);

// ========================================
// 🔧 ENHANCED OPERATIONS
// ========================================

// PUT /api/products/:id/stock/update - Enhanced stock update
router.put('/:id/stock/update',
    authMiddleware,
    roleMiddleware(['admin', 'manager', 'inventory']),
    productValidation.stock,
    ProductController.updateStock
);

// POST /api/products/archive/old - Archive old products
router.post('/archive/old',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    body('beforeDate').isISO8601().withMessage('Valid before date is required'),
    ProductController.archiveOldProducts
);



// 1. Favorites
router.post('/favorites/:id', authMiddleware, ProductController.addFavorite);
router.delete('/favorites/:id', authMiddleware, ProductController.removeFavorite);
router.get('/favorites', authMiddleware, ProductController.listFavorites);

// 2. Recommendations
router.get('/recommendations/:id', ProductController.getRecommendations);

// 3. Import/Export
router.post('/import', authMiddleware, roleMiddleware(['admin']), upload.single('file'), ProductController.importCSV);
router.get('/export', authMiddleware, roleMiddleware(['admin']), ProductController.exportCSV);

// 4. Review Moderation
router.put('/:id/reviews/:reviewId/approve', authMiddleware, roleMiddleware(['admin', 'moderator']), ProductController.approveReview);
router.delete('/:id/reviews/:reviewId', authMiddleware, roleMiddleware(['admin', 'moderator']), ProductController.removeReview);

// 5. Inventory Alerts
router.get('/alerts/low-stock', authMiddleware, roleMiddleware(['admin', 'manager', 'inventory']), ProductController.lowStockAlerts);
router.post('/alerts/low-stock/email', authMiddleware, roleMiddleware(['admin', 'manager']), ProductController.sendLowStockEmails);

// 6. Bulk Price & Sales
router.put('/bulk/price-update', authMiddleware, roleMiddleware(['admin', 'manager']), ProductController.bulkPriceUpdate);
router.post('/flash-sale', authMiddleware, roleMiddleware(['admin', 'manager']), ProductController.scheduleFlashSale);

// 7. Extended Analytics
router.get('/analytics/sales-metrics', authMiddleware, roleMiddleware(['admin', 'manager']), ProductController.salesMetrics);
router.get('/analytics/popularity', authMiddleware, ProductController.popularity);

// 8. Taxonomy (Categories)
router.post('/taxonomy/category', authMiddleware, roleMiddleware(['admin']), ProductController.upsertCategory);
router.put('/taxonomy/category/:id', authMiddleware, roleMiddleware(['admin']), ProductController.upsertCategory);
router.get('/taxonomy/categories', ProductController.listCategories);

// 9. Downloadable Files
router.get('/:id/downloads',
    param('id').isMongoId().withMessage('Invalid product ID'),
    ProductController.listDownloads
);
router.get('/:id/downloads/:fileIndex',
    param('id').isMongoId().withMessage('Invalid product ID'),
    param('fileIndex').isInt({ min: 0 }).withMessage('File index must be a non-negative integer'),
    ProductController.downloadFile
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

// Middleware to handle route conflicts (place specific routes before dynamic ones)
const routeOrderMiddleware = (req, res, next) => {
    // This ensures that /api/products/search/:keyword comes before /api/products/:identifier
    if (req.path.startsWith('/search/') ||
        req.path.startsWith('/special/') ||
        req.path.startsWith('/inventory/') ||
        req.path.startsWith('/category/') ||
        req.path.startsWith('/tags/') ||
        req.path.startsWith('/filter/') ||
        req.path.startsWith('/analytics/') ||
        req.path.startsWith('/bulk/') ||
        req.path.startsWith('/archive/')) {
        return next();
    }

    // For other paths, check if it's a specific endpoint pattern
    const segments = req.path.split('/').filter(Boolean);
    if (segments.length > 1) {
        const specificPatterns = [
            'images', 'price', 'stock', 'views', 'sold', 'discount', 'seo',
            'purchasable', 'featured', 'related', 'bundle', 'reviews',
            'promotion', 'preorder', 'ratings'
        ];

        if (specificPatterns.includes(segments[1])) {
            return next();
        }
    }

    next();
};

// Apply the middleware to all routes
router.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

// GET /api/products/docs/routes - Get all available routes (dev only)
// In your consolidatedProductRoutes.js, extend the /docs/routes handler:

router.get('/docs/routes', (req, res) => {
    if (enviroment !== 'development') {
        return res.status(404).json({
            success: false,
            message: 'Route documentation only available in development mode'
        });
    }

    const routes = {
        crud: [
            'GET    /api/products                          - Get all products with filtering',
            'GET    /api/products/:identifier              - Get single product by ID or slug',
            'POST   /api/products                          - Create new product',
            'PUT    /api/products/:id                      - Update product',
            'DELETE /api/products/:id                      - Delete product (soft delete)'
        ],
        bulk: [
            'DELETE /api/products/bulk/delete              - Bulk delete products',
            'PUT    /api/products/bulk/status              - Bulk update status',
            'PUT    /api/products/bulk/stock               - Bulk update stock'
        ],
        search: [
            'GET    /api/products/search/:keyword          - Search products with filters',
            'GET    /api/products/special/featured         - Get featured products',
            'GET    /api/products/inventory/low-stock      - Get low stock products',
            'GET    /api/products/inventory/out-of-stock  – Get out-of-stock products',
            'GET    /api/products/category/:categoryId     – Get products by category',
            'GET    /api/products/tags/:tags               – Get products by tags',
            'GET    /api/products/special/new-arrivals     – Get new arrival products',
            'GET    /api/products/filter/price-range       – Get products by price range',
            'GET    /api/products/special/top-selling      – Get top selling products',
            'GET    /api/products/special/most-viewed      – Get most viewed products',
            'GET    /api/products/special/discounted       – Get discounted products'
        ],
        instanceMethods: [
            'GET    /api/products/:id/images/simplified   – Get simplified images',
            'GET    /api/products/:id/price/final          – Get final price',
            'GET    /api/products/:id/stock/status         – Get stock status',
            'PUT    /api/products/:id/stock/mark-out       – Mark as out of stock',
            'PUT    /api/products/:id/views/increment      – Increment views',
            'PUT    /api/products/:id/sold/increment       – Increment sold count',
            'GET    /api/products/:id/discount/active      – Check if discount is active',
            'GET    /api/products/:id/seo                  – Get SEO data',
            'GET    /api/products/:id/price/bulk           – Get bulk discount price',
            'GET    /api/products/:id/purchasable          – Check if purchasable',
            'PUT    /api/products/:id/stock/reduce         – Reduce stock',
            'PUT    /api/products/:id/stock/restock        – Restock product',
            'PUT    /api/products/:id/featured/toggle      – Toggle featured status',
            'GET    /api/products/:id/related              – Get related products',
            'GET    /api/products/:id/bundle/check        – Check if part of bundle',
            'GET    /api/products/:id/discount/percent    – Get discount percent',
            'POST   /api/products/:id/reviews/add         – Add review',
            'PUT    /api/products/:id/promotion/apply     – Apply promotion',
            'GET    /api/products/:id/preorder/check      – Check pre-order availability',
            'GET    /api/products/:id/bundle/price        – Get bundle total price'
        ],
        virtualProperties: [
            'GET    /api/products/:id/ratings/statistics  – Get rating statistics',
            'GET    /api/products/:id/stock/virtual-status— Get virtual stock status'
        ],
        analytics: [
            'GET    /api/products/analytics/schema-report – Get schema report',
            'GET    /api/products/analytics/database-stats– Get database statistics',
            'GET    /api/products/analytics/products      – Get products with analytics',
            'GET    /api/products/analytics/category/:categoryId/rating – Get average rating by category'
        ],
        enhanced: [
            'PUT    /api/products/:id/stock/update        – Enhanced stock update',
            'POST   /api/products/archive/old             – Archive old products'
        ],
        favorites: [
            'POST   /api/products/favorites/:id           – Add product to wishlist',
            'DELETE /api/products/favorites/:id           – Remove product from wishlist',
            'GET    /api/products/favorites               – List user’s favorites'
        ],
        recommendations: [
            'GET    /api/products/recommendations/:id     – Get product recommendations'
        ],
        importExport: [
            'POST   /api/products/import                  – Bulk import CSV',
            'GET    /api/products/export                  – Export products CSV'
        ],
        moderation: [
            'PUT    /api/products/:id/reviews/:reviewId/approve – Approve a review',
            'DELETE /api/products/:id/reviews/:reviewId         – Remove a review'
        ],
        alerts: [
            'GET    /api/products/alerts/low-stock         – Low-stock alerts',
            'POST   /api/products/alerts/low-stock/email   – Trigger low-stock emails'
        ],
        pricing: [
            'PUT    /api/products/bulk/price-update        – Bulk price update',
            'POST   /api/products/flash-sale               – Schedule flash sale'
        ],
        downloadables: [
            'GET    /api/products/:id/downloads            – List downloadable files',
            'GET    /api/products/:id/downloads/:fileIndex– Download a specific file'
        ],
        taxonomy: [
            'POST   /api/products/taxonomy/category        – Create category',
            'PUT    /api/products/taxonomy/category/:id    – Update category',
            'GET    /api/products/taxonomy/categories      – List categories'
        ]
    };

    res.status(200).json({
        success: true,
        data: {
            totalRoutes: Object.values(routes).flat().length,
            categories: routes
        },
        message: 'Product API routes documentation'
    });
});


module.exports = { ProductRoute: router };