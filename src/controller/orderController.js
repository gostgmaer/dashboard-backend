


const { validationResult } = require("express-validator");







const Order = require("../models/orders");
const Product = require("../models/products");
const mongoose = require("mongoose");

class OrderController {
  constructor() { }

  handleError(res, error, status = 400) {
    return res.status(status).json({ error: error.message || "An error occurred" });
  }

  isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }



  //---------------------------------------------------------------
  // CORE CRUD OPERATIONS
  //---------------------------------------------------------------


  // Create order
  async createOrder(req, res) {
    try {
      const {
        user,
        email,
        firstName,
        lastName,
        phone,
        shippingAddress,
        billingAddress,
        shippingMethod,
        shippingPrice,
        items,
        additionalNotes,
        couponCode,
        payment_method,
        orderSource,
        ipAddress,
        deviceInfo,
        utmParameters,
        created_by
      } = req.body;

      if (!this.isValidObjectId(user)) throw new Error("Invalid user ID");
      if (!email || !email.match(/^\S+@\S+\.\S+$/)) throw new Error("Valid email is required");
      if (!firstName || !lastName) throw new Error("First and Last name required");
      if (!phone || !phone.match(/^\+?[\d\s-]{10,}$/)) throw new Error("Valid phone number is required");
      if (!shippingAddress || !shippingAddress.addressLine1 || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country)
        throw new Error("Complete shipping address is required");
      if (!Array.isArray(items) || items.length === 0) throw new Error("At least one order item required");

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!this.isValidObjectId(item.product)) throw new Error(`Invalid product ID for item ${i}`);
        if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error(`Quantity must be positive integer for item ${i}`);

        const product = await Product.findById(item.product);
        if (!product) throw new Error(`Product not found for item ${i}`);
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for product ${product._id}`);

        item.price = typeof item.price === "number" && item.price >= 0 ? item.price : product.price;
        item.discount = typeof item.discount === "number" && item.discount >= 0 ? item.discount : 0;
      }

      const order = new Order({
        user,
        email: email.toLowerCase().trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        shippingAddress,
        billingAddress,
        shippingMethod: shippingMethod || "standard",
        shippingPrice: shippingPrice || 0,
        items,
        additionalNotes: additionalNotes ? additionalNotes.trim() : "",
        couponCode: couponCode ? couponCode.trim() : "",
        payment_method,
        orderSource,
        ipAddress,
        deviceInfo,
        utmParameters,
        created_by,
        payment_status: "unpaid",
        status: "pending",
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        loyaltyPointsEarned: 0,
        loyaltyPointsRedeemed: 0,
        amount_paid: 0,
        amount_due: 0,
        currency: "INR"
      });

      if (couponCode) {
        await order.applyCoupon(couponCode);
      }

      await order.save();

      return res.status(201).json({ message: "Order created successfully", order_id: order.order_id, invoice: order.invoice });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Get order by id or order_id
  async getOrderById(req, res) {
    try {
      const { id } = req.params;

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id).populate("items.product").populate("user", "firstName lastName email");
      }
      if (!order) {
        order = await Order.findOne({ order_id: id }).populate("items.product").populate("user", "firstName lastName email");
      }

      if (!order) return res.status(404).json({ error: "Order not found" });

      return res.json(order);
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Get orders list with filters and pagination
  // Enhanced getOrders with flexible multiple filter support

  async getOrders(req, res) {
    try {
      let { page = 1, limit = 20, sort = "createdAt", order = "desc", ...filters } = req.query;

      page = parseInt(page);
      limit = parseInt(limit);
      order = order.toLowerCase() === "asc" ? 1 : -1;

      // Fields that support multiple values separated by commas
      const multiValueFields = ["status", "payment_status", "orderSource", "priorityLevel"];

      const filter = {};

      // Process multi-value filters (e.g., status=pending,completed)
      multiValueFields.forEach(field => {
        if (filters[field]) {
          const values = filters[field].split(",").map(v => v.trim());
          filter[field] = { $in: values };
          delete filters[field]; // Remove so no duplicate processing
        }
      });

      // Handle user filter (single or multi)
      if (filters.user) {
        const users = filters.user.split(",").filter(id => this.isValidObjectId(id));
        if (users.length) {
          filter.user = { $in: users };
        }
        delete filters.user;
      }

      // Text search on email or name if specified
      if (filters.email) {
        filter.email = { $regex: filters.email.trim(), $options: "i" };
        delete filters.email;
      }

      if (filters.customerName) {
        // For customerName we would need a lookup or denormalized field; alternatively partial firstName or lastName search
        filter.$or = [
          { firstName: { $regex: filters.customerName.trim(), $options: "i" } },
          { lastName: { $regex: filters.customerName.trim(), $options: "i" } },
        ];
        delete filters.customerName;
      }

      // Date range filtering
      if (filters.dateFrom || filters.dateTo) {
        filter.createdAt = {};
        if (filters.dateFrom) filter.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) filter.createdAt.$lte = new Date(filters.dateTo);
        delete filters.dateFrom;
        delete filters.dateTo;
      }

      // Additional exact match filters (e.g., deviceInfo, ipAddress)
      Object.entries(filters).forEach(([key, value]) => {
        if (typeof value === "string" && value.trim().length > 0) {
          filter[key] = value.trim();
        }
      });

      const orders = await Order.find(filter)
        .populate("items.product", "name sku price")
        .populate("user", "firstName lastName email")
        .sort({ [sort]: order })
        .skip((page - 1) * limit)
        .limit(limit);

      const total = await Order.countDocuments(filter);

      return res.json({
        page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        items: orders,
      });
    } catch (error) {
      return res.json({
        400: error.message || "An error occurred while fetching orders"
      });
    }
  }


  // Update order partially
  async updateOrder(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const blockedFields = ["order_id", "invoice", "_id", "amount_paid", "amount_due", "payment_status", "payment_method", "user"];
      for (const field of blockedFields) {
        if (updates.hasOwnProperty(field)) {
          delete updates[field];
        }
      }

      let order;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) return res.status(404).json({ error: "Order not found" });

      for (const key in updates) {
        order[key] = updates[key];
      }

      if (updates.items && Array.isArray(updates.items)) {
        for (let i = 0; i < updates.items.length; i++) {
          const item = updates.items[i];
          if (!this.isValidObjectId(item.product)) throw new Error(`Invalid product ID in item ${i}`);
          if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error(`Quantity must be positive integer for item ${i}`);
          const product = await Product.findById(item.product);
          if (!product) throw new Error(`Product not found for item ${i}`);
          if (product.stock < item.quantity) throw new Error(`Insufficient stock for product ${product._id}`);
        }
      }

      await order.save();

      return res.json({ message: "Order updated", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Delete order (soft cancel)
  async deleteOrder(req, res) {
    try {
      const { id } = req.params;

      let order;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (["delivered", "completed", "canceled"].includes(order.status)) {
        return res.status(400).json({ error: "Order cannot be deleted due to its current status" });
      }

      await order.cancelOrder("Order deleted by user/admin");

      return res.json({ message: "Order canceled (soft deleted) successfully", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }


  //---------------------------------------------------------------
  // PAYMENT & TRANSACTIONS
  //---------------------------------------------------------------

  // Mark order as paid and update loyalty points
  async markAsPaid(req, res) {
    try {
      const { id } = req.params;
      const { transactionId, amount } = req.body;

      if (!transactionId) throw new Error("Transaction ID is required");
      if (typeof amount !== "number" || amount <= 0) throw new Error("Valid payment amount is required");

      let order;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      await order.markAsPaid(transactionId.trim(), amount);

      await order.save();

      return res.json({ message: "Payment recorded successfully", order_id: order.order_id, payment_status: order.payment_status });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Refund an order partially or fully
  async refundOrder(req, res) {
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;

      if (typeof amount !== "number" || amount <= 0) throw new Error("Valid refund amount is required");

      let order;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      await order.refundOrder(amount, reason || "Customer refund requested");

      await order.save();

      return res.json({ message: "Refund processed successfully", order_id: order.order_id, payment_status: order.payment_status });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Bulk refund multiple orders with fixed amount and reason
  async bulkRefundOrders(req, res) {
    try {
      const { orderIds, amount, reason } = req.body;

      if (!Array.isArray(orderIds) || orderIds.length === 0) throw new Error("Order IDs array is required");
      if (typeof amount !== "number" || amount <= 0) throw new Error("Valid refund amount is required");

      // Verify orderIds are all valid format
      const validOrderIds = orderIds.filter(id => typeof id === "string");

      if (validOrderIds.length === 0) throw new Error("Valid order IDs required");

      const result = await Order.bulkRefundOrders(validOrderIds, amount, reason || "Bulk refund processed");

      return res.json({ message: `Bulk refund processed for ${result.modifiedCount} orders` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Redeem loyalty points on an order
  async redeemLoyaltyPoints(req, res) {
    try {
      const { id } = req.params;
      const { points } = req.body;

      if (!Number.isInteger(points) || points <= 0) throw new Error("Points must be a positive integer");

      let order;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      await order.redeemLoyaltyPoints(points);

      await order.save();

      return res.json({ message: `${points} loyalty points redeemed`, discountAmount: order.discountAmount, total: order.total });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  //---------------------------------------------------------------
  // ORDER STATE & FULFILLMENT
  //---------------------------------------------------------------

  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { newStatus, reason } = req.body;

      if (!newStatus) throw new Error("New status is required");

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      order.updateStatus(newStatus, reason);

      await order.save();

      return res.json({ message: `Order status updated to ${newStatus}`, order_id: order.order_id, status: order.status });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Bulk update order status for multiple orders
  async bulkUpdateOrderStatus(req, res) {
    try {
      const { orderIds, newStatus, reason } = req.body;

      if (!Array.isArray(orderIds) || orderIds.length === 0) throw new Error("orderIds array is required");
      if (!newStatus) throw new Error("New status is required");

      // Validate newStatus against enum values - static method or schema enums can be used
      const validStatuses = Order.schema.path("status").enumValues;
      if (!validStatuses.includes(newStatus)) throw new Error(`Invalid status: ${newStatus}`);

      const result = await Order.bulkUpdateStatus(orderIds, newStatus, reason || "");

      return res.json({ message: `Bulk status update applied to ${result.modifiedCount} orders` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Split order for partial fulfillment by item indices array
  async splitOrder(req, res) {
    try {
      const { id } = req.params;
      const { itemsToSplit } = req.body;

      if (!Array.isArray(itemsToSplit) || itemsToSplit.length === 0) throw new Error("itemsToSplit array is required");

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      const newOrder = await order.splitOrder(itemsToSplit);

      return res.json({
        message: "Order split successful",
        original_order_id: order.order_id,
        new_order_id: newOrder.order_id,
      });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Add tracking info and update status to shipped
  async addTrackingInfo(req, res) {
    try {
      const { id } = req.params;
      const { carrier, trackingNumber } = req.body;

      if (!carrier || !trackingNumber) throw new Error("Carrier and trackingNumber are required");

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      order.addTracking(carrier.trim(), trackingNumber.trim());
      await order.save();

      return res.json({ message: "Tracking info added and status updated to shipped", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Mark order as delivered and update product sales
  async markOrderAsDelivered(req, res) {
    try {
      const { id } = req.params;

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      await order.markAsDelivered();

      await order.save();

      return res.json({ message: "Order marked as delivered", order_id: order.order_id, status: order.status });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Set priority level for an order
  async setPriorityLevel(req, res) {
    try {
      const { id } = req.params;
      const { priority } = req.body;

      if (!priority) throw new Error("Priority level is required");
      const validPriorities = Order.schema.path("priorityLevel").enumValues;
      if (!validPriorities.includes(priority)) throw new Error(`Invalid priority level: ${priority}`);

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      order.setPriorityLevel(priority);
      await order.save();

      return res.json({ message: `Priority level set to ${priority}`, order_id: order.order_id, priorityLevel: order.priorityLevel });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  //---------------------------------------------------------------
  // CART & ITEM MANAGEMENT
  //---------------------------------------------------------------

  async updateItemQuantity(req, res) {
    try {
      const { id, itemIndex } = req.params;
      const { newQuantity } = req.body;

      if (!Number.isInteger(newQuantity) || newQuantity < 1) {
        throw new Error("Quantity must be a positive integer");
      }

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      const index = parseInt(itemIndex);
      if (isNaN(index) || index < 0 || index >= order.items.length) {
        throw new Error("Invalid item index");
      }

      await order.updateItemQuantity(index, newQuantity);
      await order.save();

      return res.json({ message: `Quantity for item ${index} updated to ${newQuantity}`, order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Add or update gift message for the order
  async addGiftMessage(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        throw new Error("Gift message must be a non-empty string");
      }

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      order.addGiftMessage(message.trim());
      await order.save();

      return res.json({ message: "Gift message added/updated", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Apply coupon code to order and recalculate totals
  async applyCoupon(req, res) {
    try {
      const { id } = req.params;
      const { couponCode } = req.body;

      if (!couponCode || typeof couponCode !== "string" || !couponCode.trim()) {
        throw new Error("Coupon code must be provided");
      }

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      await order.applyCoupon(couponCode.trim());

      await order.save();

      return res.json({
        message: `Coupon ${couponCode.trim()} applied`,
        order_id: order.order_id,
        discountAmount: order.discountAmount,
        total: order.total
      });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async requestReturn(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || typeof reason !== "string" || !reason.trim()) {
        throw new Error("Return reason is required and must be a non-empty string");
      }

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      order.requestReturn(reason.trim());

      await order.save();

      return res.json({
        message: "Return request submitted",
        order_id: order.order_id,
        returnRequest: order.returnRequest,
      });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Approve or reject a return request (admin action)
  async resolveReturnRequest(req, res) {
    try {
      const { id } = req.params;
      const { action, note } = req.body; // action = "approved" | "rejected" | "processed"

      const allowedActions = ["approved", "rejected", "processed"];
      if (!allowedActions.includes(action)) {
        throw new Error(`Invalid action. Allowed: ${allowedActions.join(", ")}`);
      }

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      if (order.returnRequest.status === "none") {
        throw new Error("No return request to resolve");
      }

      order.returnRequest.status = action;
      if (note && typeof note === "string") {
        order.notes.push(`Return request ${action}: ${note}`);
      } else {
        order.notes.push(`Return request ${action}`);
      }

      await order.save();

      return res.json({ message: `Return request ${action}`, order_id: order.order_id, returnRequest: order.returnRequest });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // List return requests by status with pagination
  async getReturnRequests(req, res) {
    try {
      const { status = "requested", dateFrom, dateTo, page = 1, limit = 20 } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      // Validate status
      const validStatuses = Order.schema.path("returnRequest.status").enumValues;
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid returnRequest status: ${status}`);
      }

      // Build query filter
      const filter = { "returnRequest.status": status };

      if (dateFrom || dateTo) {
        filter["returnRequest.requestedAt"] = {};
        if (dateFrom) filter["returnRequest.requestedAt"].$gte = new Date(dateFrom);
        if (dateTo) filter["returnRequest.requestedAt"].$lte = new Date(dateTo);
      }

      // Fetch total count
      const total = await Order.countDocuments(filter);

      // Query return requests
      const requests = await Order.find(filter)
        .populate("user", "firstName lastName email")
        .select("order_id returnRequest customerName createdAt total")
        .sort({ "returnRequest.requestedAt": 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

      return res.json({
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRequests: total,
        requests,
      });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  
  
  // Get top customers by total spending and loyalty points earned, with limit
  async getTopCustomers(req, res) {
    try {
      let { limit = 10 } = req.query;
      limit = parseInt(limit);
      if (isNaN(limit) || limit < 1) limit = 10;

      const topCustomers = await Order.getTopCustomers(limit);

      return res.json({ count: topCustomers.length, customers: topCustomers });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Get order history for a specific user, limited by number of records
  async getCustomerOrderHistory(req, res) {
    try {
      const { userId } = req.params;
      let { limit = 20 } = req.query;

      if (!this.isValidObjectId(userId)) throw new Error("Invalid user ID");
      limit = parseInt(limit);
      if (isNaN(limit) || limit < 1) limit = 20;

      const orders = await Order.getCustomerOrderHistory(userId, limit);

      return res.json({ userId, count: orders.length, orders });
    } catch (error) {
      return this.handleError(res, error);
    }
  }
  async getOrderStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) throw new Error("startDate and endDate are required");

      const start = new Date(startDate);
      const end = new Date(endDate);

      const stats = await Order.getOrderStats(start, end);

      return res.json({ startDate: start, endDate: end, stats });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async getOrderTrends(req, res) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) throw new Error("startDate and endDate are required");

      const start = new Date(startDate);
      const end = new Date(endDate);

      const trends = await Order.getOrderTrends(start, end);

      return res.json({ startDate: start, endDate: end, trends });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async getRevenueBySource(req, res) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) throw new Error("startDate and endDate are required");

      const start = new Date(startDate);
      const end = new Date(endDate);

      const revenue = await Order.getRevenueBySource(start, end);

      return res.json({ startDate: start, endDate: end, revenue });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async getProductPerformance(req, res) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) throw new Error("startDate and endDate are required");

      const start = new Date(startDate);
      const end = new Date(endDate);

      const performance = await Order.getProductPerformance(start, end);

      return res.json({ startDate: start, endDate: end, performance });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async getOrderConversionFunnel(req, res) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) throw new Error("startDate and endDate are required");

      const start = new Date(startDate);
      const end = new Date(endDate);

      const funnel = await Order.getOrderConversionFunnel(start, end);

      return res.json({ startDate: start, endDate: end, funnel });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async getFeaturedOrders(req, res) {
    try {
      let { limit = 5 } = req.query;
      limit = parseInt(limit);
      if (isNaN(limit) || limit < 1) limit = 5;

      const featuredOrders = await Order.getFeaturedOrders(limit);

      return res.json({ count: featuredOrders.length, orders: featuredOrders });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async getLowStockOrders(req, res) {
    try {
      let { stockThreshold = 10 } = req.query;
      stockThreshold = parseInt(stockThreshold);
      if (isNaN(stockThreshold) || stockThreshold < 1) stockThreshold = 10;

      const lowStockOrders = await Order.getLowStockOrders(stockThreshold);

      return res.json({ stockThreshold, count: lowStockOrders.length, orders: lowStockOrders });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  
  // Estimate delivery date for an order with optional days parameter
  async estimateDelivery(req, res) {
    try {
      const { id } = req.params;
      let { days = 5 } = req.query;

      days = parseInt(days);
      if (isNaN(days) || days < 1) days = 5;

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) return res.status(404).json({ error: "Order not found" });

      const estimatedDate = order.estimateDelivery(days);

      return res.json({ order_id: order.order_id, estimatedDelivery: estimatedDate.toISOString().substring(0, 10) });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Get order summary (concise details)
  async getOrderSummary(req, res) {
    try {
      const { id } = req.params;

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) return res.status(404).json({ error: "Order not found" });

      const summary = order.getSummary();

      return res.json({ orderSummary: summary });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Reorder based on an existing order (creates new order with same items)
  async reorder(req, res) {
    try {
      const { id } = req.params;

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) return res.status(404).json({ error: "Original order not found" });

      const newOrder = await order.reorder();

      return res.status(201).json({ message: "Reorder created successfully", new_order_id: newOrder.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

   async getFraudulentOrders(req, res) {
    try {
      let { threshold = 80, limit = 20 } = req.query;
      threshold = Number(threshold);
      limit = parseInt(limit);
      if (isNaN(threshold) || threshold < 0) threshold = 80;
      if (isNaN(limit) || limit < 1) limit = 20;

      const fraudulentOrders = await Order.getFraudulentOrders(threshold);

      return res.json({ count: fraudulentOrders.length, threshold, orders: fraudulentOrders.slice(0, limit) });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Check order compliance for a single order (example placeholder)
  async checkOrderCompliance(req, res) {
    try {
      const { id } = req.params;

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) return res.status(404).json({ error: "Order not found" });

      // Example compliance checks could be inserted here, or you might call instance method, omitted for demo
      // For now just respond with complianceStatus field
      return res.json({ order_id: order.order_id, complianceStatus: order.complianceStatus });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Flag an order manually for flagged compliance or fraud status
  async flagOrder(req, res) {
    try {
      const { id } = req.params;
      const { complianceStatus, fraudScore, notes } = req.body;

      const allowedStatuses = ["pending", "approved", "flagged", "rejected"];
      if (complianceStatus && !allowedStatuses.includes(complianceStatus)) {
        throw new Error(`Invalid compliance status: ${complianceStatus}`);
      }

      if (fraudScore !== undefined && (typeof fraudScore !== "number" || fraudScore < 0 || fraudScore > 100)) {
        throw new Error("Fraud score must be a number between 0 and 100");
      }

      let order = null;
      if (this.isValidObjectId(id)) {
        order = await Order.findById(id);
      }
      if (!order) {
        order = await Order.findOne({ order_id: id });
      }
      if (!order) throw new Error("Order not found");

      if (complianceStatus) order.complianceStatus = complianceStatus;
      if (fraudScore !== undefined) order.fraudScore = fraudScore;

      if (notes) order.notes.push(notes);

      await order.save();

      return res.json({ message: "Order flagged/updated successfully", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  
  // Validate stock for a batch of orders (pass array of order objects in request body)
  async validateStockBulk(req, res) {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders) || orders.length === 0) {
        throw new Error("Orders array is required");
      }
      await Order.validateStock(orders);
      return res.json({ message: "Stock validated for all provided orders" });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Update stock levels based on order ID (decrement stock), single order or multiple IDs from request body
  async updateStockBulk(req, res) {
    try {
      const { orderIds } = req.body;
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        throw new Error("orderIds array is required");
      }

      const results = [];
      for (const orderId of orderIds) {
        try {
          await Order.updateStock(orderId);
          results.push({ orderId, status: "success" });
        } catch (ex) {
          results.push({ orderId, status: "failure", error: ex.message });
        }
      }

      return res.json({ message: "Stock update completed", results });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Export orders report - placeholder for generating CSV, Excel, or JSON reports
  async exportOrdersReport(req, res) {
    try {
      // Accept filters similar to getOrders for report scope
      const filters = req.query;

      // Implementation might query orders and generate export file
      // Here return a dummy success message
      return res.json({ message: "Order export prepared. Implement file generation logic here." });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Import bulk orders - placeholder for intake of CSV or JSON bulk upload
  async importOrdersBulk(req, res) {
    try {
      // Access file or JSON payload from req for import
      // Validate and create orders accordingly

      // Return dummy success message for now
      return res.json({ message: "Order import successful. Implement validation and batch create logic." });
    } catch (error) {
      return this.handleError(res, error);
    }
  }


  // Audit changes to orders - requires change log or versioning system integration
  async auditOrderChanges(req, res) {
    try {
      const { id } = req.params;
      // This would normally query a change log collection or external audit system
      return res.json({ message: `Audit log for order ${id} is not implemented; integrate with audit service.` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Push real-time notifications on status changes (stub)
  async pushStatusNotification(req, res) {
    try {
      const { id, status } = req.body;
      // Stub for push notification system hook (e.g., websocket, push services)
      return res.json({ message: `Status notification pushed for order ${id} status ${status}` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Log arbitrary order events
  async logOrderEvent(req, res) {
    try {
      const { id } = req.params;
      const { event, details } = req.body;
      if (!event) throw new Error("Event is required");

      let order = await Order.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      order.notes.push(`[Event] ${event}: ${details || ""}`);
      await order.save();

      return res.json({ message: "Event logged", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async restoreCanceledOrder(req, res) {
    try {
      const { id } = req.params;
      let order = await Order.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.status !== "canceled") return res.status(400).json({ error: "Order is not canceled" });

      order.status = "pending";
      order.notes.push("Order restored from canceled state");
      await order.save();

      return res.json({ message: "Order restored", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async archiveCompletedOrders(req, res) {
    try {
      // Implement logic to archive completed orders (e.g., move to archive collection, or set flag)
      return res.json({ message: "Archive completed orders - implement logic here" });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async sendOrderInvoice(req, res) {
    try {
      const { id } = req.params;
      // Trigger invoice sending logic, e.g., email via external service
      return res.json({ message: `Invoice send requested for order ${id} - implement email logic` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async getHistoricalOrderData(req, res) {
    try {
      // Placeholder for historical order data query, e.g., for trend analysis or audit
      return res.json({ message: "Historical order data - implement query here" });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async getOrderGrowthStats(req, res) {
    try {
      // Placeholder for order growth statistics calculations
      return res.json({ message: "Order growth stats - implement analytics here" });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async rateOrderItems(req, res) {
    try {
      const { id } = req.params;
      const { ratings } = req.body; // Expected format: [{itemIndex: 0, rating: 5, comment: ""}, ...]

      if (!Array.isArray(ratings) || ratings.length === 0) throw new Error("Ratings array required");

      let order = await Order.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      // Implement rating logic here, e.g., attaching rating to order items or separate collection
      return res.json({ message: "Order items rated - implement storage logic" });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async reviewOrderExperience(req, res) {
    try {
      const { id } = req.params;
      const { review } = req.body;

      if (!review || typeof review !== "string") throw new Error("Review text required");

      let order = await Order.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      // Implement review storage logic
      return res.json({ message: "Order experience reviewed - implement storage logic" });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async getOrderEventsTimeline(req, res) {
    try {
      const { id } = req.params;
      // Placeholder: fetch detailed timeline of order status changes, events, notes
      return res.json({ message: `Order events timeline for order ${id} - implement detailed fetch` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async assignOrderToAgent(req, res) {
    try {
      const { id } = req.params;
      const { agentId } = req.body;

      if (!agentId) throw new Error("Agent ID is required");

      let order = await Order.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      order.assignedAgent = agentId;
      order.notes.push(`Order assigned to agent ${agentId}`);
      await order.save();

      return res.json({ message: "Order assigned successfully", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async trackOrderRoute(req, res) {
    try {
      const { id } = req.params;
      // Placeholder for order delivery route tracking integration
      return res.json({ message: `Order route tracking for order ${id} - implement integration` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async calculateOrderProfit(req, res) {
    try {
      const { id } = req.params;
      // Placeholder for profit calculation logic e.g. revenue minus costs
      return res.json({ message: `Profit calculation for order ${id} - implement financial logic` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async checkOrderPaymentReconciliation(req, res) {
    try {
      const { id } = req.params;
      // Placeholder for payment reconciliation logic
      return res.json({ message: `Payment reconciliation for order ${id} - implement reconciliation logic` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async flagSuspectedReturnAbuse(req, res) {
    try {
      const { id } = req.params;
      // Placeholder for return abuse flagging logic
      return res.json({ message: `Return abuse flag check for order ${id} - implement logic` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async handleOrderEscalation(req, res) {
    try {
      const { id } = req.params;
      // Placeholder for order escalation process logic
      return res.json({ message: `Order escalation requested for ${id} - implement process` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async syncOrderWithERP(req, res) {
    try {
      const { id } = req.params;
      // Placeholder for syncing order data with ERP system
      return res.json({ message: `Order ${id} sync with ERP triggered - implement integration` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async integrateOrderWithCRM(req, res) {
    try {
      const { id } = req.params;
      // Placeholder for syncing order data with CRM system
      return res.json({ message: `Order ${id} integration with CRM triggered - implement integration` });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async lockOrderForAudit(req, res) {
    try {
      const { id } = req.params;
      let order = await Order.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      order.auditLock = true;
      order.notes.push("Order locked for audit");
      await order.save();

      return res.json({ message: "Order locked for audit", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async releaseOrderLock(req, res) {
    try {
      const { id } = req.params;
      let order = await Order.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      order.auditLock = false;
      order.notes.push("Order audit lock released");
      await order.save();

      return res.json({ message: "Order audit lock released", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async cancelOrderByAdmin(req, res) {
    try {
      const { id } = req.params;
      const { reason = "Canceled by admin" } = req.body;

      let order = await Order.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (["delivered", "completed"].includes(order.status)) {
        return res.status(400).json({ error: "Cannot cancel delivered or completed order" });
      }

      await order.cancelOrder(reason);

      await order.save();

      return res.json({ message: "Order canceled by admin", order_id: order.order_id });
    } catch (error) {
      return this.handleError(res, error);
    }
  }
  // Get average order value for date range
  async getAverageOrderValue(req, res) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) throw new Error("startDate and endDate are required");

      const start = new Date(startDate);
      const end = new Date(endDate);

      const result = await Order.getAverageOrderValue(start, end);

      return res.json({ averageOrderValue: result.length ? result[0].averageOrderValue : 0 });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Search orders by customer name
  async searchOrdersByCustomerName(req, res) {
    try {
      const { name, limit = 20 } = req.query;
      if (!name || !name.trim()) throw new Error("Name query parameter is required");

      const results = await Order.searchOrdersByCustomerName(name.trim(), parseInt(limit));

      return res.json({ count: results.length, orders: results });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Get orders aggregated by payment method within date range
  async getOrdersByPaymentMethod(req, res) {
    try {
      const { paymentMethod, startDate, endDate } = req.query;
      if (!paymentMethod || !startDate || !endDate) throw new Error("paymentMethod, startDate and endDate are required");

      const start = new Date(startDate);
      const end = new Date(endDate);

      const results = await Order.getOrdersByPaymentMethod(paymentMethod, start, end);

      return res.json({ paymentMethod, startDate, endDate, data: results });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Get delayed unpaid orders overdue by specified days
  async getDelayedOrders(req, res) {
    try {
      let { daysOverdue = 7 } = req.query;
      daysOverdue = parseInt(daysOverdue);
      if (isNaN(daysOverdue) || daysOverdue < 1) daysOverdue = 7;

      const delayedOrders = await Order.getDelayedOrders(daysOverdue);

      return res.json({ daysOverdue, count: delayedOrders.length, orders: delayedOrders });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  // Get loyalty points summary for date range
  async getLoyaltyPointsSummary(req, res) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) throw new Error("startDate and endDate are required");

      const start = new Date(startDate);
      const end = new Date(endDate);

      const summary = await Order.getLoyaltyPointsSummary(start, end);

      return res.json({ startDate, endDate, summary: summary.length ? summary[0] : { totalPointsEarned: 0, totalPointsRedeemed: 0 } });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

}

module.exports = new OrderController();

