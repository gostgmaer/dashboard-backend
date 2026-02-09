const User = require('../../models/user');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');
const ActivityHelper = require('../../utils/activityHelpers');

// Create a new user
const createUser = catchAsync(async (req, res) => {
  const user = new User(req.body);
  if (req.body.password) {
    await user.setPassword(req.body.password);
  }
  const saved = await user.save();

  await ActivityHelper.logCRUD(req, 'User', 'Create', {
    id: saved._id,
    username: saved.username,
    email: saved.email,
    firstName: saved.firstName,
    lastName: saved.lastName,
  });

  return sendCreated(res, { data: { id: saved._id }, message: 'User created successfully' });
});

// Get all users (with pagination and filters)
const getAllUsers = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, ...filters } = req.query;
  const { items, total, page: currentPage, pages } = await User.getPaginatedUsers({ page, limit, filters });
  return sendSuccess(res, { data: { results: items, total, page: currentPage, pages }, message: 'Users retrieved successfully' });
});

// Get a single user by ID
const getSingleUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  return sendSuccess(res, { data: user, message: 'User retrieved successfully' });
});

// Update a user by ID
const updateUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  await user.updateProfile(req.body);
  return sendSuccess(res, { data: user, message: 'User updated successfully' });
});

// Soft-delete a user by ID
const deleteUser = catchAsync(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { status: 'deleted' }, { new: true });
  if (!user) throw AppError.notFound('User not found');
  return sendSuccess(res, { message: 'User deleted successfully' });
});

// Set user password
const setUserPassword = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  await user.setPassword(req.body.password);
  return sendSuccess(res, { message: 'Password set successfully' });
});

// Validate user password
const validateUserPassword = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const isValid = await user.validatePassword(req.body.password);
  return sendSuccess(res, { data: { isValid }, message: isValid ? 'Password is valid' : 'Password is invalid' });
});

// Add product to wishlist
const addToWishlist = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const wishList = await user.addToWishlist(req.body.productId);
  return sendSuccess(res, { data: wishList, message: 'Product added to wishlist successfully' });
});

// Remove product from wishlist
const removeFromWishlist = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const wishList = await user.removeFromWishlist(req.body.productId);
  return sendSuccess(res, { data: wishList, message: 'Product removed from wishlist successfully' });
});

// Add product to favorites
const addFavoriteProduct = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const favoriteProducts = await user.addFavoriteProduct(req.body.productId);
  return sendSuccess(res, { data: favoriteProducts, message: 'Product added to favorites successfully' });
});

// Remove product from favorites
const removeFavoriteProduct = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const favoriteProducts = await user.removeFavoriteProduct(req.body.productId);
  return sendSuccess(res, { data: favoriteProducts, message: 'Product removed from favorites successfully' });
});

// Add item to shopping cart
const addToCart = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const { productId, quantity = 1 } = req.body;
  const shoppingCart = await user.addToCart(productId, quantity);
  return sendSuccess(res, { data: shoppingCart, message: 'Item added to cart successfully' });
});

// Remove item from shopping cart
const removeFromCart = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const shoppingCart = await user.removeFromCart(req.body.productId);
  return sendSuccess(res, { data: shoppingCart, message: 'Item removed from cart successfully' });
});

// Clear shopping cart
const clearCart = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const shoppingCart = await user.clearCart();
  return sendSuccess(res, { data: shoppingCart, message: 'Cart cleared successfully' });
});

// Update user preferences
const updatePreferences = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const preferences = await user.updatePreferences(req.body);
  return sendSuccess(res, { data: preferences, message: 'Preferences updated successfully' });
});

// Add loyalty points
const addLoyaltyPoints = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const points = await user.addLoyaltyPoints(req.body.points);
  return sendSuccess(res, { data: points, message: 'Loyalty points added successfully' });
});

// Redeem loyalty points
const redeemLoyaltyPoints = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const points = await user.redeemLoyaltyPoints(req.body.points);
  return sendSuccess(res, { data: points, message: 'Loyalty points redeemed successfully' });
});

// Verify user
const verifyUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const isVerified = await user.verifyUser();
  return sendSuccess(res, { data: { isVerified }, message: 'User verified successfully' });
});

// Update last login
const updateLastLogin = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const lastLogin = await user.updateLastLogin();
  return sendSuccess(res, { data: { lastLogin }, message: 'Last login updated successfully' });
});

// Find user by email
const findByEmail = catchAsync(async (req, res) => {
  const user = await User.findByEmail(req.params.email);
  if (!user) throw AppError.notFound('User not found');
  return sendSuccess(res, { data: user, message: 'User retrieved successfully' });
});

// Find user by username
const findByUsername = catchAsync(async (req, res) => {
  const user = await User.findByUsername(req.params.username);
  if (!user) throw AppError.notFound('User not found');
  return sendSuccess(res, { data: user, message: 'User retrieved successfully' });
});

// Get all admins
const getAdmins = catchAsync(async (req, res) => {
  const admins = await User.getAdmins();
  return sendSuccess(res, { data: { results: admins, total: admins.length }, message: 'Admins retrieved successfully' });
});

// Get all customers
const getCustomers = catchAsync(async (req, res) => {
  const customers = await User.getCustomers();
  return sendSuccess(res, { data: { results: customers, total: customers.length }, message: 'Customers retrieved successfully' });
});

// Search users by keyword
const searchUsers = catchAsync(async (req, res) => {
  const keyword = req.query.q || '';
  const users = await User.searchUsers(keyword);
  return sendSuccess(res, { data: { results: users, total: users.length }, message: 'Users search completed' });
});

// Bulk update user role
const bulkUpdateRole = catchAsync(async (req, res) => {
  const { ids, role } = req.body;
  await User.bulkUpdateRole(ids, role);
  return sendSuccess(res, { message: 'User roles updated successfully' });
});

// Bulk delete users
const bulkDeleteUsers = catchAsync(async (req, res) => {
  const { ids } = req.body;
  await User.bulkDelete(ids);
  return sendSuccess(res, { message: 'Users deleted successfully' });
});

// Get user full name
const getFullName = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  return sendSuccess(res, { data: { fullName: user.fullName }, message: 'Full name retrieved successfully' });
});

// Authenticate user
const authenticateUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const isAuthenticated = await user.authenticate(req.body.password);
  return sendSuccess(res, { data: { isAuthenticated }, message: isAuthenticated ? 'Authentication successful' : 'Authentication failed' });
});

// Update user status
const updateStatus = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const status = await user.updateStatus(req.body.status);
  return sendSuccess(res, { data: status, message: 'User status updated successfully' });
});

// Add payment method
const addPaymentMethod = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const paymentMethods = await user.addPaymentMethod(req.body);
  return sendSuccess(res, { data: paymentMethods, message: 'Payment method added successfully' });
});

// Remove payment method
const removePaymentMethod = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const paymentMethods = await user.removePaymentMethod(req.body.methodId);
  return sendSuccess(res, { data: paymentMethods, message: 'Payment method removed successfully' });
});

// Set default payment method
const setDefaultPaymentMethod = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const paymentMethods = await user.setDefaultPaymentMethod(req.body.methodId);
  return sendSuccess(res, { data: paymentMethods, message: 'Default payment method set successfully' });
});

// Update social media links
const updateSocialMedia = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const socialMedia = await user.updateSocialMedia(req.body);
  return sendSuccess(res, { data: socialMedia, message: 'Social media links updated successfully' });
});

// Add interest
const addInterest = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const interests = await user.addInterest(req.body.interest);
  return sendSuccess(res, { data: interests, message: 'Interest added successfully' });
});

// Remove interest
const removeInterest = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const interests = await user.removeInterest(req.body.interest);
  return sendSuccess(res, { data: interests, message: 'Interest removed successfully' });
});

// Get single user statistics
const getUserStatistics = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const stats = await user.getUserStatistics();
  return sendSuccess(res, { data: stats, message: 'User statistics retrieved successfully' });
});

// Get single user report
const getUserReport = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const report = await user.getUserReport();
  return sendSuccess(res, { data: report, message: 'User report retrieved successfully' });
});

// Dynamic update
const dynamicUpdate = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  const result = await user.dynamicUpdate(req.body.field, req.body.value);
  return sendSuccess(res, { data: result, message: `Field ${req.body.field} updated successfully` });
});

// Bulk update status
const bulkUpdateStatus = catchAsync(async (req, res) => {
  const { ids, status } = req.body;
  await User.bulkUpdateStatus(ids, status);
  return sendSuccess(res, { message: 'User statuses updated successfully' });
});

// Get users by status
const getUsersByStatus = catchAsync(async (req, res) => {
  const users = await User.getUsersByStatus(req.params.status);
  return sendSuccess(res, { data: { results: users, total: users.length }, message: `Users with status ${req.params.status} retrieved successfully` });
});

// Get active users
const getActiveUsers = catchAsync(async (req, res) => {
  const users = await User.getActiveUsers();
  return sendSuccess(res, { data: { results: users, total: users.length }, message: 'Active users retrieved successfully' });
});

// Get verified users
const getVerifiedUsers = catchAsync(async (req, res) => {
  const users = await User.getVerifiedUsers();
  return sendSuccess(res, { data: { results: users, total: users.length }, message: 'Verified users retrieved successfully' });
});

// Dynamic search
const dynamicSearch = catchAsync(async (req, res) => {
  const { field, value } = req.query;
  const users = await User.dynamicSearch(field, value);
  return sendSuccess(res, { data: { results: users, total: users.length }, message: `Users matching ${field} retrieved successfully` });
});

// Bulk add loyalty points
const bulkAddLoyaltyPoints = catchAsync(async (req, res) => {
  const { ids, points } = req.body;
  await User.bulkAddLoyaltyPoints(ids, points);
  return sendSuccess(res, { message: 'Loyalty points added to users successfully' });
});

// Get users by subscription type
const getUsersBySubscriptionType = catchAsync(async (req, res) => {
  const users = await User.getUsersBySubscriptionType(req.params.subscriptionType);
  return sendSuccess(res, { data: { results: users, total: users.length }, message: `Users with subscription type ${req.params.subscriptionType} retrieved successfully` });
});

// Get table statistics
const getTableStatistics = catchAsync(async (req, res) => {
  const stats = await User.getTableStatistics();
  return sendSuccess(res, { data: stats, message: 'Table statistics retrieved successfully' });
});

// Get table report
const getTableReport = catchAsync(async (req, res) => {
  const report = await User.getTableReport();
  return sendSuccess(res, { data: report, message: 'Table report retrieved successfully' });
});

module.exports = {
  createUser,
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
  setUserPassword,
  validateUserPassword,
  addToWishlist,
  removeFromWishlist,
  addFavoriteProduct,
  removeFavoriteProduct,
  addToCart,
  removeFromCart,
  clearCart,
  updatePreferences,
  addLoyaltyPoints,
  redeemLoyaltyPoints,
  verifyUser,
  updateLastLogin,
  findByEmail,
  findByUsername,
  getAdmins,
  getCustomers,
  searchUsers,
  bulkUpdateRole,
  bulkDeleteUsers,
  getFullName,
  authenticateUser,
  updateStatus,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  updateSocialMedia,
  addInterest,
  removeInterest,
  getUserStatistics,
  getUserReport,
  dynamicUpdate,
  bulkUpdateStatus,
  getUsersByStatus,
  getActiveUsers,
  getVerifiedUsers,
  dynamicSearch,
  bulkAddLoyaltyPoints,
  getUsersBySubscriptionType,
  getTableStatistics,
  getTableReport,
};