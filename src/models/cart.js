const mongoose = require('mongoose');
const logger = require('../config/logger'); // Assuming a logger utility exists
const { Schema } = mongoose;

// Sub-schema for cart items
const cartItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required'],
    index: true
  },
   isDeleted: { type: Boolean, default: false},
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be an integer'
    }
  },
  itemDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  reservedUntil: {
    type: Date,
    index: { expires: '1h' } // Auto-expire reservations after 1 hour
  }
});

// Main cart schema
const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true
    },
    items: [cartItemSchema],
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required']
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['active', 'abandoned', 'converted', 'expired'],
      default: 'active'
    },
    sessionId: {
      type: String,
      index: true
    },
    lastModified: {
      type: Date,
      default: Date.now
    },
    version: {
      type: Number,
      default: 1,
      min: [1, 'Version must be at least 1']
    },
    cartDiscount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%']
    },
    metadata: {
      type: Map,
      of: String,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
cartSchema.index({ user: 1, status: 1 });
cartSchema.index({ sessionId: 1, createdAt: -1 });
// cartSchema.index({ 'items.reservedUntil': 1 });

// Virtuals
cartSchema.virtual('totalPrice').get(function() {
  return this.calculateTotalPrice();
});

cartSchema.virtual('totalItems').get(function() {
  return this.getTotalQuantity();
});

// Middleware for validation and logging
cartSchema.pre('save', async function(next) {
  try {
    this.lastModified = new Date();
    this.version += 1;

    // Validate stock availability and reserve
    for (const item of this.items) {
      const product = await mongoose.model('Product').findById(item.product);
      if (!product) {
        throw new Error(`Product ${item.product} not found`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }
      // Set reservation expiry (1 hour from now)
      item.reservedUntil = new Date(Date.now() + 60 * 60 * 1000);
    }

    logger.info(`Cart updated for user ${this.user}, version ${this.version}`);
    next();
  } catch (error) {
    logger.error(`Cart save error: ${error.message}`);
    next(error);
  }
});

// Release stock reservations on cart deletion
cartSchema.pre('remove', async function(next) {
  try {
    for (const item of this.items) {
      await mongoose.model('Product').updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity } }
      );
    }
    logger.info(`Released stock reservations for cart ${this._id}`);
    next();
  } catch (error) {
    logger.error(`Release stock error: ${error.message}`);
    next(error);
  }
});

// Instance Methods
cartSchema.methods.addItem = async function(productId, quantity = 1, updatedBy, itemDiscount = 0) {
  try {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (itemDiscount < 0 || itemDiscount > 100) throw new Error('Invalid item discount percentage');

    const product = await mongoose.model('Product').findById(productId);
    if (!product) throw new Error('Product not found');
    if (product.stock < quantity) throw new Error('Insufficient stock');

    // Update product stock
    await mongoose.model('Product').updateOne(
      { _id: productId },
      { $inc: { stock: -quantity } }
    );

    const existingItem = this.items.find(
      item => item.product.toString() === productId.toString()
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.itemDiscount = itemDiscount;
    } else {
      this.items.push({ product: productId, quantity, itemDiscount });
    }

    this.updated_by = updatedBy || this.created_by;
    await this.save();
    logger.info(`Added ${quantity} of product ${productId} to cart ${this._id} with ${itemDiscount}% discount`);
    return this.populate('items.product');
  } catch (error) {
    logger.error(`Add item error: ${error.message}`);
    throw error;
  }
};

cartSchema.methods.removeItem = async function(productId, updatedBy) {
  try {
    const item = this.items.find(
      item => item.product.toString() === productId.toString()
    );
    if (!item) throw new Error('Item not found in cart');

    // Release stock
    await mongoose.model('Product').updateOne(
      { _id: productId },
      { $inc: { stock: item.quantity } }
    );

    this.items = this.items.filter(
      item => item.product.toString() !== productId.toString()
    );
    this.updated_by = updatedBy || this.created_by;
    await this.save();
    logger.info(`Removed product ${productId} from cart ${this._id}`);
    return this.populate('items.product');
  } catch (error) {
    logger.error(`Remove item error: ${error.message}`);
    throw error;
  }
};

cartSchema.methods.updateQuantity = async function(productId, quantity, updatedBy, itemDiscount) {
  try {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (itemDiscount !== undefined && (itemDiscount < 0 || itemDiscount > 100)) {
      throw new Error('Invalid item discount percentage');
    }

    const item = this.items.find(
      item => item.product.toString() === productId.toString()
    );
    if (!item) throw new Error('Item not found in cart');

    const product = await mongoose.model('Product').findById(productId);
    if (!product) throw new Error('Product not found');

    // Adjust stock based on quantity difference
    const quantityDiff = quantity - item.quantity;
    if (product.stock < quantityDiff) throw new Error('Insufficient stock');

    await mongoose.model('Product').updateOne(
      { _id: productId },
      { $inc: { stock: -quantityDiff } }
    );

    item.quantity = quantity;
    if (itemDiscount !== undefined) item.itemDiscount = itemDiscount;
    this.updated_by = updatedBy || this.created_by;
    await this.save();
    logger.info(`Updated quantity of product ${productId} to ${quantity} in cart ${this._id}`);
    return this.populate('items.product');
  } catch (error) {
    logger.error(`Update quantity error: ${error.message}`);
    throw error;
  }
};

cartSchema.methods.clearCart = async function(updatedBy) {
  try {
    // Release all stock
    for (const item of this.items) {
      await mongoose.model('Product').updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity } }
      );
    }

    this.items = [];
    this.updated_by = updatedBy || this.created_by;
    await this.save();
    logger.info(`Cleared cart ${this._id}`);
    return this;
  } catch (error) {
    logger.error(`Clear cart error: ${error.message}`);
    throw error;
  }
};

cartSchema.methods.getTotalQuantity = function() {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
};

cartSchema.methods.calculateTotalPrice = function() {
  return this.items.reduce((total, item) => {
    if (item.product && item.product.price) {
      const itemPrice = item.product.price * item.quantity;
      const itemDiscount = itemPrice * (item.itemDiscount / 100);
      return total + (itemPrice - itemDiscount);
    }
    return total;
  }, 0);
};

cartSchema.methods.applyDiscount = function(discountPercent) {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Invalid discount percentage');
  }
  this.cartDiscount = discountPercent;
  const total = this.calculateTotalPrice();
  const cartDiscount = (total * discountPercent) / 100;
  logger.info(`Applied ${discountPercent}% cart discount to cart ${this._id}`);
  return total - cartDiscount;
};

cartSchema.methods.hasProduct = function(productId) {
  return this.items.some(item => item.product.toString() === productId.toString());
};

cartSchema.methods.mergeCart = async function(otherCart, updatedBy) {
  try {
    for (const otherItem of otherCart.items) {
      await this.addItem(otherItem.product, otherItem.quantity, updatedBy, otherItem.itemDiscount);
    }
    logger.info(`Merged cart ${otherCart._id} into cart ${this._id}`);
    return this.populate('items.product');
  } catch (error) {
    logger.error(`Merge cart error: ${error.message}`);
    throw error;
  }
};

cartSchema.methods.setMetadata = async function(key, value, updatedBy) {
  try {
    this.metadata.set(key, value);
    this.updated_by = updatedBy || this.created_by;
    await this.save();
    logger.info(`Set metadata ${key}=${value} for cart ${this._id}`);
    return this;
  } catch (error) {
    logger.error(`Set metadata error: ${error.message}`);
    throw error;
  }
};

// Static Methods
cartSchema.statics.getCartByUser = async function(userId) {
  try {
    const cart = await this.findOne({ user: userId, status: 'active' })
      .populate('items.product')
      .populate('user');
    if (!cart) throw new Error('Cart not found');
    return cart;
  } catch (error) {
    logger.error(`Get cart by user error: ${error.message}`);
    throw error;
  }
};

cartSchema.statics.getOrCreateCart = async function(userId, sessionId) {
  try {
    let cart = await this.findOne({ user: userId, status: 'active' });
    if (!cart) {
      cart = await this.create({
        user: userId,
        created_by: userId,
        sessionId,
        items: [],
        metadata: { creationSource: sessionId ? 'guest' : 'authenticated' }
      });
      logger.info(`Created new cart ${cart._id} for user ${userId}`);
    }
    return cart.populate('items.product');
  } catch (error) {
    logger.error(`Get or create cart error: ${error.message}`);
    throw error;
  }
};

cartSchema.statics.removeProductFromAllCarts = async function(productId) {
  try {
    const carts = await this.find({ 'items.product': productId });
    for (const cart of carts) {
      const item = cart.items.find(i => i.product.toString() === productId.toString());
      if (item) {
        await mongoose.model('Product').updateOne(
          { _id: productId },
          { $inc: { stock: item.quantity } }
        );
      }
    }
    const result = await this.updateMany(
      { 'items.product': productId },
      { $pull: { items: { product: productId } } }
    );
    logger.info(`Removed product ${productId} from ${result.modifiedCount} carts`);
    return result;
  } catch (error) {
    logger.error(`Remove product from all carts error: ${error.message}`);
    throw error;
  }
};

cartSchema.statics.clearCartForUser = async function(userId) {
  try {
    const cart = await this.findOne({ user: userId, status: 'active' });
    if (cart) {
      await cart.clearCart();
    }
    logger.info(`Cleared cart for user ${userId}`);
    return { modifiedCount: cart ? 1 : 0 };
  } catch (error) {
    logger.error(`Clear cart for user error: ${error.message}`);
    throw error;
  }
};

cartSchema.statics.getPaginatedCarts = async function({ page = 1, limit = 10, status = 'active' }) {
  try {
    const skip = (page - 1) * limit;
    const query = status ? { status } : {};
    
    const [items, total] = await Promise.all([
      this.find(query)
        .populate('user')
        .populate('items.product')
        .skip(skip)
        .limit(limit)
        .sort({ lastModified: -1 }),
      this.countDocuments(query)
    ]);

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    };
  } catch (error) {
    logger.error(`Get paginated carts error: ${error.message}`);
    throw error;
  }
};

cartSchema.statics.getTotalCarts = async function(status) {
  try {
    const query = status ? { status } : {};
    const count = await this.countDocuments(query);
    logger.info(`Counted ${count} carts with status ${status || 'all'}`);
    return count;
  } catch (error) {
    logger.error(`Get total carts error: ${error.message}`);
    throw error;
  }
};

cartSchema.statics.clearAllCarts = async function(status = 'active') {
  try {
    const carts = await this.find({ status });
    for (const cart of carts) {
      await cart.clearCart();
    }
    logger.info(`Cleared ${carts.length} carts with status ${status || 'all'}`);
    return { deletedCount: carts.length };
  } catch (error) {
    logger.error(`Clear all carts error: ${error.message}`);
    throw error;
  }
};

cartSchema.statics.getAbandonedCarts = async function({ days = 7, page = 1, limit = 10 }) {
  try {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const skip = (page - 1) * limit;
    
    const [items, total] = await Promise.all([
      this.find({
        status: 'abandoned',
        lastModified: { $lte: threshold }
      })
        .populate('user')
        .populate('items.product')
        .skip(skip)
        .limit(limit)
        .sort({ lastModified: -1 }),
      this.countDocuments({
        status: 'abandoned',
        lastModified: { $lte: threshold }
      })
    ]);

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    };
  } catch (error) {
    logger.error(`Get abandoned carts error: ${error.message}`);
    throw error;
  }
};

cartSchema.statics.bulkUpdateCartStatus = async function(userIds, status) {
  try {
    if (!['active', 'abandoned', 'converted', 'expired'].includes(status)) {
      throw new Error('Invalid status');
    }
    
    const result = await this.updateMany(
      { user: { $in: userIds }, status: { $ne: status } },
      { $set: { status, lastModified: new Date(), version: { $inc: 1 } } }
    );
    
    logger.info(`Updated status to ${status} for ${result.modifiedCount} carts`);
    return result;
  } catch (error) {
    logger.error(`Bulk update cart status error: ${error.message}`);
    throw error;
  }
};

cartSchema.statics.getCartAnalytics = async function({ startDate, endDate }) {
  try {
    const query = {
      createdAt: { $gte: startDate, $lte: endDate }
    };
    
    const [totalCarts, abandonedCarts, convertedCarts, avgCartValue] = await Promise.all([
      this.countDocuments(query),
      this.countDocuments({ ...query, status: 'abandoned' }),
      this.countDocuments({ ...query, status: 'converted' }),
      this.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'productDetails'
          }
        },
        {
          $project: {
            total: {
              $sum: {
                $map: {
                  input: '$items',
                  as: 'item',
                  in: {
                    $multiply: [
                      '$item.quantity',
                      { $arrayElemAt: ['$productDetails.price', { $indexOfArray: ['$productDetails._id', '$item.product'] }] }
                    ]
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            avgValue: { $avg: '$total' }
          }
        }
      ])
    ]);

    return {
      totalCarts,
      abandonedCarts,
      convertedCarts,
      abandonmentRate: totalCarts ? (abandonedCarts / totalCarts * 100) : 0,
      averageCartValue: avgCartValue[0]?.avgValue || 0
    };
  } catch (error) {
    logger.error(`Cart analytics error: ${error.message}`);
    throw error;
  }
};

// Error handling middleware
cartSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Cart already exists for this user'));
  } else {
    next(error);
  }
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;