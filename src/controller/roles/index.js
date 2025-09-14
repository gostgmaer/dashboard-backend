const { StatusCodes, ReasonPhrases } = require('http-status-codes');
const  Role  = require('../../models/role');
const User = require('../../models/user');
/**
 * Create a new role
 */
const create = async (req, res) => {
  try {
    const role = await Role.create(req.body);
    res.status(StatusCodes.CREATED).json({
      statusCode: StatusCodes.CREATED,
      status: ReasonPhrases.CREATED,
      results: { id: role._id },
      message: 'Role created successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

/**
 * Get all roles (optionally only active or search)
 */
const getAll = async (req, res) => {
  try {
    const { activeOnly, search } = req.query;
    let roles;

    if (search) {
      roles = await Role.searchRoles(search).populate('permissions');
    } else if (activeOnly === 'true') {
      roles = await Role.getActiveRoles().populate('permissions');
    } else {
      roles = await Role.find().sort({ name: 1 }).populate('permissions');
    }

    // Count users for each role
    // adjust path to your User model
    const rolesWithCounts = await Promise.all(
      roles.map(async (role) => {
        const userCount = await User.countDocuments({ role: role._id });
        return {
          ...role.toObject(), // full role data
          userCount,
        };
      })
    );

    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: rolesWithCounts,
      total: rolesWithCounts.length,
      message: 'Roles retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

/**
 * Get single role with permissions
 */
const getSingle = async (req, res) => {
  try {
    // Get role with permissions populated
    const role = await Role.getRoleWithPermissions(req.params.id);
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'Role not found',
      });
    }

    // Count how many users have this role

    const userCount = await User.countDocuments({ role: role._id });

    // Return full role object + user count
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: {
        ...role.toObject(), // full role data from Mongo
        userCount,
      },
      message: 'Role retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

/**
 * Update role
 */
const update = async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'Role not found',
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: role.toAPIResponse(),
      message: 'Role updated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

/**
 * Deactivate (soft delete) role
 */
const remove = async (req, res) => {
  try {
    const role = await Role.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'Role not found',
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: 'Role deactivated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

/**
 * ===== Instance Method Controllers =====
 */

// Add a single permission to a role
const addPermission = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).populate('permissions');
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        message: 'Role not found',
      });
    }
    const updated = await role.addPermission(req.body.permissionId);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: updated,
      message: 'Permission added successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

// Remove a single permission from a role
const removePermission = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).populate('permissions');
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        message: 'Role not found',
      });
    }
    const updated = await role.removePermission(req.body.permissionId);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: updated,
      message: 'Permission removed successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

// Check if a role has a specific permission
const hasPermission = async (req, res) => {
  try {
    const role = await Role.getRoleWithPermissions(req.params.id);
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        message: 'Role not found',
      });
    }
    const hasPerm = role.hasPermission(req.params.permissionName);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: { hasPermission: hasPerm },
      message: `Role ${hasPerm ? 'has' : 'does not have'} the permission`,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

// Toggle active/inactive
const toggleActive = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        message: 'Role not found',
      });
    }
    const newStatus = await role.toggleActive();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: { isActive: newStatus },
      message: `Role is now ${newStatus ? 'active' : 'inactive'}`,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

/**
 * ===== Static Method Controllers =====
 */

// Get all active roles
const getActiveRole = async (req, res) => {
  try {
    const roles = await Role.getActiveRoles().populate('permissions');
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: roles,
      total: roles.length,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

// Get role with permissions
const getRoleWithPermissions = async (req, res) => {
  try {
    const role = await Role.getRoleWithPermissions(req.params.id);
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        message: 'Role not found',
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: role,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

// Assign multiple permissions
const assignPermissions = async (req, res) => {
  try {
    const role = await Role.assignPermissions(req.params.id, req.body.permissionIds);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: role,
      message: 'Permissions assigned successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

// Remove multiple permissions
const removePermissions = async (req, res) => {
  try {
    const role = await Role.removePermissions(req.params.id, req.body.permissionIds);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: role,
      message: 'Permissions removed successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

// Set default role
const setDefaultRole = async (req, res) => {
  try {
    const role = await Role.setDefaultRole(req.body.roleName);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: role,
      message: 'Default role set successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

// Get default role
const getDefaultRole = async (req, res) => {
  try {
    const role = await Role.getDefaultRole();
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        message: 'No default role set',
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: role,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

// Ensure all predefined roles exist
const ensurePredefinedRoles = async (req, res) => {
  try {
    const roles = await Role.ensurePredefinedRoles();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: roles,
      message: 'Predefined roles ensured successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

// Search roles
const searchRoles = async (req, res) => {
  try {
    const roles = await Role.searchRoles(req.query.keyword || '');
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: roles,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

// Bulk deactivate roles
const bulkDeactivate = async (req, res) => {
  try {
    await Role.bulkDeactivate(req.body.roleNames);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: 'Roles deactivated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

// Bulk activate roles
const bulkActivate = async (req, res) => {
  try {
    await Role.bulkActivate(req.body.roleNames);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: 'Roles activated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

const getAllWithCounts = async (req, res) => {
  try {
    const roles = await Role.getAllWithUserCounts();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: roles,
      total: roles.length,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ ...error });
  }
};

/**
 * Clone a role
 */
const cloneRole = async (req, res) => {
  try {
    const { sourceRoleId, newRoleName } = req.body;
    const source = await Role.findById(sourceRoleId).populate('permissions');
    if (!source) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        message: 'Source role not found',
      });
    }
    const newRole = await Role.create({
      name: newRoleName,
      description: source.description,
      permissions: source.permissions.map((p) => p._id),
    });
    res.status(StatusCodes.CREATED).json({
      statusCode: StatusCodes.CREATED,
      status: ReasonPhrases.CREATED,
      results: newRole,
      message: 'Role cloned successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

/**
 * Sync permissions for a role
 */
const syncPermissions = async (req, res) => {
  try {
    const { permissionIds } = req.body;
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        message: 'Role not found',
      });
    }
    role.permissions = permissionIds;
    await role.save();
    await role.populate('permissions');
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: role,
      message: 'Permissions synced successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

/**
 * Get role audit trail
 */
const getRoleAuditTrail = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).populate('created_by', 'name email').populate('updated_by', 'name email').populate('permissions');
    if (!role) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        message: 'Role not found',
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: role,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

/**
 * Check if role is in use
 */
const isRoleInUse = async (req, res) => {
  try {
    const count = await User.countDocuments({ role: req.params.id });
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: { inUse: count > 0, userCount: count },
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

/**
 * Bulk assign permissions to multiple roles
 */
const bulkAssignPermissions = async (req, res) => {
  try {
    const { roleIds, permissionIds } = req.body;
    await Role.updateMany({ _id: { $in: roleIds } }, { $addToSet: { permissions: { $each: permissionIds } } });
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: 'Permissions assigned to roles successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

/**
 * Export roles
 */
const exportRoles = async (req, res) => {
  try {
    const roles = await Role.find().populate('permissions');
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: roles,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

/**
 * Import roles
 */
const importRoles = async (req, res) => {
  try {
    const { rolesData } = req.body;
    const inserted = await Role.insertMany(rolesData);
    res.status(StatusCodes.CREATED).json({
      statusCode: StatusCodes.CREATED,
      status: ReasonPhrases.CREATED,
      results: inserted,
      message: 'Roles imported successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      message: error.message,
    });
  }
};

/**
 * Get default role ID
 */
const getDefaultRoleId = async (req, res) => {
  try {
    const role = await Role.findOne({ isDefault: true });
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: { defaultRoleId: role ? role._id : null },
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};

module.exports = {
  create,
  getAll,
  getSingle,
  update,
  getAllWithCounts,
  remove,
  assignPermissions,
  removePermissions,
  toggleActive,
  addPermission,
  removePermission,
  hasPermission,
  bulkAssignPermissions,
  getRoleAuditTrail,
  cloneRole,
  getDefaultRoleId,
  getActiveRole,
  getRoleWithPermissions,
  importRoles,
  exportRoles,

  setDefaultRole,
  getDefaultRole,
  isRoleInUse,
  ensurePredefinedRoles,
  syncPermissions,
  searchRoles,
  bulkDeactivate,
  bulkActivate,
};
