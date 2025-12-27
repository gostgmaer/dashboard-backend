// routes/masterRoutes.js - COMPLETE VALIDATION FOR ALL OPERATIONS
const express = require('express');
const router = express.Router();
const masterController = require('../controller/masterController');
const { body, param, query, oneOf, array } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const validateRequest = require('../validator/requestValidator');
// const auth = require('../middleware/auth');
// const validateTenant = require('../middleware/validateTenant');

// ============ VALIDATION HELPERS ============

// 1. CREATE / UPDATE Single Payload ✅
const validateMasterPayload = [body('type').notEmpty().withMessage('Type is required').bail().isString().isLength({ max: 50 }).withMessage('Type max 50 characters'), body('code').notEmpty().withMessage('Code is required').bail().isString().isLength({ max: 50 }).withMessage('Code max 50 characters'), body('label').notEmpty().withMessage('Label is required').bail().isString().isLength({ max: 200 }).withMessage('Label max 200 characters'), body('tenantId').optional({ nullable: true }).isString().trim().isLength({ max: 100 }).withMessage('tenantId max 100 characters'), body('altLabel').optional({ nullable: true }).isString().trim().isLength({ max: 200 }).withMessage('altLabel max 200 characters'), body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }).withMessage('Description max 500 characters'), body('parentId').optional({ nullable: true }).isMongoId().withMessage('Invalid parentId format'), body('domain').optional({ nullable: true }).isString().trim().isLength({ max: 100 }).withMessage('Domain max 100 characters'), body('sortOrder').optional({ nullable: true }).isInt({ min: 0, max: 9999 }).withMessage('sortOrder 0-9999')];

// 2. PARTIAL UPDATE (PUT) - All fields optional ✅
const validatePartialUpdate = [body('type').optional({ nullable: true }).notEmpty().bail().isString().isLength({ max: 50 }), body('code').optional({ nullable: true }).notEmpty().bail().isString().isLength({ max: 50 }), body('label').optional({ nullable: true }).notEmpty().bail().isString().isLength({ max: 200 }), body('tenantId').optional({ nullable: true }).isString().trim().isLength({ max: 100 }), body('altLabel').optional({ nullable: true }).isString().trim().isLength({ max: 200 }), body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }), body('parentId').optional({ nullable: true }).isMongoId(), body('domain').optional({ nullable: true }).isString().trim().isLength({ max: 100 }), body('sortOrder').optional({ nullable: true }).isInt({ min: 0, max: 9999 })];

const validateBulkUpsert = [body().isArray({ min: 1 }).withMessage('Array with min 1 item required'), body('*.type').notEmpty().bail().isString().isLength({ max: 50 }), body('*.code').notEmpty().bail().isString().isLength({ max: 50 }), body('*.label').notEmpty().bail().isString().isLength({ max: 200 }), body('*.tenantId').optional({ nullable: true }).isString().trim().isLength({ max: 100 }), body('*.altLabel').optional({ nullable: true }).isString().trim().isLength({ max: 200 }), body('*.description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }), body('*.parentId').optional({ nullable: true }).isMongoId(), body('*.domain').optional({ nullable: true }).isString().trim().isLength({ max: 100 }), body('*.sortOrder').optional({ nullable: true }).isInt({ min: 0, max: 9999 })];

// 4. BULK DELETE - IDs array ✅
const validateIdsArray = [body('ids').isArray({ min: 1, max: 1000 }).withMessage('IDs array required (max 1000)'), body('ids.*').isMongoId().withMessage('Invalid ID format in array')];

// 5. ID Param validation ✅
const validateIdParam = [param('id').isMongoId().withMessage('Invalid MongoDB ID format')];

// 6. ID or Code Param ✅
const validateIdOrCodeParam = [oneOf([param('idOrCode').isMongoId().withMessage('Invalid MongoDB ID format'), param('idOrCode').isString().notEmpty().trim().withMessage('Code must be non-empty string')])];

// 7. LIST query params ✅
const validateListQuery = [query('page').optional({ nullable: true }).isInt({ min: 1, max: 10000 }), query('limit').optional({ nullable: true }).isInt({ min: 1, max: 500 }), query('sortBy').optional({ nullable: true }).isString().isLength({ max: 50 }), query('sortOrder').optional({ nullable: true }).isIn(['asc', 'desc']), query('search').optional({ nullable: true }).isString().isLength({ max: 100 }), query('type').optional({ nullable: true }).isString().isLength({ max: 50 }), query('tenantId').optional({ nullable: true }).isString().isLength({ max: 100 }), query('domain').optional({ nullable: true }).isString().isLength({ max: 100 }), query('isActive').optional({ nullable: true }).isBoolean(), query('includeDeleted').optional({ nullable: true }).isBoolean(), query('fields').optional({ nullable: true }).isString().isLength({ max: 500 })];

// 8. BULK UPDATE BY TYPE ✅
const validateBulkUpdateByType = [body().notEmpty().withMessage('Update object required'), body('type').optional({ nullable: true }).notEmpty().bail().isString().isLength({ max: 50 }), body('sortOrder').optional({ nullable: true }).isInt({ min: 0, max: 9999 }), body('isActive').optional({ nullable: true }).isBoolean()];

// ============ ROUTES WITH VALIDATION ============

// Apply auth to all routes
// router.use(auth);

// CREATE - Single
router.post('/', authMiddleware, validateMasterPayload, validateRequest, masterController.create);

// CREATE - Bulk Upsert
router.post('/bulk-upsert', authMiddleware, validateBulkUpsert, validateRequest, masterController.bulkUpsert);

// READ - Paginated List
router.get('/list', validateListQuery, validateRequest, masterController.getList);

//
router.get('/data', masterController.getMastersGroupedByType);

// READ - Single by ID or Code
router.get('/:idOrCode', validateIdOrCodeParam, validateRequest, query('fields').optional().isString(), masterController.getByIdOrCode);

// UPDATE - Single by ID
router.put('/:id', authMiddleware, validateIdParam, validatePartialUpdate, validateRequest, masterController.updateById);
// UPDATE - Single by ID
router.patch('/:id', authMiddleware, validateIdParam, validatePartialUpdate, validateRequest, masterController.updateById);

// UPDATE - Bulk by Type
router.put('/type/:type/bulk', authMiddleware, param('type').isString().notEmpty().isLength({ max: 50 }), query('tenantId').optional().isString().isLength({ max: 100 }), validateBulkUpdateByType, validateRequest, masterController.bulkUpdateByType);
// UPDATE - Bulk by Type
router.patch('/type/:type/bulk', authMiddleware, param('type').isString().notEmpty().isLength({ max: 50 }), query('tenantId').optional().isString().isLength({ max: 100 }), validateBulkUpdateByType, validateRequest, masterController.bulkUpdateByType);

// DELETE - Single Soft Delete
router.delete('/:id', authMiddleware, validateIdParam, validateRequest, masterController.softDeleteById);

// DELETE - Bulk Soft Delete
router.delete('/bulk', authMiddleware, validateIdsArray, validateRequest, masterController.bulkDeleteByIds);

module.exports = { masterRoute: router };
