const Wishlist = require('../models/wishlist');
const { validationResult } = require('express-validator');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../utils/responseHelper');
const AppError = require('../utils/appError');
const { catchAsync } = require('../middleware/errorHandler');

// Helper function to check authorization
const checkAuthorization = (req, userId) => {
  if (!req.user || req.user._id.toString() !== userId.toString()) {
    throw AppError.forbidden('Unauthorized access');
  }
};

// Controller methods
const wishlistController = {
  // Add item to wishlist
  addToWishlist: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId, productId, notes, priority, tags } = req.body;
    checkAuthorization(req, userId);

    const wishlistItem = await Wishlist.addToWishlist({
      userId,
      productId,
      created_by: req.user._id,
      notes,
      priority,
      tags,
    });

    await ActivityHelper.logCRUD(req, 'WithList', 'Create', { id: wishlistItem._id });

    return sendCreated(res, {
      data: wishlistItem.toJSONSafe(),
      message: 'Wishlist item added successfully',
    });
  }),

  // Approve pending wishlist item
  approveWishlistItem: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId, productId } = req.body;
    checkAuthorization(req, userId);

    const wishlistItem = await Wishlist.approveWishlistItem({
      userId,
      productId,
      approvedBy: req.user._id,
    });

    if (!wishlistItem) {
      throw AppError.notFound('Wishlist item not found or not pending');
    }

    return sendSuccess(res, {
      data: wishlistItem.toJSONSafe(),
      message: 'Wishlist item approved successfully',
    });
  }),

  // Remove item from wishlist
  removeFromWishlist: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId, productId } = req.params;
    checkAuthorization(req, userId);

    const wishlistItem = await Wishlist.removeFromWishlist({
      userId,
      productId,
      removedBy: req.user._id,
    });

    if (!wishlistItem) {
      throw AppError.notFound('Wishlist item not found');
    }

    await ActivityHelper.logCRUD(req, 'WithList', 'Delete', { id: wishlistItem._id });

    return sendSuccess(res, {
      data: wishlistItem.toJSONSafe(),
      message: 'Wishlist item removed successfully',
    });
  }),

  // Restore deleted wishlist item
  restoreWishlistItem: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId, productId } = req.body;
    checkAuthorization(req, userId);

    const wishlistItem = await Wishlist.restoreWishlistItem({
      userId,
      productId,
      restoredBy: req.user._id,
    });

    if (!wishlistItem) {
      throw AppError.notFound('Wishlist item not found or not deleted');
    }

    return sendSuccess(res, {
      data: wishlistItem.toJSONSafe(),
      message: 'Wishlist item restored successfully',
    });
  }),

  // Get user's wishlist with filtering
  getUserWishlist: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId } = req.params;
    const { page, limit, sort, priority, status, search, tags } = req.query;
    checkAuthorization(req, userId);

    const wishlist = await Wishlist.getUserWishlist({
      userId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      sort: sort || '-createdAt',
      priority,
      status: status ? status.split(',') : ['ACTIVE', 'PENDING'],
      search,
      tags: tags ? tags.split(',') : undefined,
    });

    return sendSuccess(res, {
      data: wishlist,
      message: 'Wishlist retrieved successfully',
    });
  }),

  // Check if product is in wishlist
  isInWishlist: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId, productId } = req.params;
    checkAuthorization(req, userId);

    const exists = await Wishlist.isInWishlist({ userId, productId });

    return sendSuccess(res, {
      data: { isInWishlist: exists },
      message: 'Wishlist check completed',
    });
  }),

  // Clear wishlist
  clearWishlist: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId } = req.params;
    checkAuthorization(req, userId);

    const result = await Wishlist.clearWishlist(userId, req.user._id);

    return sendSuccess(res, {
      data: { affected: result.nModified },
      message: 'Wishlist cleared successfully',
    });
  }),

  // Get wishlist statistics
  getWishlistStats: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId } = req.params;
    checkAuthorization(req, userId);

    const stats = await Wishlist.getWishlistStats(userId);

    return sendSuccess(res, {
      data: stats,
      message: 'Wishlist statistics retrieved successfully',
    });
  }),

  // Bulk add to wishlist
  bulkAddToWishlist: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId, productIds, priority, tags } = req.body;
    checkAuthorization(req, userId);

    const result = await Wishlist.bulkAddToWishlist({
      userId,
      productIds,
      created_by: req.user._id,
      priority,
      tags,
    });

    return sendCreated(res, {
      data: result,
      message: 'Bulk add to wishlist successful',
    });
  }),

  // Bulk update wishlist items
  bulkUpdateWishlist: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId, productIds, updates } = req.body;
    checkAuthorization(req, userId);

    const result = await Wishlist.bulkUpdateWishlist({
      userId,
      productIds,
      updates,
      updated_by: req.user._id,
    });

    return sendSuccess(res, {
      data: result,
      message: 'Bulk update wishlist successful',
    });
  }),

  // Export wishlist
  exportWishlist: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId } = req.params;
    const { format, fields } = req.query;
    checkAuthorization(req, userId);

    const exportedData = await Wishlist.exportWishlist({
      userId,
      format,
      fields: fields ? fields.split(',') : undefined,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${exportedData.filename}`);
      return res.status(HTTP_STATUS.OK).send(exportedData.content);
    }

    return sendSuccess(res, {
      data: exportedData,
      message: 'Wishlist exported successfully',
    });
  }),

  // Export featured items
  exportFeaturedItems: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId } = req.params;
    const { limit, format } = req.query;
    checkAuthorization(req, userId);

    const exportedData = await Wishlist.exportFeaturedItems({
      userId,
      limit: parseInt(limit) || 10,
      format,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${exportedData.filename}`);
      return res.status(HTTP_STATUS.OK).send(exportedData.content);
    }

    return sendSuccess(res, {
      data: exportedData,
      message: 'Featured items exported successfully',
    });
  }),

  // Get audit trail
  getAuditTrail: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId, productId } = req.params;
    checkAuthorization(req, userId);

    const auditTrail = await Wishlist.getAuditTrail({ userId, productId });

    return sendSuccess(res, {
      data: auditTrail,
      message: 'Audit trail retrieved successfully',
    });
  }),

  // Update wishlist item
  updateWishlistItem: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId, productId } = req.params;
    const { notes, priority, tags } = req.body;
    checkAuthorization(req, userId);

    const wishlistItem = await Wishlist.findOne({
      user: userId,
      product: productId,
      status: { $in: ['ACTIVE', 'PENDING'] },
    });

    if (!wishlistItem) {
      throw AppError.notFound('Wishlist item not found');
    }

    const updatedItem = await wishlistItem.updateItem({
      notes,
      priority,
      tags,
      updated_by: req.user._id,
    });

    await ActivityHelper.logCRUD(req, 'WithList', 'Update', { id: wishlistItem._id });

    return sendSuccess(res, {
      data: updatedItem.toJSONSafe(),
      message: 'Wishlist item updated successfully',
    });
  }),

  // Archive wishlist item
  archiveWishlistItem: catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw AppError.validation('Validation failed', errors.array());
    }

    const { userId, productId } = req.params;
    checkAuthorization(req, userId);

    const wishlistItem = await Wishlist.findOne({
      user: userId,
      product: productId,
      status: { $in: ['ACTIVE', 'PENDING'] },
    });

    if (!wishlistItem) {
      throw AppError.notFound('Wishlist item not found');
    }

    const archivedItem = await wishlistItem.archive(req.user._id);

    return sendSuccess(res, {
      data: archivedItem.toJSONSafe(),
      message: 'Wishlist item archived successfully',
    });
  }),
};

module.exports = wishlistController;