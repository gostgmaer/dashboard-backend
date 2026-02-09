const Component = require('../models/components');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../utils/responseHelper');
const AppError = require('../utils/appError');
const { catchAsync } = require('../middleware/errorHandler');

class ComponentController {
  static createComponent = catchAsync(async (req, res) => {
    const component = await Component.createComponent(req.body);
    return sendCreated(res, {
      data: component,
      message: 'Component created successfully',
    });
  });

  static getComponents = catchAsync(async (req, res) => {
    const components = await Component.getComponents(req.query);
    return sendSuccess(res, {
      data: components,
      message: 'Components retrieved successfully',
    });
  });

  static getComponentById = catchAsync(async (req, res) => {
    const component = await Component.getComponentById(req.params.id);
    if (!component) {
      throw AppError.notFound('Component not found');
    }
    return sendSuccess(res, {
      data: component,
      message: 'Component retrieved successfully',
    });
  });

  static updateComponent = catchAsync(async (req, res) => {
    const component = await Component.updateComponent(req.params.id, req.body);
    if (!component) {
      throw AppError.notFound('Component not found');
    }
    return sendSuccess(res, {
      data: component,
      message: 'Component updated successfully',
    });
  });

  static deleteComponent = catchAsync(async (req, res) => {
    const result = await Component.deleteComponent(req.params.id);
    if (!result) {
      throw AppError.notFound('Component not found');
    }
    return sendSuccess(res, {
      message: 'Component deleted successfully',
    });
  });

  static getComponentsByType = catchAsync(async (req, res) => {
    const components = await Component.getComponentsByType(req.params.type);
    return sendSuccess(res, {
      data: components,
      message: 'Components retrieved successfully',
    });
  });

  static getRecentlyAdded = catchAsync(async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const components = await Component.getRecentlyAdded(days);
    return sendSuccess(res, {
      data: components,
      message: 'Recently added components retrieved successfully',
    });
  });

  static brandStats = catchAsync(async (req, res) => {
    const stats = await Component.brandStats();
    return sendSuccess(res, {
      data: stats,
      message: 'Brand statistics retrieved successfully',
    });
  });

  static getTopPriced = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const components = await Component.getTopPriced(limit);
    return sendSuccess(res, {
      data: components,
      message: 'Top priced components retrieved successfully',
    });
  });

  static getLowestPriced = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const components = await Component.getLowestPriced(limit);
    return sendSuccess(res, {
      data: components,
      message: 'Lowest priced components retrieved successfully',
    });
  });

  static bulkDelete = catchAsync(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      throw AppError.badRequest('ids must be a non-empty array');
    }
    const result = await Component.deleteMany({ _id: { $in: ids } });
    return sendSuccess(res, {
      data: { deletedCount: result.deletedCount },
      message: `${result.deletedCount} components deleted`,
    });
  });

  static bulkUpdate = catchAsync(async (req, res) => {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      throw AppError.badRequest('updates must be an array');
    }
    const promises = updates.map((u) => Component.findByIdAndUpdate(u.id, u.data, { new: true }));
    const updated = await Promise.all(promises);
    return sendSuccess(res, {
      data: updated,
      message: 'Bulk update successful',
    });
  });

  static bulkImport = catchAsync(async (req, res) => {
    if (!Array.isArray(req.body.components)) {
      throw AppError.badRequest('components must be an array');
    }
    const created = await Component.insertMany(req.body.components, { ordered: false });
    return sendSuccess(res, {
      data: created,
      message: 'Bulk import successful',
    });
  });
}

module.exports = ComponentController;
