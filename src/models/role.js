const Permission = require('./permission');
const User = require('./user');
const mongoose = require('mongoose');

// 🔹 Predefined role names
const PREDEFINED_ROLES = [
  'super_admin', // Full system access
  'admin', // Manage platform settings, users, products
  'manager', // Oversee operations
  'staff', // Limited admin tasks
  'vendor', // Third-party seller
  'customer', // Regular buyer
  'guest', // Not logged in
  'support_agent', // Customer service
  'moderator', // Content/review moderation
  'user', // Generic authenticated user
];

// List all filterable fields and how to translate query values
const FILTER_DEFINITIONS = {
  name: { type: 'string', list: true },
  isActive: { type: 'boolean' },
  isDefault: { type: 'boolean' },
  hasUsers: { type: 'boolean' },
  permissionCount: { type: 'range', operators: ['gt', 'gte', 'lt', 'lte', 'eq'] },
  categoryCount: { type: 'range', operators: ['gt', 'gte', 'lt', 'lte', 'eq'] },
  created_by: { type: 'objectId' },
  updated_by: { type: 'objectId' },
  dateRange: { type: 'dateRange' },
};

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: PREDEFINED_ROLES,
      required: true,
      unique: true,
      trim: true,
    },
    description: { type: String, trim: true },
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
    isDefault: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
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
  return this.populate('permissions');
};

// Remove a permission
roleSchema.methods.removePermission = async function (permissionId) {
  this.permissions = this.permissions.filter((id) => id.toString() !== permissionId.toString());
  await this.save();
  return this.populate('permissions');
};

// Check if role has a permission by name
roleSchema.methods.hasPermission = function (permissionName) {
  return this.permissions.some((perm) => perm.name?.toLowerCase() === permissionName.toLowerCase());
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
    updatedAt: this.updatedAt,
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
  return this.findById(roleId).select('name description isActive isDefault permissions')
};

// Assign multiple permissions
roleSchema.statics.assignPermissions = function (roleId, permissionIds) {
  return this.findByIdAndUpdate(roleId, { $addToSet: { permissions: { $each: permissionIds } } }, { new: true }).populate('permissions');
};

// Remove multiple permissions
roleSchema.statics.removePermissions = function (roleId, permissionIds) {
  return this.findByIdAndUpdate(roleId, { $pull: { permissions: { $in: permissionIds } } }, { new: true }).populate('permissions');
};

// Set a role as default (unsets others)
roleSchema.statics.setDefaultRole = async function (roleName) {
  if (!PREDEFINED_ROLES.includes(roleName)) {
    throw new Error('Invalid predefined role');
  }
  await this.updateMany({}, { $set: { isDefault: false } });
  return this.findOneAndUpdate({ name: roleName }, { $set: { isDefault: true } }, { new: true });
};

// Get default role
roleSchema.statics.getDefaultRole = function () {
  return this.findOne({ isDefault: true });
};

// Ensure all predefined roles exist in DB
roleSchema.statics.ensurePredefinedRoles = async function () {
  const existingRoles = await this.find({}).select('name');
  const existingNames = existingRoles.map((r) => r.name);
  const missingRoles = PREDEFINED_ROLES.filter((r) => !existingNames.includes(r));
  if (missingRoles.length) {
    await this.insertMany(missingRoles.map((name) => ({ name })));
  }
  return this.find({});
};

// Search roles
roleSchema.statics.searchRoles = function (keyword) {
  return this.find({
    $or: [{ name: { $regex: keyword, $options: 'i' } }, { description: { $regex: keyword, $options: 'i' } }],
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
  const User = mongoose.model('User');
  const roles = await this.find().populate('permissions');
  return Promise.all(
    roles.map(async (role) => {
      const userCount = await User.countDocuments({ role: role._id });
      return { ...role.toObject(), userCount };
    })
  );
};

roleSchema.statics.cloneRole = async function (sourceRoleId, newRoleName) {
  const source = await this.findById(sourceRoleId).populate('permissions');
  if (!source) throw new Error('Source role not found');
  return this.create({
    name: newRoleName,
    description: source.description,
    permissions: source.permissions.map((p) => p._id),
  });
};
roleSchema.methods.syncPermissions = async function (permissionIds) {
  this.permissions = permissionIds;
  await this.save();
  return this.populate('permissions');
};
roleSchema.statics.getRoleAuditTrail = function (roleId) {
  return this.findById(roleId).populate('created_by', 'name email').populate('updated_by', 'name email');
};
roleSchema.statics.isRoleInUse = async function (roleId) {
  const User = mongoose.model('User');
  const count = await User.countDocuments({ role: roleId });
  return count > 0;
};
roleSchema.statics.bulkAssignPermissions = function (roleIds, permissionIds) {
  return this.updateMany({ _id: { $in: roleIds } }, { $addToSet: { permissions: { $each: permissionIds } } });
};

roleSchema.statics.exportRoles = function () {
  return this.find().populate('permissions');
};

roleSchema.statics.importRoles = async function (rolesData) {
  return this.insertMany(rolesData);
};

roleSchema.statics.getDefaultRoleId = async function () {
  const role = await this.findOne({ isDefault: true });
  return role ? role._id : null;
};

// role.js (within your schema definition file)

roleSchema.statics.getRoleStatistics = async function (options = {}) {
  const { page = 1, limit = 10, sortBy = 'name', sortOrder = 'asc', search = '', isActive = null, includePermissionDetails = true, created_by = null, updated_by = null, isDefault = null, createdFrom = null, createdTo = null, updatedFrom = null, updatedTo = null } = options;

  // Build filter query
  const filter = {};

  if (search) {
    filter.$or = [{ name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }];
  }

  if (isActive !== null) {
    filter.isActive = isActive;
  }

  if (isDefault !== null) {
    filter.isDefault = isDefault;
  }

  if (created_by) {
    filter.created_by = created_by;
  }

  if (updated_by) {
    filter.updated_by = updated_by;
  }

  if (createdFrom || createdTo) {
    filter.createdAt = {};
    if (createdFrom) filter.createdAt.$gte = new Date(createdFrom);
    if (createdTo) filter.createdAt.$lte = new Date(createdTo);
  }

  if (updatedFrom || updatedTo) {
    filter.updatedAt = {};
    if (updatedFrom) filter.updatedAt.$gte = new Date(updatedFrom);
    if (updatedTo) filter.updatedAt.$lte = new Date(updatedTo);
  }

  // Pagination & sorting
  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'desc' ? -1 : 1;

  // Fetch roles
  const roles = await this.find(filter)
    .populate('permissions')
    .populate('created_by', 'name email')
    .populate('updated_by', 'name email')
    .sort({ [sortBy]: sortDirection })
    .skip(skip)
    .limit(limit);

  const totalRoles = await this.countDocuments(filter);

  // Count users per role
  const User = mongoose.model('User');
  const roleIds = roles.map((r) => r._id);
  const userCounts = await User.aggregate([{ $match: { role: { $in: roleIds } } }, { $group: { _id: '$role', userCount: { $sum: 1 } } }]);
  const userCountMap = {};
  userCounts.forEach((uc) => {
    userCountMap[uc._id.toString()] = uc.userCount;
  });

  // Permission stats if required
  let permissionStats = {};
  let categoryStats = {};
  if (includePermissionDetails) {
    const allPermissions = await Permission.find({});
    const permissionsByCategory = allPermissions.reduce((acc, perm) => {
      const cat = perm.category || 'uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    }, {});
    Object.keys(permissionsByCategory).forEach((cat) => {
      const perms = permissionsByCategory[cat];
      categoryStats[cat] = {
        totalPermissions: perms.length,
        activePermissions: perms.filter((p) => p.isActive !== false).length,
      };
    });
    permissionStats = {
      totalPermissions: allPermissions.length,
      totalCategories: Object.keys(permissionsByCategory).length,
      categoriesBreakdown: categoryStats,
    };
  }

  // Format roles with statistics + `per` key
  const formattedRoles = roles.map((role) => {
    const roleObj = role.toObject();
    const userCount = userCountMap[role._id.toString()] || 0;

    const permsByCat = role.permissions.reduce((acc, perm) => {
      const cat = perm.category || 'uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    }, {});

    return {
      ...roleObj,
      userCount,
      permissionsCount: role.permissions.length,
      per: role.permissions.map((p) => p._id.toString()),
      permissionsByCategory: permsByCat,
      categoriesCount: Object.keys(permsByCat).length,
      statistics: {
        isInUse: userCount > 0,
        permissionDensity: role.permissions.length,
        categorySpread: Object.keys(permsByCat).length,
      },
    };
  });

  // Overall statistics
  const overallStats = {
    totalRoles,
    activeRoles: await this.countDocuments({ isActive: true }),
    inactiveRoles: await this.countDocuments({ isActive: false }),
    defaultRole: await this.findOne({ isDefault: true }, 'name'),
    rolesInUse: formattedRoles.filter((r) => r.userCount > 0).length,
    unusedRoles: formattedRoles.filter((r) => r.userCount === 0).length,
    totalUsersAssigned: Object.values(userCountMap).reduce((sum, c) => sum + c, 0),
    avgPermissionsPerRole: formattedRoles.length > 0 ? Math.round(formattedRoles.reduce((sum, r) => sum + r.permissionsCount, 0) / formattedRoles.length) : 0,
  };

  return {
    roles: formattedRoles,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalRoles / limit),
      totalItems: totalRoles,
      itemsPerPage: limit,
      hasNextPage: page < Math.ceil(totalRoles / limit),
      hasPrevPage: page > 1,
    },
    overallStatistics: overallStats,
    permissionStatistics: permissionStats,
    filters: { search, isActive, sortBy, sortOrder },
  };
};

roleSchema.statics.getCompleteRoleStatistics = async function () {
  try {
    const User = require('./user');

    // Basic role counts
    const totalRoles = await this.countDocuments({});
    const activeRoles = await this.countDocuments({ isActive: true });
    const inactiveRoles = await this.countDocuments({ isActive: false });
    const deletedRoles = await this.countDocuments({ isDeleted: true });
    const defaultRoles = await this.countDocuments({ isDefault: true });

    // Get all roles with populated permissions
    const allRoles = await this.find({ isDeleted: false }).populate('permissions').populate('created_by', 'name email').populate('updated_by', 'name email');

    const userCountMap = {};
    // Total users in system
    const totalUsers = await User.countDocuments();
    // User assignment statistics
    const userAssignmentStats = await User.aggregate([
      {
        $lookup: {
          from: 'roles', // name of the roles collection (check your DB for exact name)
          localField: 'role', // field in User documents
          foreignField: '_id', // field in Role documents
          as: 'roleData',
        },
      },
      {
        $unwind: {
          path: '$roleData',
          preserveNullAndEmptyArrays: true, // keep users even if they have no role assigned
        },
      },
      {
        $group: {
          _id: '$role',
          name: { $first: '$roleData.name' }, // role name from joined roleData
          userCount: { $sum: 1 },
        },
      },
    ]);

    let totalUsersAssigned = 0;
    userAssignmentStats.forEach((stat) => {
      if (stat._id) {
        userCountMap[stat._id.toString()] = stat.userCount;
        totalUsersAssigned += stat.userCount;
      }
    });

    // Unassigned user count
    const unassignedUsersCount = totalUsers - totalUsersAssigned;

    // Permission statistics
    const allPermissions = await Permission.find({});
    const totalPermissions = allPermissions.length;
    const activePermissions = allPermissions.filter((p) => p.isActive !== false).length;

    // Permissions by category
    const permissionsByCategory = allPermissions.reduce((acc, perm) => {
      const category = perm.category || 'uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(perm);
      return acc;
    }, {});

    // Role-specific statistics
    const roleDetails = allRoles.map((role) => {
      const userCount = userCountMap[role._id.toString()] || 0;
      const permissionsByRoleCategory = role.permissions.reduce((acc, perm) => {
        const category = perm.category || 'uncategorized';
        if (!acc[category]) acc[category] = 0;
        acc[category]++;
        return acc;
      }, {});

      return {
        id: role._id,
        name: role.name,
        description: role.description,
        isActive: role.isActive,
        isDefault: role.isDefault,
        userCount,
        permissionCount: role.permissions.length,
        permissionsByCategory: permissionsByRoleCategory,
        categoriesCount: Object.keys(permissionsByRoleCategory).length,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        created_by: role.created_by,
        updated_by: role.updated_by,
        isInUse: userCount > 0,
      };
    });

    // Advanced statistics
    const rolesInUse = roleDetails.filter((r) => r.userCount > 0).length;
    const unusedRoles = roleDetails.filter((r) => r.userCount === 0).length;
    const avgPermissionsPerRole = totalRoles > 0 ? Math.round(roleDetails.reduce((sum, r) => sum + r.permissionCount, 0) / totalRoles) : 0;

    // Most/least used roles
    const sortedByUsers = [...roleDetails].sort((a, b) => b.userCount - a.userCount);
    const mostUsedRole = sortedByUsers[0];
    const leastUsedRole = sortedByUsers[sortedByUsers.length - 1];

    // Most/least permissions
    const sortedByPermissions = [...roleDetails].sort((a, b) => b.permissionCount - a.permissionCount);
    const roleWithMostPermissions = sortedByPermissions[0];
    const roleWithLeastPermissions = sortedByPermissions[sortedByPermissions.length - 1];

    // Category statistics
    const categoryStats = {};
    Object.keys(permissionsByCategory).forEach((category) => {
      const perms = permissionsByCategory[category];
      categoryStats[category] = {
        totalPermissions: perms.length,
        activePermissions: perms.filter((p) => p.isActive !== false).length,
        rolesUsingCategory: roleDetails.filter((r) => Object.keys(r.permissionsByCategory).includes(category)).length,
      };
    });

    return {
      summary: {
        totalRoles,
        activeRoles,
        inactiveRoles,
        deletedRoles,
        defaultRoles,
        rolesInUse,
        unusedRoles,
        totalUsersAssigned,
        unassignedUsers: unassignedUsersCount,
        totalPermissions,
        activePermissions,
        totalCategories: Object.keys(permissionsByCategory).length,
        avgPermissionsPerRole,
      },
      roleBreakdown: {
        mostUsedRole: mostUsedRole
          ? {
              name: mostUsedRole.name,
              userCount: mostUsedRole.userCount,
            }
          : null,
        leastUsedRole: leastUsedRole
          ? {
              name: leastUsedRole[leastUsedRole.length - 1].name,
              userCount: leastUsedRole[leastUsedRole.length - 1].userCount,
            }
          : null,
        roleWithMostPermissions: roleWithMostPermissions
          ? {
              name: roleWithMostPermissions.name,
              permissionCount: roleWithMostPermissions.permissionCount,
            }
          : null,
        roleWithLeastPermissions: roleWithLeastPermissions
          ? {
              name: roleWithLeastPermissions[leastUsedRole.length - 1].name,
              permissionCount: roleWithLeastPermissions[leastUsedRole.length - 1].permissionCount,
            }
          : null,
      },
      detailedRoles: roleDetails,
      permissionStatistics: {
        totalPermissions,
        activePermissions,
        inactivePermissions: totalPermissions - activePermissions,
        categoriesBreakdown: categoryStats,
      },
      userDistribution: [
        ...userAssignmentStats.map((stat) => ({
          roleId: stat._id,
          roleName: stat.name,
          userCount: stat.userCount,
        })),
        {
          roleId: 'Unassigned',
          roleName: 'Unassigned Users',
          userCount: unassignedUsersCount,
        },
      ],
      unassignedUsers: unassignedUsersCount,
    };
  } catch (error) {
    throw new Error(`Error generating role statistics: ${error.message}`);
  }
};

const Role = mongoose.model('Role', roleSchema);
module.exports = Role;
