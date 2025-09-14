
const { FilterOptions } = require("../../utils/helper");
const Category = require("../../models/categories");
const Product = require("../../models/products"); // Make sure this exists




exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// category.controller.js
exports.getCategories = async (req, res) => {
  try {
    const filterquery = FilterOptions(req.query,Category);
    const responseData = await Category.find( filterquery.query,
      "-__v -cat_id -child -parent_category",
      filterquery.options);

      const categoryCounts = await Promise.all(
        responseData.map(async (category) => {
          const total = await category.getProductCount('published');
          return { ...category._doc, total };
        })
      );

    const length = await Category.countDocuments(filterquery.query);

    res.status(200).json({
      statusCode: 200,
      status: "OK",
      message: "Categorys retrieved successfully",
      results:  categoryCounts || [],
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

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await Category.deleteCategoryRecursive(req.params.id);
    res.json({ message: "Category and its children deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

async function attachActiveProductCounts(categories) {
 
  return Promise.all(
    categories.map(async (cat) => {
      const count = await Product.countDocuments({
        category: cat._id,
        status: "active"
      });
      return { ...cat.toObject(), productCount: count };
    })
  );
}

exports.getActiveCategories = async (req, res) => {
  try {
    const categories = await Category.getActiveCategories();
    const result = await attachActiveProductCounts(categories);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getFeaturedCategories = async (req, res) => {
  try {
    const categories = await Category.getFeaturedCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.searchCategories = async (req, res) => {
  try {
    const categories = await Category.searchCategories(req.query.q || "");
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCategoryTree = async (req, res) => {
  try {
    const tree = await Category.getCategoryTree(req.query.parentId || null);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    await Category.bulkUpdateStatus(ids, status);
    res.json({ message: "Status updated" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const stats = await Category.getStatistics();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getCategoryStatistics = async (req, res) => {
  try {
    const Category = require("./category.model");
    const Product = require("./product.model"); // Ensure this exists

    // Base category stats from static method
    const stats = await Category.getStatistics();

    // Optional: active product counts per category
    const categories = await Category.find().select("title status");
    const categoryProductCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({
          category: cat._id,
          status: "active" // or "published" depending on your product schema
        });
        return {
          categoryId: cat._id,
          title: cat.title,
          status: cat.status,
          activeProductCount: count
        };
      })
    );

    res.json({
      summary: stats,
      perCategory: categoryProductCounts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
