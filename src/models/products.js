const mongoose = require('mongoose');


const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  title: { type: String },  // e.g., 'Red, Size M'
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  images: [{ url: String, alt: String }],
  inventory: { type: Number, default: 0 },
  attributes: { type: Map, of: String } // e.g., color: 'red', size: 'M'
});



const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    productType: { type: String, enum: ['physical', 'digital', 'service'] },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subcategory: { type: String },
    vendor: { type: String },
    manufacturer: { type: String },
    model: { type: String },
    descriptions: { type: Object, required: true },
    shortDescription: { type: String },
    material: { type: String },
    color: { type: String },
    size: { type: String },
    ageGroup: { type: String },
    gender: { type: String },
    season: { type: String },
    occasion: { type: String },
    style: { type: String },
    pattern: { type: String },
    careInstructions: { type: String },
    ingredients: { type: String },
    nutritionalInfo: { type: String },
    allergens: { type: [String] },
    certifications: { type: [String] },
    awards: { type: [String] },
    reviews: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
      averageRating: { type: Number, min: 0, max: 5 },
      totalReviews: { type: Number, min: 0 }
    },
    socialMedia: {
      hashtags: { type: [String] },
      instagramHandle: { type: String },
      twitterHandle: { type: String }
    },
    analytics: {
      views: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      conversions: { type: Number, min: 0, default: 0 }
    },
    tags: { type: [String] },
    basePrice: { type: Number, min: 0, required: true },
    comparePrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },
    wholesalePrice: { type: Number, min: 0 },
    msrp: { type: Number, min: 0 },
    taxClass: { type: String },
    taxRate: { type: Number, min: 0 },
    discountType: { type: String, enum: ['none', 'percentage', 'fixed'] },
    discountValue: { type: Number, min: 0 },
    discount: { type: Number },
    retailPrice: { type: Number },
    salePrice: { type: Number },
    loyaltyPoints: { type: Number, min: 0 },
    barcode: { type: String },
    inventory: { type: Number, min: 0 },
    trackInventory: { type: String, enum: ['yes', 'no', ''], default: 'yes' },
    allowBackorder: { type: Boolean, default: false },
    lowStockThreshold: { type: Number, min: 0 },
    maxOrderQuantity: { type: Number, min: 1 },
    minOrderQuantity: { type: Number, min: 1 },
    stockLocation: { type: String },
    supplier: { type: String },
    supplierSku: { type: String },
    leadTime: { type: Number, min: 0 },
    restockDate: { type: String },
    weight: { type: Number, min: 0 },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 }
    },
    packageDimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      weight: { type: Number, min: 0 }
    },
    shipping: {
      requiresShipping: { type: Boolean, default: true },
      shippingClass: { type: String },
      handlingTime: { type: Number, min: 0 },
      freeShippingThreshold: { type: Number, min: 0 },
      shippingRestrictions: { type: [String] },
      hazardousMaterial: { type: Boolean, default: false },
      fragile: { type: Boolean, default: false }
    },
    seo_info: {
      title: { type: String },
      description: { type: String },
      keywords: { type: String },
      slug: { type: String },
      canonicalUrl: { type: String },
      robotsMeta: { type: String },
      structuredData: { type: String }
    },
    visibility: { type: String, enum: ['public', 'private', 'password'] },
    password: { type: String },
    publishDate: { type: String },
    expiryDate: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['active', 'inactive', 'draft', 'pending', 'archived', 'published']
    },
    isFeatured: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },
    bestseller: { type: Boolean, default: false },
    onSale: { type: Boolean, default: false },
    limitedEdition: { type: Boolean, default: false },
    preOrder: { type: Boolean, default: false },
    backorder: { type: Boolean, default: false },
    discontinued: { type: Boolean, default: false },
    crossSells: [{ type: String }],
    upSells: [{ type: String }],
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    bundles: [{ type: String }],
    accessories: [{ type: String }],
    replacementParts: [{ type: String }],
    customAttributes: { type: Map, of: String },
    variants: [variantSchema],
    mainImage: { type: String },
    images: { type: [Object] },
    downloadableFiles: [
      {
        name: { type: String },
        url: { type: String },
        fileSize: { type: String }
      }
    ],
    videoLinks: { type: [String] },
    threeDModelUrl: { type: String },
    virtualTryOnEnabled: { type: Boolean, default: false },
    augmentedRealityEnabled: { type: Boolean, default: false },
    manufacturerPartNumber: { type: String },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
    overview: { type: String },
    total_view: { type: Number, default: 0 },
    productUPCEAN: { type: String },
    features: { type: [String] },
    specifications: { type: Map, of: String },
    isAvailable: { type: Boolean, default: true },
    metaTitle: { type: String },
    metaDescription: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    returnPolicy: { type: String },
    warranty: { type: String },
    shippingDetails: { type: String },
    additionalImages: { type: [String] },
    availability: { type: String, default: 'In Stock' },
    ecoFriendly: { type: Boolean, default: false },
    ageRestriction: { type: String },
    shippingWeight: { type: Number },
    discountStartDate: { type: Date },
    discountEndDate: { type: Date },
    isGiftCard: { type: Boolean, default: false },
    giftCardValue: { type: Number },
    productBundle: { type: Boolean, default: false },
    bundleContents: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: { type: Number, default: 1 }
      }
    ],
    purchaseLimit: { type: Number },
    bulkDiscounts: [{ quantity: { type: Number }, discountAmount: { type: Number } }],
    giftWrappingAvailable: { type: Boolean, default: false },
    preOrderDate: { type: Date },
    isSubscription: { type: Boolean, default: false },
    subscriptionDetails: { type: String },
    productOrigin: { type: String },
    returnPeriod: { type: Number },
    customShippingOptions: { type: Map, of: String },
    virtualProduct: { type: Boolean, default: false },
    digitalDownloadLink: { type: String },
    views: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    lastRestocked: { type: Date }
  },
  { timestamps: true }
);

// 🔍 Full-text search
productSchema.index({ "$**": "text" });
// productSchema.index({ sku: 1 }, { unique: true });
// productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ status: 1 });
productSchema.index({ categories: 1 });
productSchema.index({ isFeatured: 1, status: 1 });

// 🔹 Virtual rating stats
productSchema.virtual('ratingStatistics').get(function () {
  if (this.reviews && this.reviews.length > 0) {
    const totalReviews = this.reviews.length;
    const totalRating = this.reviews.reduce((total, review) => total + (review.rating || 0), 0);
    return {
      totalReviews,
      averageRating: totalRating / totalReviews
    };
  } else {
    return { totalReviews: 0, averageRating: 0 };
  }
});

/* 🔹 Instance Methods */

// Get simplified images
productSchema.methods.getSimplifiedImages = function () {
  return this.images.map((image) => ({ url: image.url, name: image.name }));
};

// Calculate final price with discount
productSchema.methods.calculateFinalPrice = function () {
  let finalPrice = this.price;
  if (this.discount) {
    finalPrice = this.price - (this.discount / 100) * this.price;
  }
  if (this.salePrice) {
    finalPrice = Math.min(finalPrice, this.salePrice);
  }
  return finalPrice;
};

// Check if stock is low
productSchema.methods.isLowStock = function () {
  return this.currentStockLevel <= this.lowStockLevel;
};

// Mark product as out of stock
productSchema.methods.markAsOutOfStock = function () {
  this.isAvailable = false;
  this.availability = 'Out of Stock';
};

// Increment views
productSchema.methods.incrementViews = function () {
  this.views += 1;
};

// Increment sold count
productSchema.methods.incrementSold = function (quantity = 1) {
  this.soldCount += quantity;
  this.stock -= quantity;
};

// Check if discount is active
productSchema.methods.isDiscountActive = function () {
  const now = new Date();
  return (
    this.discount &&
    this.discountStartDate &&
    this.discountEndDate &&
    now >= this.discountStartDate &&
    now <= this.discountEndDate
  );
};

// Get SEO data
productSchema.methods.getSEOData = function () {
  return {
    title: this.metaTitle || this.title,
    description: this.metaDescription || this.shortDescription,
    tags: this.tags
  };
};
/* =========================
   📌 Instance Methods
   ========================= */

// Apply bulk discount based on quantity
productSchema.methods.getBulkDiscountPrice = function (quantity) {
  if (!this.bulkDiscounts || this.bulkDiscounts.length === 0) return this.calculateFinalPrice();
  const applicable = this.bulkDiscounts
    .filter(d => quantity >= d.quantity)
    .sort((a, b) => b.quantity - a.quantity)[0];
  if (applicable) {
    return this.price - applicable.discountAmount;
  }
  return this.calculateFinalPrice();
};

// Check if product is available for purchase
productSchema.methods.isPurchasable = function () {
  return this.isAvailable && (!this.purchaseLimit || this.stock > 0);
};

// Reduce stock after purchase
productSchema.methods.reduceStock = async function (quantity) {
  if (this.trackInventory === 'yes') {
    this.stock = Math.max(0, this.stock - quantity);
    this.currentStockLevel = this.stock;
    if (this.isLowStock()) {
      this.availability = 'Low Stock';
    }
    if (this.stock === 0) {
      this.markAsOutOfStock();
    }
    await this.save();
  }
  return this;
};

// Restock product
productSchema.methods.restock = async function (quantity) {
  this.stock += quantity;
  this.currentStockLevel = this.stock;
  this.lastRestocked = new Date();
  if (this.stock > 0) {
    this.isAvailable = true;
    this.availability = 'In Stock';
  }
  await this.save();
  return this;
};

// Toggle featured status
productSchema.methods.toggleFeatured = async function () {
  this.isFeatured = !this.isFeatured;
  await this.save();
  return this.isFeatured;
};

// Get related products (populated)
productSchema.methods.getRelatedProducts = function () {
  return Product.find({ _id: { $in: this.relatedProducts } });
};

// Check if product is part of a bundle
productSchema.methods.isPartOfBundle = function () {
  return this.productBundle && this.bundleContents && this.bundleContents.length > 0;
};

// Get active discount percentage
productSchema.methods.getActiveDiscountPercent = function () {
  if (this.isDiscountActive()) {
    return this.discount;
  }
  return 0;
};

/* =========================
   📌 Static Methods
   ========================= */

// Search products by keyword
productSchema.statics.searchProducts = function (keyword, limit = 20) {
  return this.find({ $text: { $search: keyword } }).limit(limit);
};

// Get featured products
productSchema.statics.getFeaturedProducts = function (limit = 10) {
  return this.find({ isFeatured: true, status: 'active' }).limit(limit);
};

// Get low stock products
productSchema.statics.getLowStockProducts = function () {
  return this.find({ $expr: { $lte: ["$currentStockLevel", "$lowStockLevel"] } });
};

// Get out of stock products
productSchema.statics.getOutOfStockProducts = function () {
  return this.find({ isAvailable: false });
};

// Bulk update status
productSchema.statics.bulkUpdateStatus = function (ids, status) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { status } });
};

// Bulk delete products
productSchema.statics.bulkDelete = function (ids) {
  return this.deleteMany({ _id: { $in: ids } });
};

// Get products by category
productSchema.statics.getByCategory = function (categoryId) {
  return this.find({ categories: categoryId, status: 'active' });
};

// Get top selling products
productSchema.statics.getTopSelling = function (limit = 10) {
  return this.find({}).sort({ soldCount: -1 }).limit(limit);
};

// Get most viewed products
productSchema.statics.getMostViewed = function (limit = 10) {
  return this.find({}).sort({ views: -1 }).limit(limit);
};





// Paginated product list with filters
productSchema.statics.getPaginatedProducts = async function ({
  page = 1,
  limit = 20,
  filters = {},
  sort = { createdAt: -1 }
}) {
  const skip = (page - 1) * limit;
  const query = { ...filters, deletedAt: { $exists: false } }; // Added deletedAt filter
  const [results, total] = await Promise.all([
    this.find(query).sort(sort).skip(skip).limit(limit),
    this.countDocuments(query)
  ]);
  return { results, total, page, pages: Math.ceil(total / limit) };
};

// Update stock in bulk
productSchema.statics.bulkUpdateStock = function (updates) {
  const bulkOps = updates.map(u => ({
    updateOne: {
      filter: { _id: u.id },
      update: { $set: { stock: u.stock, currentStockLevel: u.stock } }
    }
  }));
  return this.bulkWrite(bulkOps);
};

// Get products with active discounts
productSchema.statics.getActiveDiscountProducts = function () {
  const now = new Date();
  return this.find({
    discount: { $gt: 0 },
    discountStartDate: { $lte: now },
    discountEndDate: { $gte: now }
  });
};
productSchema.methods.getStockStatus = function () {
  if (!this.isAvailable) return 'Out of Stock';
  if (this.backorder) return 'Backorder Available';
  if (this.isLowStock()) return 'Low Stock';
  return 'In Stock';
};

productSchema.methods.addReview = async function (reviewId) {
  if (!this.reviews.includes(reviewId)) {
    this.reviews.push(reviewId);
    await this.save();
  }
  return this;
};

productSchema.methods.applyPromotion = async function ({ discount, salePrice, startDate, endDate }) {
  if (discount) this.discount = discount;
  if (salePrice) this.salePrice = salePrice;
  if (startDate) this.discountStartDate = startDate;
  if (endDate) this.discountEndDate = endDate;
  await this.save();
  return this;
};

productSchema.methods.isPreOrderAvailable = function () {
  return this.preOrder && (!this.preOrderDate || new Date() <= this.preOrderDate);
};
productSchema.methods.getBundleTotalPrice = async function () {
  if (!this.isPartOfBundle()) return this.calculateFinalPrice();
  const products = await Product.find({
    _id: { $in: this.bundleContents.map(c => c.product) }
  });
  return products.reduce((total, p, i) => {
    const qty = this.bundleContents[i].quantity;
    return total + p.calculateFinalPrice() * qty;
  }, 0);
};

productSchema.statics.getProductsByTag = function (tags, limit = 20) {
  return this.find({ tags: { $in: Array.isArray(tags) ? tags : [tags] }, status: 'active' }).limit(limit);
};
productSchema.statics.getNewArrivals = function (days = 30, limit = 10) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return this.find({ createdAt: { $gte: date }, status: 'active' }).sort({ createdAt: -1 }).limit(limit);
};
productSchema.statics.getProductsByPriceRange = function (minPrice, maxPrice, limit = 20) {
  return this.find({
    price: { $gte: minPrice, $lte: maxPrice },
    status: 'active'
  }).limit(limit);
};
productSchema.statics.archiveOldProducts = function (beforeDate) {
  return this.updateMany(
    { createdAt: { $lt: beforeDate }, status: { $ne: 'archived' } },
    { $set: { status: 'archived' } }
  );
};
productSchema.statics.getAverageRatingByCategory = async function (categoryId) {
  const products = await this.find({ categories: categoryId }).populate('reviews');
  const ratings = products.map(p => p.ratingStatistics.averageRating).filter(r => r > 0);
  return ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
};

productSchema.methods.getFinalPrice = function (quantity = 1) {
  let finalPrice = this.price;
  if (this.isDiscountActive()) {
    finalPrice = this.price - (this.discount / 100) * this.price;
  }
  if (this.salePrice) {
    finalPrice = Math.min(finalPrice, this.salePrice);
  }
  if (this.bulkDiscounts && this.bulkDiscounts.length > 0) {
    const applicable = this.bulkDiscounts
      .filter(d => quantity >= d.quantity)
      .sort((a, b) => b.quantity - a.quantity)[0];
    if (applicable) {
      finalPrice = this.price - applicable.discountAmount;
    }
  }
  return Math.max(0, finalPrice);
};

productSchema.methods.reduceStock = async function (quantity) {
  try {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (this.trackInventory === 'yes') {
      this.stock = Math.max(0, this.stock - quantity);
      this.currentStockLevel = this.stock;
      if (this.isLowStock()) {
        this.availability = 'Low Stock';
      }
      if (this.stock === 0) {
        this.markAsOutOfStock();
      }
      await this.save();
    }
    return this;
  } catch (error) {
    throw new Error(`Failed to reduce stock: ${error.message}`);
  }
};

productSchema.virtual('stockStatus').get(function () {
  if (!this.isAvailable) return 'Out of Stock';
  if (this.backorder) return 'Backorder Available';
  if (this.isLowStock()) return 'Low Stock';
  return 'In Stock';
});
productSchema.add({ deletedAt: { type: Date } });
productSchema.statics.bulkDelete = function (ids) {
  return this.updateMany(
    { _id: { $in: ids }, deletedAt: { $exists: false } },
    { $set: { deletedAt: new Date(), status: 'archived' } }
  );
};

productSchema.pre('save', function (next) {
  if (this.isModified('price') || this.isModified('stock') || this.isModified('status')) {
    console.log(`Product ${this._id} updated:`, {
      price: this.price,
      stock: this.stock,
      status: this.status,
      updatedBy: this.updatedBy
    });
  }
  next();
});

productSchema.statics.generateSchemaReport = function () {
  const schemaFields = Object.entries(this.schema.paths).map(([path, field]) => ({
    name: path,
    type: field.instance,
    required: field.isRequired || false,
    default: field.defaultValue || null,
    enum: field.enumValues || null,
    ref: field.options.ref || null,
    min: field.options.min || null,
    unique: field.options.unique || false
  }));

  const instanceMethods = Object.keys(this.schema.methods);
  const staticMethods = Object.keys(this.schema.statics);
  const virtuals = Object.keys(this.schema.virtuals);
  const indexes = this.schema.indexes().map(index => ({
    fields: Object.keys(index[0]),
    options: index[1]
  }));

  return {
    modelName: 'Product',
    totalFields: schemaFields.length,
    fields: schemaFields,
    totalInstanceMethods: instanceMethods.length,
    instanceMethods,
    totalStaticMethods: staticMethods.length,
    staticMethods,
    totalVirtuals: virtuals.length,
    virtuals,
    totalIndexes: indexes.length,
    indexes,
    timestamps: this.schema.options.timestamps || false,
    middleware: {
      preSave: !!this.schema.pre('save')
    }
  };
};

productSchema.statics.generateDatabaseStatistics = async function () {
  const [
    totalProducts,
    statusCounts,
    productTypeCounts,
    availabilityCounts,
    priceStats,
    stockStats,
    discountStats,
    reviewStats,
    categoryStats,
    tagStats,
    bundleStats,
    featuredStats,
    ecoFriendlyStats,
    giftCardStats,
    preOrderStats,
    subscriptionStats
  ] = await Promise.all([
    this.countDocuments({ deletedAt: { $exists: false } }),
    this.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $group: { _id: '$productType', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $group: { _id: '$availability', count: { $sum: 1 } } }
    ]),
    this.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      {
        $group: {
          _id: null,
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          totalPrice: { $sum: '$price' }
        }
      }
    ]),
    this.aggregate([
      { $match: { deletedAt: { $exists: false }, trackInventory: 'yes' } },
      {
        $group: {
          _id: null,
          totalStock: { $sum: '$stock' },
          avgStock: { $avg: '$stock' },
          minStock: { $min: '$stock' },
          maxStock: { $max: '$stock' },
          lowStockCount: { $sum: { $cond: [{ $lte: ['$currentStockLevel', '$lowStockLevel'] }, 1, 0] } },
          outOfStockCount: { $sum: { $cond: [{ $eq: ['$isAvailable', false] }, 1, 0] } }
        }
      }
    ]),
    this.aggregate([
      { $match: { deletedAt: { $exists: false }, discount: { $gt: 0 }, discountStartDate: { $lte: new Date() }, discountEndDate: { $gte: new Date() } } },
      {
        $group: {
          _id: null,
          discountedProducts: { $sum: 1 },
          avgDiscount: { $avg: '$discount' },
          maxDiscount: { $max: '$discount' },
          totalDiscountedValue: { $sum: { $multiply: ['$price', '$discount', 0.01] } }
        }
      }
    ]),
    this.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $lookup: { from: 'reviews', localField: 'reviews', foreignField: '_id', as: 'reviewsData' } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: { $size: '$reviewsData' } },
          avgRating: { $avg: { $avg: '$reviewsData.rating' } }
        }
      }
    ]),
    this.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'categoryData' } },
      { $project: { _id: 0, categoryId: '$_id', categoryName: { $arrayElemAt: ['$categoryData.name', 0] }, count: 1 } }
    ]),
    this.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } }
    ]),
    this.countDocuments({ productBundle: true, deletedAt: { $exists: false } }),
    this.countDocuments({ isFeatured: true, deletedAt: { $exists: false } }),
    this.countDocuments({ ecoFriendly: true, deletedAt: { $exists: false } }),
    this.countDocuments({ isGiftCard: true, deletedAt: { $exists: false } }),
    this.countDocuments({ preOrder: true, deletedAt: { $exists: false } }),
    this.countDocuments({ isSubscription: true, deletedAt: { $exists: false } })
  ]);

  return {
    totalProducts,
    statusDistribution: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    productTypeDistribution: productTypeCounts.reduce((acc, t) => ({ ...acc, [t._id]: t.count }), {}),
    availabilityDistribution: availabilityCounts.reduce((acc, a) => ({ ...acc, [a._id]: a.count }), {}),
    priceStatistics: priceStats[0] ? {
      averagePrice: priceStats[0].avgPrice,
      minPrice: priceStats[0].minPrice,
      maxPrice: priceStats[0].maxPrice,
      totalPrice: priceStats[0].totalPrice
    } : { averagePrice: 0, minPrice: 0, maxPrice: 0, totalPrice: 0 },
    stockStatistics: stockStats[0] ? {
      totalStock: stockStats[0].totalStock,
      averageStock: stockStats[0].avgStock,
      minStock: stockStats[0].minStock,
      maxStock: stockStats[0].maxStock,
      lowStockCount: stockStats[0].lowStockCount,
      outOfStockCount: stockStats[0].outOfStockCount
    } : { totalStock: 0, averageStock: 0, minStock: 0, maxStock: 0, lowStockCount: 0, outOfStockCount: 0 },
    discountStatistics: discountStats[0] ? {
      discountedProducts: discountStats[0].discountedProducts,
      averageDiscount: discountStats[0].avgDiscount,
      maxDiscount: discountStats[0].maxDiscount,
      totalDiscountedValue: discountStats[0].totalDiscountedValue
    } : { discountedProducts: 0, averageDiscount: 0, maxDiscount: 0, totalDiscountedValue: 0 },
    reviewStatistics: reviewStats[0] ? {
      totalReviews: reviewStats[0].totalReviews,
      averageRating: reviewStats[0].avgRating || 0
    } : { totalReviews: 0, averageRating: 0 },
    categoryDistribution: categoryStats,
    tagDistribution: tagStats.reduce((acc, t) => ({ ...acc, [t._id]: t.count }), {}),
    bundleStatistics: { bundleProducts: bundleStats },
    featuredStatistics: { featuredProducts: featuredStats },
    ecoFriendlyStatistics: { ecoFriendlyProducts: ecoFriendlyStats },
    giftCardStatistics: { giftCardProducts: giftCardStats },
    preOrderStatistics: { preOrderProducts: preOrderStats },
    subscriptionStatistics: { subscriptionProducts: subscriptionStats }
  };
};

// Audit Logging
productSchema.pre('save', function (next) {
  if (this.isModified('price') || this.isModified('stock') || this.isModified('status')) {
    console.log(`Product ${this._id} updated:`, {
      price: this.price,
      stock: this.stock,
      status: this.status,
      updatedBy: this.updatedBy
    });
  }
  next();
});


// Update average rating after reviews
productSchema.methods.updateAverageRating = async function () {
  if (this.reviews && this.reviews.length > 0) {
    const total = this.reviews.reduce((sum, reviewId) => sum + (reviewId.rating || 0), 0);
    this.reviews.averageRating = total / this.reviews.length;
    this.reviews.totalReviews = this.reviews.length;
    await this.save();
  }
  return this;
};

productSchema.methods.generateSlug = function () {
  if (!this.slug && this.title) {
    this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  return this.slug;
};

productSchema.methods.applyCoupon = function (coupon) {
  if (coupon && coupon.isValid && this.isDiscountActive()) {
    return this.calculateFinalPrice() * (1 - coupon.discount / 100);
  }
  return this.calculateFinalPrice();
};

productSchema.methods.getVariantsStock = function () {
  return Array.isArray(this.variants) ? this.variants.reduce((total, v) => total + (v.inventory || 0), 0) : 0;
};

productSchema.methods.checkCompatibility = function (otherProductId) {
  return this.accessories && this.accessories.includes(otherProductId) || this.replacementParts && this.replacementParts.includes(otherProductId);
};

productSchema.methods.archive = async function () {
  this.status = 'archived';
  this.deletedAt = new Date();
  await this.save();
  return this;
};

productSchema.methods.canBackorder = function (quantity) {
  return this.allowBackorder && quantity > (this.inventory || 0);
};

productSchema.methods.calculateShipping = function () {
  if (this.shipping && this.shipping.requiresShipping) {
    return (this.shippingWeight || this.weight || 0) * 10;
  }
  return 0;
};

productSchema.methods.getTaxAmount = function () {
  if (this.taxRate && this.basePrice) {
    return this.basePrice * (this.taxRate / 100);
  }
  return 0;
};

productSchema.methods.validatePurchaseQuantity = function (quantity) {
  return quantity >= (this.minOrderQuantity || 1) && (!this.maxOrderQuantity || quantity <= this.maxOrderQuantity);
};

productSchema.methods.getImagesByType = function (type) {
  return Array.isArray(this.images) ? this.images.filter(img => img.type === type) : [];
};

productSchema.methods.isEligibleForDiscount = function () {
  return this.isDiscountActive() && (!this.discountType || this.discountType !== 'none');
};

productSchema.methods.getProductWeight = function () {
  return this.shippingWeight || this.weight || 0;
};

productSchema.methods.getDimensionsForShipping = function () {
  return this.packageDimensions || this.dimensions || {};
};

productSchema.methods.updateAnalytics = function (field, increment = 1) {
  if (this.analytics && field in this.analytics) {
    this.analytics[field] += increment;
    this.save();
  }
  return this.analytics;
};

productSchema.methods.getAvailableVariants = function () {
  return Array.isArray(this.variants) ? this.variants.filter(v => v.inventory > 0) : [];
};

productSchema.methods.isExpired = function () {
  return this.expiryDate && new Date() > new Date(this.expiryDate);
};

productSchema.methods.needsRestock = function () {
  return (this.inventory || 0) <= (this.lowStockThreshold || 0);
};

productSchema.methods.getProductURL = function () {
  return `/product/${this.slug || this.generateSlug()}`;
};

productSchema.methods.exportProductData = function () {
  return JSON.stringify(this.toObject());
};




const Product = mongoose.model('Product', productSchema);
module.exports = Product;
