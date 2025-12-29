const mongoose = require('mongoose');
const DiscountRule = require('../../models/DiscountRule');
const AppliedDiscount = require('../../models/AppliedDiscount');
const PromoCode = require('../../models/Coupon');
const { priceWithRules, applyPromoCode, applyDiscountsAtCheckout } = require('../../services/discount');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
const Product = require('../../models/products');

const DEFAULT_EXCLUDE_FIELDS = ['isDeleted', 'metadata', 'created_by', 'updated_by'];

const buildProjection = (fields) => {
  if (!fields) {
    // Exclude sensitive fields by default
    const projection = {};
    DEFAULT_EXCLUDE_FIELDS.forEach((field) => {
      projection[field] = 0;
    });
    return projection;
  }

  // Include only requested fields (comma-separated or array)
  if (typeof fields === 'string') {
    fields = fields.split(',');
  }

  const projection = {};
  fields.forEach((field) => {
    const trimmed = field.trim();
    // Always exclude these keys even if requested
    if (!DEFAULT_EXCLUDE_FIELDS.includes(trimmed)) {
      projection[trimmed] = 1;
    }
  });

  return projection;
};
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
    const { page = 1, limit = 10, sortBy = 'priority', sortOrder = 'asc', search = '', isActive, isArchive, discountType, productId, categoryId, brandId, startDate, endDate, fields } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    /**
     * BASE FILTER (same logic style as reference)
     */
    const baseFilter = {
      ...(typeof isActive !== 'undefined' && { isActive: isActive === 'true' }),
      ...(typeof isArchive !== 'undefined' ? { isDeleted: isArchive === 'true' } : { isDeleted: false }),
    };

    /**
     * SEARCH
     */
    if (search) {
      baseFilter.$or = [{ name: { $regex: search, $options: 'i' } }, { discountType: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }, { tags: { $regex: search, $options: 'i' } }];
    }

    /**
     * FILTERS
     */
    if (discountType) baseFilter.discountType = discountType;
    if (productId) baseFilter.productIds = productId;
    if (categoryId) baseFilter.categoryIds = categoryId;
    if (brandId) baseFilter.brandIds = brandId;

    /**
     * DATE RANGE FILTER
     */
    if (startDate || endDate) {
      baseFilter.startDate = {};
      if (startDate) baseFilter.startDate.$gte = new Date(startDate);
      if (endDate) baseFilter.startDate.$lte = new Date(endDate);
    }

    /**
     * FETCH DATA
     */
    const projection = buildProjection(fields);
    const [docs, total] = await Promise.all([
      DiscountRule.find(baseFilter, projection)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      DiscountRule.countDocuments(baseFilter),
    ]);

    return res.status(200).json({
      success: true,
      status: 200,
      data: {
        result: docs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: skip + docs.length < total,
          hasPrev: parseInt(page) > 1,
        },
      },
      message: `Retrieved ${docs.length} discount rules`,
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
    const { ruleId } = req.params;

    // 1️⃣ Fetch rule
    const rule = await DiscountRule.findById(ruleId).lean();
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Discount rule not found',
      });
    }

    if (!rule.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Discount rule is inactive',
      });
    }

    if (rule.in_use) {
      return res.status(400).json({
        success: false,
        message: 'Discount rule is already applied',
      });
    }

    // 2️⃣ Build product match conditions
    const orConditions = [];

    if (rule.productIds?.length) {
      orConditions.push({ _id: { $in: rule.productIds } });
    }

    if (rule.categoryIds?.length) {
      orConditions.push({ category: { $in: rule.categoryIds } });
    }

    if (rule.brandIds?.length) {
      orConditions.push({ brand: { $in: rule.brandIds } });
    }

    if (rule.tags?.length) {
      orConditions.push({ tags: { $in: rule.tags } });
    }

    if (!orConditions.length) {
      return res.status(400).json({
        success: false,
        message: 'No applicable targets found in this rule',
      });
    }

    const productQuery = {
      $or: orConditions,
      isDeleted: { $ne: true },
    };

    // 3️⃣ Build aggregation update pipeline
    let updatePipeline;

    if (rule.discountType === 'percentage') {
      updatePipeline = [
        {
          $set: {
            discountType: rule.discountType,
            discountValue: rule.discountValue,
            discount: {
              $round: [{ $multiply: ['$basePrice', rule.discountValue / 100] }, 2],
            },
            finalPrice: {
              $max: [
                {
                  $subtract: ['$basePrice', { $multiply: ['$basePrice', rule.discountValue / 100] }],
                },
                0,
              ],
            },
            salePrice: {
              $max: [
                {
                  $subtract: ['$basePrice', { $multiply: ['$basePrice', rule.discountValue / 100] }],
                },
                0,
              ],
            },
          },
        },
      ];
    } else if (rule.discountType === 'fixed') {
      updatePipeline = [
        {
          $set: {
            discountType: rule.discountType,
            discountValue: rule.discountValue,
            discount: rule.discountValue,
            finalPrice: {
              $max: [{ $subtract: ['$basePrice', rule.discountValue] }, 0],
            },
            salePrice: {
              $max: [{ $subtract: ['$basePrice', rule.discountValue] }, 0],
            },
          },
        },
      ];
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid discount type',
      });
    }

    // 4️⃣ Fetch affected products (for tracking)
    const affectedProducts = await Product.find(productQuery, '_id').lean();

    if (!affectedProducts.length) {
      return res.status(200).json({
        success: false,
        message: 'No matching products found',
      });
    }

    // 5️⃣ Apply discount using aggregation pipeline update
    const updateResult = await Product.updateMany(productQuery, updatePipeline, { updatePipeline: true });

    // 6️⃣ Track applied discounts
    const appliedRecords = affectedProducts.map((p) => ({
      ruleId: rule._id,
      productId: p._id,
      appliedAt: new Date(),
    }));

    await AppliedDiscount.insertMany(appliedRecords);

    // 7️⃣ Mark rule as in use
    await DiscountRule.findByIdAndUpdate(ruleId, {
      in_use: true,
    });

    // 8️⃣ Success response
    return res.status(200).json({
      success: true,
      message: `Discount rule applied successfully`,
      affectedProducts: affectedProducts.length,
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error('Apply Discount Rule Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
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

    await DiscountRule.findByIdAndUpdate(ruleId, { in_use: false }, { new: true, runValidators: true });

    return res.json({
      success: true,
      message: `Removed discount rule from ${result.modifiedCount} products`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
