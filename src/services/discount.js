const mongoose = require('mongoose');
const Product = require('../models/products');
const DiscountRule = require('../models/DiscountRule');
const PromoCode = require('../models/Coupon');

// Helpers
function applyAmount(price, type, value) {
  if (type === 'percentage') return Math.max(0, price - (value / 100) * price);
  return Math.max(0, price - value);
}

function isWithin(now, start, end) {
  return now >= start && now <= end;
}

// Matchers
function matchesRuleTargets(rule, product) {
  const inProducts = rule.productIds?.some(id => id.equals(product._id));
  const inCategories = rule.categoryIds?.some(id => product.categories?.some(cid => cid.equals(id)));
  const inBrand = rule.brandIds?.some(id => product.brand && id.equals(product.brand));
  const tagMatched = rule.tags?.some(t => product.tags?.includes(t));

  const stockOk = (!rule.minStock || product.stock >= rule.minStock) &&
    (!rule.maxStock || product.stock <= rule.maxStock);
  const priceOk = (!rule.minPrice || product.price >= rule.minPrice) &&
    (!rule.maxPrice || product.price <= rule.maxPrice);

  return (inProducts || inCategories || inBrand || tagMatched) && stockOk && priceOk;
}

function matchesPromoTargets(promo, product) {
  const inProducts = promo.productIds?.some(id => id.equals(product._id));
  const inCategories = promo.categoryIds?.some(id => product.categories?.some(cid => cid.equals(id)));
  const inBrand = promo.brandIds?.some(id => product.brand && id.equals(product.brand));
  const tagMatched = promo.tags?.some(t => product.tags?.includes(t));
  return (inProducts || inCategories || inBrand || tagMatched);
}

/**
 * Compute discounted prices per item using active DiscountRules.
 * Returns detailed breakdown per item and totals.
 */
exports.priceWithRules = async ({ items }) => {
  // items: [{ productId, quantity }]
  const now = new Date();

  const [products, rules] = await Promise.all([
    Product.find({ _id: { $in: items.map(i => i.productId) } }).lean(),
    DiscountRule.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).sort({ priority: 1 }).lean()
  ]);

  const productMap = new Map(products.map(p => [String(p._id), p]));

  let cartSubtotal = 0;
  let cartDiscountTotal = 0;
  const lineItems = [];

  for (const { productId, quantity } of items) {
    const product = productMap.get(String(productId));
    if (!product) continue;

    // Base price: leverage model fields; if you have Product.calculateFinalPrice via instance,
    // here we use product.price + product.salePrice/discount if needed; for lean doc, stick to price.
    let lineBasePrice = product.price;
    let lineFinalPrice = lineBasePrice;
    let appliedRules = [];
    let stopped = false;

    for (const rule of rules) {
      if (!isWithin(now, rule.startDate, rule.endDate)) continue;
      if (!matchesRuleTargets(rule, product)) continue;
      const newPrice = applyAmount(lineFinalPrice, rule.discountType, rule.discountValue);
      if (newPrice < lineFinalPrice) {
        appliedRules.push({
          ruleId: rule._id,
          name: rule.name,
          type: rule.discountType,
          value: rule.discountValue,
          before: lineFinalPrice,
          after: newPrice
        });
        lineFinalPrice = newPrice;
        if (rule.exclusive) {
          stopped = true;
          break;
        }
      }
    }

    const lineSubtotal = lineBasePrice * quantity;
    const lineTotal = lineFinalPrice * quantity;
    const lineDiscount = lineSubtotal - lineTotal;

    cartSubtotal += lineSubtotal;
    cartDiscountTotal += lineDiscount;

    lineItems.push({
      productId,
      title: product.title,
      quantity,
      unitBasePrice: lineBasePrice,
      unitFinalPrice: lineFinalPrice,
      lineSubtotal,
      lineTotal,
      lineDiscount,
      appliedRules
    });
  }

  return {
    items: lineItems,
    cartSubtotal,
    cartDiscountFromRules: cartDiscountTotal,
    cartTotalAfterRules: cartSubtotal - cartDiscountTotal
  };
};

/**
 * Apply promo code on top of rule-based pricing (stacking),
 * with order-level validations and optional exclusivity.
 */
exports.applyPromoCode = async ({ code, customerId, items }) => {
  const now = new Date();
  const promo = await PromoCode.findOne({
    code: code.toUpperCase(),
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  });

  if (!promo) {
    throw new Error('Invalid or expired promo code');
  }
  if (promo.globalUsageLimit && promo.usedCount >= promo.globalUsageLimit) {
    throw new Error('Promo usage limit reached');
  }

  // First, compute price with rules
  const priced = await exports.priceWithRules({ items });

  // Fetch products to check targets
  const products = await Product.find({ _id: { $in: items.map(i => i.productId) } }).lean();
  const productMap = new Map(products.map(p => [String(p._id), p]));

  let promoDiscountTotal = 0;
  const promoApplications = [];

  for (const li of priced.items) {
    const product = productMap.get(String(li.productId));
    if (!product) continue;

    if (!matchesPromoTargets(promo, product)) continue;

    const before = li.unitFinalPrice;
    const after = applyAmount(before, promo.discountType, promo.discountValue);
    const unitPromoDiscount = before - after;
    const linePromoDiscount = unitPromoDiscount * li.quantity;

    if (linePromoDiscount > 0) {
      promoDiscountTotal += linePromoDiscount;
      promoApplications.push({
        productId: li.productId,
        before,
        after,
        unitPromoDiscount,
        linePromoDiscount
      });

      // modify the priced view for final totals
      li.unitFinalPrice = after;
      li.lineTotal = after * li.quantity;
    }
  }

  const cartTotalBeforePromo = priced.cartTotalAfterRules;
  const cartTotalAfterPromo = Math.max(0, cartTotalBeforePromo - promoDiscountTotal);

  if (promo.minOrderValue && cartTotalAfterPromo < promo.minOrderValue) {
    throw new Error(`Minimum order value ${promo.minOrderValue} not met for this promo`);
  }

  return {
    promo: {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      exclusive: promo.exclusive
    },
    ...priced,
    promoDiscountTotal,
    cartTotalAfterPromo,
    promoApplications
  };
};

/**
 * Finalize discount on checkout with transaction:
 * - Recompute discounts to avoid tampering
 * - Update promo usage (atomic)
 * - Optionally reduce stock here or in order service
 */
exports.applyDiscountsAtCheckout = async ({ session, order }) => {
  // order: { items: [{ productId, quantity }], promoCode, customerId }
  const items = order.items;
  const hasPromo = Boolean(order.promoCode);

  let pricing;
  if (hasPromo) {
    pricing = await exports.applyPromoCode({
      code: order.promoCode,
      customerId: order.customerId,
      items
    });
  } else {
    pricing = await exports.priceWithRules({ items });
    pricing.promoDiscountTotal = 0;
    pricing.cartTotalAfterPromo = pricing.cartTotalAfterRules;
  }

  // If promo exists, increment usage in the same transaction
  if (hasPromo) {
    const now = new Date();
    const updated = await PromoCode.updateOne(
      {
        code: order.promoCode.toUpperCase(),
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        $or: [
          { globalUsageLimit: { $exists: false } },
          { $expr: { $gt: ['$globalUsageLimit', '$usedCount'] } },
          { globalUsageLimit: 0 } // unlimited if you treat 0 as unlimited
        ]
      },
      { $inc: { usedCount: 1 } },
      { session }
    );

    if (updated.modifiedCount === 0) {
      throw new Error('Promo usage could not be updated (limit reached or invalid).');
    }
  }

  return pricing;
};