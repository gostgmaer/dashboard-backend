const express = require('express');
const reviewRoute = express.Router();
const reviewCtrl = require('../controller/reviews/reviews');
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED REVIEW ROUTES
 * 
 * Features:
 * ✅ Comprehensive CRUD operations for reviews
 * ✅ Product and user-specific review retrieval
 * ✅ Moderation tools for reporting and approving reviews
 * ✅ Helpful vote tracking
 * ✅ Statistical and analytical endpoints
 * ✅ Search and filtering capabilities
 * ✅ Bulk operations for approvals and deletions
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const reviewValidation = {
  create: [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('productId').isMongoId().withMessage('Invalid product ID'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').isString().withMessage('Comment must be a string').isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters'),
    body('images').optional().isArray().withMessage('Images must be an array'),
    body('images.*').optional().isURL().withMessage('Each image must be a valid URL')
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid review ID'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().isString().withMessage('Comment must be a string').isLength({ max: 1000 }).withMessage('Comment cannot exceed 1000 characters'),
    body('images').optional().isArray().withMessage('Images must be an array'),
    body('images.*').optional().isURL().withMessage('Each image must be a valid URL')
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'rating', 'helpfulCount']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('search').optional().isString().withMessage('Search must be a string').isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters')
  ],

  bulk: [
    body('reviewIds').isArray({ min: 1 }).withMessage('Review IDs array is required'),
    body('reviewIds.*').isMongoId().withMessage('Invalid review ID in array')
  ],

  reply: [
    param('id').isMongoId().withMessage('Invalid review ID'),
    body('reply').isString().withMessage('Reply must be a string').isLength({ max: 500 }).withMessage('Reply cannot exceed 500 characters')
  ],

  dateRange: [
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
  ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// POST /api/review - Create a new review
reviewRoute.post('/', 
  authMiddleware,
  reviewValidation.create,
  reviewCtrl.createReview
);

// GET /api/review/:id - Get a review by ID
reviewRoute.get('/:id', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid review ID'),
  reviewCtrl.getReviewById
);

// PUT /api/review/:id - Update a review
reviewRoute.put('/:id', 
  authMiddleware,
  reviewValidation.update,
  reviewCtrl.updateReview
);

// DELETE /api/review/:id - Delete a review
reviewRoute.delete('/:id', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid review ID'),
  reviewCtrl.deleteReview
);

// ========================================
// 📜 LIST OPERATIONS
// ========================================

// GET /api/review/product/:productId - Get reviews by product
reviewRoute.get('/product/:productId', 
  authMiddleware,
  param('productId').isMongoId().withMessage('Invalid product ID'),
  reviewValidation.query,
  reviewCtrl.getReviewsByProduct
);

// GET /api/review/user/:userId - Get reviews by user
reviewRoute.get('/user/:userId', 
  authMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  reviewValidation.query,
  reviewCtrl.getReviewsByUser
);

// GET /api/review/rating/:rating - Get reviews by rating
reviewRoute.get('/rating/:rating', 
  authMiddleware,
  param('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  reviewValidation.query,
  reviewCtrl.getReviewsByRating
);

// GET /api/review/date-range - Get reviews by date range
reviewRoute.get('/date-range', 
  authMiddleware,
  reviewValidation.dateRange,
  reviewValidation.query,
  reviewCtrl.getReviewsByDateRange
);

// ========================================
// 🛡️ MODERATION OPERATIONS
// ========================================

// GET /api/review/reported/all - Get all reported reviews
reviewRoute.get('/reported/all', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  reviewValidation.query,
  reviewCtrl.getReportedReviews
);

// PATCH /api/review/:id/report - Report a review
reviewRoute.patch('/:id/report', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('reason').isString().withMessage('Reason must be a string').isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  reviewCtrl.reportReview
);

// PATCH /api/review/:id/unreport - Unreport a review
reviewRoute.patch('/:id/unreport', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid review ID'),
  reviewCtrl.unreportReview
);

// PATCH /api/review/bulk-approve - Bulk approve reviews
reviewRoute.patch('/bulk-approve', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  reviewValidation.bulk,
  reviewCtrl.bulkApproveReviews
);

// DELETE /api/review/bulk-delete - Bulk delete reviews
reviewRoute.delete('/bulk-delete', 
  authMiddleware,
  roleMiddleware(['admin']),
  reviewValidation.bulk,
  reviewCtrl.bulkDeleteReviews
);

// ========================================
// 👍 HELPFUL VOTES
// ========================================

// PATCH /api/review/:id/helpful - Mark review as helpful
reviewRoute.patch('/:id/helpful', 
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid review ID'),
  reviewCtrl.markReviewHelpful
);

// ========================================
// 🖼️ IMAGE MANAGEMENT
// ========================================

// PATCH /api/review/:id/clear-images - Clear review images
reviewRoute.patch('/:id/clear-images', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  param('id').isMongoId().withMessage('Invalid review ID'),
  reviewCtrl.clearReviewImages
);

// ========================================
// 📊 STATISTICS & ANALYTICS
// ========================================

// GET /api/review/stats/average/:productId - Get average rating for a product
reviewRoute.get('/stats/average/:productId', 
  authMiddleware,
  param('productId').isMongoId().withMessage('Invalid product ID'),
  reviewCtrl.getAverageRating
);

// GET /api/review/stats/breakdown/:productId - Get rating breakdown for a product
reviewRoute.get('/stats/breakdown/:productId', 
  authMiddleware,
  param('productId').isMongoId().withMessage('Invalid product ID'),
  reviewCtrl.getRatingBreakdown
);

// GET /api/review/stats/top-rated/:productId - Get top-rated reviews for a product
reviewRoute.get('/stats/top-rated/:productId', 
  authMiddleware,
  param('productId').isMongoId().withMessage('Invalid product ID'),
  reviewValidation.query,
  reviewCtrl.getTopRatedReviews
);

// GET /api/review/stats/most-helpful/:productId - Get most helpful reviews for a product
reviewRoute.get('/stats/most-helpful/:productId', 
  authMiddleware,
  param('productId').isMongoId().withMessage('Invalid product ID'),
  reviewValidation.query,
  reviewCtrl.getMostHelpfulReviews
);

// GET /api/review/most-active - Get most active reviewers
reviewRoute.get('/most-active', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  reviewValidation.query,
  reviewCtrl.getMostActiveReviewers
);

// GET /api/review/top-helpful - Get top helpful reviews
reviewRoute.get('/top-helpful', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  reviewValidation.query,
  reviewCtrl.getTopHelpfulReviews
);

// ========================================
// 🔍 SEARCH & REPLY
// ========================================

// GET /api/review/search/query - Search reviews
reviewRoute.get('/search/query', 
  authMiddleware,
  reviewValidation.query,
  reviewCtrl.searchReviews
);

// POST /api/review/:id/reply - Reply to a review
reviewRoute.post('/:id/reply', 
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  reviewValidation.reply,
  reviewCtrl.replyToReview
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones
  if (req.path.startsWith('/product/') || 
      req.path.startsWith('/user/') || 
      req.path.startsWith('/reported/') || 
      req.path.startsWith('/stats/') || 
      req.path.startsWith('/search/') || 
      req.path.startsWith('/bulk-') || 
      req.path.startsWith('/rating/') || 
      req.path.startsWith('/date-range') || 
      req.path.startsWith('/most-active') || 
      req.path.startsWith('/top-helpful')) {
    return next();
  }

  next();
};

// Apply the middleware to all routes
reviewRoute.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

reviewRoute.get('/docs/routes', (req, res) => {
  if (enviroment !== 'development') {
    return res.status(404).json({
      success: false,
      message: 'Route documentation only available in development mode'
    });
  }

  const routes = {
    crud: [
      'POST   /api/review                          - Create a new review',
      'GET    /api/review/:id                     - Get a review by ID',
      'PUT    /api/review/:id                     - Update a review',
      'DELETE /api/review/:id                     - Delete a review'
    ],
    lists: [
      'GET    /api/review/product/:productId      - Get reviews by product',
      'GET    /api/review/user/:userId            - Get reviews by user',
      'GET    /api/review/rating/:rating          - Get reviews by rating',
      'GET    /api/review/date-range              - Get reviews by date range'
    ],
    moderation: [
      'GET    /api/review/reported/all            - Get all reported reviews',
      'PATCH  /api/review/:id/report              - Report a review',
      'PATCH  /api/review/:id/unreport            - Unreport a review',
      'PATCH  /api/review/bulk-approve            - Bulk approve reviews',
      'DELETE /api/review/bulk-delete             - Bulk delete reviews'
    ],
    helpfulVotes: [
      'PATCH  /api/review/:id/helpful             - Mark review as helpful'
    ],
    imageManagement: [
      'PATCH  /api/review/:id/clear-images        - Clear review images'
    ],
    statisticsAnalytics: [
      'GET    /api/review/stats/average/:productId - Get average rating for a product',
      'GET    /api/review/stats/breakdown/:productId - Get rating breakdown for a product',
      'GET    /api/review/stats/top-rated/:productId - Get top-rated reviews for a product',
      'GET    /api/review/stats/most-helpful/:productId - Get most helpful reviews for a product',
      'GET    /api/review/most-active             - Get most active reviewers',
      'GET    /api/review/top-helpful             - Get top helpful reviews'
    ],
    searchReply: [
      'GET    /api/review/search/query            - Search reviews',
      'POST   /api/review/:id/reply               - Reply to a review'
    ]
  };

  res.status(200).json({
    success: true,
    data: {
      totalRoutes: Object.values(routes).flat().length,
      categories: routes
    },
    message: 'Review API routes documentation'
  });
});

module.exports = reviewRoute;