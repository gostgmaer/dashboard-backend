const mongoose = require('mongoose');

const discountRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    in_use: { type: Boolean, default: false },

    // Strategy
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true, min: 0 },

    // Targeting
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    brandIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }],
    tags: [{ type: String, trim: true }],

    // Ranges (all optional)
    minStock: { type: Number, min: 0 },
    maxStock: { type: Number, min: 0 },
    minPrice: { type: Number, min: 0 },
    maxPrice: { type: Number, min: 0 },
    isDeleted: { type: Boolean, default: false },
    // Scheduling
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Engine controls
    priority: { type: Number, default: 100 }, // lower number = higher priority
    exclusive: { type: Boolean, default: false }, // if true, stop further stacking after this rule
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Helpful indexes
discountRuleSchema.index({ isActive: 1, startDate: 1, endDate: 1, priority: 1 });
discountRuleSchema.index({ productIds: 1 });
discountRuleSchema.index({ categoryIds: 1 });
discountRuleSchema.index({ brandIds: 1 });
discountRuleSchema.index({ tags: 1 });

module.exports = mongoose.model('DiscountRule', discountRuleSchema);
