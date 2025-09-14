const mongoose = require("mongoose");

// 🔹 Predefined role names
const PREDEFINED_ROLES = [
  "super_admin",   // Full system access
  "admin",         // Manage platform settings, users, products
  "manager",       // Oversee operations
  "staff",         // Limited admin tasks
  "vendor",        // Third-party seller
  "customer",      // Regular buyer
  "guest",         // Not logged in
  "support_agent", // Customer service
  "moderator",     // Content/review moderation
  "user"           // Generic authenticated user
];

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: PREDEFINED_ROLES,
      required: true,
      unique: true,
      trim: true
    },
    description: { type: String, trim: true },
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

//
// ===== Instance Methods =====
//

// Add a permission
roleSchema.methods.addPermission = async function (permissionId) {
  if (!this.permissions.includes(permissionId)) {
    this.permissions.push(permissionId);
    await this.save();
  }
  return this.populate("permissions");
};

// Remove a permission
roleSchema.methods.removePermission = async function (permissionId) {
  this.permissions = this.permissions.filter(
    id => id.toString() !== permissionId.toString()
  );
  await this.save();
  return this.populate("permissions");
};

// Check if role has a permission by name
roleSchema.methods.hasPermission = function (permissionName) {
  return this.permissions.some(
    perm => perm.name?.toLowerCase() === permissionName.toLowerCase()
  );
};

// Toggle active/inactive
roleSchema.methods.toggleActive = async function () {
  this.isActive = !this.isActive;
  await this.save();
  return this.isActive;
};

// Format for API
roleSchema.methods.toAPIResponse = function () {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    permissions: this.permissions,
    isDefault: this.isDefault,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

//
// ===== Static Methods =====
//

// Get all active roles
roleSchema.statics.getActiveRoles = function () {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Get role with permissions populated
roleSchema.statics.getRoleWithPermissions = function (roleId) {
  return this.findById(roleId).populate("permissions");
};

// Assign multiple permissions
roleSchema.statics.assignPermissions = function (roleId, permissionIds) {
  return this.findByIdAndUpdate(
    roleId,
    { $addToSet: { permissions: { $each: permissionIds } } },
    { new: true }
  ).populate("permissions");
};

// Remove multiple permissions
roleSchema.statics.removePermissions = function (roleId, permissionIds) {
  return this.findByIdAndUpdate(
    roleId,
    { $pull: { permissions: { $in: permissionIds } } },
    { new: true }
  ).populate("permissions");
};

// Set a role as default (unsets others)
roleSchema.statics.setDefaultRole = async function (roleName) {
  if (!PREDEFINED_ROLES.includes(roleName)) {
    throw new Error("Invalid predefined role");
  }
  await this.updateMany({}, { $set: { isDefault: false } });
  return this.findOneAndUpdate(
    { name: roleName },
    { $set: { isDefault: true } },
    { new: true }
  );
};

// Get default role
roleSchema.statics.getDefaultRole = function () {
  return this.findOne({ isDefault: true });
};

// Ensure all predefined roles exist in DB
roleSchema.statics.ensurePredefinedRoles = async function () {
  const existingRoles = await this.find({}).select("name");
  const existingNames = existingRoles.map(r => r.name);
  const missingRoles = PREDEFINED_ROLES.filter(r => !existingNames.includes(r));
  if (missingRoles.length) {
    await this.insertMany(missingRoles.map(name => ({ name })));
  }
  return this.find({});
};

// Search roles
roleSchema.statics.searchRoles = function (keyword) {
  return this.find({
    $or: [
      { name: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } }
    ]
  });
};

// Bulk deactivate roles
roleSchema.statics.bulkDeactivate = function (roleNames) {
  return this.updateMany({ name: { $in: roleNames } }, { $set: { isActive: false } });
};

// Bulk activate roles
roleSchema.statics.bulkActivate = function (roleNames) {
  return this.updateMany({ name: { $in: roleNames } }, { $set: { isActive: true } });
};
roleSchema.statics.getAllWithUserCounts = async function () {
  const User = mongoose.model("User");
  const roles = await this.find().populate("permissions");
  return Promise.all(
    roles.map(async role => {
      const userCount = await User.countDocuments({ role: role._id });
      return { ...role.toObject(), userCount };
    })
  );
};

roleSchema.statics.cloneRole = async function (sourceRoleId, newRoleName) {
  const source = await this.findById(sourceRoleId).populate("permissions");
  if (!source) throw new Error("Source role not found");
  return this.create({
    name: newRoleName,
    description: source.description,
    permissions: source.permissions.map(p => p._id)
  });
};
roleSchema.methods.syncPermissions = async function (permissionIds) {
  this.permissions = permissionIds;
  await this.save();
  return this.populate("permissions");
};
roleSchema.statics.getRoleAuditTrail = function (roleId) {
  return this.findById(roleId)
    .populate("created_by", "name email")
    .populate("updated_by", "name email");
};
roleSchema.statics.isRoleInUse = async function (roleId) {
  const User = mongoose.model("User");
  const count = await User.countDocuments({ role: roleId });
  return count > 0;
};
roleSchema.statics.bulkAssignPermissions = function (roleIds, permissionIds) {
  return this.updateMany(
    { _id: { $in: roleIds } },
    { $addToSet: { permissions: { $each: permissionIds } } }
  );
};

roleSchema.statics.exportRoles = function () {
  return this.find().populate("permissions");
};

roleSchema.statics.importRoles = async function (rolesData) {
  return this.insertMany(rolesData);
};

roleSchema.statics.getDefaultRoleId = async function () {
  const role = await this.findOne({ isDefault: true });
  return role ? role._id : null;
};

const Role = mongoose.model("Role", roleSchema);
module.exports = Role;