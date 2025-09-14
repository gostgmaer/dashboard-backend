const createPayment = {
    id: "PAYID-MV4G4VQ52S808351P9655811",
    intent: "sale",
    state: "created",
    payer: {
      payment_method: "paypal",
    },
    transactions: [
      {
        amount: {
          total: "199.35",
          currency: "USD",
        },
        description: "Hat for the best team ever",
        item_list: {
          items: [
            {
              name: "Fluro Big Pullover Designers Remix",
              sku: "AJKHDKJ679687987",
              price: "66.45",
              currency: "USD",
              quantity: 3,
            },
          ],
        },
        related_resources: [
        ],
      },
    ],
    create_time: "2023-12-12T14:29:41Z",
    links: [
      {
        href: "https://api.sandbox.paypal.com/v1/payments/payment/PAYID-MV4G4VQ52S808351P9655811",
        rel: "self",
        method: "GET",
      },
      {
        href: "https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=EC-6CF30889YW874032F",
        rel: "approval_url",
        method: "REDIRECT",
      },
      {
        href: "https://api.sandbox.paypal.com/v1/payments/payment/PAYID-MV4G4VQ52S808351P9655811/execute",
        rel: "execute",
        method: "POST",
      },
    ],
    httpStatusCode: 201,
  }
  const execute = {
    id: "PAYID-MV4G4VQ52S808351P9655811",
    intent: "sale",
    state: "approved",
    cart: "6CF30889YW874032F",
    payer: {
      payment_method: "paypal",
      status: "VERIFIED",
      payer_info: {
        email: "sb-zbb3c28686954@personal.example.com",
        first_name: "John",
        last_name: "Doe",
        payer_id: "7534L85NAK9MJ",
        shipping_address: {
          recipient_name: "John Doe",
          line1: "1 Main St",
          city: "San Jose",
          state: "CA",
          postal_code: "95131",
          country_code: "US",
        },
        country_code: "US",
      },
    },
    transactions: [
      {
        amount: {
          total: "199.35",
          currency: "USD",
          details: {
            subtotal: "199.35",
            shipping: "0.00",
            insurance: "0.00",
            handling_fee: "0.00",
            shipping_discount: "0.00",
            discount: "0.00",
          },
        },
        payee: {
          merchant_id: "XYYVPDVWED7KG",
          email: "sb-acth228686773@business.example.com",
        },
        description: "Hat for the best team ever",
        item_list: {
          items: [
            {
              name: "Fluro Big Pullover Designers Remix",
              sku: "AJKHDKJ679687987",
              price: "66.45",
              currency: "USD",
              tax: "0.00",
              quantity: 3,
              image_url: "",
            },
          ],
          shipping_address: {
            recipient_name: "John Doe",
            line1: "1 Main St",
            city: "San Jose",
            state: "CA",
            postal_code: "95131",
            country_code: "US",
          },
        },
        related_resources: [
          {
            sale: {
              id: "3E1546237X603853E",
              state: "completed",
              amount: {
                total: "199.35",
                currency: "USD",
                details: {
                  subtotal: "199.35",
                  shipping: "0.00",
                  insurance: "0.00",
                  handling_fee: "0.00",
                  shipping_discount: "0.00",
                  discount: "0.00",
                },
              },
              payment_mode: "INSTANT_TRANSFER",
              protection_eligibility: "ELIGIBLE",
              protection_eligibility_type: "ITEM_NOT_RECEIVED_ELIGIBLE,UNAUTHORIZED_PAYMENT_ELIGIBLE",
              transaction_fee: {
                value: "7.45",
                currency: "USD",
              },
              parent_payment: "PAYID-MV4G4VQ52S808351P9655811",
              create_time: "2023-12-12T14:31:24Z",
              update_time: "2023-12-12T14:31:24Z",
              links: [
                {
                  href: "https://api.sandbox.paypal.com/v1/payments/sale/3E1546237X603853E",
                  rel: "self",
                  method: "GET",
                },
                {
                  href: "https://api.sandbox.paypal.com/v1/payments/sale/3E1546237X603853E/refund",
                  rel: "refund",
                  method: "POST",
                },
                {
                  href: "https://api.sandbox.paypal.com/v1/payments/payment/PAYID-MV4G4VQ52S808351P9655811",
                  rel: "parent_payment",
                  method: "GET",
                },
              ],
            },
          },
        ],
      },
    ],
    failed_transactions: [
    ],
    create_time: "2023-12-12T14:29:41Z",
    update_time: "2023-12-12T14:31:24Z",
    links: [
      {
        href: "https://api.sandbox.paypal.com/v1/payments/payment/PAYID-MV4G4VQ52S808351P9655811",
        rel: "self",
        method: "GET",
      },
    ],
    httpStatusCode: 200,
  }