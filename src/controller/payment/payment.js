const razorpayHelper = require('./razorpayHelper');
const paypal = require('paypal-rest-sdk');
const { paypalClient, paypalSecret, host } = require('../../config/setting');
const Order = require('../../models/orders');
const { sendSuccess, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

paypal.configure({
  mode: 'sandbox',
  client_id: paypalClient,
  client_secret: paypalSecret,
});

const processPaymentGateway = catchAsync(async (req, res) => {
  const { payment_method } = req.body;

  if (payment_method === 'paypal') {
    return paypalPaymentCreate(req.body, res);
  } else if (payment_method === 'creditCard') {
    return razorpayPaymentCreate(req.body, res);
  } else {
    throw AppError.badRequest('Invalid payment method');
  }
});

const paymentSuccess = catchAsync(async (req, res) => {
  const { PayerID, paymentId } = req.body;

  const order = await Order.findOne({ transsaction_id: paymentId });
  if (!order) {
    throw AppError.notFound('Order not found');
  }

  return new Promise((resolve, reject) => {
    paypal.payment.get(paymentId, (err, data) => {
      if (err) {
        reject(AppError.internal(err.message));
        return;
      }

      const newTrans = data.transactions.map((item) => ({
        amount: {
          currency: item.amount.currency,
          total: item.amount.total,
        },
      }));

      const execute_payment_json = {
        payer_id: PayerID,
        transactions: newTrans,
      };

      paypal.payment.execute(paymentId, execute_payment_json, async (error, payment) => {
        if (error) {
          reject(AppError.internal(error.message));
          return;
        }

        const transObj = {
          payer: payment.payer,
          transactions: payment.transactions,
          status: payment.state === 'approved' ? 'confirmed' : 'pending_payment',
        };

        const updateOrder = await Order.findByIdAndUpdate(order.id, transObj, { new: true });
        resolve(sendSuccess(res, { data: updateOrder, message: 'Payment successful' }));
      });
    });
  });
});

const paymentCancel = catchAsync(async (req, res) => {
  const { token } = req.body;
  return sendSuccess(res, { data: { token }, message: 'Payment cancelled' });
});

const paypalPaymentCreate = (body, res) => {
  const create_payment_json = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal',
    },
    redirect_urls: {
      return_url: `${host}/checkout/success?method=${body.payment_method}`,
      cancel_url: `${host}/checkout/cancel?method=${body.payment_method}`,
    },
    transactions: [
      {
        item_list: {
          items: body.productItems,
        },
        amount: {
          currency: 'USD',
          total: body.total,
        },
        description: 'Hat for the best team ever',
      },
    ],
  };

  return new Promise((resolve, reject) => {
    paypal.payment.create(create_payment_json, async (error, payment) => {
      if (error) {
        reject(AppError.internal(error.message));
        return;
      }

      const redirectObj = payment.links.find((item) => item.rel === 'approval_url');

      const transObj = {
        payer: payment.payer,
        transsaction_id: payment.id,
        transactions: payment.transactions,
        status: 'pending',
        total: body.total,
        currency: body.currency,
        orderCreatedtime: payment.create_time,
      };

      const order = new Order({ ...body, ...transObj });
      await order.save();

      resolve(sendSuccess(res, { data: redirectObj, message: 'PayPal payment created' }));
    });
  });
};

const razorpayPaymentCreate = catchAsync(async (body, res) => {
  const response = await razorpayHelper.createOrder(body);
  return sendSuccess(res, { data: response, message: 'Razorpay order created' });
});

const razorpayVerifyPayment = catchAsync(async (req, res) => {
  const paymentId = req.body.razorpay_payment_id;
  const orderId = req.body.razorpay_order_id;
  const signature = req.body.razorpay_signature;

  const isValidSignature = razorpayHelper.verifyPaymentSignature(req.rawBody, signature);

  if (!isValidSignature) {
    throw AppError.badRequest('Payment verification failed');
  }

  console.log(`Payment successful. Payment ID: ${paymentId}, Order ID: ${orderId}`);

  return sendSuccess(res, { data: { paymentId, orderId }, message: 'Payment successful' });
});

module.exports = {
  processPaymentGateway,
  processPaymenGategay: processPaymentGateway, // For backward compatibility
  paymentSuccess,
  paymentCancel,
  razorpayVerifyPayment,
  razorpayPaymentCreate,
};
