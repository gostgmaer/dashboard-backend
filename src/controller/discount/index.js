const mongoose = require('mongoose');
const DiscountRule = require('../../models/DiscountRule');
const AppliedDiscount = require('../../models/AppliedDiscount');
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
// List discount rules with pagination and filters
exports.listDiscountRules = async (req, res) => {
  try {
    const { page = 1, limit = 10, activeOnly = 'false', search = '' } = req.query;

    const query = {};

    // Filter for active rules if requested
    if (activeOnly === 'true') query.isActive = true;

    // Optional search (e.g., by name or description)
    if (search) {
      query.$or = [{ name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Count total matching records
    const total = await DiscountRule.countDocuments(query);

    // Fetch rules with pagination
    const result = await DiscountRule.find(query).sort({ priority: 1, startDate: -1 }).skip(skip).limit(parseInt(limit));

    // Pagination details
    const totalPages = Math.ceil(total / parseInt(limit));

    return res.status(200).json({
      success: true,
      status: 200,
      data: {
        result,
        pagination: {
          page: parseInt(page),
          totalPages,
          total,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
          limit: parseInt(limit),
        },
      },
      message: `Retrieved ${total} discount rules`,
    });
  } catch (err) {
    console.error('Error fetching discount rules:', err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message || 'Server error while fetching discount rules',
    });
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

    // 🔍 Build the product query dynamically based on what’s defined in the rule
    const orConditions = [];
    if (rule.productIds?.length) orConditions.push({ _id: { $in: rule.productIds } });
    if (rule.categoryIds?.length) orConditions.push({ category: { $in: rule.categoryIds } });
    if (rule.brandIds?.length) orConditions.push({ brand: { $in: rule.brandIds } });
    if (rule.tags?.length) orConditions.push({ tags: { $in: rule.tags } });

    if (!orConditions.length) throw new Error('No applicable targets found in this rule');

    const query = { $or: orConditions };

    // 🧮 MongoDB aggregation update for discount calculation
    let update = {};
    if (rule.discountType === 'percentage') {
      update = [
        {
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
        },
      ];
    } else if (rule.discountType === 'fixed') {
      update = [
        {
          $set: {
            finalPrice: { $max: [{ $subtract: ['$basePrice', rule.discountValue] }, 0] },
            salePrice: { $max: [{ $subtract: ['$basePrice', rule.discountValue] }, 0] },
            discountType: rule.discountType,
            discountValue: rule.discountValue,
            discount: rule.discountValue,
          },
        },
      ];
    } else {
      throw new Error('Invalid discount type');
    }

    // ⚙️ Fetch affected products (for tracking)
    const affectedProducts = await Product.find(query, '_id');
    if (!affectedProducts.length) return res.json({ success: false, message: 'No matching products found' });

    // 🧾 Apply the update
    const result = await Product.updateMany(query, update);

    // 🗂️ Track which products got this rule applied
    const appliedRecords = affectedProducts.map((p) => ({
      ruleId: rule._id,
      productId: p._id,
    }));

    await AppliedDiscount.insertMany(appliedRecords);
    await DiscountRule.findByIdAndUpdate(ruleId, { in_use: true });

    return res.json({
      success: true,
      message: `Discount rule applied successfully to ${affectedProducts.length} products`,
      modifiedCount: result.modifiedCount,
    });
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

    // 🔍 Find all product IDs where this rule was applied
    const applied = await AppliedDiscount.find({ ruleId, isActive: true });
    const productIds = applied.map((a) => a.productId);

    if (!productIds.length) return res.json({ success: false, message: 'No active products found for this rule' });

    // ♻️ Reset product prices to base
    const result = await Product.updateMany({ _id: { $in: productIds } }, [
      {
        $set: {
          finalPrice: '$basePrice',
          salePrice: '$basePrice',
          discountType: 'none',
          discountValue: 0,
          discount: 0,
        },
      },
    ]);

    // 🗂️ Mark AppliedDiscounts as inactive
    await AppliedDiscount.updateMany({ ruleId, isActive: true }, { $set: { isActive: false, removedAt: new Date() } });

    await DiscountRule.findByIdAndUpdate(ruleId, { isActive: false, in_use: false }, { new: true, runValidators: true });

    return res.json({
      success: true,
      message: `Removed discount rule from ${result.modifiedCount} products`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
