const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },

  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true, min: 0 },

  // Targeting
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  brandIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }],
  tags: [{ type: String, trim: true }],
 isDeleted: { type: Boolean, default: false},
  // Order-level constraints
  minOrderValue: { type: Number, min: 0 },
  customerLimit: { type: Number, min: 0 }, // per-customer max uses (optional)
  globalUsageLimit: { type: Number, min: 0 },
  usedCount: { type: Number, default: 0 },

  // Scheduling
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  // Controls
  isActive: { type: Boolean, default: true },
  exclusive: { type: Boolean, default: false } // if true, no stacking with rules
}, { timestamps: true });

// promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('PromoCode', promoCodeSchema);