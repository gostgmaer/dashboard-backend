const {
  ReasonPhrases,
  StatusCodes,
} = require("http-status-codes");

const Razorpay = require("razorpay");

const razorpayHelper = require("./razorpayHelper");
var paypal = require("paypal-rest-sdk");
const {

  paypalClient,
  paypalSecret,
  host,
  razorPayPublic,
  razorPaySecret,
} = require("../../config/setting");
const Order = require("../../models/orders");

paypal.configure({
  mode: "sandbox", //sandbox or live
  client_id: paypalClient,
  client_secret: paypalSecret,
});

// var instance = new Razorpay({
//   key_id: razorPayPublic,
//   key_secret: razorPaySecret,
// });
const processPaymenGategay = async (req, res) => {
  const { payment_method } = req.body;
  if (payment_method == "paypal") {
    paypalPaymentCreate(req.body, res);
  } else if (payment_method == "creditCard") {
    razorpayPaymentCreate(req.body, res);
  }
};

const paymentSuccess = async (req, res) => {
  const { PayerID, paymentId, token, method } = req.body;

  try {
    const order = await Order.findOne({ transsaction_id: paymentId });

    const trans = paypal.payment.get(paymentId, (err, data) => {
      if (err) {
        console.log(err.message);
      } else {
        var newTrans = [];

        data.transactions.map((item) => {
          const obj = {
            amount: {
              currency: item.amount.currency,
              total: item.amount.total,
            },
          };
          newTrans.push(obj);
        });

        const execute_payment_json = {
          payer_id: PayerID,
          transactions: newTrans,
        };

        paypal.payment.execute(
          paymentId,
          execute_payment_json,
          async function (error, payment) {
            if (error) {
              return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                message: error.message,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                status: ReasonPhrases.INTERNAL_SERVER_ERROR,
              });
            } else {
              const transObj = {
                payer: payment.payer,
                transactions: payment.transactions,
                status:
                  payment.state == "approved" ? "confirmed" : "pending_payment",
              };
              const updateOrder = await Order.findByIdAndUpdate(
                order.id,
                transObj,
                { new: true }
              );
              return res.status(StatusCodes.OK).json({
                results: updateOrder,
                statusCode: StatusCodes.OK,
                status: ReasonPhrases.OK,
              });
            }
          }
        );
      }
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const paymentCancel = async (req, res) => {
  try {
    const { token } = req.body;
    return res.status(StatusCodes.OK).json({
      results: {},
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }

  // paypal.payment.execute(
  //   paymentId,
  //   execute_payment_json,
  //   function (error, payment) {
  //     if (error) {
  //       return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
  //         message: error.message,
  //         statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
  //         status: ReasonPhrases.INTERNAL_SERVER_ERROR,
  //       });
  //     } else {
  //       return res.status(StatusCodes.OK).json({
  //         results: payment,
  //         statusCode: StatusCodes.OK,
  //         status: ReasonPhrases.OK,
  //       });
  //     }
  //   }
  // );
};

const paypalPaymentCreate = (body, res) => {
  const create_payment_json = {
    intent: "sale",
    payer: {
      payment_method: "paypal",
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
          currency: "USD",
          total: body.total,
        },
        description: "Hat for the best team ever",
      },
    ],
  };

  try {
    paypal.payment.create(create_payment_json, async function (error, payment) {
      if (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          message: error.message,
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          status: ReasonPhrases.INTERNAL_SERVER_ERROR,
        });
      } else {
        const redirectObj = payment.links.find(
          (item) => item.rel === "approval_url"
        );

        const transObj = {
          payer: payment.payer,
          transsaction_id: payment.id,
          transactions: payment.transactions,
          status: "pending",
          total: body.total,
          currency: body.currency,
          orderCreatedtime: payment.create_time,
        };

        const order = new Order({ ...body, ...transObj });
        const saveOrder = await order.save();
        return res.status(StatusCodes.OK).json({
          results: redirectObj,
          statusCode: StatusCodes.OK,
          status: ReasonPhrases.OK,
        });
      }
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const razorpayPaymentCreate = async (body, res) => {

  try {
    const response = await razorpayHelper.createOrder(body);
    return res.status(StatusCodes.OK).json({
      results: response,
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};
const razorpayVerifyPayment = async (req, res) => {
 
  const paymentId = req.body.razorpay_payment_id;
  const orderId = req.body.razorpay_order_id;
  const signature = req.body.razorpay_signature;

  // Verify the payment signature
  const isValidSignature = razorpayHelper.verifyPaymentSignature(req.rawBody, signature);

  if (isValidSignature) {
    // Log payment details or perform other actions on successful payment
    console.log(`Payment successful. Payment ID: ${paymentId}, Order ID: ${orderId}`);
    
    // Respond to the client indicating successful payment
    res.send('Payment successful');
  } else {
    // Payment verification failed, handle error logic here
    res.status(400).send('Payment verification failed');
  }

};




module.exports = {
  processPaymenGategay,
  paymentSuccess,
  paymentCancel,razorpayVerifyPayment,razorpayPaymentCreate
};
