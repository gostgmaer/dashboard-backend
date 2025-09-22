const express = require('express');
const router = express.Router();
const UserController = require('../controller/consolidatedUserController');
const { body, query, param, validationResult } = require('express-validator');
const {authMiddleware} = require('../middleware/auth');
const authorize = require('../middleware/authorize'); // Assuming authorize is exported from auth middleware
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');
const User = require('../models/user');
/**
 * 🚀 CONSOLIDATED USER ROUTES
 * 
 * Features:
 * ✅ All CRUD operations with validation
 * ✅ Authentication and profile management
 * ✅ Wishlist, favorites, and cart operations
 * ✅ Preferences, loyalty, and subscription handling
 * ✅ Account status and security features
 * ✅ Addresses, payments, and social integrations
 * ✅ Interests and session management
 * ✅ Orders, reporting, and search/filtering
 * ✅ Bulk operations and analytics
 * ✅ Export/import functionality (including CSV)
 * ✅ Enhanced analytics and notification endpoints
 * ✅ Permission-based access control via authorize middleware
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes with rate limiting
 * ✅ Instance-level checks for IDOR prevention
 */

/**
 * Rate limiter for high-risk bulk and import operations
 * Limits to 10 requests per 15 minutes per IP
 */
const bulkOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many requests, please try again later' }
});

/**
 * Middleware to check instance-level access for user-specific routes
 * Ensures the user has permission to access/modify the specific user
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    const userId = req.params.id || req.params.userId;
    if (userId && !req.user.role.name=="super_admin") { // Superadmin bypass already in authorize
      if (req.user.id !== userId) { // Restrict to own user data unless authorized
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot Access/Update another user\'s data' });
      }
      const user = await User.findById(userId);
      if (!user && req.method !== 'POST') { // Allow POST for creation
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error during instance check' });
  }
};

/**
 * Middleware to handle validation errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const userValidation = {
  create: [
    body('email').isEmail().withMessage('Valid email is required').trim().normalizeEmail(),
    body('username').notEmpty().withMessage('Username is required').trim().escape(),
    body('firstName').notEmpty().withMessage('First name is required').trim().escape(),
    body('lastName').notEmpty().withMessage('Last name is required').trim().escape(),
    validate
  ],

  update: [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('email').optional().isEmail().withMessage('Valid email is required').trim().normalizeEmail(),
    body('username').optional().notEmpty().withMessage('Username cannot be empty').trim().escape(),
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty').trim().escape(),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty').trim().escape(),
    body('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status'),
    validate
  ],

  query: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('sort').optional().isIn(['createdAt', 'updatedAt', 'lastLogin', 'loyaltyPoints', 'ordersCount']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    query('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status filter'),
    validate
  ],

  auth: [
    body('email').isEmail().withMessage('Valid email is required').trim().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],

  password: [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
    validate
  ],

  bulkUpdate: [
    body('ids').isArray({ min: 1 }).withMessage('User IDs array is required'),
    body('ids.*').isMongoId().withMessage('Invalid user ID in array'),
    body('updateData').optional().isObject().withMessage('Update data must be an object'),
    body('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status'),
    validate
  ],

  wishlist: [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('productId').isMongoId().withMessage('Valid product ID is required'),
    validate
  ],

  cart: [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('productId').isMongoId().withMessage('Valid product ID is required'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer').toInt(),
    validate
  ],

  loyalty: [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('points').isInt({ min: 1 }).withMessage('Points must be a positive integer').toInt(),
    validate
  ],

  address: [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('address').isObject().withMessage('Address must be an object'),
    body('address.street').notEmpty().withMessage('Street is required').trim().escape(),
    body('address.city').notEmpty().withMessage('City is required').trim().escape(),
    body('address.country').notEmpty().withMessage('Country is required').trim().escape(),
    body('address.zipCode').notEmpty().withMessage('ZIP code is required').trim().escape(),
    validate
  ],

  search: [
    query('keyword').optional().notEmpty().withMessage('Search keyword is required').trim().escape(),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    query('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status filter'),
    validate
  ],

  advancedSearch: [
    query('criteria').optional().isObject().withMessage('Criteria must be an object'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    validate
  ],

  notify: [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('message').notEmpty().withMessage('Message is required').trim().escape(),
    validate
  ],

  exportImport: [
    query('format').optional().isIn(['csv', 'json']).withMessage('Invalid format'),
    validate
  ]
};




// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// POST /api/users - Create new user
router.post('/',
  authMiddleware,
  authorize('users', 'write'),
  userValidation.create,
  UserController.createUser
);

// POST /api/users/register - Register new user
router.post('/register',
  authMiddleware,
  authorize('users', 'write'),
  userValidation.create,
  UserController.registerUser
);

router.patch(
  '/:userId/role',
  authMiddleware,
  authorize('users', 'write'),         // Ensure the user has admin privileges
  UserController.assignUserRoleById
);

// GET /api/users - Get all users with advanced filtering
router.get('/',
  authMiddleware,
  // authorize('users', 'read'),
  userValidation.query,
  UserController.getUsers
);

// GET /api/users/profile - Get profile
router.get('/profile',
  authMiddleware,
  UserController.getMyProfileStatisticsController
);
// GET /api/users/:id - Get single user by ID
router.get('/:identifier',
  authMiddleware,
  authorize('users', 'read'),
  instanceCheckMiddleware,
  param('identifier').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.getUserByIdentifier
);

// PUT /api/users/:id - Update user
router.put('/:id',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  userValidation.update,
  UserController.updateUser
);


// PATCH /api/users/:id - Update user
router.patch('/:id',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  userValidation.update,
  UserController.updateUser
);

// DELETE /api/users/:id - Delete user (soft delete by default)
router.delete('/:id',
  authMiddleware,
  authorize('users', 'delete'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.deleteUser
);

// ========================================
// 🔐 AUTHENTICATION ROUTES
// ========================================

// POST /api/users/authentication/login - User login
router.post('/authentication/login',
  userValidation.auth,
  UserController.login
);

// PUT /api/users/:id/authentication/change-password - Change password
router.put('/:id/authentication/change-password',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  userValidation.password,
  UserController.changePassword
);

// POST /api/users/authentication/reset-token - Generate reset token
// router.post('/authentication/reset-token',
//   authorize('users', 'write'),
//   body('email').isEmail().withMessage('Valid email is required').trim().normalizeEmail(),
//   validate,
//   UserController.generateResetToken
// );

// POST /api/users/authentication/reset-password - Reset password with token
router.post('/authentication/reset-password',
  authorize('users', 'update'),
  body('token').notEmpty().withMessage('Reset token is required').trim().escape(),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  validate,
  UserController.resetPassword
);

// POST /api/users/authentication/confirm-email - Confirm email
router.post('/authentication/confirm-email',
  authorize('users', 'update'),
  body('token').notEmpty().withMessage('Confirmation token is required').trim().escape(),
  validate,
  UserController.confirmEmail
);

// PUT /api/users/:id/authentication/verify - Verify user
router.put('/:id/authentication/verify',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.verifyUser
);

// ========================================
// 👤 PROFILE MANAGEMENT ROUTES
// ========================================

// PUT /api/users/:id/profile - Update profile
router.put('/:id/profile',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty').trim().escape(),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty').trim().escape(),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be under 500 characters').trim().escape(),
  validate,
  UserController.updateProfile
);



// PUT /api/users/:id/profile/picture - Update profile picture
router.put('/:id/profile/picture',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.updateProfilePicture
);

// PUT /api/users/:id/profile/email - Update email
router.put('/:id/profile/email',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('email').isEmail().withMessage('Valid email is required').trim().normalizeEmail(),
  validate,
  UserController.updateEmail
);

// PUT /api/users/:id/profile/phone - Update phone number
router.put('/:id/profile/phone',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  validate,
  UserController.updatePhoneNumber
);

// ========================================
// ❤️ WISHLIST ROUTES
// ========================================

// POST /api/users/:id/wishlist - Add to wishlist
router.post('/:id/wishlist',
  authMiddleware,
  authorize('users', 'write'),
  instanceCheckMiddleware,
  userValidation.wishlist,
  UserController.addToWishlist
);

// DELETE /api/users/:id/wishlist - Remove from wishlist
router.delete('/:id/wishlist',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  userValidation.wishlist,
  UserController.removeFromWishlist
);

// DELETE /api/users/:id/wishlist/clear - Clear wishlist
router.delete('/:id/wishlist/clear',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.clearWishlist
);

// GET /api/users/:id/wishlist/count - Get wishlist count
router.get('/:id/wishlist/count',
  authMiddleware,
  authorize('users', 'read'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.getWishlistCount
);

// ========================================
// ⭐ FAVORITES ROUTES
// ========================================

// POST /api/users/:id/favorites - Add favorite product
router.post('/:id/favorites',
  authMiddleware,
  authorize('users', 'write'),
  instanceCheckMiddleware,
  userValidation.wishlist, // Reuse for productId
  UserController.addFavoriteProduct
);

// DELETE /api/users/:id/favorites - Remove favorite product
router.delete('/:id/favorites',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  userValidation.wishlist, // Reuse for productId
  UserController.removeFavoriteProduct
);

// POST /api/users/:id/favorites/move-from-wishlist - Move item from wishlist to favorites
router.post('/:id/favorites/move-from-wishlist',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  validate,
  UserController.moveItemWishlistToFavorites
);

// ========================================
// 🛒 CART ROUTES
// ========================================

// POST /api/users/:id/cart - Add to cart
router.post('/:id/cart',
  authMiddleware,
  authorize('users', 'write'),
  instanceCheckMiddleware,
  userValidation.cart,
  UserController.addToCart
);

// DELETE /api/users/:id/cart - Remove from cart
router.delete('/:id/cart',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  userValidation.cart,
  UserController.removeFromCart
);

// PUT /api/users/:id/cart/quantity - Update cart item quantity
router.put('/:id/cart/quantity',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer').toInt(),
  validate,
  UserController.updateCartItemQuantity
);

// DELETE /api/users/:id/cart/clear - Clear cart
router.delete('/:id/cart/clear',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.clearCart
);

// GET /api/users/:id/cart/total - Calculate cart total
router.get('/:id/cart/total',
  authMiddleware,
  authorize('users', 'read'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.calculateCartTotal
);

// GET /api/users/:id/cart/count - Get cart item count
router.get('/:id/cart/count',
  authMiddleware,
  authorize('users', 'read'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.getCartItemCount
);

// POST /api/users/:id/cart/move-to-wishlist - Move item from cart to wishlist
router.post('/:id/cart/move-to-wishlist',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  validate,
  UserController.moveItemCartToWishlist
);

// ========================================
// ⚙️ PREFERENCES ROUTES
// ========================================

// PUT /api/users/:id/preferences - Update preferences
router.put('/:id/preferences',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('preferences').isObject().withMessage('Preferences must be an object'),
  validate,
  UserController.updatePreferences
);

// PUT /api/users/:id/preferences/newsletter - Toggle newsletter subscription
router.put('/:id/preferences/newsletter',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('subscribed').isBoolean().withMessage('Subscribed must be boolean'),
  validate,
  UserController.toggleNewsletterSubscription
);

// PUT /api/users/:id/preferences/notifications - Toggle notifications
router.put('/:id/preferences/notifications',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('enabled').isBoolean().withMessage('Enabled must be boolean'),
  validate,
  UserController.toggleNotifications
);

// PUT /api/users/:id/preferences/theme - Set theme preference
router.put('/:id/preferences/theme',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('theme').isIn(['light', 'dark', 'auto']).withMessage('Invalid theme'),
  validate,
  UserController.setThemePreference
);

// PUT /api/users/:id/preferences/language - Update language preference
router.put('/:id/preferences/language',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('language').isLength({ min: 2, max: 5 }).withMessage('Language code must be 2-5 characters').trim().escape(),
  validate,
  UserController.updateLanguagePreference
);

// ========================================
// 🏆 LOYALTY POINTS ROUTES
// ========================================

// POST /api/users/:id/loyalty/add - Add loyalty points
router.post('/:id/loyalty/add',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  userValidation.loyalty,
  UserController.addLoyaltyPoints
);

// POST /api/users/:id/loyalty/redeem - Redeem loyalty points
router.post('/:id/loyalty/redeem',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  userValidation.loyalty,
  UserController.redeemLoyaltyPoints
);

// POST /api/users/:id/loyalty/transfer - Transfer loyalty points
router.post('/:id/loyalty/transfer',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('targetUserId').isMongoId().withMessage('Valid target user ID is required'),
  body('points').isInt({ min: 1 }).withMessage('Points must be a positive integer').toInt(),
  validate,
  UserController.transferLoyaltyPoints
);

// PUT /api/users/:id/loyalty/reset - Reset loyalty points
router.put('/:id/loyalty/reset',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.resetLoyaltyPoints
);

// ========================================
// 📋 SUBSCRIPTION ROUTES
// ========================================

// PUT /api/users/:id/subscription - Update subscription
router.put('/:id/subscription',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('subscriptionType').optional().isIn(['free', 'basic', 'premium']).withMessage('Invalid subscription type'),
  validate,
  UserController.updateSubscription
);

// DELETE /api/users/:id/subscription - Cancel subscription
router.delete('/:id/subscription',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.cancelSubscription
);

// ========================================
// 🔒 ACCOUNT STATUS ROUTES
// ========================================

// PUT /api/users/:id/status - Update status
router.put('/:id/status',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('status').isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status'),
  validate,
  UserController.updateStatus
);

// PUT /api/users/:id/deactivate - Deactivate account
router.put('/:id/deactivate-account',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.deactivateAccount
);



// PUT /api/users/:id/reactivate - Reactivate account
router.put('/:id/reactivate-account',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.reactivateAccount
);

router.patch('/:userId/activate', authMiddleware,
  authorize('users', 'manage'), UserController.activateUser);
router.patch('/:userId/deactivate', authMiddleware,
  authorize('users', 'manage'), UserController.deactivateUser);


// PUT /api/users/:id/lock - Lock account
router.put('/:id/lock',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.lockAccount
);

// PUT /api/users/:id/unlock - Unlock account
router.put('/:id/unlock',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.unlockAccount
);

// ========================================
// 📍 ADDRESS ROUTES
// ========================================

// POST /api/users/:id/addresses - Add address
router.post('/:id/addresses',
  authMiddleware,
  authorize('users', 'write'),
  instanceCheckMiddleware,
  userValidation.address,
  UserController.addAddress
);

// DELETE /api/users/:id/addresses - Remove address
router.delete('/:id/addresses',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('addressId').isMongoId().withMessage('Valid address ID is required'),
  validate,
  UserController.removeAddress
);

// PUT /api/users/:id/addresses/default - Set default address
router.put('/:id/addresses/default',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('addressId').isMongoId().withMessage('Valid address ID is required'),
  validate,
  UserController.setDefaultAddress
);

// ========================================
// 💳 PAYMENT METHOD ROUTES
// ========================================

// POST /api/users/:id/payment-methods - Add payment method
router.post('/:id/payment-methods',
  authMiddleware,
  authorize('users', 'write'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('paymentMethod').isObject().withMessage('Payment method must be an object'),
  validate,
  UserController.addPaymentMethod
);

// DELETE /api/users/:id/payment-methods - Remove payment method
router.delete('/:id/payment-methods',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('paymentMethodId').isMongoId().withMessage('Valid payment method ID is required'),
  validate,
  UserController.removePaymentMethod
);

// PUT /api/users/:id/payment-methods/default - Set default payment method
router.put('/:id/payment-methods/default',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('paymentMethodId').isMongoId().withMessage('Valid payment method ID is required'),
  validate,
  UserController.setDefaultPaymentMethod
);

// ========================================
// 🌐 SOCIAL MEDIA ROUTES
// ========================================

// PUT /api/users/:id/social-media - Update social media
router.put('/:id/social-media',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('socialMedia').isObject().withMessage('Social media must be an object'),
  validate,
  UserController.updateSocialMedia
);

// POST /api/users/:id/social-media/link - Link social account
router.post('/:id/social-media/link',
  authMiddleware,
  authorize('users', 'write'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('provider').notEmpty().withMessage('Provider is required').trim().escape(),
  body('accessToken').notEmpty().withMessage('Access token is required').trim().escape(),
  validate,
  UserController.linkSocialAccount
);

// DELETE /api/users/:id/social-media/unlink - Unlink social account
router.delete('/:id/social-media/unlink',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('provider').notEmpty().withMessage('Provider is required').trim().escape(),
  validate,
  UserController.unlinkSocialAccount
);

// DELETE /api/users/:id/social-media/clear - Clear all social links
router.delete('/:id/social-media/clear',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.clearAllSocialLinks
);

// ========================================
// 🎯 INTERESTS ROUTES
// ========================================

// POST /api/users/:id/interests - Add interest
router.post('/:id/interests',
  authMiddleware,
  authorize('users', 'write'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('interest').notEmpty().withMessage('Interest is required').trim().escape(),
  validate,
  UserController.addInterest
);

// DELETE /api/users/:id/interests - Remove interest
router.delete('/:id/interests',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('interest').notEmpty().withMessage('Interest is required').trim().escape(),
  validate,
  UserController.removeInterest
);

// POST /api/users/:id/interests/category - Add interest category
router.post('/:id/interests/category',
  authMiddleware,
  authorize('users', 'write'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('category').notEmpty().withMessage('Category is required').trim().escape(),
  validate,
  UserController.addInterestCategory
);

// DELETE /api/users/:id/interests/clear - Clear interests
router.delete('/:id/interests/clear',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.clearInterests
);

// ========================================
// 🔐 SESSION & SECURITY ROUTES
// ========================================

// POST /api/users/:id/sessions/invalidate-all - Invalidate all sessions
router.post('/:id/sessions/invalidate-all',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  bulkOperationLimiter,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.invalidateAllSessions
);

// POST /api/users/:id/sessions/revoke-token - Revoke token
router.post('/:id/sessions/revoke-token',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('token').notEmpty().withMessage('Token is required').trim().escape(),
  validate,
  UserController.revokeToken
);

// PUT /api/users/:id/login-timestamp - Update login timestamp
router.put('/:id/login-timestamp',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.updateLoginTimestamp
);

// PUT /api/users/:id/failed-logins/increment - Increment failed logins
router.put('/:id/failed-logins/increment',
  authorize('users', 'update'),
  body('email').isEmail().withMessage('Valid email is required').trim().normalizeEmail(),
  validate,
  UserController.incrementFailedLogins
);

// PUT /api/users/:id/failed-logins/reset - Reset failed logins
router.put('/:id/failed-logins/reset',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.resetFailedLogins
);

// ========================================
// 🛍️ ORDER ROUTES
// ========================================

// POST /api/users/:id/orders - Add order
router.post('/:id/orders',
  authMiddleware,
  authorize('users', 'write'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('orderData').isObject().withMessage('Order data must be an object'),
  validate,
  UserController.addOrder
);

// GET /api/users/:id/orders - Get order history
router.get('/:id/orders',
  authMiddleware,
  authorize('users', 'read'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  validate,
  UserController.getOrderHistory
);

// ========================================
// 📊 REPORTING ROUTES
// ========================================

// GET /api/users/:id/statistics - Get user statistics
router.get('/:id/statistics',
  authMiddleware,
  authorize('users', 'view'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.getUserStatistics
);

// GET /api/users/:id/report - Get user report
router.get('/:id/report',
  authMiddleware,
  authorize('users', 'report'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.getUserReport
);

// GET /api/users/:id/activity-summary - Get activity summary
router.get('/:id/activity-summary',
  authMiddleware,
  authorize('users', 'report'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.getActivitySummary
);

// PUT /api/users/:id/dynamic-update - Dynamic update
router.put('/:id/dynamic-update',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('updates').isObject().withMessage('Updates must be an object'),
  validate,
  UserController.dynamicUpdate
);

// ========================================
// 🔍 SEARCH & FILTER OPERATIONS
// ========================================

// GET /api/users/search/email - Find by email
router.get('/search/email',
  authMiddleware,
  authorize('users', 'read'),
  query('email').isEmail().withMessage('Valid email is required').trim().normalizeEmail(),
  validate,
  UserController.findByEmail
);

// GET /api/users/search/username - Find by username
router.get('/search/username',
  authMiddleware,
  authorize('users', 'read'),
  query('username').notEmpty().withMessage('Username is required').trim().escape(),
  validate,
  UserController.findByUsername
);

// GET /api/users/search - Search users
router.get('/search',
  authMiddleware,
  authorize('users', 'read'),
  userValidation.search,
  UserController.searchUsers
);

// GET /api/users/search/email-username - Search by email or username
router.get('/search/email-username',
  authMiddleware,
  authorize('users', 'read'),
  query('searchTerm').notEmpty().withMessage('Search term is required').trim().escape(),
  validate,
  UserController.searchByEmailOrUsername
);

// GET /api/users/search/dynamic - Dynamic search
router.get('/search/dynamic',
  authMiddleware,
  authorize('users', 'read'),
  query('criteria').isObject().withMessage('Criteria must be an object'),
  validate,
  UserController.dynamicSearch
);

// GET /api/users/filter/status - Get users by status
router.get('/filter/status',
  authMiddleware,
  authorize('users', 'read'),
  query('status').isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status'),
  validate,
  UserController.getUsersByStatus
);

// GET /api/users/filter/active - Get active users
router.get('/filter/active',
  authMiddleware,
  authorize('users', 'read'),
  UserController.getActiveUsers
);

// GET /api/users/filter/verified - Get verified users
router.get('/filter/verified',
  authMiddleware,
  authorize('users', 'read'),
  UserController.getVerifiedUsers
);

// GET /api/users/filter/role - Get users by role
router.get('/filter/role',
  authMiddleware,
  authorize('users', 'read'),
  query('role').isIn(['user', 'admin', 'manager']).withMessage('Invalid role'),
  validate,
  UserController.getUsersByRole
);

// GET /api/users/filter/admins - Get admins
router.get('/filter/admins',
  authMiddleware,
  authorize('users', 'read'),
  UserController.getAdmins
);

// GET /api/users/filter/customers - Get customers
router.get('/filter/customers',
  authMiddleware,
  authorize('users', 'read'),
  UserController.getCustomers
);

// GET /api/users/filter/subscription - Get users by subscription type
router.get('/filter/subscription',
  authMiddleware,
  authorize('users', 'read'),
  query('subscriptionType').isIn(['free', 'basic', 'premium']).withMessage('Invalid subscription type'),
  validate,
  UserController.getUsersBySubscriptionType
);

// GET /api/users/filter/active-within-days - Find active users within days
router.get('/filter/active-within-days',
  authMiddleware,
  authorize('users', 'read'),
  query('days').isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365').toInt(),
  validate,
  UserController.findActiveWithinDays
);

// GET /api/users/filter/top-loyal - Get top loyal users
router.get('/filter/top-loyal',
  authMiddleware,
  authorize('users', 'read'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  validate,
  UserController.getTopLoyalUsers
);

// GET /api/users/filter/never-logged-in - Get never logged in users
router.get('/filter/never-logged-in',
  authMiddleware,
  authorize('users', 'read'),
  UserController.getNeverLoggedInUsers
);

// GET /api/users/filter/oldest - Find oldest user
router.get('/filter/oldest',
  authMiddleware,
  authorize('users', 'read'),
  UserController.findOldestUser
);

// GET /api/users/filter/failed-logins - Find users with failed logins
router.get('/filter/failed-logins',
  authMiddleware,
  authorize('users', 'read'),
  query('minFailed').optional().isInt({ min: 1 }).withMessage('Minimum failed logins must be a positive integer').toInt(),
  validate,
  UserController.findUsersWithFailedLogins
);

// GET /api/users/filter/incomplete-profiles - Find users with incomplete profiles
router.get('/filter/incomplete-profiles',
  authMiddleware,
  authorize('users', 'read'),
  UserController.findUsersWithIncompleteProfiles
);

// ========================================
// 📦 BULK OPERATIONS
// ========================================

// PUT /api/users/bulk/update-role - Bulk update role
router.put('/bulk/update-role',
  authMiddleware,
  authorize('users', 'update'),
  bulkOperationLimiter,
  userValidation.bulkUpdate,
  UserController.bulkUpdateRole
);

// DELETE /api/users/bulk/delete - Bulk delete
router.delete('/bulk/delete',
  authMiddleware,
  authorize('users', 'update'),
  bulkOperationLimiter,
  body('ids').isArray({ min: 1 }).withMessage('User IDs array is required'),
  body('ids.*').isMongoId().withMessage('Invalid user ID in array'),
  validate,
  UserController.bulkDelete
);

// PUT /api/users/bulk/update-status - Bulk update status
router.put('/bulk/update-status',
  authMiddleware,
  authorize('users', 'update'),
  bulkOperationLimiter,
  userValidation.bulkUpdate,
  UserController.bulkUpdateStatus
);

// POST /api/users/bulk/add-loyalty-points - Bulk add loyalty points
router.post('/bulk/add-loyalty-points',
  authMiddleware,
  authorize('users', 'update'),
  bulkOperationLimiter,
  body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
  body('updates.*.id').isMongoId().withMessage('Invalid user ID in updates'),
  body('updates.*.points').isInt({ min: 1 }).withMessage('Points must be a positive integer').toInt(),
  validate,
  UserController.bulkAddLoyaltyPoints
);

// ========================================
// 📈 ANALYTICS & STATISTICS
// ========================================

// GET /api/users/analytics/count-by-role - Get user count by role
router.get('/analytics/count-by-role',
  authMiddleware,
  authorize('users', 'view'),
  UserController.getUserCountByRole
);

// GET /api/users/analytics/count-by-subscription - Get user count by subscription
router.get('/analytics/count-by-subscription',
  authMiddleware,
  authorize('users', 'view'),
  UserController.getUserCountBySubscription
);

// GET /api/users/analytics/count-by-country - Get user count by country
router.get('/analytics/count-by-country',
  authMiddleware,
  authorize('users', 'view'),
  UserController.getUserCountByCountry
);

// GET /api/users/analytics/average-loyalty-points - Get average loyalty points
router.get('/analytics/average-loyalty-points',
  authMiddleware,
  authorize('users', 'view'),
  UserController.getAverageLoyaltyPoints
);

// GET /api/users/analytics/average-orders - Get average orders per user
router.get('/analytics/average-orders',
  authMiddleware,
  authorize('users', 'view'),
  UserController.getAverageOrdersPerUser
);

// GET /api/users/analytics/loyalty-brackets - Get user loyalty brackets
router.get('/analytics/loyalty-brackets',
  authMiddleware,
  authorize('users', 'view'),
  UserController.getUserLoyaltyBrackets
);

// GET /api/users/analytics/top-interests - Get top user interests
router.get('/analytics/top-interests',
  authMiddleware,
  authorize('users', 'view'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50').toInt(),
  validate,
  UserController.getTopUserInterests
);

// GET /api/users/analytics/registrations-over-time - Get registrations over time
router.get('/analytics/registrations-over-time',
  authMiddleware,
  authorize('users', 'report'),
  query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period'),
  validate,
  UserController.getRegistrationsOverTime
);

// GET /api/users/analytics/login-activity-over-time - Get login activity over time
router.get('/analytics/login-activity-over-time',
  authMiddleware,
  authorize('users', 'report'),
  query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period'),
  validate,
  UserController.getLoginActivityOverTime
);

// GET /api/users/analytics/table-statistics - Get table statistics
router.get('/analytics/table-statistics',
  authMiddleware,
  authorize('users', 'report'),
  UserController.getTableStatistics
);

// GET /api/users/analytics/table-report - Get table report
router.get('/analytics/table-report',
  authMiddleware,
  authorize('users', 'report'),
  UserController.getTableReport
);

// GET /api/users/analytics/user-report/:userId - Get user report by ID
router.get('/analytics/user-report/:userId',
  authMiddleware,
  authorize('users', 'report'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.getUserReportByIdStatic
);

// GET /api/users/analytics/activity-summary/:userId - Get activity summary by ID
router.get('/analytics/activity-summary/:userId',
  authMiddleware,
  authorize('users', 'report'),
  instanceCheckMiddleware,
  param('userId').isMongoId().withMessage('Invalid user ID'),
  validate,
  UserController.getActivitySummaryByIdStatic
);

// GET /api/users/analytics/users-with-analytics - Get users with analytics
router.get('/analytics/users-with-analytics',
  authMiddleware,
  authorize('users', 'report'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
  validate,
  UserController.getUsersWithAnalytics
);

// GET /api/users/analytics/user-engagement - Get user engagement metrics
router.get('/analytics/user-engagement',
  authMiddleware,
  authorize('users', 'report'),
  query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period'),
  validate,
  UserController.getUserEngagementMetrics
);

// ========================================
// 📤 EXPORT/IMPORT ROUTES
// ========================================

// GET /api/users/export/data - Export users data
router.get('/export/data',
  authMiddleware,
  authorize('users', 'view'),
  userValidation.exportImport,
  UserController.exportUsersData
);

// GET /api/users/export/statistics - Export user statistics
router.get('/export/statistics',
  authMiddleware,
  authorize('users', 'view'),
  userValidation.exportImport,
  UserController.exportUserStatistics
);

// GET /api/users/export/csv - Export users as CSV
router.get('/export/csv',
  authMiddleware,
  authorize('users', 'view'),
  UserController.exportCSV
);

// POST /api/users/import/data - Import users data
router.post('/import/data',
  authMiddleware,
  authorize('users', 'write'),
  bulkOperationLimiter,
  body('file').optional().notEmpty().withMessage('File is required').trim().escape(),
  validate,
  UserController.importUsersData
);

// POST /api/users/import/csv - Import users from CSV
router.post('/import/csv',
  authMiddleware,
  authorize('users', 'write'),
  bulkOperationLimiter,
  body('file').notEmpty().withMessage('CSV file is required').trim().escape(),
  validate,
  UserController.importCSV
);

// ========================================
// 🔧 ENHANCED OPERATIONS
// ========================================

// GET /api/users/advanced-search - Advanced search
router.get('/advanced-search',
  authMiddleware,
  authorize('users', 'read'),
  userValidation.advancedSearch,
  UserController.advancedSearch
);

// POST /api/users/:id/notify - Send notification to user
router.post('/:id/notify',
  authMiddleware,
  authorize('users', 'update'),
  instanceCheckMiddleware,
  userValidation.notify,
  UserController.sendNotification
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

// Middleware to handle route conflicts
const routeOrderMiddleware = (req, res, next) => {
  const path = req.path.toLowerCase();
  if (path.startsWith('/authentication/') ||
    path.startsWith('/search/') ||
    path.startsWith('/filter/') ||
    path.startsWith('/analytics/') ||
    path.startsWith('/bulk/') ||
    path.startsWith('/export/') ||
    path.startsWith('/import/') ||
    path === '/advanced-search' ||
    path === '/profile') {
    return next();
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length > 1) {
    const specificPatterns = [
      'profile', 'wishlist', 'favorites', 'cart', 'preferences', 'loyalty',
      'subscription', 'status', 'addresses', 'payment-methods', 'social-media',
      'interests', 'sessions', 'orders', 'statistics', 'report', 'activity-summary',
      'dynamic-update', 'notify'
    ];

    if (specificPatterns.includes(segments[1])) {
      return next();
    }
  }

  next();
};

// Apply the middleware to all routes
router.use(routeOrderMiddleware);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

// GET /api/users/docs/routes - Get all available routes (dev only)
router.get('/docs/routes',
  authMiddleware,
  authorize('users', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      crud: [
        'POST   /api/users                             - Create new user (write)',
        ' POST /api/users/register - Register new user Write',
        'GET    /api/users                             - Get all users with filtering (read)',
        'GET    /api/users/:id                         - Get single user by ID (read, instance check)',
        'PUT    /api/users/:id                         - Update user (update, instance check)',
        'PATCH    /api/users/:userId/role                         - Assign Role (update, instance check)',
        'DELETE /api/users/:id                         - Delete user (soft delete) (update, instance check)'
      ],
      authentication: [
        'POST   /api/users/authentication/login                  - User login (no auth)',
        'PUT    /api/users/:id/authentication/change-password    - Change password (update, instance check)',
        'POST   /api/users/authentication/reset-token            - Generate reset token (write)',
        'POST   /api/users/authentication/reset-password         - Reset password with token (update)',
        'POST   /api/users/authentication/confirm-email          - Confirm email (update)',
        'PUT    /api/users/:id/authentication/verify             - Verify user (update, instance check)'
      ],
      profile: [
        'PUT    /api/users/:id/profile                 - Update profile (update, instance check)',
        'GET    /api/users/profile                     - Get profile (read)',
        'PUT    /api/users/:id/profile/picture         - Update profile picture (update, instance check)',
        'PUT    /api/users/:id/profile/email           - Update email (update, instance check)',
        'PUT    /api/users/:id/profile/phone           - Update phone number (update, instance check)'
      ],
      wishlist: [
        'POST   /api/users/:id/wishlist                - Add to wishlist (write, instance check)',
        'DELETE /api/users/:id/wishlist                - Remove from wishlist (update, instance check)',
        'DELETE /api/users/:id/wishlist/clear          - Clear wishlist (update, instance check)',
        'GET    /api/users/:id/wishlist/count          - Get wishlist count (read, instance check)'
      ],
      favorites: [
        'POST   /api/users/:id/favorites               - Add favorite product (write, instance check)',
        'DELETE /api/users/:id/favorites               - Remove favorite product (update, instance check)',
        'POST   /api/users/:id/favorites/move-from-wishlist - Move from wishlist to favorites (update, instance check)'
      ],
      cart: [
        'POST   /api/users/:id/cart                    - Add to cart (write, instance check)',
        'DELETE /api/users/:id/cart                    - Remove from cart (update, instance check)',
        'PUT    /api/users/:id/cart/quantity           - Update cart item quantity (update, instance check)',
        'DELETE /api/users/:id/cart/clear              - Clear cart (update, instance check)',
        'GET    /api/users/:id/cart/total              - Calculate cart total (read, instance check)',
        'GET    /api/users/:id/cart/count              - Get cart item count (read, instance check)',
        'POST   /api/users/:id/cart/move-to-wishlist   - Move from cart to wishlist (update, instance check)'
      ],
      preferences: [
        'PUT    /api/users/:id/preferences             - Update preferences (update, instance check)',
        'PUT    /api/users/:id/preferences/newsletter  - Toggle newsletter subscription (update, instance check)',
        'PUT    /api/users/:id/preferences/notifications - Toggle notifications (update, instance check)',
        'PUT    /api/users/:id/preferences/theme       - Set theme preference (update, instance check)',
        'PUT    /api/users/:id/preferences/language    - Update language preference (update, instance check)'
      ],
      loyalty: [
        'POST   /api/users/:id/loyalty/add             - Add loyalty points (update, instance check)',
        'POST   /api/users/:id/loyalty/redeem          - Redeem loyalty points (update, instance check)',
        'POST   /api/users/:id/loyalty/transfer        - Transfer loyalty points (update, instance check)',
        'PUT    /api/users/:id/loyalty/reset           - Reset loyalty points (update, instance check)'
      ],
      subscription: [
        'PUT    /api/users/:id/subscription            - Update subscription (update, instance check)',
        'DELETE /api/users/:id/subscription            - Cancel subscription (update, instance check)'
      ],
      accountStatus: [
        'PUT    /api/users/:id/status                  - Update status (update, instance check)',
       
        'PUT    /api/users/:id/reactivate              - Reactivate account (update, instance check)',
         'PUT    /api/users/:id/deactivate              - Deactivate account (update, instance check)',
        'PUT    /api/users/:id/activate              - activate account (update, instance check)',
        'PUT    /api/users/:id/lock                    - Lock account (update, instance check)',
        'PUT    /api/users/:id/unlock                  - Unlock account (update, instance check)'
      ],
      addresses: [
        'POST   /api/users/:id/addresses               - Add address (write, instance check)',
        'DELETE /api/users/:id/addresses               - Remove address (update, instance check)',
        'PUT    /api/users/:id/addresses/default       - Set default address (update, instance check)'
      ],
      paymentMethods: [
        'POST   /api/users/:id/payment-methods         - Add payment method (write, instance check)',
        'DELETE /api/users/:id/payment-methods         - Remove payment method (update, instance check)',
        'PUT    /api/users/:id/payment-methods/default - Set default payment method (update, instance check)'
      ],
      socialMedia: [
        'PUT    /api/users/:id/social-media            - Update social media (update, instance check)',
        'POST   /api/users/:id/social-media/link       - Link social account (write, instance check)',
        'DELETE /api/users/:id/social-media/unlink     - Unlink social account (update, instance check)',
        'DELETE /api/users/:id/social-media/clear      - Clear all social links (update, instance check)'
      ],
      interests: [
        'POST   /api/users/:id/interests               - Add interest (write, instance check)',
        'DELETE /api/users/:id/interests               - Remove interest (update, instance check)',
        'POST   /api/users/:id/interests/category      - Add interest category (write, instance check)',
        'DELETE /api/users/:id/interests/clear         - Clear interests (update, instance check)'
      ],
      sessions: [
        'POST   /api/users/:id/sessions/invalidate-all - Invalidate all sessions (update, instance check, rate-limited)',
        'POST   /api/users/:id/sessions/revoke-token   - Revoke token (update, instance check)',
        'PUT    /api/users/:id/login-timestamp         - Update login timestamp (update, instance check)',
        'PUT    /api/users/:id/failed-logins/increment - Increment failed logins (update)',
        'PUT    /api/users/:id/failed-logins/reset     - Reset failed logins (update, instance check)'
      ],
      orders: [
        'POST   /api/users/:id/orders                  - Add order (write, instance check)',
        'GET    /api/users/:id/orders                  - Get order history (read, instance check)'
      ],
      reporting: [
        'GET    /api/users/:id/statistics              - Get user statistics (view, instance check)',
        'GET    /api/users/:id/report                  - Get user report (report, instance check)',
        'GET    /api/users/:id/activity-summary        - Get activity summary (report, instance check)',
        'PUT    /api/users/:id/dynamic-update          - Dynamic update (update, instance check)'
      ],
      search: [
        'GET    /api/users/search/email                - Find by email (read)',
        'GET    /api/users/search/username             - Find by username (read)',
        'GET    /api/users/search                      - Search users (read)',
        'GET    /api/users/search/email-username       - Search by email or username (read)',
        'GET    /api/users/search/dynamic              - Dynamic search (read)'
      ],
      filter: [
        'GET    /api/users/filter/status               - Get users by status (read)',
        'GET    /api/users/filter/active               - Get active users (read)',
        'GET    /api/users/filter/verified             - Get verified users (read)',
        'GET    /api/users/filter/role                 - Get users by role (read)',
        'GET    /api/users/filter/admins               - Get admins (read)',
        'GET    /api/users/filter/customers            - Get customers (read)',
        'GET    /api/users/filter/subscription         - Get users by subscription type (read)',
        'GET    /api/users/filter/active-within-days   - Find active users within days (read)',
        'GET    /api/users/filter/top-loyal            - Get top loyal users (read)',
        'GET    /api/users/filter/never-logged-in      - Get never logged in users (read)',
        'GET    /api/users/filter/oldest               - Find oldest user (read)',
        'GET    /api/users/filter/failed-logins        - Find users with failed logins (read)',
        'GET    /api/users/filter/incomplete-profiles  - Find users with incomplete profiles (read)'
      ],
      bulk: [
        'PUT    /api/users/bulk/update-role            - Bulk update role (update, rate-limited)',
        'DELETE /api/users/bulk/delete                 - Bulk delete (update, rate-limited)',
        'PUT    /api/users/bulk/update-status          - Bulk update status (update, rate-limited)',
        'POST   /api/users/bulk/add-loyalty-points     - Bulk add loyalty points (update, rate-limited)'
      ],
      analytics: [
        'GET    /api/users/analytics/count-by-role     - Get user count by role (view)',
        'GET    /api/users/analytics/count-by-subscription - Get user count by subscription (view)',
        'GET    /api/users/analytics/count-by-country  - Get user count by country (view)',
        'GET    /api/users/analytics/average-loyalty-points - Get average loyalty points (view)',
        'GET    /api/users/analytics/average-orders    - Get average orders per user (view)',
        'GET    /api/users/analytics/loyalty-brackets  - Get user loyalty brackets (view)',
        'GET    /api/users/analytics/top-interests     - Get top user interests (view)',
        'GET    /api/users/analytics/registrations-over-time - Get registrations over time (view)',
        'GET    /api/users/analytics/login-activity-over-time - Get login activity over time (view)',
        'GET    /api/users/analytics/table-statistics   - Get table statistics (view)',
        'GET    /api/users/analytics/table-report      - Get table report (report)',
        'GET    /api/users/analytics/user-report/:userId - Get user report by ID (report, instance check)',
        'GET    /api/users/analytics/activity-summary/:userId - Get activity summary by ID (report, instance check)',
        'GET    /api/users/analytics/users-with-analytics - Get users with analytics (view)',
        'GET    /api/users/analytics/user-engagement   - Get user engagement metrics (view)'
      ],
      exportImport: [
        'GET    /api/users/export/data                 - Export users data (view)',
        'GET    /api/users/export/statistics           - Export user statistics (view)',
        'GET    /api/users/export/csv                  - Export users as CSV (view)',
        'POST   /api/users/import/data                 - Import users data (write, rate-limited)',
        'POST   /api/users/import/csv                  - Import users from CSV (write, rate-limited)'
      ],
      enhanced: [
        'GET    /api/users/advanced-search             - Advanced search (read)',
        'POST   /api/users/:id/notify                  - Send notification to user (update, instance check)'
      ],
      documentation: [
        'GET    /api/users/docs/routes                 - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'User API routes documentation'
    });
  }
);

module.exports = { UserRoute: router };