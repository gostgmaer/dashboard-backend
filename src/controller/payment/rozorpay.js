const Razorpay = require("razorpay");
const crypto = require("crypto");
const { payment } = require("../../config/setting");

// Helper to get active Razorpay instance dynamically
const getRazorpayInstance = () => {
  return new Razorpay({
    key_id: payment.razorpay.publicKey,
    key_secret: payment.razorpay.secretKey,
  });
};

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
    const razorpayInstance = getRazorpayInstance();
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
     .createHmac("sha256", payment.razorpay.secretKey)
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
