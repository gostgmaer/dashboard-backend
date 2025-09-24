const mongoose = require("mongoose");
const {
  ReasonPhrases,
  StatusCodes,
} = require("http-status-codes");
// const paypal = require("paypal-rest-sdk");
const { FilterOptions } = require("../../utils/helper");
const Order = require("../../models/orders");
// const User = require("../../models/user");
const Product = require("../../models/products");
const { createPayPalOrder, verifyPayPalPayment } = require("../payment/paypalHelper");
const { createRazorpayOrder, verifyRazorpayPayment } = require("../payment/rozorpay");
const { processCodOrder } = require("../payment/codhelper");
const { updateStockOnOrderCreate, updateStockOnOrderCancel, removeOrderedItemsFromWishlist } = require("../../lib/stock-controller/others");
// const { log } = require("winston");
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
// const { createPayPalOrder, verifyPayPalPayment } = require('../services/paypalService');
// const { createRazorpayOrder, verifyRazorpayPayment } = require('../services/razorpayService');
// const { processCodOrder } = require('../services/codService');



const createOrder = async (req, res) => {

  const { payment_method, invoice, orderDetails } = req.body;
  try {
    let invalidProducts = [];
    const items = await Promise.all(
      req.body.products.map(async (productData) => {
        const productId = productData.id;
        const product = await Product.findById(productId);

        if (!product) {
          invalidProducts.push(productId);
          return null; // Return null for invalid products
        } else {
          return {
            product: productId,
            quantity: productData.cartQuantity,
            productPrice: product.price,
          };
        }
      })
    );

    if (invalidProducts.length > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Invalid product(s) provided.",
        invalidProducts: invalidProducts,
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    } else {

      const validItems = items.filter(item => item !== null); // Filter out invalid items

      const total = validItems.reduce(
        (acc, item) => acc + item.quantity * item.productPrice,
        0
      );
      let paymentResponse;
      let savedOrder;
      switch (payment_method) {
        case 'paypal':
          paymentResponse = await createPayPalOrder(total, "USD", req.body);
          break;

        case 'RazorPay':
          paymentResponse = await createRazorpayOrder(total, "INR", invoice);
          break;

        case 'COD':
          paymentResponse = processCodOrder(total, "INR", orderDetails);



          break;

        default:
          return res.status(400).json({ error: 'Invalid payment method' });
      }



      //  savedOrder ={
      // ...paymentResponse
      // }



      var newOrder = new Order({
        items: validItems,
        total,
        currency: "INR",
        payment_status: 'pending', // COD is pending until delivery
        receipt: invoice || null,
        transaction_id: paymentResponse.id || null, ...req.body, ...paymentResponse, status: "pending"
      });

      savedOrder = await newOrder.save();
      await updateStockOnOrderCreate(req.body.products)
      await removeOrderedItemsFromWishlist(req.body.user,savedOrder.items )

      if (payment_method === "COD") {
        return res.status(StatusCodes.OK).json({
          message: "Order successfully!",
          result: savedOrder,
          statusCode: StatusCodes.OK,
          status: ReasonPhrases.OK,
        });
      } else {
        return res.status(StatusCodes.OK).json({
          message: "Order Created!",
          result: { ...paymentResponse, payment_method },
          statusCode: StatusCodes.OK,
          status: ReasonPhrases.OK,
        });

      }

    }


  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};
const verifyPayment = async (req, res) => {
  const { payment_method, paymentId, PayerID, order_id, signature } = req.body;

  try {
    let paymentResponse;

    switch (payment_method) {
      case 'paypal':
        paymentResponse = await verifyPayPalPayment(paymentId, PayerID);
        break;

      case 'RazorPay':
        paymentResponse = verifyRazorpayPayment(order_id, paymentId, signature);
        break;

      case 'COD':
        return res.status(200).json({ success: true, message: 'COD order does not require verification' });

      default:
        return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Update order payment status in the database
    var savedOrder
    const order = await Order.findOne({ transaction_id: order_id });
    if (order) {
      order.payment_status = 'completed';
      order.status = 'completed';
      savedOrder = await order.save();
    }
    return res.status(StatusCodes.OK).json({
      message: "Order successfully!",
      result: savedOrder,
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK, ...paymentResponse
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error verifying payment' });
  }
};


const getOrders = async (req, res) => {
// log("getOrders called");
console.log("getOrders called");

  try {
    // const { sort, page, limit, filter } = req.query;

    const filterquery = FilterOptions(req.query,Order);
    const Orders = await Order.find(
      filterquery.query,
      "-__v ",
      filterquery.options
    ).populate("user",'firstName lastName email  phoneNumber') // Populating the 'user' reference
      .populate("items.product") // Populating the 'product' reference within 'items'

    const length = await Order.countDocuments(filterquery.query); 

    if (Orders) {
      // Orders.forEach((element) => {
      //   const { firstName, lastName, email, phoneNumber } = element.user;
      //   // element.user = {
      //   //   firstName,
      //   //   lastName,
      //   //   email,
      //   //   phoneNumber,
      //   // };
      // });

      return res.status(StatusCodes.OK).json({
        message: `Orders data has been Loaded Successfully!`,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
        results: Orders,
        total: length,
      });
    } else {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `No information found`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const getCustomerOrders = async (req, res) => {
  try {
    // const { sort, page, limit, filter } = req.query;

    const filterquery = FilterOptions(req.query,Order);
    const Orders = await Order.find(
      { ...filterquery.query, user: req.params.user },
      "total createdAt invoice payment_method payment_status status totalPrice ",
      filterquery.options
    ).populate("user", 'firstName lastName email phoneNumber') // Populating the 'user' reference
      .populate("items.product", '-_id -categories -category -variants -status') // Populating the 'product' reference within 'items'
      .populate("address")

    const length = await Order.countDocuments({ ...filterquery.query, user: req.params.user });

    if (Orders) {
      Orders.map((element) => {
        const { firstName, lastName, email, phoneNumber } = element.user;
        element.user = {
          firstName,
          lastName,
          email,
          phoneNumber,
        };
      });

      return res.status(StatusCodes.OK).json({
        message: `Orders data has been Loaded Successfully!`,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
        results: Orders,
        total: length,
      });
    } else {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `No information found`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const getCustomerDashboard = async (req, res) => {


  const user = new mongoose.Types.ObjectId(req.params.user);
  try {
    // const { sort, page, limit, filter } = req.query;

    const filterquery = FilterOptions(req.query,Order);

    const orderStats = await Order.aggregate([
      {
        $match: { user: user }  // Apply the provided filters (if any)
      },
      {
        $facet: {
          total: [
            { $count: "total" }  // Total number of orders
          ],
          pending: [
            { $match: { status: "pending" } },  // Orders with status 'pending'
            { $count: "pending" }
          ],
          delivered: [
            { $match: { status: "delivered" } },  // Orders with status 'pending'
            { $count: "delivered" }
          ],
          shipped: [
            { $match: { status: "shipped" } },  // Orders with status 'pending'
            { $count: "shipped" }
          ],
          completed: [
            { $match: { status: "completed" } },  // Orders with status 'success'
            { $count: "completed" }
          ],
          failed: [
            { $match: { status: "failed" } },  // Orders with status 'failed'
            { $count: "failed" }
          ],
          cancelled: [
            { $match: { status: "cancelled" } },  // Orders with status 'cancelled'
            { $count: "cancelled" }
          ],
          processing: [
            { $match: { status: "processing" } },  // Orders with status 'shipped'
            { $count: "processing" }
          ],
          "on-hold": [
            { $match: { status: "on-hold" } },  // Orders with status 'shipped'
            { $count: "on-hold" }
          ]
        }
      },
      {
        $project: {
          total: { $arrayElemAt: ["$total.total", 0] },
          pending: { $ifNull: [{ $arrayElemAt: ["$pending.pending", 0] }, 0] },
          processing: { $ifNull: [{ $arrayElemAt: ["$processing.processing", 0] }, 0] },
          failed: { $ifNull: [{ $arrayElemAt: ["$failed.failed", 0] }, 0] },
          cancelled: { $ifNull: [{ $arrayElemAt: ["$cancelled.cancelled", 0] }, 0] },
          completed: { $ifNull: [{ $arrayElemAt: ["$completed.completed", 0] }, 0] },
          shipped: { $ifNull: [{ $arrayElemAt: ["$shipped.shipped", 0] }, 0] },
          delivered: { $ifNull: [{ $arrayElemAt: ["$delivered.delivered", 0] }, 0] },
          "on-hold": { $ifNull: [{ $arrayElemAt: ["$on-hold.on-hold", 0] }, 0] }
        }
      }
    ]);



    const Orders = await Order.find(
      { ...filterquery.query, user: req.params.user },
      "total createdAt invoice payment_method payment_status status totalPrice ",
      filterquery.options
    ).populate("user")

    const length = await Order.countDocuments({ ...filterquery.query, user: req.params.user });

    if (Orders) {
      Orders.forEach((element) => {
        const { firstName, lastName, email, phoneNumber } = element.user;
        element.user = {
          firstName,
          lastName,
          email,
          phoneNumber,
        };
      });

      return res.status(StatusCodes.OK).json({
        message: `Orders data has been Loaded Successfully!`,
        statusCode: StatusCodes.OK,
        status: ReasonPhrases.OK,
        results: {
          order: {
            results: Orders, total: length
          }, ...orderStats[0]
        }
      });
    } else {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: `No information found`,
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const getSingleOrder = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Order id is not provide",
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
    });
  } else {
    try {
      const OrderId = await Order.findOne({ _id: id }, "-__v").populate("user", 'firstName lastName email phoneNumber') // Populating the 'user' reference
        .populate("items.product", '-_id -categories -category -variants -status') // Populating the 'product' reference within 'items'
        .populate("address").exec();

      if (OrderId.id) {
        return res.status(StatusCodes.OK).json({
          message: `Orderdata data Loaded Successfully!`,
          statusCode: StatusCodes.OK,
          status: ReasonPhrases.OK,
          results: OrderId,
        });
      } else {
        return res.status(StatusCodes.NOT_FOUND).json({
          message: `No information found for given id`,
          statusCode: StatusCodes.NOT_FOUND,
          status: ReasonPhrases.NOT_FOUND,
        });
      }
    } catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: error.message,
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      });
    }
  }
};

const updateOrder = async (req, res) => {
  const { id } = req.params;
  try {
    if (!id) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: "Order id is not provide",
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    }

    const update = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (update) {
      res.status(StatusCodes.OK).json({
        message: "Order Update Successfully",
        status: ReasonPhrases.OK,
        statusCode: StatusCodes.OK,
      });
    } else {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: "Order does not exist..!",
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: "id is not provide",
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    }

    const Order = await Order.findOne({ _id: id });
    if (!Order) {
      res.status(StatusCodes.NOT_FOUND).json({
        message: "Order does not exist..!",
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    } else {
      Order.deleteOne({ _id: id }).then((data, err) => {
        if (err)
          res.status(StatusCodes.NOT_IMPLEMENTED).json({
            message: "Delete Failed",
            status: ReasonPhrases.NOT_IMPLEMENTED,
            statusCode: StatusCodes.NOT_IMPLEMENTED,
            cause: err,
          });
        else {
          res.status(StatusCodes.OK).json({
            message: "Delete Success",
            status: ReasonPhrases.OK,
            statusCode: StatusCodes.OK,
            data: data,
          });
        }
      });
    }
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error.message,
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      cause: error,
    });
  }
};

const cancelOrder = async (req, res) => {
  const { id } = req.params;

  try {
    // Find the order by ID
    const order = await Order.findById(id);

    // Check if the order exists
    if (!order) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "Order not found.",
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }

    // Check if the order has already been canceled
    if (order.status === "canceled") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Order is already canceled.",
        statusCode: StatusCodes.BAD_REQUEST,
        status: ReasonPhrases.BAD_REQUEST,
      });
    }

    // Cancel the order
    order.status = "canceled";
    order.payment_status = "canceled"; // Optionally update payment status if required
    await order.save();

    // Update the stock based on the items in the order
    await updateStockOnOrderCancel(order.items);

    return res.status(StatusCodes.OK).json({
      message: "Order successfully canceled!",
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

module.exports = {
  updateOrder,
  getOrders,
  getSingleOrder,
  deleteOrder,
  createOrder, verifyPayment, getCustomerOrders, getCustomerDashboard, cancelOrder
};
