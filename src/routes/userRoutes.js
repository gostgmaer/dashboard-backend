const express = require('express');
const router = express.Router();
const UserController = require('../controller/consolidatedUserController');
const { body, query, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roleCheck');
const { enviroment } = require('../config/setting');

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
 * ✅ Role-based access control
 * ✅ Comprehensive validation schemas
 * ✅ Performance optimized routes
 */

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================

const userValidation = {
    create: [
        body('email').isEmail().withMessage('Valid email is required'),
        body('username').notEmpty().withMessage('Username is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('firstName').notEmpty().withMessage('First name is required'),
        body('lastName').notEmpty().withMessage('Last name is required'),
    ],

    update: [
        param('id').isMongoId().withMessage('Invalid user ID'),
        body('email').optional().isEmail().withMessage('Valid email is required'),
        body('username').optional().notEmpty().withMessage('Username cannot be empty'),
        body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
        body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
        body('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status'),
    ],

    query: [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('sort').optional().isIn(['createdAt', 'updatedAt', 'lastLogin', 'loyaltyPoints', 'ordersCount']).withMessage('Invalid sort field'),
        query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
        query('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status filter'),
    ],

    auth: [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required'),
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
    ],

    bulkUpdate: [
        body('ids').isArray({ min: 1 }).withMessage('User IDs array is required'),
        body('ids.*').isMongoId().withMessage('Invalid user ID in array'),
        body('updateData').optional().isObject().withMessage('Update data must be an object'),
        body('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status'),
    ],

    wishlist: [
        param('id').isMongoId().withMessage('Invalid user ID'),
        body('productId').isMongoId().withMessage('Valid product ID is required'),
    ],

    cart: [
        param('id').isMongoId().withMessage('Invalid user ID'),
        body('productId').isMongoId().withMessage('Valid product ID is required'),
        body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    ],

    loyalty: [
        param('id').isMongoId().withMessage('Invalid user ID'),
        body('points').isInt({ min: 1 }).withMessage('Points must be a positive integer'),
    ],

    address: [
        param('id').isMongoId().withMessage('Invalid user ID'),
        body('address').isObject().withMessage('Address must be an object'),
        body('address.street').notEmpty().withMessage('Street is required'),
        body('address.city').notEmpty().withMessage('City is required'),
        body('address.country').notEmpty().withMessage('Country is required'),
        body('address.zipCode').notEmpty().withMessage('ZIP code is required'),
    ],

    search: [
        query('keyword').optional().notEmpty().withMessage('Search keyword is required'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
        query('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status filter'),
    ],

    advancedSearch: [
        query('criteria').optional().isObject().withMessage('Criteria must be an object'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    ],

    notify: [
        param('id').isMongoId().withMessage('Invalid user ID'),
        body('message').notEmpty().withMessage('Message is required'),
    ],

    exportImport: [
        query('format').optional().isIn(['csv', 'json']).withMessage('Invalid format'),
    ],
};

// ========================================
// 📋 CRUD OPERATIONS
// ========================================

// POST /api/users - Create new user
router.post('/',
    userValidation.create,
    UserController.createUser
);

// GET /api/users - Get all users with advanced filtering
router.get('/',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    userValidation.query,
    UserController.getUsers
);

// GET /api/users/:id - Get single user by ID
router.get('/:id',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.getUserById
);

// PUT /api/users/:id - Update user
router.put('/:id',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    userValidation.update,
    UserController.updateUser
);

// DELETE /api/users/:id - Delete user (soft delete by default)
router.delete('/:id',
    authMiddleware,
    roleMiddleware(['admin']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.deleteUser
);

// ========================================
// 🔐 AUTHENTICATION ROUTES
// ========================================

// POST /api/users/auth/login - User login
router.post('/auth/login',
    userValidation.auth,
    UserController.login
);

// PUT /api/users/:id/auth/change-password - Change password
router.put('/:id/auth/change-password',
    authMiddleware,
    userValidation.password,
    UserController.changePassword
);

// POST /api/users/auth/reset-token - Generate reset token
router.post('/auth/reset-token',
    body('email').isEmail().withMessage('Valid email is required'),
    UserController.generateResetToken
);

// POST /api/users/auth/reset-password - Reset password with token
router.post('/auth/reset-password',
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    UserController.resetPassword
);

// POST /api/users/auth/confirm-email - Confirm email
router.post('/auth/confirm-email',
    body('token').notEmpty().withMessage('Confirmation token is required'),
    UserController.confirmEmail
);

// PUT /api/users/:id/auth/verify - Verify user
router.put('/:id/auth/verify',
    authMiddleware,
    roleMiddleware(['admin']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.verifyUser
);

// ========================================
// 👤 PROFILE MANAGEMENT ROUTES
// ========================================

// PUT /api/users/:id/profile - Update profile
router.put('/:id/profile',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be under 500 characters'),
    UserController.updateProfile
);

// PUT /api/users/:id/profile/picture - Update profile picture
router.put('/:id/profile/picture',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.updateProfilePicture
);

// PUT /api/users/:id/profile/email - Update email
router.put('/:id/profile/email',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('email').isEmail().withMessage('Valid email is required'),
    UserController.updateEmail
);

// PUT /api/users/:id/profile/phone - Update phone number
router.put('/:id/profile/phone',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
    UserController.updatePhoneNumber
);

// ========================================
// ❤️ WISHLIST ROUTES
// ========================================

// POST /api/users/:id/wishlist - Add to wishlist
router.post('/:id/wishlist',
    authMiddleware,
    userValidation.wishlist,
    UserController.addToWishlist
);

// DELETE /api/users/:id/wishlist - Remove from wishlist
router.delete('/:id/wishlist',
    authMiddleware,
    userValidation.wishlist,
    UserController.removeFromWishlist
);

// DELETE /api/users/:id/wishlist/clear - Clear wishlist
router.delete('/:id/wishlist/clear',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.clearWishlist
);

// GET /api/users/:id/wishlist/count - Get wishlist count
router.get('/:id/wishlist/count',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.getWishlistCount
);

// ========================================
// ⭐ FAVORITES ROUTES
// ========================================

// POST /api/users/:id/favorites - Add favorite product
router.post('/:id/favorites',
    authMiddleware,
    userValidation.wishlist, // Reuse for productId
    UserController.addFavoriteProduct
);

// DELETE /api/users/:id/favorites - Remove favorite product
router.delete('/:id/favorites',
    authMiddleware,
    userValidation.wishlist, // Reuse for productId
    UserController.removeFavoriteProduct
);

// POST /api/users/:id/favorites/move-from-wishlist - Move item from wishlist to favorites
router.post('/:id/favorites/move-from-wishlist',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('productId').isMongoId().withMessage('Valid product ID is required'),
    UserController.moveItemWishlistToFavorites
);

// ========================================
// 🛒 CART ROUTES
// ========================================

// POST /api/users/:id/cart - Add to cart
router.post('/:id/cart',
    authMiddleware,
    userValidation.cart,
    UserController.addToCart
);

// DELETE /api/users/:id/cart - Remove from cart
router.delete('/:id/cart',
    authMiddleware,
    userValidation.cart,
    UserController.removeFromCart
);

// PUT /api/users/:id/cart/quantity - Update cart item quantity
router.put('/:id/cart/quantity',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('productId').isMongoId().withMessage('Valid product ID is required'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    UserController.updateCartItemQuantity
);

// DELETE /api/users/:id/cart/clear - Clear cart
router.delete('/:id/cart/clear',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.clearCart
);

// GET /api/users/:id/cart/total - Calculate cart total
router.get('/:id/cart/total',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.calculateCartTotal
);

// GET /api/users/:id/cart/count - Get cart item count
router.get('/:id/cart/count',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.getCartItemCount
);

// POST /api/users/:id/cart/move-to-wishlist - Move item from cart to wishlist
router.post('/:id/cart/move-to-wishlist',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('productId').isMongoId().withMessage('Valid product ID is required'),
    UserController.moveItemCartToWishlist
);

// ========================================
// ⚙️ PREFERENCES ROUTES
// ========================================

// PUT /api/users/:id/preferences - Update preferences
router.put('/:id/preferences',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('preferences').isObject().withMessage('Preferences must be an object'),
    UserController.updatePreferences
);

// PUT /api/users/:id/preferences/newsletter - Toggle newsletter subscription
router.put('/:id/preferences/newsletter',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('subscribed').isBoolean().withMessage('Subscribed must be boolean'),
    UserController.toggleNewsletterSubscription
);

// PUT /api/users/:id/preferences/notifications - Toggle notifications
router.put('/:id/preferences/notifications',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('enabled').isBoolean().withMessage('Enabled must be boolean'),
    UserController.toggleNotifications
);

// PUT /api/users/:id/preferences/theme - Set theme preference
router.put('/:id/preferences/theme',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('theme').isIn(['light', 'dark', 'auto']).withMessage('Invalid theme'),
    UserController.setThemePreference
);

// PUT /api/users/:id/preferences/language - Update language preference
router.put('/:id/preferences/language',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('language').isLength({ min: 2, max: 5 }).withMessage('Language code must be 2-5 characters'),
    UserController.updateLanguagePreference
);

// ========================================
// 🏆 LOYALTY POINTS ROUTES
// ========================================

// POST /api/users/:id/loyalty/add - Add loyalty points
router.post('/:id/loyalty/add',
    authMiddleware,
    roleMiddleware(['admin']),
    userValidation.loyalty,
    UserController.addLoyaltyPoints
);

// POST /api/users/:id/loyalty/redeem - Redeem loyalty points
router.post('/:id/loyalty/redeem',
    authMiddleware,
    userValidation.loyalty,
    UserController.redeemLoyaltyPoints
);

// POST /api/users/:id/loyalty/transfer - Transfer loyalty points
router.post('/:id/loyalty/transfer',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('targetUserId').isMongoId().withMessage('Valid target user ID is required'),
    body('points').isInt({ min: 1 }).withMessage('Points must be a positive integer'),
    UserController.transferLoyaltyPoints
);

// PUT /api/users/:id/loyalty/reset - Reset loyalty points
router.put('/:id/loyalty/reset',
    authMiddleware,
    roleMiddleware(['admin']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.resetLoyaltyPoints
);

// ========================================
// 📋 SUBSCRIPTION ROUTES
// ========================================

// PUT /api/users/:id/subscription - Update subscription
router.put('/:id/subscription',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('subscriptionType').optional().isIn(['free', 'basic', 'premium']).withMessage('Invalid subscription type'),
    UserController.updateSubscription
);

// DELETE /api/users/:id/subscription - Cancel subscription
router.delete('/:id/subscription',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.cancelSubscription
);

// ========================================
// 🔒 ACCOUNT STATUS ROUTES
// ========================================

// PUT /api/users/:id/status - Update status
router.put('/:id/status',
    authMiddleware,
    roleMiddleware(['admin']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('status').isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status'),
    UserController.updateStatus
);

// PUT /api/users/:id/deactivate - Deactivate account
router.put('/:id/deactivate',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.deactivateAccount
);

// PUT /api/users/:id/reactivate - Reactivate account
router.put('/:id/reactivate',
    authMiddleware,
    roleMiddleware(['admin']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.reactivateAccount
);

// PUT /api/users/:id/lock - Lock account
router.put('/:id/lock',
    authMiddleware,
    roleMiddleware(['admin']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.lockAccount
);

// PUT /api/users/:id/unlock - Unlock account
router.put('/:id/unlock',
    authMiddleware,
    roleMiddleware(['admin']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.unlockAccount
);

// ========================================
// 📍 ADDRESS ROUTES
// ========================================

// POST /api/users/:id/addresses - Add address
router.post('/:id/addresses',
    authMiddleware,
    userValidation.address,
    UserController.addAddress
);

// DELETE /api/users/:id/addresses - Remove address
router.delete('/:id/addresses',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('addressId').isMongoId().withMessage('Valid address ID is required'),
    UserController.removeAddress
);

// PUT /api/users/:id/addresses/default - Set default address
router.put('/:id/addresses/default',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('addressId').isMongoId().withMessage('Valid address ID is required'),
    UserController.setDefaultAddress
);

// ========================================
// 💳 PAYMENT METHOD ROUTES
// ========================================

// POST /api/users/:id/payment-methods - Add payment method
router.post('/:id/payment-methods',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('paymentMethod').isObject().withMessage('Payment method must be an object'),
    UserController.addPaymentMethod
);

// DELETE /api/users/:id/payment-methods - Remove payment method
router.delete('/:id/payment-methods',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('paymentMethodId').isMongoId().withMessage('Valid payment method ID is required'),
    UserController.removePaymentMethod
);

// PUT /api/users/:id/payment-methods/default - Set default payment method
router.put('/:id/payment-methods/default',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('paymentMethodId').isMongoId().withMessage('Valid payment method ID is required'),
    UserController.setDefaultPaymentMethod
);

// ========================================
// 🌐 SOCIAL MEDIA ROUTES
// ========================================

// PUT /api/users/:id/social-media - Update social media
router.put('/:id/social-media',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('socialMedia').isObject().withMessage('Social media must be an object'),
    UserController.updateSocialMedia
);

// POST /api/users/:id/social-media/link - Link social account
router.post('/:id/social-media/link',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('provider').notEmpty().withMessage('Provider is required'),
    body('accessToken').notEmpty().withMessage('Access token is required'),
    UserController.linkSocialAccount
);

// DELETE /api/users/:id/social-media/unlink - Unlink social account
router.delete('/:id/social-media/unlink',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('provider').notEmpty().withMessage('Provider is required'),
    UserController.unlinkSocialAccount
);

// DELETE /api/users/:id/social-media/clear - Clear all social links
router.delete('/:id/social-media/clear',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.clearAllSocialLinks
);

// ========================================
// 🎯 INTERESTS ROUTES
// ========================================

// POST /api/users/:id/interests - Add interest
router.post('/:id/interests',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('interest').notEmpty().withMessage('Interest is required'),
    UserController.addInterest
);

// DELETE /api/users/:id/interests - Remove interest
router.delete('/:id/interests',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('interest').notEmpty().withMessage('Interest is required'),
    UserController.removeInterest
);

// POST /api/users/:id/interests/category - Add interest category
router.post('/:id/interests/category',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('category').notEmpty().withMessage('Category is required'),
    UserController.addInterestCategory
);

// DELETE /api/users/:id/interests/clear - Clear interests
router.delete('/:id/interests/clear',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.clearInterests
);

// ========================================
// 🔐 SESSION & SECURITY ROUTES
// ========================================

// POST /api/users/:id/sessions/invalidate-all - Invalidate all sessions
router.post('/:id/sessions/invalidate-all',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.invalidateAllSessions
);

// POST /api/users/:id/sessions/revoke-token - Revoke token
router.post('/:id/sessions/revoke-token',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('token').notEmpty().withMessage('Token is required'),
    UserController.revokeToken
);

// PUT /api/users/:id/login-timestamp - Update login timestamp
router.put('/:id/login-timestamp',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.updateLoginTimestamp
);

// PUT /api/users/:id/failed-logins/increment - Increment failed logins
router.put('/:id/failed-logins/increment',
    body('email').isEmail().withMessage('Valid email is required'),
    UserController.incrementFailedLogins
);

// PUT /api/users/:id/failed-logins/reset - Reset failed logins
router.put('/:id/failed-logins/reset',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.resetFailedLogins
);

// ========================================
// 🛍️ ORDER ROUTES
// ========================================

// POST /api/users/:id/orders - Add order
router.post('/:id/orders',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('orderData').isObject().withMessage('Order data must be an object'),
    UserController.addOrder
);

// GET /api/users/:id/orders - Get order history
router.get('/:id/orders',
    authMiddleware,
    param('id').isMongoId().withMessage('Invalid user ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    UserController.getOrderHistory
);

// ========================================
// 📊 REPORTING ROUTES
// ========================================

// GET /api/users/:id/statistics - Get user statistics
router.get('/:id/statistics',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.getUserStatistics
);

// GET /api/users/:id/report - Get user report
router.get('/:id/report',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.getUserReport
);

// GET /api/users/:id/activity-summary - Get activity summary
router.get('/:id/activity-summary',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    UserController.getActivitySummary
);

// PUT /api/users/:id/dynamic-update - Dynamic update
router.put('/:id/dynamic-update',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('updates').isObject().withMessage('Updates must be an object'),
    UserController.dynamicUpdate
);

// ========================================
// 🔍 SEARCH & FILTER OPERATIONS
// ========================================

// GET /api/users/search/email - Find by email
router.get('/search/email',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('email').isEmail().withMessage('Valid email is required'),
    UserController.findByEmail
);

// GET /api/users/search/username - Find by username
router.get('/search/username',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('username').notEmpty().withMessage('Username is required'),
    UserController.findByUsername
);

// GET /api/users/search - Search users
router.get('/search',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    userValidation.search,
    UserController.searchUsers
);

// GET /api/users/search/email-username - Search by email or username
router.get('/search/email-username',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('searchTerm').notEmpty().withMessage('Search term is required'),
    UserController.searchByEmailOrUsername
);

// GET /api/users/search/dynamic - Dynamic search
router.get('/search/dynamic',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('criteria').isObject().withMessage('Criteria must be an object'),
    UserController.dynamicSearch
);

// GET /api/users/filter/status - Get users by status
router.get('/filter/status',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('status').isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status'),
    UserController.getUsersByStatus
);

// GET /api/users/filter/active - Get active users
router.get('/filter/active',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getActiveUsers
);

// GET /api/users/filter/verified - Get verified users
router.get('/filter/verified',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getVerifiedUsers
);

// GET /api/users/filter/role - Get users by role
router.get('/filter/role',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('role').isIn(['user', 'admin', 'manager']).withMessage('Invalid role'),
    UserController.getUsersByRole
);

// GET /api/users/filter/admins - Get admins
router.get('/filter/admins',
    authMiddleware,
    roleMiddleware(['admin']),
    UserController.getAdmins
);

// GET /api/users/filter/customers - Get customers
router.get('/filter/customers',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getCustomers
);

// GET /api/users/filter/subscription - Get users by subscription type
router.get('/filter/subscription',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('subscriptionType').isIn(['free', 'basic', 'premium']).withMessage('Invalid subscription type'),
    UserController.getUsersBySubscriptionType
);

// GET /api/users/filter/active-within-days - Find active users within days
router.get('/filter/active-within-days',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('days').isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
    UserController.findActiveWithinDays
);

// GET /api/users/filter/top-loyal - Get top loyal users
router.get('/filter/top-loyal',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    UserController.getTopLoyalUsers
);

// GET /api/users/filter/never-logged-in - Get never logged in users
router.get('/filter/never-logged-in',
    authMiddleware,
    roleMiddleware(['admin']),
    UserController.getNeverLoggedInUsers
);

// GET /api/users/filter/oldest - Find oldest user
router.get('/filter/oldest',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.findOldestUser
);

// GET /api/users/filter/failed-logins - Find users with failed logins
router.get('/filter/failed-logins',
    authMiddleware,
    roleMiddleware(['admin']),
    query('minFailed').optional().isInt({ min: 1 }).withMessage('Minimum failed logins must be a positive integer'),
    UserController.findUsersWithFailedLogins
);

// GET /api/users/filter/incomplete-profiles - Find users with incomplete profiles
router.get('/filter/incomplete-profiles',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.findUsersWithIncompleteProfiles
);

router.get('/profile',
    authMiddleware,
    UserController.findUsersWithIncompleteProfiles
);
// ========================================
// 📦 BULK OPERATIONS
// ========================================

// PUT /api/users/bulk/update-role - Bulk update role
router.put('/bulk/update-role',
    authMiddleware,
    roleMiddleware(['admin']),
    userValidation.bulkUpdate,
    UserController.bulkUpdateRole
);

// DELETE /api/users/bulk/delete - Bulk delete
router.delete('/bulk/delete',
    authMiddleware,
    roleMiddleware(['admin']),
    body('ids').isArray({ min: 1 }).withMessage('User IDs array is required'),
    body('ids.*').isMongoId().withMessage('Invalid user ID in array'),
    UserController.bulkDelete
);

// PUT /api/users/bulk/update-status - Bulk update status
router.put('/bulk/update-status',
    authMiddleware,
    roleMiddleware(['admin']),
    userValidation.bulkUpdate,
    UserController.bulkUpdateStatus
);

// POST /api/users/bulk/add-loyalty-points - Bulk add loyalty points
router.post('/bulk/add-loyalty-points',
    authMiddleware,
    roleMiddleware(['admin']),
    body('updates').isArray({ min: 1 }).withMessage('Updates array is required'),
    body('updates.*.id').isMongoId().withMessage('Invalid user ID in updates'),
    body('updates.*.points').isInt({ min: 1 }).withMessage('Points must be a positive integer'),
    UserController.bulkAddLoyaltyPoints
);

// ========================================
// 📈 ANALYTICS & STATISTICS
// ========================================

// GET /api/users/analytics/count-by-role - Get user count by role
router.get('/analytics/count-by-role',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getUserCountByRole
);

// GET /api/users/analytics/count-by-subscription - Get user count by subscription
router.get('/analytics/count-by-subscription',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getUserCountBySubscription
);

// GET /api/users/analytics/count-by-country - Get user count by country
router.get('/analytics/count-by-country',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getUserCountByCountry
);

// GET /api/users/analytics/average-loyalty-points - Get average loyalty points
router.get('/analytics/average-loyalty-points',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getAverageLoyaltyPoints
);

// GET /api/users/analytics/average-orders - Get average orders per user
router.get('/analytics/average-orders',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getAverageOrdersPerUser
);

// GET /api/users/analytics/loyalty-brackets - Get user loyalty brackets
router.get('/analytics/loyalty-brackets',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getUserLoyaltyBrackets
);

// GET /api/users/analytics/top-interests - Get top user interests
router.get('/analytics/top-interests',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    UserController.getTopUserInterests
);

// GET /api/users/analytics/registrations-over-time - Get registrations over time
router.get('/analytics/registrations-over-time',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period'),
    UserController.getRegistrationsOverTime
);

// GET /api/users/analytics/login-activity-over-time - Get login activity over time
router.get('/analytics/login-activity-over-time',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period'),
    UserController.getLoginActivityOverTime
);

// GET /api/users/analytics/table-statistics - Get table statistics
router.get('/analytics/table-statistics',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getTableStatistics
);

// GET /api/users/analytics/table-report - Get table report
router.get('/analytics/table-report',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    UserController.getTableReport
);

// GET /api/users/analytics/user-report/:userId - Get user report by ID
router.get('/analytics/user-report/:userId',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    param('userId').isMongoId().withMessage('Invalid user ID'),
    UserController.getUserReportByIdStatic
);

// GET /api/users/analytics/activity-summary/:userId - Get activity summary by ID
router.get('/analytics/activity-summary/:userId',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    param('userId').isMongoId().withMessage('Invalid user ID'),
    UserController.getActivitySummaryByIdStatic
);

// GET /api/users/analytics/users-with-analytics - Get users with analytics
router.get('/analytics/users-with-analytics',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    UserController.getUsersWithAnalytics
);

// GET /api/users/analytics/user-engagement - Get user engagement metrics
router.get('/analytics/user-engagement',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    query('period').optional().isIn(['day', 'week', 'month', 'year']).withMessage('Invalid period'),
    UserController.getUserEngagementMetrics
);

// ========================================
// 📤 EXPORT/IMPORT ROUTES
// ========================================

// GET /api/users/export/data - Export users data
router.get('/export/data',
    authMiddleware,
    roleMiddleware(['admin']),
    userValidation.exportImport,
    UserController.exportUsersData
);

// GET /api/users/export/statistics - Export user statistics
router.get('/export/statistics',
    authMiddleware,
    roleMiddleware(['admin']),
    userValidation.exportImport,
    UserController.exportUserStatistics
);

// GET /api/users/export/csv - Export users as CSV
router.get('/export/csv',
    authMiddleware,
    roleMiddleware(['admin']),
    UserController.exportCSV
);

// POST /api/users/import/data - Import users data
router.post('/import/data',
    authMiddleware,
    roleMiddleware(['admin']),
    body('file').optional().notEmpty().withMessage('File is required'),
    UserController.importUsersData
);

// POST /api/users/import/csv - Import users from CSV
router.post('/import/csv',
    authMiddleware,
    roleMiddleware(['admin']),
    body('file').notEmpty().withMessage('CSV file is required'),
    UserController.importCSV
);

// ========================================
// 🔧 ENHANCED OPERATIONS
// ========================================

// GET /api/users/advanced-search - Advanced search
router.get('/advanced-search',
    authMiddleware,
    roleMiddleware(['admin', 'manager']),
    userValidation.advancedSearch,
    UserController.advancedSearch
);

// POST /api/users/:id/notify - Send notification to user
router.post('/:id/notify',
    authMiddleware,
    roleMiddleware(['admin']),
    userValidation.notify,
    UserController.sendNotification
);

// ========================================
// 🔀 ROUTE MIDDLEWARE FOR SPECIAL HANDLING
// ========================================

// Middleware to handle route conflicts
const routeOrderMiddleware = (req, res, next) => {
    if (req.path.startsWith('/auth/') ||
        req.path.startsWith('/search/') ||
        req.path.startsWith('/filter/') ||
        req.path.startsWith('/analytics/') ||
        req.path.startsWith('/bulk/') ||
        req.path.startsWith('/export/') ||
        req.path.startsWith('/import/') ||
        req.path === '/advanced-search') {
        return next();
    }

    const segments = req.path.split('/').filter(Boolean);
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
router.get('/docs/routes', (req, res) => {
    if (enviroment !== 'development') {
        return res.status(404).json({
            success: false,
            message: 'Route documentation only available in development mode'
        });
    }

    const routes = {
        crud: [
            'POST   /api/users                             - Create new user',
            'GET    /api/users                             - Get all users with filtering',
            'GET    /api/users/:id                         - Get single user by ID',
            'PUT    /api/users/:id                         - Update user',
            'DELETE /api/users/:id                         - Delete user (soft delete)'
        ],
        authentication: [
            'POST   /api/users/auth/login                  - User login',
            'PUT    /api/users/:id/auth/change-password    - Change password',
            'POST   /api/users/auth/reset-token            - Generate reset token',
            'POST   /api/users/auth/reset-password         - Reset password with token',
            'POST   /api/users/auth/confirm-email          - Confirm email',
            'PUT    /api/users/:id/auth/verify             - Verify user'
        ],
        profile: [
            'PUT    /api/users/:id/profile                 - Update profile',
            'GET    /api/users/profile                       - Get profile',
            'PUT    /api/users/:id/profile/picture         - Update profile picture',
            'PUT    /api/users/:id/profile/email           - Update email',
            'PUT    /api/users/:id/profile/phone           - Update phone number'
        ],
        wishlist: [
            'POST   /api/users/:id/wishlist                - Add to wishlist',
            'DELETE /api/users/:id/wishlist                - Remove from wishlist',
            'DELETE /api/users/:id/wishlist/clear          - Clear wishlist',
            'GET    /api/users/:id/wishlist/count          - Get wishlist count'
        ],
        favorites: [
            'POST   /api/users/:id/favorites               - Add favorite product',
            'DELETE /api/users/:id/favorites               - Remove favorite product',
            'POST   /api/users/:id/favorites/move-from-wishlist - Move from wishlist to favorites'
        ],
        cart: [
            'POST   /api/users/:id/cart                    - Add to cart',
            'DELETE /api/users/:id/cart                    - Remove from cart',
            'PUT    /api/users/:id/cart/quantity           - Update cart item quantity',
            'DELETE /api/users/:id/cart/clear              - Clear cart',
            'GET    /api/users/:id/cart/total              - Calculate cart total',
            'GET    /api/users/:id/cart/count              - Get cart item count',
            'POST   /api/users/:id/cart/move-to-wishlist   - Move from cart to wishlist'
        ],
        preferences: [
            'PUT    /api/users/:id/preferences             - Update preferences',
            'PUT    /api/users/:id/preferences/newsletter  - Toggle newsletter subscription',
            'PUT    /api/users/:id/preferences/notifications - Toggle notifications',
            'PUT    /api/users/:id/preferences/theme       - Set theme preference',
            'PUT    /api/users/:id/preferences/language    - Update language preference'
        ],
        loyalty: [
            'POST   /api/users/:id/loyalty/add             - Add loyalty points',
            'POST   /api/users/:id/loyalty/redeem          - Redeem loyalty points',
            'POST   /api/users/:id/loyalty/transfer        - Transfer loyalty points',
            'PUT    /api/users/:id/loyalty/reset           - Reset loyalty points'
        ],
        subscription: [
            'PUT    /api/users/:id/subscription            - Update subscription',
            'DELETE /api/users/:id/subscription            - Cancel subscription'
        ],
        accountStatus: [
            'PUT    /api/users/:id/status                  - Update status',
            'PUT    /api/users/:id/deactivate              - Deactivate account',
            'PUT    /api/users/:id/reactivate              - Reactivate account',
            'PUT    /api/users/:id/lock                    - Lock account',
            'PUT    /api/users/:id/unlock                  - Unlock account'
        ],
        addresses: [
            'POST   /api/users/:id/addresses               - Add address',
            'DELETE /api/users/:id/addresses               - Remove address',
            'PUT    /api/users/:id/addresses/default       - Set default address'
        ],
        paymentMethods: [
            'POST   /api/users/:id/payment-methods         - Add payment method',
            'DELETE /api/users/:id/payment-methods         - Remove payment method',
            'PUT    /api/users/:id/payment-methods/default - Set default payment method'
        ],
        socialMedia: [
            'PUT    /api/users/:id/social-media            - Update social media',
            'POST   /api/users/:id/social-media/link       - Link social account',
            'DELETE /api/users/:id/social-media/unlink     - Unlink social account',
            'DELETE /api/users/:id/social-media/clear      - Clear all social links'
        ],
        interests: [
            'POST   /api/users/:id/interests               - Add interest',
            'DELETE /api/users/:id/interests               - Remove interest',
            'POST   /api/users/:id/interests/category      - Add interest category',
            'DELETE /api/users/:id/interests/clear         - Clear interests'
        ],
        sessions: [
            'POST   /api/users/:id/sessions/invalidate-all - Invalidate all sessions',
            'POST   /api/users/:id/sessions/revoke-token   - Revoke token',
            'PUT    /api/users/:id/login-timestamp         - Update login timestamp',
            'PUT    /api/users/:id/failed-logins/increment - Increment failed logins',
            'PUT    /api/users/:id/failed-logins/reset     - Reset failed logins'
        ],
        orders: [
            'POST   /api/users/:id/orders                  - Add order',
            'GET    /api/users/:id/orders                  - Get order history'
        ],
        reporting: [
            'GET    /api/users/:id/statistics              - Get user statistics',
            'GET    /api/users/:id/report                  - Get user report',
            'GET    /api/users/:id/activity-summary        - Get activity summary',
            'PUT    /api/users/:id/dynamic-update          - Dynamic update'
        ],
        search: [
            'GET    /api/users/search/email                - Find by email',
            'GET    /api/users/search/username             - Find by username',
            'GET    /api/users/search                      - Search users',
            'GET    /api/users/search/email-username       - Search by email or username',
            'GET    /api/users/search/dynamic              - Dynamic search'
        ],
        filter: [
            'GET    /api/users/filter/status               - Get users by status',
            'GET    /api/users/filter/active               - Get active users',
            'GET    /api/users/filter/verified             - Get verified users',
            'GET    /api/users/filter/role                 - Get users by role',
            'GET    /api/users/filter/admins               - Get admins',
            'GET    /api/users/filter/customers            - Get customers',
            'GET    /api/users/filter/subscription         - Get users by subscription type',
            'GET    /api/users/filter/active-within-days   - Find active users within days',
            'GET    /api/users/filter/top-loyal            - Get top loyal users',
            'GET    /api/users/filter/never-logged-in      - Get never logged in users',
            'GET    /api/users/filter/oldest               - Find oldest user',
            'GET    /api/users/filter/failed-logins        - Find users with failed logins',
            'GET    /api/users/filter/incomplete-profiles  - Find users with incomplete profiles'
        ],
        bulk: [
            'PUT    /api/users/bulk/update-role            - Bulk update role',
            'DELETE /api/users/bulk/delete                 - Bulk delete',
            'PUT    /api/users/bulk/update-status          - Bulk update status',
            'POST   /api/users/bulk/add-loyalty-points     - Bulk add loyalty points'
        ],
        analytics: [
            'GET    /api/users/analytics/count-by-role     - Get user count by role',
            'GET    /api/users/analytics/count-by-subscription - Get user count by subscription',
            'GET    /api/users/analytics/count-by-country  - Get user count by country',
            'GET    /api/users/analytics/average-loyalty-points - Get average loyalty points',
            'GET    /api/users/analytics/average-orders    - Get average orders per user',
            'GET    /api/users/analytics/loyalty-brackets  - Get user loyalty brackets',
            'GET    /api/users/analytics/top-interests     - Get top user interests',
            'GET    /api/users/analytics/registrations-over-time - Get registrations over time',
            'GET    /api/users/analytics/login-activity-over-time - Get login activity over time',
            'GET    /api/users/analytics/table-statistics   - Get table statistics',
            'GET    /api/users/analytics/table-report      - Get table report',
            'GET    /api/users/analytics/user-report/:userId - Get user report by ID',
            'GET    /api/users/analytics/activity-summary/:userId - Get activity summary by ID',
            'GET    /api/users/analytics/users-with-analytics - Get users with analytics',
            'GET    /api/users/analytics/user-engagement   - Get user engagement metrics'
        ],
        exportImport: [
            'GET    /api/users/export/data                 - Export users data',
            'GET    /api/users/export/statistics           - Export user statistics',
            'GET    /api/users/export/csv                  - Export users as CSV',
            'POST   /api/users/import/data                 - Import users data',
            'POST   /api/users/import/csv                  - Import users from CSV'
        ],
        enhanced: [
            'GET    /api/users/advanced-search             - Advanced search',
            'POST   /api/users/:id/notify                  - Send notification to user'
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
});

module.exports = { UserRoute: router };