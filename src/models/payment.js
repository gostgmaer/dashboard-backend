const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: { type: Number, required: true },
  price: { type: Number },   // 🔹 added to lock product price at time of order
  discount: { type: Number, default: 0 } // 🔹 per product discount
});

const addressSchema = new mongoose.Schema({
  address: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address',
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },

  customerName: { type: String, required: true },
  email: { type: String, required: true },

  products: [productSchema],

  subTotal: { type: Number, required: true },
  total: { type: Number, required: true },
  paymentMethod: { type: String, required: true },

  billingAddress: addressSchema,
  shippingAddress: addressSchema,

  // 🔹 New fields
  status: {
    type: String,
    enum: ["pending", "processing", "shipped", "delivered", "canceled", "returned"],
    default: "pending"
  },
  paymentStatus: {
    type: String,
    enum: ["unpaid", "paid", "failed", "refunded"],
    default: "unpaid"
  },
  transactionId: { type: String }, // store gateway transaction ID
  trackingNumber: { type: String }, // shipping tracking
  carrier: { type: String },        // courier name
  notes: [String],                  // admin or customer notes

  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  orderDate: { type: Date, default: Date.now }
}, { timestamps: true });

/* 🔹 Instance Methods */

// Recalculate totals
orderSchema.methods.calculateTotals = function () {
  const subtotal = this.products.reduce(
    (acc, item) => acc + ((item.price || 0) * item.quantity - (item.discount || 0)),
    0
  );
  this.subTotal = subtotal;
  this.total = subtotal; // keeping same structure (no shipping/tax yet)
  return this.total;
};

// Mark as paid
orderSchema.methods.markAsPaid = function (transactionId) {
  this.paymentStatus = "paid";
  this.transactionId = transactionId || this.transactionId;
};

// Update status safely
orderSchema.methods.updateStatus = function (newStatus) {
  const validStatuses = this.schema.path("status").enumValues;
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  this.status = newStatus;
  this.notes.push(`Status updated to: ${newStatus}`);
};

// Add tracking info
orderSchema.methods.addTracking = function (carrier, trackingNumber) {
  this.carrier = carrier;
  this.trackingNumber = trackingNumber;
  this.status = "shipped";
  this.notes.push(`Tracking added: ${carrier} - ${trackingNumber}`);
};

// Get customer summary
orderSchema.methods.getSummary = function () {
  return {
    id: this._id,
    customer: this.customerName,
    email: this.email,
    status: this.status,
    total: this.total,
    created: this.orderDate
  };
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
