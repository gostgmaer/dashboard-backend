const express = require('express');
const discountRoute = express.Router();
const ctrl = require('../controller/discount');

// Example RBAC middleware placeholders:
// const { requireAuth, permit } = require('../middleware/rbac');

discountRoute.post('/rules', /*requireAuth, permit('discount.rule.create'),*/ ctrl.upsertDiscountRule);
discountRoute.put('/rules/:id', /*requireAuth, permit('discount.rule.update'),*/ ctrl.upsertDiscountRule);
discountRoute.get('/rules', /*requireAuth, permit('discount.rule.read'),*/ ctrl.listDiscountRules);
discountRoute.patch('/rules/:id/toggle', /*requireAuth, permit('discount.rule.update'),*/ ctrl.toggleRuleActive);

discountRoute.post('/preview/rules', /*requireAuth,*/ ctrl.previewRulesPricing);
discountRoute.post('/promo', /*requireAuth, permit('promo.create'),*/ ctrl.upsertPromoCode);
discountRoute.put('/promo/:id', /*requireAuth, permit('promo.update'),*/ ctrl.upsertPromoCode);
discountRoute.post('/promo/apply', /*requireAuth,*/ ctrl.applyPromoToCart);

discountRoute.post('/checkout/discounts', /*requireAuth,*/ ctrl.checkoutWithDiscounts);

module.exports = discountRoute;