// adminMiddleware.js
const {
  ReasonPhrases,
  StatusCodes,

} = require("http-status-codes");
const {

  jwtSecret,

  applicaionName,
  host,

  confirmPath,

} = require("../config/setting");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const createMailOptions = require("../email/mailOptions");
const transporter = require("../email/mailTransporter");
const { generateRandomString } = require("../utils/helper");
const Product = require("../models/products");
// const Order = require("../models/orders");
const Address = require("../models/address");
async function checkoutMiddleware(req, res, next) {
  // Check if the user has a Bearer token in the Authorization header
  const { authorization } = req.headers;
  try {
    // var newProd = [];
    req.body.items = [];
   await Promise.all(
      req.body.products.map(async (prod) => {
        const product = await Product.findById(prod["product"]);
        prod.product = product._doc;
        req.body.items.push({
          product: product.id,
          quantity: prod.quantity,
        });
        // return [...{product._doc}];
      })
    );
    req.body.productItems = [];
    req.body.products.map((item) => {
      const obj = {
        name: item.product.title,
        sku: item.product.sku,
        price: item.product.salePrice.toFixed(2),
        currency: "USD",
        quantity: item.quantity,
      };
      req.body.productItems.push(obj);
    });

    const calculateItemTotal = (item) => {
      const price = parseFloat(item.price);
      const quantity = item.quantity;
      return price * quantity;
    };
    const sum = req.body.productItems.reduce(
      (accumulator, currentValue) =>
        accumulator + calculateItemTotal(currentValue),
      0
    );

    req.body.total = sum.toFixed(2);

    if (!authorization || !authorization.startsWith("Bearer ")) {
      const { firstName, lastName, email, username } = req.body;
      if (!firstName || !lastName || !email || !username) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "Please Provide Required Information",
          statusCode: StatusCodes.BAD_REQUEST,
          status: ReasonPhrases.BAD_REQUEST,
        });
      }

      const user = await User.findOne({ email });

      if (user) {
        const newBody = {
          user: user.id,
          created_user_id: user.id,
          created_by: user.email,
          updated_user_id: user.id,
          updated_by: user.email,
        };

        const billing = await Address.create({
          ...req.body.billing,
          ...newBody,
          phone: req.body.billing.phoneNumber,
        });
        const shipping = await Address.create({
          ...req.body.shipping,
          ...newBody,
          phone: req.body.shipping.phoneNumber,
        });

        req.body = {
          ...newBody,
          ...req.body,
          address: { billing: billing.id, shipping: shipping.id },
        };
        next();
      } else {
        const token = jwt.sign(
          {
            email: email,
          },
          jwtSecret,
          {
            expiresIn: "1d",
          }
        );
        const password = generateRandomString(8);
        const hash_password = await bcrypt.hash(password, 10);

        const userData = {
          firstName,
          lastName,
          email,
          hash_password,
          username,
        };
        User.create({
          ...userData,
          confirmToken: token,
          isEmailconfirm: false,
        }).then((data, err) => {
          if (err)
            return res.status(StatusCodes.BAD_REQUEST).json({
              message: err.message,
              statusCode: StatusCodes.BAD_REQUEST,
              status: ReasonPhrases.BAD_REQUEST,
            });
          else {
            let mailBody = {
              body: {
                name: data.fullName,
                intro: `Welcome to ${applicaionName}! We are excited to have you on board.`,
                additionalInfo: `Thank you for choosing ${applicaionName}. You now have access to our premium features, your temporary password is ${password}`,
                action: {
                  instructions: `To get started with ${applicaionName}, please click here:`,
                  button: {
                    color: "#22BC66", // Optional action button color
                    text: "Confirm Your Account",
                    link: `${host}/${confirmPath}?token=${token}`,
                  },
                },
                outro:
                  "Need help, or have questions? Just reply to this email, we'd love to help.",
              },
            };
            transporter
              .sendMail(
                createMailOptions(
                  "salted",
                  data.email,
                  `Welcome to ${applicaionName} - Confirm Your Email`,
                  mailBody
                )
              )
              .then(async () => {
                const newBody = {
                  user: data.id,
                  created_user_id: data.id,
                  created_by: data.email,
                  updated_user_id: data.id,
                  updated_by: data.email,
                };
                const billing = await Address.create({
                  ...req.body.billing,
                  ...newBody,
                  phone: req.body.billing.phoneNumber,
                });
                const shipping = await Address.create({
                  ...req.body.shipping,
                  ...newBody,
                  phone: req.body.shipping.phoneNumber,
                });

                req.body = {
                  ...newBody,
                  ...req.body,
                  address: { billing: billing.id, shipping: shipping.id },
                };
                next();
              })
              .catch((error) => {
                res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                  message: error.message,
                  statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                  status: ReasonPhrases.INTERNAL_SERVER_ERROR,
                });
              });
          }
        });
      }
    } else {
      const tokenValue = authorization.split(" ")[1];

      // Decode the token to get the user's ID
      const decoded = jwt.verify(tokenValue, jwtSecret); // Replace with your secret key

      // Query the user document in MongoDB
      const user = await User.findById(decoded["user_id"]);



      if (!user) {
        console.log("ERROR");
        
      } else {
        const newBody = {
          user: user.id,
          created_user_id: user.id,
          created_by: user.email,
          updated_user_id: user.id,
          updated_by: user.email,
        };

        const billing = await Address.create({
          ...req.body.billing,
          ...newBody,
          phone: req.body.billing.phoneNumber,
        });
        const shipping = await Address.create({
          ...req.body.shipping,
          ...newBody,
          phone: req.body.shipping.phoneNumber,
        });


        req.body = { ...newBody, ...req.body, address: { billing: billing.id, shipping: shipping.id } };
        next();
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
}

module.exports = checkoutMiddleware;
