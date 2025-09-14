const {
  ReasonPhrases,
  StatusCodes,
  getReasonPhrase,
  getStatusCode,
} = require("http-status-codes");
const { FilterOptions, FilterOptionsSearch, advanceQueryHandling } = require("../../utils/helper");
const Product = require("../../models/products");
const Category = require("../../models/categories");
const Review = require("../../models/reviews");
const Brand = require("../../models/brands");

const gethomeDetails = async (req, res) => {
  const { limit, page, filter, sort } = req.query;
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 30);

  try {
    const filterquery = FilterOptions(req.query,Product);
    const featured = await Product.find(
      { isFeatured: true, status: "publish" },
      "-status -productUPCEAN -manufacturerPartNumber -gtin -createdAt -updatedAt -__v -seo_info",
      filterquery.options
    )
      .populate("reviews")
      .populate("categories");

    const currentfeatured = featured.map((product) => {
      const ratingStatistics = product.ratingStatistics;
      const simplifiedImages = product.getSimplifiedImages();
      return {
        ...product["_doc"], images: simplifiedImages,
        ...ratingStatistics,
      };
    });

    const flashDeal = await Product.find(
      {
        $expr: {
          $gte: [
            {
              $multiply: [
                {
                  $subtract: ["$price", "$salePrice"],
                },
                100,
              ],
            },
            30, // 30% threshold
          ],
        },
        status: "publish",
      },
      "-status -productUPCEAN -manufacturerPartNumber -isFeatured -gtin -createdAt -updatedAt -__v -seo_info",
      filterquery.options
    )
      .populate("reviews")
      .populate("categories");

    const currentflash = flashDeal.map((product) => {
      const ratingStatistics = product.ratingStatistics;
      const simplifiedImages = product.getSimplifiedImages();
      return {
        ...product["_doc"], images: simplifiedImages,
        ...ratingStatistics,
      };
    });

    const newArive = await Product.find(
      { createdAt: { $gte: sevenDaysAgo }, status: "publish" },
      "-status -productUPCEAN -manufacturerPartNumber -isFeatured -gtin -createdAt -updatedAt -seo_info",
      filterquery.options
    )
      .populate("reviews")
      .populate("categories");

    const currentnewArive = newArive.map((product) => {
      const ratingStatistics = product.ratingStatistics;
      const simplifiedImages = product.getSimplifiedImages();
      return {
        ...product["_doc"], images: simplifiedImages,
        ...ratingStatistics,
      };
    });




    // const cate = await Category.find({ status: { $ne: "INACTIVE" } }, "images name slug");
    // // Iterate over each category and get the product count
    // const categories = await Promise.all(
    //   cate.map(async (category) => {
    //     const productCount = await category.getProductCount("publish");
    //     return { ...category._doc, productCount };
    //   })
    // );

    res.status(200).json({
      statusCode: 200,
      status: "OK",
      results: {
        featured: currentfeatured,
        flashDeal: currentflash,
        newArive: currentnewArive,

      },
      message: "Products retrieved successfully",
    });


  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: "Internal Server Error",
      results: null,
      message: error.message,
    });
  }
};

const getSingleProductDetails = async (req, res) => {
  const { limit, page, filter, sort } = req.query;
  const q = req.query;

  try {
    const singleProduct = await Product.findOne(q, "-status -productUPCEAN -manufacturerPartNumber -gtin -createdAt -updatedAt -__v",)
      .populate("reviews")
      .populate("categories").populate("brandName");

    const currentProd = {
      ...singleProduct["_doc"],
      ...singleProduct.ratingStatistics,
    };

    const related = await Product.find(
      { categories: singleProduct["categories"] },
      "-status -productUPCEAN -manufacturerPartNumber -gtin -createdAt -updatedAt -__v",
    )
      .populate("reviews")
      .populate("categories").populate("brandName");

    if (singleProduct) {
      res.status(200).json({
        statusCode: 200,
        status: "OK",
        results: { currentProd, related },
        message: "retrieved successfully",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: "Internal Server Error",
      message: error.message,
    });
  }
};
const getProductsSearch = async (req, res) => {
  const { limit, page, filter, sort } = req.query;

  try {
    const filterquery = FilterOptionsSearch(sort, page, limit, filter);
    const products = await Product.find(filterquery.query, "-status -seo_info -productUPCEAN -manufacturerPartNumber -gtin -createdAt -updatedAt -__v", {
      ...filterquery.options,
    })
      .populate("reviews")
      .populate("categories");
    const length = await Product.countDocuments(filterquery.query);


    if (products) {
      const currentProd = products?.map((product) => {
        const ratingStatistics = product.ratingStatistics;
        var cate = []

        product.categories?.forEach(element => {
          cate.push({ name: element.name, slug: element.slug, _id: element._id })
        });
        const simplifiedImages = product.getSimplifiedImages();
        // const reviewImage = product.reviews.getSimplifiedImages();

        return {
          ...product._doc, images: simplifiedImages,
          ...ratingStatistics, categories: cate
        };
      });

      res.status(200).json({
        statusCode: 200,
        status: "OK",
        results: currentProd,
        total: length,
        message: "Products retrieved successfully",
      });
    }
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: "Internal Server Error",
      results: null,
      message: error.message,
    });
  }
};
const getPublicBrands = async (req, res) => {
  const { limit, page, filter, sort } = req.query;

  try {
    const filterquery = FilterOptions(req.query,Brand);
    const responseData = await Brand.find(filterquery.query,
      "slug name images",
      filterquery.options);

    const count = await Promise.all(
      responseData.map(async (item) => {
        const total = await item.getProductCount('publish');
        const simplifiedImages = item?.getSimplifiedImages();
        return { ...item._doc, total, images: simplifiedImages };
      })
    );

    const length = await Brand.countDocuments(filterquery.query);

    res.status(200).json({
      statusCode: 200,
      status: "OK",
      message: "retrieved successfully",
      results: count,
      total: length,
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: "Internal Server Error",
      results: null,
      message: error.message,
    });
  }
};
const publicCategoriesDetails = async (req, res) => {
  const { limit, page, filter, sort } = req.query;

  try {
    const filterquery = FilterOptions(req.query,Category);
    const responseData = await Category.find(filterquery.query,
      "slug name images",
      filterquery.options);

    const categoryCounts = await Promise.all(
      responseData.map(async (category) => {
        const total = await category.getProductCount('publish');
        const simplifiedImages = category?.getSimplifiedImages();
        return { ...category._doc, total, images: simplifiedImages };
      })
    );

    const length = await Category.countDocuments(filterquery.query);

    res.status(200).json({
      statusCode: 200,
      status: "OK",
      message: "Categorys retrieved successfully",
      results: categoryCounts,
      total: length,
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: "Internal Server Error",
      results: null,
      message: error.message,
    });
  }
};
const getAllTage = async (req, res) => {
  try {
    const tags = await Product.distinct('tags');
    res.status(200).json({
      statusCode: 200,
      status: "OK",
      message: "Tags retrieved successfully",
      results: tags,
      total: tags.length,
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: "Internal Server Error",
      message: error.message,
    });
  }
}

module.exports = {
  gethomeDetails,
  getSingleProductDetails,
  getProductsSearch, publicCategoriesDetails, getPublicBrands,getAllTage
};
