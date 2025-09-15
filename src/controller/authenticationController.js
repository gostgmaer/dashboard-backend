const User = require('../models/user');
const Order = require('../models/orders');
const Product = require('../models/products');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');
const crypto = require('crypto');
const { APIError, formatResponse } = require('../utils/apiUtils');
// const { welcomeEmailTemplate } = require('../email/emailTemplates');
const { sendEmail } = require('../email');
const { checkPasswordStrength } = require('../utils/security');
const DeviceDetector = require('../services/DeviceDetector');
const otpService = require('../services/otpService');
const { emailVerificationTemplate,welcomeEmailTemplate } = require('../email/emailTemplate');

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

  static standardResponse(res, success, data, message, statusCode = 200, meta = {}) {
    return res.status(statusCode).json({
      success,
      data,
      message,
      ...meta,
    });
  }

  static errorResponse(res, message, statusCode = 500, error = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
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
    if (user.hash_password) score += 10; // Has password set
    return Math.min(score, 100);
  }

  // ========================================
  // 🔐 AUTHENTICATION OPERATIONS
  // ========================================

  //Register User

  static async registerUser(req, res) {
    // Validate incoming request data via express-validator middleware
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, username, password, confirmPassword, ...otherData } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      // Validation
      if (!email || !username || !password) {
        return authController.errorResponse(res,
          'Email, username, and password are required', 400);
      }

      if (password !== confirmPassword) {
        return authController.errorResponse(res,
          'Passwords do not match', 400);
      }

      // Password strength check
      const passwordStrength = checkPasswordStrength(password);
      if (!passwordStrength.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          passwordRequirements: passwordStrength.checks,
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
      if (otpService.isEnabled()) {
        verificationResult = await user.generateOTP('email_verification', deviceInfo, 'email');
      }

      // Send welcome email
      let emaildata = await sendEmail(welcomeEmailTemplate, user);

      await user.logSecurityEvent('user_registered', 'New user registration', 'low', deviceInfo);

      if (emaildata.success) {
        // Return response
        return authController.standardResponse(res, true, {
          user: {
            email: user.email,
            username: user.username,
            status: user.status
          },
          otpEnabled: otpService.isEnabled(),
          verificationRequired: user.status === 'pending',
          verificationSent: !!verificationResult
        }, 'Registration successful', 201);
      }
      else {
        return authController.errorResponse(res,
          'Registration successful but failed to send welcome email', 500, emaildata.error);
      }

    }
    catch (err) {
      // Handle errors (e.g., duplicate keys, validation)
      console.error('Registration error:', err);
      return authController.errorResponse(res,
        err.message, 500, err);
    }
  }

  /**
   * LOGIN USER
   */
  static async login(req, res) {
    try {
      const { identifier, password, deviceTrust = false } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!identifier || !password) {
        return authController.errorResponse(res, 'Email/username and password are required', 400);
      }
      // Authenticate user
      const authResult = await User.authenticateUser(identifier, password, deviceInfo);
      let user = authResult.user;
      user.verificationLink="asdasdad"
      if (!user.emailVerified) {
         await sendEmail(emailVerificationTemplate, user);
        
      }

      // const user = await User.findByEmail(email);
      if (!user) {
        return authController.errorResponse(res, 'Invalid Email/username or password', 401);
      }

      // Check if MFA/OTP is required
      if (authResult.requiresMFA) {
        // Check if device is trusted and user allows skip
        const trustedDevice = user.knownDevices?.find(d =>
          d.deviceId === deviceInfo.deviceId && d.isTrusted
        );

        if (trustedDevice && user.otpSettings.allowTrustedDeviceSkip) {
          // Skip OTP for trusted device
          await user.handleSuccessfulLogin(deviceInfo);
          const tokens = await user.generateTokens(deviceInfo);

          return authController.standardResponse(res, true, {
            user: {
              id: user._id,
              email: user.email,
              username: user.username,
              fullName: user.fullName,
              role: user.role?.name,
              isVerified: user.isVerified,
              hasActiveTOTP: user.hasActiveTOTP
            },
            tokens,
            skipMFA: true,
            trustedDevice: true
          }, 'Login successful - trusted device');
        }

        // Generate temporary token for MFA step
        const tempTokenPayload = {
          userId: user._id,
          step: 'mfa_required',
          deviceId: deviceInfo.deviceId,
          exp: Math.floor(Date.now() / 1000) + (10 * 60) // 10 minutes
        };
        const tempToken = jwt.sign(tempTokenPayload, process.env.JWT_SECRET);

        // Send OTP using best available method
        let otpResult = null;
        try {
          otpResult = await user.generateOTP('login', deviceInfo);
        } catch (error) {
          console.error('OTP generation failed:', error);
        }

        return authController.standardResponse(res, true, {
          requiresMFA: true,
          availableMethods: authResult.availableMethods,
          tempToken,
          otpSent: !!otpResult,
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            hasActiveTOTP: user.hasActiveTOTP
          }
        }, 'MFA verification required', 200);
      }

      const tokens = await user.generateTokens(deviceInfo);
      if (deviceTrust) {
        await user.trustDevice(deviceInfo.deviceId);
      }

      return authController.standardResponse(
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
            hasActiveTOTP: user.hasActiveTOTP
          },
          tokens,
          requiresMFA: false,
        },
        'Login successful'
      );
    } catch (error) {
      console.error('Login error:', error);
      return authController.errorResponse(res, error.message, 500, error.message);
    }
  }

  /**
   * VERIFY OTP and complete login
   */
  static async verifyOTPAndLogin(req, res) {
    try {
      const { tempToken, otpCode, deviceTrust = false } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!tempToken || !otpCode) {
        return authController.errorResponse(res,
          'Temporary token and OTP code are required', 400);
      }

      // Verify temporary token
      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        if (decoded.step !== 'mfa_required') {
          throw new Error('Invalid token step');
        }
      } catch (error) {
        return authController.errorResponse(res,
          'Invalid or expired temporary token', 400);
      }

      // Find user
      const user = await User.findById(decoded.userId).populate('role');
      if (!user) {
        return authController.errorResponse(res,
          'User not found', 404);
      }

      // Verify OTP
      const otpValid = await user.verifyOTP(otpCode, 'login', deviceInfo);
      if (!otpValid) {
        return authController.errorResponse(res,
          'Invalid or expired OTP code', 400);
      }

      // Complete authentication
      await user.handleSuccessfulLogin(deviceInfo);
      const tokens = await user.generateTokens(deviceInfo);

      // Trust device if requested
      if (deviceTrust) {
        await user.trustDevice(deviceInfo.deviceId);
      }

      return authController.standardResponse(res, true, {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role?.name,
          isVerified: user.isVerified,
          hasActiveTOTP: user.hasActiveTOTP
        },
        tokens,
        deviceTrusted: deviceTrust
      }, 'Authentication successful');

    } catch (error) {
      console.error('OTP verification error:', error);
      return authController.errorResponse(res,
        error.message || 'OTP verification failed', 400);
    }
  }

  /**
 * RESEND OTP
 */
  static async resendOTP(req, res) {
    try {
      const { tempToken, method } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!tempToken) {
        return authController.errorResponse(res,
          'Temporary token is required', 400);
      }

      // Verify temporary token
      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      } catch (error) {
        return authController.errorResponse(res,
          'Invalid or expired temporary token', 400);
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return authController.errorResponse(res,
          'User not found', 404);
      }

      // Generate new OTP
      const otpResult = await user.generateOTP('login', deviceInfo, method);

      return authController.standardResponse(res, true, {
        otpSent: true,
        method: otpResult.type,
        destination: otpResult.destination,
        expiresAt: otpResult.expiresAt
      }, 'OTP resent successfully');

    } catch (error) {
      console.error('Resend OTP error:', error);
      return authController.errorResponse(res,
        error.message || 'Failed to resend OTP', 500);
    }
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

      // Revoke current token
      await user.revokeToken(token);

      // Log logout event
      if (token) {
        await user.revokeToken(token, 'user_logout');
      }

      await user.logSecurityEvent('logout', 'User logout', 'low', deviceInfo);

      return authController.standardResponse(res, true, null,
        'Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      return authController.errorResponse(res,
        'Logout failed', 500, error.message);

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


      return authController.standardResponse(res, true, null,
        'Logged out from all devices successfully');
    } catch (error) {
      console.error('Logout all error:', error);
      return authController.errorResponse(res,
        'Failed to logout from all devices', 500, error.message);

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
        return authController.errorResponse(res,
          'Refresh token is required', 400);
      }

      // Verify and decode refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return authController.errorResponse(res,
          'Invalid or expired refresh token', 401);
      }


      const user = await User.findById(decoded.userId);
      if (!user) {
        return authController.errorResponse(res,
          'User not found', 404);
      }
      // Generate new tokens
      const tokens = await user.refreshAccessToken(refreshToken);

      return authController.standardResponse(res, true, tokens,
        'Token refreshed successfully');

    } catch (error) {
      console.error('Token refresh error:', error);
      return authController.errorResponse(res,
        error.message || 'Token refresh failed', 401);
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
      const { code, purpose = 'login' } = req.body;
      const user = req.user;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'OTP code is required',
        });
      }

      const isValid = await user.verifyOTP(code, purpose, req.deviceInfo);

      if (isValid) {
        res.status(200).json({
          success: true,
          message: 'OTP verified successfully',
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP code',
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
   * CHANGE PASSWORD
   */
  static async changePassword(req, res) {
    try {
      const user = req.user;
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!currentPassword || !newPassword || !confirmPassword) {
        return authController.errorResponse(res,
          'All password fields are required', 400);
      }

      if (newPassword !== confirmPassword) {
        return authController.errorResponse(res,
          'New passwords do not match', 400);
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
        return authController.errorResponse(res,
          'Current password is incorrect', 400);
      }

      const result = await user.changePassword(currentPassword, newPassword);
      await user.logSecurityEvent('password_changed',
        'Password changed successfully', 'medium', deviceInfo);

      return authController.standardResponse(res, true, {
        passwordChanged: true,
        tokenRevoked: true,
        message: 'Password changed successfully. Please login again.'
      }, 'Password changed successfully');

    } catch (error) {
      console.error('Change password error:', error);
      return authController.errorResponse(res,
        error.message || 'Failed to change password', 500);
    }
  }

  /**
   * Enable MFA
   */
  static async enableMFA(req, res) {
    try {
      const { method = 'totp' } = req.body;
      const user = req.user;

      if (user.mfaEnabled) {
        return res.status(400).json({
          success: false,
          message: 'MFA is already enabled',
        });
      }

      const mfaSetup = await user.enableMFA(method);

      res.status(200).json({
        success: true,
        message: 'MFA setup initiated',
        data: mfaSetup,
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
      const { code } = req.body;
      const user = req.user;

      if (!user.mfaEnabled) {
        return res.status(400).json({
          success: false,
          message: 'MFA is not enabled',
        });
      }

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Verification code is required',
        });
      }

      const result = await user.disableMFA(code);

      if (result) {
        await user.logAuthEvent('mfa_disabled', req.deviceInfo, true);

        res.status(200).json({
          success: true,
          message: 'MFA disabled successfully',
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
   * Initiate password reset
   */
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (!email) {
        return authController.errorResponse(res, 'Email is required', 400);
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return authController.errorResponse(res, 'this email is not registered', 404);
      }

      const result = await User.initiatePasswordReset(email, req.deviceInfo);
      // Send reset email (implement your email service)
      try {
        // await sendPasswordResetEmail(user.email, resetToken);
        console.log(`Password reset token for ${user.email}: ${result.resetToken}`);
      } catch (error) {
        console.error('Failed to send reset email:', error);
      }

      await user.logSecurityEvent('password_reset_requested',
        'Password reset requested', 'medium', deviceInfo);

      return authController.standardResponse(res, true, result,
        'If this email is registered, you will receive a password reset link');

    } catch (error) {
      console.error('Forgot password error:', error);
      return authController.errorResponse(res,
        error.message, 500, error.message);
    }
  }

  /**
   * RESET PASSWORD WITH TOKEN
   */
  static async resetPassword(req, res) {
    try {
      const { email, otpCode, newPassword, confirmPassword } = req.body;
      const { token } = req.params
      const deviceInfo = DeviceDetector.detectDevice(req);
      if (!token || !newPassword || !confirmPassword) {
        return authController.errorResponse(res,
          'Token and password fields are required', 400);
      }

      if (newPassword !== confirmPassword) {
        return authController.errorResponse(res,
          'Passwords do not match', 400);
      }

      if (!token || !newPassword) {
        return authController.errorResponse(res, 'Token and new password are required', 400);
      }
      const passwordStrength = checkPasswordStrength(newPassword);
      if (!passwordStrength.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          passwordRequirements: passwordStrength.checks
        });
      }

      const user = await User.findOne({
        'passwordReset.token': token
      });

      // const user = await User.findOne({ resetToken: token });
      if (!user) {
        return authController.errorResponse(res, 'Invalid token', 400);
      }

      const isValid = await user.checkResetTokenValidity(token);
      if (!isValid) {
        return authController.errorResponse(res, 'Invalid or expired reset token', 400);
      }

      await user.setPassword(newPassword);
      user.resetToken = null;
      user.resetTokenExpiration = null;
      user.passwordReset = {
        token: null,
        tokenExpiry: null,
        attempts: 0,
        lastAttempt: null
      };
      await user.revokeAllTokens('password_reset');
      await user.save();
      await user.logSecurityEvent('password_reset_completed',
        'Password reset completed', 'high', deviceInfo);


      return authController.standardResponse(res, true, {
        passwordReset: true,
        message: 'Password reset successfully. Please login with your new password.'
      }, 'Password reset successfully');

    } catch (error) {
      console.error('Reset password error:', error);
      return authController.errorResponse(res,
        error.message || 'Failed to reset password', 500);
    }
  }

  /**
   * CONFIRM EMAIL
   */

  static async sendEmailVerification(req, res) {
    try {
      const user = req.user;
      const deviceInfo = DeviceDetector.detectDevice(req);

      if (user.emailVerified) {
        return authController.errorResponse(res,
          'Email is already verified', 400);
      }

      const result = await user.generateOTP('email_verification', deviceInfo, 'email');

      return authController.standardResponse(res, true, {
        verificationSent: true,
        destination: result.destination,
        expiresAt: result.expiresAt
      }, 'Email verification sent successfully');

    } catch (error) {
      console.error('Send email verification error:', error);
      return authController.errorResponse(res,
        error.message || 'Failed to send email verification', 500);
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
        user = await User.findOne({ emailVerificationToken: token });
        if (!user) {
          return authController.errorResponse(res, 'Invalid or expired verification token', 400);
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
          return authController.errorResponse(res, 'User not found', 404);
        }
      }


      if (user.emailVerified) {
        return authController.errorResponse(res,
          'Email is already verified', 400);
      }


      if (code) {
        const isValid = await user.verifyOTP(code, 'email_verification', deviceInfo);

        if (isValid) {
          user.emailVerified = true;
          await user.save();
          await user.logSecurityEvent('email_verified',
            'Email address verified', 'low', deviceInfo);

          return authController.standardResponse(res, true, {
            emailVerified: true
          }, 'Email verified successfully');
        }

        return authController.errorResponse(res,
          'Invalid or expired verification code', 400);
      }
      const result = await User.verifyUserEmail(token);

      if (result) {
        await user.logSecurityEvent('email_verified',
          'Email address verified', 'low', deviceInfo);

        return authController.standardResponse(res, true, {
          emailVerified: true
        }, 'Email verified successfully');
      }

    } catch (error) {
      console.error('Verify email error:', error);
      return authController.errorResponse(res,
        error.message || 'Email verification failed', 500);
    }
  }
  static async confirmEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return authController.errorResponse(res, 'Token is required', 400);
      }

      const user = await User.findOne({ confirmToken: token });
      if (!user) {
        return authController.errorResponse(res, 'Invalid token', 400);
      }

      await user.confirmEmail(token);

      return authController.standardResponse(res, true, null, 'Email confirmed successfully');
    } catch (error) {
      console.error('Confirm email error:', error);
      return authController.errorResponse(res, error.message || 'Failed to confirm email', 400);
    }
  }

  /**
   * Get active sessions
   */
  static async getActiveSessions(req, res) {
    try {
      const user = req.user;
      const now = new Date();

      const activeSessions = user.tokens
        .filter((token) => !token.isRevoked && token.expiresAt > now)
        .map((token) => ({
          tokenId: token._id,
          deviceId: token.deviceId,
          ipAddress: token.ipAddress,
          createdAt: token.createdAt,
          expiresAt: token.expiresAt,
          isCurrent: token.token === req.token,
        }));

      res.status(200).json({
        success: true,
        data: {
          activeSessions,
          totalSessions: activeSessions.length,
          maxSessions: user.concurrentSessionLimit,
        },
      });
    } catch (error) {
      res.status(500).json({
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

      return authController.standardResponse(res, true, {
        otpEnabled: otpService.isEnabled(),
        userSettings: user.otpSettings,
        availableMethods: user.availableOTPMethods,
        hasActiveTOTP: user.hasActiveTOTP,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        systemDefaults: {
          priorityOrder: process.env.OTP_PRIORITY_ORDER.split(','),
          defaultMethod: process.env.DEFAULT_OTP_METHOD
        }
      }, 'OTP settings retrieved successfully');

    } catch (error) {
      console.error('Get OTP settings error:', error);
      return authController.errorResponse(res,
        'Failed to retrieve OTP settings', 500, error.message);
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
        return authController.errorResponse(res,
          'Invalid preferred method', 400);
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
      await user.logSecurityEvent('otp_settings_updated',
        'OTP settings updated', 'low', deviceInfo);

      return authController.standardResponse(res, true, {
        otpSettings: user.otpSettings
      }, 'OTP settings updated successfully');

    } catch (error) {
      console.error('Update OTP settings error:', error);
      return authController.errorResponse(res,
        'Failed to update OTP settings', 500, error.message);
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
        return authController.errorResponse(res, 'User not found', 404);
      }

      const verified = await user.verifyUser();

      return authController.standardResponse(res, true, { verified }, 'User verified successfully');
    } catch (error) {
      console.error('Verify user error:', error);
      return authController.errorResponse(res, 'Failed to verify user', 500, error.message);
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
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return authController.errorResponse(res, 'User not found', 404);
      }

      const updatedUser = await user.updateProfile(req.body);

      return authController.standardResponse(res, true, authController.enrichUser(updatedUser), 'Profile updated successfully');
    } catch (error) {
      console.error('Update profile error:', error);
      return authController.errorResponse(res, 'Failed to update profile', 500, error.message);
    }
  }

  /**
   * UPDATE PROFILE PICTURE
   */
  static async updateProfilePicture(req, res) {
    try {
      const { id } = req.params;
      const { url } = req.body;

      if (!url) {
        return authController.errorResponse(res, 'Image URL is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return authController.errorResponse(res, 'User not found', 404);
      }

      const profilePicture = await user.updateProfilePicture(url);

      return authController.standardResponse(res, true, { profilePicture }, 'Profile picture updated successfully');
    } catch (error) {
      console.error('Update profile picture error:', error);
      return authController.errorResponse(res, 'Failed to update profile picture', 500, error.message);
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
        return authController.errorResponse(res, 'New email is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return authController.errorResponse(res, 'User not found', 404);
      }

      const result = await user.updateEmail(newEmail);

      return authController.standardResponse(res, true, result, 'Email updated successfully');
    } catch (error) {
      console.error('Update email error:', error);
      return authController.errorResponse(res, error.message || 'Failed to update email', 500);
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
        return authController.errorResponse(res, 'Phone number is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return authController.errorResponse(res, 'User not found', 404);
      }

      const phoneNumber = await user.updatePhoneNumber(newPhone);

      return authController.standardResponse(res, true, { phoneNumber }, 'Phone number updated successfully');
    } catch (error) {
      console.error('Update phone number error:', error);
      return authController.errorResponse(res, error.message || 'Failed to update phone number', 500);
    }
  }

  /**
   * LINK SOCIAL ACCOUNT
   */
  static async linkSocialAccount(req, res) {
    try {
      const { id } = req.params;
      const { platform, socialId } = req.body;

      if (!platform || !socialId) {
        return authController.errorResponse(res, 'Platform and social ID are required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return authController.errorResponse(res, 'User not found', 404);
      }

      await user.linkSocialAccount(platform, socialId);

      return authController.standardResponse(res, true, null, 'Social account linked');
    } catch (error) {
      console.error('Link social account error:', error);
      return authController.errorResponse(res, 'Failed to link social account', 500, error.message);
    }
  }

  /**
   * UNLINK SOCIAL ACCOUNT
   */
  static async unlinkSocialAccount(req, res) {
    try {
      const { id } = req.params;
      const { platform } = req.body;

      if (!platform) {
        return authController.errorResponse(res, 'Platform is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return authController.errorResponse(res, 'User not found', 404);
      }

      await user.unlinkSocialAccount(platform);

      return authController.standardResponse(res, true, null, 'Social account unlinked');
    } catch (error) {
      console.error('Unlink social account error:', error);
      return authController.errorResponse(res, 'Failed to unlink social account', 500, error.message);
    }
  }

  /**
   * CLEAR ALL SOCIAL LINKS
   */
  static async clearAllSocialLinks(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return authController.errorResponse(res, 'User not found', 404);
      }

      const socialMedia = await user.clearAllSocialLinks();

      return authController.standardResponse(res, true, socialMedia, 'All social links cleared');
    } catch (error) {
      console.error('Clear all social links error:', error);
      return authController.errorResponse(res, 'Failed to clear social links', 500, error.message);
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
        return authController.errorResponse(res, 'User not found', 404);
      }

      await user.invalidateAllSessions();

      return authController.standardResponse(res, true, null, 'All sessions invalidated');
    } catch (error) {
      console.error('Invalidate all sessions error:', error);
      return authController.errorResponse(res, 'Failed to invalidate sessions', 500, error.message);
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
        return authController.errorResponse(res, 'Token is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return authController.errorResponse(res, 'User not found', 404);
      }

      await user.revokeToken(token);

      return authController.standardResponse(res, true, null, 'Token revoked');
    } catch (error) {
      console.error('Revoke token error:', error);
      return authController.errorResponse(res, 'Failed to revoke token', 500, error.message);
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
        return authController.errorResponse(res,
          'TOTP is already enabled for this user', 400);
      }

      const setupData = await user.setupTOTP();

      return authController.standardResponse(res, true, {
        qrCode: setupData.qrCode,
        manualEntryKey: setupData.manualEntryKey,
        instructions: {
          step1: 'Scan the QR code with your authenticator app',
          step2: 'Or manually enter the key in your authenticator app',
          step3: 'Enter the 6-digit code from your app to complete setup'
        }
      }, 'TOTP setup initiated. Scan QR code with your authenticator app.');

    } catch (error) {
      console.error('TOTP setup error:', error);
      return authController.errorResponse(res,
        error.message || 'TOTP setup failed', 500);
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
        return authController.errorResponse(res,
          'TOTP code is required', 400);
      }

      const result = await user.verifyTOTPSetup(code);

      if (result.success) {
        await user.logSecurityEvent('totp_setup_completed',
          'TOTP authentication enabled', 'medium', deviceInfo);

        return authController.standardResponse(res, true, {
          totpEnabled: true,
          backupCodes: result.backupCodes,
          message: 'TOTP enabled successfully. Save these backup codes in a safe place.'
        }, 'TOTP authentication enabled successfully');
      }

      return authController.errorResponse(res,
        'Invalid TOTP code', 400);

    } catch (error) {
      console.error('TOTP verification error:', error);
      return authController.errorResponse(res,
        error.message || 'TOTP verification failed', 500);
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
        return authController.errorResponse(res,
          'TOTP is not enabled for this user', 400);
      }

      if (!code) {
        return authController.errorResponse(res,
          'TOTP code is required to disable 2FA', 400);
      }

      if (!confirmDisable) {
        return authController.errorResponse(res,
          'Please confirm that you want to disable 2FA', 400);
      }

      const result = await user.disableTOTP(code);

      if (result.success) {
        await user.logSecurityEvent('totp_disabled',
          'TOTP authentication disabled', 'high', deviceInfo);

        return authController.standardResponse(res, true, {
          totpEnabled: false
        }, 'TOTP authentication disabled successfully');
      }

      return authController.errorResponse(res,
        'Invalid TOTP code', 400);

    } catch (error) {
      console.error('TOTP disable error:', error);
      return authController.errorResponse(res,
        error.message || 'TOTP disable failed', 500);
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
        return authController.errorResponse(res,
          'TOTP is not enabled for this user', 400);
      }

      if (!code) {
        return authController.errorResponse(res,
          'TOTP code is required to generate new backup codes', 400);
      }

      // Verify TOTP code
      const isValid = await otpService.verifyTOTP(user, code);
      if (!isValid) {
        return authController.errorResponse(res,
          'Invalid TOTP code', 400);
      }

      // Generate new backup codes
      const newBackupCodes = otpService.generateBackupCodes();
      user.twoFactorAuth.backupCodes = newBackupCodes.map(code => ({
        code: crypto.createHash('sha256').update(code).digest('hex'),
        used: false,
        createdAt: new Date()
      }));

      await user.save();
      await user.logSecurityEvent('backup_codes_regenerated',
        'New backup codes generated', 'medium', deviceInfo);

      return authController.standardResponse(res, true, {
        backupCodes: newBackupCodes,
        message: 'New backup codes generated. Save them in a safe place.'
      }, 'Backup codes regenerated successfully');

    } catch (error) {
      console.error('Backup codes generation error:', error);
      return authController.errorResponse(res,
        error.message || 'Failed to generate backup codes', 500);
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

      const devices = user.knownDevices.map(device => ({
        ...device.toObject(),
        isCurrent: device.deviceId === currentDeviceId,
        activeSessions: user.activeSessions.filter(s =>
          s.deviceId === device.deviceId && s.isActive
        ).length
      }));

      return authController.standardResponse(res, true, {
        devices,
        totalDevices: devices.length,
        trustedDevices: devices.filter(d => d.isTrusted).length
      }, 'Devices retrieved successfully');

    } catch (error) {
      console.error('Get devices error:', error);
      return authController.errorResponse(res,
        'Failed to retrieve devices', 500, error.message);
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
        return authController.errorResponse(res,
          'Device ID is required', 400);
      }

      const success = await user.trustDevice(deviceId);

      if (success) {
        return authController.standardResponse(res, true, {
          deviceTrusted: true,
          deviceId
        }, 'Device trusted successfully');
      }

      return authController.errorResponse(res,
        'Device not found', 404);

    } catch (error) {
      console.error('Trust device error:', error);
      return authController.errorResponse(res,
        'Failed to trust device', 500, error.message);
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
        return authController.errorResponse(res,
          'Device ID is required', 400);
      }

      if (deviceId === currentDeviceInfo.deviceId && !confirmRemove) {
        return authController.errorResponse(res,
          'Cannot remove current device without confirmation', 400);
      }

      const success = await user.removeDevice(deviceId);

      if (success) {
        return authController.standardResponse(res, true, {
          deviceRemoved: true,
          deviceId
        }, 'Device removed successfully');
      }

      return authController.errorResponse(res,
        'Device not found', 404);

    } catch (error) {
      console.error('Remove device error:', error);
      return authController.errorResponse(res,
        'Failed to remove device', 500, error.message);
    }
  }

  // ========================================
  // 🔍 SECURITY & MONITORING
  // ========================================

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
        events = events.filter(e => e.severity === severity);
      }

      // Filter by event type
      if (event) {
        events = events.filter(e => e.event.includes(event));
      }

      // Sort by timestamp (newest first)
      events = events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Pagination
      const start = (page - 1) * limit;
      const paginatedEvents = events.slice(start, start + parseInt(limit));

      return authController.standardResponse(res, true, {
        events: paginatedEvents,
        pagination: {
          currentPage: parseInt(page),
          totalEvents: events.length,
          totalPages: Math.ceil(events.length / limit),
          hasNext: start + parseInt(limit) < events.length,
          hasPrev: page > 1
        }
      }, 'Security events retrieved successfully');

    } catch (error) {
      console.error('Get security events error:', error);
      return authController.errorResponse(res,
        'Failed to retrieve security events', 500, error.message);
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
        loginHistory = loginHistory.filter(h => h.successful === (successful === 'true'));
      }

      // Sort by login time (newest first)
      loginHistory = loginHistory.sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));

      // Pagination
      const start = (page - 1) * limit;
      const paginatedHistory = loginHistory.slice(start, start + parseInt(limit));

      return authController.standardResponse(res, true, {
        loginHistory: paginatedHistory,
        pagination: {
          currentPage: parseInt(page),
          totalLogins: loginHistory.length,
          totalPages: Math.ceil(loginHistory.length / limit),
          hasNext: start + parseInt(limit) < loginHistory.length,
          hasPrev: page > 1
        },
        stats: {
          totalLogins: loginHistory.length,
          successfulLogins: loginHistory.filter(h => h.successful).length,
          failedLogins: loginHistory.filter(h => !h.successful).length
        }
      }, 'Login history retrieved successfully');

    } catch (error) {
      console.error('Get login history error:', error);
      return authController.errorResponse(res,
        'Failed to retrieve login history', 500, error.message);
    }
  }

  /**
   * GET USER SECURITY SUMMARY
   */
  static async getSecuritySummary(req, res) {
    try {
      const user = req.user;

      const securityScore = authController.calculateSecurityScore(user);
      const recentEvents = user.securityEvents
        ?.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5) || [];

      const activeSessions = user.authTokens?.filter(t =>
        !t.isRevoked && t.expiresAt > new Date()
      ).length || 0;

      const trustedDevices = user.knownDevices?.filter(d => d.isTrusted).length || 0;

      return authController.standardResponse(res, true, {
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
        recommendations: authController.getSecurityRecommendations(user)
      }, 'Security summary retrieved successfully');

    } catch (error) {
      console.error('Get security summary error:', error);
      return authController.errorResponse(res,
        'Failed to retrieve security summary', 500, error.message);
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
        action: 'Setup TOTP'
      });
    }

    if (!user.emailVerified) {
      recommendations.push({
        type: 'verify_email',
        priority: 'high',
        message: 'Verify your email address',
        action: 'Verify Email'
      });
    }

    if (!user.phoneVerified && user.phoneNumber) {
      recommendations.push({
        type: 'verify_phone',
        priority: 'medium',
        message: 'Verify your phone number for SMS backup',
        action: 'Verify Phone'
      });
    }

    const untrustedDevices = user.knownDevices?.filter(d => !d.isTrusted).length || 0;
    if (untrustedDevices > 0) {
      recommendations.push({
        type: 'trust_devices',
        priority: 'medium',
        message: `You have ${untrustedDevices} untrusted device(s)`,
        action: 'Manage Devices'
      });
    }

    const oldSessions = user.authTokens?.filter(t =>
      !t.isRevoked &&
      (Date.now() - new Date(t.lastUsed).getTime()) > (30 * 24 * 60 * 60 * 1000) // 30 days
    ).length || 0;

    if (oldSessions > 0) {
      recommendations.push({
        type: 'cleanup_sessions',
        priority: 'low',
        message: `You have ${oldSessions} old active session(s)`,
        action: 'Cleanup Sessions'
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

      return authController.standardResponse(res, true, analytics,
        'OTP analytics retrieved successfully');

    } catch (error) {
      console.error('Get OTP analytics error:', error);
      return authController.errorResponse(res,
        'Failed to retrieve OTP analytics', 500, error.message);
    }
  }

  /**
   * GET SECURITY REPORT (Admin only)
   */
  static async getSecurityReport(req, res) {
    try {
      const { timeframe = 30 } = req.query;

      const report = await User.getSecurityReport(timeframe);

      return authController.standardResponse(res, true, report,
        'Security report retrieved successfully');

    } catch (error) {
      console.error('Get security report error:', error);
      return authController.errorResponse(res,
        'Failed to retrieve security report', 500, error.message);
    }
  }
  static async findFullyPopulatedById(req, res) {
    try {
      const user = await User.findFullyPopulatedById(req.user.id);


      return authController.standardResponse(res, true, user, 'Devices retrieved successfully');

    } catch (error) {
      console.error('Get devices error:', error);
      return authController.errorResponse(res,
        'Failed to retrieve devices', 500, error.message);
    }
  }


}

module.exports = authController;
