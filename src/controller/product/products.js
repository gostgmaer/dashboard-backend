const Product = require('../../models/products');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

// CRUD Operations
exports.createProduct = catchAsync(async (req, res) => {
  const product = new Product(req.body);
  await product.save();
  return sendCreated(res, { data: product, message: 'Product created successfully' });
});

exports.getProducts = catchAsync(async (req, res) => {
  if (!Product.getPaginatedProducts) {
    throw AppError.internal('Server configuration error: getPaginatedProducts method not found');
  }

  const { page, limit, status, productType, category, minPrice, maxPrice } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (productType) filters.productType = productType;
  if (category) filters.categories = category;
  if (minPrice || maxPrice) {
    filters.price = {};
    if (minPrice) filters.price.$gte = Number(minPrice);
    if (maxPrice) filters.price.$lte = Number(maxPrice);
  }
  const result = await Product.getPaginatedProducts({
    page: Number(page) || 1,
    limit: Number(limit) || 20,
    filters,
    sort: { createdAt: -1 },
  });
  return sendSuccess(res, { data: result, message: 'Products retrieved' });
});

exports.getProductByIdOrSlug = catchAsync(async (req, res) => {
  const { identifier } = req.params;
  const product = await Product.findOne({
    $or: [{ _id: identifier }, { slug: identifier }],
    deletedAt: { $exists: false },
  }).populate('categories brand reviews relatedProducts');
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  return sendSuccess(res, { data: product, message: 'Product retrieved' });
});

exports.updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  return sendSuccess(res, { data: product, message: 'Product updated successfully' });
});

exports.deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  await Product.bulkDelete([id]);
  return sendSuccess(res, { message: 'Product deleted successfully' });
});

// Bulk Operations
exports.bulkDeleteProducts = catchAsync(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Invalid or empty IDs array');
  }
  await Product.bulkDelete(ids);
  return sendSuccess(res, { message: 'Products deleted successfully' });
});

exports.bulkUpdateStatus = catchAsync(async (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !status) {
    throw AppError.badRequest('Invalid input: ids and status required');
  }
  if (!['active', 'inactive', 'draft', 'pending', 'archived', 'published'].includes(status)) {
    throw AppError.badRequest('Invalid status value');
  }
  await Product.bulkUpdateStatus(ids, status);
  return sendSuccess(res, { message: 'Product statuses updated successfully' });
});

exports.bulkUpdateStock = catchAsync(async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    throw AppError.badRequest('Invalid or empty updates array');
  }
  if (updates.some((u) => !u.id || u.stock < 0)) {
    throw AppError.badRequest('Invalid stock updates');
  }
  await Product.bulkUpdateStock(updates);
  return sendSuccess(res, { message: 'Product stocks updated successfully' });
});

// Static Method Endpoints
exports.searchProducts = catchAsync(async (req, res) => {
  const { keyword } = req.params;
  const { limit } = req.query;
  const products = await Product.searchProducts(keyword, Number(limit) || 20);
  return sendSuccess(res, { data: products, message: 'Search completed' });
});

exports.getFeaturedProducts = catchAsync(async (req, res) => {
  const { limit } = req.query;
  const products = await Product.getFeaturedProducts(Number(limit) || 10);
  return sendSuccess(res, { data: products, message: 'Featured products retrieved' });
});

exports.getLowStockProducts = catchAsync(async (req, res) => {
  const products = await Product.getLowStockProducts();
  return sendSuccess(res, { data: products, message: 'Low stock products retrieved' });
});

exports.getOutOfStockProducts = catchAsync(async (req, res) => {
  const products = await Product.getOutOfStockProducts();
  return sendSuccess(res, { data: products, message: 'Out-of-stock products retrieved' });
});

exports.getProductsByCategory = catchAsync(async (req, res) => {
  const { categoryId } = req.params;
  const products = await Product.getByCategory(categoryId);
  return sendSuccess(res, { data: products, message: 'Products by category retrieved' });
});

exports.getProductsByTag = catchAsync(async (req, res) => {
  const { tags } = req.params;
  const { limit } = req.query;
  const products = await Product.getProductsByTag(tags.split(','), Number(limit) || 20);
  return sendSuccess(res, { data: products, message: 'Products by tags retrieved' });
});

exports.getNewArrivals = catchAsync(async (req, res) => {
  const { days, limit } = req.query;
  const products = await Product.getNewArrivals(Number(days) || 30, Number(limit) || 10);
  return sendSuccess(res, { data: products, message: 'New arrivals retrieved' });
});

exports.getProductsByPriceRange = catchAsync(async (req, res) => {
  const { minPrice, maxPrice, limit } = req.query;
  const products = await Product.getProductsByPriceRange(Number(minPrice) || 0, Number(maxPrice) || Infinity, Number(limit) || 20);
  return sendSuccess(res, { data: products, message: 'Products by price range retrieved' });
});

exports.getTopSellingProducts = catchAsync(async (req, res) => {
  const { limit } = req.query;
  const products = await Product.getTopSelling(Number(limit) || 10);
  return sendSuccess(res, { data: products, message: 'Top-selling products retrieved' });
});

exports.getMostViewedProducts = catchAsync(async (req, res) => {
  const { limit } = req.query;
  const products = await Product.getMostViewed(Number(limit) || 10);
  return sendSuccess(res, { data: products, message: 'Most-viewed products retrieved' });
});

exports.getActiveDiscountProducts = catchAsync(async (req, res) => {
  const products = await Product.getActiveDiscountProducts();
  return sendSuccess(res, { data: products, message: 'Discounted products retrieved' });
});

exports.getAverageRatingByCategory = catchAsync(async (req, res) => {
  const { categoryId } = req.params;
  const averageRating = await Product.getAverageRatingByCategory(categoryId);
  return sendSuccess(res, { data: { categoryId, averageRating }, message: 'Average rating retrieved' });
});

exports.archiveOldProducts = catchAsync(async (req, res) => {
  const { beforeDate } = req.body;
  if (!beforeDate) {
    throw AppError.badRequest('beforeDate is required');
  }
  await Product.archiveOldProducts(new Date(beforeDate));
  return sendSuccess(res, { message: 'Old products archived successfully' });
});

// Instance Method Endpoints
exports.getSimplifiedImages = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const images = product.getSimplifiedImages();
  return sendSuccess(res, { data: images, message: 'Images retrieved' });
});

exports.getFinalPrice = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.query;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const finalPrice = product.getFinalPrice(Number(quantity) || 1);
  return sendSuccess(res, { data: { finalPrice }, message: 'Final price retrieved' });
});

exports.getStockStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const stockStatus = product.getStockStatus();
  return sendSuccess(res, { data: { stockStatus }, message: 'Stock status retrieved' });
});

exports.markAsOutOfStock = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  product.markAsOutOfStock();
  await product.save();
  return sendSuccess(res, { message: 'Product marked as out of stock' });
});

exports.incrementProductViews = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  product.incrementViews();
  await product.save();
  return sendSuccess(res, { message: 'Product views incremented' });
});

exports.incrementSold = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  if (!quantity || quantity <= 0) {
    throw AppError.badRequest('Positive quantity is required');
  }
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  product.incrementSold(quantity);
  await product.save();
  return sendSuccess(res, { message: 'Sold count incremented' });
});

exports.isDiscountActive = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const isActive = product.isDiscountActive();
  return sendSuccess(res, { data: { isDiscountActive: isActive }, message: 'Discount status checked' });
});

exports.getSEOData = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const seoData = product.getSEOData();
  return sendSuccess(res, { data: seoData, message: 'SEO data retrieved' });
});

exports.getBulkDiscountPrice = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.query;
  if (!quantity || Number(quantity) <= 0) {
    throw AppError.badRequest('Positive quantity is required');
  }
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const bulkPrice = product.getBulkDiscountPrice(Number(quantity));
  return sendSuccess(res, { data: { bulkPrice }, message: 'Bulk discount price retrieved' });
});

exports.isPurchasable = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const isPurchasable = product.isPurchasable();
  return sendSuccess(res, { data: { isPurchasable }, message: 'Purchasable status checked' });
});

exports.reduceStock = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  if (!quantity || quantity <= 0) {
    throw AppError.badRequest('Positive quantity is required');
  }
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  if (!product.isPurchasable()) {
    throw AppError.badRequest('Product is not purchasable');
  }
  await product.reduceStock(quantity);
  return sendSuccess(res, { data: product, message: 'Stock reduced successfully' });
});

exports.restockProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  if (!quantity || quantity <= 0) {
    throw AppError.badRequest('Positive quantity is required');
  }
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  await product.restock(quantity);
  return sendSuccess(res, { data: product, message: 'Product restocked successfully' });
});

exports.toggleFeatured = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const isFeatured = await product.toggleFeatured();
  return sendSuccess(res, { data: { isFeatured }, message: 'Featured status toggled' });
});

exports.getRelatedProducts = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const relatedProducts = await product.getRelatedProducts();
  return sendSuccess(res, { data: relatedProducts, message: 'Related products retrieved' });
});

exports.isPartOfBundle = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const isBundle = product.isPartOfBundle();
  return sendSuccess(res, { data: { isPartOfBundle: isBundle }, message: 'Bundle status checked' });
});

exports.getActiveDiscountPercent = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const discountPercent = product.getActiveDiscountPercent();
  return sendSuccess(res, { data: { discountPercent }, message: 'Discount percentage retrieved' });
});

exports.addProductReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reviewId } = req.body;
  if (!reviewId) {
    throw AppError.badRequest('reviewId is required');
  }
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  await product.addReview(reviewId);
  return sendSuccess(res, { message: 'Review added successfully' });
});

exports.applyPromotion = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { discount, salePrice, startDate, endDate } = req.body;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  await product.applyPromotion({ discount, salePrice, startDate, endDate });
  return sendSuccess(res, { data: product, message: 'Promotion applied successfully' });
});

exports.isPreOrderAvailable = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const isPreOrder = product.isPreOrderAvailable();
  return sendSuccess(res, { data: { isPreOrderAvailable: isPreOrder }, message: 'Pre-order status checked' });
});

exports.getBundleTotalPrice = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const totalPrice = await product.getBundleTotalPrice();
  return sendSuccess(res, { data: { totalPrice }, message: 'Bundle price retrieved' });
});

// Virtual Property Endpoints
exports.getRatingStatistics = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id).populate('reviews');
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const ratingStatistics = product.ratingStatistics;
  return sendSuccess(res, { data: ratingStatistics, message: 'Rating statistics retrieved' });
});

exports.getVirtualStockStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) {
    throw AppError.notFound('Product not found');
  }
  const stockStatus = product.stockStatus;
  return sendSuccess(res, { data: { stockStatus }, message: 'Virtual stock status retrieved' });
});

// Report and Statistics Endpoints
exports.getSchemaReport = catchAsync(async (req, res) => {
  const report = await Product.generateSchemaReport();
  return sendSuccess(res, { data: report, message: 'Schema report generated' });
});

exports.getDatabaseStatistics = catchAsync(async (req, res) => {
  const statistics = await Product.generateDatabaseStatistics();
  return sendSuccess(res, { data: statistics, message: 'Database statistics generated' });
});