const express = require("express");
var session = require("express-session");
const PaymentRoute = express.Router();
const UpdatebyMiddleWare = require("../middleware/updatedBy");
const createMiddleWare = require("../middleware/createMiddleWare");
const userMiddleWare = require("../middleware/userAccess");
const adminMiddleware = require("../middleware/adminAccess");

const checkoutMiddleware = require("../middleware/checkout");
const {
  processPaymenGategay,
  paymentSuccess,paymentCancel
} = require("../controller/payment/payment");

PaymentRoute.route("/payment/checkout/process").post(
  checkoutMiddleware,
  processPaymenGategay
);

PaymentRoute.route("/payment/checkout/process/complete").post(paymentSuccess);
PaymentRoute.route("/payment/checkout/process/cancel").post(paymentCancel);

module.exports = PaymentRoute;
