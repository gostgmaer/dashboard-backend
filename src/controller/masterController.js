// controllers/masterController.js
const MasterService = require('../services/masterDatahelper');
const { validationResult } = require('express-validator');
const AppError = require('../utils/appError'); // Assuming you have a standard error class
const { standardResponse, errorResponse } = require('../utils/apiUtils');

class MasterController {
  // CREATE - Single master record
  async create(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Validation failed', errors.array()));
      }

      const payload = req.body;
      const userId = req.user?.id || null;

      await MasterService.create(payload, userId);

      standardResponse(res, true, null, `Master Record Created SuccessFull!`, 201);
    } catch (error) {
      errorResponse(res, error.message, error.statusCode || 500);
    }
  }

  // BULK UPSERT - Multiple records with upsert logic
  async bulkUpsert(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Validation failed', errors.array()));
      }

      const list = req.body;
      const userId = req.user?.id || null;

      const result = await MasterService.bulkUpsert(list, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET BY ID or CODE
  async getByIdOrCode(req, res, next) {
    try {
      const { idOrCode, fields } = req.params;

      if (!idOrCode) {
        return next(new AppError(400, 'idOrCode is required'));
      }

      const doc = await MasterService.getByIdOrCode(idOrCode, fields);

      if (!doc) {
        return next(new AppError(404, 'Master record not found'));
      }

      res.status(200).json({
        success: true,
        data: doc,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET LIST with pagination and filters
  async getList(req, res, next) {
    try {
      const { page = 1, limit = 20, sortBy = 'sortOrder', sortOrder = 'asc', search, type, tenantId, domain, isActive, isArchive, fields } = req.query;

      const result = await MasterService.getList({
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        search: search || '',
        type,
        tenantId,
        domain,
        isActive: isActive === 'true',
        includeDeleted: isArchive === 'true',
        fields,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
  async getMastersGroupedByType(req, res, next) {
    try {
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

      standardResponse(res, true, result, `Master Record Created SuccessFul!`, 200);
    } catch (err) {
      console.error('getMastersGroupedByType error', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
  // UPDATE BY ID
  async updateById(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Validation failed', errors.array()));
      }

      const { id } = req.params;
      const payload = req.body;

      const doc = await MasterService.updateById(id, payload,req.user);

      if (!doc) {
        return next(new AppError(404, 'Master record not found'));
      }
     standardResponse(res, true, null, `Master Record Update Successfull!`, 200);
    } catch (error) {
      next(error);
    }
  }

  // SOFT DELETE BY ID
  async softDeleteById(req, res, next) {
    try {
      const { id } = req.params;

      const doc = await MasterService.softDeleteById(id);

      if (!doc) {
        return next(new AppError(404, 'Master record not found'));
      }

      res.status(200).json({
        success: true,
        message: 'Record soft deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // BULK DELETE BY IDs
  async bulkDeleteByIds(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Validation failed', errors.array()));
      }

      const ids = req.body.ids;

      const result = await MasterService.bulkDeleteByIds(ids);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // BULK UPDATE BY TYPE (Utility endpoint)
  async bulkUpdateByType(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Validation failed', errors.array()));
      }

      const { type } = req.params;
      const update = req.body;
      const tenantId = req.query.tenantId;

      const result = await MasterService.bulkUpdateByType(type, update, tenantId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MasterController();
