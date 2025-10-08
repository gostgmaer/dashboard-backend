const mongoose = require("mongoose");
const OrderCounter = require("./orderId");

// Enhanced Cart Item Schema with additional validation
const CartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product reference is required"],
    },
     isDeleted: { type: Boolean, default: false},
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      validate: {
        validator: Number.isInteger,
        message: "Quantity must be an integer",
      },
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    variant: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    warrantyInfo: {
      type: String,
      trim: true,
    }, // Warranty details for the item
  },
  {  timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }, }
);

// Order Schema with comprehensive fields and validations
const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^\+?[\d\s-]{10,}$/, "Please provide a valid phone number"],
    },
    shippingAddress: {
      addressLine1: { type: String, required: true, trim: true },
      addressLine2: { type: String, trim: true },
      city: { type: String, required: [true, "City is required"], trim: true },
      state: { type: String, trim: true },
      postalCode: {
        type: String,
        required: [true, "Postal code is required"],
        trim: true,
      },
      country: { type: String, required: [true, "Country is required"], trim: true },
    },
    billingAddress: {
      addressLine1: { type: String, trim: true },
      addressLine2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true },
    },
    shippingMethod: {
      type: String,
      enum: ["standard", "express", "overnight", "pickup"],
      default: "standard",
    },
    shippingPrice: {
      type: Number,
      default: 0,
      min: [0, "Shipping price cannot be negative"],
    },
    items: {
      type: [CartItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: "Order must contain at least one item",
      },
    },
    additionalNotes: { type: String, trim: true },
    notes: [{ type: String, trim: true }],
    couponCode: { type: String, trim: true, default: "" },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Discount amount cannot be negative"],
    },
    payment_method: {
      type: String,
      enum: ["credit_card", "debit_card", "paypal", "bank_transfer", "cod", "wallet"],
    },
    transaction_id: { type: String, trim: true },
    transactions: [
      {
        transactionId: { type: String, trim: true },
        amount: { type: Number, min: 0 },
        status: { type: String, enum: ["pending", "completed", "failed", "refunded"] },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    payment_status: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded", "partial", "pending"],
      default: "unpaid",
    },
    subtotal: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amount_due: { type: Number, default: 0, min: 0 },
    amount_paid: { type: Number, default: 0, min: 0 },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR", "GBP", "JPY"],
    },
    invoice: { type: String, unique: true, sparse: true },
    order_id: { type: String, unique: true, sparse: true },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "shipped",
        "delivered",
        "canceled",
        "returned",
        "failed",
        "refunded",
        "on-hold",
        "awaiting-payment",
        "payment-received",
        "payment-failed",
        "dispatched",
        "in-transit",
        "out-for-delivery",
        "partially-shipped",
        "partially-delivered",
        "order-accepted",
        "order-declined",
        "awaiting-fulfillment",
        "ready-for-pickup",
        "backordered",
        "partially-refunded",
        "awaiting-confirmation",
        "awaiting-shipment",
        "packaging",
        "quality-checked",
      ],
      default: "pending",
    },
    orderSource: {
      type: String,
      enum: ["website", "app", "pos", "api", "marketplace"],
      default: "website",
    },
    ipAddress: { type: String, trim: true },
    deviceInfo: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
    carrier: { type: String, trim: true },
    utmParameters: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },
    entity: { type: String, default: "order" },
    offer_id: { type: mongoose.Schema.Types.Mixed, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fraudScore: { type: Number, min: 0, max: 100 },
    complianceStatus: {
      type: String,
      enum: ["pending", "approved", "flagged", "rejected"],
      default: "pending",
    },
    giftMessage: { type: String, trim: true }, // Gift message for the order
    priorityLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    }, // Order priority for fulfillment
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for customer full name
orderSchema.virtual("customerName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Indexes for performance
// orderSchema.index({ order_id: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ payment_status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ email: 1 });

// Pre-save hook: Generate incremental order_id and invoice
orderSchema.pre("save", async function (next) {
  try {
    if (!this.order_id) {
      const counter = await OrderCounter.findOneAndUpdate(
        { prefix: "ECO" },
        { $inc: { counter: 1 } },
        { new: true, upsert: true }
      );
      this.order_id = `${counter.prefix}${counter.counter.toString().padStart(6, "0")}`;
    }
    if (!this.invoice) {
      this.invoice = `INV-${this.order_id}`;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save hook: Validate and calculate totals
orderSchema.pre("save", async function (next) {
  try {
    this.calculateTotals();
    for (const item of this.items) {
      const product = await mongoose.model("Product").findById(item.product);
      if (!product || product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.product}`);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Instance Methods
orderSchema.methods.calculateTotals = function () {
  const subtotal = this.items.reduce(
    (acc, item) => acc + item.price * item.quantity - item.discount,
    0
  );
  this.subtotal = parseFloat(subtotal.toFixed(2));
  this.total = parseFloat((subtotal + this.shippingPrice + this.taxAmount - this.discountAmount).toFixed(2));
  this.amount_due = this.total - this.amount_paid;
};

// Mark as paid
orderSchema.methods.markAsPaid = function (transactionId, amount) {
  if (!transactionId) throw new Error("Transaction ID is required");
  this.payment_status = amount >= this.total ? "paid" : "partial";
  this.transaction_id = transactionId;
  this.amount_paid += amount;
  this.amount_due = this.total - this.amount_paid;
  this.transactions.push({
    transactionId,
    amount,
    status: "completed",
  });
  this.notes.push(`Payment processed: ${amount} via ${this.payment_method}`);
};

// Cancel order
orderSchema.methods.cancelOrder = function (reason = "Customer request") {
  if (["delivered", "completed"].includes(this.status)) {
    throw new Error("Cannot cancel delivered or completed order");
  }
  this.status = "canceled";
  this.notes.push(`Order canceled: ${reason}`);
};

// Refund order
orderSchema.methods.refundOrder = function (amount, reason = "Customer request") {
  if (amount > this.amount_paid) throw new Error("Refund amount exceeds paid amount");
  this.payment_status = amount === this.amount_paid ? "refunded" : "partially-refunded";
  this.amount_paid -= amount;
  this.amount_due += amount;
  this.transactions.push({
    transactionId: `REF-${this.order_id}-${Date.now()}`,
    amount: -amount,
    status: "refunded",
  });
  this.notes.push(`Refund processed: ${amount} - ${reason}`);
};

// Update status with validation
orderSchema.methods.updateStatus = function (newStatus, reason = "") {
  const validStatuses = this.schema.path("status").enumValues;
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  if (this.status === newStatus) return;
  this.status = newStatus;
  this.notes.push(`Status updated to: ${newStatus}${reason ? ` - ${reason}` : ""}`);
};

// Add tracking info
orderSchema.methods.addTracking = function (carrier, trackingNumber) {
  if (!carrier || !trackingNumber) throw new Error("Carrier and tracking number are required");
  this.carrier = carrier;
  this.trackingNumber = trackingNumber;
  this.updateStatus("shipped", `Tracking: ${carrier} - ${trackingNumber}`);
};

// Estimate delivery date
orderSchema.methods.estimateDelivery = function (days = 5) {
  const estDate = new Date(this.createdAt);
  estDate.setDate(estDate.getDate() + days);
  return estDate;
};

// Mark as delivered
orderSchema.methods.markAsDelivered = function () {
  this.updateStatus("delivered", "Order marked as delivered");
};

// Check if order is overdue
orderSchema.methods.isOverdue = function () {
  if (this.payment_status === "paid") return false;
  const created = new Date(this.createdAt);
  const now = new Date();
  const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  return diffDays > 7;
};

// Reorder
orderSchema.methods.reorder = async function () {
  const newOrder = this.toObject();
  delete newOrder._id;
  delete newOrder.order_id;
  delete newOrder.invoice;
  newOrder.status = "pending";
  newOrder.payment_status = "unpaid";
  newOrder.createdAt = new Date();
  newOrder.updatedAt = new Date();
  newOrder.notes = ["This is a reorder"];
  newOrder.transactions = [];
  newOrder.amount_paid = 0;
  newOrder.amount_due = newOrder.total;
  return await mongoose.model("Order").create(newOrder);
};

// Get order summary
orderSchema.methods.getSummary = function () {
  return {
    order_id: this.order_id,
    customer: this.customerName,
    status: this.status,
    payment_status: this.payment_status,
    total: this.total,
    currency: this.currency,
    createdAt: this.createdAt,
    shippingAddress: this.shippingAddress,
    itemCount: this.items.length,
    priorityLevel: this.priorityLevel,
  };
};

// Apply coupon
orderSchema.methods.applyCoupon = async function (couponCode) {
  const coupon = await mongoose.model("Coupon").findOne({ code: couponCode, active: true });
  if (!coupon) throw new Error("Invalid or inactive coupon");
  if (coupon.expiryDate < new Date()) throw new Error("Coupon expired");
  this.couponCode = couponCode;
  this.discountAmount = coupon.discountType === "percentage"
    ? (this.subtotal * coupon.discountValue) / 100
    : coupon.discountValue;
  this.calculateTotals();
};

// Split order for partial fulfillment
orderSchema.methods.splitOrder = async function (itemsToSplit) {
  if (!itemsToSplit || !Array.isArray(itemsToSplit)) {
    throw new Error("Items to split must be provided as an array");
  }
  const newOrderItems = [];
  const remainingItems = [];
  this.items.forEach((item, index) => {
    if (itemsToSplit.includes(index)) {
      newOrderItems.push(item);
    } else {
      remainingItems.push(item);
    }
  });
  if (newOrderItems.length === 0 || remainingItems.length === 0) {
    throw new Error("Cannot split order: invalid item selection");
  }
  this.items = remainingItems;
  this.calculateTotals();
  await this.save();
  const newOrder = this.toObject();
  delete newOrder._id;
  delete newOrder.order_id;
  delete newOrder.invoice;
  newOrder.items = newOrderItems;
  newOrder.status = "pending";
  newOrder.payment_status = "unpaid";
  newOrder.createdAt = new Date();
  newOrder.updatedAt = new Date();
  newOrder.notes = ["Split from order " + this.order_id];
  newOrder.transactions = [];
  newOrder.amount_paid = 0;
  const newOrderDoc = await mongoose.model("Order").create(newOrder);
  newOrderDoc.calculateTotals();
  await newOrderDoc.save();
  return newOrderDoc;
};

// Update item quantity
orderSchema.methods.updateItemQuantity = async function (itemIndex, newQuantity) {
  if (itemIndex < 0 || itemIndex >= this.items.length) {
    throw new Error("Invalid item index");
  }
  if (!Number.isInteger(newQuantity) || newQuantity < 1) {
    throw new Error("Quantity must be a positive integer");
  }
  const product = await mongoose.model("Product").findById(this.items[itemIndex].product);
  if (!product || product.stock < newQuantity) {
    throw new Error(`Insufficient stock for product ${this.items[itemIndex].product}`);
  }
  this.items[itemIndex].quantity = newQuantity;
  this.calculateTotals();
  this.notes.push(`Updated quantity for item ${itemIndex} to ${newQuantity}`);
};

// Add gift message
orderSchema.methods.addGiftMessage = function (message) {
  if (!message || typeof message !== "string") {
    throw new Error("Gift message must be a non-empty string");
  }
  this.giftMessage = message;
  this.notes.push("Gift message added");
};

// Update priority level
orderSchema.methods.setPriorityLevel = function (priority) {
  const validPriorities = this.schema.path("priorityLevel").enumValues;
  if (!validPriorities.includes(priority)) {
    throw new Error(`Invalid priority level: ${priority}`);
  }
  this.priorityLevel = priority;
  this.notes.push(`Priority level set to: ${priority}`);
};

// Static Methods
orderSchema.statics.getOrderStats = async function (startDate, endDate) {
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$total" },
        averageOrderValue: { $avg: "$total" },
        totalItems: { $sum: { $size: "$items" } },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
  return stats;
};

orderSchema.statics.getTopCustomers = async function (limit = 10) {
  return await this.aggregate([
    {
      $group: {
        _id: "$user",
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$total" },
        lastOrder: { $max: "$createdAt" },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        customerName: { $concat: ["$user.firstName", " ", "$user.lastName"] },
        email: "$user.email",
        totalOrders: 1,
        totalSpent: 1,
        lastOrder: 1,
      },
    },
    { $sort: { totalSpent: -1 } },
    { $limit: limit },
  ]);
};

orderSchema.statics.getRevenueBySource = async function (startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["completed", "delivered"] },
      },
    },
    {
      $group: {
        _id: "$orderSource",
        totalRevenue: { $sum: "$total" },
        orderCount: { $sum: 1 },
        averageOrderValue: { $avg: "$total" },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);
};

orderSchema.statics.getFeaturedOrders = async function (limit = 5) {
  return await this.find({
    status: { $in: ["completed", "delivered"] },
    total: { $gt: 0 },
  })
    .populate("user", "firstName lastName email")
    .sort({ total: -1, createdAt: -1 })
    .limit(limit)
    .lean();
};

orderSchema.statics.bulkUpdateStatus = async function (orderIds, newStatus, reason = "") {
  const validStatuses = this.schema.path("status").enumValues;
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  return await this.updateMany(
    { order_id: { $in: orderIds } },
    {
      $set: { status: newStatus },
      $push: { notes: `Bulk status update to: ${newStatus}${reason ? ` - ${reason}` : ""}` },
    }
  );
};

orderSchema.statics.validateStock = async function (orders) {
  for (const order of orders) {
    for (const item of order.items) {
      const product = await mongoose.model("Product").findById(item.product);
      if (!product || product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.product} in order ${order.order_id}`);
      }
    }
  }
};

orderSchema.statics.updateStock = async function (orderId) {
  const order = await this.findOne({ order_id });
  if (!order) throw new Error("Order not found");
  for (const item of order.items) {
    await mongoose.model("Product").findByIdAndUpdate(
      item.product,
      { $inc: { stock: -item.quantity } }
    );
  }
};

// New Static Methods
orderSchema.statics.getOrderTrends = async function (startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$total" },
        averageOrderValue: { $avg: "$total" },
        completedOrders: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

orderSchema.statics.getProductPerformance = async function (startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["completed", "delivered"] },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        totalQuantity: { $sum: "$items.quantity" },
        totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        totalOrders: { $addToSet: "$_id" },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        productName: "$product.name",
        sku: "$product.sku",
        totalQuantity: 1,
        totalRevenue: 1,
        orderCount: { $size: "$totalOrders" },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);
};

orderSchema.statics.getFraudulentOrders = async function (threshold = 80) {
  return await this.find({
    fraudScore: { $gte: threshold },
    complianceStatus: { $in: ["pending", "flagged"] },
  })
    .populate("user", "firstName lastName email")
    .sort({ fraudScore: -1 })
    .lean();
};

orderSchema.statics.bulkRefundOrders = async function (orderIds, amount, reason = "Bulk refund") {
  return await this.updateMany(
    { order_id: { $in: orderIds }, payment_status: { $in: ["paid", "partial"] } },
    {
      $inc: { amount_paid: -amount, amount_due: amount },
      $push: {
        transactions: {
          transactionId: `REF-BULK-${Date.now()}`,
          amount: -amount,
          status: "refunded",
        },
        notes: `Bulk refund processed: ${amount} - ${reason}`,
      },
      $set: {
        payment_status: { $cond: [{ $eq: ["$amount_paid", amount] }, "refunded", "partially-refunded"] },
      },
    }
  );
};

orderSchema.statics.getPendingFulfillmentOrders = async function () {
  return await this.find({
    status: { $in: ["awaiting-fulfillment", "processing", "packaging", "quality-checked"] },
    priorityLevel: "high",
  })
    .sort({ createdAt: 1 })
    .lean();
};

// Error handling middleware
orderSchema.post("save", function (error, doc, next) {
  if (error.name === "MongoServerError" && error.code === 11000) {
    next(new Error("Order ID or Invoice already exists"));
  } else {
    next(error);
  }
});
// Additional Static Methods for Order model

orderSchema.statics.getAverageOrderValue = async function (startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["completed", "delivered"] },
      },
    },
    {
      $group: {
        _id: null,
        averageOrderValue: { $avg: "$total" },
      },
    },
  ]);
};

orderSchema.statics.searchOrdersByCustomerName = async function (name, limit = 20) {
  return await this.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $match: {
        $or: [
          { "user.firstName": { $regex: name, $options: "i" } },
          { "user.lastName": { $regex: name, $options: "i" } },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $project: {
        order_id: 1,
        total: 1,
        status: 1,
        "user.firstName": 1,
        "user.lastName": 1,
        createdAt: 1,
      },
    },
  ]);
};

orderSchema.statics.getOrdersByPaymentMethod = async function (paymentMethod, startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        payment_method: paymentMethod,
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["completed", "delivered"] },
      },
    },
    {
      $group: {
        _id: "$payment_method",
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$total" },
        averageOrderValue: { $avg: "$total" },
      },
    },
  ]);
};

orderSchema.statics.getDelayedOrders = async function (daysOverdue = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);
  return await this.find({
    createdAt: { $lte: cutoffDate },
    payment_status: { $ne: "paid" },
    status: { $nin: ["delivered", "canceled", "failed", "refunded"] },
  }).sort({ createdAt: 1 });
};

orderSchema.statics.getLoyaltyPointsSummary = async function (startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["completed", "delivered"] },
      },
    },
    {
      $group: {
        _id: null,
        totalPointsEarned: { $sum: "$loyaltyPointsEarned" },
        totalPointsRedeemed: { $sum: "$loyaltyPointsRedeemed" },
      },
    },
  ]);
};


const Order = mongoose.model("Order", orderSchema);

module.exports = Order;