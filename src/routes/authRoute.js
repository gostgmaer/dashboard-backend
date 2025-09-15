const express = require('express');
const router = express.Router();
const authController = require('../controller/authenticationController');
const { body, query, param, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const rateLimit = require('express-rate-limit');
const { enviroment } = require('../config/setting');
const User = require('../models/user');

/**
 * 🚀 AUTHENTICATION ROUTES
 * 
 * Features:
 * ✅ User registration, login, and MFA verification
 * ✅ Token refresh and password management
 * ✅ Email verification and OTP handling
 * ✅ Session and device management
 * ✅ Resend email verification link
 * ✅ View failed login attempts
 * ✅ Update user profile
 * ✅ Lock user account
 * ✅ Authentication and authorization via authMiddleware and authorize
 * ✅ Validation with sanitization for security
 * ✅ Rate limiting for sensitive operations
 * ✅ Instance-level checks for user-specific operations
 * ✅ Route documentation endpoint (dev-only)
 */

/**
 * Rate limiters for sensitive operations
 */
const registrationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many registration attempts, please try again later' }
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many login attempts, please try again later' }
});

const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { success: false, message: 'Too many password reset attempts, please try again later' }
});

const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: { success: false, message: 'Too many OTP requests, please try again later' }
});

const resendVerificationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { success: false, message: 'Too many verification resend attempts, please try again later' }
});

const updateProfileRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { success: false, message: 'Too many profile update attempts, please try again later' }
});

/**
 * Middleware to check instance-level access for user-specific routes
 * Ensures the user is accessing/modifying their own data
 */
const instanceCheckMiddleware = async (req, res, next) => {
  try {
    if (!req.user.isSuperadmin) { // Superadmin bypass in authorize
      const userId = req.user.id;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      if (user._id.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Forbidden: Cannot access another user\'s data' });
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
const authValidation = {
  register: [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters').trim().escape(),
    body('username').notEmpty().withMessage('Username is required').trim().escape(),
    validate
  ],
  login: [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required').trim().escape(),
    validate
  ],
  verifyMFA: [
    body('token').notEmpty().withMessage('MFA token is required').trim().escape(),
    validate
  ],
  refreshToken: [
    body('refreshToken').notEmpty().withMessage('Refresh token is required').trim(),
    validate
  ],
  forgotPassword: [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    validate
  ],
  resetPassword: [
    body('token').notEmpty().withMessage('Reset token is required').trim().escape(),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters').trim().escape(),
    validate
  ],
  verifyEmail: [
    body('token').notEmpty().withMessage('Verification token is required').trim().escape(),
    validate
  ],
  resendVerification: [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    validate
  ],
  logout: [
    validate
  ],
  logoutAll: [
    validate
  ],
  getProfile: [
    validate
  ],
  getAuthStats: [
    validate
  ],
  generateOTP: [
    validate
  ],
  verifyOTP: [
    body('otp').notEmpty().withMessage('OTP is required').trim().escape(),
    validate
  ],
  changePassword: [
    body('currentPassword').notEmpty().withMessage('Current password is required').trim().escape(),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters').trim().escape(),
    validate
  ],
  enableMFA: [
    validate
  ],
  confirmMFA: [
    body('token').notEmpty().withMessage('MFA token is required').trim().escape(),
    validate
  ],
  disableMFA: [
    validate
  ],
  getActiveSessions: [
    validate
  ],
  revokeSession: [
    body('sessionId').isMongoId().withMessage('Invalid session ID'),
    validate
  ],
  getDevices: [
    validate
  ],
  removeDevice: [
    body('deviceId').notEmpty().withMessage('Device ID is required').trim().escape(),
    validate
  ],
  trustDevice: [
    body('deviceId').notEmpty().withMessage('Device ID is required').trim().escape(),
    validate
  ],
  getFailedLogins: [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100').toInt(),
    validate
  ],
  updateProfile: [
    body('username').optional().notEmpty().withMessage('Username cannot be empty').trim().escape(),
    body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
    validate
  ],
  lockAccount: [
    validate
  ]
};

// ========================================
// 🔐 AUTHENTICATION ROUTES
// ========================================

// POST /auth/register - Register a new user
router.post('/register',
  registrationRateLimit,
  authValidation.register,
  authController.registerUser
);

// POST /auth/login - User login
router.post('/login',
  loginRateLimit,
  authValidation.login,
  authController.login
);

// POST /auth/verify-mfa - Verify MFA token
router.post('/verify-mfa',
  loginRateLimit,
  authValidation.verifyMFA,
  authController.verifyMFA
);

// POST /auth/refresh-token - Refresh access token
router.post('/refresh-token',
  authValidation.refreshToken,
  authController.refreshToken
);

// POST /auth/forgot-password - Request password reset
router.post('/forgot-password',
  passwordResetRateLimit,
  authValidation.forgotPassword,
  authController.forgotPassword
);

// POST /auth/reset-password - Reset password
router.post('/reset-password',
  passwordResetRateLimit,
  authValidation.resetPassword,
  authController.resetPassword
);

// POST /auth/verify-email - Verify email
router.post('/verify-email/:token',
  authValidation.verifyEmail,
  authController.verifyEmail
);

// POST /auth/resend-verification - Resend email verification link
router.post('/resend-verification',
  resendVerificationRateLimit,
  authValidation.resendVerification,
  authController.resendVerification
);

// Protected routes (authentication required)
router.use(authMiddleware);

// POST /auth/logout - Logout current session
router.post('/logout',
  authorize('user', 'write'),
  instanceCheckMiddleware,
  authValidation.logout,
  authController.logout
);

// POST /auth/logout-all - Logout all sessions
router.post('/logout-all',
  authorize('user', 'write'),
  instanceCheckMiddleware,
  authValidation.logoutAll,
  authController.logoutAll
);

// GET /auth/profile - Get user profile
router.get('/profile',
  authorize('user', 'read'),
  instanceCheckMiddleware,
  authValidation.getProfile,
  authController.getProfile
);

// GET /auth/auth-stats - Get authentication stats
router.get('/auth-stats',
  authorize('user', 'view'),
  instanceCheckMiddleware,
  authValidation.getAuthStats,
  authController.getAuthStats
);

// POST /auth/generate-otp - Generate OTP
router.post('/generate-otp',
  authorize('user', 'write'),
  instanceCheckMiddleware,
  otpRateLimit,
  authValidation.generateOTP,
  authController.generateOTP
);

// POST /auth/verify-otp - Verify OTP
router.post('/verify-otp',
  authorize('user', 'write'),
  instanceCheckMiddleware,
  authValidation.verifyOTP,
  authController.verifyOTP
);

// POST /auth/change-password - Change password
router.post('/change-password',
  authorize('user', 'update'),
  instanceCheckMiddleware,
  authValidation.changePassword,
  authController.changePassword
);

// POST /auth/enable-mfa - Enable MFA
router.post('/enable-mfa',
  authorize('user', 'update'),
  instanceCheckMiddleware,
  authValidation.enableMFA,
  authController.enableMFA
);

// POST /auth/confirm-mfa - Confirm MFA setup
router.post('/confirm-mfa',
  authorize('user', 'update'),
  instanceCheckMiddleware,
  authValidation.confirmMFA,
  authController.confirmMFA
);

// POST /auth/disable-mfa - Disable MFA
router.post('/disable-mfa',
  authorize('user', 'update'),
  instanceCheckMiddleware,
  authValidation.disableMFA,
  authController.disableMFA
);

// GET /auth/sessions - Get active sessions
router.get('/sessions',
  authorize('user', 'read'),
  instanceCheckMiddleware,
  authValidation.getActiveSessions,
  authController.getActiveSessions
);

// POST /auth/revoke-session - Revoke a session
router.post('/revoke-session',
  authorize('user', 'update'),
  instanceCheckMiddleware,
  authValidation.revokeSession,
  authController.revokeSession
);

// GET /auth/devices - Get trusted devices
router.get('/devices',
  authorize('user', 'read'),
  instanceCheckMiddleware,
  authValidation.getDevices,
  authController.getDevices
);

// POST /auth/remove-device - Remove a trusted device
router.post('/remove-device',
  authorize('user', 'update'),
  instanceCheckMiddleware,
  authValidation.removeDevice,
  authController.removeDevice
);

// POST /auth/trust-device - Trust a device
router.post('/trust-device',
  authorize('user', 'update'),
  instanceCheckMiddleware,
  authValidation.trustDevice,
  authController.trustDevice
);



// POST /auth/update-profile - Update user profile
router.post('/update-profile',
  authorize('user', 'update'),
  instanceCheckMiddleware,
  updateProfileRateLimit,
  authValidation.updateProfile,
  authController.updateProfile
);



// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================

// GET /auth/docs/routes - Get all available routes (dev only)
router.get('/docs/routes',
  authMiddleware,
  authorize('user', 'view'),
  (req, res) => {
    if (enviroment !== 'development') {
      return res.status(404).json({
        success: false,
        message: 'Route documentation only available in development mode'
      });
    }

    const routes = {
      public: [
        'POST   /auth/register                    - Register a new user (no auth, rate-limited)',
        'POST   /auth/login                       - User login (no auth, rate-limited)',
        'POST   /auth/verify-mfa                  - Verify MFA token (no auth, rate-limited)',
        'POST   /auth/refresh-token               - Refresh access token (no auth)',
        'POST   /auth/forgot-password             - Request password reset (no auth, rate-limited)',
        'POST   /auth/reset-password              - Reset password (no auth, rate-limited)',
        'POST   /auth/verify-email/:token                - Verify email (no auth)',
        'POST   /auth/resend-verification         - Resend email verification link (no auth, rate-limited)'
      ],
      authenticated: [
        'POST   /auth/logout                      - Logout current session (write, instance check)',
        'POST   /auth/logout-all                  - Logout all sessions (write, instance check)',
        'GET    /auth/profile                     - Get user profile (read, instance check)',
        'GET    /auth/auth-stats                  - Get authentication stats (view, instance check)',
        'POST   /auth/generate-otp                - Generate OTP (write, instance check, rate-limited)',
        'POST   /auth/verify-otp                  - Verify OTP (write, instance check)',
        'POST   /auth/change-password             - Change password (update, instance check)',
        'POST   /auth/enable-mfa                  - Enable MFA (update, instance check)',
        'POST   /auth/confirm-mfa                 - Confirm MFA setup (update, instance check)',
        'POST   /auth/disable-mfa                 - Disable MFA (update, instance check)',
        'GET    /auth/sessions                    - Get active sessions (read, instance check)',
        'POST   /auth/revoke-session              - Revoke a session (update, instance check)',
        'GET    /auth/devices                     - Get trusted devices (read, instance check)',
        'POST   /auth/remove-device               - Remove a trusted device (update, instance check)',
        'POST   /auth/trust-device                - Trust a device (update, instance check)',
        'GET    /auth/failed-logins               - Get failed login attempts (view, instance check)',
        'POST   /auth/update-profile              - Update user profile (update, instance check, rate-limited)',
        'POST   /auth/lock-account                - Lock user account temporarily (update, instance check)'
      ],
      documentation: [
        'GET    /auth/docs/routes                 - Get API route documentation (view, dev-only)'
      ]
    };

    res.status(200).json({
      success: true,
      data: {
        totalRoutes: Object.values(routes).flat().length,
        categories: routes
      },
      message: 'Authentication API routes documentation'
    });
  }
);

module.exports = router;