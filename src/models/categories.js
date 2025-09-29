// category.model.js
const mongoose = require("mongoose");
const slugify = require('slugify')

const categorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, index: true },
    child: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    status: {
      type: String,
      required: true,
      index: true,
      default: "draft",
      enum: ['active', 'inactive', 'draft', 'pending', 'archived', 'published']
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    images: [
      {
        url: { type: String, },
        alt: { type: String, default: "" }
      }
    ],
    descriptions: { type: String, trim: true, maxlength: 1000 },
    isDeleted: { type: Boolean, default: false },
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
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// PRE-SAVE HOOKS
categorySchema.pre("validate", function (next) {
  if (this.isModified("title")) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

categorySchema.pre("save", async function (next) {
  // Maintain parent → children arrays
  if (this.isModified("parent")) {
    const Category = this.constructor;
    // remove from old parent's children
    if (this._previousParent && this._previousParent.toString() !== this.parent?.toString()) {
      await Category.findByIdAndUpdate(this._previousParent, {
        $pull: { children: this._id }
      });
    }
    // add to new parent
    if (this.parent) {
      await Category.findByIdAndUpdate(this.parent, {
        $addToSet: { children: this._id }
      });
    }
  }
  next();
});

categorySchema.pre("init", function (doc) {
  this._previousParent = doc.parent;
});

// VIRTUAL PROPERTIES
categorySchema.virtual("childCount").get(function () {
  return Array.isArray(this.children) ? this.children.length : 0;
});

categorySchema.virtual("fullPath").get(function () {
  const path = [];
  let node = this;
  while (node) {
    path.unshift({ title: node.title, slug: node.slug });
    node = node.parentDoc;
  }
  return path;
});

// Populate parentDoc for virtual fullPath
categorySchema.virtual("parentDoc", {
  ref: "Category",
  localField: "parent",
  foreignField: "_id",
  justOne: true
});
//
// ===== Instance Methods =====
//

// Toggle the isFeatured flag
categorySchema.methods.toggleFeatured = async function () {
  this.isFeatured = !this.isFeatured;
  return this.save();
};

// Change the status and update updated_by user
categorySchema.methods.changeStatus = async function (newStatus, userId) {
  this.status = newStatus;
  this.updated_by = userId;
  return this.save();
};

// Recursively populate children up to a certain depth
categorySchema.methods.deepPopulate = async function (depth = 3) {
  let query = this.model("Category").findById(this._id);
  for (let i = 0; i < depth; i++) {
    query = query.populate({ path: "children", populate: { path: "children" } });
  }
  return query.exec();
};

categorySchema.methods.getProductCount = async function (status = "active") {
  const Product = mongoose.model("Product");
  return Product.countDocuments({ category: this._id, status });
};

categorySchema.methods.getBreadcrumb = async function () {
  await this.populate("parentDoc").execPopulate();
  const crumbs = [];
  let current = this;
  while (current) {
    crumbs.unshift({ title: current.title, slug: current.slug });
    current = current.parentDoc;
  }
  return crumbs;
};

categorySchema.methods.softDelete = async function () {
  this.isDeleted = true;
    this.status = "inactive";
  await this.save();
  return this;
};

categorySchema.methods.restore = async function () {
  this.isDeleted = false;
   this.status = "active";
  await this.save();
  return this;
};
// Get simplified image list
categorySchema.methods.getSimplifiedImages = function () {
  return Array.isArray(this.images)
    ? this.images.map(img => ({ url: img.url, alt: img.alt }))
    : [];
};

// Check if category has children
categorySchema.methods.hasChildren = function () {
  return Array.isArray(this.child) && this.child.length > 0;
};

// Get total descendants count
categorySchema.methods.getDescendantCount = async function () {
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

// --- Advanced Instance Methods ---

// Recursively retrieve all ancestors (breadcrumbs) as an array of { title, slug }
categorySchema.methods.getAncestors = async function () {
  const ancestors = [];
  let parentId = this.parent;
  while (parentId) {
    const parent = await this.constructor.findById(parentId).lean();
    if (!parent) break;
    ancestors.unshift({ title: parent.title, slug: parent.slug });
    parentId = parent.parent;
  }
  return ancestors;
};

// Check if the category is visible filtering deleted and status active
categorySchema.methods.isVisible = function () {
  return this.visibility === true && this.isDeleted === false && this.status === "active";
};

// Update display order for the category and reorder siblings
categorySchema.methods.updateDisplayOrder = async function (newOrder) {
  const Category = this.constructor;
  if (this.displayOrder === newOrder) return this;

  // Shift other categories displayOrder accordingly - simplified example
  await Category.updateMany(
    { parent: this.parent, displayOrder: { $gte: newOrder }, _id: { $ne: this._id } },
    { $inc: { displayOrder: 1 } }
  );
  this.displayOrder = newOrder;
  return this.save();
};
// --- Advanced Static Methods ---

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



// Delete category and its children recursively
categorySchema.statics.deleteCategoryRecursive = async function (categoryId) {
  const children = await this.find({ parent: categoryId }).select('_id');
  for (let child of children) {
    await this.deleteCategoryRecursive(child._id);
  }
  return this.findByIdAndDelete(categoryId);
};

/**
 * Paginate results (filter by isDeleted=false by default)
 * options: { page, limit, sortBy, sortOrder, filter }
 */
categorySchema.statics.paginate = async function (options = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
    filter = {}
  } = options;

  const query = { isDeleted: false, ...filter };
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [items, total] = await Promise.all([
    this.find(query).sort(sort).skip(skip).limit(limit).lean(),
    this.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);
  return { items, total, page, totalPages };
};

categorySchema.statics.getTree = async function (parent = null) {
  const nodes = await this.find({ parent, isDeleted: false, visibility: true })
    .sort({ displayOrder: 1, title: 1 })
    .lean();
  for (const node of nodes) {
    node.childrenTree = await this.getTree(node._id);
  }
  return nodes;
};

categorySchema.statics.bulkUpdateStatus = function (ids, status) {
  return this.updateMany(
    { _id: { $in: ids } },
    { status, updatedAt: Date.now() }
  );
};

categorySchema.statics.getStats = async function () {
  const [total, active, inactive, featured] = await Promise.all([
    this.countDocuments({ isDeleted: false }),
    this.countDocuments({ status: "active", isDeleted: false }),
    this.countDocuments({ status: "inactive", isDeleted: false }),
    this.countDocuments({ isFeatured: true, isDeleted: false })
  ]);
  return { total, active, inactive, featured };
};

// Bulk insert multiple categories (unordered)
categorySchema.statics.importBulk = async function (items) {
  return this.insertMany(items, { ordered: false });
};

// Export filtered categories to CSV string
categorySchema.statics.exportCSV = async function (filter = {}) {
  const docs = await this.find(filter).lean();
  const csvStringify = require("csv-stringify");
  return new Promise((resolve, reject) => {
    const columns = ["_id", "title", "slug", "status", "isFeatured", "visibility", "displayOrder"];
    csvStringify(docs, { header: true, columns }, (err, output) => {
      if (err) reject(err);
      else resolve(output);
    });
  });
};

// Aggregate category counts by status
categorySchema.statics.aggregateByStatus = function () {
  return this.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]).exec();
};

// Soft-delete multiple categories by IDs
categorySchema.statics.softDeleteMany = function (ids) {
  return this.updateMany(
    { _id: { $in: ids } },
    { $set: { isDeleted: true,status:"inactive", updatedAt: Date.now() } }
  );
};


// Get all categories flattened with depth level info for hierarchy display
categorySchema.statics.getFlatHierarchy = async function () {
  const result = [];
  async function recurse(parentId, level) {
    const categories = await this.find({ parent: parentId, isDeleted: false }).sort('displayOrder').lean();
    for (const cat of categories) {
      result.push({ ...cat, level });
      await recurse.call(this, cat._id, level + 1);
    }
  }
  await recurse.call(this, null, 0);
  return result;
};

// Find categories by multiple slugs
categorySchema.statics.findBySlugs = function (slugs = []) {
  return this.find({ slug: { $in: slugs }, isDeleted: false }).exec();
};

// Batch update categories display order by array of { id, displayOrder }
categorySchema.statics.batchUpdateDisplayOrders = async function (updates = []) {
  const bulkOps = updates.map(({ id, displayOrder }) => ({
    updateOne: {
      filter: { _id: id },
      update: { displayOrder },
    },
  }));
  return this.bulkWrite(bulkOps);
};

// Aggregate count of featured vs non-featured active categories
categorySchema.statics.featuredStats = function () {
  return this.aggregate([
    { $match: { isDeleted: false, status: "active" } },
    {
      $group: {
        _id: "$isFeatured",
        count: { $sum: 1 },
      },
    },
  ]).exec();
};

categorySchema.statics.removeWithDescendants = async function (categoryId) {
  const idsToDelete = [];

  async function findChildren(id) {
    const children = await this.find({ parent: id }).lean().exec();
    for (const child of children) {
      idsToDelete.push(child._id);
      await findChildren.call(this, child._id);
    }
  }

  await findChildren.call(this, categoryId);

  // Soft delete descendants (children)
  await this.updateMany(
    { _id: { $in: idsToDelete } },
    { $set: { isDeleted: true, updatedAt: new Date() } }
  );

  // Check current category and soft delete + remove featured if not already deleted
  const currentCategory = await this.findById(categoryId);
  if (currentCategory && !currentCategory.isDeleted) {
    currentCategory.isDeleted = true;
        currentCategory.status = "inactive";
    currentCategory.isFeatured = false;  // Remove featured flag
    currentCategory.updatedAt = new Date();
    await currentCategory.save();
  }

  return { deletedCount: idsToDelete.length + (currentCategory ? 1 : 0) };
};


categorySchema.statics.getAllWithDetailedStats = async function ({
  page = 1,
  limit = 20,
  sortBy = "displayOrder",
  sortOrder = "asc",
  filters = {},
  search = "",
  populate = [], // array of strings like ['created_by', 'parent']
  includeDeleted = false
}) {
  const baseMatch = includeDeleted ? {} : { isDeleted: false };
  const matchConditions = { ...baseMatch, ...filters };

  if (search) {
    const searchRegex = typeof search === "number"
      ? new RegExp(search.toString(), "i")
      : new RegExp(search, "i");
    matchConditions.$or = [
      { title: searchRegex },
      { slug: searchRegex },
      { descriptions: searchRegex }
    ];
  }

  const sortCondition = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
  const skip = (page - 1) * limit;

  const populateMap = {
    created_by: { from: "users", localField: "created_by", foreignField: "_id", as: "created_by" },
    updated_by: { from: "users", localField: "updated_by", foreignField: "_id", as: "updated_by" },
    parent: { from: "categories", localField: "parent", foreignField: "_id", as: "parent" }
  };

  // Common pipeline stages before pagination
  const basePipeline = [
    { $match: matchConditions },

    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "category",
        as: "allProducts"
      }
    },

    {
      $addFields: {
        productCount: { $size: "$allProducts" },
        activeProductCount: {
          $size: {
            $filter: {
              input: "$allProducts",
              as: "product",
              cond: { $eq: ["$$product.status", "active"] }
            }
          }
        },
        deletedProductCount: {
          $size: {
            $filter: {
              input: "$allProducts",
              as: "product",
              cond: { $eq: ["$$product.isDeleted", true] }
            }
          }
        },
        featuredProductCount: {
          $size: {
            $filter: {
              input: "$allProducts",
              as: "product",
              cond: { $eq: ["$$product.isFeatured", true] }
            }
          }
        },
        outOfStockProductCount: {
          $size: {
            $filter: {
              input: "$allProducts",
              as: "product",
              cond: { $lte: ["$$product.stock", 0] }
            }
          }
        }
      }
    },

    { $project: { allProducts: 0 } }
  ];

  // Apply lookups for population fields
  populate.forEach(field => {
    const cfg = populateMap[field];
    if (cfg) {
      basePipeline.push({
        $lookup: {
          from: cfg.from,
          localField: cfg.localField,
          foreignField: cfg.foreignField,
          as: cfg.as
        }
      });
    }
  });

  // Now construct facet pipeline
  const pipeline = [
    ...basePipeline,
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $sort: sortCondition },
          { $skip: skip },
          { $limit: limit }
        ]
      }
    },
    {
      $unwind: {
        path: "$metadata",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $addFields: {
        "metadata.totalPages": {
          $ceil: { $divide: ["$metadata.total", limit] }
        },
        "metadata.page": page,
        "metadata.itemsPerPage": limit
      }
    }
  ];

  const result = await this.aggregate(pipeline).exec();

  if (result.length === 0) {
    return {
      data: [],
      total: 0,
      totalPages: 0,
      page,
      itemsPerPage: limit
    };
  }

  const { data, metadata } = result[0];

  return {
    data,
    total: metadata?.total || 0,
    totalPages: metadata?.totalPages || 0,
    page: metadata?.page || page,
    itemsPerPage: metadata?.itemsPerPage || limit
  };
};


categorySchema.statics.getSingleWithDetailedStats = function ({
  categoryId,
  populate = []  // array of string paths like ['created_by', 'parent']
}) {
  const populateMap = {
    created_by: { from: "users", localField: "created_by", foreignField: "_id", as: "created_by" },
    updated_by: { from: "users", localField: "updated_by", foreignField: "_id", as: "updated_by" },
    parent:    { from: "categories", localField: "parent", foreignField: "_id", as: "parent" }
  };

  const pipeline = [
    { $match: { _id: categoryId, isDeleted: false } },

    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "category",
        as: "allProducts"
      }
    },

    {
      $addFields: {
        productCount: { $size: "$allProducts" },
        activeProductCount: {
          $size: {
            $filter: { input: "$allProducts", as: "product", cond: { $eq: ["$$product.status", "active"] } }
          }
        },
        deletedProductCount: {
          $size: {
            $filter: { input: "$allProducts", as: "product", cond: { $eq: ["$$product.isDeleted", true] } }
          }
        },
        featuredProductCount: {
          $size: {
            $filter: { input: "$allProducts", as: "product", cond: { $eq: ["$$product.isFeatured", true] } }
          }
        },
        outOfStockProductCount: {
          $size: {
            $filter: { input: "$allProducts", as: "product", cond: { $lte: ["$$product.stock", 0] } }
          }
        }
      }
    },

    { $project: { allProducts: 0 } }
  ];

  populate.forEach(field => {
    const cfg = populateMap[field];
    if (cfg) {
      pipeline.push({
        $lookup: {
          from: cfg.from,
          localField: cfg.localField,
          foreignField: cfg.foreignField,
          as: cfg.as
        }
      });
    }
  });

  return this.aggregate(pipeline).exec().then(results => results[0] || null);
};



const Category = mongoose.model("Category", categorySchema);
module.exports = Category;