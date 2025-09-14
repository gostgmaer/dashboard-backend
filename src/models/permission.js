const mongoose = require("mongoose");
const ACTIONS = {
  READ: 'read',
  WRITE: 'write',
  MODIFY: 'modify',
  DELETE: 'delete',
  MANAGE: 'manage'
};
const permissionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    // e.g., "product:create", "order:approve"

    description: { type: String, trim: true },
    // Human-readable description

    category: { type: String, trim: true },
    isDefault: { type: Boolean, default: true },
    // e.g., "Product Management", "Order Management"

    isActive: { type: Boolean, default: true },
    action: {
      type: String,
      enum: Object.values(ACTIONS),
      required: true
    },
    // Can disable a permission without deleting

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// ===== Static Methods =====

// Get all active permissions
permissionSchema.statics.getActivePermissions = function () {
  return this.find({ isActive: true }).sort({ category: 1, name: 1 });
};

// Search permissions by keyword
permissionSchema.statics.searchPermissions = function (keyword) {
  return this.find({ name: { $regex: keyword, $options: "i" } });
};

// Bulk create permissions
permissionSchema.statics.addManyPermissions = function (permissions) {
  return this.insertMany(permissions, { ordered: false });
};

// ===== Instance Methods =====

// Disable a permission
permissionSchema.methods.disable = async function () {
  this.isActive = false;
  await this.save();
  return this;
};

// Enable a permission
permissionSchema.methods.enable = async function () {
  this.isActive = true;
  await this.save();
  return this;
};
// ===== Instance Methods =====

// Rename a permission
permissionSchema.methods.rename = async function (newName) {
  this.name = newName.trim().toLowerCase();
  await this.save();
  return this;
};

// Update description
permissionSchema.methods.updateDescription = async function (desc) {
  this.description = desc;
  await this.save();
  return this;
};

// Move permission to a different category
permissionSchema.methods.changeCategory = async function (category) {
  this.category = category;
  await this.save();
  return this;
};

// Toggle active/inactive
permissionSchema.methods.toggleActive = async function () {
  this.isActive = !this.isActive;
  await this.save();
  return this.isActive;
};

// Format for API response
permissionSchema.methods.toAPIResponse = function () {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    category: this.category,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// ===== Static Methods =====

// Get permissions by category
permissionSchema.statics.getByCategory = function (category) {
  return this.find({ category }).sort({ name: 1 });
};

// Get inactive permissions
permissionSchema.statics.getInactivePermissions = function () {
  return this.find({ isActive: false });
};

// Bulk enable permissions
permissionSchema.statics.bulkEnable = function (ids) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { isActive: true } });
};

// Bulk disable permissions
permissionSchema.statics.bulkDisable = function (ids) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
};

// Delete multiple permissions
permissionSchema.statics.bulkDelete = function (ids) {
  return this.deleteMany({ _id: { $in: ids } });
};

// Check if a permission exists by name
permissionSchema.statics.existsByName = async function (name) {
  return !!(await this.findOne({ name: name.trim().toLowerCase() }));
};

// Create permission if it doesn't exist
permissionSchema.statics.createIfNotExists = async function (name, description = "", category = "") {
  const existing = await this.findOne({ name: name.trim().toLowerCase() });
  if (existing) return existing;
  return this.create({ name: name.trim().toLowerCase(), description, category });
};

// Get all permissions grouped by category
permissionSchema.statics.getGroupedByCategory = async function () {
  const permissions = await this.find().sort({ category: 1, name: 1 }).lean();
  return permissions.reduce((acc, perm) => {
    if (!acc[perm.category || "Uncategorized"]) {
      acc[perm.category || "Uncategorized"] = [];
    }
    acc[perm.category || "Uncategorized"].push(perm);
    return acc;
  }, {});
};

// Search by partial match in name or description
permissionSchema.statics.search = function (keyword) {
  return this.find({
    $or: [
      { name: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } }
    ]
  });
};

const Permission = mongoose.model("Permission", permissionSchema);
module.exports = Permission;