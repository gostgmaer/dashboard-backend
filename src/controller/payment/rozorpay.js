const Razorpay = require("razorpay");
const crypto = require("crypto");
const { razorPaySecret, razorPayPublic } = require("../../config/setting");

// Razorpay instance
const razorpayInstance = new Razorpay({
  key_id: razorPayPublic,
  key_secret: razorPaySecret,
});

/**
 * Create Razorpay Order
 */
const createRazorpayOrder = async (amount, currency, invoice) => {
  const options = {
    amount: amount * 100, // Amount in paise (1 INR = 100 paise)
    currency: currency,
    receipt: invoice,
    payment_capture: 1, // 1 means automatic capture
  };

  try {
    const order = await razorpayInstance.orders.create(options);
    return order;
  } catch (error) {
    console.log(error);

    throw new Error("Error creating Razorpay order");
  }
};

/**
 * Verify Razorpay Payment
 */
const verifyRazorpayPayment = (order_id, payment_id, signature) => {
  const body = order_id + "|" + payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", razorPaySecret)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === signature) {
    return { success: true };
  } else {
    throw new Error("Invalid Razorpay signature");
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
};
