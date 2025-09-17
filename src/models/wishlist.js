const mongoose = require('mongoose');
const { ValidationError } = require('mongoose').Error;
const logger = require('../config/logger'); // Assuming a logger utility exists
// const { CACHE_TTL, CACHE_PREFIX } = require('../config/constants'); // Assuming constants config
// const Redis = require('ioredis'); // For caching
// const redis = new Redis(); // Assuming Redis client is configured
// const { exportToCSV, exportToJSON } = require('../utils/exportUtils'); // Assuming export utilities

const Product = require('./products')
const User = require('./user')
const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
      validate: {
        validator: async function (userId) {
          return await User.exists({ _id: userId });
        },
        message: 'Invalid user ID'
      }
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
      index: true,
      validate: {
        validator: async function (productId) {
    
          return await Product.exists({ _id: productId });
        },
        message: 'Invalid product ID'
      }
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
     
    },
     isDeleted: { type: Boolean, default: true },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
     
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
     
    },
    priority: {
      type: String,
      enum: {
        values: ['LOW', 'MEDIUM', 'HIGH'],
        message: '{VALUE} is not a valid priority'
      },
      default: 'MEDIUM',
      index: true
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'ARCHIVED', 'DELETED', 'PENDING'],
        message: '{VALUE} is not a valid status'
      },
      default: 'PENDING',
      index: true
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: [50, 'Tag cannot exceed 50 characters'],
      index: true
    }],
    auditTrail: [{
      action: {
        type: String,
        enum: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE'],
        required: true
      },
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      changes: {
        type: Map,
        of: String
      }
    }]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes
wishlistSchema.index({ user: 1, product: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['ACTIVE', 'PENDING'] } } });
wishlistSchema.index({ user: 1, status: 1, priority: 1 });
// wishlistSchema.index({ tags: 1 });

// Virtuals
wishlistSchema.virtual('productDetails', {
  ref: 'Product',
  localField: 'product',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware
wishlistSchema.pre('save', async function (next) {
  try {
    if (this.isNew) {
      this.createdAt = new Date();
      this.auditTrail.push({
        action: 'CREATE',
        performedBy: this.created_by,
        timestamp: new Date()
      });
    } else if (this.isModified()) {
      this.auditTrail.push({
        action: 'UPDATE',
        performedBy: this.updated_by || this.created_by,
        timestamp: new Date(),
        changes: this.getChanges()
      });
    }

    // Validate product availability
    const Product = mongoose.model('Product');
    const product = await Product.findById(this.product);
    if (!product || !product.isAvailable) {
      throw new ValidationError('Product is not available');
    }

    next();
  } catch (error) {
    logger.error('Wishlist save validation failed:', error);
    next(error);
  }
});

// Pre-find middleware for soft delete handling
wishlistSchema.pre(/find/, function (next) {
  this.where({ status: { $ne: 'DELETED' } });
  next();
});

// ===== Static Methods =====

// Add item to wishlist
wishlistSchema.statics.addToWishlist = async function ({ userId, productId, createdBy, notes, priority, tags }) {
  try {
    const wishlistItem = await this.findOneAndUpdate(
      { user: userId, product: productId, status: { $in: ['ACTIVE', 'PENDING'] } },
      {
        $setOnInsert: {
          created_by: createdBy,
          notes,
          priority,
          tags,
          status: 'PENDING'
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    // await redis.del(`${CACHE_PREFIX}:wishlist:${userId}`);
    logger.info(`Added product ${productId} to wishlist for user ${userId}`);

    return wishlistItem;
  } catch (error) {
    logger.error('Error adding to wishlist:', error);
    throw error;
  }
};

// Approve pending wishlist item
wishlistSchema.statics.approveWishlistItem = async function ({ userId, productId, approvedBy }) {
  try {
    const wishlistItem = await this.findOneAndUpdate(
      { user: userId, product: productId, status: 'PENDING' },
      {
        $set: { status: 'ACTIVE', updated_by: approvedBy, updatedAt: new Date() },
        $push: {
          auditTrail: {
            action: 'UPDATE',
            performedBy: approvedBy,
            timestamp: new Date(),
            changes: { status: 'ACTIVE' }
          }
        }
      },
      { new: true }
    );

    // await redis.del(`${CACHE_PREFIX}:wishlist:${userId}`);
    logger.info(`Approved wishlist item ${productId} for user ${userId}`);

    return wishlistItem;
  } catch (error) {
    logger.error('Error approving wishlist item:', error);
    throw error;
  }
};

// Remove item from wishlist
wishlistSchema.statics.removeFromWishlist = async function ({ userId, productId, removedBy }) {
  try {
    const wishlistItem = await this.findOneAndUpdate(
      { user: userId, product: productId, status: { $in: ['ACTIVE', 'PENDING'] } },
      {
        $set: { status: 'DELETED', updated_by: removedBy, updatedAt: new Date() },
        $push: {
          auditTrail: {
            action: 'DELETE',
            performedBy: removedBy,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // await redis.del(`${CACHE_PREFIX}:wishlist:${userId}`);
    logger.info(`Removed product ${productId} from wishlist for user ${userId}`);

    return wishlistItem;
  } catch (error) {
    logger.error('Error removing from wishlist:', error);
    throw error;
  }
};

// Restore deleted item
wishlistSchema.statics.restoreWishlistItem = async function ({ userId, productId, restoredBy }) {
  try {
    const wishlistItem = await this.findOneAndUpdate(
      { user: userId, product: productId, status: 'DELETED' },
      {
        $set: { status: 'ACTIVE', updated_by: restoredBy, updatedAt: new Date() },
        $push: {
          auditTrail: {
            action: 'RESTORE',
            performedBy: restoredBy,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    // await redis.del(`${CACHE_PREFIX}:wishlist:${userId}`);
    logger.info(`Restored product ${productId} to wishlist for user ${userId}`);

    return wishlistItem;
  } catch (error) {
    logger.error('Error restoring wishlist item:', error);
    throw error;
  }
};

// Get wishlist with advanced filtering
wishlistSchema.statics.getUserWishlist = async function ({
  userId,
  page = 1,
  limit = 10,
  sort = '-createdAt',
  populateProduct = true,
  priority,
  status = ['ACTIVE', 'PENDING'],
  search,
  tags
}) {
  try {
    // const cacheKey = `${CACHE_PREFIX}:wishlist:${userId}:${page}:${limit}:${sort}:${priority || 'all'}:${status.join(',')}:${tags?.join(',') || 'all'}`;
    // const cached = await redis.get(cacheKey);

    // if (cached) {
    //   logger.info(`Cache hit for wishlist ${cacheKey}`);
    //   return JSON.parse(cached);
    // }

    const skip = (page - 1) * limit;
    const query = { user: userId, status: { $in: status } };

    if (priority) query.priority = priority;
    if (tags && tags.length) query.tags = { $all: tags };
    if (search) {
      query.$or = [
        { notes: { $regex: search, $options: 'i' } },
        { 'productDetails.name': { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    let q = this.find(query).sort(sort).skip(skip).limit(limit);

    if (populateProduct) {
      q = q.populate({
        path: 'product',
        select: 'name price images category isAvailable',
        match: { isAvailable: true }
      });
    }

    const [items, total] = await Promise.all([
      q.exec(),
      this.countDocuments(query)
    ]);

    const result = {
      items: items.filter(item => item.product),
      total,
      page,
      pages: Math.ceil(total / limit),
      timestamp: new Date()
    };

    // await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    return result;
  } catch (error) {
    logger.error('Error fetching wishlist:', error);
    throw error;
  }
};

// Check if product is in wishlist
wishlistSchema.statics.isInWishlist = async function ({ userId, productId }) {
  try {
    return await this.exists({ user: userId, product: productId, status: { $in: ['ACTIVE', 'PENDING'] } });
  } catch (error) {
    logger.error('Error checking wishlist:', error);
    throw error;
  }
};

// Clear wishlist
wishlistSchema.statics.clearWishlist = async function (userId, clearedBy) {
  try {
    const result = await this.updateMany(
      { user: userId, status: { $in: ['ACTIVE', 'PENDING'] } },
      {
        $set: { status: 'DELETED', updated_by: clearedBy, updatedAt: new Date() },
        $push: {
          auditTrail: {
            action: 'DELETE',
            performedBy: clearedBy,
            timestamp: new Date()
          }
        }
      }
    );

    // await redis.del(`${CACHE_PREFIX}:wishlist:${userId}`);
    logger.info(`Cleared wishlist for user ${userId}`);

    return result;
  } catch (error) {
    logger.error('Error clearing wishlist:', error);
    throw error;
  }
};

// Get comprehensive wishlist statistics
wishlistSchema.statics.getWishlistStats = async function (userId) {
  try {
    // const cacheKey = `${CACHE_PREFIX}:wishlist:stats:${userId}`;
    // const cached = await redis.get(cacheKey);

    // if (cached) {
    //   logger.info(`Cache hit for wishlist stats ${cacheKey}`);
    //   return JSON.parse(cached);
    // }

    const [totalItems, priorityBreakdown, statusBreakdown, recentItems, categoryBreakdown, tagBreakdown] = await Promise.all([
      this.countDocuments({ user: userId, status: { $in: ['ACTIVE', 'PENDING'] } }),
      this.aggregate([
        { $match: { user: userId, status: { $in: ['ACTIVE', 'PENDING'] } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      this.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      this.find({ user: userId, status: { $in: ['ACTIVE', 'PENDING'] } })
        .sort('-createdAt')
        .limit(5)
        .populate('product', 'name price'),
      this.aggregate([
        { $match: { user: userId, status: { $in: ['ACTIVE', 'PENDING'] } } },
        {
          $lookup: {
            from: 'products',
            localField: 'product',
            foreignField: '_id',
            as: 'productDetails'
          }
        },
        { $unwind: '$productDetails' },
        { $group: { _id: '$productDetails.category', count: { $sum: 1 } } }
      ]),
      this.aggregate([
        { $match: { user: userId, status: { $in: ['ACTIVE', 'PENDING'] } } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const stats = {
      totalItems,
      priorityBreakdown,
      statusBreakdown,
      recentItems: recentItems.map(item => item.toJSONSafe()),
      categoryBreakdown,
      tagBreakdown,
      lastUpdated: new Date()
    };

    // await redis.set(cacheKey, JSON.stringify(stats), 'EX', CACHE_TTL);
    return stats;
  } catch (error) {
    logger.error('Error fetching wishlist stats:', error);
    throw error;
  }
};

// Bulk add to wishlist
wishlistSchema.statics.bulkAddToWishlist = async function ({ userId, productIds, createdBy, priority = 'MEDIUM', tags = [] }) {
  try {
    const operations = productIds.map(productId => ({
      updateOne: {
        filter: { user: userId, product: productId, status: { $in: ['ACTIVE', 'PENDING'] } },
        update: {
          $setOnInsert: {
            created_by: createdBy,
            status: 'PENDING',
            priority,
            tags,
            createdAt: new Date()
          }
        },
        upsert: true
      }
    }));

    const result = await this.bulkWrite(operations);
    // await redis.del(`${CACHE_PREFIX}:wishlist:${userId}`);
    logger.info(`Bulk added ${productIds.length} products to wishlist for user ${userId}`);

    return result;
  } catch (error) {
    logger.error('Error in bulk add to wishlist:', error);
    throw error;
  }
};

// Bulk update wishlist items
wishlistSchema.statics.bulkUpdateWishlist = async function ({ userId, productIds, updates, updatedBy }) {
  try {
    const operations = productIds.map(productId => ({
      updateOne: {
        filter: { user: userId, product: productId, status: { $in: ['ACTIVE', 'PENDING'] } },
        update: {
          $set: {
            ...updates,
            updated_by: updatedBy,
            updatedAt: new Date()
          },
          $push: {
            auditTrail: {
              action: 'UPDATE',
              performedBy: updatedBy,
              timestamp: new Date(),
              changes: updates
            }
          }
        }
      }
    }));

    const result = await this.bulkWrite(operations);
    // await redis.del(`${CACHE_PREFIX}:wishlist:${userId}`);
    logger.info(`Bulk updated ${productIds.length} wishlist items for user ${userId}`);

    return result;
  } catch (error) {
    logger.error('Error in bulk update wishlist:', error);
    throw error;
  }
};

// Export wishlist in multiple formats
wishlistSchema.statics.exportWishlist = async function ({ userId, format = 'json', fields = ['product', 'notes', 'priority', 'status', 'createdAt'] }) {
  try {
    const items = await this.find({ user: userId, status: { $in: ['ACTIVE', 'PENDING'] } })
      .populate('product', 'name price category')
      .lean();

    const formattedItems = items.map(item => {
      const result = {};
      fields.forEach(field => {
        if (field === 'product' && item.product) {
          result.productName = item.product.name;
          result.productPrice = item.product.price;
          result.productCategory = item.product.category;
        } else {
          result[field] = item[field];
        }
      });
      return result;
    });

    if (format === 'csv') {
      // return exportToCSV(formattedItems, `wishlist_${userId}_${Date.now()}.csv`);
      return formattedItems
    }
    // return exportToJSON(formattedItems);
    return formattedItems
  } catch (error) {
    logger.error('Error exporting wishlist:', error);
    throw error;
  }
};

// Export featured items
wishlistSchema.statics.exportFeaturedItems = async function ({ userId, limit = 10, format = 'json' }) {
  try {
    const items = await this.find({ user: userId, status: 'ACTIVE', priority: 'HIGH' })
      .sort('-createdAt')
      .limit(limit)
      .populate('product', 'name price images category')
      .lean();

    const formattedItems = items.map(item => ({
      productId: item.product._id,
      name: item.product.name,
      price: item.product.price,
      category: item.product.category,
      addedAt: item.createdAt,
      notes: item.notes,
      tags: item.tags
    }));

    if (format === 'csv') {
      // return exportToCSV(formattedItems, `featured_wishlist_${userId}_${Date.now()}.csv`);
      return formattedItems
    }
    // return exportToJSON(formattedItems);
    return formattedItems
  } catch (error) {
    logger.error('Error exporting featured items:', error);
    throw error;
  }
};

// Get audit trail for wishlist item
wishlistSchema.statics.getAuditTrail = async function ({ userId, productId }) {
  try {
    const item = await this.findOne({ user: userId, product: productId })
      .select('auditTrail')
      .populate('auditTrail.performedBy', 'name email')
      .lean();

    return item?.auditTrail || [];
  } catch (error) {
    logger.error('Error fetching audit trail:', error);
    throw error;
  }
};

// ===== Instance Methods =====

// Safe JSON representation
wishlistSchema.methods.toJSONSafe = function () {
  return {
    id: this._id,
    user: this.user,
    product: this.product,
    notes: this.notes,
    priority: this.priority,
    status: this.status,
    tags: this.tags,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    createdBy: this.created_by,
    updatedBy: this.updated_by,
    auditTrail: this.auditTrail
  };
};

// Update wishlist item
wishlistSchema.methods.updateItem = async function ({ notes, priority, tags, updatedBy }) {
  try {
    const changes = {};
    if (notes !== undefined) changes.notes = notes;
    if (priority !== undefined) changes.priority = priority;
    if (tags !== undefined) changes.tags = tags;

    this.notes = notes;
    this.priority = priority;
    this.tags = tags;
    this.updated_by = updatedBy;
    this.updatedAt = new Date();
    this.auditTrail.push({
      action: 'UPDATE',
      performedBy: updatedBy,
      timestamp: new Date(),
      changes
    });

    await this.save();
    // await redis.del(`${CACHE_PREFIX}:wishlist:${this.user}`);

    return this;
  } catch (error) {
    logger.error('Error updating wishlist item:', error);
    throw error;
  }
};

// Soft delete item
wishlistSchema.methods.softDelete = async function (deletedBy) {
  try {
    this.status = 'DELETED';
    this.updated_by = deletedBy;
    this.updatedAt = new Date();
    this.auditTrail.push({
      action: 'DELETE',
      performedBy: deletedBy,
      timestamp: new Date()
    });

    await this.save();
    // await redis.del(`${CACHE_PREFIX}:wishlist:${this.user}`);

    return this;
  } catch (error) {
    logger.error('Error soft deleting wishlist item:', error);
    throw error;
  }
};

// Archive item
wishlistSchema.methods.archive = async function (archivedBy) {
  try {
    this.status = 'ARCHIVED';
    this.updated_by = archivedBy;
    this.updatedAt = new Date();
    this.auditTrail.push({
      action: 'UPDATE',
      performedBy: archivedBy,
      timestamp: new Date(),
      changes: { status: 'ARCHIVED' }
    });

    await this.save();
    // await redis.del(`${CACHE_PREFIX}:wishlist:${this.user}`);

    return this;
  } catch (error) {
    logger.error('Error archiving wishlist item:', error);
    throw error;
  }
};

// Error handling middleware
wishlistSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Product already exists in wishlist'));
  } else {
    next(error);
  }
});

// Query middleware for logging
wishlistSchema.post(/find/, function (docs) {
  logger.info(`Wishlist query executed, found ${Array.isArray(docs) ? docs.length : 1} items`);
});

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;