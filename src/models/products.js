const mongoose = require('mongoose');
const Brand = require('./brands');
const Category = require('./categories');


const variantSchema = new mongoose.Schema({
  sku: { type: String },
  title: { type: String }, // e.g., 'Red, Size M'
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  images: [{ url: String, alt: String }],
  inventory: { type: Number, default: 0 },
  attributes: { type: Map, of: String }, // e.g., color: 'red', size: 'M'
});

const DEFAULT_SEARCH_FIELDS = ['title', 'shortDescription', 'tags', 'sku', 'vendor', 'manufacturer', 'model', 'overview', 'metaTitle', 'metaDescription', 'seo_info.title', 'seo_info.description', 'descriptions.content', 'features', 'specifications.color', 'customAttributes.material', 'categoryName', 'brandName'];

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
    isDeleted: { type: Boolean, default: false },
    size: { type: String },
    ageGroup: { type: String },
    gender: { type: String },
    stockActivityLog: [
      {
        operation: { type: String, enum: ['reduce', 'restore', 'restock', 'auto_restock'] },
        quantity: { type: Number },
        previousStock: { type: Number },
        currentStock: { type: Number },
        reason: { type: String },
        timestamp: { type: Date, default: Date.now },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      },
    ],

    // Enhanced low stock threshold
    lowStockThreshold: { type: Number, min: 0, default: 10 },

    // Auto-restock settings
    autoRestockEnabled: { type: Boolean, default: false },
    autoRestockQuantity: { type: Number, min: 0 },
    autoRestockThreshold: { type: Number, min: 0 },
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
      totalReviews: { type: Number, min: 0 },
    },
    socialMedia: {
      hashtags: { type: [String] },
      instagramHandle: { type: String },
      twitterHandle: { type: String },
    },
    analytics: {
      views: { type: Number, min: 0, default: 0 },
      clicks: { type: Number, min: 0, default: 0 },
      conversions: { type: Number, min: 0, default: 0 },
    },
    tags: { type: [String] },
    basePrice: { type: Number, min: 0, required: true },
    finalPrice: { type: Number, min: 0 },
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
      height: { type: Number, min: 0 },
    },
    packageDimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      weight: { type: Number, min: 0 },
    },
    shipping: {
      requiresShipping: { type: Boolean, default: true },
      shippingClass: { type: String },
      handlingTime: { type: Number, min: 0 },
      freeShippingThreshold: { type: Number, min: 0 },
      shippingRestrictions: { type: [String] },
      hazardousMaterial: { type: Boolean, default: false },
      fragile: { type: Boolean, default: false },
    },
    seo_info: {
      title: { type: String },
      description: { type: String },
      keywords: { type: String },
      slug: { type: String },
      canonicalUrl: { type: String },
      robotsMeta: { type: String },
      structuredData: { type: String },
    },
    visibility: { type: String, enum: ['public', 'private', 'password'] },
    password: { type: String },
    publishDate: { type: String },
    expiryDate: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['active', 'inactive', 'draft', 'pending', 'archived', 'published'],
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
    // variants: [variantSchema] || null,
    mainImage: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
      url: { type: String, default: null },
      name: { type: String }, // Original or current filename
      size: { type: Number }, // File size in bytes
      type: { type: String }, // MIME type (image/jpeg, application/pdf, etc.)
    },
    images: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
        url: { type: String, default: null },
        name: { type: String }, // Original or current filename
        size: { type: Number }, // File size in bytes
        type: { type: String }, // MIME type (image/jpeg, application/pdf, etc.)
      },
    ],
    downloadableFiles: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
        url: { type: String, default: null },
        name: { type: String }, // Original or current filename
        size: { type: Number }, // File size in bytes
        type: { type: String }, // MIME type (image/jpeg, application/pdf, etc.)
      },
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
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
        quantity: { type: Number, default: 1 },
      },
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
    lastRestocked: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// 🔍 Full-text search
productSchema.index({ '$**': 'text' });
// productSchema.index({ sku: 1 }, { unique: true });
// productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ status: 1 });
productSchema.index({ categories: 1 });
productSchema.index({ isFeatured: 1, status: 1 });

// 🔹 Virtual rating stats

productSchema.pre('save', function (next) {
  try {
    const product = this;

    // Start with the base price
    let finalPrice = product.basePrice || 0;

    // Apply discount if defined
    if (product.discountType && product.discountValue) {
      switch (product.discountType) {
        case 'percentage':
          finalPrice -= (finalPrice * product.discountValue) / 100;
          break;
        case 'fixed':
          finalPrice -= product.discountValue;
          break;
        case 'none':
        default:
          break;
      }
    }

    // Ensure discount does not go below 0
    finalPrice = Math.max(finalPrice, 0);

    // Set salePrice and retailPrice
    if (product.comparePrice && product.comparePrice > finalPrice) {
      product.salePrice = finalPrice;
      product.retailPrice = product.comparePrice;
    } else {
      product.salePrice = finalPrice;
      product.retailPrice = finalPrice;
    }

    // Optionally calculate loyalty points
    if (product.loyaltyPoints == null) {
      product.loyaltyPoints = Math.floor(finalPrice / 10); // Example: 1 point per 10 currency units
    }

    // Update finalPrice
    product.finalPrice = finalPrice;

    next();
  } catch (error) {
    next(error);
  }
});


productSchema.virtual('ratingStatistics').get(function () {
  if (this.reviews && this.reviews.length > 0) {
    const totalReviews = this.reviews.length;
    const totalRating = this.reviews.reduce((total, review) => total + (review.rating || 0), 0);
    return {
      totalReviews,
      averageRating: totalRating / totalReviews,
    };
  } else {
    return { totalReviews: 0, averageRating: 0 };
  }
});

// Enhanced stock status with more detail
productSchema.virtual('detailedStockStatus').get(function () {
  const totalStock = this.inventory + this.getVariantsStock();
  const threshold = this.lowStockThreshold || 10;

  if (!this.isAvailable || totalStock <= 0) {
    return {
      status: 'out-of-stock',
      message: 'Out of Stock',
      quantity: 0,
      canBackorder: this.allowBackorder,
    };
  } else if (totalStock <= threshold) {
    return {
      status: 'low-stock',
      message: `Only ${totalStock} left`,
      quantity: totalStock,
      threshold,
    };
  } else {
    return {
      status: 'in-stock',
      message: 'In Stock',
      quantity: totalStock,
    };
  }
});

// Calculate total value of inventory
productSchema.virtual('inventoryValue').get(function () {
  const totalStock = this.inventory + this.getVariantsStock();
  const price = this.costPrice || this.basePrice || 0;
  return totalStock * price;
});

// Get profit margin
productSchema.virtual('profitMargin').get(function () {
  if (!this.costPrice || !this.basePrice) return 0;
  return ((this.basePrice - this.costPrice) / this.basePrice) * 100;
});

// Calculate discount savings
productSchema.virtual('discountSavings').get(function () {
  if (!this.comparePrice || !this.basePrice) return 0;
  return this.comparePrice - this.basePrice;
});

// Get SEO score (basic calculation)
productSchema.virtual('seoScore').get(function () {
  let score = 0;

  // Title optimization (30 points)
  if (this.title && this.title.length >= 10 && this.title.length <= 60) score += 30;

  // Meta description (25 points)
  if (this.metaDescription && this.metaDescription.length >= 120 && this.metaDescription.length <= 160) score += 25;

  // Images (20 points)
  if (this.mainImage) score += 10;
  if (this.images && this.images.length >= 3) score += 10;

  // Tags (15 points)
  if (this.tags && this.tags.length >= 3) score += 15;

  // SEO info (10 points)
  if (this.seo_info && this.seo_info.slug) score += 10;

  return Math.min(score, 100);
});

// Get product performance metrics
productSchema.virtual('performanceMetrics').get(function () {
  const conversionRate = this.views > 0 ? (this.soldCount / this.views) * 100 : 0;
  const revenuePerView = this.views > 0 ? (this.soldCount * this.basePrice) / this.views : 0;

  return {
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    revenuePerView: parseFloat(revenuePerView.toFixed(2)),
    totalRevenue: this.soldCount * this.basePrice,
    averageOrderValue: this.soldCount > 0 ? (this.soldCount * this.basePrice) / this.soldCount : 0,
  };
});

// Get availability timeline
productSchema.virtual('availabilityTimeline').get(function () {
  const timeline = [];

  if (this.publishDate) {
    timeline.push({ event: 'published', date: new Date(this.publishDate) });
  }

  if (this.preOrder && this.preOrderDate) {
    timeline.push({ event: 'preorder-available', date: this.preOrderDate });
  }

  if (this.discountStartDate) {
    timeline.push({ event: 'sale-starts', date: this.discountStartDate });
  }

  if (this.discountEndDate) {
    timeline.push({ event: 'sale-ends', date: this.discountEndDate });
  }

  if (this.expiryDate) {
    timeline.push({ event: 'expires', date: new Date(this.expiryDate) });
  }

  return timeline.sort((a, b) => a.date - b.date);
});

// Get shipping information summary
productSchema.virtual('shippingInfo').get(function () {
  return {
    requiresShipping: this.shipping?.requiresShipping || true,
    weight: this.getProductWeight(),
    dimensions: this.getDimensionsForShipping(),
    shippingClass: this.shipping?.shippingClass,
    freeShippingEligible: this.basePrice >= (this.shipping?.freeShippingThreshold || 0),
    estimatedCost: this.calculateShipping(),
    handlingTime: this.shipping?.handlingTime || 1,
    hazardous: this.shipping?.hazardousMaterial || false,
    fragile: this.shipping?.fragile || false,
  };
});

productSchema.virtual('stockStatus').get(function () {
  if (!this.isAvailable) return 'Out of Stock';
  if (this.backorder) return 'Backorder Available';
  if (this.isLowStock()) return 'Low Stock';
  return 'In Stock';
});
productSchema.add({ deletedAt: { type: Date } });
productSchema.statics.bulkDelete = function (ids) {
  return this.updateMany({ _id: { $in: ids }, deletedAt: { $exists: false } }, { $set: { deletedAt: new Date(), status: 'archived' } });
};

productSchema.pre('save', async function (next) {
  try {
    // Generate SKU if not provided
    if (!this.sku) {
      this.sku = await this.generateUniqueSKU();
    }

    // Auto-generate slug from title
    if (this.isModified('title') || !this.seo_info.slug) {
      this.seo_info.slug = this.generateSlug();
    }

    // Calculate sale price if discount is active
    if (this.isModified('basePrice') || this.isModified('discountValue') || this.isModified('discountType')) {
      this.calculateAndSetSalePrice();
    }

    // Update meta fields if not provided
    if (!this.metaTitle && this.title) {
      this.metaTitle = this.title.length > 60 ? this.title.substring(0, 57) + '...' : this.title;
    }

    if (!this.metaDescription && this.shortDescription) {
      this.metaDescription = this.shortDescription.length > 160 ? this.shortDescription.substring(0, 157) + '...' : this.shortDescription;
    }

    // Auto-set product flags based on data
    this.autoSetProductFlags();

    // Validate business rules
    await this.validateBusinessRules();

    // Update search keywords
    this.updateSearchKeywords();

    // Set last modified by
    if (this.isModified() && !this.isNew) {
      this.updatedAt = new Date();
    }

    next();
  } catch (error) {
    next(error);
  }
});

productSchema.pre('save', async function (next) {
  try {
    // Only run enhancements on new documents or when specific fields are modified
    const isNewProduct = this.isNew;
    const isModified = this.isModified();

    if (!isNewProduct && !isModified) {
      return next();
    }

    // 1. Generate unique identifiers
    await this.generateUniqueIdentifiers();

    // 2. Auto-generate and optimize content
    await this.generateAndOptimizeContent();

    // 3. Calculate and update pricing
    this.calculateAndUpdatePricing();

    // 4. Auto-set product flags and categories
    await this.autoSetProductFlags();

    // 5. Validate business rules
    await this.validateBusinessRules();

    // 6. Update search and SEO data
    this.updateSearchAndSEOData();

    // 7. Process images and media
    await this.processImages();

    // 8. Update timestamps and metadata
    this.updateMetadata();

    // 9. Trigger notifications for important changes
    await this.triggerChangeNotifications();

    next();
  } catch (error) {
    next(error);
  }
});
productSchema.pre('save', function (next) {
  // Validate required fields based on product type
  if (this.productType === 'physical') {
    if (!this.weight && !this.shippingWeight) {
      return next(new Error('Physical products must have weight information'));
    }
  }

  if (this.productType === 'digital') {
    if (!this.digitalDownloadLink && !this.downloadableFiles?.length) {
      return next(new Error('Digital products must have download information'));
    }
  }

  next();
});

// Validate inventory changes
productSchema.pre('save', function (next) {
  if (this.isModified('inventory') && this.trackInventory === 'yes') {
    const oldInventory = this.get('inventory', Number, true); // Get original value
    const newInventory = this.inventory;

    // Log significant inventory changes
    if (Math.abs(oldInventory - newInventory) > 10) {
      console.log(`Significant inventory change for ${this.sku}: ${oldInventory} → ${newInventory}`);
    }
  }

  next();
});

// Generate unique SKU and slug
productSchema.methods.generateUniqueIdentifiers = async function () {
  // Generate SKU if not provided
  if (!this.sku) {
    this.sku = await this.generateUniqueSKU();
  }

  // Auto-generate slug from title
  if (this.isModified('title') || !this.seo_info?.slug) {
    if (!this.seo_info) this.seo_info = {};
    this.seo_info.slug = await this.generateUniqueSlug();
  }
};

// Generate unique SKU with business logic
productSchema.methods.generateUniqueSKU = async function () {
  // Get brand/category prefix
  let prefix = 'PRD';

  if (this.brand) {
    const Brand = mongoose.model('Brand');
    const brand = await Brand.findById(this.brand).select('name code');
    prefix = brand?.code || brand?.name?.substring(0, 3).toUpperCase() || 'PRD';
  } else if (this.categories && this.categories.length > 0) {
    const Category = mongoose.model('Category');
    const category = await Category.findById(this.categories[0]).select('name code');
    prefix = category?.code || category?.name?.substring(0, 3).toUpperCase() || 'CAT';
  }

  // Generate SKU with timestamp and random component
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();

  let sku = `${prefix}-${timestamp}-${random}`;

  // Ensure uniqueness
  const existing = await this.constructor.findOne({ sku });
  if (existing) {
    return this.generateUniqueSKU(); // Recursive call with different timestamp
  }

  return sku;
};

// Generate unique slug
productSchema.methods.generateUniqueSlug = async function () {
  if (!this.title) return '';

  let baseSlug = this.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  let slug = baseSlug;
  let counter = 1;

  // Ensure uniqueness
  while (await this.constructor.findOne({ 'seo_info.slug': slug, _id: { $ne: this._id } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

// Generate and optimize content
productSchema.methods.generateAndOptimizeContent = async function () {
  // Auto-generate meta title if not provided
  if (!this.metaTitle && this.title) {
    this.metaTitle = this.title.length > 60 ? this.title.substring(0, 57) + '...' : this.title;
  }

  // Auto-generate meta description if not provided
  if (!this.metaDescription && this.shortDescription) {
    this.metaDescription = this.shortDescription.length > 160 ? this.shortDescription.substring(0, 157) + '...' : this.shortDescription;
  } else if (!this.metaDescription && this.descriptions?.content) {
    const plainText = this.descriptions.content.replace(/<[^>]*>/g, '');
    this.metaDescription = plainText.length > 160 ? plainText.substring(0, 157) + '...' : plainText;
  }

  // Generate short description from full description if missing
  if (!this.shortDescription && this.descriptions?.content) {
    const plainText = this.descriptions.content.replace(/<[^>]*>/g, '');
    this.shortDescription = plainText.length > 200 ? plainText.substring(0, 197) + '...' : plainText;
  }
};

// Calculate and update all pricing fields
productSchema.methods.calculateAndUpdatePricing = function () {
  // Calculate sale price from discount
  if (this.isModified('basePrice') || this.isModified('discountValue') || this.isModified('discountType')) {
    this.calculateAndSetSalePrice();
  }

  // Set retail price if not provided
  if (!this.retailPrice && this.basePrice) {
    this.retailPrice = this.basePrice;
  }

  // Calculate tax amount if tax rate is provided
  if (this.taxRate && this.basePrice) {
    this.taxAmount = this.basePrice * (this.taxRate / 100);
  }

  // Validate pricing logic
  this.validatePricing();
};

// Calculate and set sale price based on discount
productSchema.methods.calculateAndSetSalePrice = function () {
  if (this.discountType && this.discountType !== 'none' && this.discountValue > 0) {
    if (this.discountType === 'percentage') {
      this.salePrice = this.basePrice - this.basePrice * (this.discountValue / 100);
    } else if (this.discountType === 'fixed') {
      this.salePrice = Math.max(0, this.basePrice - this.discountValue);
    }

    // Round to 2 decimal places
    this.salePrice = Math.round(this.salePrice * 100) / 100;
  } else {
    this.salePrice = undefined;
  }
};

// Validate pricing business rules
productSchema.methods.validatePricing = function () {
  if (this.salePrice && this.salePrice >= this.basePrice) {
    this.salePrice = this.basePrice * 0.95; // Ensure 5% minimum discount
  }

  if (this.comparePrice && this.comparePrice < this.basePrice) {
    this.comparePrice = this.basePrice * 1.2; // Set compare price 20% higher
  }
};

// Auto-set product flags based on data and business rules
productSchema.methods.autoSetProductFlags = async function () {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  // Auto-set new arrival flag
  if (this.createdAt && this.createdAt >= thirtyDaysAgo) {
    this.newArrival = true;
  } else if (this.newArrival && this.createdAt < thirtyDaysAgo) {
    this.newArrival = false;
  }

  // Auto-set bestseller flag based on sold count relative to age
  const daysSinceCreated = this.createdAt ? (now - this.createdAt) / (1000 * 60 * 60 * 24) : 0;
  const dailyAverageSales = daysSinceCreated > 0 ? this.soldCount / daysSinceCreated : 0;

  if (dailyAverageSales > 1 && this.soldCount >= 50) {
    this.bestseller = true;
  }

  // Auto-set on sale flag
  if (this.salePrice && this.salePrice < this.basePrice) {
    this.onSale = true;
  } else {
    this.onSale = false;
  }

  // Auto-set trending flag based on recent views and sales
  if (this.analytics?.views > 1000 || (this.views > 500 && this.updatedAt >= sevenDaysAgo)) {
    this.trending = true;
  }

  // Auto-set featured flag for high-performing products
  if (this.bestseller && this.reviews?.averageRating >= 4.5) {
    this.isFeatured = true;
  }

  // Auto-categorize based on attributes
  await this.autoCategorizeBusiness();
};

// Auto-categorization based on product attributes
productSchema.methods.autoCategorizeBusiness = async function () {
  // Set ecoFriendly flag based on attributes
  const ecoKeywords = ['organic', 'eco', 'sustainable', 'bamboo', 'recycled', 'biodegradable'];
  const productText = `${this.title} ${this.shortDescription} ${this.tags?.join(' ')}`.toLowerCase();

  if (ecoKeywords.some((keyword) => productText.includes(keyword))) {
    this.ecoFriendly = true;
  }

  // Set gift wrapping based on category or price
  if (this.basePrice > 25 && (this.occasion === 'gift' || this.tags?.includes('gift'))) {
    this.giftWrappingAvailable = true;
  }

  // Set shipping requirements
  if (!this.shipping) this.shipping = {};

  if (this.productType === 'digital') {
    this.shipping.requiresShipping = false;
    this.virtualProduct = true;
  }

  // Set age restrictions for certain categories
  const restrictedKeywords = ['alcohol', 'tobacco', 'adult', '18+'];
  if (restrictedKeywords.some((keyword) => productText.includes(keyword))) {
    this.ageRestriction = '18+';
  }
};

// Comprehensive business rules validation
productSchema.methods.validateBusinessRules = async function () {
  const errors = [];
  const warnings = [];

  // Price validation
  if (this.salePrice && this.salePrice >= this.basePrice) {
    errors.push('Sale price cannot be greater than or equal to base price');
  }

  if (this.costPrice && this.basePrice && this.costPrice >= this.basePrice) {
    warnings.push(`Negative margin detected: Cost (${this.costPrice}) >= Price (${this.basePrice})`);
  }

  // Inventory validation
  if (this.trackInventory === 'yes' && this.inventory < 0) {
    errors.push('Inventory cannot be negative when tracking is enabled');
  }

  if (this.maxOrderQuantity && this.minOrderQuantity && this.maxOrderQuantity < this.minOrderQuantity) {
    errors.push('Maximum order quantity cannot be less than minimum order quantity');
  }

  // Date validation
  if (this.discountStartDate && this.discountEndDate && this.discountStartDate >= this.discountEndDate) {
    errors.push('Discount start date must be before end date');
  }

  if (this.publishDate && this.expiryDate && new Date(this.publishDate) >= new Date(this.expiryDate)) {
    errors.push('Publish date must be before expiry date');
  }

  // Variant validation
  if (this.variants && this.variants.length > 0) {
    const skus = this.variants.map((v) => v.sku).filter(Boolean);
    const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index);
    if (duplicateSkus.length > 0) {
      errors.push(`Duplicate variant SKUs found: ${duplicateSkus.join(', ')}`);
    }
  }

  // Content validation
  if (!this.title || this.title.length < 3) {
    errors.push('Product title must be at least 3 characters long');
  }

  if (this.metaDescription && this.metaDescription.length > 160) {
    warnings.push('Meta description exceeds 160 characters');
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn(`Product ${this.sku} warnings:`, warnings);
  }

  // Throw errors
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
};

// Update search keywords and SEO data
productSchema.methods.updateSearchAndSEOData = function () {
  const keywords = new Set();

  // Extract keywords from various fields
  const extractKeywords = (text) => {
    if (!text) return;
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'men', 'put', 'say', 'she', 'too', 'use'].includes(word))
      .forEach((word) => keywords.add(word));
  };

  extractKeywords(this.title);
  extractKeywords(this.shortDescription);
  extractKeywords(this.metaDescription);

  if (this.descriptions?.content) {
    const plainText = this.descriptions.content.replace(/<[^>]*>/g, '');
    extractKeywords(plainText);
  }

  if (this.tags) {
    this.tags.forEach((tag) => keywords.add(tag.toLowerCase()));
  }

  if (this.features) {
    this.features.forEach((feature) => extractKeywords(feature));
  }

  // Store keywords (limit to top 50)
  const keywordArray = Array.from(keywords).slice(0, 50);

  if (!this.seo_info) this.seo_info = {};
  if (!this.seo_info.keywords || this.isModified('title') || this.isModified('tags')) {
    this.seo_info.keywords = keywordArray.join(', ');
  }

  // Generate structured data
  this.generateStructuredData();
};

// Generate JSON-LD structured data
productSchema.methods.generateStructuredData = function () {
  const structuredData = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: this.title,
    description: this.shortDescription,
    sku: this.sku,
    image: this.mainImage ? [this.mainImage] : [],
    offers: {
      '@type': 'Offer',
      url: `${process.env.SITE_URL}/products/${this.seo_info?.slug}`,
      priceCurrency: process.env.CURRENCY || 'USD',
      price: this.salePrice || this.basePrice,
      availability: this.isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: process.env.COMPANY_NAME || 'Your Store',
      },
    },
  };

  if (this.brand) {
    structuredData.brand = {
      '@type': 'Brand',
      name: this.brandName || 'Brand',
    };
  }

  if (this.reviews?.averageRating) {
    structuredData.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: this.reviews.averageRating,
      reviewCount: this.reviews.totalReviews || 0,
    };
  }

  if (!this.seo_info) this.seo_info = {};
  this.seo_info.structuredData = JSON.stringify(structuredData);
};

// Process and optimize images
productSchema.methods.processImages = async function () {
  // Ensure main image is set
  if (!this.mainImage && this.images && this.images.length > 0) {
    this.mainImage = this.images[0].url || this.images[0];
  }

  // Add alt text to images if missing
  if (this.images && this.images.length > 0) {
    this.images = this.images.map((img, index) => {
      if (typeof img === 'string') {
        return {
          url: img,
          alt: `${this.title} - Image ${index + 1}`,
          isPrimary: index === 0,
        };
      } else if (img && typeof img === 'object' && !img.alt) {
        img.alt = `${this.title} - Image ${index + 1}`;
      }
      return img;
    });
  }
};

// Update metadata and timestamps
productSchema.methods.updateMetadata = function () {
  // Set updated timestamp
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }

  // Track what fields were modified
  if (!this.isNew) {
    const modifiedFields = this.modifiedPaths();
    this.lastModifiedFields = modifiedFields;
  }

  // Update view tracking if this is a new product
  if (this.isNew) {
    this.views = 0;
    this.total_view = 0;
    this.soldCount = 0;
  }
};

// Trigger notifications for important changes
productSchema.methods.triggerChangeNotifications = async function () {
  if (this.isNew) {
    // New product notification
    console.log(`New product created: ${this.title} (${this.sku})`);
    // Trigger webhook or notification service
    // await notificationService.sendNewProductAlert(this);
  } else {
    // Check for important field changes
    const importantFields = ['basePrice', 'inventory', 'status', 'isAvailable'];
    const modifiedImportantFields = importantFields.filter((field) => this.isModified(field));

    if (modifiedImportantFields.length > 0) {
      console.log(`Important product changes for ${this.title}:`, modifiedImportantFields);
      // Trigger webhook or notification service
      // await notificationService.sendProductUpdateAlert(this, modifiedImportantFields);
    }

    // Stock alerts
    if (this.isModified('inventory') && this.inventory <= (this.lowStockThreshold || 0)) {
      await this.triggerLowStockAlert();
    }
  }
};

/* 🔹 Instance Methods */

// Generate unique SKU
productSchema.methods.generateUniqueSKU = async function () {
  const prefix = this.brand ? this.brand.toString().substring(0, 3).toUpperCase() : 'PRD';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();

  let sku = `${prefix}-${timestamp}-${random}`;

  // Ensure uniqueness
  const existing = await this.constructor.findOne({ sku });
  if (existing) {
    return this.generateUniqueSKU(); // Recursive call
  }

  return sku;
};

// Calculate and set sale price
productSchema.methods.calculateAndSetSalePrice = function () {
  if (this.discountType && this.discountType !== 'none' && this.discountValue > 0) {
    if (this.discountType === 'percentage') {
      this.salePrice = this.basePrice - this.basePrice * (this.discountValue / 100);
    } else if (this.discountType === 'fixed') {
      this.salePrice = Math.max(0, this.basePrice - this.discountValue);
    }
  } else {
    this.salePrice = undefined;
  }
};

// Auto-set product flags
productSchema.methods.autoSetProductFlags = function () {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Auto-set new arrival flag
  if (this.createdAt && this.createdAt >= thirtyDaysAgo) {
    this.newArrival = true;
  } else if (this.newArrival && this.createdAt < thirtyDaysAgo) {
    this.newArrival = false;
  }

  // Auto-set bestseller flag based on sold count
  if (this.soldCount >= 100) {
    // Configure threshold as needed
    this.bestseller = true;
  }

  // Auto-set on sale flag
  if (this.salePrice && this.salePrice < this.basePrice) {
    this.onSale = true;
  } else {
    this.onSale = false;
  }

  // Auto-set trending flag based on recent views
  if (this.analytics && this.analytics.views > 1000) {
    // Configure threshold
    this.trending = true;
  }
};

// Auto-restock when stock hits threshold
productSchema.methods.autoRestock = async function (restockQuantity) {
  if (this.needsRestock()) {
    await this.restock(restockQuantity);

    // Log auto-restock activity
    await this.logStockActivity({
      operation: 'auto_restock',
      quantity: restockQuantity,
      previousStock: this.inventory - restockQuantity,
      currentStock: this.inventory,
      reason: 'auto_restock_triggered',
    });

    console.log(`Auto-restocked product ${this.title} with ${restockQuantity} units`);
    return true;
  }
  return false;
};
// Validate business rules
productSchema.methods.validateBusinessRules = async function () {
  const errors = [];

  // Price validation
  if (this.salePrice && this.salePrice >= this.basePrice) {
    errors.push('Sale price cannot be greater than or equal to base price');
  }

  if (this.costPrice && this.basePrice && this.costPrice >= this.basePrice) {
    console.warn(`Product ${this.sku}: Cost price (${this.costPrice}) >= Base price (${this.basePrice}). Negative margin detected.`);
  }

  // Stock validation
  if (this.trackInventory === 'yes' && this.inventory < 0) {
    errors.push('Inventory cannot be negative when tracking is enabled');
  }

  // Date validation
  if (this.discountStartDate && this.discountEndDate && this.discountStartDate >= this.discountEndDate) {
    errors.push('Discount start date must be before end date');
  }

  if (this.publishDate && this.expiryDate && new Date(this.publishDate) >= new Date(this.expiryDate)) {
    errors.push('Publish date must be before expiry date');
  }

  // Variant validation
  if (this.variants && this.variants.length > 0) {
    const skus = this.variants.map((v) => v.sku);
    const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index);
    if (duplicateSkus.length > 0) {
      errors.push(`Duplicate variant SKUs found: ${duplicateSkus.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
};

// Update search keywords
productSchema.methods.updateSearchKeywords = function () {
  const keywords = [];

  // Extract keywords from various fields
  if (this.title) keywords.push(...this.title.toLowerCase().split(/\s+/));
  if (this.shortDescription) keywords.push(...this.shortDescription.toLowerCase().split(/\s+/));
  if (this.tags) keywords.push(...this.tags.map((tag) => tag.toLowerCase()));
  if (this.features) keywords.push(...this.features.map((f) => f.toLowerCase().split(/\s+/)).flat());

  // Remove duplicates and short words
  const uniqueKeywords = [...new Set(keywords)].filter((word) => word.length > 2).slice(0, 50); // Limit to 50 keywords

  // Store in seo_info for search optimization
  if (!this.seo_info.keywords || this.isModified('title') || this.isModified('tags')) {
    this.seo_info.keywords = uniqueKeywords.join(', ');
  }
};

// Advanced price calculations
productSchema.methods.getPriceWithTax = function (quantity = 1, taxRate = null) {
  const basePrice = this.getFinalPrice(quantity);
  const applicableTaxRate = taxRate || this.taxRate || 0;
  const tax = basePrice * (applicableTaxRate / 100);

  return {
    basePrice,
    quantity,
    subtotal: basePrice,
    taxRate: applicableTaxRate,
    taxAmount: tax,
    total: basePrice + tax,
    formatted: {
      subtotal: `$${basePrice.toFixed(2)}`,
      tax: `$${tax.toFixed(2)}`,
      total: `$${(basePrice + tax).toFixed(2)}`,
    },
  };
};

// Comprehensive price breakdown with all possible discounts and fees
productSchema.methods.getCompletePriceBreakdown = function (quantity = 1, options = {}) {
  const { discountCode = null, shippingRequired = true, taxRate = null, loyaltyDiscount = 0 } = options;

  const basePrice = this.basePrice * quantity;
  const productDiscount = this.isDiscountActive() ? basePrice * (this.discount / 100) : 0;
  const salePrice = this.salePrice ? this.salePrice * quantity : null;
  const finalPrice = this.getFinalPrice(quantity);

  // Apply bulk discount
  const bulkDiscountPrice = this.getBulkDiscountPrice ? this.getBulkDiscountPrice(quantity) : finalPrice;
  const bulkDiscount = finalPrice - bulkDiscountPrice * quantity;

  // Loyalty discount
  const loyaltyDiscountAmount = finalPrice * (loyaltyDiscount / 100);

  const subtotalAfterDiscounts = finalPrice - bulkDiscount - loyaltyDiscountAmount;
  const tax = this.getTaxAmount() * quantity;
  const shipping = shippingRequired ? this.calculateShipping() : 0;

  const total = subtotalAfterDiscounts + tax + shipping;

  return {
    original: {
      basePrice,
      quantity,
      unitPrice: this.basePrice,
    },
    discounts: {
      productDiscount,
      bulkDiscount,
      loyaltyDiscount: loyaltyDiscountAmount,
      totalDiscount: productDiscount + bulkDiscount + loyaltyDiscountAmount,
    },
    pricing: {
      subtotal: subtotalAfterDiscounts,
      tax,
      shipping,
      total,
    },
    savings: {
      amount: basePrice - total,
      percentage: basePrice > 0 ? (((basePrice - total) / basePrice) * 100).toFixed(2) : 0,
    },
    formatted: {
      subtotal: `$${subtotalAfterDiscounts.toFixed(2)}`,
      tax: `$${tax.toFixed(2)}`,
      shipping: shipping > 0 ? `$${shipping.toFixed(2)}` : 'FREE',
      total: `$${total.toFixed(2)}`,
      savings: `$${(basePrice - total).toFixed(2)}`,
    },
  };
};

// Advanced stock checking with detailed availability information
productSchema.methods.checkDetailedAvailability = function (requestedQuantity = 1, variantId = null) {
  const result = {
    productId: this._id,
    requestedQuantity,
    timestamp: new Date(),
  };

  if (!this.trackInventory || this.trackInventory === 'no') {
    return {
      ...result,
      available: true,
      status: 'unlimited',
      message: 'Stock tracking disabled - unlimited availability',
    };
  }

  let availableStock = 0;
  let variant = null;

  if (variantId) {
    variant = this.variants.id(variantId);
    if (!variant) {
      return {
        ...result,
        available: false,
        status: 'variant_not_found',
        message: 'Requested variant not found',
      };
    }
    availableStock = variant.inventory || 0;
  } else {
    availableStock = this.inventory || 0;
  }

  // Check various availability scenarios
  if (requestedQuantity <= availableStock) {
    return {
      ...result,
      available: true,
      status: 'in_stock',
      availableStock,
      message: `${availableStock} units available`,
      canFulfillImmediately: true,
      estimatedShipDate: this.getEstimatedShipDate(),
    };
  } else if (this.allowBackorder) {
    const backorderQuantity = requestedQuantity - availableStock;
    return {
      ...result,
      available: true,
      status: 'backorder_available',
      availableStock,
      backorderQuantity,
      message: `${availableStock} in stock, ${backorderQuantity} on backorder`,
      canFulfillImmediately: false,
      estimatedShipDate: this.getBackorderShipDate(),
      partialFulfillment: availableStock > 0,
    };
  } else {
    return {
      ...result,
      available: false,
      status: 'insufficient_stock',
      availableStock,
      shortfall: requestedQuantity - availableStock,
      message: `Insufficient stock. Available: ${availableStock}, Requested: ${requestedQuantity}`,
      suggestedQuantity: availableStock,
      estimatedRestockDate: this.getEstimatedRestockDate(),
    };
  }
};

// Get estimated shipping dates
productSchema.methods.getEstimatedShipDate = function () {
  const handlingDays = this.shipping?.handlingTime || 1;
  const shipDate = new Date();
  shipDate.setDate(shipDate.getDate() + handlingDays);

  // Skip weekends
  while (shipDate.getDay() === 0 || shipDate.getDay() === 6) {
    shipDate.setDate(shipDate.getDate() + 1);
  }

  return shipDate;
};

// Get backorder shipping estimate
productSchema.methods.getBackorderShipDate = function () {
  const leadTime = this.leadTime || 14; // Default 2 weeks
  const shipDate = new Date();
  shipDate.setDate(shipDate.getDate() + leadTime);
  return shipDate;
};

// Get estimated restock date
productSchema.methods.getEstimatedRestockDate = function () {
  if (this.restockDate) {
    return new Date(this.restockDate);
  }

  // Estimate based on sales velocity
  const averageDailySales = this.soldCount / 90; // Last 90 days
  if (averageDailySales > 0) {
    const daysToRestock = Math.ceil(50 / averageDailySales); // Assume 50 unit restock
    const restockDate = new Date();
    restockDate.setDate(restockDate.getDate() + daysToRestock);
    return restockDate;
  }

  return null;
};

// Generate comprehensive product recommendations
productSchema.methods.getAdvancedRecommendations = async function (options = {}) {
  const { limit = 8, types = ['related', 'cross_sell', 'up_sell', 'similar'], userContext = null } = options;

  const recommendations = {};

  // Related products (same category/brand)
  if (types.includes('related')) {
    recommendations.related = await this.constructor
      .find({
        $and: [
          { _id: { $ne: this._id } },
          { status: 'active' },
          { isAvailable: true },
          {
            $or: [{ categories: { $in: this.categories } }, { brand: this.brand }, { tags: { $in: this.tags || [] } }],
          },
        ],
      })
      .sort({ soldCount: -1, reviews: -1 })
      .limit(Math.ceil(limit / types.length))
      .select('title basePrice salePrice mainImage slug soldCount reviews averageRating');
  }

  // Cross-sell products (accessories, complementary items)
  if (types.includes('cross_sell')) {
    recommendations.crossSell = await this.constructor
      .find({
        _id: { $in: this.crossSells || [] },
      })
      .populate('reviews')
      .limit(Math.ceil(limit / types.length));
  }

  // Up-sell products (higher price, similar category)
  if (types.includes('up_sell')) {
    recommendations.upSell = await this.constructor
      .find({
        $and: [{ _id: { $ne: this._id } }, { categories: { $in: this.categories } }, { basePrice: { $gt: this.basePrice } }, { status: 'active' }, { isAvailable: true }],
      })
      .sort({ basePrice: 1 })
      .limit(Math.ceil(limit / types.length));
  }

  // Similar products (ML-based or attribute matching)
  if (types.includes('similar')) {
    const similarityQuery = {
      $and: [{ _id: { $ne: this._id } }, { status: 'active' }, { isAvailable: true }],
    };

    // Add similarity criteria
    if (this.color) similarityQuery.$and.push({ color: this.color });
    if (this.material) similarityQuery.$and.push({ material: this.material });
    if (this.style) similarityQuery.$and.push({ style: this.style });

    recommendations.similar = await this.constructor.find(similarityQuery).limit(Math.ceil(limit / types.length));
  }

  // Personalized recommendations based on user context
  if (userContext && types.includes('personalized')) {
    // This would integrate with your user behavior tracking
    recommendations.personalized = await this.getPersonalizedRecommendations(userContext);
  }

  return recommendations;
};

// Clone product with advanced options
productSchema.methods.cloneProductAdvanced = async function (options = {}) {
  const { newTitle = null, priceAdjustment = 0, categoryOverride = null, includeInventory = false, includeReviews = false, customFields = {} } = options;

  const clonedData = this.toObject();

  // Remove unique fields
  delete clonedData._id;
  delete clonedData.sku;
  delete clonedData.seo_info.slug;
  delete clonedData.createdAt;
  delete clonedData.updatedAt;

  // Reset performance metrics
  clonedData.soldCount = 0;
  clonedData.views = 0;
  clonedData.total_view = 0;

  // Handle inventory
  if (!includeInventory) {
    clonedData.inventory = 0;
    if (clonedData.variants) {
      clonedData.variants.forEach((variant) => {
        variant.inventory = 0;
      });
    }
  }

  // Handle reviews
  if (!includeReviews) {
    clonedData.reviews = {
      type: [],
      averageRating: 0,
      totalReviews: 0,
    };
  }

  // Apply customizations
  if (newTitle) {
    clonedData.title = newTitle;
  } else {
    clonedData.title += ' (Copy)';
  }

  if (priceAdjustment !== 0) {
    clonedData.basePrice += priceAdjustment;
    if (clonedData.salePrice) clonedData.salePrice += priceAdjustment;
  }

  if (categoryOverride) {
    clonedData.categories = Array.isArray(categoryOverride) ? categoryOverride : [categoryOverride];
    clonedData.category = Array.isArray(categoryOverride) ? categoryOverride[0] : categoryOverride;
  }

  // Apply custom fields
  Object.assign(clonedData, customFields);

  // Clone variants with new SKUs
  if (clonedData.variants && clonedData.variants.length > 0) {
    clonedData.variants = clonedData.variants.map((variant) => ({
      ...variant,
      sku: `${variant.sku}-CLONE-${Date.now()}`,
      inventory: includeInventory ? variant.inventory : 0,
    }));
  }

  const clonedProduct = new this.constructor(clonedData);
  return await clonedProduct.save();
};

// Export product data for various platforms
productSchema.methods.exportForPlatform = function (platform = 'general', options = {}) {
  const baseData = {
    id: this._id,
    title: this.title,
    description: this.shortDescription || this.metaDescription,
    price: this.getFinalPrice(),
    currency: process.env.CURRENCY || 'USD',
    availability: this.isAvailable ? 'in stock' : 'out of stock',
    condition: 'new',
    brand: this.brandName,
    sku: this.sku,
    images: this.images?.map((img) => img.url || img).filter(Boolean) || [],
    categories: this.categoryName,
  };

  switch (platform.toLowerCase()) {
    case 'google':
      return {
        ...baseData,
        google_product_category: this.categoryName,
        product_type: this.productType,
        gtin: this.productUPCEAN,
        mpn: this.manufacturerPartNumber,
        custom_label_0: this.isFeatured ? 'featured' : 'regular',
        custom_label_1: this.newArrival ? 'new' : 'existing',
        shipping_weight: this.getProductWeight(),
        shipping: [
          {
            country: 'US',
            service: 'Standard',
            price: `${this.calculateShipping()} USD`,
          },
        ],
      };

    case 'facebook':
      return {
        ...baseData,
        product_catalog_id: process.env.FB_CATALOG_ID,
        inventory: this.inventory,
        sale_price: this.salePrice ? `${this.salePrice} ${baseData.currency}` : undefined,
        sale_price_effective_date: this.discountStartDate && this.discountEndDate ? `${this.discountStartDate.toISOString()}/${this.discountEndDate.toISOString()}` : undefined,
      };

    case 'amazon':
      return {
        ...baseData,
        item_sku: this.sku,
        item_name: this.title,
        external_product_id: this.productUPCEAN,
        external_product_id_type: this.productUPCEAN ? 'UPC' : 'EAN',
        manufacturer: this.manufacturer,
        part_number: this.manufacturerPartNumber,
        bullet_point1: this.features?.[0],
        bullet_point2: this.features?.[1],
        bullet_point3: this.features?.[2],
        generic_keywords: this.tags?.join(', '),
      };

    case 'shopify':
      return {
        title: this.title,
        body_html: this.descriptions?.content,
        vendor: this.vendor || this.manufacturer,
        product_type: this.productType,
        tags: this.tags?.join(', '),
        published: this.status === 'active',
        variants: this.variants?.map((v) => ({
          sku: v.sku,
          price: v.price,
          inventory_quantity: v.inventory,
          weight: this.weight,
        })) || [
          {
            sku: this.sku,
            price: this.basePrice,
            inventory_quantity: this.inventory,
            weight: this.weight,
          },
        ],
      };

    default:
      return baseData;
  }
};

// Advanced analytics and reporting
productSchema.methods.getAnalyticsReport = function (dateRange = {}) {
  const { startDate, endDate } = dateRange;
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : now;

  // Filter analytics data by date range if available
  const relevantAnalytics = this.detailedAnalytics?.filter((interaction) => new Date(interaction.timestamp) >= start && new Date(interaction.timestamp) <= end) || [];

  const report = {
    period: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      days: Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
    },
    interactions: relevantAnalytics.reduce((acc, interaction) => {
      acc[interaction.type] = (acc[interaction.type] || 0) + 1;
      return acc;
    }, {}),
    performance: {
      views: this.views || 0,
      sold: this.soldCount || 0,
      revenue: (this.soldCount || 0) * (this.basePrice || 0),
      conversionRate: this.views > 0 ? ((this.soldCount / this.views) * 100).toFixed(2) : 0,
    },
    inventory: {
      current: this.inventory || 0,
      turnoverRate: this.inventory > 0 ? (this.soldCount / this.inventory).toFixed(2) : 'N/A',
      daysOfInventory: this.soldCount > 0 ? Math.ceil((this.inventory || 0) / (this.soldCount / 90)) : 'N/A',
    },
    pricing: {
      currentPrice: this.getFinalPrice(),
      averageOrderValue: this.soldCount > 0 ? (this.soldCount * this.basePrice) / this.soldCount : this.basePrice,
      profitMargin: this.costPrice ? (((this.basePrice - this.costPrice) / this.basePrice) * 100).toFixed(2) : 'N/A',
    },
  };

  return report;
};

// Get price breakdown
productSchema.methods.getPriceBreakdown = function (quantity = 1) {
  const basePrice = this.basePrice * quantity;
  const discount = this.isDiscountActive() ? basePrice * (this.discount / 100) : 0;
  const salePrice = this.salePrice ? this.salePrice * quantity : null;
  const finalPrice = this.getFinalPrice(quantity);
  const tax = this.getTaxAmount() * quantity;
  const shipping = this.calculateShipping();

  return {
    basePrice,
    discount,
    salePrice,
    finalPrice,
    tax,
    shipping,
    total: finalPrice + tax + shipping,
  };
};

// Check stock availability for order
productSchema.methods.checkStockAvailability = function (requestedQuantity, variantId = null) {
  if (!this.trackInventory || this.trackInventory === 'no') {
    return { available: true, message: 'Stock tracking disabled' };
  }

  let availableStock;

  if (variantId) {
    const variant = this.variants.id(variantId);
    if (!variant) {
      return { available: false, message: 'Variant not found' };
    }
    availableStock = variant.inventory;
  } else {
    availableStock = this.inventory;
  }

  if (requestedQuantity <= availableStock) {
    return { available: true, stock: availableStock };
  } else if (this.allowBackorder) {
    return {
      available: true,
      backorder: true,
      availableStock,
      backorderQuantity: requestedQuantity - availableStock,
    };
  } else {
    return {
      available: false,
      message: `Insufficient stock. Available: ${availableStock}, Requested: ${requestedQuantity}`,
    };
  }
};

// Generate product recommendations
productSchema.methods.getRecommendations = async function (limit = 5) {
  // Get related products by category and tags
  const relatedProducts = await this.constructor
    .find({
      $and: [
        { _id: { $ne: this._id } },
        { status: 'active' },
        { isAvailable: true },
        {
          $or: [{ categories: { $in: this.categories } }, { tags: { $in: this.tags || [] } }, { brand: this.brand }],
        },
      ],
    })
    .sort({ soldCount: -1, views: -1 })
    .limit(limit)
    .select('title basePrice salePrice mainImage slug soldCount reviews');

  return relatedProducts;
};

// Export product data for external systems
productSchema.methods.exportForFeed = function (format = 'google') {
  const baseData = {
    id: this._id,
    title: this.title,
    description: this.shortDescription,
    link: `${process.env.SITE_URL}/products/${this.seo_info.slug}`,
    image_link: this.mainImage,
    availability: this.isAvailable ? 'in stock' : 'out of stock',
    price: `${this.getFinalPrice()} ${process.env.CURRENCY || 'USD'}`,
    brand: this.brandName,
    condition: 'new',
    gtin: this.productUPCEAN,
  };

  if (format === 'google') {
    return {
      ...baseData,
      google_product_category: this.categoryName,
      product_type: this.productType,
      custom_label_0: this.isFeatured ? 'featured' : 'regular',
    };
  }

  if (format === 'facebook') {
    return {
      ...baseData,
      product_catalog_id: process.env.FB_CATALOG_ID,
      category: this.categoryName,
    };
  }

  return baseData;
};

// Clone product with variations
productSchema.methods.cloneProduct = async function (overrides = {}) {
  const clonedData = this.toObject();

  // Remove fields that should be unique
  delete clonedData._id;
  delete clonedData.sku;
  delete clonedData.seo_info.slug;
  delete clonedData.createdAt;
  delete clonedData.updatedAt;

  // Reset counters
  clonedData.soldCount = 0;
  clonedData.views = 0;
  clonedData.total_view = 0;

  // Apply overrides
  Object.assign(clonedData, overrides);

  // Clone variants with new SKUs
  if (clonedData.variants && clonedData.variants.length > 0) {
    clonedData.variants = clonedData.variants.map((variant) => ({
      ...variant,
      sku: `${variant.sku}-CLONE-${Date.now()}`,
    }));
  }

  const clonedProduct = new this.constructor(clonedData);
  return await clonedProduct.save();
};

// Update stock when order is placed
productSchema.methods.updateStockOnOrder = async function (quantity, operation = 'reduce') {
  try {
    if (!this.trackInventory || this.trackInventory === 'no') {
      return { success: true, message: 'Inventory tracking disabled' };
    }

    const originalStock = this.inventory;

    if (operation === 'reduce') {
      if (quantity > this.inventory && !this.allowBackorder) {
        throw new Error(`Insufficient stock. Available: ${this.inventory}, Requested: ${quantity}`);
      }
      this.inventory = Math.max(0, this.inventory - quantity);
      this.soldCount += quantity;
    } else if (operation === 'restore') {
      this.inventory += quantity;
      this.soldCount = Math.max(0, this.soldCount - quantity);
    }

    // Update availability status
    await this.updateAvailabilityStatus();

    // Log stock activity
    await this.logStockActivity({
      operation,
      quantity,
      previousStock: originalStock,
      currentStock: this.inventory,
      reason: operation === 'reduce' ? 'order_placed' : 'order_cancelled',
    });

    await this.save();

    return {
      success: true,
      previousStock: originalStock,
      currentStock: this.inventory,
      operation,
    };
  } catch (error) {
    throw new Error(`Stock update failed: ${error.message}`);
  }
};
productSchema.methods.updateVariantStock = async function (variantId, quantity, operation = 'reduce') {
  const variant = this.variants.id(variantId);
  if (!variant) {
    throw new Error('Variant not found');
  }

  const originalStock = variant.inventory;

  if (operation === 'reduce') {
    if (quantity > variant.inventory && !this.allowBackorder) {
      throw new Error(`Insufficient variant stock. Available: ${variant.inventory}, Requested: ${quantity}`);
    }
    variant.inventory = Math.max(0, variant.inventory - quantity);
  } else if (operation === 'restore') {
    variant.inventory += quantity;
  }

  // Update main product stock (sum of all variants)
  this.inventory = this.getVariantsStock();
  await this.updateAvailabilityStatus();

  await this.save();

  return {
    success: true,
    variantId,
    previousStock: originalStock,
    currentStock: variant.inventory,
    totalProductStock: this.inventory,
  };
};

// Bulk stock update for multiple products/variants
productSchema.statics.bulkStockUpdate = async function (stockUpdates) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const results = [];

    for (const update of stockUpdates) {
      const { productId, variantId, quantity, operation } = update;
      const product = await this.findById(productId).session(session);

      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      let result;
      if (variantId) {
        result = await product.updateVariantStock(variantId, quantity, operation);
      } else {
        result = await product.updateStockOnOrder(quantity, operation);
      }

      results.push({ productId, ...result });
    }

    await session.commitTransaction();
    return { success: true, results };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Log stock activities for audit trail
productSchema.methods.logStockActivity = async function (activity) {
  // This would typically save to a separate StockActivity collection
  // For now, we'll add it to product analytics
  if (!this.stockActivityLog) {
    this.stockActivityLog = [];
  }

  this.stockActivityLog.push({
    ...activity,
    timestamp: new Date(),
    productId: this._id,
  });

  // Keep only last 100 entries to prevent document bloat
  if (this.stockActivityLog.length > 100) {
    this.stockActivityLog = this.stockActivityLog.slice(-100);
  }
};

// Update availability status based on current stock
productSchema.methods.updateAvailabilityStatus = async function () {
  const totalStock = this.inventory + this.getVariantsStock();

  if (totalStock <= 0) {
    this.isAvailable = false;
    this.availability = 'Out of Stock';
  } else if (totalStock <= (this.lowStockThreshold || 0)) {
    this.isAvailable = true;
    this.availability = 'Low Stock';
  } else {
    this.isAvailable = true;
    this.availability = 'In Stock';
  }

  // Trigger low stock alerts
  if (totalStock <= (this.lowStockThreshold || 0) && totalStock > 0) {
    await this.triggerLowStockAlert();
  }
};

// Trigger low stock alert (webhook/notification)
productSchema.methods.triggerLowStockAlert = async function () {
  // Implementation would depend on your notification system
  console.log(`Low stock alert for product: ${this.title} (ID: ${this._id}), Stock: ${this.inventory}`);

  // You could emit an event here for your notification service
  // eventEmitter.emit('lowStock', { product: this });
};

productSchema.methods.applyDiscountCode = async function (discountCode, quantity = 1) {
  try {
    // This assumes you have a DiscountCode model
    const DiscountCode = mongoose.model('DiscountCode');
    const discount = await DiscountCode.findOne({
      code: discountCode,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    if (!discount) {
      return { success: false, message: 'Invalid or expired discount code' };
    }

    // Check if discount applies to this product
    if (!this.isDiscountApplicable(discount)) {
      return { success: false, message: 'Discount code not applicable to this product' };
    }

    // Check usage limits
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
      return { success: false, message: 'Discount code usage limit exceeded' };
    }

    // Calculate discount amount
    const basePrice = this.getFinalPrice(quantity);
    const discountAmount = this.calculateDiscountAmount(discount, basePrice, quantity);
    const finalPrice = Math.max(0, basePrice - discountAmount);

    return {
      success: true,
      originalPrice: basePrice,
      discountAmount,
      finalPrice,
      discountType: discount.type,
      discountCode: discountCode,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Check if discount is applicable to this product
productSchema.methods.isDiscountApplicable = function (discount) {
  // Check product-specific discounts
  if (discount.applicableProducts && discount.applicableProducts.length > 0) {
    return discount.applicableProducts.includes(this._id.toString());
  }

  // Check category-specific discounts
  if (discount.applicableCategories && discount.applicableCategories.length > 0) {
    const productCategories = this.categories.map((cat) => cat.toString());
    return discount.applicableCategories.some((cat) => productCategories.includes(cat.toString()));
  }

  // Check brand-specific discounts
  if (discount.applicableBrands && discount.applicableBrands.length > 0) {
    return discount.applicableBrands.includes(this.brand?.toString());
  }

  // Check tag-based discounts
  if (discount.applicableTags && discount.applicableTags.length > 0) {
    return this.tags.some((tag) => discount.applicableTags.includes(tag));
  }

  // Check minimum purchase amount
  if (discount.minimumPurchaseAmount && this.getFinalPrice() < discount.minimumPurchaseAmount) {
    return false;
  }

  // Check excluded products/categories
  if (discount.excludedProducts && discount.excludedProducts.includes(this._id.toString())) {
    return false;
  }

  if (discount.excludedCategories && discount.excludedCategories.length > 0) {
    const productCategories = this.categories.map((cat) => cat.toString());
    if (discount.excludedCategories.some((cat) => productCategories.includes(cat.toString()))) {
      return false;
    }
  }

  // If no specific rules, discount applies globally
  return discount.isGlobal || true;
};

// Calculate discount amount based on discount type
productSchema.methods.calculateDiscountAmount = function (discount, basePrice, quantity) {
  switch (discount.type) {
    case 'percentage':
      const percentageDiscount = basePrice * (discount.value / 100);
      return Math.min(percentageDiscount, discount.maxDiscountAmount || percentageDiscount);

    case 'fixed':
      return Math.min(discount.value, basePrice);

    case 'buy_x_get_y':
      const freeItems = Math.floor(quantity / discount.buyQuantity) * discount.getQuantity;
      return freeItems * (this.basePrice || 0);

    case 'tiered':
      // Implement tiered discount logic
      for (const tier of discount.tiers || []) {
        if (quantity >= tier.minQuantity) {
          return basePrice * (tier.discountPercentage / 100);
        }
      }
      return 0;

    default:
      return 0;
  }
};

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
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
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
  return (this.accessories && this.accessories.includes(otherProductId)) || (this.replacementParts && this.replacementParts.includes(otherProductId));
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
  return Array.isArray(this.images) ? this.images.filter((img) => img.type === type) : [];
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
  return Array.isArray(this.variants) ? this.variants.filter((v) => v.inventory > 0) : [];
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

// Get best applicable discount for product
productSchema.methods.getBestApplicableDiscount = async function (availableDiscounts, quantity = 1) {
  let bestDiscount = null;
  let maxSavings = 0;

  for (const discount of availableDiscounts) {
    if (this.isDiscountApplicable(discount)) {
      const basePrice = this.getFinalPrice(quantity);
      const savingsAmount = this.calculateDiscountAmount(discount, basePrice, quantity);

      if (savingsAmount > maxSavings) {
        maxSavings = savingsAmount;
        bestDiscount = {
          ...discount,
          savingsAmount,
          finalPrice: basePrice - savingsAmount,
        };
      }
    }
  }

  return bestDiscount;
};

// Apply automatic discounts based on product properties
productSchema.methods.applyAutomaticDiscounts = async function () {
  const automaticDiscounts = [];

  // Clearance discount for old inventory
  const daysSinceCreated = (new Date() - this.createdAt) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated > 90 && !this.discount) {
    automaticDiscounts.push({
      type: 'clearance',
      reason: 'Old inventory clearance',
      discountPercentage: 20,
    });
  }

  // Low stock urgency discount
  if (this.inventory <= (this.lowStockThreshold || 0) && this.inventory > 0) {
    automaticDiscounts.push({
      type: 'low_stock',
      reason: 'Low stock urgency',
      discountPercentage: 15,
    });
  }

  // Slow-moving inventory discount
  const averageDailySales = this.soldCount / Math.max(daysSinceCreated, 1);
  if (averageDailySales < 0.1 && daysSinceCreated > 30) {
    automaticDiscounts.push({
      type: 'slow_moving',
      reason: 'Slow-moving inventory',
      discountPercentage: 25,
    });
  }

  return automaticDiscounts;
};
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
  return this.discount && this.discountStartDate && this.discountEndDate && now >= this.discountStartDate && now <= this.discountEndDate;
};

// Get SEO data
productSchema.methods.getSEOData = function () {
  return {
    title: this.metaTitle || this.title,
    description: this.metaDescription || this.shortDescription,
    tags: this.tags,
  };
};
/* =========================
   📌 Instance Methods
   ========================= */

// Apply bulk discount based on quantity
productSchema.methods.getBulkDiscountPrice = function (quantity) {
  if (!this.bulkDiscounts || this.bulkDiscounts.length === 0) return this.calculateFinalPrice();
  const applicable = this.bulkDiscounts.filter((d) => quantity >= d.quantity).sort((a, b) => b.quantity - a.quantity)[0];
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
    _id: { $in: this.bundleContents.map((c) => c.product) },
  });
  return products.reduce((total, p, i) => {
    const qty = this.bundleContents[i].quantity;
    return total + p.calculateFinalPrice() * qty;
  }, 0);
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
    const applicable = this.bulkDiscounts.filter((d) => quantity >= d.quantity).sort((a, b) => b.quantity - a.quantity)[0];
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
// Track product interaction
productSchema.methods.trackInteraction = async function (type, metadata = {}) {
  const interaction = {
    type, // 'view', 'click', 'add_to_cart', 'purchase', 'share'
    timestamp: new Date(),
    metadata,
  };

  // Update counters
  switch (type) {
    case 'view':
      this.views += 1;
      this.total_view += 1;
      this.analytics.views += 1;
      break;
    case 'click':
      this.analytics.clicks += 1;
      break;
    case 'purchase':
      this.analytics.conversions += 1;
      break;
  }

  // Store detailed analytics (you might want to use a separate collection for this)
  if (!this.detailedAnalytics) {
    this.detailedAnalytics = [];
  }

  this.detailedAnalytics.push(interaction);

  // Keep only last 1000 interactions to prevent document bloat
  if (this.detailedAnalytics.length > 1000) {
    this.detailedAnalytics = this.detailedAnalytics.slice(-1000);
  }

  await this.save();
};
// Get analytics summary
productSchema.methods.getAnalyticsSummary = function (days = 30) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const recentInteractions = this.detailedAnalytics?.filter((interaction) => new Date(interaction.timestamp) >= cutoffDate) || [];

  const summary = recentInteractions.reduce((acc, interaction) => {
    acc[interaction.type] = (acc[interaction.type] || 0) + 1;
    return acc;
  }, {});

  return {
    period: `${days} days`,
    interactions: summary,
    conversionRate: summary.view ? (summary.purchase / summary.view) * 100 : 0,
    totalInteractions: recentInteractions.length,
  };
};

/* =========================
   📌 Static Methods
   ========================= */

// Apply brand-wide discount
productSchema.statics.applyBrandDiscount = async function (brandId, discountData) {
  const products = await this.find({
    brand: brandId,
    isDeleted: false,
    status: 'active',
  });

  const results = [];

  for (const product of products) {
    try {
      await product.applyPromotion(discountData);
      results.push({ productId: product._id, success: true });
    } catch (error) {
      results.push({ productId: product._id, success: false, error: error.message });
    }
  }

  return {
    totalProcessed: products.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
};
// Remove expired discounts
productSchema.statics.removeExpiredDiscounts = async function () {
  const now = new Date();
  return await this.updateMany(
    {
      discountEndDate: { $lt: now },
      $or: [{ discount: { $gt: 0 } }, { salePrice: { $exists: true, $ne: null } }],
    },
    {
      $unset: {
        discount: '',
        salePrice: '',
        discountStartDate: '',
        discountEndDate: '',
      },
    }
  );
};
// Batch operations
productSchema.statics.batchStatusUpdate = async function (productIds, status, updateData = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const updateObj = { status, updatedAt: new Date(), ...updateData };

    const result = await this.updateMany({ _id: { $in: productIds } }, { $set: updateObj }, { session });

    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
// Advanced search with AI-like features
productSchema.statics.intelligentSearch = async function (query, options = {}) {
  const { page = 1, limit = 20, sortBy = 'relevance', filters = {}, userContext = {} } = options;

  // Build search pipeline
  const pipeline = [];

  // Text search stage
  if (query) {
    pipeline.push({
      $match: {
        $text: { $search: query },
        ...filters,
      },
    });

    // Add relevance score
    pipeline.push({
      $addFields: {
        relevanceScore: { $meta: 'textScore' },
      },
    });
  }

  // Personalization based on user context
  if (userContext.previousPurchases) {
    pipeline.push({
      $addFields: {
        personalizedScore: {
          $cond: {
            if: { $in: ['$categories', userContext.preferredCategories || []] },
            then: { $add: ['$relevanceScore', 2] },
            else: '$relevanceScore',
          },
        },
      },
    });
  }

  // Sorting
  const sortStage = {};
  switch (sortBy) {
    case 'price_low':
      sortStage.basePrice = 1;
      break;
    case 'price_high':
      sortStage.basePrice = -1;
      break;
    case 'newest':
      sortStage.createdAt = -1;
      break;
    case 'rating':
      sortStage['reviews.averageRating'] = -1;
      break;
    case 'popularity':
      sortStage.soldCount = -1;
      break;
    default:
      sortStage.personalizedScore = -1;
      sortStage.relevanceScore = -1;
  }

  pipeline.push({ $sort: sortStage });

  // Pagination
  pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });

  const results = await this.aggregate(pipeline);
  const total = await this.countDocuments({ $text: { $search: query }, ...filters });

  return {
    results,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};
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
  return this.find({ $expr: { $lte: ['$currentStockLevel', '$lowStockLevel'] } });
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
productSchema.statics.getPaginatedProducts = async function ({ page = 1, limit = 10, filters = {}, populateOptions, sort = { createdAt: -1 } }) {
  const skip = (page - 1) * limit;
  const query = { ...filters, deletedAt: { $exists: false } }; // Added deletedAt filter
  const [results, total] = await Promise.all([this.find(query).sort(sort).skip(skip).limit(limit).populate(populateOptions), this.countDocuments(query)]);
  return { results, total, page, pages: Math.ceil(total / limit) };
};
// Update stock in bulk
productSchema.statics.bulkUpdateStock = function (updates) {
  const bulkOps = updates.map((u) => ({
    updateOne: {
      filter: { _id: u.id },
      update: { $set: { stock: u.stock, currentStockLevel: u.stock } },
    },
  }));
  return this.bulkWrite(bulkOps);
};
// Get products with active discounts
productSchema.statics.getActiveDiscountProducts = function () {
  const now = new Date();
  return this.find({
    discount: { $gt: 0 },
    discountStartDate: { $lte: now },
    discountEndDate: { $gte: now },
  });
};
productSchema.statics.getProductsByTag = function (tags, limit = 20) {
  return this.find({ tags: { $in: Array.isArray(tags) ? tags : [tags] }, status: 'active' }).limit(limit);
};
productSchema.statics.getNewArrivals = function (days = 30, limit = 10) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return this.find({ createdAt: { $gte: date }, status: 'active' })
    .sort({ createdAt: -1 })
    .limit(limit);
};
productSchema.statics.getProductsByPriceRange = function (minPrice, maxPrice, limit = 20) {
  return this.find({
    price: { $gte: minPrice, $lte: maxPrice },
    status: 'active',
  }).limit(limit);
};
productSchema.statics.archiveOldProducts = function (beforeDate) {
  return this.updateMany({ createdAt: { $lt: beforeDate }, status: { $ne: 'archived' } }, { $set: { status: 'archived' } });
};
productSchema.statics.getAverageRatingByCategory = async function (categoryId) {
  const products = await this.find({ categories: categoryId }).populate('reviews');
  const ratings = products.map((p) => p.ratingStatistics.averageRating).filter((r) => r > 0);
  return ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0;
};
// Apply category-wide discount
productSchema.statics.applyCategoryDiscount = async function (categoryId, discountData) {
  const products = await this.find({ categories: categoryId, isDeleted: false });
  const results = [];

  for (const product of products) {
    try {
      await product.applyPromotion(discountData);
      results.push({ productId: product._id, success: true });
    } catch (error) {
      results.push({ productId: product._id, success: false, error: error.message });
    }
  }

  return results;
};
// Remove expired discounts
productSchema.statics.removeExpiredDiscounts = async function () {
  const now = new Date();
  return await this.updateMany(
    {
      discountEndDate: { $lt: now },
      $or: [{ discount: { $gt: 0 } }, { salePrice: { $exists: true, $ne: null } }],
    },
    {
      $unset: {
        discount: '',
        salePrice: '',
        discountStartDate: '',
        discountEndDate: '',
      },
    }
  );
};
productSchema.statics.generateSchemaReport = function () {
  const schemaFields = Object.entries(this.schema.paths).map(([path, field]) => ({
    name: path,
    type: field.instance,
    required: field.isRequired || false,
    default: field.defaultValue || null,
    enum: field.enumValues || null,
    ref: field.options.ref || null,
    min: field.options.min || null,
    unique: field.options.unique || false,
  }));

  const instanceMethods = Object.keys(this.schema.methods);
  const staticMethods = Object.keys(this.schema.statics);
  const virtuals = Object.keys(this.schema.virtuals);
  const indexes = this.schema.indexes().map((index) => ({
    fields: Object.keys(index[0]),
    options: index[1],
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
      preSave: !!this.schema.pre('save'),
    },
  };
};
(productSchema.statics.advancedFilter = async function (queryParams = {}) {
  try {
    const params = this._validateAndSanitizeParams(queryParams);
    const pipeline = this._buildAdvancedPipeline(params);

    // Execute with timeout and memory limits
    const results = await this.aggregate(pipeline)
      .maxTimeMS(30000) // 30 second timeout
      .allowDiskUse(true) // Allow disk usage for large datasets
      .exec();

    return this._formatFilterResults(results[0], params);
  } catch (error) {
    throw new Error(`Advanced filtering failed: ${error.message}`);
  }
}),
  (productSchema.statics.generateDatabaseStatistics = async function () {
    const [totalProducts, statusCounts, productTypeCounts, availabilityCounts, priceStats, stockStats, discountStats, reviewStats, categoryStats, tagStats, bundleStats, featuredStats, ecoFriendlyStats, giftCardStats, preOrderStats, subscriptionStats] = await Promise.all([
      this.countDocuments({ deletedAt: { $exists: false } }),
      this.aggregate([{ $match: { deletedAt: { $exists: false } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.aggregate([{ $match: { deletedAt: { $exists: false } } }, { $group: { _id: '$productType', count: { $sum: 1 } } }]),
      this.aggregate([{ $match: { deletedAt: { $exists: false } } }, { $group: { _id: '$availability', count: { $sum: 1 } } }]),
      this.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        {
          $group: {
            _id: null,
            avgPrice: { $avg: '$price' },
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            totalPrice: { $sum: '$price' },
          },
        },
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
            outOfStockCount: { $sum: { $cond: [{ $eq: ['$isAvailable', false] }, 1, 0] } },
          },
        },
      ]),
      this.aggregate([
        { $match: { deletedAt: { $exists: false }, discount: { $gt: 0 }, discountStartDate: { $lte: new Date() }, discountEndDate: { $gte: new Date() } } },
        {
          $group: {
            _id: null,
            discountedProducts: { $sum: 1 },
            avgDiscount: { $avg: '$discount' },
            maxDiscount: { $max: '$discount' },
            totalDiscountedValue: { $sum: { $multiply: ['$price', '$discount', 0.01] } },
          },
        },
      ]),
      this.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        { $lookup: { from: 'reviews', localField: 'reviews', foreignField: '_id', as: 'reviewsData' } },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: { $size: '$reviewsData' } },
            avgRating: { $avg: { $avg: '$reviewsData.rating' } },
          },
        },
      ]),
      this.aggregate([{ $match: { deletedAt: { $exists: false } } }, { $unwind: '$categories' }, { $group: { _id: '$categories', count: { $sum: 1 } } }, { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'categoryData' } }, { $project: { _id: 0, categoryId: '$_id', categoryName: { $arrayElemAt: ['$categoryData.name', 0] }, count: 1 } }]),
      this.aggregate([{ $match: { deletedAt: { $exists: false } } }, { $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } }]),
      this.countDocuments({ productBundle: true, deletedAt: { $exists: false } }),
      this.countDocuments({ isFeatured: true, deletedAt: { $exists: false } }),
      this.countDocuments({ ecoFriendly: true, deletedAt: { $exists: false } }),
      this.countDocuments({ isGiftCard: true, deletedAt: { $exists: false } }),
      this.countDocuments({ preOrder: true, deletedAt: { $exists: false } }),
      this.countDocuments({ isSubscription: true, deletedAt: { $exists: false } }),
    ]);

    return {
      totalProducts,
      statusDistribution: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      productTypeDistribution: productTypeCounts.reduce((acc, t) => ({ ...acc, [t._id]: t.count }), {}),
      availabilityDistribution: availabilityCounts.reduce((acc, a) => ({ ...acc, [a._id]: a.count }), {}),
      priceStatistics: priceStats[0]
        ? {
            averagePrice: priceStats[0].avgPrice,
            minPrice: priceStats[0].minPrice,
            maxPrice: priceStats[0].maxPrice,
            totalPrice: priceStats[0].totalPrice,
          }
        : { averagePrice: 0, minPrice: 0, maxPrice: 0, totalPrice: 0 },
      stockStatistics: stockStats[0]
        ? {
            totalStock: stockStats[0].totalStock,
            averageStock: stockStats[0].avgStock,
            minStock: stockStats[0].minStock,
            maxStock: stockStats[0].maxStock,
            lowStockCount: stockStats[0].lowStockCount,
            outOfStockCount: stockStats[0].outOfStockCount,
          }
        : { totalStock: 0, averageStock: 0, minStock: 0, maxStock: 0, lowStockCount: 0, outOfStockCount: 0 },
      discountStatistics: discountStats[0]
        ? {
            discountedProducts: discountStats[0].discountedProducts,
            averageDiscount: discountStats[0].avgDiscount,
            maxDiscount: discountStats[0].maxDiscount,
            totalDiscountedValue: discountStats[0].totalDiscountedValue,
          }
        : { discountedProducts: 0, averageDiscount: 0, maxDiscount: 0, totalDiscountedValue: 0 },
      reviewStatistics: reviewStats[0]
        ? {
            totalReviews: reviewStats[0].totalReviews,
            averageRating: reviewStats[0].avgRating || 0,
          }
        : { totalReviews: 0, averageRating: 0 },
      categoryDistribution: categoryStats,
      tagDistribution: tagStats.reduce((acc, t) => ({ ...acc, [t._id]: t.count }), {}),
      bundleStatistics: { bundleProducts: bundleStats },
      featuredStatistics: { featuredProducts: featuredStats },
      ecoFriendlyStatistics: { ecoFriendlyProducts: ecoFriendlyStats },
      giftCardStatistics: { giftCardProducts: giftCardStats },
      preOrderStatistics: { preOrderProducts: preOrderStats },
      subscriptionStatistics: { subscriptionProducts: subscriptionStats },
    };
  });

productSchema.static._validateAndSanitizeParams = async function (params) {
  const {
    // Pagination
    page = 1,
    limit = 20,

    // Sorting
    sort,

    // Search
    search,
    searchFields,
    searchMode = 'fuzzy',

    // Filtering
    filters = {},

    // Advanced options
    facets = false,
    aggregations = false,
    projection,
    includeInactive = false,
    includeStats = false,

    // Performance options
    lean = true,
    explain = false,
    timeout = 30000,
  } = params;

  // Validate and sanitize pagination
  const validatedPage = Math.max(1, Math.min(parseInt(page) || 1, 10000));
  const validatedLimit = Math.max(1, Math.min(parseInt(limit) || 20, 1000));

  // Validate sort fields
  const allowedSortFields = ['title', 'basePrice', 'salePrice', 'comparePrice', 'retailPrice', 'createdAt', 'updatedAt', 'publishDate', 'lastRestocked', 'soldCount', 'views', 'total_view', 'inventory', 'reviews.averageRating', 'reviews.totalReviews', 'analytics.views', 'analytics.clicks', 'analytics.conversions', 'discountValue', 'loyaltyPoints'];

  const validatedSort = this._parseSort(sort, allowedSortFields);

  // Validate search parameters
  const validatedSearch = search ? String(search).trim().substring(0, 200) : null;
  const validatedSearchFields = this._validateSearchFields(searchFields);

  // Validate and sanitize filters
  const validatedFilters = this._validateFilters(filters, includeInactive);

  // Validate projection
  const validatedProjection = this._validateProjection(projection);

  return {
    page: validatedPage,
    limit: validatedLimit,
    sort: validatedSort,
    search: validatedSearch,
    searchFields: validatedSearchFields,
    searchMode,
    filters: validatedFilters,
    facets: Boolean(facets),
    aggregations: Boolean(aggregations),
    projection: validatedProjection,
    includeInactive: Boolean(includeInactive),
    includeStats: Boolean(includeStats),
    lean: Boolean(lean),
    explain: Boolean(explain),
    timeout: Math.min(parseInt(timeout) || 30000, 60000),
  };
};
productSchema.static._parseSort = async function (sortParam, allowedFields) {
  if (!sortParam) return { createdAt: -1 };

  const sortObj = {};
  const sortFields = String(sortParam).split(',');

  for (const field of sortFields) {
    let cleanField = field.trim();
    let direction = 1;

    // Handle direction prefixes
    if (cleanField.startsWith('-')) {
      direction = -1;
      cleanField = cleanField.substring(1);
    } else if (cleanField.startsWith('+')) {
      cleanField = cleanField.substring(1);
    }

    // Validate field name
    if (allowedFields.includes(cleanField)) {
      sortObj[cleanField] = direction;
    }
  }

  return Object.keys(sortObj).length > 0 ? sortObj : { createdAt: -1 };
};
productSchema.static._validateSearchFields = async function (fields) {
  // const allowedSearchFields = [
  //   'title', 'shortDescription', 'descriptions', 'tags', 'sku',
  //   'brand', 'manufacturer', 'model', 'features', 'overview',
  //   'metaTitle', 'metaDescription', 'seo_info.title', 'seo_info.description'
  // ];

  if (!fields) {
    // 2. Fallback to DEFAULT_SEARCH_FIELDS when none provided
    return DEFAULT_SEARCH_FIELDS;
  }

  const fieldArray = Array.isArray(fields) ? fields : fields.split(',');
  return fieldArray
    .map((f) => f.trim())
    .filter((f) => DEFAULT_SEARCH_FIELDS.includes(f))
    .slice(0, 10); // Limit to 10 search fields
};
productSchema.static._validateFilters = async function (filters, includeInactive) {
  if (!filters || typeof filters !== 'object') return {};

  const validatedFilters = {};

  // Status filtering (security critical)
  if (!includeInactive) {
    validatedFilters.status = { $in: ['active', 'published'] };
    validatedFilters.isAvailable = true;
  }

  // Filter validation map
  const filterValidators = {
    // Basic text fields
    status: (val) => (['active', 'inactive', 'draft', 'pending', 'archived', 'published'].includes(val) ? val : null),
    productType: (val) => (['physical', 'digital', 'service'].includes(val) ? val : null),
    visibility: (val) => (['public', 'private', 'password'].includes(val) ? val : null),
    availability: (val) => (typeof val === 'string' ? val : null),

    // ObjectId references
    category: (val) => (mongoose.isValidObjectId(val) ? new mongoose.Types.ObjectId(val) : null),
    brand: (val) => (mongoose.isValidObjectId(val) ? new mongoose.Types.ObjectId(val) : null),
    created_by: (val) => (mongoose.isValidObjectId(val) ? new mongoose.Types.ObjectId(val) : null),

    // Categories array
    categories: (val) => {
      const ids = Array.isArray(val) ? val : [val];
      const validIds = ids
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id))
        .slice(0, 50);
      return validIds.length ? { $in: validIds } : null;
    },

    // Price range filters
    basePrice: (val) => this._parseRange(val),
    salePrice: (val) => this._parseRange(val),
    comparePrice: (val) => this._parseRange(val),
    retailPrice: (val) => this._parseRange(val),
    costPrice: (val) => this._parseRange(val),
    discountValue: (val) => this._parseRange(val),

    // Boolean filters
    isFeatured: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    trending: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    newArrival: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    bestseller: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    onSale: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    isAvailable: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    ecoFriendly: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    limitedEdition: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    preOrder: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    backorder: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    discontinued: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    isGiftCard: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    productBundle: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    giftWrappingAvailable: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    isSubscription: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    virtualProduct: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    virtualTryOnEnabled: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),
    augmentedRealityEnabled: (val) => (typeof val === 'boolean' ? val : val === 'true' ? true : val === 'false' ? false : null),

    // Numeric range filters
    inventory: (val) => this._parseRange(val),
    soldCount: (val) => this._parseRange(val),
    views: (val) => this._parseRange(val),
    total_view: (val) => this._parseRange(val),
    weight: (val) => this._parseRange(val),
    shippingWeight: (val) => this._parseRange(val),
    loyaltyPoints: (val) => this._parseRange(val),
    purchaseLimit: (val) => this._parseRange(val),
    returnPeriod: (val) => this._parseRange(val),

    // Rating filters
    'reviews.averageRating': (val) => this._parseRange(val, 0, 5),
    'reviews.totalReviews': (val) => this._parseRange(val),

    // Analytics filters
    'analytics.views': (val) => this._parseRange(val),
    'analytics.clicks': (val) => this._parseRange(val),
    'analytics.conversions': (val) => this._parseRange(val),

    // Array filters
    tags: (val) => {
      const tags = Array.isArray(val) ? val : [val];
      return tags.length ? { $in: tags.slice(0, 50) } : null;
    },
    features: (val) => {
      const features = Array.isArray(val) ? val : [val];
      return features.length ? { $in: features.slice(0, 20) } : null;
    },
    certifications: (val) => {
      const certs = Array.isArray(val) ? val : [val];
      return certs.length ? { $in: certs.slice(0, 20) } : null;
    },
    allergens: (val) => {
      const allergens = Array.isArray(val) ? val : [val];
      return allergens.length ? { $in: allergens.slice(0, 20) } : null;
    },

    // String filters with exact/partial matching
    vendor: (val) => (typeof val === 'string' ? new RegExp(val.trim(), 'i') : null),
    manufacturer: (val) => (typeof val === 'string' ? new RegExp(val.trim(), 'i') : null),
    model: (val) => (typeof val === 'string' ? new RegExp(val.trim(), 'i') : null),
    material: (val) => (typeof val === 'string' ? new RegExp(val.trim(), 'i') : null),
    color: (val) => (typeof val === 'string' ? new RegExp(val.trim(), 'i') : null),
    size: (val) => (typeof val === 'string' ? new RegExp(val.trim(), 'i') : null),
    ageGroup: (val) => (typeof val === 'string' ? val.trim() : null),
    gender: (val) => (typeof val === 'string' ? val.trim() : null),
    season: (val) => (typeof val === 'string' ? val.trim() : null),
    occasion: (val) => (typeof val === 'string' ? val.trim() : null),
    style: (val) => (typeof val === 'string' ? val.trim() : null),
    pattern: (val) => (typeof val === 'string' ? val.trim() : null),

    // Date filters
    createdAt: (val) => this._parseDateRange(val),
    updatedAt: (val) => this._parseDateRange(val),
    publishDate: (val) => this._parseDateRange(val),
    expiryDate: (val) => this._parseDateRange(val),
    lastRestocked: (val) => this._parseDateRange(val),
    discountStartDate: (val) => this._parseDateRange(val),
    discountEndDate: (val) => this._parseDateRange(val),
    preOrderDate: (val) => this._parseDateRange(val),

    // Custom attributes (Map field)
    customAttributes: (val) => {
      if (typeof val !== 'object') return null;
      const customFilters = {};
      for (const [key, value] of Object.entries(val)) {
        if (key.length <= 50 && typeof value === 'string' && value.length <= 200) {
          customFilters[`customAttributes.${key}`] = new RegExp(value, 'i');
        }
      }
      return Object.keys(customFilters).length ? customFilters : null;
    },

    // Specifications (Map field)
    specifications: (val) => {
      if (typeof val !== 'object') return null;
      const specFilters = {};
      for (const [key, value] of Object.entries(val)) {
        if (key.length <= 50 && typeof value === 'string' && value.length <= 200) {
          specFilters[`specifications.${key}`] = new RegExp(value, 'i');
        }
      }
      return Object.keys(specFilters).length ? specFilters : null;
    },
  };

  // Apply filters
  for (const [key, value] of Object.entries(filters)) {
    if (filterValidators[key]) {
      const validatedValue = filterValidators[key](value);
      if (validatedValue !== null && validatedValue !== undefined) {
        if (key === 'customAttributes' || key === 'specifications') {
          Object.assign(validatedFilters, validatedValue);
        } else {
          validatedFilters[key] = validatedValue;
        }
      }
    }
  }

  return validatedFilters;
};
productSchema.static._parseRange = async function (value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!value) return null;

  const range = {};

  if (typeof value === 'object') {
    if (typeof value.min === 'number' && value.min >= min) {
      range.$gte = value.min;
    }
    if (typeof value.max === 'number' && value.max <= max) {
      range.$lte = value.max;
    }
  } else if (typeof value === 'number' && value >= min && value <= max) {
    range.$eq = value;
  }

  return Object.keys(range).length > 0 ? range : null;
};
productSchema.static._parseDateRange = async function (value) {
  if (!value) return null;

  const range = {};

  if (typeof value === 'object') {
    if (value.start) {
      const startDate = new Date(value.start);
      if (!isNaN(startDate.getTime())) {
        range.$gte = startDate;
      }
    }
    if (value.end) {
      const endDate = new Date(value.end);
      if (!isNaN(endDate.getTime())) {
        range.$lte = endDate;
      }
    }
  }

  return Object.keys(range).length > 0 ? range : null;
};
productSchema.static._validateProjection = async function (projection) {
  if (!projection) return null;

  const allowedFields = ['_id', 'title', 'sku', 'productType', 'category', 'subcategory', 'vendor', 'manufacturer', 'model', 'shortDescription', 'material', 'color', 'size', 'basePrice', 'salePrice', 'comparePrice', 'retailPrice', 'discount', 'discountType', 'discountValue', 'inventory', 'mainImage', 'images', 'status', 'isAvailable', 'isFeatured', 'trending', 'newArrival', 'bestseller', 'onSale', 'reviews', 'tags', 'brand', 'createdAt', 'updatedAt'];

  const projectionObj = {};
  const fields = typeof projection === 'string' ? projection.split(',') : [];

  for (const field of fields) {
    const cleanField = field.trim();
    if (allowedFields.includes(cleanField)) {
      projectionObj[cleanField] = 1;
    }
  }

  return Object.keys(projectionObj).length > 0 ? projectionObj : null;
};
productSchema.static._buildAdvancedPipeline = async function (params) {
  const { page, limit, sort, search, searchFields, searchMode, filters, facets, aggregations, projection, includeStats, explain } = params;

  const pipeline = [];

  // 1. Initial match stage (performance critical - most restrictive first)
  if (Object.keys(filters).length > 0) {
    pipeline.push({ $match: filters });
  }

  // 2. Text/fuzzy search stage
  if (search) {
    const searchStage = this._buildSearchStage(search, searchFields, searchMode);
    if (searchStage) {
      pipeline.push(searchStage);
    }
  }

  // 3. Lookups for referenced collections (optimized order)
  pipeline.push(
    // Category lookup
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryInfo',
        pipeline: [{ $project: { name: 1, slug: 1, image: 1 } }],
      },
    },
    // Brand lookup
    {
      $lookup: {
        from: 'brands',
        localField: 'brand',
        foreignField: '_id',
        as: 'brandInfo',
        pipeline: [{ $project: { name: 1, logo: 1, slug: 1 } }],
      },
    }
  );

  // 4. Add computed fields
  pipeline.push({
    $addFields: {
      finalPrice: {
        $cond: {
          if: { $and: [{ $ne: ['$salePrice', null] }, { $gt: ['$salePrice', 0] }] },
          then: '$salePrice',
          else: '$basePrice',
        },
      },
      hasDiscount: {
        $cond: {
          if: { $and: [{ $ne: ['$salePrice', null] }, { $lt: ['$salePrice', '$basePrice'] }] },
          then: true,
          else: false,
        },
      },
      discountPercentage: {
        $cond: {
          if: { $and: [{ $ne: ['$salePrice', null] }, { $lt: ['$salePrice', '$basePrice'] }] },
          then: {
            $round: [{ $multiply: [{ $divide: [{ $subtract: ['$basePrice', '$salePrice'] }, '$basePrice'] }, 100] }, 2],
          },
          else: 0,
        },
      },
      stockStatus: {
        $cond: {
          if: { $eq: ['$inventory', 0] },
          then: 'out-of-stock',
          else: {
            $cond: {
              if: { $lte: ['$inventory', '$lowStockThreshold'] },
              then: 'low-stock',
              else: 'in-stock',
            },
          },
        },
      },
      categoryName: { $arrayElemAt: ['$categoryInfo.name', 0] },
      brandName: { $arrayElemAt: ['$brandInfo.name', 0] },
    },
  });

  // 5. Faceted aggregation using $facet
  const facetStages = {
    // Main data with pagination
    data: [...(projection ? [{ $project: projection }] : []), { $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit }],

    // Total count
    totalCount: [{ $count: 'count' }],
  };

  // Add facets if requested
  if (facets) {
    facetStages.facets = [
      {
        $group: {
          _id: null,
          categories: {
            $addToSet: {
              $cond: {
                if: { $ne: ['$categoryInfo', []] },
                then: {
                  _id: '$category',
                  name: { $arrayElemAt: ['$categoryInfo.name', 0] },
                  count: 1,
                },
                else: '$$REMOVE',
              },
            },
          },
          brands: {
            $addToSet: {
              $cond: {
                if: { $ne: ['$brandInfo', []] },
                then: {
                  _id: '$brand',
                  name: { $arrayElemAt: ['$brandInfo.name', 0] },
                  count: 1,
                },
                else: '$$REMOVE',
              },
            },
          },
          priceRange: {
            $push: {
              min: { $min: '$basePrice' },
              max: { $max: '$basePrice' },
              avg: { $avg: '$basePrice' },
            },
          },
          productTypes: { $addToSet: '$productType' },
          avgRating: { $avg: '$reviews.averageRating' },
          totalProducts: { $sum: 1 },
          inStock: { $sum: { $cond: [{ $gt: ['$inventory', 0] }, 1, 0] } },
          onSale: { $sum: { $cond: ['$onSale', 1, 0] } },
          featured: { $sum: { $cond: ['$isFeatured', 1, 0] } },
        },
      },
    ];
  }

  // Add aggregations if requested
  if (aggregations) {
    facetStages.aggregations = [
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $multiply: ['$basePrice', '$soldCount'] } },
          avgPrice: { $avg: '$basePrice' },
          totalInventory: { $sum: '$inventory' },
          totalSold: { $sum: '$soldCount' },
          avgRating: { $avg: '$reviews.averageRating' },
          totalViews: { $sum: '$views' },
          conversionRate: {
            $cond: {
              if: { $gt: ['$views', 0] },
              then: { $divide: ['$soldCount', '$views'] },
              else: 0,
            },
          },
        },
      },
    ];
  }

  // Add stats if requested
  if (includeStats) {
    facetStages.stats = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgPrice: { $avg: '$basePrice' },
          totalInventory: { $sum: '$inventory' },
        },
      },
    ];
  }

  pipeline.push({ $facet: facetStages });

  return pipeline;
};
productSchema.static._buildSearchStage = async function (search, searchFields, searchMode) {
  const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const searchConditions = searchFields.map((field) => {
    if (field === 'descriptions') {
      return { 'descriptions.content': searchRegex };
    } else if (field.includes('.')) {
      return { [field]: searchRegex };
    } else {
      return { [field]: searchRegex };
    }
  });

  if (searchMode === 'exact') {
    return {
      $match: {
        $or: searchFields.map((field) => ({ [field]: search })),
      },
    };
  } else if (searchMode === 'fuzzy') {
    return {
      $match: {
        $or: searchConditions,
      },
    };
  } else {
    // Default partial matching
    return {
      $match: {
        $or: searchConditions,
      },
    };
  }
};
productSchema.statics._formatFilterResults = async function (result, params) {
  const data = result?.data || [];
  const totalCount = result?.totalCount?.[0]?.count || 0;
  const facets = result?.facets?.[0] || null;
  const aggregations = result?.aggregations?.[0] || null;
  const stats = result?.stats || null;

  const totalPages = Math.ceil(totalCount / params.limit);
  const hasNextPage = params.page < totalPages;
  const hasPrevPage = params.page > 1;

  return {
    success: true,
    data,
    pagination: {
      currentPage: params.page,
      totalPages,
      totalItems: totalCount,
      itemsPerPage: params.limit,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? params.page + 1 : null,
      prevPage: hasPrevPage ? params.page - 1 : null,
    },
    filters: params.filters,
    sort: params.sort,
    search: params.search,
    ...(facets && { facets }),
    ...(aggregations && { aggregations }),
    ...(stats && { stats }),
  };
};
productSchema.statics.getCompleteProductDashboardStatistics = async function () {
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [
      totalProducts,
      activeProducts,
      deletedProducts,
      draftProducts,
      publishedProducts,
      featuredProducts,
      trendingProducts,
      newArrivals,
      bestsellers,
      productsOnSale,
      outOfStockCount,
      lowStockCount,
      healthyStockCount,
      autoRestockCount,
      productsWithSales,
      productsWithoutSales,
      productsWithDiscounts,
      productsWithReviews,
      ecoFriendlyCount,
      lowStockProductsCount,
      thisMonthProducts,
      totalBrands,      // New
      totalCategories   // New
    ] = await Promise.all([
      Product.countDocuments({}), // Total products
      Product.countDocuments({ status: 'active', isDeleted: false }),
      Product.countDocuments({ isDeleted: true }),
      Product.countDocuments({ status: 'draft' }),
      Product.countDocuments({ status: 'published' }),
      Product.countDocuments({ isFeatured: true }),
      Product.countDocuments({ trending: true }),
      Product.countDocuments({ newArrival: true }),
      Product.countDocuments({ bestseller: true }),
      Product.countDocuments({ onSale: true }),

      // Inventory-related counts
      Product.countDocuments({ inventory: 0, isDeleted: false }),
      Product.countDocuments({
        $expr: { $and: [{ $lt: ['$inventory', '$lowStockThreshold'] }, { $gt: ['$inventory', 0] }] },
        isDeleted: false,
      }),
      Product.countDocuments({ $expr: { $gte: ['$inventory', '$lowStockThreshold'] }, isDeleted: false }),
      Product.countDocuments({ autoRestockEnabled: true }),

      // Sales and discount-related counts
      Product.countDocuments({ soldCount: { $gt: 0 }, isDeleted: false }),
      Product.countDocuments({ soldCount: 0, isDeleted: false }),
      Product.countDocuments({ discountType: { $ne: 'none' }, isDeleted: false }),

      // Engagement and attributes
      Product.countDocuments({ 'reviews.totalReviews': { $gt: 0 }, isDeleted: false }),
      Product.countDocuments({ ecoFriendly: true, isDeleted: false }),

      // Enhanced stats
      Product.countDocuments({
        $expr: { $and: [{ $lt: ['$inventory', '$lowStockThreshold'] }, { $gt: ['$inventory', 0] }] },
        isDeleted: false,
      }),
      Product.countDocuments({
        createdAt: { $gte: startOfMonth },
        isDeleted: false,
      }),

      // New additions
      Brand.countDocuments({}),      // Total brands
      Category.countDocuments({})    // Total categories
    ]);

    return {
      totalProducts,
      activeProducts,
      deletedProducts,
      draftProducts,
      publishedProducts,
      featuredProducts,
      trendingProducts,
      newArrivals,
      bestsellers,
      productsOnSale,
      outOfStockCount,
      lowStockCount,
      healthyStockCount,
      autoRestockCount,
      productsWithSales,
      productsWithoutSales,
      productsWithDiscounts,
      productsWithReviews,
      ecoFriendlyCount,
      lowStockProductsCount,
      thisMonthProducts,
      totalBrands,       // New
      totalCategories    // New
    };
  } catch (error) {
    console.error('Error fetching product dashboard counts:', error);
    throw error;
  }
};


const Product = mongoose.model('Product', productSchema);
module.exports = Product;
