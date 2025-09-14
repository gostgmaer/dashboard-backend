const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const Product = require('../../models/products');

dayjs.extend(utc);

// const { mongo_connection } = require('../config/db'); // CCDev
const Coupon = require('../../models/Coupon');
const { calculateDiscount } = require('../../utils/helper');

const addCoupon = async (req, res) => {
  try {
    const newCoupon = new Coupon(req.body);
    await newCoupon.save();
    // console.log(newCoupon);

    // var invalidProducts ;
    // const items = await Promise.all(
    //   req.body.products.map(async (productData) => {
    //     const productId = productData.id;
    //     const product = await Product.findById(productId);

    //     if (!product) {
    //       invalidProducts.push(productId);
    //       return null; // Return null for invalid products
    //     } else {
    //       return {
    //         product: productId,
    //         quantity: productData.cartQuantity,
    //         productPrice: product.price,
    //       };
    //     }
    //   })
    // );

    if (newCoupon && newCoupon.couponType === 'product') {
      if (newCoupon.applicableCategories && newCoupon.applicableCategories.length > 0) {
        // Fetch products in applicable categories
        const categoryProducts = await Product.find(
          {
            category: { $in: newCoupon.applicableCategories }
          },
          ''
        ).exec();

        const updatePromises = categoryProducts.map(async (product) => {
          const { finalAmount, discountedAmount } = calculateDiscount(product.retailPrice, newCoupon);

          await Product.updateOne({ _id: product._id }, { $set: { price: finalAmount.toFixed(2), discount: discountedAmount.toFixed(2) } });
        });

        // Wait for all updates to complete
        await Promise.all(updatePromises);
      }
      // return allProducts.map((product) => {
      //   const isProductEligible = coupon.applicableProducts.some((productId) => productId.equals(product._id));
      //   const isCategoryEligible = coupon.applicableCategories.some(
      //     (categoryId) => product.category && categoryId.equals(categoryId)
      //   );

      //   if (isProductEligible || isCategoryEligible) {
      //     const discountAmount = calculateDiscount(product.price, coupon);
      //     return {
      //       ...product,
      //       originalPrice: product.price,
      //       discountedPrice: product.price - discountAmount,
      //     };
      //   } else {
      //     return product; // Return without discount if not eligible
      //   }
      // });
    }

    res.send({ message: 'Coupon Added Successfully!' });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const addAllCoupon = async (req, res) => {
  try {
    await Coupon.deleteMany();
    await Coupon.insertMany(req.body);
    res.status(200).send({
      message: 'Coupon Added successfully!'
    });
  } catch (err) {
    res.status(500).send({
      message: err.message
    });
  }
};

const getAllCoupons = async (req, res) => {
  // console.log('coupe')
  try {
    const queryObject = {};
    const { status } = req.query;

    if (status) {
      queryObject.status = { $regex: `${status}`, $options: 'i' };
    }
    const coupons = await Coupon.find(queryObject).sort({ _id: -1 });
    // console.log('coups',coupons)
    res.send(coupons);
  } catch (err) {
    res.status(500).send({
      message: err.message
    });
  }
};

const getShowingCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find({
      status: 'show'
    }).sort({ _id: -1 });
    res.send(coupons);
  } catch (err) {
    res.status(500).send({
      message: err.message
    });
  }
};

const getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    res.send(coupon);
  } catch (err) {
    res.status(500).send({
      message: err.message
    });
  }
};

const applyCouponToProduct = async (req, res) => {
  try {
    const { products, code, cart } = req.body;

    // Fetch the coupon details
    const coupon = await Coupon.findOne({ couponCode: code }, 'couponCode discountType discountValue isActive minOrderAmount title');
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });

    const now = new Date();
    if (coupon.startTime > now || coupon.endTime < now) {
      return res.status(400).json({ success: false, message: 'Coupon is not valid at this time' });
    }

    const discountedProducts = await Promise.all(
      products.map(async (productId) => {
        const product = await Product.findById(productId);
        if (!product) return null;

        // Calculate the discount
        // let discountedPrice = product.price;
        const { finalAmount } = calculateDiscount(product.price, coupon);
        // if(coupon.discountType === "percentage") {
        //   discountedPrice = product.price * (1 - coupon.discountValue / 100);
        // } else if (coupon.discountType === "fixed") {
        //   discountedPrice = product.price - coupon.discountValue;
        // }

        // Ensure discounted price respects caps
        // discountedPrice = Math.max(discountedPrice, coupon.minOrderAmount || 0);
        // if (coupon.maxDiscount) {
        //   discountedPrice = Math.min(
        //     finalAmount,
        //     product.price - coupon.maxDiscount
        //   );
        // }

        return {
          productId: product._id,
          price: product.price,
          discountedPrice: finalAmount
        };
      })
    );


    const combined = cart.cartItems.map(quantityItem => {
      // Find the matching price item based on productId
      const priceItem = discountedProducts.find(priceItem => priceItem.productId == quantityItem.productId);

      // Return a new object that combines quantity and price information
      return {
        ...quantityItem,
        ...priceItem  // Use an empty object if no match is found
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
    res.json({
      success: true,
      coupon,
      totals, discountedProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to apply coupon',
      error: error.message
    });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (coupon) {
      coupon.title = { ...coupon.title, ...req.body.title };
      // coupon.title[req.body.lang] = req.body.title;
      // coupon.title = req.body.title;
      coupon.couponCode = req.body.couponCode;
      coupon.endTime = dayjs().utc().format(req.body.endTime);
      // coupon.discountPercentage = req.body.discountPercentage;
      coupon.minimumAmount = req.body.minimumAmount;
      coupon.productType = req.body.productType;
      coupon.discountType = req.body.discountType;
      coupon.logo = req.body.logo;

      await coupon.save();
      res.send({ message: 'Coupon Updated Successfully!' });
    }
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
};

const updateManyCoupons = async (req, res) => {
  try {
    await Coupon.updateMany(
      { _id: { $in: req.body.ids } },
      {
        $set: {
          status: req.body.status,
          startTime: req.body.startTime,
          endTime: req.body.endTime
        }
      },
      {
        multi: true
      }
    );

    res.send({
      message: 'Coupons update successfully!'
    });
  } catch (err) {
    res.status(500).send({
      message: err.message
    });
  }
};

const updateStatus = async (req, res) => {
  try {
    const newStatus = req.body.status;

    await Coupon.updateOne(
      { _id: req.params.id },
      {
        $set: {
          status: newStatus
        }
      }
    );
    res.status(200).send({
      message: `Coupon ${newStatus === 'show' ? 'Published' : 'Un-Published'} Successfully!`
    });
  } catch (err) {
    res.status(500).send({
      message: err.message
    });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    await Coupon.deleteOne({ _id: req.params.id });
    res.status(200).send({
      message: 'Coupon Deleted Successfully!'
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const deleteManyCoupons = async (req, res) => {
  try {
    await Coupon.deleteMany({ _id: req.body.ids });
    res.send({
      message: `Coupons Delete Successfully!`
    });
  } catch (err) {
    res.status(500).send({
      message: err.message
    });
  }
};

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
  applyCouponToProduct
};
