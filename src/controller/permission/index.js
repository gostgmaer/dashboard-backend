const { FilterOptions } = require('../../utils/helper');
const Permission = require('../../models/permission');
const { standardResponse } = require('../../utils/apiUtils');

// ===== CREATE =====
const createPermission = async (req, res) => {
  try {
    const { name, description, category, isDefault, isActive, action, created_by } = req.body;

    // Basic validation for required fields
    if (!name || !action) {
      return res.status(400).json({
        success: false,
        message: "'name' and 'action' are required fields.",
        error: 'VALIDATION_ERROR'
      });
    }
    const permission = await Permission.createPermission(req.body);

    return res.status(201).json({
      success: true,
      message: 'Permission created successfully',
      data: permission
    });
  } catch (error) {
    console.error('Create permission error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create permission',
      error: error.code || 'INTERNAL_SERVER_ERROR'
    });
  }
};

// ===== GET ALL (with filters) =====
const getPermissions = async (req, res) => {
  try {
    const filterquery = FilterOptions(req.query, Permission);
    const data = await Permission.find(filterquery.query, '-__v', filterquery.options);
    const total = await Permission.countDocuments(filterquery.query);

    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      results: data,
      total,
      message: 'Permissions retrieved successfully',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: 'Internal Server Error',
      results: null,
      message: error.message,
    });
  }
};

const getAllPermissions = async (req, res) => {
  try {
    // Extract parameters from query or body (support both GET query and POST body)
    const {
      filter = {},
      page = 1,
      limit = 50,
      sort = "createdAt",
      order = "desc",
      isDeleted = false,
      // sort = 'createdAt:desc',
      selectFields = null,
      search = null,
    } = req.method === 'GET' ? req.query : req.body;

    // const sortkey = (sort && order) ? `${sort}:${sortDesc == 'false' ? 'asc' : 'desc'}` : 'createdAt:desc'
    const sortkey = {};
    sortkey[sort] = order === 'desc' ? -1 : 1;
    // const sortkey   = order === 'desc' ? -1 : 1;
    // Parse JSON fields if they come as strings in query params
    const parsedFilter = typeof filter === 'string' ? JSON.parse(filter) : filter;
    const parsedSelectFields = typeof selectFields === 'string'
      ? selectFields.split(',').map(f => f.trim())
      : selectFields;

    // Call the model static method
    const data = await Permission.getAll({
      filter: parsedFilter,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortkey,
      isDeleted,
      selectFields: parsedSelectFields,
      search,
    });

    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(400).json({ error: error.message || 'Failed to fetch permissions' });
  }
};


const getGroupedPermissions = async (req, res) => {
  console.log(req);

  try {
    const data = await Permission.getPermissionsGroupedByCategoryAndAction();
    res.status(200).json({ data, success: true });
  } catch (error) {
    console.error('Error fetching grouped permissions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ===== GET SINGLE =====
const getSinglePermission = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) {
      return res.status(404).json({
        statusCode: 404,
        status: 'Not Found',
        results: null,
        message: 'Permission not found',
      });
    }
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      results: permission,
      message: 'Permission retrieved successfully',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: 'Internal Server Error',
      results: null,
      message: error.message,
    });
  }
};

// ===== UPDATE =====
const updatePermission = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedPermission = await Permission.updatePermissionById(id, req.body);

    if (!updatedPermission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found',
        error: 'NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Permission updated successfully',
      data: updatedPermission
    });
  } catch (error) {
    console.error('Update permission error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update permission',
      error: error.code || 'INTERNAL_SERVER_ERROR'
    });
  }
};

// ===== SOFT DELETE =====
const deletePermission = async (req, res) => {
  try {
    const deleted = await Permission.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!deleted) {
      return res.status(404).json({
        statusCode: 404,
        status: 'Not Found',
        results: null,
        message: 'Permission not found',
      });
    }
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      message: 'Permission deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: 'Internal Server Error',
      results: null,
      message: error.message,
    });
  }
};

// Get all active permissions
const getActivePermissions = async (req, res) => {
  try {
    const data = await Permission.getActivePermissions();
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      results: data,
      message: 'Active permissions retrieved successfully',
    });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Search permissions by name only
const searchPermissionsByName = async (req, res) => {
  try {
    const keyword = req.query.q || '';
    const data = await Permission.searchPermissions(keyword);
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      results: data,
      message: 'Permissions search by name completed',
    });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Search permissions by name or description
const searchPermissions = async (req, res) => {
  try {
    const keyword = req.query.q || '';
    const data = await Permission.search(keyword);
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      results: data,
      message: 'Permissions search completed',
    });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Bulk create permissions
const bulkCreatePermissions = async (req, res) => {
  try {
    const inserted = await Permission.addManyPermissions(req.body.permissions);
    res.status(201).json({
      statusCode: 201,
      status: 'Created',
      results: inserted,
      message: 'Permissions created successfully',
    });
  } catch (error) {
    res.status(400).json({ statusCode: 400, status: 'Bad Request', message: error.message });
  }
};

// Get permissions by category
const getPermissionsByCategory = async (req, res) => {
  try {
    const data = await Permission.getByCategory(req.params.category);
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      results: data,
      message: 'Permissions by category retrieved successfully',
    });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Get inactive permissions
const getInactivePermissions = async (req, res) => {
  try {
    const data = await Permission.getInactivePermissions();
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      results: data,
      message: 'Inactive permissions retrieved successfully',
    });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Bulk enable
const bulkEnablePermissions = async (req, res) => {
  try {
    await Permission.bulkEnable(req.body.ids);
    res.status(200).json({ statusCode: 200, status: 'OK', message: 'Permissions enabled successfully' });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Bulk disable
const bulkDisablePermissions = async (req, res) => {
  try {
    await Permission.bulkDisable(req.body.ids);
    res.status(200).json({ statusCode: 200, status: 'OK', message: 'Permissions disabled successfully' });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Bulk delete
const bulkDeletePermissions = async (req, res) => {
  try {
    await Permission.bulkDelete(req.body.ids);
    res.status(200).json({ statusCode: 200, status: 'OK', message: 'Permissions deleted successfully' });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Check if exists by name
const checkPermissionExists = async (req, res) => {
  try {
    const exists = await Permission.existsByName(req.params.name);
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      exists,
      message: exists ? 'Permission exists' : 'Permission does not exist',
    });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Create if not exists
const createIfNotExists = async (req, res) => {
  try {
    const { name, description, category } = req.body;
    const permission = await Permission.createIfNotExists(name, description, category);
    res.status(201).json({
      statusCode: 201,
      status: 'Created',
      results: permission,
      message: 'Permission ensured successfully',
    });
  } catch (error) {
    res.status(400).json({ statusCode: 400, status: 'Bad Request', message: error.message });
  }
};

// Grouped by category
const getPermissionsGrouped = async (req, res) => {
  try {
    const grouped = await Permission.getGroupedByCategory();
    standardResponse(
      res,
      true,
      grouped,
      'Permissions grouped by category retrieved successfully',
      200
    );

  } catch (error) {
    errorResponse(
      res,
      error.message || 'Failed to retrieve grouped permissions',
      500
    );
  }
};

// ===== INSTANCE METHOD WRAPPERS =====

// Disable a permission
const disablePermission = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) return res.status(404).json({ statusCode: 404, status: 'Not Found', message: 'Permission not found' });
    await permission.disable();
    res.status(200).json({ statusCode: 200, status: 'OK', message: 'Permission disabled successfully' });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Enable a permission
const enablePermission = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) return res.status(404).json({ statusCode: 404, status: 'Not Found', message: 'Permission not found' });
    await permission.enable();
    res.status(200).json({ statusCode: 200, status: 'OK', message: 'Permission enabled successfully' });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Rename a permission
const renamePermission = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) return res.status(404).json({ statusCode: 404, status: 'Not Found', message: 'Permission not found' });
    await permission.rename(req.body.newName);
    res.status(200).json({ statusCode: 200, status: 'OK', message: 'Permission renamed successfully' });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Update description
const updatePermissionDescription = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) return res.status(404).json({ statusCode: 404, status: 'Not Found', message: 'Permission not found' });
    await permission.updateDescription(req.body.description);
    res.status(200).json({ statusCode: 200, status: 'OK', message: 'Permission description updated successfully' });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Change category
const changePermissionCategory = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) return res.status(404).json({ statusCode: 404, status: 'Not Found', message: 'Permission not found' });
    await permission.changeCategory(req.body.category);
    res.status(200).json({ statusCode: 200, status: 'OK', message: 'Permission category changed successfully' });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Toggle active/inactive
const togglePermissionActive = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) {
      return res.status(404).json({
        statusCode: 404,
        status: 'Not Found',
        message: 'Permission not found',
      });
    }
    const newState = await permission.toggleActive();
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      isActive: newState,
      message: `Permission ${newState ? 'enabled' : 'disabled'} successfully`,
    });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

// Format for API response
const getPermissionAPIResponse = async (req, res) => {
  try {
    const permission = await Permission.findById(req.params.id);
    if (!permission) {
      return res.status(404).json({
        statusCode: 404,
        status: 'Not Found',
        message: 'Permission not found',
      });
    }
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      results: permission.toAPIResponse(),
      message: 'Permission API response formatted successfully',
    });
  } catch (error) {
    res.status(500).json({ statusCode: 500, status: 'Internal Server Error', message: error.message });
  }
};

module.exports = {
  createPermission,
  updatePermissionDescription,
  renamePermission,
  enablePermission,
  disablePermission,
  createIfNotExists,
  checkPermissionExists,
  getInactivePermissions,
  getPermissionsByCategory,
  searchPermissionsByName,
  getPermissions,
  getSinglePermission,
  updatePermission,
  getPermissionAPIResponse, getGroupedPermissions,
  deletePermission,
  togglePermissionActive,
  bulkCreatePermissions,
  bulkEnablePermissions,
  bulkDisablePermissions,
  bulkDeletePermissions,
  getPermissionsGrouped,
  searchPermissions,
  getActivePermissions,
  changePermissionCategory, getAllPermissions
};
