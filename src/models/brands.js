const mongoose = require("mongoose");

// Brand Schema
const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive", "pending", "banned", "deleted", "archived", "draft"],
      default: "pending",
      trim: true,
    },
    images: [
      {
        url: { type: String, required: true },
        altText: { type: String, default: "" },
        name: { type: String, default: "" },
        _id: false, // Disable _id for subdocuments to reduce overhead
      },
    ],
    contact: {
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      website: { type: String, default: "" },
    },
    tagline: { type: String, default: "" },
    descriptions: { type: String, default: "" },
    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      keywords: { type: [String], default: [] },
    },
    establishedYear: { type: Number, default: null },
    parentCompany: { type: String, default: "" },
    country: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    socialMedia: {
      facebook: { type: String, default: "" },
      twitter: { type: String, default: "" },
      instagram: { type: String, default: "" },
      linkedin: { type: String, default: "" },
    },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    isFeatured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    totalProducts: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }, // Enable virtuals for JSON output
    toObject: { virtuals: true }, // Enable virtuals for object output
  }
);

// Indexes for performance
// brandSchema.index({ slug: 1 }); // Already unique, but explicit for clarity
brandSchema.index({ name: "text", descriptions: "text" }); // Text index for search on name and descriptions
brandSchema.index({ status: 1, isActive: 1, displayOrder: 1 }); // Compound index for common queries
brandSchema.index({ country: 1 }); // Index for country-based queries
brandSchema.index({ isFeatured: 1, status: 1 }); // Index for featured brand queries
brandSchema.index({ rating: -1 }); // Index for sorting by rating

// Middleware: Ensure slug is lowercase and trimmed
brandSchema.pre("save", function (next) {
  if (this.isModified("slug")) {
    this.slug = this.slug.toLowerCase().trim();
  }
  next();
});

// Middleware: Update updatedAt timestamp on update
brandSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Middleware: Prevent deletion of brands with products
brandSchema.pre("deleteOne", { document: true, query: false }, async function (next) {
  const Product = mongoose.model("Product");
  const productCount = await Product.countDocuments({ brandName: this._id });
  if (productCount > 0) {
    return next(new Error("Cannot delete brand with associated products"));
  }
  next();
});

// Middleware: Log changes to an audit collection
brandSchema.post("save", async function (doc, next) {
  const AuditLog = mongoose.model("AuditLog", new mongoose.Schema({
    entity: String,
    entityId: mongoose.Schema.Types.ObjectId,
    action: String,
    performedBy: mongoose.Schema.Types.ObjectId,
    changes: Object,
    createdAt: { type: Date, default: Date.now }
  }));
  await AuditLog.create({
    entity: "Brand",
    entityId: doc._id,
    action: doc.isNew ? "create" : "update",
    performedBy: doc.updatedBy || doc.createdBy,
    changes: doc.toObject(),
  });
  next();
});

// Virtual: Get full brand URL
brandSchema.virtual("brandUrl").get(function () {
  return `/brands/${this.slug}`;
});

// Virtual: Get primary image URL
brandSchema.virtual("primaryImage").get(function () {
  return this.images && this.images.length > 0 ? this.images[0].url : "";
});

// Instance Methods

// Get product count for this brand
brandSchema.methods.getProductCount = async function (status = "publish") {
  const Product = mongoose.model("Product");
  return Product.countDocuments({ brandName: this._id, status });
};

// Get simplified image list
brandSchema.methods.getSimplifiedImages = function () {
  if (this.images && Array.isArray(this.images)) {
    return this.images.map((image) => ({
      url: image.url,
      altText: image.altText,
      name: image.name,
    }));
  }
  return [];
};

// Check if brand is featured
brandSchema.methods.isBrandFeatured = function () {
  return this.isFeatured === true;
};

// Update brand rating (average)
brandSchema.methods.updateRating = async function (newRating) {
  this.rating = Math.max(0, Math.min(5, newRating)); // Ensure rating stays within 0-5
  return this.save();
};

// Check if brand is active and published
brandSchema.methods.isActiveAndPublished = function () {
  return this.status === "active" && this.isActive === true;
};

// Get full SEO metadata object
brandSchema.methods.getSEOData = function () {
  return {
    title: this.seo.metaTitle || this.name,
    description: this.seo.metaDescription || this.descriptions,
    keywords: this.seo.keywords || [],
  };
};

// Update contact details
brandSchema.methods.updateContact = async function (contact) {
  this.contact = { ...this.contact, ...contact };
  return this.save();
};

// Add image to brand
brandSchema.methods.addImage = async function (image) {
  this.images.push(image);
  return this.save();
};

// Remove image by URL
brandSchema.methods.removeImageByUrl = async function (url) {
  this.images = this.images.filter((img) => img.url !== url);
  return this.save();
};

// Increment product count
brandSchema.methods.incrementProductCount = async function () {
  this.totalProducts += 1;
  return this.save();
};

// Decrement product count
brandSchema.methods.decrementProductCount = async function () {
  this.totalProducts = Math.max(0, this.totalProducts - 1);
  return this.save();
};

// Get related brands (same country or parent company)
brandSchema.methods.getRelatedBrands = async function (limit = 5) {
  return this.model("Brand").find({
    $or: [
      { country: this.country, _id: { $ne: this._id } },
      { parentCompany: this.parentCompany, _id: { $ne: this._id } },
    ],
    status: "active",
    isActive: true,
  }).limit(limit);
};

// Static Methods

// Get all active brands
brandSchema.statics.getActiveBrands = function () {
  return this.find({ status: "active", isActive: true }).sort({ displayOrder: 1, name: 1 });
};

// Get featured brands
brandSchema.statics.getFeaturedBrands = function () {
  return this.find({ isFeatured: true, status: "active", isActive: true }).sort({ displayOrder: 1 });
};

// Search brands by keyword
brandSchema.statics.searchBrands = function (keyword) {
  return this.find({
    $or: [
      { name: { $regex: keyword, $options: "i" } },
      { descriptions: { $regex: keyword, $options: "i" } },
      { "seo.keywords": { $regex: keyword, $options: "i" } },
    ],
  }).sort({ name: 1 });
};

// Bulk update status
brandSchema.statics.bulkUpdateStatus = function (ids, status) {
  return this.updateMany(
    { _id: { $in: ids } },
    { $set: { status, updatedAt: new Date() } },
    { runValidators: true }
  );
};

// Update product count cache for all brands
brandSchema.statics.refreshProductCounts = async function () {
  const Product = mongoose.model("Product");
  const brands = await this.find({});
  for (let brand of brands) {
    const count = await Product.countDocuments({ brandName: brand._id });
    brand.totalProducts = count;
    await brand.save();
  }
  return true;
};

// Get brands by country
brandSchema.statics.getBrandsByCountry = function (country) {
  return this.find({ country: { $regex: `^${country}$`, $options: "i" } }).sort({ name: 1 });
};

// Get top-rated brands
brandSchema.statics.getTopRatedBrands = function (limit = 10) {
  return this.find({ isActive: true })
    .sort({ rating: -1, name: 1 })
    .limit(limit);
};

// Paginated brand list with filters
brandSchema.statics.getPaginatedBrands = async function ({ page = 1, limit = 10, status, search, sortBy = "name", sortOrder = 1 }) {
  const query = {};
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { descriptions: { $regex: search, $options: "i" } },
      { "seo.keywords": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder };

  const [items, total] = await Promise.all([
    this.find(query).sort(sort).skip(skip).limit(limit),
    this.countDocuments(query),
  ]);

  return {
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
  };
};

// Bulk feature/unfeature brands
brandSchema.statics.bulkFeatureToggle = function (ids, isFeatured) {
  return this.updateMany(
    { _id: { $in: ids } },
    { $set: { isFeatured, updatedAt: new Date() } },
    { runValidators: true }
  );
};

// Soft delete brands (mark inactive instead of removing)
brandSchema.statics.softDeleteBrands = function (ids) {
  return this.updateMany(
    { _id: { $in: ids } },
    { $set: { isActive: false, status: "inactive", updatedAt: new Date() } },
    { runValidators: true }
  );
};

// Restore soft-deleted brands
brandSchema.statics.restoreBrands = function (ids) {
  return this.updateMany(
    { _id: { $in: ids } },
    { $set: { isActive: true, status: "active", updatedAt: new Date() } },
    { runValidators: true }
  );
};

// Get brands by established year range
brandSchema.statics.getBrandsByYearRange = function (startYear, endYear) {
  return this.find({
    establishedYear: { $gte: startYear, $lte: endYear },
    isActive: true,
    status: "active",
  }).sort({ establishedYear: 1, name: 1 });
};

// Get brands with social media presence
brandSchema.statics.getBrandsWithSocialMedia = function () {
  return this.find({
    $or: [
      { "socialMedia.facebook": { $ne: "" } },
      { "socialMedia.twitter": { $ne: "" } },
      { "socialMedia.instagram": { $ne: "" } },
      { "socialMedia.linkedin": { $ne: "" } },
    ],
    isActive: true,
    status: "active",
  }).sort({ name: 1 });
};

// Update display order for multiple brands
brandSchema.statics.updateDisplayOrder = function (orderMap) {
  const bulkOps = Object.entries(orderMap).map(([id, displayOrder]) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { displayOrder, updatedAt: new Date() } },
    },
  }));
  return this.bulkWrite(bulkOps);
};

// Cache brand data (e.g., for Redis integration)
// brandSchema.statics.cacheBrandData = async function (brandId, cacheClient) {
//   const brand = await this.findById(brandId).lean();
//   if (brand && cacheClient) {
//     await cacheClient.set(`brand:${brandId}`, JSON.stringify(brand), { EX: 3600 }); // Cache for 1 hour
//   }
//   return brand;
// };

// // Invalidate cache (e.g., for Redis integration)
// brandSchema.statics.invalidateCache = async function (brandId, cacheClient) {
//   if (cacheClient) {
//     await cacheClient.del(`brand:${brandId}`);
//   }
// };

// Export the model
const Brand = mongoose.model("Brand", brandSchema);
module.exports = Brand;