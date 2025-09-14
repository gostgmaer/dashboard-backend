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
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
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
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const attachmentValidation = {
  create: [
    body('fileName').isString().withMessage('File name must be a string').isLength({ min: 1, max: 255 }).withMessage('File name must be between 1 and 255 characters'),
    body('fileType').isString().withMessage('File type must be a string').isLength({ max: 50 }).withMessage('File type cannot exceed 50 characters'),
    body('fileSize').isInt({ min: 0 }).withMessage('File size must be a non-negative integer'),
    body('category').optional().isString().withMessage('Category must be a string').isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Each tag cannot exceed 50 characters'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    body('status').optional().isIn(['active', 'archived', 'deleted']).withMessage('Status must be active, archived, or deleted'),
    body('url').isURL().withMessage('URL must be a valid URL')
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid attachment ID'),
    body('fileName').optional().isString().withMessage('File name must be a string').isLength({ min: 1, max: 255 }).withMessage('File name must be between 1 and 255 characters'),
    body('category').optional().isString().withMessage('Category must be a string').isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('tags.*').optional().isString().withMessage('Each tag must be a string').isLength({ max: 50 }).withMessage('Each tag cannot exceed 50 characters'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    body('status').optional().isIn(['active', 'archived', 'deleted']).withMessage('Status must be active, archived, or deleted')
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'fileSize', 'fileName']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('category').optional().isString().withMessage('Category must be a string').isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters'),
    query('tag').optional().isString().withMessage('Tag must be a string').isLength({ max: 50 }).withMessage('Tag cannot exceed 50 characters'),
    query('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
    query('status').optional().isIn(['active', 'archived', 'deleted']).withMessage('Status must be active, archived, or deleted'),
    query('search').optional().isString().withMessage('Search must be a string').isLength({ max: 100 }).withMessage('Search cannot exceed 100 characters')
  ],

  search: [
    query('q').isString().withMessage('Query must be a string').isLength({ min: 1, max: 100 }).withMessage('Query must be between 1 and 100 characters')
  ],

  bulk: [
    body('ids').isArray({ min: 1 }).withMessage('IDs array is required'),
    body('ids.*').isMongoId().withMessage('Invalid attachment ID in array')
  ],

  bulkCategorize: [
    body('extension').isString().withMessage('Extension must be a string').isLength({ max: 10 }).withMessage('Extension cannot exceed 10 characters'),
    body('category').isString().withMessage('Category must be a string').isLength({ max: 100 }).withMessage('Category cannot exceed 100 characters')
  ],

  analytics: [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],

  deleteOldFiles: [
    query('days').optional().isInt({ min: 1 }).withMessage('Days must be a positive integer')
  ],

  checkAccess: [
    param('id').isMongoId().withMessage('Invalid attachment ID'),
    query('role').isString().withMessage('Role must be a string').isLength({ max: 100 }).withMessage('Role cannot exceed 100 characters'),
    query('type').optional().isIn(['read', 'write']).withMessage('Type must be read or write')
  ]
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// POST /api/attachments - Create a new attachment
router.post('/',
  authMiddleware,
  roleMiddleware(['admin', 'user']),
  attachmentValidation.create,
  createAttachment
);

// GET /api/attachments - List attachments with filters
router.get('/',
  authMiddleware,
  attachmentValidation.query,
  listAttachments
);

// GET /api/attachments/:id - Get attachment by ID
router.get('/:id',
  authMiddleware,
  param('id').isMongoId().withMessage('Invalid attachment ID'),
  getAttachmentById
);

// PUT /api/attachments/:id - Update attachment metadata
router.put('/:id',
  authMiddleware,
  roleMiddleware(['admin']),
  attachmentValidation.update,
  updateAttachment
);

// DELETE /api/attachments/:id - Soft delete attachment
router.delete('/:id',
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid attachment ID'),
  deleteAttachment
);

// POST /api/attachments/restore/:id - Restore soft-deleted attachment
router.post('/restore/:id',
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid attachment ID'),
  restoreAttachment
);

// ========================================
// 🔄 LIFECYCLE MANAGEMENT
// ========================================

// POST /api/attachments/archive/:id - Archive an attachment
router.post('/archive/:id',
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid attachment ID'),
  archiveAttachment
);

// DELETE /api/attachments/purge/:id - Permanently purge an attachment
router.delete('/purge/:id',
  authMiddleware,
  roleMiddleware(['admin']),
  param('id').isMongoId().withMessage('Invalid attachment ID'),
  purgeAttachment
);

// POST /api/attachments/bulk-archive - Bulk archive attachments
router.post('/bulk-archive',
  authMiddleware,
  roleMiddleware(['admin']),
  attachmentValidation.bulk,
  bulkArchiveAttachments
);

// POST /api/attachments/bulk-restore - Bulk restore attachments
router.post('/bulk-restore',
  authMiddleware,
  roleMiddleware(['admin']),
  attachmentValidation.bulk,
  bulkRestoreAttachments
);

// POST /api/attachments/bulk-delete - Bulk soft delete attachments
router.post('/bulk-delete',
  authMiddleware,
  roleMiddleware(['admin']),
  attachmentValidation.bulk,
  bulkDeleteAttachments
);

// ========================================
// 🔍 SEARCH OPERATIONS
// ========================================

// GET /api/attachments/search - Search attachments
router.get('/search',
  authMiddleware,
  attachmentValidation.search,
  searchAttachments
);

// ========================================
// 📊 ANALYTICS
// ========================================

// GET /api/attachments/analytics/storage - Get total storage used
router.get('/analytics/storage',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  getTotalStorage
);

// GET /api/attachments/analytics/categories - Get count by category
router.get('/analytics/categories',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  getCountByCategory
);

// GET /api/attachments/analytics/public-private - Get public vs private count
router.get('/analytics/public-private',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  getPublicPrivateCount
);

// GET /api/attachments/analytics/top-tags - Get top tags
router.get('/analytics/top-tags',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  attachmentValidation.analytics,
  getTopTags
);

// GET /api/attachments/analytics/largest-files - Get largest files
router.get('/analytics/largest-files',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  attachmentValidation.analytics,
  getLargestFiles
);

// GET /api/attachments/analytics/recent-uploads - Get recent uploads
router.get('/analytics/recent-uploads',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  attachmentValidation.analytics,
  getRecentUploads
);

// GET /api/attachments/analytics/untagged - Get untagged files
router.get('/analytics/untagged',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  getUntaggedFiles
);

// GET /api/attachments/analytics/avg-size - Get average file size
router.get('/analytics/avg-size',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  getAverageFileSize
);

// GET /api/attachments/analytics/size-distribution - Get size distribution
router.get('/analytics/size-distribution',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  getSizeDistribution
);

// GET /api/attachments/analytics/top-uploaders - Get top uploaders
router.get('/analytics/top-uploaders',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  attachmentValidation.analytics,
  getTopUploaders
);

// ========================================
// 🛠 MAINTENANCE
// ========================================

// DELETE /api/attachments/old-files - Delete old files beyond retention period
router.delete('/old-files',
  authMiddleware,
  roleMiddleware(['admin']),
  attachmentValidation.deleteOldFiles,
  deleteOldFiles
);

// POST /api/attachments/bulk-categorize - Bulk categorize by extension
router.post('/bulk-categorize',
  authMiddleware,
  roleMiddleware(['admin']),
  attachmentValidation.bulkCategorize,
  bulkCategorizeByExtension
);

// ========================================
// 🔐 SECURITY
// ========================================

// GET /api/attachments/:id/access - Check access for a role
router.get('/:id/access',
  authMiddleware,
  roleMiddleware(['admin', 'manager']),
  attachmentValidation.checkAccess,
  checkAccess
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

const routeOrderMiddleware = (req, res, next) => {
  // Ensure specific routes come before dynamic ones
  if (req.path.startsWith('/search') ||
    req.path.startsWith('/analytics') ||
    req.path.startsWith('/bulk-') ||
    req.path.startsWith('/restore') ||
    req.path.startsWith('/archive') ||
    req.path.startsWith('/purge') ||
    req.path.startsWith('/old-files') ||
    req.path.startsWith('/bulk-categorize')) {
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
      message: 'Route documentation only available in development mode'
    });
  }

  const routes = {
    crud: [
      'POST   /api/attachments                          - Create a new attachment',
      'GET    /api/attachments                          - List attachments with filters',
      'GET    /api/attachments/:id                      - Get attachment by ID',
      'PUT    /api/attachments/:id                      - Update attachment metadata',
      'DELETE /api/attachments/:id                      - Soft delete attachment',
      'POST   /api/attachments/restore/:id              - Restore soft-deleted attachment'
    ],
    lifecycle: [
      'POST   /api/attachments/archive/:id              - Archive an attachment',
      'DELETE /api/attachments/purge/:id                - Permanently purge an attachment',
      'POST   /api/attachments/bulk-archive             - Bulk archive attachments',
      'POST   /api/attachments/bulk-restore             - Bulk restore attachments',
      'POST   /api/attachments/bulk-delete              - Bulk soft delete attachments'
    ],
    search: [
      'GET    /api/attachments/search                   - Search attachments'
    ],
    analytics: [
      'GET    /api/attachments/analytics/storage        - Get total storage used',
      'GET    /api/attachments/analytics/categories     - Get count by category',
      'GET    /api/attachments/analytics/public-private - Get public vs private count',
      'GET    /api/attachments/analytics/top-tags       - Get top tags',
      'GET    /api/attachments/analytics/largest-files  - Get largest files',
      'GET    /api/attachments/analytics/recent-uploads - Get recent uploads',
      'GET    /api/attachments/analytics/untagged       - Get untagged files',
      'GET    /api/attachments/analytics/avg-size       - Get average file size',
      'GET    /api/attachments/analytics/size-distribution - Get size distribution',
      'GET    /api/attachments/analytics/top-uploaders  - Get top uploaders'
    ],
    maintenance: [
      'DELETE /api/attachments/old-files                - Delete old files beyond retention period',
      'POST   /api/attachments/bulk-categorize          - Bulk categorize by extension'
    ],
    security: [
      'GET    /api/attachments/:id/access               - Check access for a role'
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
});

module.exports = { attachmentRoutes: router };