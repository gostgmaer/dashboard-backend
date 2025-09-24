// controllers/promoController.js
const promoService = require('../services/promoService');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
exports.applyPromoCode = async (req, res) => {
  try {
    const { code, cartItems } = req.body;
    const result = await promoService.applyPromoCode({ code, cartItems });
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};