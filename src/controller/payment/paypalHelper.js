const paypal = require('paypal-rest-sdk');
const { paypalClient, paypalMode, paypalSecret, host } = require('../../config/setting');




// Configure PayPal
paypal.configure({
    'mode': paypalMode, // or 'live'
    'client_id': paypalClient,
    'client_secret': paypalSecret
  });
  
/**
 * Create PayPal Order
 */
const createPayPalOrder = (amount, currency,body) => {
  return new Promise((resolve, reject) => {
    const create_payment_json = {
      "intent": "SALE",
      "payer": {
        "payment_method": "paypal"
      },
      redirect_urls: {
        return_url: `${host}/checkout/success?method=${body.payment_method}`,
        cancel_url: `${host}/checkout/cancel?method=${body.payment_method}`,
      },
      transactions: [
        {
          item_list: {
            items: body.products,
          },
          amount: {
            currency: currency,
            total: amount,
          },
          description: "Hat for the best team ever",
        },
      ],
      // "transactions": [{
      //   "amount": {
      //     "currency": currency,
      //     "total": amount
      //   },
      //   "description": "Your purchase description"
      // }],
      // "redirect_urls": {
      //   "return_url": "https://your-return-url",
      //   "cancel_url": "https://your-cancel-url"
      // }
    };

    paypal.payment.create(create_payment_json, (error, payment) => {
      if (error) {
        reject(error);
      } else {
        const approval_url = payment.links.find(link => link.rel === 'approval_url').href;
        resolve({ approval_url });
      }
    });
  });
};

/**
 * Verify PayPal Payment
 */
const verifyPayPalPayment = (paymentId, PayerID) => {
  return new Promise((resolve, reject) => {
    const execute_payment_json = {
      "payer_id": PayerID
    };

    paypal.payment.execute(paymentId, execute_payment_json, (error, payment) => {
      if (error) {
        reject(error);
      } else {
        resolve(payment);
      }
    });
  });
};

module.exports = {
  createPayPalOrder,
  verifyPayPalPayment
};
