const Brand = require('../../models/brands');
const { cacheClient } = require('../../config/cache');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

// Create a new brand
const createBrand = catchAsync(async (req, res) => {
  const brandData = { ...req.body };
  const brand = new Brand(brandData);
  await brand.save();

  return sendCreated(res, {
    data: brand,
    message: 'Brand created successfully',
  });
});

// Get a single brand by ID or slug
const getBrand = catchAsync(async (req, res) => {
  const identifier = req.params.idOrSlug;
  let brand;

  // Check cache first
  if (cacheClient) {
    const cached = await cacheClient.get(`brand:${identifier}`);
    if (cached) {
      return sendSuccess(res, {
        data: JSON.parse(cached),
        message: 'Brand retrieved from cache',
      });
    }
  }

  // Try finding by ID or slug
  brand = await Brand.findOne({
    $or: [{ _id: identifier }, { slug: identifier }],
  }).populate('created_by updated_by', 'name email');

  if (!brand) {
    throw AppError.notFound('Brand not found');
  }

  return sendSuccess(res, {
    data: brand,
    message: 'Brand retrieved successfully',
  });
});

// Update a brand
const updateBrand = catchAsync(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    throw AppError.notFound('Brand not found');
  }

  Object.assign(brand, {
    ...req.body,
    updated_by: req.user?._id,
  });
  await brand.save();

  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);

  return sendSuccess(res, {
    data: brand,
    message: 'Brand updated successfully',
  });
});

// Delete a brand (hard delete)
const deleteBrand = catchAsync(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    throw AppError.notFound('Brand not found');
  }

  await brand.deleteOne();

  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);

  return sendSuccess(res, {
    message: 'Brand deleted successfully',
  });
});

// Get all active brands
const getActiveBrands = catchAsync(async (req, res) => {
  const brands = await Brand.getActiveBrands();
  return sendSuccess(res, {
    data: brands,
    message: 'Active brands retrieved',
  });
});

// Get featured brands
const getFeaturedBrands = catchAsync(async (req, res) => {
  const brands = await Brand.getFeaturedBrands();
  return sendSuccess(res, {
    data: brands,
    message: 'Featured brands retrieved',
  });
});

// Search brands by keyword
const searchBrands = catchAsync(async (req, res) => {
  const { keyword } = req.query;
  if (!keyword) {
    throw AppError.badRequest('Keyword is required');
  }
  const brands = await Brand.searchBrands(keyword);
  return sendSuccess(res, {
    data: brands,
    message: 'Brand search completed',
  });
});

// Get top-rated brands
const getTopRatedBrands = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;
  const brands = await Brand.getTopRatedBrands(parseInt(limit));
  return sendSuccess(res, {
    data: brands,
    message: 'Top-rated brands retrieved',
  });
});

// Get brands by country
const getBrandsByCountry = catchAsync(async (req, res) => {
  const { country } = req.params;
  if (!country) {
    throw AppError.badRequest('Country is required');
  }
  const brands = await Brand.getBrandsByCountry(country);
  return sendSuccess(res, {
    data: brands,
    message: 'Brands by country retrieved',
  });
});

// Get brands by year range
const getBrandsByYearRange = catchAsync(async (req, res) => {
  const { startYear, endYear } = req.query;
  if (!startYear || !endYear) {
    throw AppError.badRequest('Start and end years are required');
  }
  const brands = await Brand.getBrandsByYearRange(parseInt(startYear), parseInt(endYear));
  return sendSuccess(res, {
    data: brands,
    message: 'Brands by year range retrieved',
  });
});

// Get brands with social media presence
const getBrandsWithSocialMedia = catchAsync(async (req, res) => {
  const brands = await Brand.getBrandsWithSocialMedia();
  return sendSuccess(res, {
    data: brands,
    message: 'Brands with social media retrieved',
  });
});

// Get paginated brands
const getPaginatedBrands = catchAsync(async (req, res) => {
  const { page, limit, status, search, sortBy, sortOrder } = req.query;
  const result = await Brand.getPaginatedBrands({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    status,
    search,
    sortBy: sortBy || 'name',
    sortOrder: sortOrder === 'desc' ? -1 : 1,
  });
  return sendSuccess(res, {
    data: result,
    message: 'Paginated brands retrieved',
  });
});

// Bulk update brand status
const bulkUpdateStatus = catchAsync(async (req, res) => {
  const { ids, status } = req.body;
  if (!ids || !Array.isArray(ids) || !status) {
    throw AppError.badRequest('IDs and status are required');
  }
  await Brand.bulkUpdateStatus(ids, status);

  // Invalidate cache for updated brands
  if (cacheClient) {
    for (const id of ids) {
      await Brand.invalidateCache(id, cacheClient);
    }
  }

  return sendSuccess(res, {
    message: 'Brand statuses updated successfully',
  });
});

// Bulk feature/unfeature brands
const bulkFeatureToggle = catchAsync(async (req, res) => {
  const { ids, isFeatured } = req.body;
  if (!ids || !Array.isArray(ids) || isFeatured === undefined) {
    throw AppError.badRequest('IDs and isFeatured are required');
  }
  await Brand.bulkFeatureToggle(ids, isFeatured);

  // Invalidate cache for updated brands
  if (cacheClient) {
    for (const id of ids) {
      await Brand.invalidateCache(id, cacheClient);
    }
  }

  return sendSuccess(res, {
    message: 'Brand feature status updated successfully',
  });
});

// Soft delete brands
const softDeleteBrands = catchAsync(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    throw AppError.badRequest('IDs are required');
  }
  await Brand.softDeleteBrands(ids);

  // Invalidate cache for soft-deleted brands
  if (cacheClient) {
    for (const id of ids) {
      await Brand.invalidateCache(id, cacheClient);
    }
  }

  return sendSuccess(res, {
    message: 'Brands soft deleted successfully',
  });
});

// Restore soft-deleted brands
const restoreBrands = catchAsync(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    throw AppError.badRequest('IDs are required');
  }
  await Brand.restoreBrands(ids);

  // Invalidate cache for restored brands
  if (cacheClient) {
    for (const id of ids) {
      await Brand.invalidateCache(id, cacheClient);
    }
  }

  return sendSuccess(res, {
    message: 'Brands restored successfully',
  });
});

// Update display order
const updateDisplayOrder = catchAsync(async (req, res) => {
  const { orderMap } = req.body;
  if (!orderMap || typeof orderMap !== 'object') {
    throw AppError.badRequest('Order map is required');
  }
  await Brand.updateDisplayOrder(orderMap);

  // Invalidate cache for updated brands
  if (cacheClient) {
    for (const id of Object.keys(orderMap)) {
      await Brand.invalidateCache(id, cacheClient);
    }
  }

  return sendSuccess(res, {
    message: 'Display order updated successfully',
  });
});

// Refresh product counts
const refreshProductCounts = catchAsync(async (req, res) => {
  await Brand.refreshProductCounts();

  // Invalidate cache for all brands
  if (cacheClient) {
    const brands = await Brand.find({}, '_id');
    for (const brand of brands) {
      await Brand.invalidateCache(brand._id, cacheClient);
    }
  }

  return sendSuccess(res, {
    message: 'Product counts refreshed successfully',
  });
});

// Add image to a brand
const addBrandImage = catchAsync(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    throw AppError.notFound('Brand not found');
  }

  const { image } = req.body;
  if (!image || !image.url) {
    throw AppError.badRequest('Image URL is required');
  }

  await brand.addImage(image);

  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);

  return sendSuccess(res, {
    data: brand,
    message: 'Image added to brand',
  });
});

// Remove image from a brand
const removeBrandImage = catchAsync(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    throw AppError.notFound('Brand not found');
  }

  const { url } = req.body;
  if (!url) {
    throw AppError.badRequest('Image URL is required');
  }

  await brand.removeImageByUrl(url);

  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);

  return sendSuccess(res, {
    data: brand,
    message: 'Image removed from brand',
  });
});

// Update brand contact
const updateBrandContact = catchAsync(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    throw AppError.notFound('Brand not found');
  }

  const { contact } = req.body;
  if (!contact) {
    throw AppError.badRequest('Contact data is required');
  }

  await brand.updateContact(contact);

  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);

  return sendSuccess(res, {
    data: brand,
    message: 'Brand contact updated',
  });
});

// Update brand rating
const updateBrandRating = catchAsync(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) {
    throw AppError.notFound('Brand not found');
  }

  const { rating } = req.body;
  if (rating === undefined || isNaN(rating)) {
    throw AppError.badRequest('Valid rating is required');
  }

  await brand.updateRating(parseFloat(rating));

  // Invalidate cache
  if (cacheClient) await Brand.invalidateCache(brand._id, cacheClient);

  return sendSuccess(res, {
    data: brand,
    message: 'Brand rating updated',
  });
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
