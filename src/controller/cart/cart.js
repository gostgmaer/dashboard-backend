const Cart = require('../../models/cart');
// const logger = require('../../config/logger');
const mongoose = require('mongoose');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
// Manual validation helper
const isValidMongoId = (id) => mongoose.Types.ObjectId.isValid(id);
const isValidQuantity = (quantity) => Number.isInteger(quantity) && quantity > 0;
const isValidDiscount = (discount) => typeof discount === 'number' && discount >= 0 && discount <= 100;
const isValidStatus = (status) => ['active', 'abandoned', 'converted', 'expired'].includes(status);

// Add item to cart
exports.addItem = async (req, res) => {
  try {
    const { productId, quantity, itemDiscount = 0 } = req.body;
    const userId = req.user._id;

    if (!isValidMongoId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    if (!isValidQuantity(quantity)) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer' });
    }
    if (!isValidDiscount(itemDiscount)) {
      return res.status(400).json({ success: false, message: 'Item discount must be between 0 and 100' });
    }

    const cart = await Cart.getOrCreateCart(userId, req.sessionID);
    await cart.addItem(productId, quantity, userId, itemDiscount);
    res.status(200).json({
      success: true,
      data: cart,
      message: 'Item added to cart successfully'
    });
  } catch (error) {
    //logger.error(`Add item error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove item from cart
exports.removeItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    if (!isValidMongoId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const cart = await Cart.getCartByUser(userId);
    await cart.removeItem(productId, userId);
    res.status(200).json({
      success: true,
      data: cart,
      message: 'Item removed from cart successfully'
    });
  } catch (error) {
    //logger.error(`Remove item error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update item quantity
exports.updateQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, itemDiscount } = req.body;
    const userId = req.user._id;

    if (!isValidMongoId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
    if (!isValidQuantity(quantity)) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer' });
    }
    if (itemDiscount !== undefined && !isValidDiscount(itemDiscount)) {
      return res.status(400).json({ success: false, message: 'Item discount must be between 0 and 100' });
    }

    const cart = await Cart.getCartByUser(userId);
    await cart.updateQuantity(productId, quantity, userId, itemDiscount);
    res.status(200).json({
      success: true,
      data: cart,
      message: 'Cart item quantity updated successfully'
    });
  } catch (error) {
    //logger.error(`Update quantity error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.getCartByUser(userId);
    await cart.clearCart(userId);
    res.status(200).json({
      success: true,
      data: cart,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    //logger.error(`Clear cart error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
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
      message: 'Cart retrieved successfully'
    });
  } catch (error) {
    //logger.error(`Get cart error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Apply cart discount
exports.applyDiscount = async (req, res) => {
  try {
    const { discountPercent } = req.body;
    const userId = req.user._id;

    if (!isValidDiscount(discountPercent)) {
      return res.status(400).json({ success: false, message: 'Discount percentage must be between 0 and 100' });
    }

    const cart = await Cart.getCartByUser(userId);
    const discountedTotal = await cart.applyDiscount(discountPercent);
    await cart.save();
    res.status(200).json({
      success: true,
      data: { cart, discountedTotal },
      message: 'Discount applied successfully'
    });
  } catch (error) {
    //logger.error(`Apply discount error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
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
      message: 'Carts merged successfully'
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
      message: 'Metadata updated successfully'
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
      status
    });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Carts retrieved successfully'
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
      limit: parseInt(limit)
    });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Abandoned carts retrieved successfully'
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
      message: 'Cart statuses updated successfully'
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
      endDate: new Date(endDate)
    });
    res.status(200).json({
      success: true,
      data: result,
      message: 'Cart analytics retrieved successfully'
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
      message: 'Product removed from all carts successfully'
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
      message: 'All carts cleared successfully'
    });
  } catch (error) {
    //logger.error(`Clear all carts error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};