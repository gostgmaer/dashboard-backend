// razorpayHelper.js
const Razorpay = require('razorpay');
const {
   

    razorPayPublic,
    razorPaySecret,
  } = require("../../config/setting");
const razorpay = new Razorpay({
  key_id: razorPayPublic,
  key_secret: razorPaySecret,
});

async function createOrder(body) {
  const options = {
    amount: 50000, // amount in paise (50 INR)
    currency: 'INR',
    receipt: body.receipt || `receipt_${Date.now()}`,
 
  };

  try {
    const response = await razorpay.orders.create(options);
    return response;
  } catch (error) {
    console.log(error);
    
    throw new Error('Unable to create order');
  }
}

function verifyPaymentSignature(rawBody, signature) {
  return razorpay.webhook.verifyHmac(rawBody, signature);
}

module.exports = {
  createOrder,
  verifyPaymentSignature,
};
