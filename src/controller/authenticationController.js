




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
const { welcomeEmailTemplate } = require('../email/emailTemplates');
const { sendEmail } = require('../email');
const { checkPasswordStrength } = require('../utils/security');

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
    const requiredFields = [
      'firstName', 'lastName', 'email', 'phoneNumber',
      'dateOfBirth', 'gender', 'profilePicture'
    ];

    const completedFields = requiredFields.filter(field =>
      user[field] !== null && user[field] !== undefined && user[field] !== ''
    );

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
      ...meta
    });
  }

  static errorResponse(res, message, statusCode = 500, error = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
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


      // Validation
      if (!email || !username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email, username, and password are required'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }

      // Password strength check
      const passwordStrength = checkPasswordStrength(password);
      if (!passwordStrength.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          passwordRequirements: passwordStrength.checks
        });
      }



      // Call schema method for registration
      // Register user
      const registrationResult = await User.registerUserWithAuth({
        email,
        username,
        password,
        confirmPassword,
        ...otherData
      }, req.deviceInfo);


      // Send verification email
      try {
        await otpService.sendEmailOTP(
          email,
          registrationResult.verificationToken.substring(0, 6), // Use first 6 chars as code
          'email_verification'
        );
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails
      }
      // Send welcome email
      const emailResult = await sendEmail(welcomeEmailTemplate, registrationResult);

      // Return response
      if (emailResult.success) {
        return res.status(200).json({
          success: true,
          message: `Registration successful and welcome email sent${emailResult.usedFallback ? ' via fallback' : ''}`,
          messageId: emailResult.messageId, user: registrationResult.id
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Registration successful but failed to send welcome email',
          error: emailResult.error,
        });
      }
    } catch (err) {
      // Handle errors (e.g., duplicate keys, validation)
      res.status(500).json({ error: err.message || 'Registration failed.', status: false, });
    }
  }

  /**
   * LOGIN USER
   */
  static async login(req, res) {
    try {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
        return UserController.errorResponse(res, 'Email/username and password are required', 400);
      }
      // Authenticate user
      const authResult = await User.authenticateUser(
        identifier,
        password,
        req.deviceInfo
      );
      const user = authResult.user;

      // const user = await User.findByEmail(email);
      if (!user) {
        return UserController.errorResponse(res, 'Invalid Email/username or password', 401);
      }
      // Check if MFA is required
      if (authResult.requiresMFA) {
        // Generate and send OTP
        const otpResult = await user.generateOTP(
          process.env.DEFAULT_OTP_TYPE || 'email',
          'login',
          req.deviceInfo
        );

        return res.status(200).json({
          success: true,
          requiresMFA: true,
          message: 'MFA verification required',
          otpSent: otpResult.success,
          otpType: otpResult.type,
          tempToken: generateSecureToken(), // Temporary token for MFA step
          userId: user._id
        });
      }

      const tokens = await user.generateTokens(req.deviceInfo);

      return UserController.standardResponse(
        res,
        true,
        {
          user: {
            id: user._id,
            email: user.email,
            username: user.username,
            fullName: user.fullName,
            role: user.role?.name,
            isVerified: user.isVerified
          },
          tokens,
          requiresMFA: false
        },
        'Login successful'
      );
    } catch (error) {
      console.error('Login error:', error);
      return UserController.errorResponse(res, 'Login failed', 401, error.message);
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
          message: 'User ID and MFA code are required'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify MFA code
      const isValid = await user.verifyOTP(mfaCode, 'login', req.deviceInfo);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired MFA code'
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
            isVerified: user.isVerified
          },
          tokens
        }
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Logout
   */
 static async logout(req, res) {
    try {
      const user = req.user;
      const token = req.token;

      // Revoke current token
      await user.revokeToken(token);

      // Log logout event
      await user.logAuthEvent('logout', req.deviceInfo, true);

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  /**
   * Logout from all devices
   */
 static async logoutAll(req, res) {
    try {
      const user = req.user;

      // Revoke all tokens
      await user.revokeAllTokens();

      // Log security event
      await user.logAuthEvent('logout_all_devices', req.deviceInfo, true);

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to logout from all devices'
      });
    }
  }

  /**
   * Refresh access token
   */
 static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Find user by refresh token
      const user = await User.findOne({
        'tokens.refreshToken': refreshToken,
        'tokens.isRevoked': false
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Generate new tokens
      const tokens = await user.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: { tokens }
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Generate OTP
   */
static  async generateOTP(req, res) {
    try {
      const { type = process.env.DEFAULT_OTP_TYPE || 'email', purpose = 'login' } = req.body;
      const user = req.user;

      const otpResult = await user.generateOTP(type, purpose, req.deviceInfo);

      // Send OTP via appropriate channel
      let sendResult;
      switch (type) {
        case 'email':
          sendResult = await otpService.sendEmailOTP(
            user.email,
            otpResult.code || '000000',
            purpose
          );
          break;
        case 'sms':
          if (!user.phoneNumber) {
            throw new Error('Phone number not configured');
          }
          sendResult = await otpService.sendSMSOTP(
            user.phoneNumber,
            otpResult.code || '000000',
            purpose
          );
          break;
        case 'voice':
          if (!user.phoneNumber) {
            throw new Error('Phone number not configured');
          }
          sendResult = await otpService.sendVoiceOTP(
            user.phoneNumber,
            otpResult.code || '000000'
          );
          break;
      }

      res.status(200).json({
        success: true,
        message: `OTP sent via ${type}`,
        data: {
          type,
          expiresAt: otpResult.expiresAt,
          sent: sendResult?.success || false
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
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
          message: 'OTP code is required'
        });
      }

      const isValid = await user.verifyOTP(code, purpose, req.deviceInfo);

      if (isValid) {
        res.status(200).json({
          success: true,
          message: 'OTP verified successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP code'
        });
      }

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * CHANGE PASSWORD
   */
  static async changePassword(req, res) {
    try {
      const { id } = req.params;

      const { currentPassword, newPassword, confirmPassword } = req.body;
      const user = req.user;
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'New passwords do not match'
        });
      }


      // Password strength check
      const passwordStrength = checkPasswordStrength(newPassword);
      if (!passwordStrength.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet requirements',
          passwordRequirements: passwordStrength.checks
        });
      }

      const result = await user.changePassword(currentPassword, newPassword);

      if (result) {
        // Log password change
        await user.logAuthEvent('password_change', req.deviceInfo, true);

        return UserController.standardResponse(
          res,
          true,
          result,
          'Password changed successfully'
        )
      }


    } catch (error) {
      console.error('Change password error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to change password', 500);
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
          message: 'MFA is already enabled'
        });
      }

      const mfaSetup = await user.enableMFA(method);

      res.status(200).json({
        success: true,
        message: 'MFA setup initiated',
        data: mfaSetup
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
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
          message: 'Verification code is required'
        });
      }

      const result = await user.confirmMFASetup(code);

      if (result) {
        await user.logAuthEvent('mfa_enabled', req.deviceInfo, true);

        res.status(200).json({
          success: true,
          message: 'MFA enabled successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
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
          message: 'MFA is not enabled'
        });
      }

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Verification code is required'
        });
      }

      const result = await user.disableMFA(code);

      if (result) {
        await user.logAuthEvent('mfa_disabled', req.deviceInfo, true);

        res.status(200).json({
          success: true,
          message: 'MFA disabled successfully'
        });
      }

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }


  /**
   * Initiate password reset
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return UserController.errorResponse(res, 'Email is required', 400);
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const result = await User.initiatePasswordReset(email, req.deviceInfo);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          otpType: result.otpType
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * RESET PASSWORD WITH TOKEN
   */
  static async resetPassword(req, res) {
    try {
       const { email, otpCode, newPassword, confirmPassword } = req.body;
        if (!email || !otpCode || !newPassword || !confirmPassword|| !token) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }


      if (!token || !newPassword) {
        return UserController.errorResponse(res, 'Token and new password are required', 400);
      }

      const user = await User.findOne({ resetToken: token });
      if (!user) {
        return UserController.errorResponse(res, 'Invalid token', 400);
      }

      const isValid = await user.checkResetTokenValidity(token);
      if (!isValid) {
        return UserController.errorResponse(res, 'Token expired', 400);
      }

      await user.setPassword(newPassword);
      user.resetToken = null;
      user.resetTokenExpiration = null;
      await user.save();

      return UserController.standardResponse(
        res,
        true,
        null,
        'Password reset successfully'
      );
    } catch (error) {
      console.error('Reset password error:', error);
      return UserController.errorResponse(res, 'Failed to reset password', 500, error.message);
    }
  }

  /**
   * CONFIRM EMAIL
   */
  static async confirmEmail(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return UserController.errorResponse(res, 'Token is required', 400);
      }

      const user = await User.findOne({ confirmToken: token });
      if (!user) {
        return UserController.errorResponse(res, 'Invalid token', 400);
      }

      await user.confirmEmail(token);

      return UserController.standardResponse(
        res,
        true,
        null,
        'Email confirmed successfully'
      );
    } catch (error) {
      console.error('Confirm email error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to confirm email', 400);
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
        .filter(token => !token.isRevoked && token.expiresAt > now)
        .map(token => ({
          tokenId: token._id,
          deviceId: token.deviceId,
          ipAddress: token.ipAddress,
          createdAt: token.createdAt,
          expiresAt: token.expiresAt,
          isCurrent: token.token === req.token
        }));

      res.status(200).json({
        success: true,
        data: {
          activeSessions,
          totalSessions: activeSessions.length,
          maxSessions: user.concurrentSessionLimit
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve active sessions'
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
          message: 'Token ID is required'
        });
      }

      const tokenData = user.tokens.find(t => t._id.toString() === tokenId);
      if (!tokenData) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      await user.revokeToken(tokenData.token);

      res.status(200).json({
        success: true,
        message: 'Session revoked successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to revoke session'
      });
    }
  }

  /**
   * Get user devices
   */
  static async getDevices(req, res) {
    try {
      const user = req.user;

      const devices = user.devices.map(device => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        location: device.location,
        lastUsed: device.lastUsed,
        isActive: device.isActive,
        isTrusted: device.isTrusted,
        registeredAt: device.registeredAt
      }));

      res.status(200).json({
        success: true,
        data: { devices }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve devices'
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
          message: 'Device ID is required'
        });
      }

      await user.removeDevice(deviceId);

      res.status(200).json({
        success: true,
        message: 'Device removed successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to remove device'
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
          message: 'Device ID is required'
        });
      }

      await user.trustDevice(deviceId);

      res.status(200).json({
        success: true,
        message: 'Device trusted successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to trust device'
      });
    }
  }

  static async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
      }

      const user = await User.findOne({
        'emailVerificationTokens.token': token
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      const result = await user.verifyEmailWithToken(token);

      if (result) {
        await user.logAuthEvent('email_verified', req.deviceInfo || {}, true);

        res.status(200).json({
          success: true,
          message: 'Email verified successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Email verification failed'
        });
      }

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
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
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const verified = await user.verifyUser();

      return UserController.standardResponse(
        res,
        true,
        { verified },
        'User verified successfully'
      );
    } catch (error) {
      console.error('Verify user error:', error);
      return UserController.errorResponse(res, 'Failed to verify user', 500, error.message);
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
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const updatedUser = await user.updateProfile(req.body);

      return UserController.standardResponse(
        res,
        true,
        UserController.enrichUser(updatedUser),
        'Profile updated successfully'
      );
    } catch (error) {
      console.error('Update profile error:', error);
      return UserController.errorResponse(res, 'Failed to update profile', 500, error.message);
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
        return UserController.errorResponse(res, 'Image URL is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const profilePicture = await user.updateProfilePicture(url);

      return UserController.standardResponse(
        res,
        true,
        { profilePicture },
        'Profile picture updated successfully'
      );
    } catch (error) {
      console.error('Update profile picture error:', error);
      return UserController.errorResponse(res, 'Failed to update profile picture', 500, error.message);
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
        return UserController.errorResponse(res, 'New email is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const result = await user.updateEmail(newEmail);

      return UserController.standardResponse(
        res,
        true,
        result,
        'Email updated successfully'
      );
    } catch (error) {
      console.error('Update email error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to update email', 500);
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
        return UserController.errorResponse(res, 'Phone number is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const phoneNumber = await user.updatePhoneNumber(newPhone);

      return UserController.standardResponse(
        res,
        true,
        { phoneNumber },
        'Phone number updated successfully'
      );
    } catch (error) {
      console.error('Update phone number error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to update phone number', 500);
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
        return UserController.errorResponse(res, 'Platform and social ID are required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.linkSocialAccount(platform, socialId);

      return UserController.standardResponse(
        res,
        true,
        null,
        'Social account linked'
      );
    } catch (error) {
      console.error('Link social account error:', error);
      return UserController.errorResponse(res, 'Failed to link social account', 500, error.message);
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
        return UserController.errorResponse(res, 'Platform is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.unlinkSocialAccount(platform);

      return UserController.standardResponse(
        res,
        true,
        null,
        'Social account unlinked'
      );
    } catch (error) {
      console.error('Unlink social account error:', error);
      return UserController.errorResponse(res, 'Failed to unlink social account', 500, error.message);
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
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const socialMedia = await user.clearAllSocialLinks();

      return UserController.standardResponse(
        res,
        true,
        socialMedia,
        'All social links cleared'
      );
    } catch (error) {
      console.error('Clear all social links error:', error);
      return UserController.errorResponse(res, 'Failed to clear social links', 500, error.message);
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
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.invalidateAllSessions();

      return UserController.standardResponse(
        res,
        true,
        null,
        'All sessions invalidated'
      );
    } catch (error) {
      console.error('Invalidate all sessions error:', error);
      return UserController.errorResponse(res, 'Failed to invalidate sessions', 500, error.message);
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
        return UserController.errorResponse(res, 'Token is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.revokeToken(token);

      return UserController.standardResponse(
        res,
        true,
        null,
        'Token revoked'
      );
    } catch (error) {
      console.error('Revoke token error:', error);
      return UserController.errorResponse(res, 'Failed to revoke token', 500, error.message);
    }
  }



}

module.exports = authController;