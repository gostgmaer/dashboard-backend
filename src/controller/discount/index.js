const mongoose = require('mongoose');
const DiscountRule = require('../../models/DiscountRule');
const AppliedDiscount = require('../../models/AppliedDiscount');
const PromoCode = require('../../models/Coupon');
const { priceWithRules, applyPromoCode, applyDiscountsAtCheckout } = require('../../services/discount');
const Product = require('../../models/products');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

const DEFAULT_EXCLUDE_FIELDS = ['isDeleted', 'metadata', 'created_by', 'updated_by'];

const buildProjection = (fields) => {
  if (!fields) {
    const projection = {};
    DEFAULT_EXCLUDE_FIELDS.forEach((field) => {
      projection[field] = 0;
    });
    return projection;
  }

  if (typeof fields === 'string') {
    fields = fields.split(',');
  }

  const projection = {};
  fields.forEach((field) => {
    const trimmed = field.trim();
    if (!DEFAULT_EXCLUDE_FIELDS.includes(trimmed)) {
      projection[trimmed] = 1;
    }
  });

  return projection;
};

exports.upsertDiscountRule = catchAsync(async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

  const doc = id ? await DiscountRule.findByIdAndUpdate(id, payload, { new: true, runValidators: true }) : await DiscountRule.create(payload);

  return sendSuccess(res, { data: doc, message: id ? 'Discount rule updated' : 'Discount rule created' });
});

exports.listDiscountRules = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, sortBy = 'priority', sortOrder = 'asc', search = '', isActive, isArchive, discountType, productId, categoryId, brandId, startDate, endDate, fields } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortDirection = sortOrder === 'desc' ? -1 : 1;

  const baseFilter = {
    ...(typeof isActive !== 'undefined' && { isActive: isActive === 'true' }),
    ...(typeof isArchive !== 'undefined' ? { isDeleted: isArchive === 'true' } : { isDeleted: false }),
  };

  if (search) {
    baseFilter.$or = [{ name: { $regex: search, $options: 'i' } }, { discountType: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }, { tags: { $regex: search, $options: 'i' } }];
  }

  if (discountType) baseFilter.discountType = discountType;
  if (productId) baseFilter.productIds = productId;
  if (categoryId) baseFilter.categoryIds = categoryId;
  if (brandId) baseFilter.brandIds = brandId;

  if (startDate || endDate) {
    baseFilter.startDate = {};
    if (startDate) baseFilter.startDate.$gte = new Date(startDate);
    if (endDate) baseFilter.startDate.$lte = new Date(endDate);
  }

  const projection = buildProjection(fields);
  const [docs, total] = await Promise.all([DiscountRule.find(baseFilter, projection).sort({ [sortBy]: sortDirection }).skip(skip).limit(parseInt(limit)).lean(), DiscountRule.countDocuments(baseFilter)]);

  return sendSuccess(res, {
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
});

exports.toggleRuleActive = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const doc = await DiscountRule.findByIdAndUpdate(id, { isActive }, { new: true });

  if (!doc) {
    throw AppError.notFound('Discount rule not found');
  }

  return sendSuccess(res, { data: doc, message: `Discount rule ${isActive ? 'activated' : 'deactivated'}` });
});

exports.previewRulesPricing = catchAsync(async (req, res) => {
  const { items } = req.body;
  const pricing = await priceWithRules({ items });
  return sendSuccess(res, { data: pricing, message: 'Pricing preview generated' });
});

exports.upsertPromoCode = catchAsync(async (req, res) => {
  const { id } = req.params;
  const payload = req.body;
  payload.code = payload.code?.toUpperCase();

  const doc = id ? await PromoCode.findByIdAndUpdate(id, payload, { new: true, runValidators: true }) : await PromoCode.create(payload);

  return sendSuccess(res, { data: doc, message: id ? 'Promo code updated' : 'Promo code created' });
});

exports.applyPromoToCart = catchAsync(async (req, res) => {
  const { code, items, customerId } = req.body;
  const pricing = await applyPromoCode({ code, customerId, items });
  return sendSuccess(res, { data: pricing, message: 'Promo code applied' });
});

exports.checkoutWithDiscounts = catchAsync(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { order } = req.body;
    const pricing = await applyDiscountsAtCheckout({ session, order });
    await session.commitTransaction();
    return sendSuccess(res, { data: { pricing }, message: 'Checkout completed' });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

exports.applyDiscountRule = catchAsync(async (req, res) => {
  const { ruleId } = req.params;

  const rule = await DiscountRule.findById(ruleId).lean();
  if (!rule) {
    throw AppError.notFound('Discount rule not found');
  }

  if (!rule.isActive) {
    throw AppError.badRequest('Discount rule is inactive');
  }

  if (rule.in_use) {
    throw AppError.badRequest('Discount rule is already applied');
  }

  const orConditions = [];
  if (rule.productIds?.length) orConditions.push({ _id: { $in: rule.productIds } });
  if (rule.categoryIds?.length) orConditions.push({ category: { $in: rule.categoryIds } });
  if (rule.brandIds?.length) orConditions.push({ brand: { $in: rule.brandIds } });
  if (rule.tags?.length) orConditions.push({ tags: { $in: rule.tags } });

  if (!orConditions.length) {
    throw AppError.badRequest('No applicable targets found in this rule');
  }

  const productQuery = { $or: orConditions, isDeleted: { $ne: true } };

  let updatePipeline;
  if (rule.discountType === 'percentage') {
    updatePipeline = [
      {
        $set: {
          discountType: rule.discountType,
          discountValue: rule.discountValue,
          discount: { $round: [{ $multiply: ['$basePrice', rule.discountValue / 100] }, 2] },
          finalPrice: { $max: [{ $subtract: ['$basePrice', { $multiply: ['$basePrice', rule.discountValue / 100] }] }, 0] },
          salePrice: { $max: [{ $subtract: ['$basePrice', { $multiply: ['$basePrice', rule.discountValue / 100] }] }, 0] },
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
          finalPrice: { $max: [{ $subtract: ['$basePrice', rule.discountValue] }, 0] },
          salePrice: { $max: [{ $subtract: ['$basePrice', rule.discountValue] }, 0] },
        },
      },
    ];
  } else {
    throw AppError.badRequest('Invalid discount type');
  }

  const affectedProducts = await Product.find(productQuery, '_id').lean();
  if (!affectedProducts.length) {
    return sendSuccess(res, { data: { affectedProducts: 0 }, message: 'No matching products found' });
  }

  const updateResult = await Product.updateMany(productQuery, updatePipeline, { updatePipeline: true });

  const appliedRecords = affectedProducts.map((p) => ({
    ruleId: rule._id,
    productId: p._id,
    appliedAt: new Date(),
  }));

  await AppliedDiscount.insertMany(appliedRecords);
  await DiscountRule.findByIdAndUpdate(ruleId, { in_use: true });

  return sendSuccess(res, {
    data: { affectedProducts: affectedProducts.length, modifiedCount: updateResult.modifiedCount },
    message: 'Discount rule applied successfully',
  });
});

exports.removeDiscountRule = catchAsync(async (req, res) => {
  const { ruleId } = req.params;

  const rule = await DiscountRule.findById(ruleId);
  if (!rule) {
    throw AppError.notFound('Discount rule not found');
  }

  const applied = await AppliedDiscount.find({ ruleId, isActive: true }).lean();
  const productIds = applied.map((a) => a.productId);

  if (!productIds.length) {
    return sendSuccess(res, { data: { modifiedCount: 0 }, message: 'No active products found for this rule' });
  }

  const updatePipeline = [
    {
      $set: {
        finalPrice: '$basePrice',
        salePrice: '$basePrice',
        discountType: 'none',
        discountValue: 0,
        discount: 0,
      },
    },
  ];

  const result = await Product.updateMany({ _id: { $in: productIds } }, updatePipeline, { updatePipeline: true });

  await AppliedDiscount.updateMany({ ruleId, isActive: true }, { $set: { isActive: false, removedAt: new Date() } });
  await DiscountRule.findByIdAndUpdate(ruleId, { in_use: false }, { new: true, runValidators: true });

  return sendSuccess(res, { data: { modifiedCount: result.modifiedCount }, message: `Removed discount rule from ${result.modifiedCount} products` });
});
