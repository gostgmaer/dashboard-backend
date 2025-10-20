const User = require('../models/user');
const DeviceDetector = require('../services/deviceDetector');
const jwt = require('jsonwebtoken');
const Order = require('../models/orders');
const Product = require('../models/products');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
const crypto = require('crypto');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../utils/apiUtils');
// const { welcomeEmailTemplate } = require('../email/emailTemplates');
const { sendEmail } = require('../email');
const { checkPasswordStrength } = require('../utils/security');
const otpService = require('../services/otpService');
const { emailVerificationTemplate, welcomeEmailTemplate, passwordResetRequestTemplate } = require('../email/emailTemplate');
const NotificationMiddleware = require('../middleware/notificationMiddleware');
const { jwtSecret } = require('../config/setting');
const ActivityHelper = require('../utils/activityHelpers');
const passport = require('passport');
const socialAccountControllers = require('./social-account-controllers');
const { isSupportedProvider } = require('../services/socialProvider');

/**
 * 🚀 CONSOLIDATED ROBUST USER CONTROLLER
 * 
 * Features:

 * ✅ Standardized responses
 * ✅ Authentication & role-based access
 * ✅ Analytics & reporting
 * ✅ Import/Export functionality
 * ✅ Session management
 * ✅ Security features
 */

class authController {
  // ========================================
  // 🔧 UTILITY METHODS
  // ========================================

  static calculateProfileCompleteness(user) {
    const requiredFields = ['firstName', 'lastName', 'email', 'phoneNumber', 'dateOfBirth', 'gender', 'profilePicture'];

    const completedFields = requiredFields.filter((field) => user[field] !== null && user[field] !== undefined && user[field] !== '');

    const addressComplete = user.address && user.address.length > 0;
    const paymentComplete = user.paymentMethods && user.paymentMethods.length > 0;

    let percentage = (completedFields.length / requiredFields.length) * 80;
    if (addressComplete) percentage += 10;
    if (paymentComplete) percentage += 10;

    return Math.round(percentage);
  }

  // ========================================
  // 🔧 UTILITY METHODS
  // ========================================

  static calculateUserScore(user) {
    let score = 0;
    if (user.isVerified) score += 10;
    if (user.orders?.length > 0) score += user.orders.length * 2;
    if (user.loyaltyPoints > 0) score += Math.floor(user.loyaltyPoints / 100);
    if (user.subscriptionType === 'premium') score += 20;
    if (user.subscriptionType === 'enterprise') score += 50;
    if (user.hasActiveTOTP) score += 15;
    return score;
  }

  static getUserActivityLevel(user) {
    const now = new Date();
    const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
    if (!lastLogin) return 'Never Active';
    const daysSinceLogin = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
    if (daysSinceLogin <= 7) return 'Very Active';
    if (daysSinceLogin <= 30) return 'Active';
    if (daysSinceLogin <= 90) return 'Moderately Active';
    return 'Inactive';
  }

  static calculateProfileCompleteness(user) {
    const requiredFields = ['firstName', 'lastName', 'email', 'phoneNumber', 'dateOfBirth', 'gender', 'profilePicture'];
    const completedFields = requiredFields.filter((field) => user[field] !== null && user[field] !== undefined && user[field] !== '');
    const addressComplete = user.address && user.address.length > 0;
    const paymentComplete = user.paymentMethods && user.paymentMethods.length > 0;
    const securityComplete = user.hasActiveTOTP;

    let percentage = (completedFields.length / requiredFields.length) * 70;
    if (addressComplete) percentage += 10;
    if (paymentComplete) percentage += 10;
    if (securityComplete) percentage += 10;
    return Math.round(percentage);
  }

  static enrichUser(user, includeCalculated = true) {
    const userObj = user.toObject ? user.toObject() : user;
    if (includeCalculated) {
      return {
        ...userObj,
        userScore: this.calculateUserScore(userObj),
        activityLevel: this.getUserActivityLevel(userObj),
        profileCompleteness: this.calculateProfileCompleteness(userObj),
        accountAge: userObj.createdAt ? Math.floor((new Date() - new Date(userObj.createdAt)) / (1000 * 60 * 60 * 24)) : 0,
        securityScore: this.calculateSecurityScore(userObj),
      };
    }
    return userObj;
  }

  static calculateSecurityScore(user) {
    let score = 0;

    if (user.emailVerified) score += 20;
    if (user.phoneVerified) score += 15;
    if (user.hasActiveTOTP) score += 30;
    if (user.knownDevices?.every((d) => d.isTrusted)) score += 15;
    if (user.loginSecurity?.failedAttempts === 0) score += 10;
    if (user.isActive) score += 10; // ✅ Account is active

    return Math.min(score, 100);
  }

  // ========================================
  // 🔐 AUTHENTICATION OPERATIONS
  // ========================================

  //Register User

  static async registerUser(req, res, next) {
    // Validate incoming request data via express-validator middleware
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      let { email, username, password, confirmPassword, ...otherData } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);
      username = username || email.split('@')[0];
      // Validation
      if (!email || !username || !password) {
        return errorResponse(res, 'Email, username, and password are required', 400);
      }

      if (password !== confirmPassword) {
        return errorResponse(res, 'Passwords do not match', 400);
      }

      // Password strength check
      const { checks, feedback, isValid, suggestions, warning, score } = checkPasswordStrength(password);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          passwordRequirements: checks,
          feedback,
          suggestions,
          warning,
          score,
        });
      }

      // Call schema method for registration
      // Register user
      const user = await User.registerNewUser(
        {
          email,
          username,
          password,
          confirmPassword,
          ...otherData,
        },
        req.deviceInfo
      );

      // Send email verification if OTP is enabled
      let verificationResult = null;
      if (otpService.isEnabled(user.otpSettings)) {
        verificationResult = await user.generateOTP('email_verification', deviceInfo, 'email');
      }

      // Send welcome email
      let emaildata = await sendEmail(welcomeEmailTemplate, user);
      res.locals.createdUser = user;
      await user.logSecurityEvent('user_registered', 'New user registration', 'low', deviceInfo);
      await NotificationMiddleware.onUserCreate(req, res, () => {});

      return standardResponse(
        res,
        true,
        {
          user: {
            email: user.email,
            username: user.username,
            status: user.status,
          },
          otpEnabled: otpService.isEnabled(user.otpSettings),
          verificationRequired: user.status === 'pending',
          verificationSent: !!verificationResult,
        },
        emaildata.success ? 'Registration successful' : 'Registration successful but failed to send welcome email Please Activate Your Account',
        201
      );
    } catch (err) {
      // Handle errors (e.g., duplicate keys, validation)
      console.error('Registration error:', err);
      return errorResponse(res, err.message, 500, err);
    }
  }

  /**
   * LOGIN USER
   */

  // static async login(req, res, next) {
  //   try {
  //     const { identifier, password, deviceTrust = false, challengeResponse } = req.body;
  //     const deviceInfo = DeviceDetector.detectDevice(req);
  //     const now = new Date();

  //     if (!identifier || !password) {
  //       return errorResponse(res, 'Email/username and password are required', 400);
  //     }

  //     // Fetch user by identifier (email/username)
  //     const user = await User.findOne({
  //       $or: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }]
  //     });
  //     if (!user) {
  //       // Delay response to prevent user enumeration
  //       await new Promise(r => setTimeout(r, 1500));
  //       return errorResponse(res, 'Invalid credentials', 401);
  //     }

  //     // Check account lock due to prior failed attempts or suspicious activity
  //     if (user.lockedAt && now - user.lockedAt < 30 * 60 * 1000) { // locked for 30 mins
  //       return errorResponse(res, 'Account temporarily locked due to multiple failed login attempts', 423);
  //     } else if (user.lockedAt) {
  //       // Auto unlock after cooldown
  //       user.lockedAt = null;
  //       await user.save();
  //     }

  //     // Verify password
  //     const pwdMatch = await user.comparePassword(password);
  //     if (!pwdMatch) {
  //       // Record failed login attempt & lock if threshold exceeded
  //       user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  //       if (user.failedLoginAttempts >= 5) {
  //         user.lockedAt = new Date();
  //         await user.save();
  //         return errorResponse(res, 'Account locked after multiple failed attempts', 423);
  //       }
  //       await user.save();
  //       return errorResponse(res, 'Invalid credentials', 401);
  //     }

  //     // Reset failed attempts on successful password
  //     user.failedLoginAttempts = 0;
  //     await user.save();

  //     // Require email verified before login
  //     if (!user.emailVerified) {
  //       await user.generateEmailVerificationToken();
  //       await sendEmail(emailVerificationTemplate, user);
  //       return errorResponse(res, 'Email not verified. Verification email sent.', 403);
  //     }

  //     // Anomaly detection: Notify or trigger MFA for risky logins
  //     const isNewDevice = !user.knownDevices?.some(d => d.deviceId === deviceInfo.deviceId);
  //     const isNewIP = deviceInfo.ip && !user.ipAddresses?.includes(deviceInfo.ip);

  //     // Update IP log asynchronously
  //     if (isNewIP) {
  //       user.ipAddresses = [...(user.ipAddresses || []), deviceInfo.ip];
  //       user.lastIPChangeAt = new Date();
  //       user.markModified('ipAddresses');
  //       user.save().catch(console.error);
  //     }

  //     // Determine MFA requirement flexibly
  //     const requiresMFA =
  //       user.otpSettings?.enabled &&
  //       (isNewDevice || isNewIP || authResult?.requiresMFA);

  //     if (requiresMFA && !challengeResponse) {
  //       // Trust device skip if configured and device is trusted
  //       const trustedDevice = user.knownDevices?.find(d =>
  //         d.deviceId === deviceInfo.deviceId && d.isTrusted
  //       );

  //       if (trustedDevice && user.otpSettings.allowTrustedDeviceSkip) {
  //         // Skip MFA for trusted device
  //         await user.handleSuccessfulLogin(deviceInfo);
  //         const tokens = await user.generateTokens(deviceInfo);

  //         return standardResponse(res, true, {
  //           user: user.publicProfile(),
  //           tokens,
  //           skipMFA: true,
  //           trustedDevice: true,
  //           message: 'Login successful - trusted device'
  //         });
  //       }

  //       // Generate temporary token for MFA step
  //       const tempTokenPayload = {
  //         userId: user._id,
  //         step: 'mfa_required',
  //         deviceId: deviceInfo.deviceId,
  //         exp: Math.floor(Date.now() / 1000) + (10 * 60) // 10 mins
  //       };
  //       const tempToken = jwt.sign(tempTokenPayload, process.env.JWT_SECRET);

  //       // Generate OTP for MFA (handle totp/email/sms inside generateOTP)
  //       let otpResult = null;
  //       try {
  //         otpResult = await user.generateOTP('login', deviceInfo);
  //       } catch (err) {
  //         console.error('OTP generation error:', err);
  //       }

  //       return standardResponse(res, true, {
  //         requiresMFA: true,
  //         availableMethods: user.otpSettings.methods || ['totp', 'email', 'sms'],
  //         tempToken,
  //         otpSent: !!otpResult,
  //         user: user.publicProfile(),
  //         message: 'MFA verification required due to new device/IP or account settings.'
  //       });
  //     }

  //     // If MFA provided a challengeResponse token/OTP, validate it before issuing tokens
  //     if (requiresMFA && challengeResponse) {
  //       // Call your unified OTP verification method here
  //       const otpVerification = await user.verifyOTPForPurpose(
  //         challengeResponse.code,
  //         challengeResponse.method,
  //         'login',
  //         deviceInfo
  //       );

  //       if (!otpVerification.success) {
  //         return errorResponse(res, otpVerification.error || 'Invalid OTP code', 401);
  //       }
  //     }

  //     // Proceed with login
  //     if (deviceTrust) {
  //       await user.trustDevice(deviceInfo.deviceId);
  //     }
  //     await user.handleSuccessfulLogin(deviceInfo);
  //     const tokens = await user.generateTokens(deviceInfo);

  //     return standardResponse(res, true, {
  //       user: user.publicProfile(),
  //       tokens,
  //       requiresMFA: false,
  //       message: 'Login successful'
  //     });
  //   } catch (err) {
  //     console.error('[LOGIN ERROR]', err);
  //     return errorResponse(res, 'Internal server error', 500);
  //   }
  // }
  static async login(req, res, next) {
    try {
      const { identifier, password, deviceTrust = false } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!identifier || !password) {
        return errorResponse(res, 'Email/username and password are required', 400);
      }
      // Authenticate user
      const authResult = await User.authenticateUser(identifier, password, deviceInfo);
      let user = authResult.user;

      res.locals.user = user;
      if (!user) {
        await ActivityHelper.logAuth(req, 'login attempt', 'failed', {
          email,
          reason: 'user not found',
          suspiciousActivity: true,
        });
        return errorResponse(res, 'Invalid Email/username or password', 401);
      }

      if (!user.emailVerified) {
        await user.generateEmailVerificationToken();
        await sendEmail(emailVerificationTemplate, user);
      }

      // Check if MFA/OTP is required
      if (authResult.requiresMFA) {
        // Check if device is trusted and user allows skip
        const trustedDevice = user.knownDevices?.find((d) => d.deviceId === deviceInfo.deviceId && d.isTrusted);

        if (trustedDevice && user.otpSettings.allowTrustedDeviceSkip) {
          // Skip OTP for trusted device
          await user.handleSuccessfulLogin(deviceInfo);
          const tokens = await user.generateTokens(deviceInfo);
          await ActivityHelper.logAuth(req, 'login', 'success', {
            userId: user._id,
            email: user.email,
            loginMethod: 'password',
            tokenGenerated: true,
          });
          return standardResponse(
            res,
            true,
            {
              user: {
                id: user._id,
                email: user.email,
                image: user.profilePicture,
                username: user.username,
                fullName: user.fullName,
                role: user.role?.name,
                skipMFA: true,
                trustedDevice: true,
              },
              tokens,
            },
            'Login successful - trusted device'
          );
        }

        // Generate temporary token for MFA step
        const tempTokenPayload = {
          userId: user._id,
          step: 'mfa_required',
          deviceId: deviceInfo.deviceId,
          exp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
        };
        const tempToken = jwt.sign(tempTokenPayload, jwtSecret);

        // Send OTP using best available method
        let otpResult = null;
        try {
          otpResult = await user.generateOTP('login', deviceInfo);
        } catch (error) {
          console.error('OTP generation failed:', error);
        }
        const tokens = await user.generateTokens(deviceInfo);
        // Log successful login
        await ActivityHelper.logAuth(req, 'login', 'success', {
          userId: user._id,
          email: user.email,
          loginMethod: 'password',
          tokenGenerated: true,
        });

        return standardResponse(
          res,
          true,
          {
            tokens,
            '2fa_required': true,
            otp_method: otpResult?.type,
            tempToken,
            otpSent: otpResult.destination,
            user: {
              id: user._id,
              email: user.email,
              username: user.username,
              image: user.profilePicture.url,
              fullName: user.fullName,
            },
          },
          'MFA verification required',
          200
        );
      }

      const tokens = await user.generateTokens(deviceInfo);
      if (deviceTrust) {
        await user.trustDevice(deviceInfo.deviceId);
      }
      // Log successful login
      await ActivityHelper.logAuth(req, 'login', 'success', {
        userId: user._id,
        email: user.email,
        loginMethod: 'password',
        tokenGenerated: true,
      });
      NotificationMiddleware.onLoginSuccess(req, res, () => {});
      return standardResponse(
        res,
        true,
        {
          user: {
            id: user._id,
            email: user.email,
            image: user.profilePicture.url,
            username: user.username,
            fullName: user.fullName,
            role: user.role?.name,
          },
          tokens,
        },
        'Login successful'
      );
    } catch (error) {
      console.error('Login error:', error);
      NotificationMiddleware.onLoginFailed(req, res, () => {});
      return errorResponse(res, error.message, 500, error.message);
    }
  }
  static async socialLogin(req, res) {
    try {
      const { identifier, profileData, deviceTrust = false, provider, providerId, email, name, profile } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);
      if (!provider || !providerId) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }
      const { user, isNewUser } = await User.verifyAndLinkUser({ provider, providerId, email: identifier, name: profile.name, profile });

      // Authenticate user
      const authResult = await User.authenticateSocial({ ...user, provider, providerId }, identifier, deviceInfo);
      let u = authResult.user;
      res.locals.user = u;
      const tokens = await u.generateTokens(deviceInfo);
      if (deviceTrust) {
        await u.trustDevice(deviceInfo.deviceId);
      }
      // Log successful login
      await ActivityHelper.logAuth(req, 'login', 'success', {
        userId: u._id,
        email: u.email,
        loginMethod: 'Social',
        tokenGenerated: true,
      });
      NotificationMiddleware.onLoginSuccess(req, res, () => {});
      return standardResponse(
        res,
        true,
        {
          user: {
            id: u._id,
            email: u.email,
            image: u.profilePicture.url,
            username: u.username,
            fullName: u.fullName,
            role: u.role?.name,
            isVerified: u.isVerified,
            hasActiveTOTP: u.hasActiveTOTP,
          },
          tokens,
          requiresMFA: false,
        },
        'Login successful'
      );
    } catch (error) {
      await ActivityHelper.logAuth(req, 'login attempt', 'error', {
        error: error.message,
      });
      return errorResponse(res, error.message, 500, error.message);
    }
  }

  static async socialMediaLogin(req, res) {
    try {
      const { provider, accessToken, code, email, identityToken } = req.body;
      if (!isSupportedProvider(provider)) {
        return res.status(400).json({ success: false, message: 'Invalid social provider.' });
      }

      let profile;
      switch (provider) {
        case 'google':
          profile = await socialAccountControllers.validateGoogleToken(accessToken || code);
          break;
        case 'facebook':
          profile = await socialAccountControllers.validateFacebookToken(accessToken);
          break;
        case 'twitter':
          profile = await socialAccountControllers.validateTwitterToken(accessToken, code);
          break;
        case 'github':
          profile = await socialAccountControllers.validateGithubToken(accessToken || code);
          break;
        case 'apple':
          profile = await socialAccountControllers.validateAppleToken(identityToken);
          break;
        case 'linkedin':
          profile = await socialAccountControllers.validateLinkedInToken(accessToken);
          break;
        case 'microsoft':
          profile = await socialAccountControllers.validateMicrosoftToken(accessToken);
          break;
        case 'discord':
          profile = await socialAccountControllers.validateDiscordToken(accessToken);
          break;
        default:
          return res.status(400).json({ success: false, message: 'Unsupported provider.' });
      }

      if (!profile || !(profile.id || profile.sub)) {
        return res.status(400).json({ success: false, message: 'Failed to retrieve social profile.' });
      }

      const providerId = profile.id || profile.sub;
      const providerEmail = profile.email || email;

      // Try to find existing user by linked social account
      let user = await User.findOne({
        socialAccounts: {
          $elemMatch: { provider, providerId },
        },
      });

      let isNewUser = false;
      if (!user) {
        // Try finding user by email if provided (to link with existing account)
        if (providerEmail) {
          user = await User.findOne({ email: providerEmail.toLowerCase() });
        }
        if (!user) {
          // Create new user account
          user = new User({
            email: providerEmail || '',
            socialAccounts: [
              {
                provider,
                providerId,
                email: providerEmail,
                verified: true,
                connectedAt: new Date(),
              },
            ],
            username: profile.name || profile.email || '',
            status: 'active',
          });
          isNewUser = true;
          await user.save();
        } else {
          // Link new social account to existing user
          user.socialAccounts.push({
            provider,
            providerId,
            email: providerEmail,
            verified: true,
            connectedAt: new Date(),
          });
          await user.save();
        }
      }

      // Generate JWT or session tokens as per your auth mechanism
      const deviceInfo = DeviceDetector.detectDevice(req);
      const tokens = await user.generateTokens(deviceInfo);

      // Log security event
      await user.logSecurityEvent(isNewUser ? 'social_registration' : 'social_login', `${isNewUser ? 'New user registered' : 'User logged in'} via ${provider}`, 'low', { ...deviceInfo, provider, isNewUser });

      res.status(200).json({
        success: true,
        message: `${isNewUser ? 'Account created and logged in' : 'Logged in'} successfully via ${provider}`,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            socialAccounts: user.socialAccounts,
            status: user.status,
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.accessTokenExpiresAt,
          },
          isNewUser,
          provider,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Social login failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Authentication failed',
      });
    }
  }

  /**
   * VERIFY OTP and complete login
   */

  static async completeTOTPSetup(req, res, next) {
    try {
      const { token } = req.body;
      const user = req.user;

      const result = await user.completeTOTPSetup(token);

      res.status(200).json({
        success: true,
        message: result.message,
        backupCodes: result.backupCodes,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async verifyOTPAndLogin(req, res) {
    try {
      const { tempToken, otp, deviceTrust = false, contact, method } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!tempToken || !otp) {
        return errorResponse(res, 'Temporary token and OTP code are required', 400);
      }

      // Verify temporary token
      let decoded;
      try {
        decoded = jwt.verify(tempToken, jwtSecret);
        if (decoded.step !== 'mfa_required') {
          throw new Error('Invalid token step');
        }
      } catch (error) {
        return errorResponse(res, 'Invalid or expired temporary token', 400);
      }

      // Find user
      const user = await User.findById(decoded.userId).populate('role');
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Verify OTP
      const otpValid = await user.verifyOTP(otp, 'login', deviceInfo);
      if (!otpValid) {
        return errorResponse(res, 'Invalid or expired OTP code', 400);
      }

      // Complete authentication
      await user.handleSuccessfulLogin(deviceInfo);
      const tokens = await user.generateTokens(deviceInfo);

      // Trust device if requested
      if (deviceTrust) {
        await user.trustDevice(deviceInfo.deviceId);
      }
      NotificationMiddleware.onLoginSuccess(req, res, () => {});
      return standardResponse(
        res,
        true,
        {
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            fullName: user.fullName,
            role: user.role?.name,
            isVerified: user.isVerified,
          },
          tokens,
          '2fa_verified': true,
          '2fa_required': true,
          deviceTrusted: deviceTrust,
        },
        'Authentication successful'
      );
    } catch (error) {
      console.error('OTP verification error:', error);
      return errorResponse(res, error.message || 'OTP verification failed', 400);
    }
  }

  /**
   * RESEND OTP
   */
  static async resendOTP(req, res) {
    try {
      const { tempToken, method } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);
    } catch (error) {}
  }
  /**
   * MFA verification - Step 2
   */
  static async verifyMFA(req, res) {
    try {
      const { userId, mfaCode, tempToken } = req.body;

      if (!userId || !mfaCode) {
        return res.status(400).json({
          success: false,
          message: 'User ID and MFA code are required',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Verify MFA code
      const isValid = await user.verifyOTP(mfaCode, 'login', req.deviceInfo);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired MFA code',
        });
      }

      // Complete authentication
      const tokens = await user.generateTokens(req.deviceInfo);
      await user.registerDevice(req.deviceInfo);
      await user.updateLastLogin();

      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            fullName: user.fullName,
            role: user.role?.name,
            isVerified: user.isVerified,
          },
          tokens,
        },
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Logout
   */
  static async logout(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const user = req.user;
      const deviceInfo = DeviceDetector.detectDevice(req);

      // Log logout event
      if (token) {
        await user.revokeToken(token, 'user_logout');
      }

      await user.logSecurityEvent('logout', 'User logout', 'low', deviceInfo);

      return standardResponse(res, true, null, 'Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      return errorResponse(res, 'Logout failed', 500, error.message);
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(req, res) {
    try {
      const user = req.user;
      const deviceInfo = DeviceDetector.detectDevice(req);

      // Revoke all tokens
      await user.revokeAllTokens('user_logout_all');
      await user.logSecurityEvent('logout_all', 'User logout from all devices', 'medium', deviceInfo);

      return standardResponse(res, true, null, 'Logged out from all devices successfully');
    } catch (error) {
      console.error('Logout all error:', error);
      return errorResponse(res, 'Failed to logout from all devices', 500, error.message);
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!refreshToken) {
        return errorResponse(res, 'Refresh token is required', 400);
      }

      // Verify and decode refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return errorResponse(res, 'Invalid or expired refresh token', 401);
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }
      // Generate new tokens
      const tokens = await user.refreshAccessToken(refreshToken);

      return standardResponse(res, true, tokens, 'Token refreshed successfully');
    } catch (error) {
      console.error('Token refresh error:', error);
      return errorResponse(res, error.message || 'Token refresh failed', 401);
    }
  }

  /**
   * Generate OTP
   */
  static async generateOTP(req, res) {
    try {
      const { type = process.env.DEFAULT_OTP_TYPE || 'email', purpose = 'login' } = req.body;
      const user = req.user;

      const otpResult = await user.generateOTP(type, purpose, req.deviceInfo);

      // Send OTP via appropriate channel
      let sendResult;
      switch (type) {
        case 'email':
          sendResult = await otpService.sendEmailOTP(user.email, otpResult.code || '000000', purpose);
          break;
        case 'sms':
          if (!user.phoneNumber) {
            throw new Error('Phone number not configured');
          }
          sendResult = await otpService.sendSMSOTP(user.phoneNumber, otpResult.code || '000000', purpose);
          break;
        case 'voice':
          if (!user.phoneNumber) {
            throw new Error('Phone number not configured');
          }
          sendResult = await otpService.sendVoiceOTP(user.phoneNumber, otpResult.code || '000000');
          break;
      }

      res.status(200).json({
        success: true,
        message: `OTP sent via ${type}`,
        data: {
          type,
          expiresAt: otpResult.expiresAt,
          sent: sendResult?.success || false,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Verify OTP
   */
  static async verifyOTP(req, res) {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { method, purpose, code } = req.body;
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      // Find user
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      // Verify OTP
      const deviceInfo = {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
        // Optional params can be added here
      };
      const result = await user.verifyOTPForPurpose(code, method, purpose, deviceInfo);

      if (!result.success) {
        return res.status(400).json({ success: false, message: result.error, locked: result.locked || false });
      }

      res.json({
        success: true,
        method: result.method,
        purpose: result.purpose,
        usedBackup: result.usedBackup || false,
        extraData: result.extraData || {},
      });
    } catch (err) {
      console.error('Verify OTP error:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * CHANGE PASSWORD
   */
  static async changePassword(req, res) {
    try {
      const user = req.user;
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!currentPassword || !newPassword || !confirmPassword) {
        return errorResponse(res, 'All password fields are required', 400);
      }

      if (newPassword !== confirmPassword) {
        return errorResponse(res, 'New passwords do not match', 400);
      }

      // Password strength check
      const passwordStrength = checkPasswordStrength(newPassword);
      if (!passwordStrength.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          passwordRequirements: passwordStrength.check,
        });
      }
      const isValidPassword = await user.validatePassword(currentPassword);
      if (!isValidPassword) {
        return errorResponse(res, 'Current password is incorrect', 400);
      }

      const result = await user.changePassword(currentPassword, newPassword);
      await user.logSecurityEvent('password_changed', 'Password changed successfully', 'medium', deviceInfo);
      await ActivityHelper.logAuth(req, 'change-password', 'success', {
        userId: user._id,
        email: user.email,
        loginMethod: 'password',
        tokenGenerated: true,
      });
      NotificationMiddleware.onPasswordChange(req, res, () => {});
      return standardResponse(
        res,
        true,
        {
          passwordChanged: true,
          tokenRevoked: true,
          message: 'Password changed successfully. Please login again.',
        },
        'Password changed successfully'
      );
    } catch (error) {
      console.error('Change password error:', error);
      return errorResponse(res, error.message || 'Failed to change password', 500);
    }
  }

  /**
   * Enable MFA
   */
  static async enableMFA(req, res) {
    try {
      const { method } = req.body;
      const user = req.user;

      // Enable and configure settings on user
      const configResult = await user.enableOTPSetting(method);

      // For app-based (TOTP), also return setup data
      if (method === 'totp') {
        return res.status(200).json({
          success: true,
          message: 'OTP setup initiated with authentication app.',
          setup: configResult.totpSetup, // { qrCode, manualEntryKey, ... }
        });
      }

      res.status(200).json({
        success: true,
        message: `OTP enabled with ${method}.`,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Confirm MFA setup
   */
  static async confirmMFA(req, res) {
    try {
      const { code } = req.body;
      const user = req.user;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Verification code is required',
        });
      }

      const result = await user.confirmMFASetup(code);

      if (result) {
        await user.logAuthEvent('mfa_enabled', req.deviceInfo, true);

        res.status(200).json({
          success: true,
          message: 'MFA enabled successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid verification code',
        });
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Disable MFA
   */
  static async disableMFA(req, res) {
    try {
      const user = req.user;
      const { method } = req.body;
      if (method === 'totp') {
        user.twoFactorAuth = {
          enabled: false,
          secret: null,
          backupCodes: [],
          setupCompleted: false,
          lastUsed: null,
        };
      } else {
        user.otpSettings = {
          ...user.otpSettings,
          enabled: false,
          preferredMethod: null,
        };
      }
      // Clear session
      user.currentOTP = null;

      await user.save();

      res.status(200).json({
        success: true,
        message: 'OTP/2FA disabled',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Initiate password reset
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!email) {
        return errorResponse(res, 'Email is required', 400);
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return errorResponse(res, 'this email is not registered', 404);
      }

      const result = await User.initiatePasswordReset(email, req.deviceInfo);
      await sendEmail(passwordResetRequestTemplate, result.user);
      try {
        console.log(`Password reset token for ${user.email}: ${result.resetToken}`);
      } catch (error) {
        console.error('Failed to send reset email:', error);
      }

      await user.logSecurityEvent('password_reset_requested', 'Password reset requested', 'medium', deviceInfo);

      return standardResponse(res, true, 'If this email is registered, you will receive a password reset link');
    } catch (error) {
      console.error('Forgot password error:', error);
      return errorResponse(res, error.message, 500, error.message);
    }
  }

  /**
   * RESET PASSWORD WITH TOKEN
   */
  static async resetPassword(req, res) {
    try {
      const { email, otpCode, newPassword, confirmPassword } = req.body;
      const { token } = req.params;
      const deviceInfo = DeviceDetector.detectDevice(req);
      if (!token || !newPassword || !confirmPassword) {
        return errorResponse(res, 'Token and password fields are required', 400);
      }

      if (newPassword !== confirmPassword) {
        return errorResponse(res, 'Passwords do not match', 400);
      }

      if (!token || !newPassword) {
        return errorResponse(res, 'Token and new password are required', 400);
      }
      const passwordStrength = checkPasswordStrength(newPassword);
      if (!passwordStrength.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          passwordRequirements: passwordStrength.checks,
        });
      }

      const user = await User.findOne({
        'passwordReset.token': token,
      });

      // const user = await User.findOne({ resetToken: token });
      if (!user) {
        return errorResponse(res, 'Invalid token', 400);
      }

      const isValid = await user.checkResetTokenValidity(token);
      if (!isValid) {
        return errorResponse(res, 'Invalid or expired reset token', 400);
      }
      res.locals.user = user;
      await user.setPassword(newPassword);
      user.resetToken = null;
      user.isVerified = true;
      user.status = 'active';
      user.resetTokenExpiration = null;
      user.passwordReset = {
        token: null,
        tokenExpiry: null,
        attempts: 0,
        lastAttempt: null,
      };
      await user.revokeAllTokens('password_reset');
      await user.save();
      await user.logSecurityEvent('password_reset_completed', 'Password reset completed', 'high', deviceInfo);
      NotificationMiddleware.onPasswordResetDual(req, res, () => {});
      return standardResponse(
        res,
        true,
        {
          passwordReset: true,
          message: 'Password reset successfully. Please login with your new password.',
        },
        'Password reset successfully'
      );
    } catch (error) {
      console.error('Reset password error:', error);
      return errorResponse(res, error.message || 'Failed to reset password', 500);
    }
  }

  /**
   * CONFIRM EMAIL
   */

  static async verifyAccount(req, res) {
    try {
      const user = req.user;
      const deviceInfo = DeviceDetector.detectDevice(req);

      // 0. Account already verified
      if (user.accountVerified) {
        return errorResponse(res, 'Account is already verified.', 400);
      }

      // 1. Priority: Email
      if (user.email && !user.emailVerified) {
        const result = await user.sendEmailVerification(deviceInfo);
        return standardResponse(
          res,
          true,
          {
            verificationType: 'email',
            destination: result.destination,
            expiresAt: result.expiresAt,
          },
          'Email verification sent'
        );
      }

      // 2. Next: OTP
      if (user.otpConfig && user.otpConfig.enableOTP) {
        const result = await user.generateOTP('email_verification', deviceInfo, 'email');
        return standardResponse(
          res,
          true,
          {
            verificationType: 'otp',
            destination: result.destination,
            expiresAt: result.expiresAt,
          },
          'OTP verification initiated'
        );
      }

      // 3. Last: Phone
      if (user.phone && !user.phoneVerified) {
        const result = await user.sendPhoneVerification(deviceInfo);
        return standardResponse(
          res,
          true,
          {
            verificationType: 'phone',
            destination: result.destination,
            expiresAt: result.expiresAt,
          },
          'Phone verification sent'
        );
      }

      return errorResponse(res, 'No valid verification method available.', 400);
    } catch (error) {
      console.error('Verify account error:', error);
      return errorResponse(res, error.message || 'Failed to verify account', 500);
    }
  }

  static async sendEmailVerification(req, res) {
    try {
      const user = req.user;
      const deviceInfo = DeviceDetector.detectDevice(req);

      // if (user.emailVerified) {
      //   return errorResponse(res,
      //     'Email is already verified', 400);
      // }
      await user.sendEmailVerification(deviceInfo);
      await sendEmail(emailVerificationTemplate, user);

      return standardResponse(
        res,
        true,
        {
          verificationSent: true,
        },
        'Email verification sent successfully'
      );
    } catch (error) {
      console.error('Send email verification error:', error);
      return errorResponse(res, error.message || 'Failed to send email verification', 500);
    }
  }

  static async verifyEmail(req, res) {
    try {
      const { token } = req.params;
      const { code } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!token && !code) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required or code is required',
        });
      }
      if (token && code) {
        return res.status(400).json({
          success: false,
          message: 'Verification token and Code Both not able to verify',
        });
      }
      let user = null;

      if (token) {
        // Find user by token (Assuming confirmToken field stores token for email confirmation)
        const now = new Date();
        user = await User.findOne({
          emailVerificationTokens: {
            $elemMatch: {
              token: token,
              purpose: 'email_verification',
              expiresAt: { $gt: now },
            },
          },
        });
        res.locals.user = user;
        if (!user) {
          return errorResponse(res, 'Invalid or expired verification token', 400);
        }
      } else if (code) {
        // When verifying by code, identify user by other means (e.g., email in body or code lookup)
        // Here assuming user provides email for code verification:
        const { email } = req.body;
        if (!email) {
          return res.status(400).json({
            success: false,
            message: 'Email is required to verify code',
          });
        }
        user = await User.findOne({ email });
        if (!user) {
          return errorResponse(res, 'User not found', 404);
        }
      }

      if (code) {
        const isValid = await user.verifyOTP(code, 'email_verification', deviceInfo);

        if (isValid) {
          user.emailVerified = true;
          user.emailVerified = true;
          await user.save();
          await user.logSecurityEvent('email_verified', 'Email address verified', 'low', deviceInfo);

          return standardResponse(
            res,
            true,
            {
              emailVerified: true,
            },
            'Email verified successfully'
          );
        }

        return errorResponse(res, 'Invalid or expired verification code', 400);
      }
      const result = await User.verifyUserEmail(user, token);

      if (result) {
        await user.logSecurityEvent('email_verified', 'Email address verified', 'low', deviceInfo);
        NotificationMiddleware.onEmailVerified(req, res, () => {});
        return standardResponse(
          res,
          true,
          {
            emailVerified: true,
          },
          'Email verified successfully'
        );
      }
    } catch (error) {
      console.error('Verify email error:', error);
      return errorResponse(res, error.message || 'Email verification failed', 500);
    }
  }
  static async confirmEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return errorResponse(res, 'Token is required', 400);
      }

      const user = await User.findOne({ confirmToken: token });
      if (!user) {
        return errorResponse(res, 'Invalid token', 400);
      }

      await user.confirmEmail(token);

      return standardResponse(res, true, null, 'Email confirmed successfully');
    } catch (error) {
      console.error('Confirm email error:', error);
      return errorResponse(res, error.message || 'Failed to confirm email', 400);
    }
  }

  // static async linkSocialAccount(req, res) {
  //   try {
  //     const { provider, providerId, email } = req.body;
  //     const userId = req.user.id; // from JWT middleware

  //     const user = await User.findById(userId);
  //     const linkedAccount = await user.linkSocialAccount(provider, providerId, email, true);

  //     res.json({
  //       success: true,
  //       message: `${provider} account linked successfully`,
  //       account: {
  //         provider: linkedAccount.provider,
  //         email: linkedAccount.email,
  //         connectedAt: linkedAccount.connectedAt,
  //       },
  //     });
  //   } catch (error) {
  //     res.status(400).json({ success: false, message: error.message });
  //   }
  // }

  // static async unlinkSocialAccount(req, res) {
  //   try {
  //     const { provider, providerId } = req.body;
  //     const userId = req.user.id;

  //     const user = await User.findById(userId);
  //     await user.unlinkSocialAccount(provider, providerId);

  //     res.json({
  //       success: true,
  //       message: `${provider} account unlinked successfully`,
  //       socialAccounts: user.getSocialAccounts(),
  //     });
  //   } catch (error) {
  //     res.status(400).json({ success: false, message: error.message });
  //   }
  // }
  /**
   * Get active sessions
   */
  static async getActiveSessions(req, res) {
    try {
      const user = req.user;
      const now = new Date();

      // Filter only valid (non-expired & active) sessions
      const activeSessions = (user.activeSessions || [])
        .filter((session) => session.isActive && session.expiresAt > now)
        .map((session) => ({
          sessionId: session.sessionId,
          deviceId: session.deviceId,
          browser: session.browser || 'Unknown',
          ipAddress: session.ipAddress || 'Unknown',
          userAgent: session.userAgent || 'Unknown',
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt,
          isCurrent: session.sessionId === req.sessionId, // Mark current session
        }));

      return res.status(200).json({
        success: true,
        data: {
          items: activeSessions,
          totalSessions: activeSessions.length,
          maxSessions: user.concurrentSessionLimit || null,
        },
      });
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve active sessions',
      });
    }
  }

  /**
   * Revoke specific session
   */
  static async revokeSession(req, res) {
    try {
      const { tokenId } = req.body;
      const user = req.user;

      if (!tokenId) {
        return res.status(400).json({
          success: false,
          message: 'Token ID is required',
        });
      }

      const tokenData = user.tokens.find((t) => t._id.toString() === tokenId);
      if (!tokenData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found',
        });
      }

      await user.revokeToken(tokenData.token);

      res.status(200).json({
        success: true,
        message: 'Session revoked successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to revoke session',
      });
    }
  }

  /**
   * Get user devices
   */
  static async getDevices(req, res) {
    try {
      const user = req.user;

      const devices = user.devices.map((device) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        location: device.location,
        lastUsed: device.lastUsed,
        isActive: device.isActive,
        isTrusted: device.isTrusted,
        registeredAt: device.registeredAt,
      }));

      res.status(200).json({
        success: true,
        data: { devices },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve devices',
      });
    }
  }

  /**
   * Remove device
   */
  static async removeDevice(req, res) {
    try {
      const { deviceId } = req.body;
      const user = req.user;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: 'Device ID is required',
        });
      }

      await user.removeDevice(deviceId);

      res.status(200).json({
        success: true,
        message: 'Device removed successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to remove device',
      });
    }
  }

  /**
   * Trust device
   */
  static async trustDevice(req, res) {
    try {
      const { deviceId } = req.body;
      const user = req.user;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: 'Device ID is required',
        });
      }

      await user.trustDevice(deviceId);

      res.status(200).json({
        success: true,
        message: 'Device trusted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to trust device',
      });
    }
  }

  // ========================================
  // 📊 OTP SETTINGS MANAGEMENT
  // ========================================

  /**
   * GET OTP SETTINGS
   */
  static async getOTPSettings(req, res) {
    try {
      const user = req.user;

      return standardResponse(
        res,
        true,
        {
          otpEnabled: otpService.isEnabled(),
          userSettings: user.otpSettings,
          availableMethods: user.availableOTPMethods,
          hasActiveTOTP: user.hasActiveTOTP,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          systemDefaults: {
            priorityOrder: process.env.OTP_PRIORITY_ORDER.split(','),
            defaultMethod: process.env.DEFAULT_OTP_METHOD,
          },
        },
        'OTP settings retrieved successfully'
      );
    } catch (error) {
      console.error('Get OTP settings error:', error);
      return errorResponse(res, 'Failed to retrieve OTP settings', 500, error.message);
    }
  }

  /**
   * UPDATE OTP SETTINGS
   */
  static async updateOTPSettings(req, res) {
    try {
      const user = req.user;
      const { preferredMethod, allowFallback, requireForLogin, requireForSensitiveOps } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      const validMethods = ['totp', 'email', 'sms'];
      if (preferredMethod && !validMethods.includes(preferredMethod)) {
        return errorResponse(res, 'Invalid preferred method', 400);
      }

      // Update settings
      if (preferredMethod !== undefined) {
        user.otpSettings.preferredMethod = preferredMethod;
      }
      if (allowFallback !== undefined) {
        user.otpSettings.allowFallback = allowFallback;
      }
      if (requireForLogin !== undefined) {
        user.otpSettings.requireForLogin = requireForLogin;
      }
      if (requireForSensitiveOps !== undefined) {
        user.otpSettings.requireForSensitiveOps = requireForSensitiveOps;
      }

      await user.save();
      await user.logSecurityEvent('otp_settings_updated', 'OTP settings updated', 'low', deviceInfo);

      return standardResponse(
        res,
        true,
        {
          otpSettings: user.otpSettings,
        },
        'OTP settings updated successfully'
      );
    } catch (error) {
      console.error('Update OTP settings error:', error);
      return errorResponse(res, 'Failed to update OTP settings', 500, error.message);
    }
  }

  /**
   * VERIFY USER
   */
  static async verifyUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const verified = await user.verifyUser();

      return standardResponse(res, true, { verified }, 'User verified successfully');
    } catch (error) {
      console.error('Verify user error:', error);
      return errorResponse(res, 'Failed to verify user', 500, error.message);
    }
  }

  // ========================================
  // 👤 PROFILE MANAGEMENT OPERATIONS
  // ========================================

  /**
   * UPDATE PROFILE
   */
  static async updateProfile(req, res) {
    try {
      await req.user.updateProfile(req.body);
      res.locals.changes = req.body;
      NotificationMiddleware.onUserUpdate(req, res, () => {});
      await ActivityHelper.logCRUD(req, 'User', 'update', {
        id: req.user._id,
        role: req.user.role.name,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      });
      return standardResponse(res, true, {}, 'Profile updated successfully');
    } catch (error) {
      console.error('Update profile error:', error);
      return errorResponse(res, 'Failed to update profile', 500, error.message);
    }
  }

  /**
   * UPDATE PROFILE PICTURE
   */
  static async updateProfilePicture(req, res) {
    try {
      const { url } = req.body;

      if (!url) {
        return errorResponse(res, 'Image URL is required', 400);
      }

      const profilePicture = await req.user.updateProfilePicture(req.body);
      NotificationMiddleware.onUserUpdate(req, res, () => {});
      return standardResponse(res, true, { profilePicture }, 'Profile picture updated successfully');
    } catch (error) {
      console.error('Update profile picture error:', error);
      return errorResponse(res, 'Failed to update profile picture', 500, error.message);
    }
  }

  /**
   * UPDATE EMAIL
   */
  static async updateEmail(req, res) {
    try {
      const { id } = req.params;
      const { newEmail } = req.body;

      if (!newEmail) {
        return errorResponse(res, 'New email is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const result = await user.updateEmail(newEmail);

      return standardResponse(res, true, result, 'Email updated successfully');
    } catch (error) {
      console.error('Update email error:', error);
      return errorResponse(res, error.message || 'Failed to update email', 500);
    }
  }

  /**
   * UPDATE PHONE NUMBER
   */
  static async updatePhoneNumber(req, res) {
    try {
      const { id } = req.params;
      const { newPhone } = req.body;

      if (!newPhone) {
        return errorResponse(res, 'Phone number is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const phoneNumber = await user.updatePhoneNumber(newPhone);

      return standardResponse(res, true, { phoneNumber }, 'Phone number updated successfully');
    } catch (error) {
      console.error('Update phone number error:', error);
      return errorResponse(res, error.message || 'Failed to update phone number', 500);
    }
  }

  /**
   * LINK SOCIAL ACCOUNT
   */
  // static async linkSocialAccount(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const { platform, socialId } = req.body;

  //     if (!platform || !socialId) {
  //       return errorResponse(res, 'Platform and social ID are required', 400);
  //     }

  //     const user = await User.findById(id);
  //     if (!user) {
  //       return errorResponse(res, 'User not found', 404);
  //     }

  //     await user.linkSocialAccount(platform, socialId);

  //     return standardResponse(res, true, null, 'Social account linked');
  //   } catch (error) {
  //     console.error('Link social account error:', error);
  //     return errorResponse(res, 'Failed to link social account', 500, error.message);
  //   }
  // }

  /**
   * UNLINK SOCIAL ACCOUNT
   */
  // static async unlinkSocialAccount(req, res) {
  //   try {
  //     const { id } = req.params;
  //     const { platform } = req.body;

  //     if (!platform) {
  //       return errorResponse(res, 'Platform is required', 400);
  //     }

  //     const user = await User.findById(id);
  //     if (!user) {
  //       return errorResponse(res, 'User not found', 404);
  //     }

  //     await user.unlinkSocialAccount(platform);

  //     return standardResponse(res, true, null, 'Social account unlinked');
  //   } catch (error) {
  //     console.error('Unlink social account error:', error);
  //     return errorResponse(res, 'Failed to unlink social account', 500, error.message);
  //   }
  // }

  /**
   * CLEAR ALL SOCIAL LINKS
   */
  static async clearAllSocialLinks(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      const socialMedia = await user.clearAllSocialLinks();

      return standardResponse(res, true, socialMedia, 'All social links cleared');
    } catch (error) {
      console.error('Clear all social links error:', error);
      return errorResponse(res, 'Failed to clear social links', 500, error.message);
    }
  }

  // ========================================
  // 🔐 SESSION & SECURITY OPERATIONS
  // ========================================

  /**
   * INVALIDATE ALL SESSIONS
   */
  static async invalidateAllSessions(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      await user.invalidateAllSessions();

      return standardResponse(res, true, null, 'All sessions invalidated');
    } catch (error) {
      console.error('Invalidate all sessions error:', error);
      return errorResponse(res, 'Failed to invalidate sessions', 500, error.message);
    }
  }

  /**
   * REVOKE TOKEN
   */
  static async revokeToken(req, res) {
    try {
      const { id } = req.params;
      const { token } = req.body;

      if (!token) {
        return errorResponse(res, 'Token is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      await user.revokeToken(token);

      return standardResponse(res, true, null, 'Token revoked');
    } catch (error) {
      console.error('Revoke token error:', error);
      return errorResponse(res, 'Failed to revoke token', 500, error.message);
    }
  }

  // ========================================
  // 🔐 TOTP/2FA MANAGEMENT
  // ========================================

  /**
   * SETUP TOTP/2FA
   */
  static async setupTOTP(req, res) {
    try {
      const user = req.user;

      if (user.hasActiveTOTP) {
        return errorResponse(res, 'TOTP is already enabled for this user', 400);
      }

      const setupData = await user.setupTOTP();

      return standardResponse(
        res,
        true,
        {
          qrCode: setupData.qrCode,
          manualEntryKey: setupData.manualEntryKey,
          instructions: {
            step1: 'Scan the QR code with your authenticator app',
            step2: 'Or manually enter the key in your authenticator app',
            step3: 'Enter the 6-digit code from your app to complete setup',
          },
        },
        'TOTP setup initiated. Scan QR code with your authenticator app.'
      );
    } catch (error) {
      console.error('TOTP setup error:', error);
      return errorResponse(res, error.message || 'TOTP setup failed', 500);
    }
  }

  /**
   * VERIFY TOTP SETUP
   */
  static async verifyTOTPSetup(req, res) {
    try {
      const user = req.user;
      const { code } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!code) {
        return errorResponse(res, 'TOTP code is required', 400);
      }

      const result = await user.verifyTOTPSetup(code);

      if (result.success) {
        await user.logSecurityEvent('totp_setup_completed', 'TOTP authentication enabled', 'medium', deviceInfo);

        return standardResponse(
          res,
          true,
          {
            totpEnabled: true,
            backupCodes: result.backupCodes,
            message: 'TOTP enabled successfully. Save these backup codes in a safe place.',
          },
          'TOTP authentication enabled successfully'
        );
      }

      return errorResponse(res, 'Invalid TOTP code', 400);
    } catch (error) {
      console.error('TOTP verification error:', error);
      return errorResponse(res, error.message || 'TOTP verification failed', 500);
    }
  }

  /**
   * DISABLE TOTP
   */
  static async disableTOTP(req, res) {
    try {
      const user = req.user;
      const { code, confirmDisable = false } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!user.hasActiveTOTP) {
        return errorResponse(res, 'TOTP is not enabled for this user', 400);
      }

      if (!code) {
        return errorResponse(res, 'TOTP code is required to disable 2FA', 400);
      }

      if (!confirmDisable) {
        return errorResponse(res, 'Please confirm that you want to disable 2FA', 400);
      }

      const result = await user.disableTOTP(code);

      if (result.success) {
        await user.logSecurityEvent('totp_disabled', 'TOTP authentication disabled', 'high', deviceInfo);

        return standardResponse(
          res,
          true,
          {
            totpEnabled: false,
          },
          'TOTP authentication disabled successfully'
        );
      }

      return errorResponse(res, 'Invalid TOTP code', 400);
    } catch (error) {
      console.error('TOTP disable error:', error);
      return errorResponse(res, error.message || 'TOTP disable failed', 500);
    }
  }

  /**
   * GENERATE NEW BACKUP CODES
   */
  static async generateBackupCodes(req, res) {
    try {
      const user = req.user;
      const { code } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!user.hasActiveTOTP) {
        return errorResponse(res, 'TOTP is not enabled for this user', 400);
      }

      if (!code) {
        return errorResponse(res, 'TOTP code is required to generate new backup codes', 400);
      }

      // Verify TOTP code
      const isValid = await otpService.verifyTOTP(user, code);
      if (!isValid) {
        return errorResponse(res, 'Invalid TOTP code', 400);
      }

      // Generate new backup codes
      const newBackupCodes = otpService.generateBackupCodes();
      user.twoFactorAuth.backupCodes = newBackupCodes.map((code) => ({
        code: crypto.createHash('sha256').update(code).digest('hex'),
        used: false,
        createdAt: new Date(),
      }));

      await user.save();
      await user.logSecurityEvent('backup_codes_regenerated', 'New backup codes generated', 'medium', deviceInfo);

      return standardResponse(
        res,
        true,
        {
          backupCodes: newBackupCodes,
          message: 'New backup codes generated. Save them in a safe place.',
        },
        'Backup codes regenerated successfully'
      );
    } catch (error) {
      console.error('Backup codes generation error:', error);
      return errorResponse(res, error.message || 'Failed to generate backup codes', 500);
    }
  }

  // ========================================
  // 📱 DEVICE MANAGEMENT
  // ========================================

  /**
   * GET USER DEVICES
   */
  static async getUserDevices(req, res) {
    try {
      const user = req.user;
      const currentDeviceId = DeviceDetector.detectDevice(req).deviceId;

      const devices = user.knownDevices.map((device) => ({
        ...device.toObject(),
        isCurrent: device.deviceId === currentDeviceId,
        activeSessions: user.activeSessions.filter((s) => s.deviceId === device.deviceId && s.isActive).length,
      }));

      return standardResponse(
        res,
        true,
        {
          devices,
          totalDevices: devices.length,
          trustedDevices: devices.filter((d) => d.isTrusted).length,
        },
        'Devices retrieved successfully'
      );
    } catch (error) {
      console.error('Get devices error:', error);
      return errorResponse(res, 'Failed to retrieve devices', 500, error.message);
    }
  }

  /**
   * TRUST DEVICE
   */
  static async trustDevice(req, res) {
    try {
      const user = req.user;
      const { deviceId } = req.body;
      const currentDeviceInfo = DeviceDetector.detectDevice(req);

      if (!deviceId) {
        return errorResponse(res, 'Device ID is required', 400);
      }

      const success = await user.trustDevice(deviceId);

      if (success) {
        return standardResponse(
          res,
          true,
          {
            deviceTrusted: true,
            deviceId,
          },
          'Device trusted successfully'
        );
      }

      return errorResponse(res, 'Device not found', 404);
    } catch (error) {
      console.error('Trust device error:', error);
      return errorResponse(res, 'Failed to trust device', 500, error.message);
    }
  }

  /**
   * REMOVE DEVICE
   */
  static async removeDevice(req, res) {
    try {
      const user = req.user;
      const { deviceId, confirmRemove = false } = req.body;
      const currentDeviceInfo = DeviceDetector.detectDevice(req);

      if (!deviceId) {
        return errorResponse(res, 'Device ID is required', 400);
      }

      if (deviceId === currentDeviceInfo.deviceId && !confirmRemove) {
        return errorResponse(res, 'Cannot remove current device without confirmation', 400);
      }

      const success = await user.removeDevice(deviceId);

      if (success) {
        return standardResponse(
          res,
          true,
          {
            deviceRemoved: true,
            deviceId,
          },
          'Device removed successfully'
        );
      }

      return errorResponse(res, 'Device not found', 404);
    } catch (error) {
      console.error('Remove device error:', error);
      return errorResponse(res, 'Failed to remove device', 500, error.message);
    }
  }

  // ========================================
  // 🔍 SECURITY & MONITORING
  // ========================================

  //Permission

  static async getUserPermissionsController(req, res) {
    try {
      const permissions = await req.user.getPermissions();
      return standardResponse(res, true, permissions, 'Permissions retrieved successfully');
    } catch (error) {
      return errorResponse(res, 'Failed to retrieve permissions', 500, error.message);
    }
  }

  /**
   * GET SECURITY EVENTS
   */
  static async getSecurityEvents(req, res) {
    try {
      const user = req.user;
      const { page = 1, limit = 20, severity, event } = req.query;

      let events = user.securityEvents || [];

      // Filter by severity
      if (severity) {
        events = events.filter((e) => e.severity === severity);
      }

      // Filter by event type
      if (event) {
        events = events.filter((e) => e.event.includes(event));
      }

      // Sort by timestamp (newest first)
      events = events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Pagination
      const start = (page - 1) * limit;
      const paginatedEvents = events.slice(start, start + parseInt(limit));

      return standardResponse(
        res,
        true,
        {
          events: paginatedEvents,
          pagination: {
            currentPage: parseInt(page),
            totalEvents: events.length,
            totalPages: Math.ceil(events.length / limit),
            hasNext: start + parseInt(limit) < events.length,
            hasPrev: page > 1,
          },
        },
        'Security events retrieved successfully'
      );
    } catch (error) {
      console.error('Get security events error:', error);
      return errorResponse(res, 'Failed to retrieve security events', 500, error.message);
    }
  }

  /**
   * GET LOGIN HISTORY
   */
  static async getLoginHistory(req, res) {
    try {
      const user = req.user;
      const { page = 1, limit = 20, successful } = req.query;

      let loginHistory = user.loginHistory || [];

      // Filter by success status
      if (successful !== undefined) {
        loginHistory = loginHistory.filter((h) => h.successful === (successful === 'true'));
      }

      // Sort by login time (newest first)
      loginHistory = loginHistory.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));

      // Pagination
      const start = (page - 1) * limit;
      const paginatedHistory = loginHistory.slice(start, start + parseInt(limit));

      return standardResponse(
        res,
        true,
        {
          loginHistory: paginatedHistory,
          pagination: {
            currentPage: parseInt(page),
            totalLogins: loginHistory.length,
            totalPages: Math.ceil(loginHistory.length / limit),
            hasNext: start + parseInt(limit) < loginHistory.length,
            hasPrev: page > 1,
          },
          stats: {
            totalLogins: loginHistory.length,
            successfulLogins: loginHistory.filter((h) => h.successful).length,
            failedLogins: loginHistory.filter((h) => !h.successful).length,
          },
        },
        'Login history retrieved successfully'
      );
    } catch (error) {
      console.error('Get login history error:', error);
      return errorResponse(res, 'Failed to retrieve login history', 500, error.message);
    }
  }

  /**
   * GET USER SECURITY SUMMARY
   */
  static async getSecuritySummary(req, res) {
    try {
      const user = req.user;

      const securityScore = authController.calculateSecurityScore(user);
      const recentEvents = user.securityEvents?.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5) || [];

      const activeSessions = user.authTokens?.filter((t) => !t.isRevoked && t.expiresAt > new Date()).length || 0;

      const trustedDevices = user.knownDevices?.filter((d) => d.isTrusted).length || 0;

      return standardResponse(
        res,
        true,
        {
          securityScore,
          twoFactorEnabled: user.hasActiveTOTP,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          activeSessions,
          trustedDevices,
          totalDevices: user.knownDevices?.length || 0,
          recentEvents,
          accountLocked: user.isLocked,
          failedLoginAttempts: user.loginSecurity?.failedAttempts || 0,
          lastLogin: user.lastLogin,
          recommendations: authController.getSecurityRecommendations(user),
        },
        'Security summary retrieved successfully'
      );
    } catch (error) {
      console.error('Get security summary error:', error);
      return errorResponse(res, 'Failed to retrieve security summary', 500, error.message);
    }
  }

  /**
   * Generate security recommendations
   */
  static getSecurityRecommendations(user) {
    const recommendations = [];

    if (!user.hasActiveTOTP) {
      recommendations.push({
        type: 'enable_2fa',
        priority: 'high',
        message: 'Enable two-factor authentication for enhanced security',
        action: 'Setup TOTP',
      });
    }

    if (!user.emailVerified) {
      recommendations.push({
        type: 'verify_email',
        priority: 'high',
        message: 'Verify your email address',
        action: 'Verify Email',
      });
    }

    if (!user.phoneVerified && user.phoneNumber) {
      recommendations.push({
        type: 'verify_phone',
        priority: 'medium',
        message: 'Verify your phone number for SMS backup',
        action: 'Verify Phone',
      });
    }

    const untrustedDevices = user.knownDevices?.filter((d) => !d.isTrusted).length || 0;
    if (untrustedDevices > 0) {
      recommendations.push({
        type: 'trust_devices',
        priority: 'medium',
        message: `You have ${untrustedDevices} untrusted device(s)`,
        action: 'Manage Devices',
      });
    }

    const oldSessions =
      user.authTokens?.filter(
        (t) => !t.isRevoked && Date.now() - new Date(t.lastUsed).getTime() > 30 * 24 * 60 * 60 * 1000 // 30 days
      ).length || 0;

    if (oldSessions > 0) {
      recommendations.push({
        type: 'cleanup_sessions',
        priority: 'low',
        message: `You have ${oldSessions} old active session(s)`,
        action: 'Cleanup Sessions',
      });
    }

    return recommendations;
  }

  /**
   * GET OTP ANALYTICS (Admin only)
   */
  static async getOTPAnalytics(req, res) {
    try {
      const { timeframe = '24h' } = req.query;

      // This would typically query your metrics/logging service
      const analytics = await otpService.getOTPStatistics(timeframe);

      return standardResponse(res, true, analytics, 'OTP analytics retrieved successfully');
    } catch (error) {
      console.error('Get OTP analytics error:', error);
      return errorResponse(res, 'Failed to retrieve OTP analytics', 500, error.message);
    }
  }

  /**
   * GET SECURITY REPORT (Admin only)
   */
  static async getSecurityReport(req, res) {
    try {
      const { timeframe = 30 } = req.query;

      const report = await User.getSecurityReport(timeframe);

      return standardResponse(res, true, report, 'Security report retrieved successfully');
    } catch (error) {
      console.error('Get security report error:', error);
      return errorResponse(res, 'Failed to retrieve security report', 500, error.message);
    }
  }
  static async findFullyPopulatedById(req, res) {
    try {
      const user = await User.findFullyPopulatedById(req.user.id);

      return standardResponse(res, true, user, 'Devices retrieved successfully');
    } catch (error) {
      console.error('Get devices error:', error);
      return errorResponse(res, 'Failed to retrieve devices', 500, error.message);
    }
  }

  static async getUserSetting(req, res) {
    try {
      const user = await User.fetchUserSettings(req.user.id);

      return standardResponse(res, true, authController.enrichUser(user), 'Account Setting Fetch successfully');
    } catch (error) {
      console.error('Get devices error:', error);
      return errorResponse(res, 'Failed to retrieve devices', 500, error.message);
    }
  }

  static async getProfile(req, res) {
    try {
      const user = await req.user.getMyProfile();
      return standardResponse(res, true, user, 'Profile Fetch successfully');
    } catch (error) {
      console.error('Get devices error:', error);
      return errorResponse(res, 'Failed to retrieve devices', 500, error.message);
    }
  }
  /**
   * Enable/Disable OTP for user
   * POST /api/otp/toggle
   */
  static async toggleOTP(req, res) {
    try {
      const { enabled, preferredMethod } = req.body;
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
      }

      // Validate preferred method
      const validMethods = ['totp', 'email', 'sms'];
      if (enabled && (!preferredMethod || !validMethods.includes(preferredMethod))) {
        return res.status(400).json({
          success: false,
          message: 'Valid preferred method is required when enabling OTP',
          error: 'INVALID_METHOD',
        });
      }

      if (enabled) {
        // Enable OTP with specified method
        const result = await user.enableOTPSetting(preferredMethod);

        // Log security event
        await user.logSecurityEvent('otp_enabled', `OTP enabled with ${preferredMethod} method`, 'medium', {
          method: preferredMethod,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.status(200).json({
          success: true,
          message: result.message,
          data: {
            otpEnabled: result.otpEnabled,
            preferredMethod: result.preferredMethod,
            twoFactorAuthInitialized: result.twoFactorAuthInitialized,
            totpSetup: result.totpSetup || null,
          },
        });
      } else {
        // Disable OTP
        user.otpSettings.enabled = false;

        // Clear current OTP session
        user.currentOTP = {
          code: null,
          hashedCode: null,
          type: null,
          purpose: null,
          expiresAt: null,
          attempts: 0,
          maxAttempts: 3,
          lastSent: null,
          verified: false,
        };

        // If TOTP was enabled, disable it
        if (user.twoFactorAuth.enabled) {
          user.twoFactorAuth.enabled = false;
          user.twoFactorAuth.secret = null;
          user.twoFactorAuth.setupCompleted = false;
          user.twoFactorAuth.backupCodes = [];
        }

        await user.save();

        // Log security event
        await user.logSecurityEvent('otp_disabled', 'OTP disabled by user', 'high', {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.status(200).json({
          success: true,
          message: 'OTP has been disabled for your account',
          data: {
            otpEnabled: false,
            preferredMethod: null,
          },
        });
      }
    } catch (error) {
      console.error('OTP Toggle Error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to toggle OTP settings',
        error: 'OTP_TOGGLE_FAILED',
      });
    }
  }

  /**
   * Setup OTP (TOTP QR code generation or email/SMS configuration)
   * POST /api/otp/setup
   */
  static async setupOTP(req, res) {
    try {
      const { method } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);
      const userId = req.user.id;

      const user = req.user;

      const otpMethod = method;

      if (method === 'totp') {
        // Setup TOTP
        const setupResult = await otpService.setupTOTP(user);

        await user.logSecurityEvent('totp_setup_initiated', 'TOTP setup initiated', 'medium', {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.status(200).json({
          success: true,
          message: 'TOTP setup initiated. Scan the QR code with your authenticator app.',
          data: {
            qrCode: setupResult.qrCode,
            manualEntryKey: setupResult.manualEntryKey,
            setupUri: setupResult.setupUri,
            method,
          },
        });
      } else if (method === 'email') {
        // Verify email prerequisites
        if (!user.email || !user.emailVerified) {
          return res.status(400).json({
            success: false,
            message: 'Email must be verified before setting up email OTP',
            error: 'EMAIL_NOT_VERIFIED',
          });
        }
        const setupResult = await otpService.generateEmailOTP(user, 'setup_verification', deviceInfo);
        return res.status(200).json({
          success: true,
          message: 'Email OTP is ready to use',
          data: {
            method: 'email',
            destination: otpService.maskEmail(user.email),
            ready: true,
          },
        });
      } else if (method === 'sms') {
        // Verify SMS prerequisites
        if (!user.phoneNumber || !user.phoneVerified) {
          return res.status(400).json({
            success: false,
            message: 'Phone number must be verified before setting up SMS OTP',
            error: 'PHONE_NOT_VERIFIED',
          });
        }
        const setupResult = await otpService.generateSMSOTP(user, 'setup_verification', deviceInfo);
        return res.status(200).json({
          success: true,
          message: 'SMS OTP is ready to use',
          data: {
            method: 'sms',
            destination: otpService.maskPhone(user.phoneNumber),
            ready: true,
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP method specified',
          error: 'INVALID_METHOD',
        });
      }
    } catch (error) {
      console.error('OTP Setup Error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to setup OTP',
        error: 'OTP_SETUP_FAILED',
      });
    }
  }

  /**
   * Complete TOTP setup with verification token
   * POST /api/otp/setup/verify
   */
  static async verifySetup(req, res) {
    const deviceInfo = DeviceDetector.detectDevice(req);

    try {
      const { token } = req.body;
      const userId = req.user.id;

      if (!token || token.length !== 6) {
        return res.status(400).json({
          success: false,
          message: 'Valid 6-digit TOTP token is required',
          error: 'INVALID_TOKEN_FORMAT',
        });
      }

      const user = await User.findById(userId);

      const result = await user.verify2FASetup(token, req.body.method, deviceInfo);

      await user.logSecurityEvent('OTP_setup_completed', 'OTP setup completed successfully', 'medium', {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      NotificationMiddleware.onTwoFactorEnabled(req, res, () => {});
      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          backupCodes: result.backupCodes,
          totpEnabled: true,
        },
      });
    } catch (error) {
      console.error('OTP Setup Verification Error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'TOTP setup verification failed',
        error: 'TOTP_VERIFICATION_FAILED',
      });
    }
  }

  /**
   * Send/Resend OTP
   * POST /api/otp/send
   */
  static async sendOTP(req, res) {
    try {
      const { purpose = 'login', method } = req.body;
      const userId = req.user.id;

      const user = await User.findById(userId);
      // if (!user) {
      //   return res.status(404).json({
      //     success: false,
      //     message: 'User not found',
      //     error: 'USER_NOT_FOUND'
      //   });
      // }

      // if (!user.otpSettings.enabled) {
      //   return res.status(400).json({
      //     success: false,
      //     message: 'OTP is not enabled for this account',
      //     error: 'OTP_NOT_ENABLED'
      //   });
      // }

      const deviceInfo = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceId: req.headers['x-device-id'] || 'unknown',
      };

      // Use specified method or user's preferred method
      const otpMethod = method || user.otpSettings.preferredMethod;

      const result = await otpService.sendOTP(user, purpose, deviceInfo, otpMethod);

      return res.status(200).json({
        success: true,
        message: result.type === 'totp' ? 'Use your authenticator app to get the verification code' : `OTP sent to ${result.destination}`,
        data: {
          type: result.type,
          destination: result.destination,
          expiresAt: result.expiresAt,
          messageId: result.messageId || null,
        },
      });
    } catch (error) {
      console.error('Send OTP Error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to send OTP',
        error: 'OTP_SEND_FAILED',
      });
    }
  }

  /**
   * Verify OTP code
   * POST /api/otp/verify
   */
  static async verifyOTP(req, res) {
    try {
      const { code, purpose = 'login' } = req.body;
      const userId = req.user.id;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'OTP code is required',
          error: 'CODE_REQUIRED',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
      }

      const deviceInfo = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceId: req.headers['x-device-id'] || 'unknown',
      };

      const isValid = await otpService.verifyOTP(user, code, purpose, deviceInfo);

      if (isValid) {
        // Mark OTP as verified for this session
        req.session.otpVerified = true;
        req.session.otpVerifiedAt = new Date();
        req.session.otpPurpose = purpose;

        return res.status(200).json({
          success: true,
          message: 'OTP verified successfully',
          data: {
            verified: true,
            purpose: purpose,
            verifiedAt: new Date(),
          },
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP code',
          error: 'INVALID_OTP',
        });
      }
    } catch (error) {
      console.error('Verify OTP Error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'OTP verification failed',
        error: 'OTP_VERIFICATION_FAILED',
      });
    }
  }

  /**
   * Disable OTP (requires current OTP verification)
   * POST /api/otp/disable
   */
  static async disableOTP(req, res) {
    try {
      const { token, confirmationCode } = req.body;
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
      }

      if (!user.otpSettings.enabled) {
        return res.status(400).json({
          success: false,
          message: 'OTP is not currently enabled',
          error: 'OTP_NOT_ENABLED',
        });
      }

      // For TOTP, require token verification
      if (user.otpSettings.preferredMethod === 'totp' && user.twoFactorAuth.enabled) {
        if (!token) {
          return res.status(400).json({
            success: false,
            message: 'TOTP token is required to disable authentication app',
            error: 'TOKEN_REQUIRED',
          });
        }

        const result = await user.disableTOTP(token);
        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: 'Invalid TOTP token',
            error: 'INVALID_TOKEN',
          });
        }
      }

      // For email/SMS, require confirmation code
      if (['email', 'sms'].includes(user.otpSettings.preferredMethod)) {
        if (!confirmationCode) {
          // Send confirmation code first
          const deviceInfo = {
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            deviceId: req.headers['x-device-id'] || 'unknown',
          };

          await otpService.sendOTP(user, 'disable_otp', deviceInfo);

          return res.status(200).json({
            success: false,
            message: 'Confirmation code sent. Please provide the code to disable OTP.',
            requiresConfirmation: true,
            error: 'CONFIRMATION_REQUIRED',
          });
        }

        // Verify confirmation code
        const deviceInfo = {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          deviceId: req.headers['x-device-id'] || 'unknown',
        };

        const isValid = await otpService.verifyOTP(user, confirmationCode, 'disable_otp', deviceInfo);
        if (!isValid) {
          return res.status(400).json({
            success: false,
            message: 'Invalid confirmation code',
            error: 'INVALID_CONFIRMATION_CODE',
          });
        }
      }

      // Disable OTP
      user.otpSettings.enabled = false;
      user.otpSettings.preferredMethod = 'totp';
      user.otpSettings.allowFallback = false;

      // Clear current OTP
      user.currentOTP = {
        code: null,
        hashedCode: null,
        type: null,
        purpose: null,
        expiresAt: null,
        attempts: 0,
        maxAttempts: 3,
        lastSent: null,
        verified: false,
      };

      // Clear TOTP if enabled
      if (user.twoFactorAuth.enabled) {
        user.twoFactorAuth.enabled = false;
        user.twoFactorAuth.secret = null;
        user.twoFactorAuth.setupCompleted = false;
        user.twoFactorAuth.backupCodes = [];
      }

      await user.save();

      await user.logSecurityEvent('otp_disabled', 'OTP completely disabled', 'high', {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      NotificationMiddleware.onTwoFactorDisabled(req, res, () => {});
      return res.status(200).json({
        success: true,
        message: 'OTP has been disabled for your account',
        data: {
          otpEnabled: false,
        },
      });
    } catch (error) {
      console.error('Disable OTP Error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to disable OTP',
        error: 'OTP_DISABLE_FAILED',
      });
    }
  }

  /**
   * Get OTP status and available methods
   * GET /api/otp/status
   */
  static async getOTPStatus(req, res) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND',
        });
      }

      const availableMethods = otpService.getAvailableMethods(user);

      return res.status(200).json({
        success: true,
        data: {
          enabled: user.otpSettings.enabled || false,
          preferredMethod: user.otpSettings.preferredMethod || 'totp',
          requireForLogin: user.otpSettings.requireForLogin || false,
          requireForSensitiveOps: user.otpSettings.requireForSensitiveOps || true,
          availableMethods: availableMethods,
          totpConfigured: user.twoFactorAuth?.setupCompleted || false,
          backupCodesRemaining: user.twoFactorAuth?.backupCodes?.filter((bc) => !bc.used).length || 0,
        },
      });
    } catch (error) {
      console.error('Get OTP Status Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get OTP status',
        error: 'OTP_STATUS_FAILED',
      });
    }
  }

  /**
   * Initialize social login (redirect to provider)
   */
  static async initiateSocialLogin(req, res, next) {
    const { provider } = req.params;
    const validProviders = ['google', 'facebook', 'twitter', 'github'];

    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid social provider',
      });
    }

    // Store device info in session for later use
    req.session.deviceInfo = {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      deviceId: crypto.randomBytes(16).toString('hex'),
      timestamp: new Date(),
    };

    // Initiate passport authentication
    passport.authenticate(provider, {
      scope: getScopeForProvider(provider),
    })(req, res, next);
  }

  /**
   * Handle social login callback
   */
  static async handleSocialCallback(req, res, next) {
    const { provider } = req.params;

    passport.authenticate(provider, { session: false }, async (err, socialData, info) => {
      try {
        if (err) {
          console.error('Social auth error:', err);
          return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
        }

        if (!socialData) {
          return res.redirect(`${process.env.CLIENT_URL}/login?error=access_denied`);
        }

        // Get device info from session
        const deviceInfo = req.session.deviceInfo || {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          deviceId: crypto.randomBytes(16).toString('hex'),
        };

        // Authenticate or create user
        const { user, isNewUser } = await User.authenticateViaSocial(socialData, deviceInfo);

        // Generate tokens
        const tokens = await user.generateTokens(deviceInfo);

        // Clear device info from session
        delete req.session.deviceInfo;

        // Redirect with tokens
        const redirectUrl = `${process.env.CLIENT_URL}/auth/callback?` + `token=${tokens.accessToken}&` + `refresh=${tokens.refreshToken}&` + `new_user=${isNewUser}`;

        res.redirect(redirectUrl);
      } catch (error) {
        console.error('Social callback error:', error);
        res.redirect(`${process.env.CLIENT_URL}/login?error=processing_failed`);
      }
    })(req, res, next);
  }

  /**
   * Link additional social account to existing user
   */
  static async linkSocialAccount(req, res) {
    try {
      const { provider } = req.params;
      const user = req.user; // From auth middleware

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      req.session = {
        linkingUserId: user._id.toString(),
        isLinking: true,
      };
      // Store user ID in session for linking after OAuth
      // req.session.linkingUserId = user._id.toString();
      // req.session.isLinking = true;

      // Initiate OAuth flow
      passport.authenticate(provider, {
        scope: getScopeForProvider(provider),
      })(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to initiate social account linking',
        error: error.message,
      });
    }
  }

  /**
   * Handle social account linking callback
   */
  static async handleLinkingCallback(req, res, next) {
    const { provider } = req.params;

    passport.authenticate(provider, { session: false }, async (err, socialData, info) => {
      try {
        if (err || !socialData) {
          return res.redirect(`${process.env.CLIENT_URL}/profile?link_error=failed`);
        }

        const userId = req.session.linkingUserId;
        if (!userId) {
          return res.redirect(`${process.env.CLIENT_URL}/profile?link_error=session_expired`);
        }

        const user = await User.findById(userId);
        if (!user) {
          return res.redirect(`${process.env.CLIENT_URL}/profile?link_error=user_not_found`);
        }

        // Link the social account
        await user.linkSocialAccount(socialData.provider, socialData.providerId, socialData.email, true);

        // Clear session
        delete req.session.linkingUserId;
        delete req.session.isLinking;

        res.redirect(`${process.env.CLIENT_URL}/profile?link_success=${provider}`);
      } catch (error) {
        console.error('Social linking error:', error);
        res.redirect(`${process.env.CLIENT_URL}/profile?link_error=processing_failed`);
      }
    })(req, res, next);
  }

  /**
   * Unlink social account
   */
  static async unlinkSocialAccount(req, res) {
    try {
      const { provider } = req.params;
      const user = req.user;

      const unlinkedAccount = await user.unlinkSocialAccount(provider, null);

      res.json({
        success: true,
        message: `${provider} account unlinked successfully`,
        unlinkedAccount: {
          provider: unlinkedAccount.provider,
          email: unlinkedAccount.email,
          connectedAt: unlinkedAccount.connectedAt,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get user's linked social accounts
   */
  static async getLinkedAccounts(req, res) {
    try {
      const user = req.user;
      const linkedAccounts = user.getSocialAccounts();

      return standardResponse(
        res,
        true,
        {
          linkedAccounts,
          availableProviders: ['google', 'facebook', 'twitter', 'github'],
        },
        'Security events retrieved successfully'
      );
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch linked accounts',
        error: error.message,
      });
    }
  }

  /**
   * Check social account status
   */
  static async checkSocialStatus(req, res) {
    try {
      const { provider } = req.params;
      const user = req.user;

      const hasProvider = user.hasSocialProvider(provider);
      const socialAccount = user.getSocialAccount(provider);

      res.json({
        success: true,
        hasProvider,
        accountInfo: socialAccount
          ? {
              provider: socialAccount.provider,
              email: socialAccount.email,
              verified: socialAccount.verified,
              connectedAt: socialAccount.connectedAt,
            }
          : null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to check social status',
        error: error.message,
      });
    }
  }

  // Get user's paginated trusted devices
  static async getTrustedDevices(req, res) {
    try {
      const options = req.query;
      const result = await req.user.getPaginatedTrustedDevices(options);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get user's paginated security logs
  static async getSecurityLogs(req, res) {
    try {
      const options = req.query;
      const result = await req.user.getPaginatedSecurityLogs(options);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get user's paginated login history
  static async getLoginHistory(req, res) {
    try {
      const options = req.query;
      const result = await req.user.getPaginatedLoginHistory(options);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get user's paginated active sessions
  static async getAllActiveSessions(req, res) {
    try {
      const options = req.query;
      const result = await req.user.getPaginatedActiveSessions(options);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // Get user's paginated known devices
  static async getKnownDevices(req, res) {
    try {
      const options = req.query;
      const result = await req.user.getPaginatedKnownDevices(options);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async addAddress(req, res) {
    try {
      const addresses = await req.user.addAddress(req.body);
      await ActivityHelper.logCRUD(req, 'addresses', 'create', {
        id: addresses._id,
        status: addresses.status,
      });
      return standardResponse(res, true, addresses, 'Address added successfully');
    } catch (error) {
      console.error('Add address error:', error);
      return errorResponse(res, 'Failed to add address', 500, error.message);
    }
  }

  static async removeAddress(req, res) {
    try {
      const { addressId } = req.params;

      if (!addressId) {
        return errorResponse(res, 'Address ID is required', 400);
      }

      const addresses = await req.user.removeAddress(addressId);
      await ActivityHelper.logCRUD(req, 'addresses', 'delete', {
        id: addresses._id,
        status: addresses.status,
      });
      return standardResponse(res, true, addresses, 'Address removed successfully');
    } catch (error) {
      console.error('Remove address error:', error);
      return errorResponse(res, 'Failed to remove address', 500, error.message);
    }
  }

  static async updateAddress(req, res) {
    try {
      const { addressId } = req.params;

      if (!addressId) {
        return errorResponse(res, 'Address ID is required', 400);
      }

      const addresses = await req.user.updateAddress(addressId, req.body);
      await ActivityHelper.logCRUD(req, 'addresses', 'update', {
        id: addresses._id,
        status: addresses.status,
      });
      return standardResponse(res, true, addresses, 'Address updated successfully');
    } catch (error) {
      console.error('Remove address error:', error);
      return errorResponse(res, 'Failed to remove address', 500, error.message);
    }
  }

  /**
   * SET DEFAULT ADDRESS
   */
  static async setDefaultAddress(req, res) {
    try {
      if (!addressId) {
        return errorResponse(res, 'Address ID is required', 400);
      }

      const addresses = await req.user.setDefaultAddress(addressId);
      await ActivityHelper.logCRUD(req, 'addresses', 'update', {
        id: addresses._id,
        status: addresses.status,
      });
      return standardResponse(res, true, addresses, 'Default address set');
    } catch (error) {
      console.error('Set default address error:', error);
      return errorResponse(res, 'Failed to set default address', 500, error.message);
    }
  }
}
/**
 * Get OAuth scopes for each provider
 */

function getScopeForProvider(provider) {
  const scopes = {
    google: ['profile', 'email'],
    facebook: ['email', 'public_profile'],
    twitter: ['tweet.read', 'users.read'],
    github: ['user:email', 'read:user'],
  };
  return scopes[provider] || [];
}
module.exports = authController;
