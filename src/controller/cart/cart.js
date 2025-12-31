const Cart = require('../../models/cart');
const Product = require('../../models/products');
// const logger = require('../../config/logger');
const mongoose = require('mongoose');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
// Manual validation helper
const isValidMongoId = (id) => mongoose.Types.ObjectId.isValid(id);
const isValidQuantity = (quantity) => Number.isInteger(quantity) && quantity > 0;
const isValidDiscount = (discount) => typeof discount === 'number' && discount >= 0 && discount <= 100;
const isValidStatus = (status) => ['active', 'abandoned', 'converted', 'expired'].includes(status);

// Add item to cart

exports.getOrCreateCart = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const sessionId = req.sessionID || null;

    const cart = await Cart.getOrCreateCart({ userId, sessionId });

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (err) {
    next(err);
  }
};

exports.addItemToCart = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, quantity = 1, itemDiscount = 0 } = req.body;
    const userId = req.user._id;

    /* 1️⃣ Reserve inventory */
    const product = await Product.findOneAndUpdate({ _id: productId, inventory: { $gte: quantity } }, { $inc: { inventory: -quantity } }, { new: true, session });

    if (!product) {
      throw new Error('Insufficient inventory');
    }

    /* 2️⃣ Get or create cart */
    const cart = await Cart.getOrCreateCart({ userId });

    /* 3️⃣ Add item (NO PRICE STORED) */
    await cart.addItem(
      {
        product: productId,
        quantity,
        itemDiscount,
      },
      userId
    );

    /* 4️⃣ Populate product data */
    await cart.populate('items.product');

    /* 5️⃣ Calculate totals AFTER populate */
    const totals = cart.calculateTotals();

    await session.commitTransaction();
    session.endSession();

    /* 6️⃣ SHAPED RESPONSE (DTO) */
    res.status(200).json({
      success: true,
      data: {
        cartId: cart._id,
        status: cart.status,

        totalItems: totals.totalItems,
        subtotal: totals.subtotal,
        payableTotal: totals.payableTotal,

        items: cart.items.map((item) => {
          const price = item.product?.finalPrice || 0;
          const itemSubtotal = (price - (price * item.itemDiscount) / 100) * item.quantity;

          return {
            productId: item.product._id,
            name: item.product.name,
            price,
            quantity: item.quantity.toFixed(2),
            itemDiscount: item.itemDiscount,
            subtotal: itemSubtotal.toFixed(2),
            thumbnail: item.product.thumbnail,
            slug: item.product.slug,
          };
        }),
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

// Remove item from cart
exports.removeCartItem = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const cart = await Cart.getActiveCartByUser(userId);
    const item = cart.items.find((i) => i.product.toString() === productId);

    if (!item) throw new Error('Item not found');

    await Product.updateOne({ _id: productId }, { $inc: { inventory: item.quantity } }, { session });

    await cart.removeItem(productId, userId);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: await cart.populate('items.product'),
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

exports.updateCartItem = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, quantity, itemDiscount } = req.body;
    const userId = req.user._id;

    const cart = await Cart.getActiveCartByUser(userId);
    const item = cart.items.find((i) => i.product.toString() === productId);

    if (!item) throw new Error('Item not found');

    const diff = quantity - item.quantity;

    if (diff !== 0) {
      const product = await Product.findOneAndUpdate({ _id: productId, inventory: { $gte: diff } }, { $inc: { inventory: -diff } }, { new: true, session });
      if (!product) throw new Error('Insufficient inventory');
    }

    await cart.updateItem({ product: productId, quantity, itemDiscount }, userId);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: await cart.populate('items.product'),
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

// Clear cart
exports.clearCart = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const cart = await Cart.getActiveCartByUser(userId);

    for (const item of cart.items) {
      await Product.updateOne({ _id: item.product }, { $inc: { inventory: item.quantity } }, { session });
    }

    await cart.clearCart(userId);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};
// Get cart by user
exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.getCartByUser(userId);
    res.status(200).json({
      success: true,
      data: cart,
      message: 'Cart retrieved successfully',
    });
  } catch (error) {
    //logger.error(`Get cart error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Apply cart discount
exports.applyCartDiscount = async (req, res, next) => {
  try {
    const { discount } = req.body;
    const userId = req.user._id;

    const cart = await Cart.getActiveCartByUser(userId);
    cart.cartDiscount = discount;
    cart.updated_by = userId;

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (err) {
    next(err);
  }
};
exports.convertCart = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.getActiveCartByUser(userId);
    cart.status = 'converted';
    cart.updated_by = userId;

    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart converted successfully',
      data: cart,
    });
  } catch (err) {
    next(err);
  }
};

// Merge cart
exports.mergeCart = async (req, res) => {
  try {
    const { otherCartId } = req.body;
    const userId = req.user._id;

    if (!isValidMongoId(otherCartId)) {
      return res.status(400).json({ success: false, message: 'Invalid cart ID' });
    }

    const cart = await Cart.getCartByUser(userId);
    const otherCart = await Cart.findById(otherCartId);
    if (!otherCart) {
      return res.status(404).json({ success: false, message: 'Other cart not found' });
    }

    await cart.mergeCart(otherCart, userId);
    res.status(200).json({
      success: true,
      data: cart,
      message: 'Carts merged successfully',
    });
  } catch (error) {
    //logger.error(`Merge cart error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Set cart metadata
exports.setMetadata = async (req, res) => {
  try {
    const { key, value } = req.body;
    const userId = req.user._id;

    if (!key || typeof key !== 'string' || !value || typeof value !== 'string') {
      return res.status(400).json({ success: false, message: 'Metadata key and value must be non-empty strings' });
    }

    const cart = await Cart.getCartByUser(userId);
    await cart.setMetadata(key, value, userId);
    res.status(200).json({
      success: true,
      data: cart,
      message: 'Metadata updated successfully',
    });
  } catch (error) {
    //logger.error(`Set metadata error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Get paginated carts
exports.getPaginatedCarts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    if (status && !isValidStatus(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await Cart.getPaginatedCarts({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Carts retrieved successfully',
    });
  } catch (error) {
    //logger.error(`Get paginated carts error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Get abandoned carts
exports.getAbandonedCarts = async (req, res) => {
  try {
    const { days = 7, page = 1, limit = 10 } = req.query;
    const result = await Cart.getAbandonedCarts({
      days: parseInt(days),
      page: parseInt(page),
      limit: parseInt(limit),
    });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Abandoned carts retrieved successfully',
    });
  } catch (error) {
    //logger.error(`Get abandoned carts error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Bulk update cart status
exports.bulkUpdateCartStatus = async (req, res) => {
  try {
    const { userIds, status } = req.body;

    if (!Array.isArray(userIds) || !userIds.every(isValidMongoId)) {
      return res.status(400).json({ success: false, message: 'User IDs must be a valid array of MongoDB IDs' });
    }
    if (!isValidStatus(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await Cart.bulkUpdateCartStatus(userIds, status);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Cart statuses updated successfully',
    });
  } catch (error) {
    //logger.error(`Bulk update cart status error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Get cart analytics
exports.getCartAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate || isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
      return res.status(400).json({ success: false, message: 'Valid startDate and endDate are required' });
    }

    const result = await Cart.getCartAnalytics({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Cart analytics retrieved successfully',
    });
  } catch (error) {
    //logger.error(`Cart analytics error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Remove product from all carts
exports.removeProductFromAllCarts = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isValidMongoId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const result = await Cart.removeProductFromAllCarts(productId);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Product removed from all carts successfully',
    });
  } catch (error) {
    //logger.error(`Remove product from all carts error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Clear all carts
exports.clearAllCarts = async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !isValidStatus(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const result = await Cart.clearAllCarts(status);
    res.status(200).json({
      success: true,
      data: result,
      message: 'All carts cleared successfully',
    });
  } catch (error) {
    //logger.error(`Clear all carts error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};
