const Product = require('../models/products');
const User = require('../models/user');
const Order = require('../models/orders');
const mongoose = require('mongoose');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../utils/apiUtils');
const { validationResult } = require('express-validator');
const { buildFilters } = require('../utils/helper');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
// const ActivityHelper = require('../utils/activityHelpers');
const DeviceDetector = require('../services/deviceDetector');
const NotificationMiddleware = require('../middleware/notificationMiddleware');
const ActivityHelper = require('../services/activityHelpers');

/**
 * 🚀 CONSOLIDATED ROBUST PRODUCT CONTROLLER
 *
 * Features:
 * ✅ Complete CRUD operations
 * ✅ All 42 model methods exposed
 * ✅ Bulk operations (delete, update, stock)
 * ✅ Virtual properties and statistics
 * ✅ Error handling with try-catch
 * ✅ Soft delete functionality
 * ✅ Population of related data
 * ✅ Dynamic filtering, sorting, pagination
 * ✅ Smart population based on operation type
 * ✅ Automatic field calculations
 * ✅ Parameter-based queries
 * ✅ Comprehensive validation
 * ✅ Performance optimized
 * ✅ Standardized responses
 * ✅ Authentication & role-based access
 */

class ProductController {
  // ========================================
  // 🔧 UTILITY METHODS
  // ========================================

  static calculateFinalPrice(product) {
    if (!product.basePrice) return 0;

    let finalPrice = product.basePrice;

    // Apply discount if active
    if (product.discount && product.discountStartDate && product.discountEndDate) {
      const now = new Date();
      if (now >= new Date(product.discountStartDate) && now <= new Date(product.discountEndDate)) {
        finalPrice = product.basePrice - (product.basePrice * product.discount) / 100;
      }
    }

    // Apply sale price if lower
    if (product.salePrice && product.salePrice < finalPrice) {
      finalPrice = product.salePrice;
    }

    return Math.max(0, Math.round(finalPrice * 100) / 100);
  }

  static getStockStatus(product) {
    if (!product.isAvailable) return 'Out of Stock';
    if (product.backorder) return 'Backorder Available';
    if (product.inventory <= (product.lowStockThreshold || 0)) return 'Low Stock';
    return 'In Stock';
  }

  static getDiscountPercent(product) {
    if (!product.discount || !product.discountStartDate || !product.discountEndDate) return 0;

    const now = new Date();
    if (now >= new Date(product.discountStartDate) && now <= new Date(product.discountEndDate)) {
      return product.discount;
    }
    return 0;
  }

  static isLowStock(product) {
    return product.inventory <= (product.lowStockThreshold || 0);
  }

  static enrichProduct(product, includeCalculated = true) {
    const productObj = product.toObject ? product.toObject() : product;

    if (includeCalculated) {
      return {
        ...productObj,
        finalPrice: this.calculateFinalPrice(productObj),
        stockStatus: this.getStockStatus(productObj),
        discountPercent: this.getDiscountPercent(productObj),
        isLowStock: this.isLowStock(productObj),
      };
    }

    return productObj;
  }

  // ========================================
  // 📋 CRUD OPERATIONS
  // ========================================

  /**
   * CREATE PRODUCT - with validation and auto-calculations
   */
  static async createProduct(req, res) {
    try {
      const deviceinfo = DeviceDetector.detectDevice(req);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, errors.array());
      }

      const productData = req.body;

      // Auto-generate fields
      if (productData.title && !productData.slug) {
        productData.slug = productData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      // Set created/updated by
      // if (req.user) {
      //   productData.created_by = req.user.id;
      //   productData.updated_by = req.user.id;
      // }

      // Auto-calculate fields
      if (productData.basePrice && productData.discount) {
        productData.salePrice = productData.basePrice - (productData.basePrice * productData.discount) / 100;
      }
      productData.currentStockLevel = productData.inventory || 0;
      // Set inventory tracking
      // if (productData.inventory !== undefined) {

      // }

      const product = new Product(productData);
      await product.save();
      // await ActivityHelper.logCRUD(req, 'product', 'create', {
      //   id: product._id,
      //   name: product.title,
      //   category: product.category,
      //   price: product.basePrice,
      // });
      res.locals.createdProduct = product;
      await NotificationMiddleware.onProductCreated(req, res, () => {});
      return standardResponse(res, true, ProductController.enrichProduct(product), 'Product created successfully', 201);
    } catch (error) {
      console.error('Create product error:', error);

      return errorResponse(res, 'Failed to create product', 500, error.message);
    }
  }

  /**
   * GET ALL PRODUCTS - with advanced filtering, sorting, pagination
   */
  static async getProducts(req, res) {
    try {
      let { page = 1, limit = 10, sort = 'createdAt', order = 'desc', search,  isActive,
      isArchive, status, productType, category, minPrice, maxPrice, ...otherFilters } = req.query;

      page = Number(page);
      limit = Number(limit);

      // --- Filters ---
      const filters = { deletedAt: { $exists: false } };

      if (isArchive === 'true') {
      filters.isDeleted = true;
      filters.isActive = false;
    } else {
      filters.isDeleted = isArchive === 'true' ? { $in: [true, false] } : false;
      filters.isActive =
        isActive === 'false'
          ? false
          : true; // default active
    }

      if (status) filters.status = status;
      if (productType) filters.productType = productType;
      if (category) filters.categories = category;

      if (minPrice || maxPrice) {
        filters.basePrice = {};
        if (minPrice) filters.basePrice.$gte = Number(minPrice);
        if (maxPrice) filters.basePrice.$lte = Number(maxPrice);
      }

      otherFilters = buildFilters(otherFilters);

      for (const key of Object.keys(otherFilters)) {
        const value = otherFilters[key];
        if (value && value !== '' && value !== 'undefined') {
          switch (key) {
            case 'categories':
            case 'tags':
              filters[key] = Array.isArray(value) ? { $in: value } : { $in: value.split(',') };
              break;
            case 'isFeatured':
            case 'trending':
            case 'newArrival':
            case 'bestseller':
            case 'onSale':
            case 'isAvailable':
            case 'ecoFriendly':
              filters[key] = value === 'true';
              break;
            default:
              if (typeof value === 'string' && value.includes(',')) {
                filters[key] = { $in: value.split(',') };
              } else {
                filters[key] = value;
              }
          }
        }
      }

      // --- Search ---
      if (search) {
        filters.$or = [{ title: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }, { tags: { $regex: search, $options: 'i' } }, { 'descriptions.short': { $regex: search, $options: 'i' } }, { productType: { $regex: search, $options: 'i' } }];
      }

      // --- Sort ---
      const sortObj = {};
      sortObj[sort] = order === 'desc' ? -1 : 1;

      // --- Count total ---
      const total = await Product.countDocuments(filters);

      // --- Query ---
      let query = Product.find(filters)
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit)
        .select('title brand category basePrice status _id slug sku createdAt inventory isFeatured bestSeller finalPrice stockStatus discountPercent isLowStock discountType discount discountValue  salePrice ') // ✅ Only required fields
        .populate({ path: 'brand', select: 'name' })
        .populate({ path: 'category', select: 'title' })
        .lean(); // ✅ Fast, returns plain JS objects

      const products = await query.exec();

      // --- Transform _id → id ---
      const result = products.map((p) => ({
        ...p,
        id: p._id,
        _id: undefined,
      }));

      // --- Response ---
      const response = {
        result,
        pagination: {
          page,
          totalPages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
          limit,
        },
        filters: {
          applied: Object.keys(filters).length - 1,
          search: search || null,
        },
      };

      return standardResponse(res, true, response, `Retrieved ${result.length} products`);
    } catch (error) {
      console.error('Error in getProducts:', error);
      return errorResponse(res, 'Failed to fetch products', 500, error.message);
    }
  }

  static async getAdvanceProductSearch(req, res) {
    try {
      const result = await Product.advancedFilter(req.query);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET SINGLE PRODUCT BY ID OR SLUG - with comprehensive population
   */
  static async getProductByIdOrSlug(req, res) {
    try {
      const { identifier } = req.params;
      const { populate } = req.query;

      // Validate ObjectId if it looks like one
      if (mongoose.Types.ObjectId.isValid(identifier) && identifier.length === 24) {
        // It's likely an ObjectId, validate it
      }

      // Comprehensive population for single product view
      const defaultPopulate = [
        { path: 'categories', select: 'name slug description' },
        { path: 'category', select: 'name slug description' },
        { path: 'brand', select: 'name logo description website' },
        { path: 'reviews', select: 'rating comment user createdAt', populate: { path: 'user', select: 'name avatar' } },
        { path: 'relatedProducts', select: 'title mainImage basePrice salePrice status availability' },
        { path: 'created_by', select: 'name email' },
        { path: 'updated_by', select: 'name email' },
        { path: 'bundleContents.product', select: 'title mainImage basePrice salePrice' },
      ];

      let populateOptions = defaultPopulate;
      if (populate) {
        const populateFields = populate.split(',');
        populateOptions = populateFields.map((field) => ({ path: field.trim() }));
      }

      const product = await Product.findOne({
        $or: [{ _id: identifier }, { slug: identifier }],
        deletedAt: { $exists: false },
      }).populate(populateOptions);

      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      // Increment view count
      await Product.findByIdAndUpdate(product._id, { $inc: { views: 1, 'analytics.views': 1 } });

      // Calculate additional fields
      const enrichedProduct = {
        ...ProductController.enrichProduct(product),
        ratingStats: product.ratingStatistics,
        seoData: product.getSEOData(),
        isExpired: product.isExpired(),
        needsRestock: product.needsRestock(),
      };
      // Optional: Set custom activity info using middleware helper
      req.setActivity('viewed product details', {
        productId: product.id,
        productName: product.title,
        category: product.category.name,
      });
      return standardResponse(res, true, enrichedProduct, 'Product retrieved successfully');
    } catch (error) {
      console.error('Failed to fetch product:', error);
      return errorResponse(res, 'Failed to fetch product', 500, error.message);
    }
  }

  /**
   * UPDATE PRODUCT - with smart field updates and auto-calculations
   */
  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, 'Validation failed', 400, errors.array());
      }

      // Remove fields that shouldn't be directly updated
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.created_by;

      // Auto-update fields
      if (req.user) {
        updateData.updated_by = req.user.id;
      }
      updateData.updatedAt = new Date();

      // Auto-calculate sale price if discount or base price changed
      if (updateData.basePrice || updateData.discount) {
        const product = await Product.findById(id);
        if (product) {
          const basePrice = updateData.basePrice || product.basePrice;
          const discount = updateData.discount || product.discount || 0;
          updateData.salePrice = basePrice - (basePrice * discount) / 100;
        }
      }

      // Update slug if title changed
      if (updateData.title && !updateData.slug) {
        updateData.slug = updateData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      // Update stock level if inventory changed
      if (updateData.inventory !== undefined) {
        updateData.currentStockLevel = updateData.inventory;
      }

      // Handle availability based on stock
      if (updateData.inventory === 0) {
        updateData.isAvailable = false;
        updateData.availability = 'Out of Stock';
      } else if (updateData.inventory > 0 && updateData.isAvailable !== false) {
        updateData.isAvailable = true;
        updateData.availability = 'In Stock';
      }

      const product = await Product.findOneAndUpdate({ _id: id, deletedAt: { $exists: false } }, { $set: updateData }, { new: true, runValidators: true }).populate([
        { path: 'categories', select: 'name slug' },
        { path: 'brand', select: 'name logo' },
        { path: 'updated_by', select: 'name email' },
      ]);

      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }
      // Using manual logging with detailed info
      await ActivityHelper.logCRUD(req, 'product', 'Update', {
        id: product._id,
        name: product.title,
        category: product.category,
        price: product.price,
      });
      res.locals.product = product;
      await NotificationMiddleware.onProductUpdated(req, res, () => {});
      return standardResponse(res, true, ProductController.enrichProduct(product), 'Product updated successfully');
    } catch (error) {
      console.error('Failed to update product:', error);

      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return errorResponse(res, `${field} already exists`, 400, 'Duplicate key error');
      }

      return errorResponse(res, 'Failed to update product', 500, error.message);
    }
  }

  /**
   * DELETE PRODUCT - soft delete with archive
   */

  static async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?._id; // optional (from auth middleware)

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required',
        });
      }

      const deletedProduct = await Product.findOneAndUpdate(
        {
          _id: id,
          isDeleted: { $ne: true }, // prevent double delete
        },
        {
          $set: {
            isDeleted: true,
            isActive: false,
            status: 'archived',
            isAvailable: false,
            updated_by: userId || null,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!deletedProduct) {
        return res.status(404).json({
          success: false,
          message: 'Product not found or already deleted',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Product soft deleted successfully',
        data: deletedProduct,
      });
    } catch (error) {
      console.error('Soft Delete Product Error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
      });
    }
  }

  static async restoreProduct(req, res) {
    try {
      const { id } = req.params;

      const restored = await Product.findOneAndUpdate(
        {
          _id: id,
          isDeleted: true,
        },
        {
          $set: {
            isDeleted: false,
            isActive: true,
            status: 'active',
            isAvailable: true,
          },
        },
        { new: true }
      );

      if (!restored) {
        return res.status(404).json({
          success: false,
          message: 'Product not found or not deleted',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Product restored successfully',
        data: restored,
      });
    } catch (error) {
      console.error('Restore Product Error:', error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
  // ========================================
  // 📦 BULK OPERATIONS
  // ========================================

  /**
   * BULK DELETE PRODUCTS
   */
  static async bulkDeleteProducts(req, res) {
    try {
      const { ids, permanent = false } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 'Invalid or empty IDs array', 400);
      }

      const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length !== ids.length) {
        return errorResponse(res, 'Some product IDs are invalid', 400);
      }

      let result;
      if (permanent) {
        result = await Product.deleteMany(
          {
            _id: { $in: validIds },
            deletedAt: { $exists: false },
          },
          req.body.user._id
        );
      } else {
        await Product.bulkDelete(validIds);
        result = { deletedCount: validIds.length };
      }

      return standardResponse(
        res,
        true,
        {
          deletedCount: result.deletedCount || validIds.length,
          ids: validIds,
        },
        permanent ? `Permanently deleted ${result.deletedCount || validIds.length} products` : `Deleted ${validIds.length} products successfully`
      );
    } catch (error) {
      console.error('Failed to bulk delete products:', error);
      return errorResponse(res, 'Failed to bulk delete products', 500, error.message);
    }
  }

  /**
   * BULK UPDATE STATUS
   */
  static async bulkUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;

      if (!Array.isArray(ids) || !status) {
        return errorResponse(res, 'Invalid input: ids and status required', 400);
      }

      if (!['active', 'inactive', 'draft', 'pending', 'archived', 'published'].includes(status)) {
        return errorResponse(res, 'Invalid status value', 400);
      }

      const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length !== ids.length) {
        return errorResponse(res, 'Some product IDs are invalid', 400);
      }

      const result = await Product.bulkUpdateStatus(validIds, status);
      res.locals.product = result;
      await NotificationMiddleware.onProductBackInStock(req, res, () => {});
      return standardResponse(
        res,
        true,
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          status: status,
        },
        `Updated ${result.modifiedCount} product statuses successfully`
      );
    } catch (error) {
      console.error('Failed to bulk update status:', error);
      return errorResponse(res, 'Failed to update statuses', 500, error.message);
    }
  }

  /**
   * BULK UPDATE STOCK
   */
  static async bulkUpdateStock(req, res) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return errorResponse(res, 'Invalid or empty updates array', 400);
      }

      if (updates.some((u) => !u.id || u.stock < 0)) {
        return errorResponse(res, 'Invalid stock updates', 400);
      }

      const result = await Product.bulkUpdateStock(updates);

      return standardResponse(
        res,
        true,
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          updates: updates.length,
        },
        `Updated ${result.modifiedCount} product stocks successfully`
      );
    } catch (error) {
      console.error('Failed to bulk update stock:', error);
      return errorResponse(res, 'Failed to update stocks', 500, error.message);
    }
  }

  // ========================================
  // 🔍 STATIC METHOD ENDPOINTS
  // ========================================

  /**
   * SEARCH PRODUCTS
   */
  static async searchProducts(req, res) {
    try {
      const { keyword } = req.params;
      const { limit = 20, category, priceMin, priceMax, sort = 'relevance' } = req.query;

      if (!keyword) {
        return errorResponse(res, 'Search keyword is required', 400);
      }

      let products;

      if (category || priceMin || priceMax || sort !== 'relevance') {
        // Advanced search with filters
        const searchQuery = {
          $text: { $search: keyword },
          deletedAt: { $exists: false },
          status: 'active',
        };

        // Add filters
        if (category) searchQuery.categories = category;
        if (priceMin || priceMax) {
          searchQuery.basePrice = {};
          if (priceMin) searchQuery.basePrice.$gte = Number(priceMin);
          if (priceMax) searchQuery.basePrice.$lte = Number(priceMax);
        }

        // Sort options
        let sortObj = {};
        switch (sort) {
          case 'price_low':
            sortObj = { basePrice: 1 };
            break;
          case 'price_high':
            sortObj = { basePrice: -1 };
            break;
          case 'newest':
            sortObj = { createdAt: -1 };
            break;
          case 'popular':
            sortObj = { views: -1 };
            break;
          default:
            sortObj = { score: { $meta: 'textScore' } };
        }

        products = await Product.find(searchQuery)
          .populate([
            { path: 'categories', select: 'name slug' },
            { path: 'brand', select: 'name logo' },
          ])
          .sort(sortObj)
          .limit(parseInt(limit));
      } else {
        // Simple search using model method
        products = await Product.searchProducts(keyword, Number(limit));
      }

      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(
        res,
        true,
        {
          products: enrichedProducts,
          searchQuery: keyword,
          filters: { category, priceMin, priceMax, sort },
        },
        `Found ${enrichedProducts.length} products for "${keyword}"`
      );
    } catch (error) {
      console.error('Failed to search products:', error);
      return errorResponse(res, 'Failed to search products', 500, error.message);
    }
  }

  /**
   * GET FEATURED PRODUCTS
   */
  static async getFeaturedProducts(req, res) {
    try {
      const { limit = 10 } = req.query;

      const products = await Product.getFeaturedProducts(Number(limit));
      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Retrieved ${enrichedProducts.length} featured products`);
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
      return errorResponse(res, 'Failed to fetch featured products', 500, error.message);
    }
  }

  /**
   * GET LOW STOCK PRODUCTS
   */
  static async getLowStockProducts(req, res) {
    try {
      const products = await Product.getLowStockProducts();
      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Found ${enrichedProducts.length} low stock products`);
    } catch (error) {
      console.error('Failed to fetch low stock products:', error);
      return errorResponse(res, 'Failed to fetch low stock products', 500, error.message);
    }
  }

  /**
   * GET OUT OF STOCK PRODUCTS
   */
  static async getOutOfStockProducts(req, res) {
    try {
      const products = await Product.getOutOfStockProducts();
      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Found ${enrichedProducts.length} out-of-stock products`);
    } catch (error) {
      console.error('Failed to fetch out-of-stock products:', error);
      return errorResponse(res, 'Failed to fetch out-of-stock products', 500, error.message);
    }
  }

  /**
   * GET PRODUCTS BY CATEGORY
   */
  static async getProductsByCategory(req, res) {
    try {
      const { categoryId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return errorResponse(res, 'Invalid category ID format', 400);
      }

      const products = await Product.getByCategory(categoryId);
      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Retrieved ${enrichedProducts.length} products from category`);
    } catch (error) {
      console.error('Failed to fetch products by category:', error);
      return errorResponse(res, 'Failed to fetch products by category', 500, error.message);
    }
  }

  /**
   * GET PRODUCTS BY TAG
   */
  static async getProductsByTag(req, res) {
    try {
      const { tags } = req.params;
      const { limit = 20 } = req.query;

      const tagArray = tags.split(',');
      const products = await Product.getProductsByTag(tagArray, Number(limit));
      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Retrieved ${enrichedProducts.length} products with tags: ${tagArray.join(', ')}`);
    } catch (error) {
      console.error('Failed to fetch products by tags:', error);
      return errorResponse(res, 'Failed to fetch products by tags', 500, error.message);
    }
  }

  /**
   * GET NEW ARRIVALS
   */
  static async getNewArrivals(req, res) {
    try {
      const { days = 30, limit = 10 } = req.query;

      const products = await Product.getNewArrivals(Number(days), Number(limit));
      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Retrieved ${enrichedProducts.length} new arrivals from last ${days} days`);
    } catch (error) {
      console.error('Failed to fetch new arrivals:', error);
      return errorResponse(res, 'Failed to fetch new arrivals', 500, error.message);
    }
  }

  /**
   * GET PRODUCTS BY PRICE RANGE
   */
  static async getProductsByPriceRange(req, res) {
    try {
      const { minPrice = 0, maxPrice = Infinity, limit = 20 } = req.query;

      const products = await Product.getProductsByPriceRange(Number(minPrice), Number(maxPrice) === Infinity ? Number.MAX_SAFE_INTEGER : Number(maxPrice), Number(limit));
      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Retrieved ${enrichedProducts.length} products in price range $${minPrice} - $${maxPrice}`);
    } catch (error) {
      console.error('Failed to fetch products by price range:', error);
      return errorResponse(res, 'Failed to fetch products by price range', 500, error.message);
    }
  }

  /**
   * GET TOP SELLING PRODUCTS
   */
  static async getTopSellingProducts(req, res) {
    try {
      const { limit = 10 } = req.query;

      const products = await Product.getTopSelling(Number(limit));
      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Retrieved ${enrichedProducts.length} top-selling products`);
    } catch (error) {
      console.error('Failed to fetch top-selling products:', error);
      return errorResponse(res, 'Failed to fetch top-selling products', 500, error.message);
    }
  }

  /**
   * GET MOST VIEWED PRODUCTS
   */
  static async getMostViewedProducts(req, res) {
    try {
      const { limit = 10 } = req.query;

      const products = await Product.getMostViewed(Number(limit));
      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Retrieved ${enrichedProducts.length} most-viewed products`);
    } catch (error) {
      console.error('Failed to fetch most-viewed products:', error);
      return errorResponse(res, 'Failed to fetch most-viewed products', 500, error.message);
    }
  }

  /**
   * GET ACTIVE DISCOUNT PRODUCTS
   */
  static async getActiveDiscountProducts(req, res) {
    try {
      const products = await Product.getActiveDiscountProducts();
      const enrichedProducts = products.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Found ${enrichedProducts.length} products with active discounts`);
    } catch (error) {
      console.error('Failed to fetch discounted products:', error);
      return errorResponse(res, 'Failed to fetch discounted products', 500, error.message);
    }
  }

  /**
   * GET AVERAGE RATING BY CATEGORY
   */
  static async getAverageRatingByCategory(req, res) {
    try {
      const { categoryId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return errorResponse(res, 'Invalid category ID format', 400);
      }

      const averageRating = await Product.getAverageRatingByCategory(categoryId);

      return standardResponse(res, true, { categoryId, averageRating }, `Retrieved average rating for category: ${averageRating.toFixed(2)}`);
    } catch (error) {
      console.error('Failed to fetch average rating:', error);
      return errorResponse(res, 'Failed to fetch average rating', 500, error.message);
    }
  }

  /**
   * ARCHIVE OLD PRODUCTS
   */
  static async archiveOldProducts(req, res) {
    try {
      const { beforeDate } = req.body;

      if (!beforeDate) {
        return errorResponse(res, 'beforeDate is required', 400);
      }

      const result = await Product.archiveOldProducts(new Date(beforeDate));

      return standardResponse(
        res,
        true,
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          beforeDate: beforeDate,
        },
        `Archived ${result.modifiedCount} old products successfully`
      );
    } catch (error) {
      console.error('Failed to archive products:', error);
      return errorResponse(res, 'Failed to archive products', 500, error.message);
    }
  }

  // ========================================
  // 🔧 INSTANCE METHOD ENDPOINTS
  // ========================================

  /**
   * GET SIMPLIFIED IMAGES
   */
  static async getSimplifiedImages(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const images = product.getSimplifiedImages();

      return standardResponse(res, true, images, `Retrieved ${images.length} simplified images`);
    } catch (error) {
      console.error('Failed to fetch images:', error);
      return errorResponse(res, 'Failed to fetch images', 500, error.message);
    }
  }

  /**
   * GET FINAL PRICE
   */
  static async getFinalPrice(req, res) {
    try {
      const { id } = req.params;
      const { quantity = 1 } = req.query;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const finalPrice = product.getFinalPrice(Number(quantity));

      return standardResponse(res, true, { finalPrice, quantity: Number(quantity) }, `Final price calculated for quantity ${quantity}`);
    } catch (error) {
      console.error('Failed to fetch final price:', error);
      return errorResponse(res, 'Failed to fetch final price', 500, error.message);
    }
  }

  /**
   * GET STOCK STATUS
   */
  static async getStockStatusData(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const stockStatus = product.getStockStatus();

      return standardResponse(res, true, { stockStatus }, `Stock status retrieved: ${stockStatus}`);
    } catch (error) {
      console.error('Failed to fetch stock status:', error);
      return errorResponse(res, 'Failed to fetch stock status', 500, error.message);
    }
  }

  /**
   * MARK AS OUT OF STOCK
   */
  static async markAsOutOfStock(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      product.markAsOutOfStock();
      await product.save();
      res.locals.product = product;
      NotificationMiddleware.onProductOutOfStock(req, res, () => {});
      return standardResponse(res, true, ProductController.enrichProduct(product), 'Product marked as out of stock');
    } catch (error) {
      console.error('Failed to mark as out of stock:', error);
      return errorResponse(res, 'Failed to mark as out of stock', 500, error.message);
    }
  }

  /**
   * INCREMENT PRODUCT VIEWS
   */
  static async incrementProductViews(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      product.incrementViews();
      await product.save();

      return standardResponse(
        res,
        true,
        {
          views: product.views,
          analyticsViews: product.analytics?.views || 0,
        },
        'Product views incremented'
      );
    } catch (error) {
      console.error('Failed to increment views:', error);
      return errorResponse(res, 'Failed to increment views', 500, error.message);
    }
  }

  /**
   * INCREMENT SOLD COUNT
   */

  /**
   * CHECK IF DISCOUNT IS ACTIVE
   */
  static async isDiscountActive(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const isActive = product.isDiscountActive();

      return standardResponse(
        res,
        true,
        {
          isDiscountActive: isActive,
          discount: product.discount,
          discountStartDate: product.discountStartDate,
          discountEndDate: product.discountEndDate,
        },
        `Discount is ${isActive ? 'active' : 'inactive'}`
      );
    } catch (error) {
      console.error('Failed to check discount status:', error);
      return errorResponse(res, 'Failed to check discount status', 500, error.message);
    }
  }

  /**
   * GET SEO DATA
   */
  static async getSEOData(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const seoData = product.getSEOData();

      return standardResponse(res, true, seoData, 'SEO data retrieved successfully');
    } catch (error) {
      console.error('Failed to fetch SEO data:', error);
      return errorResponse(res, 'Failed to fetch SEO data', 500, error.message);
    }
  }

  /**
   * GET BULK DISCOUNT PRICE
   */
  static async getBulkDiscountPrice(req, res) {
    try {
      const { id } = req.params;
      const { quantity } = req.query;

      if (!quantity || Number(quantity) <= 0) {
        return errorResponse(res, 'Positive quantity is required', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const bulkPrice = product.getBulkDiscountPrice(Number(quantity));

      return standardResponse(
        res,
        true,
        {
          bulkPrice,
          quantity: Number(quantity),
          savings: product.basePrice * Number(quantity) - bulkPrice,
        },
        `Bulk discount price calculated for quantity ${quantity}`
      );
    } catch (error) {
      console.error('Failed to fetch bulk discount price:', error);
      return errorResponse(res, 'Failed to fetch bulk discount price', 500, error.message);
    }
  }

  /**
   * CHECK IF PURCHASABLE
   */
  static async isPurchasable(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const isPurchasable = product.isPurchasable();

      return standardResponse(
        res,
        true,
        {
          isPurchasable,
          isAvailable: product.isAvailable,
          stock: product.inventory,
          purchaseLimit: product.purchaseLimit,
        },
        `Product is ${isPurchasable ? 'purchasable' : 'not purchasable'}`
      );
    } catch (error) {
      console.error('Failed to check purchasable status:', error);
      return errorResponse(res, 'Failed to check purchasable status', 500, error.message);
    }
  }

  /**
   * REDUCE STOCK
   */
  static async reduceStock(req, res) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity <= 0) {
        return errorResponse(res, 'Positive quantity is required', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      if (!product.isPurchasable()) {
        return errorResponse(res, 'Product is not purchasable', 400);
      }

      await product.reduceStock(quantity);

      return standardResponse(res, true, ProductController.enrichProduct(product), `Stock reduced by ${quantity} successfully`);
    } catch (error) {
      console.error('Failed to reduce stock:', error);
      return errorResponse(res, 'Failed to reduce stock', 500, error.message);
    }
  }

  /**
   * RESTOCK PRODUCT
   */
  static async restockProduct(req, res) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity <= 0) {
        return errorResponse(res, 'Positive quantity is required', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      await product.restock(quantity);
      res.locals.product = product;
      NotificationMiddleware.onProductBackInStock(req, res, () => {});
      return standardResponse(res, true, ProductController.enrichProduct(product), `Product restocked with ${quantity} units successfully`);
    } catch (error) {
      console.error('Failed to restock product:', error);
      return errorResponse(res, 'Failed to restock product', 500, error.message);
    }
  }

  /**
   * TOGGLE FEATURED STATUS
   */
  static async toggleFeatured(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const isFeatured = await product.toggleFeatured();

      return standardResponse(
        res,
        true,
        {
          isFeatured,
          productId: id,
        },
        `Product ${isFeatured ? 'featured' : 'unfeatured'} successfully`
      );
    } catch (error) {
      console.error('Failed to toggle featured status:', error);
      return errorResponse(res, 'Failed to toggle featured status', 500, error.message);
    }
  }

  /**
   * GET RELATED PRODUCTS
   */
  static async getRelatedProducts(req, res) {
    try {
      const { id } = req.params;
      const { limit = 5 } = req.query;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const relatedProducts = await product.getRelatedProducts().limit(parseInt(limit));
      const enrichedProducts = relatedProducts.map((product) => ProductController.enrichProduct(product));

      return standardResponse(res, true, enrichedProducts, `Retrieved ${enrichedProducts.length} related products`);
    } catch (error) {
      console.error('Failed to fetch related products:', error);
      return errorResponse(res, 'Failed to fetch related products', 500, error.message);
    }
  }

  /**
   * CHECK IF PART OF BUNDLE
   */
  static async isPartOfBundle(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const isBundle = product.isPartOfBundle();

      return standardResponse(
        res,
        true,
        {
          isPartOfBundle: isBundle,
          bundleContents: product.bundleContents || [],
        },
        `Product is ${isBundle ? 'part of a bundle' : 'not part of a bundle'}`
      );
    } catch (error) {
      console.error('Failed to check bundle status:', error);
      return errorResponse(res, 'Failed to check bundle status', 500, error.message);
    }
  }

  /**
   * GET ACTIVE DISCOUNT PERCENT
   */
  static async getActiveDiscountPercent(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const discountPercent = product.getActiveDiscountPercent();

      return standardResponse(
        res,
        true,
        {
          discountPercent,
          isActive: discountPercent > 0,
        },
        `Active discount: ${discountPercent}%`
      );
    } catch (error) {
      console.error('Failed to fetch discount percentage:', error);
      return errorResponse(res, 'Failed to fetch discount percentage', 500, error.message);
    }
  }

  /**
   * ADD PRODUCT REVIEW
   */
  static async addProductReview(req, res) {
    try {
      const { id } = req.params;
      const { reviewId } = req.body;

      if (!reviewId) {
        return errorResponse(res, 'reviewId is required', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(reviewId)) {
        return errorResponse(res, 'Invalid ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      await product.addReview(reviewId);

      return standardResponse(
        res,
        true,
        {
          reviewId,
          totalReviews: product.reviews.length,
        },
        'Review added successfully'
      );
    } catch (error) {
      console.error('Failed to add review:', error);
      return errorResponse(res, 'Failed to add review', 500, error.message);
    }
  }

  /**
   * APPLY PROMOTION
   */
  static async applyPromotion(req, res) {
    try {
      const { id } = req.params;
      const { discount, salePrice, startDate, endDate } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      await product.applyPromotion({
        discount,
        salePrice,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      return standardResponse(res, true, ProductController.enrichProduct(product), 'Promotion applied successfully');
    } catch (error) {
      console.error('Failed to apply promotion:', error);
      return errorResponse(res, 'Failed to apply promotion', 500, error.message);
    }
  }

  /**
   * CHECK IF PRE-ORDER AVAILABLE
   */
  static async isPreOrderAvailable(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const isPreOrder = product.isPreOrderAvailable();

      return standardResponse(
        res,
        true,
        {
          isPreOrderAvailable: isPreOrder,
          preOrder: product.preOrder,
          preOrderDate: product.preOrderDate,
        },
        `Pre-order is ${isPreOrder ? 'available' : 'not available'}`
      );
    } catch (error) {
      console.error('Failed to check pre-order status:', error);
      return errorResponse(res, 'Failed to check pre-order status', 500, error.message);
    }
  }

  /**
   * GET BUNDLE TOTAL PRICE
   */
  static async getBundleTotalPrice(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const totalPrice = await product.getBundleTotalPrice();

      return standardResponse(
        res,
        true,
        {
          totalPrice,
          isBundle: product.isPartOfBundle(),
          bundleContents: product.bundleContents || [],
        },
        `Bundle total price: $${totalPrice.toFixed(2)}`
      );
    } catch (error) {
      console.error('Failed to fetch bundle price:', error);
      return errorResponse(res, 'Failed to fetch bundle price', 500, error.message);
    }
  }

  // ========================================
  // 📊 VIRTUAL PROPERTY ENDPOINTS
  // ========================================

  /**
   * GET RATING STATISTICS
   */
  static async getRatingStatistics(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id).populate('reviews');
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const ratingStatistics = product.ratingStatistics;

      return standardResponse(res, true, ratingStatistics, `Rating statistics: ${ratingStatistics.averageRating.toFixed(2)}/5 from ${ratingStatistics.totalReviews} reviews`);
    } catch (error) {
      console.error('Failed to fetch rating statistics:', error);
      return errorResponse(res, 'Failed to fetch rating statistics', 500, error.message);
    }
  }

  /**
   * GET VIRTUAL STOCK STATUS
   */
  static async getVirtualStockStatus(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      const product = await Product.findById(id);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      const stockStatus = product.stockStatus;

      return standardResponse(res, true, { stockStatus }, `Virtual stock status: ${stockStatus}`);
    } catch (error) {
      console.error('Failed to fetch virtual stock status:', error);
      return errorResponse(res, 'Failed to fetch virtual stock status', 500, error.message);
    }
  }

  // ========================================
  // 📈 REPORT AND STATISTICS ENDPOINTS
  // ========================================

  /**
   * GET SCHEMA REPORT
   */
  static async getSchemaReport(req, res) {
    try {
      const report = Product.generateSchemaReport();

      return standardResponse(res, true, report, 'Schema report generated successfully');
    } catch (error) {
      console.error('Failed to generate schema report:', error);
      return errorResponse(res, 'Failed to generate schema report', 500, error.message);
    }
  }

  /**
   * GET DATABASE STATISTICS
   */
  static async getDatabaseStatistics(req, res) {
    try {
      const statistics = await Product.generateDatabaseStatistics();

      return standardResponse(res, true, statistics, 'Database statistics generated successfully');
    } catch (error) {
      console.error('Failed to generate database statistics:', error);
      return errorResponse(res, 'Failed to generate database statistics', 500, error.message);
    }
  }

  // ========================================
  // 🚀 ENHANCED ENDPOINTS (New Features)
  // ========================================

  /**
   * UPDATE STOCK - Enhanced version with operation types
   */
  static async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { quantity, operation = 'set' } = req.body; // set, add, subtract

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return errorResponse(res, 'Invalid product ID format', 400);
      }

      if (typeof quantity !== 'number' || quantity < 0) {
        return errorResponse(res, 'Valid quantity is required', 400);
      }

      const product = await Product.findOne({
        _id: id,
        deletedAt: { $exists: false },
      });

      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      let newStock;
      switch (operation) {
        case 'add':
          newStock = (product.inventory || 0) + quantity;
          break;
        case 'subtract':
          newStock = Math.max(0, (product.inventory || 0) - quantity);
          break;
        default:
          newStock = quantity;
      }

      // Update stock and related fields
      const updateData = {
        inventory: newStock,
        currentStockLevel: newStock,
        lastRestocked: new Date(),
        updated_by: req.user?.id,
      };

      // Update availability based on new stock
      if (newStock === 0) {
        updateData.isAvailable = false;
        updateData.availability = 'Out of Stock';
      } else if (newStock > 0) {
        updateData.isAvailable = true;
        updateData.availability = newStock <= (product.lowStockThreshold || 0) ? 'Low Stock' : 'In Stock';
      }

      const updatedProduct = await Product.findByIdAndUpdate(id, { $set: updateData }, { new: true }).populate([
        { path: 'categories', select: 'name slug' },
        { path: 'brand', select: 'name logo' },
      ]);
      res.locals.product = updatedProduct;
      NotificationMiddleware.onProductOutOfStockDual(req, res, () => {});
      return standardResponse(res, true, ProductController.enrichProduct(updatedProduct), `Stock updated successfully. New stock: ${newStock}`);
    } catch (error) {
      console.error('Update stock error:', error);
      return errorResponse(res, 'Failed to update stock', 500, error.message);
    }
  }

  /**
   * GET PRODUCTS WITH ANALYTICS
   */
  static async getProductsWithAnalytics(req, res) {
    try {
      const { limit = 20, sortBy = 'views' } = req.query;

      const sortOptions = {
        views: { views: -1 },
        conversions: { 'analytics.conversions': -1 },
        clicks: { 'analytics.clicks': -1 },
        sold: { soldCount: -1 },
      };

      const sortObj = sortOptions[sortBy] || { views: -1 };

      const products = await Product.find({
        deletedAt: { $exists: false },
        status: 'active',
      })
        .populate([
          { path: 'categories', select: 'name slug' },
          { path: 'brand', select: 'name logo' },
        ])
        .sort(sortObj)
        .limit(parseInt(limit));

      const enrichedProducts = products.map((product) => ({
        ...ProductController.enrichProduct(product),
        analytics: product.analytics,
        performance: {
          conversionRate: product.analytics?.conversions && product.analytics?.views ? ((product.analytics.conversions / product.analytics.views) * 100).toFixed(2) + '%' : '0%',
          clickThroughRate: product.analytics?.clicks && product.analytics?.views ? ((product.analytics.clicks / product.analytics.views) * 100).toFixed(2) + '%' : '0%',
        },
      }));

      return standardResponse(res, true, enrichedProducts, `Retrieved ${enrichedProducts.length} products with analytics sorted by ${sortBy}`);
    } catch (error) {
      console.error('Failed to fetch products with analytics:', error);
      return errorResponse(res, 'Failed to fetch products with analytics', 500, error.message);
    }
  }

  // 1. Favorites / Wishlist
  static async addFavorite(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      const pid = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(pid)) return res.status(400).json({ success: false, message: 'Invalid product ID' });
      if (!user.wishlist.includes(pid)) {
        user.wishlist.push(pid);
        await user.save();
      }
      res.json({ success: true, message: 'Added to favorites', data: user.wishlist });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to add favorite', error: err.message });
    }
  }

  static async removeFavorite(req, res) {
    try {
      const user = await User.findById(req.user.id);
      user.wishlist = user.wishlist.filter((pid) => pid.toString() !== req.params.id);
      await user.save();
      res.json({ success: true, message: 'Removed from favorites', data: user.wishlist });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to remove favorite', error: err.message });
    }
  }

  static async listFavorites(req, res) {
    try {
      const user = await User.findById(req.user.id).populate({ path: 'wishlist', select: 'title basePrice mainImage' });
      res.json({ success: true, data: user.wishlist });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch favorites', error: err.message });
    }
  }

  // 2. Recommendations
  static async getRecommendations(req, res) {
    try {
      const { id } = req.params;
      const p = await Product.findById(id).lean();
      if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
      const recs = await Product.find({ categories: { $in: p.categories }, _id: { $ne: id }, status: 'active' })
        .sort({ soldCount: -1 })
        .limit(10)
        .select('title basePrice mainImage');
      res.json({ success: true, data: recs });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch recommendations', error: err.message });
    }
  }

  // 3. Import/Export CSV
  static async importCSV(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'CSV file required' });
      const results = [];
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          const ops = results.map((item) => ({
            updateOne: { filter: { sku: item.sku }, update: { $set: item }, upsert: true },
          }));
          await Product.bulkWrite(ops);
          fs.unlinkSync(req.file.path);
          res.json({ success: true, message: `Imported ${results.length} products` });
        });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Import failed', error: err.message });
    }
  }

  static async exportCSV(req, res) {
    try {
      const products = await Product.find({ deletedAt: { $exists: false } }).lean();
      const fields = Object.keys(products[0] || {});
      const parser = new Parser({ fields });
      const csvData = parser.parse(products);
      res.header('Content-Type', 'text/csv');
      res.attachment('products_export.csv');
      res.send(csvData);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Export failed', error: err.message });
    }
  }

  // 4. Review Moderation
  static async approveReview(req, res) {
    try {
      const { id, reviewId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(reviewId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      const p = await Product.findById(id);
      if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
      const r = p.reviews.id(reviewId);
      if (!r) return res.status(404).json({ success: false, message: 'Review not found' });
      r.approved = true;
      await p.save();
      res.json({ success: true, message: 'Review approved' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Approval failed', error: err.message });
    }
  }

  static async removeReview(req, res) {
    try {
      const { id, reviewId } = req.params;
      const p = await Product.findById(id);
      p.reviews.id(reviewId).remove();
      await p.save();
      res.json({ success: true, message: 'Review removed' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Removal failed', error: err.message });
    }
  }

  // 5. Inventory Alerts
  static async lowStockAlerts(req, res) {
    try {
      const threshold = Number(req.query.threshold) || 5;
      const prods = await Product.find({ inventory: { $lte: threshold }, deletedAt: { $exists: false } }).select('title inventory lowStockThreshold');
      res.json({ success: true, data: prods });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch alerts', error: err.message });
    }
  }

  static async sendLowStockEmails(req, res) {
    res.json({ success: true, message: 'Emails triggered (stub)' });
  }

  // 6. Bulk Price Updates & Flash Sales
  static async bulkPriceUpdate(req, res) {
    try {
      const { ids, type, amount } = req.body;
      if (!['percentage', 'fixed'].includes(type) || !Array.isArray(ids) || typeof amount !== 'number') {
        return res.status(400).json({ success: false, message: 'Invalid input' });
      }
      const ops = ids.map((id) => ({
        updateOne: {
          filter: { _id: id },
          update: type === 'percentage' ? { $mul: { basePrice: (100 - amount) / 100 } } : { $inc: { basePrice: -amount } },
        },
      }));
      await Product.bulkWrite(ops);
      res.json({ success: true, message: 'Bulk price update applied' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Bulk update failed', error: err.message });
    }
  }

  static async scheduleFlashSale(req, res) {
    res.json({ success: true, message: 'Flash sale scheduled (stub)' });
  }

  // 7. Extended Analytics
  static async salesMetrics(req, res) {
    try {
      const from = new Date(req.query.from),
        to = new Date(req.query.to);
      const metrics = await Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            totalUnits: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          },
        },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: '$product' },
        {
          $project: {
            _id: 0,
            productId: '$_id',
            title: '$product.title',
            totalUnits: 1,
            revenue: 1,
          },
        },
        { $sort: { revenue: -1 } },
      ]);
      res.json({ success: true, data: metrics });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch sales metrics', error: err.message });
    }
  }

  static async popularity(req, res) {
    try {
      const limit = Number(req.query.limit) || 10;
      const prods = await Product.find({ deletedAt: { $exists: false } })
        .sort({ views: -1 })
        .limit(limit)
        .select('title views soldCount');
      res.json({ success: true, data: prods });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch popularity metrics', error: err.message });
    }
  }

  // 8. Category & Tag Management
  static async upsertCategory(req, res) {
    try {
      const Category = require('../models/Category');
      const { id } = req.params;
      let cat;
      if (id) {
        cat = await Category.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
      } else {
        cat = new Category(req.body);
        await cat.save();
      }
      res.json({ success: true, data: cat });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Category upsert failed', error: err.message });
    }
  }

  static async listCategories(req, res) {
    try {
      const Category = require('../models/Category');
      const cats = await Category.find().sort({ name: 1 });
      res.json({ success: true, data: cats });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to list categories', error: err.message });
    }
  }

  // 9. Downloadable Files
  static async listDownloads(req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid product ID' });
      }
      const product = await Product.findById(id).select('downloadableFiles');
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      res.json({ success: true, data: product.downloadableFiles });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to list downloads', error: err.message });
    }
  }

  // Increment product views
  static async incrementViews(req, res) {
    try {
      const { id } = req.params;

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      product.incrementViews();
      await product.save();

      res.json({
        message: 'Product views incremented',
        views: product.views,
      });
    } catch (err) {
      console.error('Error incrementing views:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Increment sold count & decrease stock
  static async incrementSold(req, res) {
    try {
      const { id } = req.params;
      const { quantity = 1 } = req.body;

      const product = await Product.findById(id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      if (product.stock < quantity) {
        return res.status(400).json({ message: 'Not enough stock' });
      }

      product.incrementSold(quantity);
      await product.save();

      res.json({
        message: 'Product sold count incremented',
        soldCount: product.soldCount,
        stock: product.stock,
      });
    } catch (err) {
      console.error('Error incrementing sold count:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }

  // Check if discount is active

  static async checkBundleStatus(req, res) {
    try {
      const { id } = req.params;

      const isBundle = await Product.isPartOfBundle(id);

      return res.json({
        message: 'Bundle status checked',
        isBundle,
      });
    } catch (err) {
      console.error('Error checking bundle status:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
  static async downloadFile(req, res) {
    try {
      const { id, fileIndex } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid product ID' });
      }
      const product = await Product.findById(id).select('downloadableFiles');
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      const file = product.downloadableFiles[Number(fileIndex)];
      if (!file) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }
      return res.redirect(file.url);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to download file', error: err.message });
    }
  }
  static async getProductDashboardStats(req, res) {
    try {
      const stats = await Product.getCompleteProductDashboardStatistics();
      return standardResponse(res, true, stats, ` product statuses successfully fetch`);
    } catch (error) {
      console.error('Error getting product dashboard stats:', error);
      return errorResponse(res, 'Failed to fetch statuses', 500, error.message);
    }
  }

  static async getActiveDealStatics(req, res) {
    try {
      // Fetch products that are active, not deleted, and part of a deal
      const products = await Product.find({ isDeleted: false, status: 'active' }, { tags: 1, brand: 1, category: 1 }).populate('brand', 'name _id').populate('category', 'title _id');

      // Initialize unique sets/maps
      const tagsSet = new Set();
      const brandsMap = new Map();
      const categoryMap = new Map();

      for (const product of products) {
        // ✅ Collect tags
        if (Array.isArray(product.tags)) {
          product.tags.forEach((tag) => {
            if (tag && typeof tag === 'string') tagsSet.add(tag);
          });
        }

        // ✅ Collect brand
        if (product.brand && product.brand._id) {
          brandsMap.set(product.brand._id.toString(), {
            id: product.brand._id,
            title: product.brand.name,
          });
        }

        // ✅ Collect category (single object)
        if (product.category && product.category._id) {
          categoryMap.set(product.category._id.toString(), {
            id: product.category._id,
            title: product.category.title,
          });
        }
      }

      // ✅ Format tags as [{ id, title }]
      const tags = Array.from(tagsSet).map((tag) => ({
        id: tag,
        title: tag,
      }));

      return res.status(200).json({
        success: true,
        data: {
          tags,
          brands: Array.from(brandsMap.values()),
          categories: Array.from(categoryMap.values()),
        },
      });
    } catch (err) {
      console.error('Error fetching statics:', err);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching active deal statics',
        error: err.message,
      });
    }
  }
}

module.exports = ProductController;
