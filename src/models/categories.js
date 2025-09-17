// category.model.js
const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    child: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    status: {
      type: String,
      required: true,
      enum: ['active', 'inactive', 'draft', 'pending', 'archived', 'published']
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    images: [],
    descriptions: String,
 isDeleted: { type: Boolean, default: true },
    // Audit fields
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // SEO & Display
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    metaKeywords: [{ type: String, trim: true }],
    isFeatured: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    visibility: { type: Boolean, default: true },
  },
  { timestamps: true }
);

//
// ===== Instance Methods =====
//

// Get product count for this category
categorySchema.methods.getProductCount = async function (status = "published") {
  const Product = mongoose.model("Product");
  return Product.countDocuments({ category: this.id, status });
};

// Get simplified image list
categorySchema.methods.getSimplifiedImages = function () {
  return Array.isArray(this.images)
    ? this.images.map(img => ({ url: img.url, name: img.name }))
    : [];
};

// Check if category has children
categorySchema.methods.hasChildren = function () {
  return Array.isArray(this.child) && this.child.length > 0;
};

// Get breadcrumb path
categorySchema.methods.getBreadcrumb = async function () {
  const Category = mongoose.model("Category");
  let path = [];
  let current = this;
  while (current && current.parent) {
    current = await Category.findById(current.parent).select('title slug parent');
    if (current) path.unshift({ title: current.title, slug: current.slug });
  }
  return path;
};

// Get total descendants count
categorySchema.methods.getDescendantCount = async function () {
  const Category = mongoose.model("Category");
  let count = 0;
  async function countChildren(id) {
    const children = await Category.find({ parent: id }).select('_id');
    count += children.length;
    for (let child of children) {
      await countChildren(child._id);
    }
  }
  await countChildren(this._id);
  return count;
};

//
// ===== Static Methods =====
//

// Get all active categories
categorySchema.statics.getActiveCategories = function () {
  return this.find({ status: 'active', visibility: true }).sort({ displayOrder: 1, title: 1 });
};

// Get featured categories
categorySchema.statics.getFeaturedCategories = function () {
  return this.find({ isFeatured: true, status: 'active', visibility: true }).sort({ displayOrder: 1 });
};

// Search categories by keyword
categorySchema.statics.searchCategories = function (keyword) {
  return this.find({ title: { $regex: keyword, $options: 'i' } }).sort({ title: 1 });
};

// Get category tree
categorySchema.statics.getCategoryTree = async function (parentId = null) {
  const categories = await this.find({ parent: parentId }).sort({ displayOrder: 1, title: 1 }).lean();
  for (let category of categories) {
    category.children = await this.getCategoryTree(category._id);
  }
  return categories;
};

// Bulk update status
categorySchema.statics.bulkUpdateStatus = function (ids, status) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { status } });
};

// Delete category and its children recursively
categorySchema.statics.deleteCategoryRecursive = async function (categoryId) {
  const children = await this.find({ parent: categoryId }).select('_id');
  for (let child of children) {
    await this.deleteCategoryRecursive(child._id);
  }
  return this.findByIdAndDelete(categoryId);
};

// Get category statistics
categorySchema.statics.getStatistics = async function () {
  const total = await this.countDocuments();
  const active = await this.countDocuments({ status: 'active' });
  const inactive = await this.countDocuments({ status: 'inactive' });
  const featured = await this.countDocuments({ isFeatured: true });
  return { total, active, inactive, featured };
};

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;