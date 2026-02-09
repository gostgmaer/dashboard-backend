const Cart = require('../../models/cart');
const Product = require('../../models/products');
const mongoose = require('mongoose');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

// Manual validation helper
const isValidMongoId = (id) => mongoose.Types.ObjectId.isValid(id);
const isValidStatus = (status) => ['active', 'abandoned', 'converted', 'expired'].includes(status);

// Helper function to format cart response
const formatCartResponse = (cart, totals) => ({
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
      quantity: item.quantity,
      itemDiscount: item.itemDiscount,
      subtotal: itemSubtotal,
      thumbnail: item.product.thumbnail,
      slug: item.product.slug,
    };
  }),
});

// Get or create cart
exports.getOrCreateCart = catchAsync(async (req, res) => {
  const userId = req.user?._id || null;
  const sessionId = req.sessionID || null;

  const cart = await Cart.getOrCreateCart({ userId, sessionId });
  await cart.populate('items.product');
  const totals = cart.calculateTotals();

  return sendSuccess(res, {
    data: formatCartResponse(cart, totals),
    message: 'Cart retrieved successfully',
  });
});

// Add item to cart
exports.addItemToCart = catchAsync(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, quantity = 1, itemDiscount = 0 } = req.body;
    const userId = req.user._id;

    // Reserve inventory
    const product = await Product.findOneAndUpdate({ _id: productId, inventory: { $gte: quantity } }, { $inc: { inventory: -quantity } }, { new: true, session });

    if (!product) {
      throw AppError.badRequest('Insufficient inventory');
    }

    // Get or create cart
    const cart = await Cart.getOrCreateCart({ userId });

    // Add item
    await cart.addItem({ product: productId, quantity, itemDiscount }, userId);
    await cart.populate('items.product');
    const totals = cart.calculateTotals();

    await session.commitTransaction();
    session.endSession();

    return sendSuccess(res, {
      data: formatCartResponse(cart, totals),
      message: 'Item added to cart',
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// Remove item from cart
exports.removeCartItem = catchAsync(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const cart = await Cart.getActiveCartByUser(userId);
    const item = cart.items.find((i) => i.product.toString() === productId);

    if (!item) {
      throw AppError.notFound('Item not found in cart');
    }

    await Product.updateOne({ _id: productId }, { $inc: { inventory: item.quantity } }, { session });
    await cart.removeItem(productId, userId);
    await cart.populate('items.product');
    const totals = cart.calculateTotals();

    await session.commitTransaction();
    session.endSession();

    return sendSuccess(res, {
      data: formatCartResponse(cart, totals),
      message: 'Item removed from cart',
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// Update cart item
exports.updateCartItem = catchAsync(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { productId, quantity, itemDiscount } = req.body;
    const userId = req.user._id;

    const cart = await Cart.getActiveCartByUser(userId);
    const item = cart.items.find((i) => i.product.toString() === productId);

    if (!item) {
      throw AppError.notFound('Item not found in cart');
    }

    const diff = quantity - item.quantity;

    if (diff !== 0) {
      const product = await Product.findOneAndUpdate({ _id: productId, inventory: { $gte: diff } }, { $inc: { inventory: -diff } }, { new: true, session });
      if (!product) {
        throw AppError.badRequest('Insufficient inventory');
      }
    }

    await cart.updateItem({ product: productId, quantity, itemDiscount }, userId);
    await cart.populate('items.product');
    const totals = cart.calculateTotals();

    await session.commitTransaction();
    session.endSession();

    return sendSuccess(res, {
      data: formatCartResponse(cart, totals),
      message: 'Cart item updated',
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// Clear cart
exports.clearCart = catchAsync(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const cart = await Cart.getActiveCartByUser(userId);

    for (const item of cart.items) {
      await Product.updateOne({ _id: item.product }, { $inc: { inventory: item.quantity } }, { session });
    }

    await cart.clearCart(userId);
    await cart.populate('items.product');
    const totals = cart.calculateTotals();

    await session.commitTransaction();
    session.endSession();

    return sendSuccess(res, {
      data: formatCartResponse(cart, totals),
      message: 'Cart cleared successfully',
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});

// Get cart by user
exports.getCart = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const cart = await Cart.getCartByUser(userId);
  return sendSuccess(res, {
    data: cart,
    message: 'Cart retrieved successfully',
  });
});

// Apply cart discount
exports.applyCartDiscount = catchAsync(async (req, res) => {
  const { discount } = req.body;
  const userId = req.user._id;

  const cart = await Cart.getActiveCartByUser(userId);
  cart.cartDiscount = discount;
  cart.updated_by = userId;
  await cart.save();

  return sendSuccess(res, {
    data: cart,
    message: 'Cart discount applied',
  });
});

// Convert cart
exports.convertCart = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const cart = await Cart.getActiveCartByUser(userId);
  cart.status = 'converted';
  cart.updated_by = userId;
  await cart.save();

  return sendSuccess(res, {
    data: cart,
    message: 'Cart converted successfully',
  });
});

// Merge cart
exports.mergeCart = catchAsync(async (req, res) => {
  const { otherCartId } = req.body;
  const userId = req.user._id;

  if (!isValidMongoId(otherCartId)) {
    throw AppError.badRequest('Invalid cart ID');
  }

  const cart = await Cart.getCartByUser(userId);
  const otherCart = await Cart.findById(otherCartId);
  if (!otherCart) {
    throw AppError.notFound('Other cart not found');
  }

  await cart.mergeCart(otherCart, userId);
  return sendSuccess(res, {
    data: cart,
    message: 'Carts merged successfully',
  });
});

// Set cart metadata
exports.setMetadata = catchAsync(async (req, res) => {
  const { key, value } = req.body;
  const userId = req.user._id;

  if (!key || typeof key !== 'string' || !value || typeof value !== 'string') {
    throw AppError.badRequest('Metadata key and value must be non-empty strings');
  }

  const cart = await Cart.getCartByUser(userId);
  await cart.setMetadata(key, value, userId);
  return sendSuccess(res, {
    data: cart,
    message: 'Metadata updated successfully',
  });
});

// Admin: Get paginated carts
exports.getPaginatedCarts = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  if (status && !isValidStatus(status)) {
    throw AppError.badRequest('Invalid status');
  }

  const result = await Cart.getPaginatedCarts({
    page: parseInt(page),
    limit: parseInt(limit),
    status,
  });
  return sendSuccess(res, {
    data: result,
    message: 'Carts retrieved successfully',
  });
});

// Admin: Get abandoned carts
exports.getAbandonedCarts = catchAsync(async (req, res) => {
  const { days = 7, page = 1, limit = 10 } = req.query;
  const result = await Cart.getAbandonedCarts({
    days: parseInt(days),
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return sendSuccess(res, {
    data: result,
    message: 'Abandoned carts retrieved successfully',
  });
});

// Admin: Bulk update cart status
exports.bulkUpdateCartStatus = catchAsync(async (req, res) => {
  const { userIds, status } = req.body;

  if (!Array.isArray(userIds) || !userIds.every(isValidMongoId)) {
    throw AppError.badRequest('User IDs must be a valid array of MongoDB IDs');
  }
  if (!isValidStatus(status)) {
    throw AppError.badRequest('Invalid status');
  }

  const result = await Cart.bulkUpdateCartStatus(userIds, status);
  return sendSuccess(res, {
    data: result,
    message: 'Cart statuses updated successfully',
  });
});

// Admin: Get cart analytics
exports.getCartAnalytics = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate || isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
    throw AppError.badRequest('Valid startDate and endDate are required');
  }

  const result = await Cart.getCartAnalytics({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });
  return sendSuccess(res, {
    data: result,
    message: 'Cart analytics retrieved successfully',
  });
});

// Admin: Remove product from all carts
exports.removeProductFromAllCarts = catchAsync(async (req, res) => {
  const { productId } = req.params;
  if (!isValidMongoId(productId)) {
    throw AppError.badRequest('Invalid product ID');
  }

  const result = await Cart.removeProductFromAllCarts(productId);
  return sendSuccess(res, {
    data: result,
    message: 'Product removed from all carts successfully',
  });
});

// Admin: Clear all carts
exports.clearAllCarts = catchAsync(async (req, res) => {
  const { status } = req.query;
  if (status && !isValidStatus(status)) {
    throw AppError.badRequest('Invalid status');
  }

  const result = await Cart.clearAllCarts(status);
  return sendSuccess(res, {
    data: result,
    message: 'All carts cleared successfully',
  });
});
