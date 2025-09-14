const Product = require('../../models/products');

// CRUD Operations
exports.createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ message: 'Product created successfully', product });
  } catch (error) {
    res.status(400).json({ message: 'Failed to create product', error: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    // Debug: Check if getPaginatedProducts exists
    if (!Product.getPaginatedProducts) {
      console.error('Product.getPaginatedProducts is undefined. Check products.js import and static method definition.');
      return res.status(500).json({ 
        message: 'Server configuration error: getPaginatedProducts method not found',
        availableMethods: Object.keys(Product.schema.statics)
      });
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
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in getProducts:', error);
    res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
};

exports.getProductByIdOrSlug = async (req, res) => {
  try {
    const { identifier } = req.params;
    const product = await Product.findOne({
      $or: [{ _id: identifier }, { slug: identifier }],
      deletedAt: { $exists: false },
    }).populate('categories brand reviews relatedProducts');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch product', error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json({ message: 'Product updated successfully', product });
  } catch (error) {
    res.status(400).json({ message: 'Failed to update product', error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await Product.bulkDelete([id]);
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete product', error: error.message });
  }
};

// Bulk Operations
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty IDs array' });
    }
    await Product.bulkDelete(ids);
    res.status(200).json({ message: 'Products deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to bulk delete products', error: error.message });
  }
};

exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !status) {
      return res.status(400).json({ message: 'Invalid input: ids and status required' });
    }
    if (!['active', 'inactive', 'draft', 'pending', 'archived', 'published'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    await Product.bulkUpdateStatus(ids, status);
    res.status(200).json({ message: 'Product statuses updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update statuses', error: error.message });
  }
};

exports.bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty updates array' });
    }
    if (updates.some(u => !u.id || u.stock < 0)) {
      return res.status(400).json({ message: 'Invalid stock updates' });
    }
    await Product.bulkUpdateStock(updates);
    res.status(200).json({ message: 'Product stocks updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update stocks', error: error.message });
  }
};

// Static Method Endpoints
exports.searchProducts = async (req, res) => {
  try {
    const { keyword } = req.params;
    const { limit } = req.query;
    const products = await Product.searchProducts(keyword, Number(limit) || 20);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to search products', error: error.message });
  }
};

exports.getFeaturedProducts = async (req, res) => {
  try {
    const { limit } = req.query;
    const products = await Product.getFeaturedProducts(Number(limit) || 10);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch featured products', error: error.message });
  }
};

exports.getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.getLowStockProducts();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch low stock products', error: error.message });
  }
};

exports.getOutOfStockProducts = async (req, res) => {
  try {
    const products = await Product.getOutOfStockProducts();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch out-of-stock products', error: error.message });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const products = await Product.getByCategory(categoryId);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products by category', error: error.message });
  }
};

exports.getProductsByTag = async (req, res) => {
  try {
    const { tags } = req.params;
    const { limit } = req.query;
    const products = await Product.getProductsByTag(tags.split(','), Number(limit) || 20);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products by tags', error: error.message });
  }
};

exports.getNewArrivals = async (req, res) => {
  try {
    const { days, limit } = req.query;
    const products = await Product.getNewArrivals(Number(days) || 30, Number(limit) || 10);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch new arrivals', error: error.message });
  }
};

exports.getProductsByPriceRange = async (req, res) => {
  try {
    const { minPrice, maxPrice, limit } = req.query;
    const products = await Product.getProductsByPriceRange(
      Number(minPrice) || 0,
      Number(maxPrice) || Infinity,
      Number(limit) || 20
    );
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products by price range', error: error.message });
  }
};

exports.getTopSellingProducts = async (req, res) => {
  try {
    const { limit } = req.query;
    const products = await Product.getTopSelling(Number(limit) || 10);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch top-selling products', error: error.message });
  }
};

exports.getMostViewedProducts = async (req, res) => {
  try {
    const { limit } = req.query;
    const products = await Product.getMostViewed(Number(limit) || 10);
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch most-viewed products', error: error.message });
  }
};

exports.getActiveDiscountProducts = async (req, res) => {
  try {
    const products = await Product.getActiveDiscountProducts();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch discounted products', error: error.message });
  }
};

exports.getAverageRatingByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const averageRating = await Product.getAverageRatingByCategory(categoryId);
    res.status(200).json({ categoryId, averageRating });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch average rating', error: error.message });
  }
};

exports.archiveOldProducts = async (req, res) => {
  try {
    const { beforeDate } = req.body;
    if (!beforeDate) return res.status(400).json({ message: 'beforeDate is required' });
    await Product.archiveOldProducts(new Date(beforeDate));
    res.status(200).json({ message: 'Old products archived successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to archive products', error: error.message });
  }
};

// Instance Method Endpoints
exports.getSimplifiedImages = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const images = product.getSimplifiedImages();
    res.status(200).json(images);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch images', error: error.message });
  }
};

exports.getFinalPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.query;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const finalPrice = product.getFinalPrice(Number(quantity) || 1);
    res.status(200).json({ finalPrice });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch final price', error: error.message });
  }
};

exports.getStockStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const stockStatus = product.getStockStatus();
    res.status(200).json({ stockStatus });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stock status', error: error.message });
  }
};

exports.markAsOutOfStock = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.markAsOutOfStock();
    await product.save();
    res.status(200).json({ message: 'Product marked as out of stock' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark as out of stock', error: error.message });
  }
};

exports.incrementProductViews = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.incrementViews();
    await product.save();
    res.status(200).json({ message: 'Product views incremented' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to increment views', error: error.message });
  }
};

exports.incrementSold = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Positive quantity is required' });
    }
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.incrementSold(quantity);
    await product.save();
    res.status(200).json({ message: 'Sold count incremented' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to increment sold count', error: error.message });
  }
};

exports.isDiscountActive = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const isActive = product.isDiscountActive();
    res.status(200).json({ isDiscountActive: isActive });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check discount status', error: error.message });
  }
};

exports.getSEOData = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const seoData = product.getSEOData();
    res.status(200).json(seoData);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch SEO data', error: error.message });
  }
};

exports.getBulkDiscountPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.query;
    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Positive quantity is required' });
    }
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const bulkPrice = product.getBulkDiscountPrice(Number(quantity));
    res.status(200).json({ bulkPrice });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch bulk discount price', error: error.message });
  }
};

exports.isPurchasable = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const isPurchasable = product.isPurchasable();
    res.status(200).json({ isPurchasable });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check purchasable status', error: error.message });
  }
};

exports.reduceStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Positive quantity is required' });
    }
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (!product.isPurchasable()) {
      return res.status(400).json({ message: 'Product is not purchasable' });
    }
    await product.reduceStock(quantity);
    res.status(200).json({ message: 'Stock reduced successfully', product });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reduce stock', error: error.message });
  }
};

exports.restockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Positive quantity is required' });
    }
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await product.restock(quantity);
    res.status(200).json({ message: 'Product restocked successfully', product });
  } catch (error) {
    res.status(500).json({ message: 'Failed to restock product', error: error.message });
  }
};

exports.toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const isFeatured = await product.toggleFeatured();
    res.status(200).json({ message: 'Featured status toggled', isFeatured });
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle featured status', error: error.message });
  }
};

exports.getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const relatedProducts = await product.getRelatedProducts();
    res.status(200).json(relatedProducts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch related products', error: error.message });
  }
};

exports.isPartOfBundle = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const isBundle = product.isPartOfBundle();
    res.status(200).json({ isPartOfBundle: isBundle });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check bundle status', error: error.message });
  }
};

exports.getActiveDiscountPercent = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const discountPercent = product.getActiveDiscountPercent();
    res.status(200).json({ discountPercent });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch discount percentage', error: error.message });
  }
};

exports.addProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewId } = req.body;
    if (!reviewId) return res.status(400).json({ message: 'reviewId is required' });
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await product.addReview(reviewId);
    res.status(200).json({ message: 'Review added successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add review', error: error.message });
  }
};

exports.applyPromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const { discount, salePrice, startDate, endDate } = req.body;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await product.applyPromotion({ discount, salePrice, startDate, endDate });
    res.status(200).json({ message: 'Promotion applied successfully', product });
  } catch (error) {
    res.status(500).json({ message: 'Failed to apply promotion', error: error.message });
  }
};

exports.isPreOrderAvailable = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const isPreOrder = product.isPreOrderAvailable();
    res.status(200).json({ isPreOrderAvailable: isPreOrder });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check pre-order status', error: error.message });
  }
};

exports.getBundleTotalPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const totalPrice = await product.getBundleTotalPrice();
    res.status(200).json({ totalPrice });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch bundle price', error: error.message });
  }
};

// Virtual Property Endpoints
exports.getRatingStatistics = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate('reviews');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const ratingStatistics = product.ratingStatistics;
    res.status(200).json(ratingStatistics);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch rating statistics', error: error.message });
  }
};

exports.getVirtualStockStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const stockStatus = product.stockStatus;
    res.status(200).json({ stockStatus });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch virtual stock status', error: error.message });
  }
};

// Virtual Property Endpoints

// Report and Statistics Endpoints
exports.getSchemaReport = async (req, res) => {
  try {
    const report = await Product.generateSchemaReport();
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate schema report', error: error.message });
  }
};

exports.getDatabaseStatistics = async (req, res) => {
  try {
    const statistics = await Product.generateDatabaseStatistics();
    res.status(200).json(statistics);
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate database statistics', error: error.message });
  }
};