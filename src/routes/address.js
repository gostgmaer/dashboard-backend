const express = require('express');
const addressRoute = express.Router();
const addressController = require('../controller/addresses/address');
const { body, query, param, validationResult } = require('express-validator');
const {authMiddleware} = require('../middleware/auth'); // Uncommented
const authorize = require('../middleware/authorize');// Assuming authorize is exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting'); // Assumed from userRoutes.js
const Address = require('../models/address');

/**
 * 🚀 ADDRESS ROUTES
 * 
 * Features:
 * ✅ CRUD operations for addresses
 * ✅ Authentication and authorization via authMiddleware and authorize
 * ✅ Validation with sanitization for security
 * ✅ Rate limiting for bulk and export operations
 * ✅ Instance-level checks for IDOR prevention
 * ✅ Support for default address, archiving, cloning, and merging
 * ✅ Search, comparison, and tag management
 * ✅ History tracking and duplicate detection
 * ✅ Export functionality and status counts
 * ✅ Permission-based access control
 */

/**
 * Rate limiter for high-risk bulk and export operations
 * Limits to 10 requests per 15 minutes per IP
 */
const bulkOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many requests, please try again later' }
});

/**
 * Middleware to check instance-level access for address-specific routes
 * Ensures the user has permission to access/modify the specific address
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const addressId = req.params.id || req.params.addressId1;
    if (addressId && !req.user.isSuperadmin) { // Superadmin bypass in authorize

      const address = await Address.findById(addressId);
      if (!address) {
        return res.status(404).json({ success: false, message: 'Address not found' });
      }
      if (address.userId.toString() !== req.user.id) { // Restrict to own addresses
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s address' });
      }
    }
    if (req.params.addressId2 && !req.user.isSuperadmin) {

      const address = await Address.findById(req.params.addressId2);
      if (!address) {
        return res.status(404).json({ success: false, message: 'Second address not found' });
      }
      if (address.userId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s address' });
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

const addressValidation = {
  create: [
    body('addressLine1').notEmpty().withMessage('Street is required').trim().escape(),
    body('city').notEmpty().withMessage('City is required').trim().escape(),
    body('country').notEmpty().withMessage('Country is required').trim().escape(),
    body('postalCode').notEmpty().withMessage('ZIP code is required').trim().escape(),
    validate
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid address ID'),
    body('addressLine1').optional().notEmpty().withMessage('Street cannot be empty').trim().escape(),
    body('city').optional().notEmpty().withMessage('City cannot be empty').trim().escape(),
    body('country').optional().notEmpty().withMessage('Country cannot be empty').trim().escape(),
    body('postalCode').optional().notEmpty().withMessage('ZIP code cannot be empty').trim().escape(),
    validate
  ],

  partialUpdate: [
    param('id').isMongoId().withMessage('Invalid address ID'),
    body().isObject().withMessage('Body must be an object'),
    validate
  ],

  setDefault: [
    param('id').isMongoId().withMessage('Invalid address ID'),
    validate
  ],

  archive: [
    param('id').isMongoId().withMessage('Invalid address ID'),
    validate
  ],

  restore: [
    param('id').isMongoId().withMessage('Invalid address ID'),
    validate
  ],

  clone: [
    param('id').isMongoId().withMessage('Invalid address ID'),
    validate
  ],

  compare: [
    param('addressId1').isMongoId().withMessage('Invalid first address ID'),
    param('addressId2').isMongoId().withMessage('Invalid second address ID'),
    validate
  ],

  delete: [
    param('id').isMongoId().withMessage('Invalid address ID'),
    validate
  ],

  bulkStatus: [
    body('ids').isArray({ min: 1 }).withMessage('Address IDs array is required'),
    body('ids.*').isMongoId().withMessage('Invalid address ID in array'),
    body('status').isIn(['active', 'inactive', 'archived']).withMessage('Invalid status'),
    validate
  ],

  search: [
    query('keyword').optional().notEmpty().withMessage('Search keyword is required').trim().escape(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    validate
  ],

  nearby: [
    query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
    query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
    query('radius').optional().isFloat({ min: 0 }).withMessage('Radius must be a positive number').toFloat(),
    validate
  ],

  addTag: [
    param('id').isMongoId().withMessage('Invalid address ID'),
    body('tag').notEmpty().withMessage('Tag is required').trim().escape(),
    validate
  ],

  removeTag: [
    param('id').isMongoId().withMessage('Invalid address ID'),
    body('tag').notEmpty().withMessage('Tag is required').trim().escape(),
    validate
  ],

  bulkAddTag: [
    body('ids').isArray({ min: 1 }).withMessage('Address IDs array is required'),
    body('ids.*').isMongoId().withMessage('Invalid address ID in array'),
    body('tag').notEmpty().withMessage('Tag is required').trim().escape(),
    validate
  ],

  merge: [
    param('id').isMongoId().withMessage('Invalid address ID'),
    body('sourceAddressId').isMongoId().withMessage('Valid source address ID is required'),
    validate
  ],

  byTag: [
    query('tag').notEmpty().withMessage('Tag is required').trim().escape(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    validate
  ],

  batchCreate: [
    body('addresses').isArray({ min: 1 }).withMessage('Addresses array is required'),
    body('addresses.*.addressLine1').notEmpty().withMessage('Street is required').trim().escape(),
    body('addresses.*.city').notEmpty().withMessage('City is required').trim().escape(),
    body('addresses.*.country').notEmpty().withMessage('Country is required').trim().escape(),
    body('addresses.*.postalCode').notEmpty().withMessage('ZIP code is required').trim().escape(),
    validate
  ],

  export: [
    query('format').optional().isIn(['csv', 'json']).withMessage('Invalid format'),
    validate
  ]
};

// ========================================
// 📍 ADDRESS ROUTES
// ========================================

// POST /addresses - Create a new address
addressRoute.post('/',
  authMiddleware,
  authorize('addresses', 'write'),
  addressValidation.create,
  addressController.createAddress
);

// GET /addresses/:id - Get address by ID
addressRoute.get('/user',
  authMiddleware,
  addressController.getAddressUserId
);
addressRoute.get('/:id',
  authMiddleware,
  authorize('addresses', 'read'),
  instanceCheckMiddleware,
  addressValidation.delete,
  addressController.getAddressById
);

// PUT /addresses/:id - Update address (full update)
addressRoute.put('/:id',
  authMiddleware,
  authorize('addresses', 'update'),
  instanceCheckMiddleware,
  addressValidation.update,
  addressController.updateAddress
);

// PUT /addresses/:id - Update address (full update)


// PATCH /addresses/:id - Partial update address
addressRoute.patch('/:id',
  authMiddleware,
  authorize('addresses', 'update'),
  instanceCheckMiddleware,
  addressValidation.partialUpdate,
  addressController.partialUpdateAddress
);

// PATCH /addresses/:id/set-default - Set address as default
addressRoute.patch('/:id/set-default',
  authMiddleware,
  authorize('addresses', 'update'),
  instanceCheckMiddleware,
  addressValidation.setDefault,
  addressController.setAddressAsDefault
);

// DELETE /addresses/:id - Soft delete address
addressRoute.delete('/:id',
  authMiddleware,
  authorize('addresses', 'update'),
  instanceCheckMiddleware,
  addressValidation.delete,
  addressController.softDeleteAddress
);

// PATCH /addresses/:id/archive - Archive address
addressRoute.patch('/:id/archive',
  authMiddleware,
  authorize('addresses', 'update'),
  instanceCheckMiddleware,
  addressValidation.archive,
  addressController.archiveAddress
);

// PATCH /addresses/:id/restore - Restore address
addressRoute.patch('/:id/restore',
  authMiddleware,
  authorize('addresses', 'update'),
  instanceCheckMiddleware,
  addressValidation.restore,
  addressController.restoreAddress
);

// POST /addresses/:id/clone - Clone address
addressRoute.post('/:id/clone',
  authMiddleware,
  authorize('addresses', 'write'),
  instanceCheckMiddleware,
  addressValidation.clone,
  addressController.cloneAddress
);

// GET /addresses/:addressId1/compare/:addressId2 - Compare two addresses
addressRoute.get('/:addressId1/compare/:addressId2',
  authMiddleware,
  authorize('addresses', 'view'),
  instanceCheckMiddleware,
  addressValidation.compare,
  addressController.compareAddresses
);

// GET /addresses/default - Get default address
addressRoute.get('/default',
  authMiddleware,
  authorize('addresses', 'read'),
  addressController.getDefaultAddress
);

// GET /addresses - Get all user addresses
addressRoute.get('/',
  authMiddleware,
  authorize('addresses', 'read'),
  addressController.getUserAddresses
);

// DELETE /addresses - Remove all user addresses
addressRoute.delete('/',
  authMiddleware,
  authorize('addresses', 'update'),
  bulkOperationLimiter,
  addressController.removeUserAddresses
);

// GET /addresses/nearby - Find nearby addresses
addressRoute.get('/nearby',
  authMiddleware,
  authorize('addresses', 'read'),
  addressValidation.nearby,
  addressController.findNearbyAddresses
);

// PATCH /addresses/:id/status - Update address status
addressRoute.patch('/:id/status',
  authMiddleware,
  authorize('addresses', 'update'),
  instanceCheckMiddleware,
  addressValidation.update,
  addressController.updateAddressStatus
);

// PATCH /addresses/bulk/status - Bulk update address status
addressRoute.patch('/bulk/status',
  authMiddleware,
  authorize('addresses', 'update'),
  bulkOperationLimiter,
  addressValidation.bulkStatus,
  addressController.bulkUpdateStatus
);

// GET /addresses/:id/history - Get address history
addressRoute.get('/:id/history',
  authMiddleware,
  authorize('addresses', 'view'),
  instanceCheckMiddleware,
  addressValidation.delete,
  addressController.getAddressHistory
);

// GET /addresses/search - Search addresses
addressRoute.get('/search',
  authMiddleware,
  authorize('addresses', 'read'),
  addressValidation.search,
  addressController.searchAddresses
);

// POST /addresses/batch - Batch create addresses
addressRoute.post('/batch',
  authMiddleware,
  authorize('addresses', 'write'),
  bulkOperationLimiter,
  addressValidation.batchCreate,
  addressController.batchCreateAddresses
);

// GET /addresses/duplicates - Find duplicate addresses
addressRoute.get('/duplicates',
  authMiddleware,
  authorize('addresses', 'read'),
  addressController.findDuplicateAddresses
);

// GET /addresses/status/count - Get address count by status
addressRoute.get('/status/count',
  authMiddleware,
  authorize('addresses', 'view'),
  addressController.getAddressCountByStatus
);

// PATCH /addresses/:id/add-tag - Add tag to address
addressRoute.patch('/:id/add-tag',
  authMiddleware,
  authorize('addresses', 'update'),
  instanceCheckMiddleware,
  addressValidation.addTag,
  addressController.addTagToAddress
);

// PATCH /addresses/:id/remove-tag - Remove tag from address
addressRoute.patch('/:id/remove-tag',
  authMiddleware,
  authorize('addresses', 'update'),
  instanceCheckMiddleware,
  addressValidation.removeTag,
  addressController.removeTagFromAddress
);

// PATCH /addresses/bulk/add-tag - Add tag to multiple addresses
addressRoute.patch('/bulk/add-tag',
  authMiddleware,
  authorize('addresses', 'update'),
  bulkOperationLimiter,
  addressValidation.bulkAddTag,
  addressController.addTagToMultiple
);

// PATCH /addresses/:id/merge - Merge addresses
addressRoute.patch('/:id/merge',
  authMiddleware,
  authorize('addresses', 'update'),
  instanceCheckMiddleware,
  addressValidation.merge,
  addressController.mergeAddresses
);

// GET /addresses/export - Export user addresses
addressRoute.get('/export',
  authMiddleware,
  authorize('addresses', 'report'),
  bulkOperationLimiter,
  addressValidation.export,
  addressController.exportUserAddresses
);

// GET /addresses/by-tag - Get addresses by tag
addressRoute.get('/by-tag',
  authMiddleware,
  authorize('addresses', 'read'),
  addressValidation.byTag,
  addressController.getAddressesByTag
);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

// GET /addresses/docs/routes - Get all available routes (dev only)
addressRoute.get('/docs/routes',
  authMiddleware,
  authorize('addresses', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      crud: [
        'POST   /addresses                             - Create a new address (write)',
        'GET    /addresses/:id                         - Get address by ID (read, instance check)',
        'PUT    /addresses/:id                         - Update address (full update) (update, instance check)',
        'PATCH  /addresses/:id                         - Partial update address (update, instance check)',
        'DELETE /addresses/:id                         - Soft delete address (update, instance check)',
        'GET    /addresses                             - Get all user addresses (read)',
        'DELETE /addresses                             - Remove all user addresses (update, rate-limited)'
      ],
      management: [
        'PATCH  /addresses/:id/set-default             - Set address as default (update, instance check)',
        'PATCH  /addresses/:id/archive                 - Archive address (update, instance check)',
        'PATCH  /addresses/:id/restore                 - Restore address (update, instance check)',
        'POST   /addresses/:id/clone                   - Clone address (write, instance check)',
        'PATCH  /addresses/:id/status                  - Update address status (update, instance check)',
        'PATCH  /addresses/bulk/status                 - Bulk update address status (update, rate-limited)',
        'PATCH  /addresses/:id/add-tag                 - Add tag to address (update, instance check)',
        'PATCH  /addresses/:id/remove-tag              - Remove tag from address (update, instance check)',
        'PATCH  /addresses/bulk/add-tag                - Add tag to multiple addresses (update, rate-limited)',
        'PATCH  /addresses/:id/merge                   - Merge addresses (update, instance check)'
      ],
      retrieval: [
        'GET    /addresses/default                     - Get default address (read)',
        'GET    /addresses/nearby                      - Find nearby addresses (read)',
        'GET    /addresses/search                      - Search addresses (read)',
        'GET    /addresses/by-tag                      - Get addresses by tag (read)',
        'GET    /addresses/duplicates                  - Find duplicate addresses (read)',
        'GET    /addresses/:id/history                 - Get address history (view, instance check)',
        'GET    /addresses/:addressId1/compare/:addressId2 - Compare two addresses (view, instance check)',
        'GET    /addresses/status/count                - Get address count by status (view)'
      ],
      batch: [
        'POST   /addresses/batch                       - Batch create addresses (write, rate-limited)'
      ],
      export: [
        'GET    /addresses/export                      - Export user addresses (view, rate-limited)'
      ],
      documentation: [
        'GET    /addresses/docs/routes                 - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Address API routes documentation'
    });
  }
);

module.exports = addressRoute;