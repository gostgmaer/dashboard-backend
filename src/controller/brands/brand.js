const Brand = require("../../models/brands");
const createError = require("http-errors");
const logger = require("winston"); // Assuming a logging library is configured
const { cacheClient } = require("../../config/cache"); // Assuming Redis client configuration

// Helper function to handle async errors
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Create a new brand
const createBrand = asyncHandler(async (req, res) => {
  const brandData = {
    ...req.body
  };
  const brand = new Brand(brandData);
  await brand.save();
  
  // Cache the brand
  // if (cacheClient) await Brand.cacheBrandData(brand._id, cacheClient);
  
  logger.info(`Brand created: ${brand._id} by user ${req.user?._id}`);
  res.status(201).json({ success: true, data: brand });
});

// Get a single brand by ID or slug
const getBrand = asyncHandler(async (req, res) => {
  const identifier = req.params.idOrSlug;
  let brand;
  
  // Check cache first
  if (cacheClient) {
    const cached = await cacheClient.get(`brand:${identifier}`);
    if (cached) {
      logger.info(`Cache hit for brand: ${identifier}`);
      return res.json({ success: true, data: JSON.parse(cached) });
    }
  }
  
  // Try finding by ID or slug
  brand = await Brand.findOne({
    $or: [{ _id: identifier }, { slug: identifier }],
  }).populate("createdBy updatedBy", "name email");
  
  if (!brand) throw createError(404, "Brand not found");
  
  // Cache the result
  // if (cacheClient) await Brand.cacheBrandData(brand._id, cacheClient);
  
  res.json({ success: true, data: brand });
});

// Update a brand
const updateBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw createError(404, "Brand not found");
  
  Object.assign(brand, {
    ...req.body,
    updatedBy: req.user?._id,
  });
  await brand.save();
  
  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);
  
  logger.info(`Brand updated: ${brand._id} by user ${req.user?._id}`);
  res.json({ success: true, data: brand });
});

// Delete a brand (hard delete)
const deleteBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw createError(404, "Brand not found");
  
  await brand.deleteOne();
  
  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);
  
  logger.info(`Brand deleted: ${brand._id} by user ${req.user?._id}`);
  res.json({ success: true, message: "Brand deleted successfully" });
});

// Get all active brands
const getActiveBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.getActiveBrands();
  res.json({ success: true, data: brands });
});

// Get featured brands
const getFeaturedBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.getFeaturedBrands();
  res.json({ success: true, data: brands });
});

// Search brands by keyword
const searchBrands = asyncHandler(async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) throw createError(400, "Keyword is required");
  const brands = await Brand.searchBrands(keyword);
  res.json({ success: true, data: brands });
});

// Get top-rated brands
const getTopRatedBrands = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const brands = await Brand.getTopRatedBrands(parseInt(limit));
  res.json({ success: true, data: brands });
});

// Get brands by country
const getBrandsByCountry = asyncHandler(async (req, res) => {
  const { country } = req.params;
  if (!country) throw createError(400, "Country is required");
  const brands = await Brand.getBrandsByCountry(country);
  res.json({ success: true, data: brands });
});

// Get brands by year range
const getBrandsByYearRange = asyncHandler(async (req, res) => {
  const { startYear, endYear } = req.query;
  if (!startYear || !endYear) throw createError(400, "Start and end years are required");
  const brands = await Brand.getBrandsByYearRange(parseInt(startYear), parseInt(endYear));
  res.json({ success: true, data: brands });
});

// Get brands with social media presence
const getBrandsWithSocialMedia = asyncHandler(async (req, res) => {
  const brands = await Brand.getBrandsWithSocialMedia();
  res.json({ success: true, data: brands });
});

// Get paginated brands
const getPaginatedBrands = asyncHandler(async (req, res) => {
  const { page, limit, status, search, sortBy, sortOrder } = req.query;
  const result = await Brand.getPaginatedBrands({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    status,
    search,
    sortBy: sortBy || "name",
    sortOrder: sortOrder === "desc" ? -1 : 1,
  });
  res.json({ success: true, data: result });
});

// Bulk update brand status
const bulkUpdateStatus = asyncHandler(async (req, res) => {
  const { ids, status } = req.body;
  if (!ids || !Array.isArray(ids) || !status) {
    throw createError(400, "IDs and status are required");
  }
  await Brand.bulkUpdateStatus(ids, status);
  
  // Invalidate cache for updated brands
  if (cacheClient) {
    for (const id of ids) {
      await Brand.invalidateCache(id, cacheClient);
    }
  }
  
  logger.info(`Bulk status update for brands: ${ids.join(", ")} to ${status}`);
  res.json({ success: true, message: "Brand statuses updated successfully" });
});

// Bulk feature/unfeature brands
const bulkFeatureToggle = asyncHandler(async (req, res) => {
  const { ids, isFeatured } = req.body;
  if (!ids || !Array.isArray(ids) || isFeatured === undefined) {
    throw createError(400, "IDs and isFeatured are required");
  }
  await Brand.bulkFeatureToggle(ids, isFeatured);
  
  // Invalidate cache for updated brands
  if (cacheClient) {
    for (const id of ids) {
      await Brand.invalidateCache(id, cacheClient);
    }
  }
  
  logger.info(`Bulk feature toggle for brands: ${ids.join(", ")} to ${isFeatured}`);
  res.json({ success: true, message: "Brand feature status updated successfully" });
});

// Soft delete brands
const softDeleteBrands = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) throw createError(400, "IDs are required");
  await Brand.softDeleteBrands(ids);
  
  // Invalidate cache for soft-deleted brands
  if (cacheClient) {
    for (const id of ids) {
      await Brand.invalidateCache(id, cacheClient);
    }
  }
  
  logger.info(`Soft deleted brands: ${ids.join(", ")}`);
  res.json({ success: true, message: "Brands soft deleted successfully" });
});

// Restore soft-deleted brands
const restoreBrands = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) throw createError(400, "IDs are required");
  await Brand.restoreBrands(ids);
  
  // Invalidate cache for restored brands
  if (cacheClient) {
    for (const id of ids) {
      await Brand.invalidateCache(id, cacheClient);
    }
  }
  
  logger.info(`Restored brands: ${ids.join(", ")}`);
  res.json({ success: true, message: "Brands restored successfully" });
});

// Update display order
const updateDisplayOrder = asyncHandler(async (req, res) => {
  const { orderMap } = req.body;
  if (!orderMap || typeof orderMap !== "object") {
    throw createError(400, "Order map is required");
  }
  await Brand.updateDisplayOrder(orderMap);
  
  // Invalidate cache for updated brands
  if (cacheClient) {
    for (const id of Object.keys(orderMap)) {
      await Brand.invalidateCache(id, cacheClient);
    }
  }
  
  logger.info(`Updated display order for brands: ${Object.keys(orderMap).join(", ")}`);
  res.json({ success: true, message: "Display order updated successfully" });
});

// Refresh product counts
const refreshProductCounts = asyncHandler(async (req, res) => {
  await Brand.refreshProductCounts();
  
  // Invalidate cache for all brands
  if (cacheClient) {
    const brands = await Brand.find({}, "_id");
    for (const brand of brands) {
      await Brand.invalidateCache(brand._id, cacheClient);
    }
  }
  
  logger.info("Refreshed product counts for all brands");
  res.json({ success: true, message: "Product counts refreshed successfully" });
});

// Add image to a brand
const addBrandImage = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw createError(404, "Brand not found");
  
  const { image } = req.body;
  if (!image || !image.url) throw createError(400, "Image URL is required");
  
  await brand.addImage(image);
  
  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);
  
  logger.info(`Added image to brand: ${brand._id}`);
  res.json({ success: true, data: brand });
});

// Remove image from a brand
const removeBrandImage = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw createError(404, "Brand not found");
  
  const { url } = req.body;
  if (!url) throw createError(400, "Image URL is required");
  
  await brand.removeImageByUrl(url);
  
  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);
  
  logger.info(`Removed image from brand: ${brand._id}`);
  res.json({ success: true, data: brand });
});

// Update brand contact
const updateBrandContact = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw createError(404, "Brand not found");
  
  const { contact } = req.body;
  if (!contact) throw createError(400, "Contact data is required");
  
  await brand.updateContact(contact);
  
  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);
  
  logger.info(`Updated contact for brand: ${brand._id}`);
  res.json({ success: true, data: brand });
});

// Update brand rating
const updateBrandRating = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw createError(404, "Brand not found");
  
  const { rating } = req.body;
  if (rating === undefined || isNaN(rating)) {
    throw createError(400, "Valid rating is required");
  }
  
  await brand.updateRating(parseFloat(rating));
  
  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);
  
  logger.info(`Updated rating for brand: ${brand._id}`);
  res.json({ success: true, data: brand });
});

module.exports = {
  createBrand,
  getBrand,
  updateBrand,
  deleteBrand,
  getActiveBrands,
  getFeaturedBrands,
  searchBrands,
  getTopRatedBrands,
  getBrandsByCountry,
  getBrandsByYearRange,
  getBrandsWithSocialMedia,
  getPaginatedBrands,
  bulkUpdateStatus,
  bulkFeatureToggle,
  softDeleteBrands,
  restoreBrands,
  updateDisplayOrder,
  refreshProductCounts,
  addBrandImage,
  removeBrandImage,
  updateBrandContact,
  updateBrandRating,
};