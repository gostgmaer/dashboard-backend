const paypal = require('paypal-rest-sdk');
const { payment, client } = require('../../config/setting');

const configurePayPal = () => {
  paypal.configure({
    'mode': payment.paypal.mode || 'sandbox',
    'client_id': payment.paypal.clientId,
    'client_secret': payment.paypal.clientSecret
  });
};
  
/**
 * Create PayPal Order
 */
const createPayPalOrder = (amount, currency, body) => {
  configurePayPal();
  return new Promise((resolve, reject) => {
    const create_payment_json = {
      "intent": "SALE",
      "payer": {
        "payment_method": "paypal"
      },
      redirect_urls: {
        return_url: `${client.url}/checkout/success?method=${body.payment_method}`,
        cancel_url: `${client.url}/checkout/cancel?method=${body.payment_method}`,
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
  configurePayPal();
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
