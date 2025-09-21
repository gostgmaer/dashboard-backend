const express = require('express');
const authRoute = express.Router();
const authController = require('../controller/authenticationController');
const AuthMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const rateLimit = require('express-rate-limit');
const authAccess = require('../middleware/access');
const NotificationMiddleware = require('../middleware/notificationMiddleware');

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
authRoute.post('/verify-user/:id', AuthMiddleware,authorize('users', 'update'), authController.verifyUser);

// ========================================
// 🔐 AUTHENTICATED ENDPOINTS
// ========================================
authRoute.post('/logout', AuthMiddleware, authController.logout);
authRoute.get('/permissions', AuthMiddleware, authController.getUserPermissionsController);
authRoute.post('/logout-all', AuthMiddleware, authAccess.requireOTP('logout_all'), authController.logoutAll);
authRoute.post('/refresh-token', authController.refreshToken);
authRoute.post('/change-password', AuthMiddleware, authAccess.requireOTP('change_password'), authController.changePassword);

// ========================================
// 📧 EMAIL VERIFICATION
// ========================================
authRoute.post('/send-email-verification', AuthMiddleware, authController.sendEmailVerification);
authRoute.post('/verify-email/:token',authLimiter,  authController.verifyEmail);
authRoute.post('/confirm-email', authLimiter, authController.confirmEmail);

// ========================================
// 🔐 MFA / TOTP
// ========================================
authRoute.post('/totp/setup', AuthMiddleware, authAccess.requireEmailVerification(), authController.setupTOTP);
authRoute.post('/totp/verify-setup', AuthMiddleware, authController.verifyTOTPSetup);
authRoute.post('/totp/disable', AuthMiddleware, authAccess.requireOTP('disable_2fa'), authController.disableTOTP);
authRoute.post('/totp/backup-codes', AuthMiddleware, authAccess.requireOTP('generate_backup_codes'), authController.generateBackupCodes);
authRoute.post('/mfa/enable', AuthMiddleware, authController.enableMFA);
authRoute.post('/mfa/confirm', AuthMiddleware, authController.confirmMFA);
authRoute.post('/mfa/verify', AuthMiddleware, authController.verifyMFA);

// ========================================
// 📱 DEVICE & SESSION MANAGEMENT
// ========================================
authRoute.get(' ', AuthMiddleware, authController.findFullyPopulatedById);
authRoute.get('/account-settng', AuthMiddleware, authController.getUserSetting);
authRoute.get('/profile', AuthMiddleware, authController.getProfile);
authRoute.get('/devices', AuthMiddleware, authController.getDevices);
authRoute.post('/devices/trust', AuthMiddleware, authAccess.requireOTP('trust_device'), authController.trustDevice);
authRoute.delete('/devices/remove', AuthMiddleware, authAccess.requireOTP('remove_device'), authController.removeDevice);
authRoute.get('/sessions', AuthMiddleware, authController.getActiveSessions);
authRoute.post('/sessions/revoke', AuthMiddleware, authController.revokeSession);
authRoute.post('/sessions/invalidate-all', AuthMiddleware, authorize('sessions', 'delete'), authController.invalidateAllSessions);
authRoute.post('/sessions/revoke-token', AuthMiddleware, authController.revokeToken);

// ========================================
// 🔍 SECURITY & MONITORING
// ========================================
authRoute.get('/security/events', AuthMiddleware, authController.getSecurityEvents);
authRoute.get('/security/login-history', AuthMiddleware, authController.getLoginHistory);
authRoute.get('/security/summary', AuthMiddleware, authController.getSecuritySummary);

// ========================================
// ⚙️ OTP SETTINGS
// ========================================
authRoute.get('/otp/settings', AuthMiddleware, authController.getOTPSettings);
authRoute.put('/otp/settings', AuthMiddleware, authAccess.requireOTP('update_otp_settings'), authController.updateOTPSettings);

// ========================================
// 👤 PROFILE & SOCIAL ACCOUNTS
// ========================================
authRoute.patch('/profile', AuthMiddleware, authController.updateProfile);
authRoute.patch('/profile-picture', AuthMiddleware, authController.updateProfilePicture);
authRoute.patch('/email', AuthMiddleware, authorize('users', 'update'), authController.updateEmail);
authRoute.patch('/phone', AuthMiddleware, authorize('users', 'update'), authController.updatePhoneNumber);
authRoute.post('/social/link', AuthMiddleware, authorize('users', 'update'), authController.linkSocialAccount);
authRoute.post('/social/unlink', AuthMiddleware, authorize('users', 'update'), authController.unlinkSocialAccount);
authRoute.delete('/social/clear/:id', AuthMiddleware, authorize('users', 'update'), authController.clearAllSocialLinks);

// ========================================
// 📊 ADMIN ANALYTICS & REPORTS
// ========================================
authRoute.get('/admin/otp/analytics', AuthMiddleware, authorize('users', 'manage'), authController.getOTPAnalytics);
authRoute.get('/admin/security/report', AuthMiddleware, authorize('users', 'manage'), authController.getSecurityReport);

// ========================================
// 📝 ROUTE DOCUMENTATION ENDPOINT
// ========================================
authRoute.get('/docs/routes', AuthMiddleware, authorize('auth', 'view'), (req, res) => {
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
      'POST   /auth/mfa/verify'
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
