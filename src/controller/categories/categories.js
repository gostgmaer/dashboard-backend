const Category = require("../../models/categories");
const { standardResponse, errorResponse } = require('../../utils/apiUtils');
class CategoryController {


  // Basic Create
  static async create(req, res) {
    try {
      const category = new Category(req.body);
      if (req.user) category.createdBy = req.user._id;
      await category.save();
      return standardResponse(res, true, category, "Category created", 201);
    } catch (error) {
      return errorResponse(res, error.message, 400, error);
    }
  }

  // Get all with filters, pagination, population, search
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = "displayOrder",
        sortOrder = "asc",
        search = "",
        filters = {},
        populate = [],
        includeDeleted = false,
      } = req.query;

      const parsedFilters = typeof filters === "string" ? JSON.parse(filters) : filters;
      const parsedPopulate = typeof populate === "string" ? JSON.parse(populate) : populate;

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

      return standardResponse(res, true, categories, "Categories fetched");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Get single with details
  static async getSingle(req, res) {
    try {
      const { id } = req.params;
      const { populate = "[]" } = req.query;
      const parsedPopulate = typeof populate === "string" ? JSON.parse(populate) : populate;

      const category = await Category.getSingleWithDetailedStats({
        categoryId: id,
        populate: parsedPopulate,
      });

      if (!category) {
        return errorResponse(res, "Category not found", 404);
      }

      return standardResponse(res, true, category, "Category fetched");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Update category by ID
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      if (req.user) updateData.updatedBy = req.user._id;

      const category = await Category.findById(id);
      if (!category) {
        return errorResponse(res, "Category not found", 404);
      }

      Object.assign(category, updateData);
      await category.save();
      return standardResponse(res, true, category, "Category updated");
    } catch (error) {
      return errorResponse(res, error.message, 400, error);
    }
  }

  // Soft delete category recursively
  static async delete(req, res) {
    try {
      const { id } = req.params;
      await Category.removeWithDescendants(id);
      return standardResponse(res, true, null, "Category and descendants deleted");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Toggle featured flag instance method
  static async toggleFeatured(req, res) {
    try {
      const { id } = req.params;
      const category = await Category.findById(id);
      if (!category) return errorResponse(res, "Category not found", 404);

      await category.toggleFeatured();
      return standardResponse(res, true, category, "Featured status toggled");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Change status instance method
  static async changeStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) return errorResponse(res, "Status is required", 400);

      const category = await Category.findById(id);
      if (!category) return errorResponse(res, "Category not found", 404);

      await category.changeStatus(status, req.user?._id);
      return standardResponse(res, true, category, "Status updated");
    } catch (error) {
      return errorResponse(res, error.message, 400, error);
    }
  }

  // Paginate with static paginate()
  static async paginate(req, res) {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortBy: req.query.sortBy || "createdAt",
        sortOrder: req.query.sortOrder || "desc",
        filter: req.query.filter ? JSON.parse(req.query.filter) : {}
      };
      const result = await Category.paginate(options);
      return standardResponse(res, true, result, "Paginated categories");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Get category tree
  static async getTree(req, res) {
    try {
      const tree = await Category.getTree();
      return standardResponse(res, true, tree, "Category tree fetched");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Bulk status update static
  static async bulkUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || !status) {
        return errorResponse(res, "Invalid input", 400);
      }
      const result = await Category.bulkUpdateStatus(ids, status);
      return standardResponse(res, true, result, "Bulk update successful");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Export CSV static
  static async exportCSV(req, res) {
    try {
      const filter = req.query.filter ? JSON.parse(req.query.filter) : {};
      const csv = await Category.exportCSV(filter);
      res.header("Content-Type", "text/csv");
      res.attachment("categories.csv");
      res.send(csv);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }
    // Get featured categories
  static async getFeaturedCategories(req, res) {
    try {
      const featuredCategories = await Category.getFeaturedCategories();
      return standardResponse(res, true, featuredCategories, "Featured categories fetched");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Get active categories
  static async getActiveCategories(req, res) {
    try {
      const activeCats = await Category.getActiveCategories();
      return standardResponse(res, true, activeCats, "Active categories fetched");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Search categories by keyword
  static async searchCategories(req, res) {
    try {
      const { query } = req.query;
      if (!query) return errorResponse(res, "Search query required", 400);
      const results = await Category.searchCategories(query);
      return standardResponse(res, true, results, "Search results");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Get category stats summary
  static async getStats(req, res) {
    try {
      const stats = await Category.getStats();
      return standardResponse(res, true, stats, "Category stats fetched");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Aggregate by status summary
  static async aggregateByStatus(req, res) {
    try {
      const aggregate = await Category.aggregateByStatus();
      return standardResponse(res, true, aggregate, "Category status aggregation");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Soft delete many categories
  static async softDeleteMany(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return errorResponse(res, "IDs array required", 400);
      const result = await Category.softDeleteMany(ids);
      return standardResponse(res, true, result, "Soft deleted multiple categories");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Bulk import categories
  static async importBulk(req, res) {
    try {
      const categories = req.body;
      if (!Array.isArray(categories)) {
        return errorResponse(res, "Array of categories required", 400);
      }
      const result = await Category.importBulk(categories);
      return standardResponse(res, true, result, "Bulk import successful");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Batch update display orders
  static async batchUpdateDisplayOrders(req, res) {
    try {
      const updates = req.body; // array of { id, displayOrder }
      if (!Array.isArray(updates)) return errorResponse(res, "Array of updates required", 400);

      const result = await Category.batchUpdateDisplayOrders(updates);
      return standardResponse(res, true, result, "Batch display order update successful");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  // Featured stats summary
  static async featuredStats(req, res) {
    try {
      const stats = await Category.featuredStats();
      return standardResponse(res, true, stats, "Featured category stats");
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }
}

module.exports = CategoryController;
