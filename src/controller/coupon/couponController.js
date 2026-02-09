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
  const { status } = req.query;

  if (status) {
    queryObject.status = { $regex: `${status}`, $options: 'i' };
  }
  const coupons = await Coupon.find(queryObject).sort({ _id: -1 });
  return sendSuccess(res, { data: coupons, message: 'Coupons retrieved' });
});

const getShowingCoupons = catchAsync(async (req, res) => {
  const coupons = await Coupon.find({ status: 'show' }).sort({ _id: -1 });
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
  const { products, code, cart } = req.body;

  const coupon = await Coupon.findOne({ couponCode: code }, 'couponCode discountType discountValue isActive minOrderAmount title');
  if (!coupon) {
    throw AppError.notFound('Coupon not found');
  }

  const now = new Date();
  if (coupon.startTime > now || coupon.endTime < now) {
    throw AppError.badRequest('Coupon is not valid at this time');
  }

  const discountedProducts = await Promise.all(
    products.map(async (productId) => {
      const product = await Product.findById(productId);
      if (!product) return null;

      const { finalAmount } = calculateDiscount(product.price, coupon);

      return {
        productId: product._id,
        price: product.price,
        discountedPrice: finalAmount,
      };
    })
  );

  const combined = cart.cartItems.map((quantityItem) => {
    const priceItem = discountedProducts.find((priceItem) => priceItem.productId == quantityItem.productId);
    return {
      ...quantityItem,
      ...priceItem,
    };
  });

  const totals = combined.reduce(
    (acc, item) => {
      acc.totalPrice += parseFloat(item.price) * parseFloat(item.quantity);
      acc.totalDiscountedPrice += parseFloat(item.discountedPrice) * parseFloat(item.quantity);
      return acc;
    },
    { totalPrice: 0, totalDiscountedPrice: 0 }
  );

  return sendSuccess(res, {
    data: { coupon, totals, discountedProducts },
    message: 'Coupon applied successfully',
  });
});

const updateCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    throw AppError.notFound('Coupon not found');
  }

  coupon.title = { ...coupon.title, ...req.body.title };
  coupon.couponCode = req.body.couponCode;
  coupon.endTime = dayjs().utc().format(req.body.endTime);
  coupon.minimumAmount = req.body.minimumAmount;
  coupon.productType = req.body.productType;
  coupon.discountType = req.body.discountType;
  coupon.logo = req.body.logo;

  await coupon.save();
  return sendSuccess(res, { message: 'Coupon updated successfully' });
});

const updateManyCoupons = catchAsync(async (req, res) => {
  await Coupon.updateMany(
    { _id: { $in: req.body.ids } },
    { $set: { status: req.body.status, startTime: req.body.startTime, endTime: req.body.endTime } },
    { multi: true }
  );
  return sendSuccess(res, { message: 'Coupons update successfully' });
});

const updateStatus = catchAsync(async (req, res) => {
  const newStatus = req.body.status;
  await Coupon.updateOne({ _id: req.params.id }, { $set: { status: newStatus } });
  return sendSuccess(res, { message: `Coupon ${newStatus === 'show' ? 'Published' : 'Un-Published'} Successfully` });
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
