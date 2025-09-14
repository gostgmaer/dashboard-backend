const express = require('express');
const couponRouter = express.Router();
const {
  addCoupon,
  addAllCoupon,
  getAllCoupons,
  getShowingCoupons,
  getCouponById,
  updateCoupon,
  updateStatus,
  deleteCoupon,
  updateManyCoupons, applyCouponToProduct,
  deleteManyCoupons,
} = require('../controller/coupon/couponController');

couponRouter.route('/coupon/add').post(addCoupon);

// Apply coupon to product
couponRouter.route('/coupon/apply').post(applyCouponToProduct);

// Add multiple coupons
couponRouter.route('/coupon/add/all').post(addAllCoupon);

// Get all coupons
couponRouter.route('/coupon').get(getAllCoupons);

// Get only enabled coupons (showing)
couponRouter.route('/coupon/show').get(getShowingCoupons);

// Get a single coupon by ID
couponRouter.route('/coupon/:id').get(getCouponById);

// Update a single coupon by ID
couponRouter.route('/coupon/:id').put(updateCoupon);

// Update many coupons
couponRouter.route('/coupon/update/many').patch(updateManyCoupons);

// Show/hide a coupon (update status)
couponRouter.route('/coupon/status/:id').put(updateStatus);

// Delete a single coupon by ID
couponRouter.route('/coupon/:id').delete(deleteCoupon);

// Delete multiple coupons
couponRouter.route('/coupon/delete/many').patch(deleteManyCoupons);
module.exports = couponRouter;
