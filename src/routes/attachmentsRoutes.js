const express = require('express');
const router = express.Router();
const {
  createAttachment,
  getAttachmentById,
  listAttachments,
  updateAttachment,
  deleteAttachment,
  restoreAttachment,
  archiveAttachment,
  purgeAttachment,
  bulkDeleteAttachments,
  bulkArchiveAttachments,
  bulkRestoreAttachments,
  searchAttachments,
  getTotalStorage,
  getCountByCategory,
  getPublicPrivateCount,
  getTopTags,
  getLargestFiles,
  getRecentUploads,
  getUntaggedFiles,
  getAverageFileSize,
  getSizeDistribution,
  getTopUploaders,
  deleteOldFiles,
  bulkCategorizeByExtension,
  checkAccess,
} = require('../controller/attachment');
const { body, query, param, validationResult } = require('express-validator');
const {authMiddleware} = require('../middleware/auth');
const  authorize  = require('../middleware/authorize');// Assumed exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');

/**
 * 🚀 CONSOLIDATED ATTACHMENT ROUTES
 * 
 * Features:
 * ✅ Comprehensive CRUD operations for attachments
 * ✅ Lifecycle management (archive, restore, purge)
 * ✅ Bulk operations for deletion, archiving, and categorization
 * ✅ Search and filtering capabilities
 * ✅ Analytics for storage, categories, tags, and uploaders
 * ✅ Maintenance tasks for old files and categorization
 * ✅ Permission-based access control via authorize middleware
 * ✅ Comprehensive validation schemas with sanitization
 * ✅ Rate limiting for bulk operations
 * ✅ Instance-level checks for IDOR prevention
 * ✅ Performance optimized routes
 */

/**
 * Rate limiter for high-risk bulk and delete operations
 * Limits to 10 requests per 15 minutes per IP
 */
const bulkOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many requests, please try again later' }
});

/**
 * Middleware to check instance-level access for attachment-specific routes
 * Ensures the user has permission to access/modify the specific attachment
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const attachmentId = req.params.id;
    if (attachmentId && !req.user.isSuperadmin) { // Superadmin bypass in authorize
      const Attachment = require('../models/Attachment'); // Assumed Attachment model
      const attachment = await Attachment.findById(attachmentId);
      if (!attachment) {
        return res.status(404).json({ success: false, message: 'Attachment not found' });
      }
      if (attachment.userId.toString() !== req.user.id) { // Restrict to own attachments
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s attachment' });
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

const attachmentValidation = {
  create: [
    body('fileName').isString().withMessage('File name must be a string').isLength({ min: 1, max: 255 }).withMessage('File name must be between 1 and 255 characters').trim().escape(),
    body('fileType').isString().withMessage('File type must be a string').isLength({ max: 50 }).withMessage('File type cannot exceed 50 characters').trim().escape(),
    body('fileSize').isInt({ min: 0 }).withMessage('File size must be a non-negative integer').toInt(),
    body('category').optional().isString().withMessage('Category must be a string').isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters').trim().escape(),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Each tag cannot exceed 50 characters').trim().escape(),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    body('status').optional().isIn(['active', 'archived', 'deleted']).withMessage('Status must be active, archived, or deleted'),
    body('url').isURL().withMessage('URL must be a valid URL').trim(),
    body('userId').isMongoId().withMessage('Valid user ID is required'),
    validate
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid attachment ID'),
    body('fileName').optional().isString().withMessage('File name must be a string').isLength({ min: 1, max: 255 }).withMessage('File name must be between 1 and 255 characters').trim().escape(),
    body('category').optional().isString().withMessage('Category must be a string').isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters').trim().escape(),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Each tag cannot exceed 50 characters').trim().escape(),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    body('status').optional().isIn(['active', 'archived', 'deleted']).withMessage('Status must be active, archived, or deleted'),
    validate
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'fileSize', 'fileName']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('category').optional().isString().withMessage('Category must be a string').isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters').trim().escape(),
    query('tag').optional().isString().withMessage('Tag must be a string').isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters').trim().escape(),
    query('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    query('status').optional().isIn(['active', 'archived', 'deleted']).withMessage('Status must be active, archived, or deleted'),
    query('search').optional().isString().withMessage('Search must be a string').isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters').trim().escape(),
    validate
  ],

  search: [
    query('q').isString().withMessage('Query must be a string').isLength({ min: 1, max: 100 }).withMessage('Query must be between 1 and 100 characters').trim().escape(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    validate
  ],

  bulk: [
    body('ids').isArray({ min: 1 }).withMessage('IDs array is required'),
    body('ids.*').isMongoId().withMessage('Invalid attachment ID in array'),
    validate
  ],

  bulkCategorize: [
    body('extension').isString().withMessage('Extension must be a string').isLength({ max: 10 }).withMessage('Extension cannot exceed 10 characters').trim().escape(),
    body('category').isString().withMessage('Category must be a string').isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters').trim().escape(),
    validate
  ],

  analytics: [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    validate
  ],

  deleteOldFiles: [
    query('days').optional().isInt({ min: 1 }).withMessage('Days must be a positive integer').toInt(),
    validate
  ],

  checkAccess: [
    param('id').isMongoId().withMessage('Invalid attachment ID'),
    query('role').isString().withMessage('Role must be a string').isLength({ max: 100 }).withMessage('Role cannot exceed 100 characters').trim().escape(),
    query('type').optional().isIn(['read', 'write']).withMessage('Type must be read or write'),
    validate
  ],

  id: [
    param('id').isMongoId().withMessage('Invalid attachment ID'),
    validate
  ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// POST /api/attachments - Create a new attachment
router.post('/',
  authMiddleware,
  authorize('attachments', 'write'),
  attachmentValidation.create,
  createAttachment
);

// GET /api/attachments - List attachments with filters
router.get('/',
  authMiddleware,
  authorize('attachments', 'read'),
  attachmentValidation.query,
  listAttachments
);

// GET /api/attachments/:id - Get attachment by ID
router.get('/:id',
  authMiddleware,
  authorize('attachments', 'read'),
  instanceCheckMiddleware,
  attachmentValidation.id,
  getAttachmentById
);

// PUT /api/attachments/:id - Update attachment metadata
router.put('/:id',
  authMiddleware,
  authorize('attachments', 'update'),
  instanceCheckMiddleware,
  attachmentValidation.update,
  updateAttachment
);

// DELETE /api/attachments/:id - Soft delete attachment
router.delete('/:id',
  authMiddleware,
  authorize('attachments', 'update'),
  instanceCheckMiddleware,
  attachmentValidation.id,
  deleteAttachment
);

// POST /api/attachments/restore/:id - Restore soft-deleted attachment
router.post('/restore/:id',
  authMiddleware,
  authorize('attachments', 'update'),
  instanceCheckMiddleware,
  attachmentValidation.id,
  restoreAttachment
);

// ========================================
// 🔄 LIFECYCLE MANAGEMENT
// ========================================

// POST /api/attachments/archive/:id - Archive an attachment
router.post('/archive/:id',
  authMiddleware,
  authorize('attachments', 'update'),
  instanceCheckMiddleware,
  attachmentValidation.id,
  archiveAttachment
);

// DELETE /api/attachments/purge/:id - Permanently purge an attachment
router.delete('/purge/:id',
  authMiddleware,
  authorize('attachments', 'update'),
  instanceCheckMiddleware,
  attachmentValidation.id,
  purgeAttachment
);

// POST /api/attachments/bulk-archive - Bulk archive attachments
router.post('/bulk-archive',
  authMiddleware,
  authorize('attachments', 'update'),
  bulkOperationLimiter,
  attachmentValidation.bulk,
  bulkArchiveAttachments
);

// POST /api/attachments/bulk-restore - Bulk restore attachments
router.post('/bulk-restore',
  authMiddleware,
  authorize('attachments', 'update'),
  bulkOperationLimiter,
  attachmentValidation.bulk,
  bulkRestoreAttachments
);

// POST /api/attachments/bulk-delete - Bulk soft delete attachments
router.post('/bulk-delete',
  authMiddleware,
  authorize('attachments', 'update'),
  bulkOperationLimiter,
  attachmentValidation.bulk,
  bulkDeleteAttachments
);

// ========================================
// 🔍 SEARCH OPERATIONS
// ========================================

// GET /api/attachments/search - Search attachments
router.get('/search',
  authMiddleware,
  authorize('attachments', 'read'),
  attachmentValidation.search,
  searchAttachments
);

// ========================================
// 📊 ANALYTICS
// ========================================

// GET /api/attachments/analytics/storage - Get total storage used
router.get('/analytics/storage',
  authMiddleware,
  authorize('attachments', 'report'),
  getTotalStorage
);

// GET /api/attachments/analytics/categories - Get count by category
router.get('/analytics/categories',
  authMiddleware,
  authorize('attachments', 'report'),
  getCountByCategory
);

// GET /api/attachments/analytics/public-private - Get public vs private count
router.get('/analytics/public-private',
  authMiddleware,
  authorize('attachments', 'report'),
  getPublicPrivateCount
);

// GET /api/attachments/analytics/top-tags - Get top tags
router.get('/analytics/top-tags',
  authMiddleware,
  authorize('attachments', 'report'),
  attachmentValidation.analytics,
  getTopTags
);

// GET /api/attachments/analytics/largest-files - Get largest files
router.get('/analytics/largest-files',
  authMiddleware,
  authorize('attachments', 'report'),
  attachmentValidation.analytics,
  getLargestFiles
);

// GET /api/attachments/analytics/recent-uploads - Get recent uploads
router.get('/analytics/recent-uploads',
  authMiddleware,
  authorize('attachments', 'report'),
  attachmentValidation.analytics,
  getRecentUploads
);

// GET /api/attachments/analytics/untagged - Get untagged files
router.get('/analytics/untagged',
  authMiddleware,
  authorize('attachments', 'report'),
  getUntaggedFiles
);

// GET /api/attachments/analytics/avg-size - Get average file size
router.get('/analytics/avg-size',
  authMiddleware,
  authorize('attachments', 'report'),
  getAverageFileSize
);

// GET /api/attachments/analytics/size-distribution - Get size distribution
router.get('/analytics/size-distribution',
  authMiddleware,
  authorize('attachments', 'report'),
  getSizeDistribution
);

// GET /api/attachments/analytics/top-uploaders - Get top uploaders
router.get('/analytics/top-uploaders',
  authMiddleware,
  authorize('attachments', 'report'),
  attachmentValidation.analytics,
  getTopUploaders
);

// ========================================
// 🛠 MAINTENANCE
// ========================================

// DELETE /api/attachments/old-files - Delete old files beyond retention period
router.delete('/old-files',
  authMiddleware,
  authorize('attachments', 'update'),
  bulkOperationLimiter,
  attachmentValidation.deleteOldFiles,
  deleteOldFiles
);

// POST /api/attachments/bulk-categorize - Bulk categorize by extension
router.post('/bulk-categorize',
  authMiddleware,
  authorize('attachments', 'update'),
  bulkOperationLimiter,
  attachmentValidation.bulkCategorize,
  bulkCategorizeByExtension
);

// ========================================
// 🔐 SECURITY
// ========================================

// GET /api/attachments/:id/access - Check access for a role
router.get('/:id/access',
  authMiddleware,
  authorize('attachments', 'view'),
  instanceCheckMiddleware,
  attachmentValidation.checkAccess,
  checkAccess
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  const path = req.path.toLowerCase(); // Case-insensitive matching
  if (path.startsWith('/search') ||
      path.startsWith('/analytics') ||
      path.startsWith('/bulk-') ||
      path.startsWith('/restore') ||
      path.startsWith('/archive') ||
      path.startsWith('/purge') ||
      path.startsWith('/old-files') ||
      path.startsWith('/bulk-categorize') ||
      path === '/docs/routes') {
    return next();
  }
  next();
};

// Apply the middleware to all routes
router.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

router.get('/docs/routes',
  authMiddleware,
  authorize('attachments', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      crud: [
        'POST   /api/attachments                          - Create a new attachment (write)',
        'GET    /api/attachments                          - List attachments with filters (read)',
        'GET    /api/attachments/:id                      - Get attachment by ID (read, instance check)',
        'PUT    /api/attachments/:id                      - Update attachment metadata (update, instance check)',
        'DELETE /api/attachments/:id                      - Soft delete attachment (update, instance check)',
        'POST   /api/attachments/restore/:id              - Restore soft-deleted attachment (update, instance check)'
      ],
      lifecycle: [
        'POST   /api/attachments/archive/:id              - Archive an attachment (update, instance check)',
        'DELETE /api/attachments/purge/:id                - Permanently purge an attachment (update, instance check)',
        'POST   /api/attachments/bulk-archive             - Bulk archive attachments (update, rate-limited)',
        'POST   /api/attachments/bulk-restore             - Bulk restore attachments (update, rate-limited)',
        'POST   /api/attachments/bulk-delete              - Bulk soft delete attachments (update, rate-limited)'
      ],
      search: [
        'GET    /api/attachments/search                   - Search attachments (read)'
      ],
      analytics: [
        'GET    /api/attachments/analytics/storage        - Get total storage used (report)',
        'GET    /api/attachments/analytics/categories     - Get count by category (report)',
        'GET    /api/attachments/analytics/public-private - Get public vs private count (report)',
        'GET    /api/attachments/analytics/top-tags       - Get top tags (report)',
        'GET    /api/attachments/analytics/largest-files  - Get largest files (report)',
        'GET    /api/attachments/analytics/recent-uploads - Get recent uploads (report)',
        'GET    /api/attachments/analytics/untagged       - Get untagged files (report)',
        'GET    /api/attachments/analytics/avg-size       - Get average file size (report)',
        'GET    /api/attachments/analytics/size-distribution - Get size distribution (report)',
        'GET    /api/attachments/analytics/top-uploaders  - Get top uploaders (report)'
      ],
      maintenance: [
        'DELETE /api/attachments/old-files                - Delete old files beyond retention period (update, rate-limited)',
        'POST   /api/attachments/bulk-categorize          - Bulk categorize by extension (update, rate-limited)'
      ],
      security: [
        'GET    /api/attachments/:id/access               - Check access for a role (view, instance check)'
      ],
      documentation: [
        'GET    /api/attachments/docs/routes              - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Attachment API routes documentation'
    });
  }
);

module.exports = { attachmentRoutes: router };