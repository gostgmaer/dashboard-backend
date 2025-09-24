
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { checkLoginOTPRequirement, validateLoginOTP } = require('./otpMiddleware');

/**
 * 🔐 AUTHENTICATION MIDDLEWARE
 * Enhanced authentication with OTP integration
 */

/**
 * Verify JWT token and set user in request
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required',
        error: 'TOKEN_REQUIRED'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key');

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active',
        error: 'ACCOUNT_INACTIVE'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked',
        error: 'ACCOUNT_LOCKED'
      });
    }

    // Set user in request
    req.user = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid access token',
        error: 'INVALID_TOKEN'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token has expired',
        error: 'TOKEN_EXPIRED'
      });
    } else {
      console.error('Authentication Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication failed',
        error: 'AUTHENTICATION_FAILED'
      });
    }
  }
};

/**
 * Enhanced login controller with OTP integration
 */
const loginWithOTP = [
  // First, check if OTP is required
  checkLoginOTPRequirement,

  // Then validate login credentials and OTP if required
  async (req, res) => {
    try {
      const { email, username, password, otpCode, deviceInfo } = req.body;

      // Input validation
      if ((!email && !username) || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email/username and password are required',
          error: 'MISSING_CREDENTIALS'
        });
      }

      // Find user
      const identifier = email || username;
      const user = await User.findOne({
        $or: [
          { email: identifier.toLowerCase() },
          { username: identifier }
        ]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          error: 'INVALID_CREDENTIALS'
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked due to too many failed attempts',
          error: 'ACCOUNT_LOCKED',
          data: {
            lockoutUntil: user.lockoutUntil
          }
        });
      }

      // Validate password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        // Handle failed login
        await user.handleFailedLogin(deviceInfo || {}, 'invalid_password');

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
          error: 'INVALID_CREDENTIALS'
        });
      }

      // Check if OTP is required for login
      if (req.otpRequired) {
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

        // Validate OTP - this will be handled by validateLoginOTP middleware
        // if we were using it as middleware, but since we're in controller,
        // we'll validate directly
        const otpService = require('../services/otpService');
        const loginDeviceInfo = {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          deviceId: req.headers['x-device-id'] || 'unknown',
          ...deviceInfo
        };

        const isValidOTP = await otpService.verifyOTP(user, otpCode, 'login', loginDeviceInfo);
        if (!isValidOTP) {
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

        // Add successful login with OTP to history
        await user.addLoginHistory({
          successful: true,
          deviceInfo: loginDeviceInfo,
          loginMethod: 'password+otp',
          otpUsed: user.otpSettings.preferredMethod
        });
      } else {
        // Add successful login without OTP to history
        await user.addLoginHistory({
          successful: true,
          deviceInfo: deviceInfo || {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          },
          loginMethod: 'password'
        });
      }

      // Reset failed login attempts on successful login
      user.failedLoginAttempts = 0;
      user.consecutiveFailedAttempts = 0;
      user.lockoutUntil = null;
      user.lastLogin = new Date();

      // Reset login security
      user.loginSecurity.failedAttempts = 0;
      user.loginSecurity.consecutiveFailures = 0;
      user.loginSecurity.lockedUntil = null;

      await user.save();

      // Generate tokens
      const tokens = await user.generateTokens(deviceInfo || {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Set OTP verification in session if applicable
      if (req.session && req.otpRequired) {
        req.session.otpVerified = true;
        req.session.otpVerifiedAt = new Date();
        req.session.otpVerifiedPurpose = 'login';
      }

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            isVerified: user.isVerified
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.accessTokenExpiresAt
          },
          otpVerified: req.otpRequired ? true : false
        }
      });

    } catch (error) {
      console.error('Login Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Login failed',
        error: 'LOGIN_FAILED'
      });
    }
  }
];

/**
 * Optional role-based authorization middleware
 */
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'UNAUTHORIZED'
        });
      }

      const user = await User.findById(req.user.id).populate('role');
      if (!user || !user.role) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - no role assigned',
          error: 'NO_ROLE'
        });
      }

      const userRoles = Array.isArray(roles) ? roles : [roles];
      if (!userRoles.includes(user.role.name)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - insufficient permissions',
          error: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();

    } catch (error) {
      console.error('Role Authorization Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed',
        error: 'AUTHORIZATION_FAILED'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  loginWithOTP,
  requireRole
};
