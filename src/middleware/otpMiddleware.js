
const otpService = require('../services/otpService');
const User = require('../models/user');

/**
 * 🔐 OTP MIDDLEWARE
 * Secure endpoints with OTP verification requirements
 */

/**
 * Middleware to require OTP verification for sensitive operations
 * @param {string} operationType - Type of operation ('login', 'sensitive_op', etc.)
 * @param {object} options - Additional options
 */
const requireOTPVerification = (operationType = 'sensitive_op', options = {}) => {
  return async (req, res, next) => {
    try {
      // Skip if OTP is globally disabled
      if (!otpService.isEnabled()) {
        return next();
      }

      // Get user from request (should be set by auth middleware)
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }

      // Check if user has OTP enabled
      if (!user.otpSettings.enabled) {
        return next(); // OTP not enabled for user, continue
      }

      // Check if OTP is required for this operation
      const requiresOTP = await user.requiresOTP(operationType);
      if (!requiresOTP) {
        return next(); // OTP not required for this operation
      }

      // Check if OTP has been verified in this session
      const otpVerified = req.session?.otpVerified;
      const otpVerifiedAt = req.session?.otpVerifiedAt;
      const otpPurpose = req.session?.otpVerifiedPurpose;

      // OTP verification timeout (default: 5 minutes)
      const verificationTimeout = options.verificationTimeout || 5 * 60 * 1000;
      const now = new Date();

      if (otpVerified && otpVerifiedAt) {
        const timeSinceVerification = now - new Date(otpVerifiedAt);

        // Check if verification is still valid
        if (timeSinceVerification < verificationTimeout) {
          // Check if purpose matches (if specified)
          if (!options.strictPurpose || otpPurpose === operationType) {
            return next(); // OTP verified and still valid
          }
        }
      }

      // OTP verification required
      return res.status(403).json({
        success: false,
        message: 'OTP verification required for this operation',
        error: 'OTP_VERIFICATION_REQUIRED',
        data: {
          operationType,
          otpMethods: otpService.getAvailableMethods(user),
          verificationEndpoint: '/api/otp/verify'
        }
      });

    } catch (error) {
      console.error('OTP Middleware Error:', error);
      return res.status(500).json({
        success: false,
        message: 'OTP verification check failed',
        error: 'OTP_MIDDLEWARE_ERROR'
      });
    }
  };
};

/**
 * Middleware to check if OTP is required for login
 */
const checkLoginOTPRequirement = async (req, res, next) => {
  try {
    // Skip if no user identifier provided
    if (!req.body.email && !req.body.username) {
      return next();
    }

    // Find user
    const identifier = req.body.email || req.body.username;
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });

    if (!user) {
      return next(); // User not found, continue with normal login flow
    }

    // Skip if OTP is globally disabled
    if (!otpService.isEnabled()) {
      return next();
    }

    // Skip if user doesn't have OTP enabled
    if (!user.otpSettings.enabled) {
      return next();
    }

    // Skip if OTP is not required for login
    if (!user.otpSettings.requireForLogin) {
      return next();
    }

    // Add OTP requirement flag to request
    req.otpRequired = true;
    req.otpUser = user;
    req.availableOTPMethods = otpService.getAvailableMethods(user);

    return next();

  } catch (error) {
    console.error('Login OTP Check Error:', error);
    return next(); // Continue on error to avoid blocking login
  }
};

/**
 * Middleware to validate OTP during login process
 */
const validateLoginOTP = async (req, res, next) => {
  try {
    // Skip if OTP is not required
    if (!req.otpRequired || !req.otpUser) {
      return next();
    }

    // Check if OTP code is provided
    const { otpCode, otpMethod } = req.body;

    if (!otpCode) {
      return res.status(400).json({
        success: false,
        message: 'OTP code is required for login',
        error: 'OTP_CODE_REQUIRED',
        data: {
          otpRequired: true,
          availableMethods: req.availableOTPMethods
        }
      });
    }

    // Verify OTP
    const deviceInfo = {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      deviceId: req.headers['x-device-id'] || 'unknown'
    };

    const isValid = await otpService.verifyOTP(req.otpUser, otpCode, 'login', deviceInfo);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code',
        error: 'INVALID_OTP_CODE',
        data: {
          otpRequired: true,
          availableMethods: req.availableOTPMethods
        }
      });
    }

    // OTP verified, add to login history
    if (req.otpUser.addLoginHistory) {
      await req.otpUser.addLoginHistory({
        successful: true,
        deviceInfo: deviceInfo,
        loginMethod: 'password+otp',
        otpUsed: otpMethod || req.otpUser.otpSettings.preferredMethod
      });
    }

    // Set OTP verification in session
    if (req.session) {
      req.session.otpVerified = true;
      req.session.otpVerifiedAt = new Date();
      req.session.otpVerifiedPurpose = 'login';
    }

    return next();

  } catch (error) {
    console.error('Login OTP Validation Error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'OTP validation failed',
      error: 'OTP_VALIDATION_FAILED'
    });
  }
};

/**
 * Middleware to clear OTP verification from session
 */
const clearOTPVerification = (req, res, next) => {
  if (req.session) {
    req.session.otpVerified = false;
    req.session.otpVerifiedAt = null;
    req.session.otpVerifiedPurpose = null;
  }
  next();
};

/**
 * Middleware to enforce single OTP method policy
 */
const enforceSingleOTPMethod = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next();
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.otpSettings.enabled) {
      return next();
    }

    // Ensure only one method is active at a time
    const preferredMethod = user.otpSettings.preferredMethod;

    // Disable other methods based on preferred method
    if (preferredMethod === 'totp') {
      // Clear any existing email/SMS OTP sessions
      if (user.currentOTP.type && user.currentOTP.type !== 'backup') {
        user.currentOTP = {
          code: null,
          hashedCode: null,
          type: null,
          purpose: null,
          expiresAt: null,
          attempts: 0,
          maxAttempts: 3,
          lastSent: null,
          verified: false
        };
        await user.save();
      }
    }

    return next();

  } catch (error) {
    console.error('Single OTP Method Enforcement Error:', error);
    return next(); // Continue on error
  }
};

/**
 * Middleware to log OTP-related security events
 */
const logOTPSecurityEvent = (eventType, description = null) => {
  return async (req, res, next) => {
    try {
      if (req.user && req.user.id) {
        const user = await User.findById(req.user.id);
        if (user && user.logSecurityEvent) {
          await user.logSecurityEvent(
            eventType,
            description || `OTP ${eventType} event`,
            'medium',
            {
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              deviceId: req.headers['x-device-id'],
              endpoint: req.originalUrl
            }
          );
        }
      }
    } catch (error) {
      console.error('OTP Security Event Logging Error:', error);
      // Don't block the request on logging errors
    }

    next();
  };
};

module.exports = {
  requireOTPVerification,
  checkLoginOTPRequirement,
  validateLoginOTP,
  clearOTPVerification,
  enforceSingleOTPMethod,
  logOTPSecurityEvent
};
