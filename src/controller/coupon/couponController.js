const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const Product = require('../../models/products');
const Coupon = require('../../models/Coupon');
const { calculateDiscount } = require('../../utils/helper');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

dayjs.extend(utc);

const addCoupon = catchAsync(async (req, res) => {
  const newCoupon = new Coupon(req.body);
  await newCoupon.save();

  if (newCoupon && newCoupon.couponType === 'product') {
    if (newCoupon.applicableCategories && newCoupon.applicableCategories.length > 0) {
      const categoryProducts = await Product.find({ category: { $in: newCoupon.applicableCategories } }, '').exec();

      const updatePromises = categoryProducts.map(async (product) => {
        const { finalAmount, discountedAmount } = calculateDiscount(product.retailPrice, newCoupon);
        await Product.updateOne({ _id: product._id }, { $set: { price: finalAmount.toFixed(2), discount: discountedAmount.toFixed(2) } });
      });

      await Promise.all(updatePromises);
    }
  }

  return sendCreated(res, { message: 'Coupon added successfully' });
});

const addAllCoupon = catchAsync(async (req, res) => {
  await Coupon.deleteMany();
  await Coupon.insertMany(req.body);
  return sendSuccess(res, { message: 'Coupon added successfully' });
});

const getAllCoupons = catchAsync(async (req, res) => {
  const queryObject = {};
  const { status, isActive } = req.query;

  if (status) {
    queryObject.status = { $regex: `${status}`, $options: 'i' };
  }
  if (isActive !== undefined) {
    queryObject.isActive = isActive === 'true' || isActive === true;
  }
  queryObject.isDeleted = { $ne: true };
  const coupons = await Coupon.find(queryObject).sort({ _id: -1 });
  return sendSuccess(res, { data: coupons, message: 'Coupons retrieved' });
});

const getShowingCoupons = catchAsync(async (req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({
    isActive: true,
    isDeleted: { $ne: true },
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).sort({ _id: -1 });
  return sendSuccess(res, { data: coupons, message: 'Showing coupons retrieved' });
});

const getCouponById = catchAsync(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    throw AppError.notFound('Coupon not found');
  }
  return sendSuccess(res, { data: coupon, message: 'Coupon retrieved' });
});

const applyCouponToProduct = catchAsync(async (req, res) => {
  const { products = [], productId, code, couponCode, cart = {} } = req.body;
  const normalizedCode = String(code || couponCode || '').trim().toUpperCase();
  const productIds = products.length ? products : productId ? [productId] : [];

  const coupon = await Coupon.findOne({
    code: normalizedCode,
    isActive: true,
    isDeleted: { $ne: true },
  }, 'code discountType discountValue isActive minOrderValue title startDate endDate');
  if (!coupon) {
    throw AppError.notFound('Coupon not found');
  }

  const now = new Date();
  if (coupon.startDate > now || coupon.endDate < now) {
    throw AppError.badRequest('Coupon is not valid at this time');
  }

  if (!productIds.length) {
    throw AppError.badRequest('At least one product is required to apply coupon');
  }

  const productDocs = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(productDocs.map((product) => [product._id.toString(), product]));
  const cartItems = Array.isArray(cart.cartItems) && cart.cartItems.length
    ? cart.cartItems
    : productIds.map((id) => ({ productId: id, quantity: 1 }));

  const lineItems = cartItems.map((item) => {
    const id = String(item.productId || item.product || item._id || item.id || '');
    const product = productMap.get(id);
    if (!product) return null;

    return {
      productId: product._id,
      quantity: Number(item.quantity || item.cartQuantity || 1),
      price: Number(product.finalPrice ?? product.salePrice ?? product.basePrice ?? 0),
    };
  }).filter(Boolean);

  if (lineItems.length !== cartItems.length) {
    throw AppError.badRequest('One or more products are invalid');
  }

  const totalPrice = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (totalPrice <= 0) {
    throw AppError.badRequest('Coupon cannot be applied to a zero-value cart');
  }
  if (coupon.minOrderValue && totalPrice < coupon.minOrderValue) {
    throw AppError.badRequest(`Minimum order value is ${coupon.minOrderValue}`);
  }

  const discountAmount = coupon.discountType === 'percentage'
    ? (totalPrice * Number(coupon.discountValue || 0)) / 100
    : Number(coupon.discountValue || 0);
  const cappedDiscount = Math.min(discountAmount, totalPrice);
  const totalDiscountedPrice = Math.max(totalPrice - cappedDiscount, 0);

  const discountedProducts = lineItems.map((item) => ({
    productId: item.productId,
    price: item.price,
    discountedPrice: Number((item.price - (item.price / totalPrice) * cappedDiscount).toFixed(2)),
  }));

  return sendSuccess(res, {
    data: {
      coupon,
      totals: {
        totalPrice: Number(totalPrice.toFixed(2)),
        totalDiscountedPrice: Number(totalDiscountedPrice.toFixed(2)),
        discountAmount: Number(cappedDiscount.toFixed(2)),
      },
      discountedProducts,
    },
    message: 'Coupon applied successfully',
  });
});

const updateCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    throw AppError.notFound('Coupon not found');
  }

  Object.assign(coupon, req.body);
  await coupon.save();
  return sendSuccess(res, { message: 'Coupon updated successfully' });
});

const updateManyCoupons = catchAsync(async (req, res) => {
  await Coupon.updateMany(
    { _id: { $in: req.body.ids || req.body.couponIds } },
    { $set: req.body.updates || { isActive: req.body.status === 'show' || req.body.isActive } },
    { multi: true }
  );
  return sendSuccess(res, { message: 'Coupons update successfully' });
});

const updateStatus = catchAsync(async (req, res) => {
  const isActive = req.body.isActive ?? req.body.status === 'show';
  await Coupon.updateOne({ _id: req.params.id }, { $set: { isActive } });
  return sendSuccess(res, { message: `Coupon ${isActive ? 'Published' : 'Un-Published'} Successfully` });
});

const deleteCoupon = catchAsync(async (req, res) => {
  await Coupon.deleteOne({ _id: req.params.id });
  return sendSuccess(res, { message: 'Coupon deleted successfully' });
});

const deleteManyCoupons = catchAsync(async (req, res) => {
  await Coupon.deleteMany({ _id: req.body.ids });
  return sendSuccess(res, { message: 'Coupons delete successfully' });
});

module.exports = {
  addCoupon,
  addAllCoupon,
  getAllCoupons,
  getShowingCoupons,
  getCouponById,
  updateCoupon,
  updateStatus,
  deleteCoupon,
  updateManyCoupons,
  deleteManyCoupons,
  applyCouponToProduct,
};
