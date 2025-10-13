const mongoose = require('mongoose');

const componentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['CPU', 'Motherboard', 'RAM', 'GPU', 'Storage', 'Power Supply', 'Case', 'Cooling', 'Monitor', 'Peripheral', 'Other'],
    },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    specifications: {
      type: mongoose.Schema.Types.Mixed, // Flexible field for component specifications
      default: {},
    },
    price: { type: Number, required: true },
    warrantyYears: { type: Number },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    marketplace: { type: String }, // E.g., Amazon, Newegg etc.
    images: [{ type: String }], // Array of image URLs
    description: { type: String },
    tags: [{ type: String }], // Tags for search or categorization
    compatibility: [{ type: String }], // Compatible components or platforms info
    releaseDate: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Optional: pre-save middleware to update updatedAt timestamp
componentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Component', componentSchema);
