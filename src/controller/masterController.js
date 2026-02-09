// controllers/masterController.js
const MasterService = require('../services/masterDatahelper');
const { validationResult } = require('express-validator');
const AppError = require('../utils/appError');
const { sendSuccess, sendCreated, sendPaginated, HTTP_STATUS } = require('../utils/responseHelper');
const { catchAsync } = require('../middleware/errorHandler');

class MasterController {
  // CREATE - Single master record
  create = catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const payload = req.body;
    const userId = req.user?.id || null;

    await MasterService.create(payload, userId);

    return sendCreated(res, {
      message: 'Master record created successfully',
    });
  });

  // BULK UPSERT - Multiple records with upsert logic
  bulkUpsert = catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const list = req.body;
    const userId = req.user?.id || null;

    const result = await MasterService.bulkUpsert(list, userId);

    return sendSuccess(res, {
      data: result,
      message: 'Bulk upsert completed successfully',
    });
  });

  // GET BY ID or CODE
  getByIdOrCode = catchAsync(async (req, res) => {
    const { idOrCode, fields } = req.params;

    if (!idOrCode) {
      throw AppError.badRequest('idOrCode is required');
    }

    const doc = await MasterService.getByIdOrCode(idOrCode, fields);

    if (!doc) {
      throw AppError.notFound('Master record not found');
    }

    return sendSuccess(res, {
      data: doc,
      message: 'Master record retrieved successfully',
    });
  });

  // GET LIST with pagination and filters
  getList = catchAsync(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
      search,
      type,
      tenantId,
      domain,
      isActive,
      isArchive,
      fields,
    } = req.query;

    const result = await MasterService.getList({
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      search: search || '',
      type,
      tenantId,
      domain,
      isActive: isArchive === 'true' ? false : isActive === 'false' ? false : true,
      includeDeleted: isArchive === 'true',
      fields,
    });

    return sendSuccess(res, {
      data: result,
      message: 'Master records retrieved successfully',
    });
  });

  // GET MASTERS GROUPED BY TYPE
  getMastersGroupedByType = catchAsync(async (req, res) => {
    const { tenantId, domain, includeInactive, includeDeleted, fields, limitPerType = '1000' } = req.query;

    const tenantIdHeader = req.headers['x-tenant-id'] || tenantId;

    const result = await MasterService.getGroupedByType({
      tenantId: tenantIdHeader,
      domain,
      includeInactive: includeInactive === 'true',
      includeDeleted: includeDeleted === 'true',
      fields,
      limitPerType: parseInt(limitPerType),
    });

    return sendSuccess(res, {
      data: result,
      message: 'Masters grouped by type retrieved successfully',
    });
  });

  // UPDATE BY ID
  updateById = catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { id } = req.params;
    const payload = req.body;

    const doc = await MasterService.updateById(id, payload, req.user);

    if (!doc) {
      throw AppError.notFound('Master record not found');
    }

    return sendSuccess(res, {
      message: 'Master record updated successfully',
    });
  });

  // SOFT DELETE BY ID
  softDeleteById = catchAsync(async (req, res) => {
    const { id } = req.params;

    const doc = await MasterService.softDeleteById(id);

    if (!doc) {
      throw AppError.notFound('Master record not found');
    }

    return sendSuccess(res, {
      message: 'Record soft deleted successfully',
    });
  });

  // BULK DELETE BY IDs
  bulkDeleteByIds = catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const ids = req.body.ids;

    const result = await MasterService.bulkDeleteByIds(ids);

    return sendSuccess(res, {
      data: result,
      message: 'Bulk delete completed successfully',
    });
  });

  // BULK UPDATE BY TYPE (Utility endpoint)
  bulkUpdateByType = catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { type } = req.params;
    const update = req.body;
    const tenantId = req.query.tenantId;

    const result = await MasterService.bulkUpdateByType(type, update, tenantId);

    return sendSuccess(res, {
      data: result,
      message: 'Bulk update by type completed successfully',
    });
  });
}

module.exports = new MasterController();
