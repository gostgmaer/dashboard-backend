const Wishlist = require('../models/wishlist');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
// const { APIError, formatResponse } = require('../utils/apiUtils');
// const { validateWishlistInput, validateBulkWishlistInput } = require('../middleware/validators');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../utils/apiUtils');
// Helper function to check authorization
const checkAuthorization = (req, userId) => {
  if (!req.user || req.user._id.toString() !== userId.toString()) {
    throw new APIError('Unauthorized', 403);
  }
};

// Controller methods
const wishlistController = {
  // Add item to wishlist
  async addToWishlist(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId, productId, notes, priority, tags } = req.body;
      checkAuthorization(req, userId);

      const wishlistItem = await Wishlist.addToWishlist({
        userId,
        productId,
        createdBy: req.user._id,
        notes,
        priority,
        tags
      });

      return res.status(201).json(formatResponse('Wishlist item added successfully', wishlistItem.toJSONSafe()));
    } catch (error) {
      logger.error('Error in addToWishlist:', error);
      next(error);
    }
  },

  // Approve pending wishlist item
  async approveWishlistItem(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId, productId } = req.body;
      checkAuthorization(req, userId); // Additional check for admin role could be added

      const wishlistItem = await Wishlist.approveWishlistItem({
        userId,
        productId,
        approvedBy: req.user._id
      });

      if (!wishlistItem) {
        throw new APIError('Wishlist item not found or not pending', 404);
      }

      return res.status(200).json(formatResponse('Wishlist item approved successfully', wishlistItem.toJSONSafe()));
    } catch (error) {
      logger.error('Error in approveWishlistItem:', error);
      next(error);
    }
  },

  // Remove item from wishlist
  async removeFromWishlist(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId, productId } = req.params;
      checkAuthorization(req, userId);

      const wishlistItem = await Wishlist.removeFromWishlist({
        userId,
        productId,
        removedBy: req.user._id
      });

      if (!wishlistItem) {
        throw new APIError('Wishlist item not found', 404);
      }

      return res.status(200).json(formatResponse('Wishlist item removed successfully', wishlistItem.toJSONSafe()));
    } catch (error) {
      logger.error('Error in removeFromWishlist:', error);
      next(error);
    }
  },

  // Restore deleted wishlist item
  async restoreWishlistItem(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId, productId } = req.body;
      checkAuthorization(req, userId);

      const wishlistItem = await Wishlist.restoreWishlistItem({
        userId,
        productId,
        restoredBy: req.user._id
      });

      if (!wishlistItem) {
        throw new APIError('Wishlist item not found or not deleted', 404);
      }

      return res.status(200).json(formatResponse('Wishlist item restored successfully', wishlistItem.toJSONSafe()));
    } catch (error) {
      logger.error('Error in restoreWishlistItem:', error);
      next(error);
    }
  },

  // Get user's wishlist with filtering
  async getUserWishlist(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
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
        tags: tags ? tags.split(',') : undefined
      });

      return res.status(200).json(formatResponse('Wishlist retrieved successfully', wishlist));
    } catch (error) {
      logger.error('Error in getUserWishlist:', error);
      next(error);
    }
  },

  // Check if product is in wishlist
  async isInWishlist(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId, productId } = req.params;
      checkAuthorization(req, userId);

      const exists = await Wishlist.isInWishlist({ userId, productId });

      return res.status(200).json(formatResponse('Wishlist check completed', { isInWishlist: exists }));
    } catch (error) {
      logger.error('Error in isInWishlist:', error);
      next(error);
    }
  },

  // Clear wishlist
  async clearWishlist(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId } = req.params;
      checkAuthorization(req, userId);

      const result = await Wishlist.clearWishlist(userId, req.user._id);

      return res.status(200).json(formatResponse('Wishlist cleared successfully', { affected: result.nModified }));
    } catch (error) {
      logger.error('Error in clearWishlist:', error);
      next(error);
    }
  },

  // Get wishlist statistics
  async getWishlistStats(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId } = req.params;
      checkAuthorization(req, userId);

      const stats = await Wishlist.getWishlistStats(userId);

      return res.status(200).json(formatResponse('Wishlist statistics retrieved successfully', stats));
    } catch (error) {
      logger.error('Error in getWishlistStats:', error);
      next(error);
    }
  },

  // Bulk add to wishlist
  async bulkAddToWishlist(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId, productIds, priority, tags } = req.body;
      checkAuthorization(req, userId);

      const result = await Wishlist.bulkAddToWishlist({
        userId,
        productIds,
        createdBy: req.user._id,
        priority,
        tags
      });

      return res.status(201).json(formatResponse('Bulk add to wishlist successful', result));
    } catch (error) {
      logger.error('Error in bulkAddToWishlist:', error);
      next(error);
    }
  },

  // Bulk update wishlist items
  async bulkUpdateWishlist(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId, productIds, updates } = req.body;
      checkAuthorization(req, userId);

      const result = await Wishlist.bulkUpdateWishlist({
        userId,
        productIds,
        updates,
        updatedBy: req.user._id
      });

      return res.status(200).json(formatResponse('Bulk update wishlist successful', result));
    } catch (error) {
      logger.error('Error in bulkUpdateWishlist:', error);
      next(error);
    }
  },

  // Export wishlist
  async exportWishlist(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId } = req.params;
      const { format, fields } = req.query;
      checkAuthorization(req, userId);

      const exportedData = await Wishlist.exportWishlist({
        userId,
        format,
        fields: fields ? fields.split(',') : undefined
      });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${exportedData.filename}`);
        return res.status(200).send(exportedData.content);
      }

      return res.status(200).json(formatResponse('Wishlist exported successfully', exportedData));
    } catch (error) {
      logger.error('Error in exportWishlist:', error);
      next(error);
    }
  },

  // Export featured items
  async exportFeaturedItems(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId } = req.params;
      const { limit, format } = req.query;
      checkAuthorization(req, userId);

      const exportedData = await Wishlist.exportFeaturedItems({
        userId,
        limit: parseInt(limit) || 10,
        format
      });

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${exportedData.filename}`);
        return res.status(200).send(exportedData.content);
      }

      return res.status(200).json(formatResponse('Featured items exported successfully', exportedData));
    } catch (error) {
      logger.error('Error in exportFeaturedItems:', error);
      next(error);
    }
  },

  // Get audit trail
  async getAuditTrail(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId, productId } = req.params;
      checkAuthorization(req, userId);

      const auditTrail = await Wishlist.getAuditTrail({ userId, productId });

      return res.status(200).json(formatResponse('Audit trail retrieved successfully', auditTrail));
    } catch (error) {
      logger.error('Error in getAuditTrail:', error);
      next(error);
    }
  },

  // Update wishlist item
  async updateWishlistItem(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId, productId } = req.params;
      const { notes, priority, tags } = req.body;
      checkAuthorization(req, userId);

      const wishlistItem = await Wishlist.findOne({ user: userId, product: productId, status: { $in: ['ACTIVE', 'PENDING'] } });
      if (!wishlistItem) {
        throw new APIError('Wishlist item not found', 404);
      }

      const updatedItem = await wishlistItem.updateItem({
        notes,
        priority,
        tags,
        updatedBy: req.user._id
      });

      return res.status(200).json(formatResponse('Wishlist item updated successfully', updatedItem.toJSONSafe()));
    } catch (error) {
      logger.error('Error in updateWishlistItem:', error);
      next(error);
    }
  },

  // Archive wishlist item
  async archiveWishlistItem(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new APIError('Validation failed', 400, errors.array());
      }

      const { userId, productId } = req.params;
      checkAuthorization(req, userId);

      const wishlistItem = await Wishlist.findOne({ user: userId, product: productId, status: { $in: ['ACTIVE', 'PENDING'] } });
      if (!wishlistItem) {
        throw new APIError('Wishlist item not found', 404);
      }

      const archivedItem = await wishlistItem.archive(req.user._id);

      return res.status(200).json(formatResponse('Wishlist item archived successfully', archivedItem.toJSONSafe()));
    } catch (error) {
      logger.error('Error in archiveWishlistItem:', error);
      next(error);
    }
  }
};

module.exports = wishlistController;