const { FilterOptions } = require('../../utils/helper');
const Permission = require('../../models/permission');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

// ===== CREATE =====
const createPermission = catchAsync(async (req, res) => {
  const { name, action } = req.body;

  if (!name || !action) {
    throw AppError.badRequest("'name' and 'action' are required fields");
  }

  const permission = await Permission.createPermission(req.body);
  return sendCreated(res, { data: permission, message: 'Permission created successfully' });
});

// ===== GET ALL (with filters) =====
const getPermissions = catchAsync(async (req, res) => {
  const filterquery = FilterOptions(req.query, Permission);
  const data = await Permission.find(filterquery.query, '-__v', filterquery.options);
  const total = await Permission.countDocuments(filterquery.query);

  return sendSuccess(res, { data: { results: data, total }, message: 'Permissions retrieved successfully' });
});

const getAllPermissions = catchAsync(async (req, res) => {
  const { filter = {}, page = 1, limit = 10, sort = 'createdAt', order = 'desc', isDeleted = false, selectFields = null, search = null } = req.method === 'GET' ? req.query : req.body;

  const sortkey = {};
  sortkey[sort] = order === 'desc' ? -1 : 1;

  const parsedFilter = typeof filter === 'string' ? JSON.parse(filter) : filter;
  const parsedSelectFields = typeof selectFields === 'string' ? selectFields.split(',').map((f) => f.trim()) : selectFields;

  const data = await Permission.getAll({
    filter: parsedFilter,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: sortkey,
    isDeleted,
    selectFields: parsedSelectFields,
    search,
  });

  return sendSuccess(res, { data, message: 'Permissions retrieved successfully' });
});

const getGroupedPermissions = catchAsync(async (req, res) => {
  const data = await Permission.getPermissionsGroupedByCategoryAndAction();
  return sendSuccess(res, { data, message: 'Grouped permissions retrieved' });
});

// ===== GET SINGLE =====
const getSinglePermission = catchAsync(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    throw AppError.notFound('Permission not found');
  }
  return sendSuccess(res, { data: permission, message: 'Permission retrieved successfully' });
});

// ===== UPDATE =====
const updatePermission = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updatedPermission = await Permission.updatePermissionById(id, req.body);

  if (!updatedPermission) {
    throw AppError.notFound('Permission not found');
  }

  return sendSuccess(res, { data: updatedPermission, message: 'Permission updated successfully' });
});

// ===== SOFT DELETE =====
const deletePermission = catchAsync(async (req, res) => {
  const deleted = await Permission.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!deleted) {
    throw AppError.notFound('Permission not found');
  }
  return sendSuccess(res, { message: 'Permission deleted successfully' });
});

// Get all active permissions
const getActivePermissions = catchAsync(async (req, res) => {
  const data = await Permission.getActivePermissions();
  return sendSuccess(res, { data, message: 'Active permissions retrieved successfully' });
});

// Search permissions by name only
const searchPermissionsByName = catchAsync(async (req, res) => {
  const keyword = req.query.q || '';
  const data = await Permission.searchPermissions(keyword);
  return sendSuccess(res, { data, message: 'Permissions search by name completed' });
});

// Search permissions by name or description
const searchPermissions = catchAsync(async (req, res) => {
  const keyword = req.query.q || '';
  const data = await Permission.search(keyword);
  return sendSuccess(res, { data, message: 'Permissions search completed' });
});

// Bulk create permissions
const bulkCreatePermissions = catchAsync(async (req, res) => {
  const inserted = await Permission.addManyPermissions(req.body.permissions);
  return sendCreated(res, { data: inserted, message: 'Permissions created successfully' });
});

// Get permissions by category
const getPermissionsByCategory = catchAsync(async (req, res) => {
  const data = await Permission.getByCategory(req.params.category);
  return sendSuccess(res, { data, message: 'Permissions by category retrieved successfully' });
});

// Get inactive permissions
const getInactivePermissions = catchAsync(async (req, res) => {
  const data = await Permission.getInactivePermissions();
  return sendSuccess(res, { data, message: 'Inactive permissions retrieved successfully' });
});

// Bulk enable
const bulkEnablePermissions = catchAsync(async (req, res) => {
  await Permission.bulkEnable(req.body.ids);
  return sendSuccess(res, { message: 'Permissions enabled successfully' });
});

// Bulk disable
const bulkDisablePermissions = catchAsync(async (req, res) => {
  await Permission.bulkDisable(req.body.ids);
  return sendSuccess(res, { message: 'Permissions disabled successfully' });
});

// Bulk delete
const bulkDeletePermissions = catchAsync(async (req, res) => {
  await Permission.bulkDelete(req.body.ids);
  return sendSuccess(res, { message: 'Permissions deleted successfully' });
});

// Check if exists by name
const checkPermissionExists = catchAsync(async (req, res) => {
  const exists = await Permission.existsByName(req.params.name);
  return sendSuccess(res, { data: { exists }, message: exists ? 'Permission exists' : 'Permission does not exist' });
});

// Create if not exists
const createIfNotExists = catchAsync(async (req, res) => {
  const { name, description, category } = req.body;
  const permission = await Permission.createIfNotExists(name, description, category);
  return sendCreated(res, { data: permission, message: 'Permission ensured successfully' });
});

// Grouped by category
const getPermissionsGrouped = catchAsync(async (req, res) => {
  const grouped = await Permission.getGroupedByCategory();
  return sendSuccess(res, { data: grouped, message: 'Permissions grouped by category retrieved successfully' });
});

// ===== INSTANCE METHOD WRAPPERS =====

// Disable a permission
const disablePermission = catchAsync(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    throw AppError.notFound('Permission not found');
  }
  await permission.disable();
  return sendSuccess(res, { message: 'Permission disabled successfully' });
});

// Enable a permission
const enablePermission = catchAsync(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    throw AppError.notFound('Permission not found');
  }
  await permission.enable();
  return sendSuccess(res, { message: 'Permission enabled successfully' });
});

// Rename a permission
const renamePermission = catchAsync(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    throw AppError.notFound('Permission not found');
  }
  await permission.rename(req.body.newName);
  return sendSuccess(res, { message: 'Permission renamed successfully' });
});

// Update description
const updatePermissionDescription = catchAsync(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    throw AppError.notFound('Permission not found');
  }
  await permission.updateDescription(req.body.description);
  return sendSuccess(res, { message: 'Permission description updated successfully' });
});

// Change category
const changePermissionCategory = catchAsync(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    throw AppError.notFound('Permission not found');
  }
  await permission.changeCategory(req.body.category);
  return sendSuccess(res, { message: 'Permission category changed successfully' });
});

// Toggle active/inactive
const togglePermissionActive = catchAsync(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    throw AppError.notFound('Permission not found');
  }
  const newState = await permission.toggleActive();
  return sendSuccess(res, { data: { isActive: newState }, message: `Permission ${newState ? 'enabled' : 'disabled'} successfully` });
});

// Format for API response
const getPermissionAPIResponse = catchAsync(async (req, res) => {
  const permission = await Permission.findById(req.params.id);
  if (!permission) {
    throw AppError.notFound('Permission not found');
  }
  return sendSuccess(res, { data: permission.toAPIResponse(), message: 'Permission API response formatted successfully' });
});

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
  getPermissionAPIResponse,
  getGroupedPermissions,
  deletePermission,
  togglePermissionActive,
  bulkCreatePermissions,
  bulkEnablePermissions,
  bulkDisablePermissions,
  bulkDeletePermissions,
  getPermissionsGrouped,
  searchPermissions,
  getActivePermissions,
  changePermissionCategory,
  getAllPermissions,
};
