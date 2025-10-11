const mongoose = require('mongoose');
const DiscountRule = require('../../models/DiscountRule');
const PromoCode = require('../../models/Coupon');
const { priceWithRules, applyPromoCode, applyDiscountsAtCheckout } = require('../../services/discount');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
const Product = require('../../models/products');
// Create or update a discount rule
exports.upsertDiscountRule = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const doc = id ? await DiscountRule.findByIdAndUpdate(id, payload, { new: true, runValidators: true }) : await DiscountRule.create(payload);

    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// List active discount rules (with filters)
exports.listDiscountRules = async (req, res) => {
  try {
    const { activeOnly = 'true' } = req.query;
    const query = {};
    if (activeOnly === 'true') query.isActive = true;
    const rules = await DiscountRule.find(query).sort({ priority: 1, startDate: -1 });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Soft deactivate a rule
exports.toggleRuleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const doc = await DiscountRule.findByIdAndUpdate(id, { isActive }, { new: true });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Preview pricing with rules (no promo)
exports.previewRulesPricing = async (req, res) => {
  try {
    const { items } = req.body; // [{ productId, quantity }]
    const pricing = await priceWithRules({ items });
    res.json(pricing);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Create or update a promo code
exports.upsertPromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    payload.code = payload.code?.toUpperCase();

    const doc = id ? await PromoCode.findByIdAndUpdate(id, payload, { new: true, runValidators: true }) : await PromoCode.create(payload);

    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Apply promo to cart (stacked on top of rules)
exports.applyPromoToCart = async (req, res) => {
  try {
    const { code, items, customerId } = req.body;
    const pricing = await applyPromoCode({ code, customerId, items });
    res.json(pricing);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Checkout endpoint to finalize discounts with transaction
exports.checkoutWithDiscounts = async () => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order } = req.body; // { items, promoCode, customerId }
    const pricing = await applyDiscountsAtCheckout({ session, order });

    // TODO: integrate stock reduce + order create here in same tx
    // Example: await Order.create([ { ...order, totals: pricing } ], { session });

    await session.commitTransaction();
    res.json({ success: true, pricing });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

exports.applyDiscountRule = async (req, res) => {
  try {
    const ruleId = req.params.ruleId;

    const rule = await DiscountRule.findById(ruleId);
    if (!rule || !rule.isActive) throw new Error('Rule not found or inactive');

    // Build the product query
    const query = {
      $or: [
        { category: { $in: rule.categoryIds || [] } }, // single ObjectId
        { tags: { $in: rule.tags || [] } }, // array field
        { brand: { $in: rule.brandIds || [] } }, // single value
      ],
    };

    // MongoDB aggregation expression for discount
    let update = {};
    if (rule.discountType === 'percentage') {
      update = {
        $set: {
          finalPrice: {
            $max: [{ $subtract: ['$basePrice', { $multiply: ['$basePrice', rule.discountValue / 100] }] }, 0],
          },
          salePrice: {
            $max: [{ $subtract: ['$basePrice', { $multiply: ['$basePrice', rule.discountValue / 100] }] }, 0],
          },
          discountType: rule.discountType,
          discountValue: rule.discountValue,
          discount: { $multiply: ['$basePrice', rule.discountValue / 100] },
        },
      };
    } else if (rule.discountType === 'fixed') {
      update = {
        $set: {
          finalPrice: { $max: [{ $subtract: ['$basePrice', rule.discountValue] }, 0] },
          salePrice: { $max: [{ $subtract: ['$basePrice', rule.discountValue] }, 0] },
          discountType: rule.discountType,
          discountValue: rule.discountValue,
          discount: rule.discountValue,
        },
      };
    }

    // Use updateMany with aggregation pipeline (MongoDB >= 4.2)
    const result = await Product.updateMany(query, [update]);
    return res.json({ success: true, modifiedCount: result.modifiedCount });
    // return result.modifiedCount;
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeDiscountRule = async (req, res) => {
  try {
    const ruleId = req.params.ruleId;

    const rule = await DiscountRule.findById(ruleId);
    if (!rule) throw new Error('Rule not found');

    const query = {
      $or: [{ categories: { $in: rule.categories || [] } }, { tags: { $in: rule.tags || [] } }, { brand: { $in: rule.brands || [] } }],
      discountType: rule.discountType,
      discountValue: rule.discountValue,
    };

    const result = await Product.updateMany(query, {
      $set: {
        finalPrice: '$basePrice',
        salePrice: '$basePrice',
        discountType: 'none',
        discountValue: 0,
        discount: 0,
      },
    });

    return res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
