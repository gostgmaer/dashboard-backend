const mongoose = require('mongoose');
const { FilterOptions } = require('../../utils/helper');
const Order = require('../../models/orders');
const Product = require('../../models/products');
const { createPayPalOrder, verifyPayPalPayment } = require('../payment/paypalHelper');
const { createRazorpayOrder, verifyRazorpayPayment } = require('../payment/rozorpay');
const { processCodOrder } = require('../payment/codhelper');
const { updateStockOnOrderCreate, updateStockOnOrderCancel, removeOrderedItemsFromWishlist } = require('../../lib/stock-controller/others');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

const createOrder = catchAsync(async (req, res) => {
  const { payment_method, invoice, orderDetails } = req.body;

  let invalidProducts = [];
  const items = await Promise.all(
    req.body.products.map(async (productData) => {
      const productId = productData.id;
      const product = await Product.findById(productId);

      if (!product) {
        invalidProducts.push(productId);
        return null;
      } else {
        return {
          product: productId,
          quantity: productData.cartQuantity,
          productPrice: product.price,
        };
      }
    })
  );

  if (invalidProducts.length > 0) {
    throw AppError.badRequest(`Invalid product(s) provided: ${invalidProducts.join(', ')}`);
  }

  const validItems = items.filter((item) => item !== null);
  const total = validItems.reduce((acc, item) => acc + item.quantity * item.productPrice, 0);

  let paymentResponse;
  switch (payment_method) {
    case 'paypal':
      paymentResponse = await createPayPalOrder(total, 'USD', req.body);
      break;
    case 'RazorPay':
      paymentResponse = await createRazorpayOrder(total, 'INR', invoice);
      break;
    case 'COD':
      paymentResponse = processCodOrder(total, 'INR', orderDetails);
      break;
    default:
      throw AppError.badRequest('Invalid payment method');
  }

  var newOrder = new Order({
    items: validItems,
    total,
    currency: 'INR',
    payment_status: 'pending',
    receipt: invoice || null,
    transaction_id: paymentResponse.id || null,
    ...req.body,
    ...paymentResponse,
    status: 'pending',
  });

  const savedOrder = await newOrder.save();
  await updateStockOnOrderCreate(req.body.products);
  await removeOrderedItemsFromWishlist(req.body.user, savedOrder.items);

  if (payment_method === 'COD') {
    return sendSuccess(res, { data: savedOrder, message: 'Order successfully!' });
  }
  return sendSuccess(res, { data: { ...paymentResponse, payment_method }, message: 'Order Created!' });
});

const verifyPayment = catchAsync(async (req, res) => {
  const { payment_method, paymentId, PayerID, order_id, signature } = req.body;

  let paymentResponse;
  switch (payment_method) {
    case 'paypal':
      paymentResponse = await verifyPayPalPayment(paymentId, PayerID);
      break;
    case 'RazorPay':
      paymentResponse = verifyRazorpayPayment(order_id, paymentId, signature);
      break;
    case 'COD':
      return sendSuccess(res, { message: 'COD order does not require verification' });
    default:
      throw AppError.badRequest('Invalid payment method');
  }

  const order = await Order.findOne({ transaction_id: order_id });
  let savedOrder;
  if (order) {
    order.payment_status = 'completed';
    order.status = 'completed';
    savedOrder = await order.save();
  }

  return sendSuccess(res, { data: savedOrder, message: 'Order successfully!' });
});

const getOrders = catchAsync(async (req, res) => {
  const filterquery = FilterOptions(req.query, Order);
  const orders = await Order.find(filterquery.query, '-__v ', filterquery.options)
    .populate('user', 'firstName lastName email phoneNumber')
    .populate('items.product');

  const length = await Order.countDocuments(filterquery.query);

  return sendSuccess(res, {
    data: { results: orders, total: length },
    message: 'Orders data has been loaded successfully',
  });
});

const getCustomerOrders = catchAsync(async (req, res) => {
  const filterquery = FilterOptions(req.query, Order);
  const orders = await Order.find({ ...filterquery.query, user: req.params.user }, 'total createdAt invoice payment_method payment_status status totalPrice', filterquery.options)
    .populate('user', 'firstName lastName email phoneNumber')
    .populate('items.product', '-_id -categories -category -variants -status')
    .populate('address');

  const length = await Order.countDocuments({ ...filterquery.query, user: req.params.user });

  return sendSuccess(res, {
    data: { results: orders, total: length },
    message: 'Orders data has been loaded successfully',
  });
});

const getCustomerDashboard = catchAsync(async (req, res) => {
  const user = new mongoose.Types.ObjectId(req.params.user);
  const filterquery = FilterOptions(req.query, Order);

  const orderStats = await Order.aggregate([
    { $match: { user: user } },
    {
      $facet: {
        total: [{ $count: 'total' }],
        pending: [{ $match: { status: 'pending' } }, { $count: 'pending' }],
        delivered: [{ $match: { status: 'delivered' } }, { $count: 'delivered' }],
        shipped: [{ $match: { status: 'shipped' } }, { $count: 'shipped' }],
        completed: [{ $match: { status: 'completed' } }, { $count: 'completed' }],
        failed: [{ $match: { status: 'failed' } }, { $count: 'failed' }],
        cancelled: [{ $match: { status: 'cancelled' } }, { $count: 'cancelled' }],
        processing: [{ $match: { status: 'processing' } }, { $count: 'processing' }],
        'on-hold': [{ $match: { status: 'on-hold' } }, { $count: 'on-hold' }],
      },
    },
    {
      $project: {
        total: { $arrayElemAt: ['$total.total', 0] },
        pending: { $ifNull: [{ $arrayElemAt: ['$pending.pending', 0] }, 0] },
        processing: { $ifNull: [{ $arrayElemAt: ['$processing.processing', 0] }, 0] },
        failed: { $ifNull: [{ $arrayElemAt: ['$failed.failed', 0] }, 0] },
        cancelled: { $ifNull: [{ $arrayElemAt: ['$cancelled.cancelled', 0] }, 0] },
        completed: { $ifNull: [{ $arrayElemAt: ['$completed.completed', 0] }, 0] },
        shipped: { $ifNull: [{ $arrayElemAt: ['$shipped.shipped', 0] }, 0] },
        delivered: { $ifNull: [{ $arrayElemAt: ['$delivered.delivered', 0] }, 0] },
        'on-hold': { $ifNull: [{ $arrayElemAt: ['$on-hold.on-hold', 0] }, 0] },
      },
    },
  ]);

  const orders = await Order.find({ ...filterquery.query, user: req.params.user }, 'total createdAt invoice payment_method payment_status status totalPrice', filterquery.options).populate('user');
  const length = await Order.countDocuments({ ...filterquery.query, user: req.params.user });

  return sendSuccess(res, {
    data: { order: { results: orders, total: length }, ...orderStats[0] },
    message: 'Orders data has been loaded successfully',
  });
});

const getSingleOrder = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw AppError.badRequest('Order id is not provided');
  }

  const order = await Order.findOne({ _id: id }, '-__v')
    .populate('user', 'firstName lastName email phoneNumber')
    .populate('items.product', '-_id -categories -category -variants -status')
    .populate('address')
    .exec();

  if (!order) {
    throw AppError.notFound('No information found for given id');
  }

  return sendSuccess(res, { data: order, message: 'Order data loaded successfully' });
});

const updateOrder = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw AppError.badRequest('Order id is not provided');
  }

  const update = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!update) {
    throw AppError.notFound('Order does not exist');
  }

  return sendSuccess(res, { message: 'Order update successfully' });
});

const deleteOrder = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw AppError.badRequest('id is not provided');
  }

  const order = await Order.findOne({ _id: id });
  if (!order) {
    throw AppError.notFound('Order does not exist');
  }

  await Order.deleteOne({ _id: id });
  return sendSuccess(res, { message: 'Delete success' });
});

const cancelOrder = catchAsync(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findById(id);
  if (!order) {
    throw AppError.notFound('Order not found');
  }

  if (order.status === 'canceled') {
    throw AppError.badRequest('Order is already canceled');
  }

  order.status = 'canceled';
  order.payment_status = 'canceled';
  await order.save();

  await updateStockOnOrderCancel(order.items);

  return sendSuccess(res, { message: 'Order successfully canceled' });
});

module.exports = {
  updateOrder,
  getOrders,
  getSingleOrder,
  deleteOrder,
  createOrder,
  verifyPayment,
  getCustomerOrders,
  getCustomerDashboard,
  cancelOrder,
};
