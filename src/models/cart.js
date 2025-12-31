const mongoose = require('mongoose');
const { Schema } = mongoose;

// Sub-schema for cart items
const cartItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
    },
    quantity: {
      type: Number,
      default: 1,
    },
    itemDiscount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    sessionId: {
      type: String,
      index: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },

    status: {
      type: String,
      default: 'active', // active | abandoned | converted | expired
      index: true,
    },

    cartDiscount: {
      type: Number,
      default: 0,
    },

    metadata: {
      type: Map,
      of: String,
      default: {},
    },

    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    version: {
      type: Number,
      default: 1,
    },

    lastModified: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
cartSchema.index({ user: 1, status: 1 });
cartSchema.index({ sessionId: 1, status: 1 });
cartSchema.index({ createdAt: -1 });

// Virtuals
cartSchema.virtual('totalPrice').get(function () {
  return this.calculateTotals();
});

cartSchema.virtual('totalItems').get(function () {
  return this.getTotalQuantity();
});
cartSchema.virtual('subtotal').get(function () {
  return this.items.reduce((total, item) => {
    const price = item.product?.price || 0;
    const discount = (price * item.itemDiscount) / 100;
    return total + (price - discount) * item.quantity;
  }, 0);
});

cartSchema.virtual('payableTotal').get(function () {
  const discount = (this.subtotal * this.cartDiscount) / 100;
  return Math.max(this.subtotal - discount, 0);
});
cartSchema.pre('save', function () {
  if (this.isModified()) {
    this.version += 1;
    this.lastModified = new Date();
  }
});

// Middleware for validation
// cartSchema.pre('save', async function (next) {
//   try {
//     this.lastModified = new Date();
//     this.version += 1;

//     // Validate stock availability and reserve
//     for (const item of this.items) {
//       const product = await mongoose.model('Product').findById(item.product);
//       if (!product) {
//         throw new Error(`Product ${item.product} not found`);
//       }
//       if (product.stock < item.quantity) {
//         throw new Error(`Insufficient stock for product ${product.name}`);
//       }
//       // Set reservation expiry (1 hour from now)
//       item.reservedUntil = new Date(Date.now() + 60 * 60 * 1000);
//     }
//   } catch (error) {
//     next(error);
//   }
// });
cartSchema.pre(['deleteOne', 'findOneAndDelete'], { document: false, query: true }, async function () {
  const cart = await this.model.findOne(this.getQuery());
  if (!cart) return;

  for (const item of cart.items) {
    await mongoose.model('Product').updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
  }
});

// Release stock reservations on cart deletion
cartSchema.pre('deleteOne', { document: true, query: false }, async function () {
  for (const item of this.items) {
    await mongoose.model('Product').updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
  }
});

cartSchema.methods.getPayableTotal = function () {
  const total = this.calculateTotals();
  const discount = (total * this.cartDiscount) / 100;
  return Math.max(total - discount, 0);
};

// Instance Methods
cartSchema.methods.addItem = async function ({ product, quantity = 1, itemDiscount = 0 }, userId) {
  const existing = this.items.find((i) => i.product.toString() === product.toString());

  if (existing) {
    existing.quantity += quantity;
    existing.itemDiscount = itemDiscount;
  } else {
    this.items.push({
      product,
      quantity,
      itemDiscount,
    });
  }

  this.markModified('items');
  this.updated_by = userId;

  await this.save();

  // 🔑 populate AFTER save
  return this.populate({
    path: 'items.product',
    select: '_id name price thumbnail slug',
  });
};

cartSchema.methods.updateItem = async function ({ product, quantity, itemDiscount }, userId) {
  const item = this.items.find((i) => i.product.toString() === product.toString());

  if (!item) return this;

  if (quantity !== undefined) item.quantity = quantity;
  if (itemDiscount !== undefined) item.itemDiscount = itemDiscount;

  this.markModified('items');
  this.updated_by = userId;

  await this.save();

  return this.populate({
    path: 'items.product',
    select: '_id name price thumbnail slug',
  });
};

cartSchema.methods.removeItem = function (productId, userId) {
  this.items = this.items.filter((item) => item.product.toString() !== productId.toString());
  this.updated_by = userId;
  return this.save();
};

cartSchema.methods.updateQuantity = async function (productId, quantity, updated_by, itemDiscount) {
  try {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (itemDiscount !== undefined && (itemDiscount < 0 || itemDiscount > 100)) {
      throw new Error('Invalid item discount percentage');
    }

    const item = this.items.find((item) => item.product.toString() === productId.toString());
    if (!item) throw new Error('Item not found in cart');

    const product = await mongoose.model('Product').findById(productId);
    if (!product) throw new Error('Product not found');

    // Adjust stock based on quantity difference
    const quantityDiff = quantity - item.quantity;
    if (product.stock < quantityDiff) throw new Error('Insufficient stock');

    await mongoose.model('Product').updateOne({ _id: productId }, { $inc: { stock: -quantityDiff } });

    item.quantity = quantity;
    if (itemDiscount !== undefined) item.itemDiscount = itemDiscount;
    this.updated_by = updated_by || this.created_by;
    await this.save();
    return this.populate('items.product');
  } catch (error) {
    throw error;
  }
};

cartSchema.methods.clearCart = function (userId) {
  this.items = [];
  this.updated_by = userId;
  return this.save();
};

cartSchema.methods.getTotalQuantity = function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
};

cartSchema.methods.calculateTotals = function () {
  let subtotal = 0;

  for (const item of this.items) {
    if (!item.product || typeof item.product.finalPrice !== 'number') {
      continue; // product not populated → skip safely
    }

    const itemTotal = item.product.finalPrice * item.quantity;
    const discount = itemTotal * (item.itemDiscount / 100);

    subtotal += itemTotal - discount;
  }

  const cartDiscount = (subtotal * this.cartDiscount) / 100;

  return {
    subtotal,
    cartDiscount,
    payableTotal: Math.max(subtotal - cartDiscount, 0),
    totalItems: this.items.reduce((sum, i) => sum + i.quantity, 0),
  };
};

cartSchema.methods.applyDiscount = function (discountPercent) {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Invalid discount percentage');
  }
  this.cartDiscount = discountPercent;
  const total = this.calculateTotals();
  const cartDiscount = (total * discountPercent) / 100;
  return total - cartDiscount;
};

cartSchema.methods.hasProduct = function (productId) {
  return this.items.some((item) => item.product.toString() === productId.toString());
};

cartSchema.methods.mergeCart = async function (otherCart, updated_by) {
  try {
    for (const otherItem of otherCart.items) {
      await this.addItem(otherItem.product, otherItem.quantity, updated_by, otherItem.itemDiscount);
    }
    return this.populate('items.product');
  } catch (error) {
    throw error;
  }
};

cartSchema.methods.setMetadata = function (key, value, userId) {
  this.metadata.set(key, value);
  this.updated_by = userId;
  return this.save();
};

// Static Methods
cartSchema.statics.getCartByUser = async function (userId) {
  try {
    const cart = await this.findOne({ user: userId, status: 'active' }).populate('items.product').populate('user');
    if (!cart) throw new Error('Cart not found');
    return cart;
  } catch (error) {
    throw error;
  }
};

cartSchema.statics.getOrCreateCart = async function ({ userId, sessionId }) {
  let cart = null;

  if (userId) {
    cart = await this.findOne({ user: userId, status: 'active' });
  }

  if (!cart && sessionId) {
    cart = await this.findOne({ sessionId, status: 'active' });
  }

  if (!cart) {
    cart = await this.create({
      user: userId || null,
      sessionId: sessionId || null,
      created_by: userId || null,
      status: 'active',
      items: [],
    });
  }

  return cart;
};

cartSchema.statics.getActiveCartByUser = function (userId) {
  return this.findOne({ user: userId, status: 'active' }).populate('items.product').populate('user');
};

cartSchema.statics.markExpired = function (beforeDate) {
  return this.updateMany({ status: 'abandoned', lastModified: { $lte: beforeDate } }, { $set: { status: 'expired' } });
};
cartSchema.statics.removeProductFromAllCarts = async function (productId) {
  try {
    const carts = await this.find({ 'items.product': productId });
    for (const cart of carts) {
      const item = cart.items.find((i) => i.product.toString() === productId.toString());
      if (item) {
        await mongoose.model('Product').updateOne({ _id: productId }, { $inc: { stock: item.quantity } });
      }
    }
    const result = await this.updateMany({ 'items.product': productId }, { $pull: { items: { product: productId } } });
    return result;
  } catch (error) {
    throw error;
  }
};

cartSchema.statics.clearCartForUser = async function (userId) {
  try {
    const cart = await this.findOne({ user: userId, status: 'active' });
    if (cart) {
      await cart.clearCart();
    }
    return { modifiedCount: cart ? 1 : 0 };
  } catch (error) {
    throw error;
  }
};

cartSchema.statics.getPaginated = async function ({ page = 1, limit = 10, status }) {
  const skip = (page - 1) * limit;
  const query = status ? { status } : {};

  const [items, total] = await Promise.all([this.find(query).populate('user').populate('items.product').skip(skip).limit(limit).sort({ lastModified: -1 }), this.countDocuments(query)]);

  return {
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
    limit,
  };
};

cartSchema.statics.getTotalCarts = async function (status) {
  try {
    const query = status ? { status } : {};
    const count = await this.countDocuments(query);
    return count;
  } catch (error) {
    throw error;
  }
};

cartSchema.statics.clearAllCarts = async function (status = 'active') {
  try {
    const carts = await this.find({ status });
    for (const cart of carts) {
      await cart.clearCart();
    }
    return { deletedCount: carts.length };
  } catch (error) {
    throw error;
  }
};

cartSchema.statics.markAbandoned = function (beforeDate) {
  return this.updateMany({ status: 'active', lastModified: { $lte: beforeDate } }, { $set: { status: 'abandoned' } });
};

cartSchema.statics.getAbandonedCarts = async function ({ days = 7, page = 1, limit = 10 }) {
  try {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.find({
        status: 'abandoned',
        lastModified: { $lte: threshold },
      })
        .populate('user')
        .populate('items.product')
        .skip(skip)
        .limit(limit)
        .sort({ lastModified: -1 }),
      this.countDocuments({
        status: 'abandoned',
        lastModified: { $lte: threshold },
      }),
    ]);

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
      limit,
    };
  } catch (error) {
    throw error;
  }
};

cartSchema.statics.bulkUpdateCartStatus = async function (userIds, status) {
  try {
    if (!['active', 'abandoned', 'converted', 'expired'].includes(status)) {
      throw new Error('Invalid status');
    }

    const result = await this.updateMany({ user: { $in: userIds }, status: { $ne: status } }, { $set: { status, lastModified: new Date() }, $inc: { version: 1 } });

    return result;
  } catch (error) {
    throw error;
  }
};

cartSchema.statics.getCartAnalytics = async function ({ startDate, endDate }) {
  try {
    const query = {
      createdAt: { $gte: startDate, $lte: endDate },
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
            as: 'productDetails',
          },
        },
        {
          $project: {
            total: {
              $sum: {
                $map: {
                  input: '$items',
                  as: 'item',
                  in: {
                    $multiply: ['$$item.quantity', { $arrayElemAt: ['$productDetails.price', { $indexOfArray: ['$productDetails._id', '$$item.product'] }] }],
                  },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            avgValue: { $avg: '$total' },
          },
        },
      ]),
    ]);

    return {
      totalCarts,
      abandonedCarts,
      convertedCarts,
      abandonmentRate: totalCarts ? (abandonedCarts / totalCarts) * 100 : 0,
      averageCartValue: avgCartValue[0]?.avgValue || 0,
    };
  } catch (error) {
    throw error;
  }
};

// Error handling middleware
cartSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('Cart already exists for this user'));
  } else {
    next(error);
  }
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
