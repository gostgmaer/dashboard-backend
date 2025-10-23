const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const User = require('../models/user');
const otpService = require('../services/otpService');
const DeviceDetector = require('../services/deviceDetector');

/**
 * 🛡️ ENTERPRISE AUTHENTICATION MIDDLEWARE
 *
 * Features:
 * ✅ JWT token validation
 * ✅ Configurable OTP enforcement
 * ✅ Device-based security
 * ✅ Rate limiting
 * ✅ Suspicious activity detection
 * ✅ Enterprise security policies
 */

class authAccess {
  /**
   * Main authentication middleware
   */
  static async authenticate(req, res, next) {
    try {
      const token = AuthMiddleware.extractToken(req);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token is required',
          error: 'MISSING_TOKEN',
        });
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, {
          algorithms: [process.env.JWT_ALGORITHM || 'HS256'],
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE,
        });
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
          error: 'INVALID_TOKEN',
        });
      }

      // Find user and validate
      const user = await User.findById(decoded.userId).populate('role').populate('knownDevices').populate('authTokens');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
      }

      // Check user status
      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Account is not active',
          error: 'ACCOUNT_INACTIVE',
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        const lockTimeRemaining = Math.ceil((user.loginSecurity.lockedUntil - new Date()) / (1000 * 60));
        return res.status(423).json({
          success: false,
          message: `Account is locked. Try again in ${lockTimeRemaining} minutes`,
          error: 'ACCOUNT_LOCKED',
          lockTimeRemaining,
        });
      }

      // Check if token exists in user's tokens
      const tokenData = user.authTokens.find((t) => t.token === token && !t.isRevoked && t.type === 'access' && t.expiresAt > new Date());

      if (!tokenData) {
        return res.status(401).json({
          success: false,
          message: 'Token has been revoked or expired',
          error: 'TOKEN_REVOKED',
        });
      }

      // Update token last used
      tokenData.lastUsed = new Date();

      // Device and security analysis
      const deviceInfo = DeviceDetector.detectDevice(req);
      req.deviceInfo = deviceInfo;

      // Check device-based security
      const securityCheck = await AuthMiddleware.performSecurityChecks(user, deviceInfo, tokenData);
      if (!securityCheck.allowed) {
        return res.status(401).json({
          success: false,
          message: securityCheck.reason,
          error: securityCheck.error,
          requiresAction: securityCheck.requiresAction,
        });
      }

      // Check if OTP is required for this operation
      const otpRequired = await AuthMiddleware.checkOTPRequirement(req, user, deviceInfo);
      if (otpRequired.required && !otpRequired.satisfied) {
        return res.status(200).json({
          success: false,
          message: 'Additional authentication required',
          error: 'OTP_REQUIRED',
          otpRequired: true,
          availableMethods: user.availableOTPMethods,
          reason: otpRequired.reason,
        });
      }

      // Update user's last activity
      await user.save();

      // Attach user and token info to request
      req.user = user;
      req.token = token;
      req.tokenData = tokenData;
      req.isAuthenticated = true;

      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication failed',
        error: 'AUTH_ERROR',
      });
    }
  }

  /**
   * Optional authentication (for endpoints that work with or without auth)
   */
  static async optionalAuthenticate(req, res, next) {
    try {
      const token = AuthMiddleware.extractToken(req);

      if (!token) {
        req.user = null;
        req.isAuthenticated = false;
        return next();
      }

      // Use the main authenticate logic but don't fail if no token
      await AuthMiddleware.authenticate(req, res, next);
    } catch (error) {
      // If authentication fails, continue without user
      req.user = null;
      req.isAuthenticated = false;
      next();
    }
  }

  /**
   * Role-based authorization
   */
  static requireRole(...allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'NOT_AUTHENTICATED',
        });
      }

      const userRole = req.user.role?.name;

      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          error: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: allowedRoles,
          userRole,
        });
      }

      next();
    };
  }

  /**
   * Permission-based authorization
   */
  static requirePermission(...requiredPermissions) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'NOT_AUTHENTICATED',
        });
      }

      const userPermissions = req.user.role?.permissions || [];
      const hasPermission = requiredPermissions.every((permission) => userPermissions.includes(permission));

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          error: 'INSUFFICIENT_PERMISSIONS',
          requiredPermissions,
          userPermissions,
        });
      }

      next();
    };
  }

  /**
   * Require OTP for sensitive operations
   */
  static requireOTP(purpose = 'sensitive_op') {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required',
            error: 'NOT_AUTHENTICATED',
          });
        }

        // Check if OTP is enabled
        if (!otpService.isEnabled(req.user.otpSettings)) {
          return next(); // Skip if OTP is disabled
        }

        // Check if user has OTP setup
        if (!req.user.requiresOTP(purpose)) {
          return next(); // Skip if not required for this user/operation
        }

        // Check if OTP has been verified recently for this session
        const otpVerificationWindow = 10 * 60 * 1000; // 10 minutes
        const recentOTPVerification = req.user.currentOTP?.verified && req.user.currentOTP?.purpose === purpose && Date.now() - new Date(req.user.currentOTP.verifiedAt).getTime() < otpVerificationWindow;

        if (recentOTPVerification) {
          return next(); // OTP recently verified
        }

        // OTP required but not provided/verified
        return res.status(200).json({
          success: false,
          message: 'OTP verification required for this operation',
          error: 'OTP_REQUIRED',
          otpRequired: true,
          availableMethods: req.user.availableOTPMethods,
          purpose,
        });
      } catch (error) {
        console.error('OTP middleware error:', error);
        return res.status(500).json({
          success: false,
          message: 'OTP verification failed',
          error: 'OTP_ERROR',
        });
      }
    };
  }

  /**
   * Device trust verification
   */
  static requireTrustedDevice() {
    return (req, res, next) => {
      if (!req.user || !req.deviceInfo) {
        return res.status(401).json({
          success: false,
          message: 'Authentication and device verification required',
          error: 'DEVICE_VERIFICATION_REQUIRED',
        });
      }

      const device = req.user.knownDevices.find((d) => d.deviceId === req.deviceInfo.deviceId);

      if (!device || !device.isTrusted) {
        return res.status(403).json({
          success: false,
          message: 'This operation requires a trusted device',
          error: 'UNTRUSTED_DEVICE',
          deviceId: req.deviceInfo.deviceId,
          canTrustDevice: true,
        });
      }

      next();
    };
  }

  /**
   * Require email verification
   */
  static requireEmailVerification() {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'NOT_AUTHENTICATED',
        });
      }

      if (!req.user.emailVerified) {
        return res.status(403).json({
          success: false,
          message: 'Email verification required',
          error: 'EMAIL_NOT_VERIFIED',
          canResendVerification: true,
        });
      }

      next();
    };
  }

  /**
   * Extract JWT token from request
   */
  static extractToken(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter
    if (req.query.token) {
      return req.query.token;
    }

    // Check cookies
    if (req.cookies && req.cookies.access_token) {
      return req.cookies.access_token;
    }

    return null;
  }

  /**
   * Perform comprehensive security checks
   */
  static async performSecurityChecks(user, deviceInfo, tokenData) {
    const checks = {
      allowed: true,
      reason: null,
      error: null,
      requiresAction: null,
    };

    // Check for suspicious device
    if (deviceInfo.security?.riskLevel === 'high') {
      checks.allowed = false;
      checks.reason = 'Suspicious device detected';
      checks.error = 'SUSPICIOUS_DEVICE';
      checks.requiresAction = 'device_verification';

      await user.logSecurityEvent('suspicious_device_blocked', 'High-risk device blocked', 'high', deviceInfo);
      return checks;
    }

    // Check for device mismatch
    if (process.env.REQUIRE_DEVICE_VERIFICATION === 'true') {
      const expectedDeviceId = tokenData.deviceId;
      if (expectedDeviceId !== deviceInfo.deviceId) {
        checks.allowed = false;
        checks.reason = 'Device mismatch detected';
        checks.error = 'DEVICE_MISMATCH';
        checks.requiresAction = 'device_verification';

        await user.logSecurityEvent('device_mismatch', 'Token used from different device', 'high', deviceInfo);
        return checks;
      }
    }

    // Check for suspicious login patterns
    if (process.env.ENABLE_SUSPICIOUS_LOGIN_DETECTION === 'true') {
      const suspiciousActivity = await AuthMiddleware.detectSuspiciousActivity(user, deviceInfo);
      if (suspiciousActivity.detected) {
        checks.allowed = false;
        checks.reason = suspiciousActivity.reason;
        checks.error = 'SUSPICIOUS_ACTIVITY';
        checks.requiresAction = suspiciousActivity.action;
        return checks;
      }
    }

    // Check IP whitelist if enabled
    if (process.env.ENABLE_IP_WHITELIST === 'true') {
      const ipAllowed = AuthMiddleware.checkIPWhitelist(deviceInfo.ipAddress);
      if (!ipAllowed) {
        checks.allowed = false;
        checks.reason = 'IP address not in whitelist';
        checks.error = 'IP_NOT_WHITELISTED';

        await user.logSecurityEvent('ip_blocked', 'IP not in whitelist', 'high', deviceInfo);
        return checks;
      }
    }

    return checks;
  }

  /**
   * Check OTP requirement for current request
   */
  static async checkOTPRequirement(req, user, deviceInfo) {
    const result = {
      required: false,
      satisfied: false,
      reason: null,
    };

    // Skip if OTP is disabled
    if (!otpService.isEnabled()) {
      return result;
    }

    // Check if this is a sensitive operation
    const sensitiveEndpoints = ['/api/users/change-password', '/api/users/delete-account', '/api/users/disable-totp', '/api/users/update-email', '/api/admin'];

    const isSensitiveOperation = sensitiveEndpoints.some((endpoint) => req.path.startsWith(endpoint));

    if (isSensitiveOperation && user.otpSettings.requireForSensitiveOps) {
      result.required = true;
      result.reason = 'sensitive_operation';
    }

    // Check for new/untrusted device
    const device = user.knownDevices.find((d) => d.deviceId === deviceInfo.deviceId);
    if (!device || !device.isTrusted) {
      result.required = true;
      result.reason = 'untrusted_device';
    }

    // Check for suspicious activity
    if (deviceInfo.security?.riskLevel === 'high') {
      result.required = true;
      result.reason = 'suspicious_activity';
    }

    // If OTP is required, check if it's been satisfied recently
    if (result.required) {
      const otpVerificationWindow = 10 * 60 * 1000; // 10 minutes
      result.satisfied = user.currentOTP?.verified && Date.now() - new Date(user.currentOTP.verifiedAt || 0).getTime() < otpVerificationWindow;
    }

    return result;
  }

  /**
   * Detect suspicious activity patterns
   */
  static async detectSuspiciousActivity(user, deviceInfo) {
    const result = {
      detected: false,
      reason: null,
      action: null,
      score: 0,
    };

    // Check for rapid location changes
    const lastLogin = user.loginHistory?.[user.loginHistory.length - 1];
    if (lastLogin && lastLogin.successful) {
      const timeDiff = Date.now() - new Date(lastLogin.loginTime).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // If login from different country within 2 hours
      if (hoursDiff < 2) {
        const lastDevice = user.knownDevices.find((d) => d.ipAddress === lastLogin.ipAddress);

        if (lastDevice && lastDevice.location?.country !== deviceInfo.location?.country && deviceInfo.location?.country !== 'Unknown') {
          result.score += 50;
          result.reason = 'Impossible travel detected';
        }
      }
    }

    // Check for multiple failed attempts recently
    const recentFailures =
      user.loginHistory?.filter(
        (h) => !h.successful && Date.now() - new Date(h.loginTime).getTime() < 24 * 60 * 60 * 1000 // 24 hours
      ).length || 0;

    if (recentFailures >= 5) {
      result.score += 30;
      result.reason = 'Multiple recent failed login attempts';
    }

    // Check for unusual access patterns
    const recentLogins =
      user.loginHistory?.filter(
        (h) => h.successful && Date.now() - new Date(h.loginTime).getTime() < 7 * 24 * 60 * 60 * 1000 // 7 days
      ) || [];

    const uniqueIPs = new Set(recentLogins.map((l) => l.ipAddress));
    if (uniqueIPs.size > 10) {
      // More than 10 different IPs in a week
      result.score += 20;
      result.reason = 'Unusual access pattern detected';
    }

    // Determine if activity is suspicious
    if (result.score >= 50) {
      result.detected = true;
      result.action = 'require_otp';

      if (result.score >= 70) {
        result.action = 'require_device_verification';
      }
    }

    return result;
  }

  /**
   * Check if IP is in whitelist
   */
  static checkIPWhitelist(ip) {
    if (!process.env.ALLOWED_IPS) {
      return true; // If no whitelist configured, allow all
    }

    const allowedIPs = process.env.ALLOWED_IPS.split(',').map((ip) => ip.trim());

    // Check for exact match or CIDR range
    return allowedIPs.some((allowedIP) => {
      if (allowedIP === ip) {
        return true;
      }

      // Simple CIDR check (you might want to use a proper CIDR library)
      if (allowedIP.includes('/')) {
        // This is a simplified CIDR check
        const [network, prefix] = allowedIP.split('/');
        return ip.startsWith(network.substring(0, network.lastIndexOf('.') + 1));
      }

      return false;
    });
  }

  /**
   * Rate limiting middleware
   */
  static createRateLimit(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later',
        error: 'RATE_LIMIT_EXCEEDED',
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.id || req.ip;
      },
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * Brute force protection for login attempts
   */
  static createBruteForceProtection() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 login attempts per windowMs
      message: {
        success: false,
        message: 'Too many login attempts, please try again later',
        error: 'LOGIN_RATE_LIMIT_EXCEEDED',
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => {
        // Rate limit by IP + identifier (email/username)
        const identifier = req.body.identifier || req.body.email || '';
        return `${req.ip}_${identifier}`;
      },
    });
  }

  /**
   * CSRF protection middleware
   */
  static csrfProtection() {
    return (req, res, next) => {
      if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
      }

      const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;

      if (!token) {
        return res.status(403).json({
          success: false,
          message: 'CSRF token missing',
          error: 'CSRF_TOKEN_MISSING',
        });
      }

      // Verify CSRF token (implement your CSRF verification logic)
      // This is a simplified check - use a proper CSRF library in production
      if (!AuthMiddleware.verifyCsrfToken(token, req.session)) {
        return res.status(403).json({
          success: false,
          message: 'Invalid CSRF token',
          error: 'INVALID_CSRF_TOKEN',
        });
      }

      next();
    };
  }

  /**
   * Verify CSRF token (simplified implementation)
   */
  static verifyCsrfToken(token, session) {
    // In production, use a proper CSRF library like 'csurf'
    return session && session.csrfToken === token;
  }
}

module.exports = authAccess;
