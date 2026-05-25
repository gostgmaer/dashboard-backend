const express = require('express');

const shippingRoute = express.Router();

const notImplemented = (feature) => (_req, res) => {
  res.status(501).json({
    success: false,
    message: `${feature} is not implemented yet`,
  });
};

shippingRoute.get('/shipping-methods', notImplemented('Shipping methods API'));
shippingRoute.get('/payment-methods', notImplemented('Payment methods API'));
shippingRoute.post('/checkout', notImplemented('Checkout API'));

module.exports = shippingRoute;
