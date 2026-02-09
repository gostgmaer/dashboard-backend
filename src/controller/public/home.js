const { FilterOptions, FilterOptionsSearch } = require('../../utils/helper');
const Product = require('../../models/products');
const Category = require('../../models/categories');
const Brand = require('../../models/brands');
const { sendSuccess, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

const gethomeDetails = catchAsync(async (req, res) => {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 30);

  const filterquery = FilterOptions(req.query, Product);

  const featured = await Product.find({ isFeatured: true, status: 'publish' }, '-status -productUPCEAN -manufacturerPartNumber -gtin -createdAt -updatedAt -__v -seo_info', filterquery.options).populate('reviews').populate('categories');

  const currentfeatured = featured.map((product) => {
    const ratingStatistics = product.ratingStatistics;
    const simplifiedImages = product.getSimplifiedImages();
    return {
      ...product['_doc'],
      images: simplifiedImages,
      ...ratingStatistics,
    };
  });

  const flashDeal = await Product.find(
    {
      $expr: {
        $gte: [
          { $multiply: [{ $subtract: ['$price', '$salePrice'] }, 100] },
          30,
        ],
      },
      status: 'publish',
    },
    '-status -productUPCEAN -manufacturerPartNumber -isFeatured -gtin -createdAt -updatedAt -__v -seo_info',
    filterquery.options
  )
    .populate('reviews')
    .populate('categories');

  const currentflash = flashDeal.map((product) => {
    const ratingStatistics = product.ratingStatistics;
    const simplifiedImages = product.getSimplifiedImages();
    return {
      ...product['_doc'],
      images: simplifiedImages,
      ...ratingStatistics,
    };
  });

  const newArive = await Product.find({ createdAt: { $gte: sevenDaysAgo }, status: 'publish' }, '-status -productUPCEAN -manufacturerPartNumber -isFeatured -gtin -createdAt -updatedAt -seo_info', filterquery.options)
    .populate('reviews')
    .populate('categories');

  const currentnewArive = newArive.map((product) => {
    const ratingStatistics = product.ratingStatistics;
    const simplifiedImages = product.getSimplifiedImages();
    return {
      ...product['_doc'],
      images: simplifiedImages,
      ...ratingStatistics,
    };
  });

  return sendSuccess(res, {
    data: { featured: currentfeatured, flashDeal: currentflash, newArive: currentnewArive },
    message: 'Products retrieved successfully',
  });
});

const getSingleProductDetails = catchAsync(async (req, res) => {
  const q = req.query;

  const singleProduct = await Product.findOne(q, '-status -productUPCEAN -manufacturerPartNumber -gtin -createdAt -updatedAt -__v').populate('reviews').populate('categories').populate('brandName');

  if (!singleProduct) {
    throw AppError.notFound('Product not found');
  }

  const currentProd = {
    ...singleProduct['_doc'],
    ...singleProduct.ratingStatistics,
  };

  const related = await Product.find({ categories: singleProduct['categories'] }, '-status -productUPCEAN -manufacturerPartNumber -gtin -createdAt -updatedAt -__v').populate('reviews').populate('categories').populate('brandName');

  return sendSuccess(res, { data: { currentProd, related }, message: 'Retrieved successfully' });
});

const getProductsSearch = catchAsync(async (req, res) => {
  const { limit, page, filter, sort } = req.query;

  const filterquery = FilterOptionsSearch(sort, page, limit, filter);
  const products = await Product.find(filterquery.query, '-status -seo_info -productUPCEAN -manufacturerPartNumber -gtin -createdAt -updatedAt -__v', {
    ...filterquery.options,
  })
    .populate('reviews')
    .populate('categories');
  const length = await Product.countDocuments(filterquery.query);

  const currentProd = products?.map((product) => {
    const ratingStatistics = product.ratingStatistics;
    var cate = [];

    product.categories?.forEach((element) => {
      cate.push({ name: element.name, slug: element.slug, _id: element._id });
    });
    const simplifiedImages = product.getSimplifiedImages();

    return {
      ...product._doc,
      images: simplifiedImages,
      ...ratingStatistics,
      categories: cate,
    };
  });

  return sendSuccess(res, { data: { results: currentProd, total: length }, message: 'Products retrieved successfully' });
});

const getPublicBrands = catchAsync(async (req, res) => {
  const filterquery = FilterOptions(req.query, Brand);
  const responseData = await Brand.find(filterquery.query, 'slug name images', filterquery.options);

  const count = await Promise.all(
    responseData.map(async (item) => {
      const total = await item.getProductCount('publish');
      const simplifiedImages = item?.getSimplifiedImages();
      return { ...item._doc, total, images: simplifiedImages };
    })
  );

  const length = await Brand.countDocuments(filterquery.query);

  return sendSuccess(res, { data: { results: count, total: length }, message: 'Retrieved successfully' });
});

const publicCategoriesDetails = catchAsync(async (req, res) => {
  const filterquery = FilterOptions(req.query, Category);
  const responseData = await Category.find(filterquery.query, 'slug name images', filterquery.options);

  const categoryCounts = await Promise.all(
    responseData.map(async (category) => {
      const total = await category.getProductCount('publish');
      const simplifiedImages = category?.getSimplifiedImages();
      return { ...category._doc, total, images: simplifiedImages };
    })
  );

  const length = await Category.countDocuments(filterquery.query);

  return sendSuccess(res, { data: { results: categoryCounts, total: length }, message: 'Categories retrieved successfully' });
});

const getAllTage = catchAsync(async (req, res) => {
  const tags = await Product.distinct('tags');
  return sendSuccess(res, { data: { results: tags, total: tags.length }, message: 'Tags retrieved successfully' });
});

module.exports = {
  gethomeDetails,
  getSingleProductDetails,
  getProductsSearch,
  publicCategoriesDetails,
  getPublicBrands,
  getAllTage,
};
