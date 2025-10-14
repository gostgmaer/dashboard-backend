const mongoose = require('mongoose');

const componentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['CPU', 'Motherboard', 'RAM', 'GPU', 'Storage', 'Power Supply', 'Case', 'Cooling', 'Monitor', 'Peripheral', 'Other'],
    },
    brand: { type: String, required: true },
    model: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    specifications: {
      type: mongoose.Schema.Types.Mixed, // Flexible field for component specifications
      default: {},  
    },
    price: {
      type: mongoose.Schema.Types.Mixed, // Flexible field for component specifications
      default: {},
    },
    warrantyYears: { type: Number },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    marketplace: {
      type: mongoose.Schema.Types.Mixed, // Flexible field for component specifications
      default: {},
    }, // E.g., Amazon, Newegg etc.
    images: [{ type: String }], // Array of image URLs
    description: { type: String },
    tags: [{ type: String }], // Tags for search or categorization
    compatibility: {
      type: mongoose.Schema.Types.Mixed, // Flexible field for component specifications
      default: {},
    }, // Compatible components or platforms info
    releaseDate: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Place these inside your schema definition, before model export
componentSchema.statics.createComponent = async function (data) {
  return await this.create(data);
};

componentSchema.statics.getComponents = async function (query = {}) {
  const { type, brand, model, page = 1, limit = 20, search } = query;
  const filter = {};

  if (type) filter.type = type;
  if (brand) filter.brand = brand;
  if (model) filter.model = model;
  if (search) {
    filter.$or = [{ model: { $regex: search, $options: 'i' } }, { brand: { $regex: search, $options: 'i' } }, { tags: { $regex: search, $options: 'i' } }];
  }

  return await this.find(filter)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });
};

componentSchema.statics.getComponentById = async function (id) {
  return await this.findById(id);
};

componentSchema.statics.updateComponent = async function (id, data) {
  return await this.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
};

componentSchema.statics.deleteComponent = async function (id) {
  return await this.findByIdAndDelete(id);
};

componentSchema.statics.getComponentsByType = async function (type) {
  return await this.find({ type });
};

componentSchema.statics.getRecentlyAdded = async function (days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return await this.find({ createdAt: { $gte: since } });
};

componentSchema.statics.brandStats = async function () {
  return await this.aggregate([{ $group: { _id: '$brand', count: { $sum: 1 } } }, { $sort: { count: -1 } }]);
};

componentSchema.statics.getTopPriced = async function (limit = 10) {
  return await this.find().sort({ price: -1 }).limit(Number(limit));
};

componentSchema.statics.getLowestPriced = async function (limit = 10) {
  return await this.find().sort({ price: 1 }).limit(Number(limit));
};

module.exports = mongoose.model('Component', componentSchema);
