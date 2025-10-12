// models/AppliedDiscount.js
const mongoose = require('mongoose');

const appliedDiscountSchema = new mongoose.Schema({
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscountRule', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  appliedAt: { type: Date, default: Date.now },
  removedAt: { type: Date },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('AppliedDiscount', appliedDiscountSchema);
