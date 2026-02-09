// controllers/promoController.js
const promoService = require('../services/promoService');
const { sendSuccess, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

exports.applyPromoCode = catchAsync(async (req, res) => {
  const { code, cartItems } = req.body;

  if (!code || !cartItems) {
    throw AppError.badRequest('Code and cart items are required');
  }

  const result = await promoService.applyPromoCode({ code, cartItems });
  return sendSuccess(res, { data: result, message: 'Promo code applied successfully' });
});