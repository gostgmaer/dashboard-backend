const Category = require('../../models/categories');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

class CategoryController {
  // Basic Create
  static create = catchAsync(async (req, res) => {
    const category = new Category(req.body);
    if (req.user) category.created_by = req.user._id;
    await category.save();
    return sendCreated(res, {
      data: category,
      message: 'Category created',
    });
  });

  // Get all with filters, pagination, population, search
  static getAll = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, sortBy = 'displayOrder', sortOrder = 'asc', search = '', filters = {}, populate = [], includeDeleted = false } = req.query;

    const parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;
    const parsedPopulate = typeof populate === 'string' ? JSON.parse(populate) : populate;

    const categories = await Category.getAllWithDetailedStats({
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      filters: parsedFilters,
      search,
      populate: parsedPopulate,
      includeDeleted,
    });

    return sendSuccess(res, {
      data: categories,
      message: 'Categories fetched',
    });
  });

  // Get single with details
  static getSingle = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { populate = '[]' } = req.query;
    const parsedPopulate = typeof populate === 'string' ? JSON.parse(populate) : populate;

    const category = await Category.getSingleWithDetailedStats({
      categoryId: id,
      populate: parsedPopulate,
    });

    if (!category) {
      throw AppError.notFound('Category not found');
    }

    return sendSuccess(res, {
      data: category,
      message: 'Category fetched',
    });
  });

  // Update category by ID
  static update = catchAsync(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    if (req.user) updateData.updated_by = req.user._id;

    const category = await Category.findById(id);
    if (!category) {
      throw AppError.notFound('Category not found');
    }

    Object.assign(category, updateData);
    await category.save();
    return sendSuccess(res, {
      data: category,
      message: 'Category updated',
    });
  });

  // Soft delete category recursively
  static delete = catchAsync(async (req, res) => {
    const { id } = req.params;
    await Category.removeWithDescendants(id);
    return sendSuccess(res, {
      message: 'Category and descendants deleted',
    });
  });

  // Toggle featured flag instance method
  static toggleFeatured = catchAsync(async (req, res) => {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      throw AppError.notFound('Category not found');
    }

    await category.toggleFeatured();
    return sendSuccess(res, {
      data: category,
      message: 'Featured status toggled',
    });
  });

  // Change status instance method
  static changeStatus = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      throw AppError.badRequest('Status is required');
    }

    const category = await Category.findById(id);
    if (!category) {
      throw AppError.notFound('Category not found');
    }

    await category.changeStatus(status, req.user?._id);
    return sendSuccess(res, {
      data: category,
      message: 'Status updated',
    });
  });

  // Paginate with static paginate()
  static paginate = catchAsync(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc',
      filter: req.query.filter ? JSON.parse(req.query.filter) : {},
    };
    const result = await Category.paginate(options);
    return sendSuccess(res, {
      data: result,
      message: 'Paginated categories',
    });
  });

  // Get category tree
  static getTree = catchAsync(async (req, res) => {
    const tree = await Category.getTree();
    return sendSuccess(res, {
      data: tree,
      message: 'Category tree fetched',
    });
  });

  // Bulk status update static
  static bulkUpdateStatus = catchAsync(async (req, res) => {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !status) {
      throw AppError.badRequest('Invalid input');
    }
    const result = await Category.bulkUpdateStatus(ids, status);
    return sendSuccess(res, {
      data: result,
      message: 'Bulk update successful',
    });
  });

  // Export CSV static
  static exportCSV = catchAsync(async (req, res) => {
    const filter = req.query.filter ? JSON.parse(req.query.filter) : {};
    const csv = await Category.exportCSV(filter);
    res.header('Content-Type', 'text/csv');
    res.attachment('categories.csv');
    res.send(csv);
  });

  // Get featured categories
  static getFeaturedCategories = catchAsync(async (req, res) => {
    const featuredCategories = await Category.getFeaturedCategories();
    return sendSuccess(res, {
      data: featuredCategories,
      message: 'Featured categories fetched',
    });
  });

  // Get active categories
  static getActiveCategories = catchAsync(async (req, res) => {
    const activeCats = await Category.getActiveCategories();
    return sendSuccess(res, {
      data: activeCats,
      message: 'Active categories fetched',
    });
  });

  // Search categories by keyword
  static searchCategories = catchAsync(async (req, res) => {
    const { query } = req.query;
    if (!query) {
      throw AppError.badRequest('Search query required');
    }
    const results = await Category.searchCategories(query);
    return sendSuccess(res, {
      data: results,
      message: 'Search results',
    });
  });

  // Get category stats summary
  static getStats = catchAsync(async (req, res) => {
    const stats = await Category.getStats();
    return sendSuccess(res, {
      data: stats,
      message: 'Category stats fetched',
    });
  });

  // Aggregate by status summary
  static aggregateByStatus = catchAsync(async (req, res) => {
    const aggregate = await Category.aggregateByStatus();
    return sendSuccess(res, {
      data: aggregate,
      message: 'Category status aggregation',
    });
  });

  // Soft delete many categories
  static softDeleteMany = catchAsync(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      throw AppError.badRequest('IDs array required');
    }
    const result = await Category.softDeleteMany(ids);
    return sendSuccess(res, {
      data: result,
      message: 'Soft deleted multiple categories',
    });
  });

  // Bulk import categories
  static importBulk = catchAsync(async (req, res) => {
    const categories = req.body;
    if (!Array.isArray(categories)) {
      throw AppError.badRequest('Array of categories required');
    }
    const result = await Category.importBulk(categories);
    return sendSuccess(res, {
      data: result,
      message: 'Bulk import successful',
    });
  });

  // Batch update display orders
  static batchUpdateDisplayOrders = catchAsync(async (req, res) => {
    const updates = req.body;
    if (!Array.isArray(updates)) {
      throw AppError.badRequest('Array of updates required');
    }

    const result = await Category.batchUpdateDisplayOrders(updates);
    return sendSuccess(res, {
      data: result,
      message: 'Batch display order update successful',
    });
  });

  // Featured stats summary
  static featuredStats = catchAsync(async (req, res) => {
    const stats = await Category.featuredStats();
    return sendSuccess(res, {
      data: stats,
      message: 'Featured category stats',
    });
  });
}

module.exports = CategoryController;
