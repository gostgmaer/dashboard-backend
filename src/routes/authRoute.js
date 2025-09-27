const express = require('express');
const authRoute = express.Router();
const authController = require('../controller/authenticationController');
const { authMiddleware } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const rateLimit = require('express-rate-limit');
const authAccess = require('../middleware/access');
const NotificationMiddleware = require('../middleware/notificationMiddleware');
const { requireOTPVerification } = require('../middleware/otpMiddleware');

/**
 * 🚀 AUTHENTICATION ROUTES
 *
 * Features:
 * ✅ Standardized responses
 * ✅ Role-based access control
 * ✅ OTP/MFA flows
 * ✅ Session & device management
 * ✅ Password & email workflows
 * ✅ Profile & social account management
 * ✅ Admin analytics & reporting
 */

// Rate limiter for sensitive auth operations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many requests, please try again later', error: 'AUTH_RATE_LIMIT_EXCEEDED' }
});
// Rate limiting for OTP endpoints
const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many OTP requests, please try again later.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================================
// 🔑 PUBLIC ENDPOINTS
// ========================================
authRoute.post('/register', authLimiter, authController.registerUser);
authRoute.post('/login', authLimiter, authController.login);
authRoute.post('/verify-otp', authLimiter, authController.verifyOTPAndLogin);
authRoute.post('/resend-otp', authLimiter, authController.resendOTP);
authRoute.post('/social-auth', authLimiter, authController.socialLogin);
authRoute.post('/forgot-password', authLimiter, authController.forgotPassword);
authRoute.post('/reset-password/:token', authLimiter, authController.resetPassword);
authRoute.post('/verify-user/:id', authMiddleware, authorize('users', 'update'), authController.verifyUser);

// ========================================
// 🔐 AUTHENTICATED ENDPOINTS
// ========================================
authRoute.post('/logout', authMiddleware, authController.logout);
authRoute.get('/permissions', authMiddleware, authController.getUserPermissionsController);
authRoute.post('/logout-all', authMiddleware, authAccess.requireOTP('logout_all'), authController.logoutAll);
authRoute.post('/refresh-token', authController.refreshToken);
authRoute.post('/change-password', authMiddleware, authAccess.requireOTP('change_password'), authController.changePassword);

// ========================================
// 📧 EMAIL VERIFICATION
// ========================================
authRoute.post('/send-email-verification', authMiddleware, authController.sendEmailVerification);
authRoute.post('/verify-email/:token', authLimiter, authController.verifyEmail);
authRoute.post('/confirm-email', authLimiter, authController.confirmEmail);

// ========================================
// 🔐 MFA / TOTP
// ========================================
authRoute.post('/totp/setup', authMiddleware, authAccess.requireEmailVerification(), authController.setupTOTP);
authRoute.post('/totp/verify-setup', authMiddleware, authController.verifyTOTPSetup);
authRoute.post('/totp/disable', authMiddleware, authAccess.requireOTP('disable_2fa'), authController.disableTOTP);
authRoute.post('/totp/backup-codes', authMiddleware, authAccess.requireOTP('generate_backup_codes'), authController.generateBackupCodes);
authRoute.post('/mfa/enable', authMiddleware, authController.enableMFA);
authRoute.post('/mfa/confirm', authMiddleware, authController.confirmMFA);
// authRoute.post('/mfa/verify', authMiddleware, authController.verifyMFA);

authRoute.get('/mfa/status', authMiddleware, authController.getOTPStatus);
authRoute.post('/mfa/toggle', authMiddleware, authController.toggleOTP);
authRoute.post('/mfa/setup', authMiddleware, authController.setupOTP);
authRoute.post('/mfa/setup/verify', authMiddleware, otpRateLimit, authController.verifySetup);
authRoute.post('/mfa/send', authMiddleware, otpRateLimit, authController.sendOTP);
authRoute.post('/mfa/resend', authMiddleware, authController.sendOTP);
authRoute.post('/mfa/verify', authMiddleware, authController.verifyOTP);
authRoute.post('/mfa/verify-login-otp', authMiddleware, authController.verifyOTPAndLogin);
authRoute.post('/mfa/disable', authMiddleware, requireOTPVerification('sensitive_op'), authController.disableOTP);


// ========================================
// 📱 DEVICE & SESSION MANAGEMENT
// ========================================
authRoute.get('/profile-data', authMiddleware, authController.findFullyPopulatedById);
authRoute.get('/account-settng', authMiddleware, authController.getUserSetting);
authRoute.get('/profile', authMiddleware, authController.getProfile);
authRoute.get('/devices', authMiddleware, authController.getDevices);
authRoute.post('/devices/trust', authMiddleware, authAccess.requireOTP('trust_device'), authController.trustDevice);
authRoute.delete('/devices/remove', authMiddleware, authAccess.requireOTP('remove_device'), authController.removeDevice);
authRoute.get('/sessions', authMiddleware, authController.getActiveSessions);
authRoute.post('/sessions/revoke', authMiddleware, authController.revokeSession);
authRoute.post('/sessions/invalidate-all', authMiddleware, authorize('sessions', 'delete'), authController.invalidateAllSessions);
authRoute.post('/sessions/revoke-token', authMiddleware, authController.revokeToken);

// ========================================
// 🔍 SECURITY & MONITORING
// ========================================
authRoute.get('/security/events', authMiddleware, authController.getSecurityEvents);
authRoute.get('/security/login-history', authMiddleware, authController.getLoginHistory);
authRoute.get('/security/summary', authMiddleware, authController.getSecuritySummary);

// ========================================
// ⚙️ OTP SETTINGS
// ========================================
authRoute.get('/otp/settings', authMiddleware, authController.getOTPSettings);
authRoute.put('/otp/settings', authMiddleware, authAccess.requireOTP('update_otp_settings'), authController.updateOTPSettings);

// ========================================
// 👤 PROFILE & SOCIAL ACCOUNTS
// ========================================
authRoute.patch('/profile', authMiddleware, authController.updateProfile);
authRoute.patch('/profile-picture', authMiddleware, authController.updateProfilePicture);
authRoute.patch('/email', authMiddleware, authorize('users', 'update'), authController.updateEmail);
authRoute.patch('/phone', authMiddleware, authorize('users', 'update'), authController.updatePhoneNumber);
authRoute.post('/social/link', authMiddleware, authorize('users', 'update'), authController.linkSocialAccount);
authRoute.post('/social/unlink', authMiddleware, authorize('users', 'update'), authController.unlinkSocialAccount);
authRoute.delete('/social/clear/:id', authMiddleware, authorize('users', 'update'), authController.clearAllSocialLinks);

// ========================================
// 📊 ADMIN ANALYTICS & REPORTS
// ========================================
authRoute.get('/admin/otp/analytics', authMiddleware, authorize('users', 'manage'), authController.getOTPAnalytics);
authRoute.get('/admin/security/report', authMiddleware, authorize('users', 'manage'), authController.getSecurityReport);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================
authRoute.get('/docs/routes', authMiddleware, authorize('auth', 'view'), (req, res) => {
  const routes = {
    public: [
      'POST   /auth/register',
      'POST   /auth/login',
      'POST   /auth/verify-otp',
      'POST   /auth/resend-otp',
      'POST   /auth/forgot-password',
      'POST   /auth/reset-password/:token',
      'POST   /auth/verify-user/:id'
    ],
    authenticated: [
      'POST   /auth/logout',
      'GET   /auth/permissions',
      'POST   /auth/logout-all',
      'POST   /auth/refresh-token',
      'POST   /auth/change-password'
    ],
    emailVerification: [
      'POST   /auth/send-email-verification',
      'POST   /auth/verify-email',
      'POST   /auth/confirm-email'
    ],
    mfa: [
      'POST   /auth/totp/setup',
      'POST   /auth/totp/verify-setup',
      'POST   /auth/totp/disable',
      'POST   /auth/totp/backup-codes',
      'POST   /auth/mfa/enable',
      'POST   /auth/mfa/confirm',
      'POST   /auth/mfa/verify',
      'get   /auth/mfa/status',
      'POST   /auth/mfa/toggle'
    ],
    sessions: [
      'GET    /auth/devices',
      'POST   /auth/devices/trust',
      'DELETE /auth/devices/remove',
      'GET    /auth/sessions',
      'POST   /auth/sessions/revoke',
      'POST   /auth/sessions/invalidate-all',
      'POST   /auth/sessions/revoke-token'
    ],
    security: [
      'GET    /auth/security/events',
      'GET    /auth/security/login-history',
      'GET    /auth/security/summary'
    ],
    otpSettings: [
      'GET    /auth/otp/settings',
      'PUT    /auth/otp/settings'
    ],
    profile: [
      'PUT    /auth/profile/:id',
      'PUT    /auth/profile-picture/:id',
      'PUT    /auth/email/:id',
      'PUT    /auth/phone/:id'
    ],
    social: [
      'POST   /auth/social/link/:id',
      'POST   /auth/social/unlink/:id',
      'DELETE /auth/social/clear/:id'
    ],
    admin: [
      'GET    /auth/admin/otp/analytics',
      'GET    /auth/admin/security/report'
    ]
  };
  res.json({ success: true, data: routes, message: 'Auth API routes documentation' });
});

// ========================================
// 🚫 ERROR HANDLING
// ========================================
authRoute.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found', error: 'ENDPOINT_NOT_FOUND' });
});

authRoute.use((err, req, res, next) => {
  console.error('Auth route error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = authRoute;
