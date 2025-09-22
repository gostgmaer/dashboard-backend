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
 * ✅ Complete CRUD operations
 * ✅ All 120+ model methods exposed
 * ✅ Bulk operations (delete, update, status)
 * ✅ Virtual properties and statistics
 * ✅ Error handling with try-catch
 * ✅ Soft delete functionality
 * ✅ Population of related data
 * ✅ Dynamic filtering, sorting, pagination
 * ✅ Smart population based on operation type
 * ✅ Automatic field calculations
 * ✅ Parameter-based queries
 * ✅ Comprehensive validation
 * ✅ Performance optimized
 * ✅ Standardized responses
 * ✅ Authentication & role-based access
 * ✅ Analytics & reporting
 * ✅ Import/Export functionality
 * ✅ Session management
 * ✅ Security features
 */

class UserController {
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

  static enrichUser(user, includeCalculated = true) {
    const userObj = user.toObject ? user.toObject() : user;

    if (includeCalculated) {
      return {
        ...userObj,
        fullName: user.fullName,
        userScore: this.calculateUserScore(userObj),
        activityLevel: this.getUserActivityLevel(userObj),
        profileCompleteness: this.calculateProfileCompleteness(userObj),
        accountAge: userObj.createdAt ?
          Math.floor((new Date() - new Date(userObj.createdAt)) / (1000 * 60 * 60 * 24)) : 0
      };
    }

    return { ...userObj, fullName: user.fullName };
  }

  static standardResponse(res, success, data, message, statusCode = 200, meta = {}) {
    return res.status(statusCode).json({
      success,
      status: statusCode,
      data,
      message,
      ...meta,
    });
  }

  static errorResponse(res, message, statusCode = 500, error = null) {
    return res.status(statusCode).json({
      success: false,
      status: statusCode,
      message,
      error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }

  // ========================================
  // 📋 CRUD OPERATIONS
  // ========================================

  /**
   * CREATE USER - with validation and auto-calculations
   */


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
          messageId: emailResult.messageId, user: user.id
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
  static async createUser(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return UserController.errorResponse(res, 'Validation failed', 400, errors.array());
      }

      const userData = req.body;

      // Auto-generate referral code if not provided
      if (!userData.referralCode) {
        userData.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      }

      // Set created by
      if (req.user) {
        userData.created_by = req.user.id;
        userData.updated_by = req.user.id;
      }

      // Create user instance
      const user = new User(userData);

      // Set password if provided
      if (userData.password) {
        await user.setPassword(userData.password);
      }

      await user.save();

      // Populate the created user
      await user.populate([
        { path: 'role', select: 'name permissions' },
        { path: 'created_by', select: 'name email' }
      ]);

      return UserController.standardResponse(
        res,
        true,
        UserController.enrichUser(user),
        'User created successfully',
        201
      );
    } catch (error) {
      console.error('Create user error:', error);
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return UserController.errorResponse(res, `${field} already exists`, 400, 'Duplicate key error');
      }
      return UserController.errorResponse(res, 'Failed to create user', 500, error.message);
    }
  }

  /**
   * GET ALL USERS - with advanced filtering, sorting, pagination
   */
  static async getUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        search,
        populate,
        status,
        role,
        subscriptionType,
        isVerified,
        ...otherFilters
      } = req.query;


      // Build query filters
      const filters = { status: { $ne: 'deleted' } };

      // Apply specific filters
      if (status) filters.status = status;
      if (role) filters.role = role;
      if (subscriptionType) filters.subscriptionType = subscriptionType;
      if (isVerified !== undefined) filters.isVerified = isVerified === 'true';

      // Apply additional filters dynamically

      var normalizedOtherFilters = {};
      for (var key in otherFilters) {
        var value = otherFilters[key];
        if (value && value !== '' && value !== 'undefined') {
          var normalizedKey = key.startsWith('filter_') ? key.replace('filter_', '') : key;
          normalizedOtherFilters[normalizedKey] = value;
        }
      }

      // Replace original otherFilters with normalized version
      // otherFilters = normalizedOtherFilters;

      Object.keys(normalizedOtherFilters).forEach(key => {
        const value = normalizedOtherFilters[key];
        if (value && value !== '' && value !== 'undefined') {

          switch (key) {
            case 'interests':
            case 'tags':
              filters[key] = Array.isArray(value) ? { $in: value } : { $in: value.split(',') };
              break;
            case 'newsletter':
            case 'notifications':
              filters[`preferences.${key}`] = value === 'true';
              break;
            default:
              if (typeof value === 'string') {
                if (value.includes(',')) {
                  // Multiple exact matches
                  filters[key] = { $in: value.split(',') };
                } else {
                  // Partial match
                  filters[key] = { $regex: value, $options: 'i' }; // case-insensitive partial match
                }
              } else {
                filters[key] = value;
              }
          }
        }
      });


      // Add search functionality
      if (search) {
        filters.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } }
        ];
      }

      // Build sort object
      const sortObj = {};
      sortObj[sort] = order === 'desc' ? -1 : 1;

      // Default population for list view
      const defaultPopulate = [
        { path: 'role', select: 'name permissions' },
        { path: 'created_by', select: 'name email' }
      ];

      // Use model's pagination method
      const result = await User.getPaginatedUsers({
        page: Number(page),
        limit: Number(limit),
        filters,
        sort: sortObj
      });

      // Enrich users with calculated fields
      const data = result.items.map(user =>
        UserController.enrichUser(user)
      );

      const response = {
        users: data.map(u => {
          return {
            id: u._id,
            theme: u.preferences?.theme || '',
            language: u.preferences?.language || '',
            currency: u.preferences?.currency || 'USD',
            notifications: u.preferences?.notifications,
            newsletter: u.preferences?.newsletter,
            username: u.username,
            email: u.email,
            id: u._id,
            fullName: u.fullName || null,
            firstName: u.firstName || null,
            lastName: u.lastName || null,
            role: u.role?._id || null,
            rolename: u.role?.name || null,
            dateOfBirth: u.dateOfBirth || null,
            gender: u.gender || null,
            phoneNumber: u.phoneNumber || null,
            profilePicture: u.profilePicture || null,
            isVerified: u.isVerified,
            emailVerified: u.emailVerified,
            socialMedia: u.socialMedia,
            phoneVerified: u.phoneVerified,
            failedLoginAttempts: u.failedLoginAttempts,
            consecutiveFailedAttempts: u.consecutiveFailedAttempts,
            lockoutUntil: u.lockoutUntil,
            lastLoginAttempt: u.lastLoginAttempt,
            twoFactorEnabled: u.otpSettings?.enable || false,
            addresscount: Array.isArray(u.address) ? u.address.length : 0,
            interests: u.interests || [],
            loyaltyPoints: u.loyaltyPoints,
            subscriptionStatus: u.subscriptionStatus,
            subscriptionType: u.subscriptionType,
            status: u.status,
            referralCode: u.referralCode,
            userScore: u.userScore,
            activityLevel: u.activityLevel,
            profileCompleteness: u.profileCompleteness,
            accountAge: Math.floor((Date.now() - new Date(u.createdAt)) / (1000 * 60 * 60 * 24))
          }
        }), pagination: {
          currentPage: result.page,
          totalPages: result.pages,
          totalUsers: result.total,
          hasNext: result.page < result.pages,
          hasPrev: result.page > 1,
          limit: Number(limit)
        },
        filters: {
          applied: Object.keys(filters).length - 1,
          search: search || null
        }
      }


      return UserController.standardResponse(
        res,
        true,
        response,
        `Retrieved ${result.total} users`
      );
    } catch (error) {
      console.error('Error in getUsers:', error);
      return UserController.errorResponse(res, 'Failed to fetch users', 500, error.message);
    }
  }


  static async getUserByIdentifier(req, res) {
    try {
      const { identifier } = req.params;

      if (!identifier) {
        return res.status(400).json({ error: "Identifier parameter is required" });
      }

      let u = await User.findUserFullDetails(identifier);

      if (!u) {
        return res.status(404).json({ error: "User not found" });
      }
      u = UserController.enrichUser(u)
      const data = {
        theme: u.preferences.theme || '',
        language: u.preferences.language || '',
        currency: u.preferences.currency || 'USD',
        notifications: u.preferences.notifications,
        newsletter: u.preferences.newsletter,
        username: u.username,
        email: u.email,
        id: u._id,
        fullName: u.fullName || null,
        firstName: u.firstName || null,
        lastName: u.lastName || null,
        role: u.role?._id || null,
        rolename: u.role?.name || null,
        dateOfBirth: u.dateOfBirth || null,
        gender: u.gender || null,
        phoneNumber: u.phoneNumber || null,
        profilePicture: u.profilePicture || null,
        isVerified: u.isVerified,
        emailVerified: u.emailVerified,
        socialMedia: u.socialMedia,
        phoneVerified: u.phoneVerified,
        failedLoginAttempts: u.failedLoginAttempts,
        consecutiveFailedAttempts: u.consecutiveFailedAttempts,
        lockoutUntil: u.lockoutUntil,
        lastLoginAttempt: u.lastLoginAttempt,
        twoFactorEnabled: u.otpSettings.enable || false,
        addresscount: Array.isArray(u.address) ? u.address.length : 0,
        interests: u.interests || [],
        loyaltyPoints: u.loyaltyPoints,
        subscriptionStatus: u.subscriptionStatus,
        subscriptionType: u.subscriptionType,
        status: u.status,
        referralCode: u.referralCode,
        userScore: u.userScore,
        activityLevel: u.activityLevel,
        profileCompleteness: u.profileCompleteness,
        accountAge: Math.floor((Date.now() - new Date(u.createdAt)) / (1000 * 60 * 60 * 24))
      }
      return UserController.standardResponse(
        res,
        true,
        UserController.enrichUser(data),
        'User created successfully',
        200
      );
    } catch (error) {
      return UserController.errorResponse(res, 'Failed to Fetch user', 500, error.message);
    }
  }

  /**
   * GET SINGLE USER BY ID - with comprehensive population
   */
  static async getUserById(req, res) {
    try {
      const { id } = req.params;
      const { populate } = req.query;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return UserController.errorResponse(res, 'Invalid user ID format', 400);
      }

      // Comprehensive population for single user view
      const defaultPopulate = [
        { path: 'role', select: 'name permissions description' },
        { path: 'address' },
        { path: 'orders', select: 'orderNumber status total createdAt' },
        { path: 'favoriteProducts', select: 'title mainImage basePrice' },
        { path: 'shoppingCart' },
        { path: 'wishList' },
        { path: 'referredBy', select: 'name email' },
        { path: 'created_by', select: 'name email' },
        { path: 'updated_by', select: 'name email' }
      ];

      const user = await User.findOne({
        _id: id,
        status: { $ne: 'deleted' }
      }).populate(defaultPopulate);

      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }




      // Get additional statistics
      const userStats = await user.getUserStatistics();

      const enrichedUser = {
        ...UserController.enrichUser(user),
        statistics: userStats
      };

      return UserController.standardResponse(
        res,
        true,
        enrichedUser,
        'User retrieved successfully'
      );
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return UserController.errorResponse(res, 'Failed to fetch user', 500, error.message);
    }
  }


  static async getMyProfileStatisticsController(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const profileStats = await req.user.getMyProfileStatistics();

      return res.json({ success: true, data: profileStats });
    } catch (error) {
      console.error('Error fetching profile stats:', error);
      return res.status(500).json({ success: false, message: 'Server Error' });
    }
  }


  /**
   * UPDATE USER - with smart field updates and auto-calculations
   */
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return UserController.errorResponse(res, 'Invalid user ID format', 400);
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return UserController.errorResponse(res, 'Validation failed', 400, errors.array());
      }

      // Remove fields that shouldn't be directly updated
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.created_by;
      delete updateData.hash_password;

      // Auto-update fields
      if (req.user) {
        updateData.updated_by = req.user.id;
      }
      updateData.updatedAt = new Date();

      const user = await User.findOneAndUpdate(
        { _id: id, status: { $ne: 'deleted' } },
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate([
        { path: 'role', select: 'name permissions' },
        { path: 'updated_by', select: 'name email' }
      ]);

      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      return UserController.standardResponse(
        res,
        true,
        UserController.enrichUser(user),
        'User updated successfully'
      );
    } catch (error) {
      console.error('Failed to update user:', error);
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return UserController.errorResponse(res, `${field} already exists`, 400, 'Duplicate key error');
      }
      return UserController.errorResponse(res, 'Failed to update user', 500, error.message);
    }
  }

  /**
   * DELETE USER - soft delete with archive
   */
  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const { permanent = false } = req.query;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return UserController.errorResponse(res, 'Invalid user ID format', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      let result;
      if (permanent === 'true') {
        // Permanent delete
        result = await User.findOneAndDelete({
          _id: id,
          status: { $ne: 'deleted' }
        });
      } else {
        // Soft delete using model method
        await user.deleteAccount();
        result = { _id: id };
      }

      return UserController.standardResponse(
        res,
        true,
        { id: result._id },
        permanent === 'true' ? 'User permanently deleted' : 'User deleted successfully'
      );
    } catch (error) {
      console.error('Failed to delete user:', error);
      return UserController.errorResponse(res, 'Failed to delete user', 500, error.message);
    }
  }

  // ========================================
  // 🔐 AUTHENTICATION OPERATIONS
  // ========================================

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
  async verifyMFA(req, res) {
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
  async logout(req, res) {
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
  async logoutAll(req, res) {
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
  async refreshToken(req, res) {
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
  async generateOTP(req, res) {
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
  async verifyOTP(req, res) {
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
      if (!email || !otpCode || !newPassword || !confirmPassword || !token) {
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
      const { token } = req.body;

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

  // ========================================
  // 🛒 WISHLIST OPERATIONS
  // ========================================

  /**
   * ADD TO WISHLIST
   */
  static async addToWishlist(req, res) {
    try {
      const { id } = req.params;
      const { productId } = req.body;

      if (!productId) {
        return UserController.errorResponse(res, 'Product ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const wishlist = await user.addToWishlist(productId);

      return UserController.standardResponse(
        res,
        true,
        wishlist,
        'Product added to wishlist'
      );
    } catch (error) {
      console.error('Add to wishlist error:', error);
      return UserController.errorResponse(res, 'Failed to add to wishlist', 500, error.message);
    }
  }

  /**
   * REMOVE FROM WISHLIST
   */
  static async removeFromWishlist(req, res) {
    try {
      const { id } = req.params;
      const { productId } = req.body;

      if (!productId) {
        return UserController.errorResponse(res, 'Product ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const wishlist = await user.removeFromWishlist(productId);

      return UserController.standardResponse(
        res,
        true,
        wishlist,
        'Product removed from wishlist'
      );
    } catch (error) {
      console.error('Remove from wishlist error:', error);
      return UserController.errorResponse(res, 'Failed to remove from wishlist', 500, error.message);
    }
  }

  /**
   * CLEAR WISHLIST
   */
  static async clearWishlist(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const result = await user.clearWishlist();

      return UserController.standardResponse(
        res,
        true,
        result,
        'Wishlist cleared successfully'
      );
    } catch (error) {
      console.error('Clear wishlist error:', error);
      return UserController.errorResponse(res, 'Failed to clear wishlist', 500, error.message);
    }
  }

  /**
   * GET WISHLIST COUNT
   */
  static async getWishlistCount(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const count = await user.getWishlistCount();

      return UserController.standardResponse(
        res,
        true,
        { count },
        'Wishlist count retrieved'
      );
    } catch (error) {
      console.error('Get wishlist count error:', error);
      return UserController.errorResponse(res, 'Failed to get wishlist count', 500, error.message);
    }
  }

  // ========================================
  // ⭐ FAVORITES OPERATIONS
  // ========================================

  /**
   * ADD FAVORITE PRODUCT
   */
  static async addFavoriteProduct(req, res) {
    try {
      const { id } = req.params;
      const { productId } = req.body;

      if (!productId) {
        return UserController.errorResponse(res, 'Product ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const favorites = await user.addFavoriteProduct(productId);

      return UserController.standardResponse(
        res,
        true,
        favorites,
        'Product added to favorites'
      );
    } catch (error) {
      console.error('Add favorite product error:', error);
      return UserController.errorResponse(res, 'Failed to add favorite product', 500, error.message);
    }
  }

  /**
   * REMOVE FAVORITE PRODUCT
   */
  static async removeFavoriteProduct(req, res) {
    try {
      const { id } = req.params;
      const { productId } = req.body;

      if (!productId) {
        return UserController.errorResponse(res, 'Product ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const favorites = await user.removeFavoriteProduct(productId);

      return UserController.standardResponse(
        res,
        true,
        favorites,
        'Product removed from favorites'
      );
    } catch (error) {
      console.error('Remove favorite product error:', error);
      return UserController.errorResponse(res, 'Failed to remove favorite product', 500, error.message);
    }
  }

  /**
   * MOVE ITEM FROM WISHLIST TO FAVORITES
   */
  static async moveItemWishlistToFavorites(req, res) {
    try {
      const { id } = req.params;
      const { productId } = req.body;

      if (!productId) {
        return UserController.errorResponse(res, 'Product ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.moveItemWishlistToFavorites(productId);

      return UserController.standardResponse(
        res,
        true,
        null,
        'Item moved from wishlist to favorites'
      );
    } catch (error) {
      console.error('Move item wishlist to favorites error:', error);
      return UserController.errorResponse(res, 'Failed to move item', 500, error.message);
    }
  }

  // ========================================
  // 🛍️ CART OPERATIONS
  // ========================================

  /**
   * ADD TO CART
   */
  static async addToCart(req, res) {
    try {
      const { id } = req.params;
      const { productId, quantity = 1 } = req.body;

      if (!productId) {
        return UserController.errorResponse(res, 'Product ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const cart = await user.addToCart(productId, quantity);

      return UserController.standardResponse(
        res,
        true,
        cart,
        'Product added to cart'
      );
    } catch (error) {
      console.error('Add to cart error:', error);
      return UserController.errorResponse(res, 'Failed to add to cart', 500, error.message);
    }
  }

  /**
   * REMOVE FROM CART
   */
  static async removeFromCart(req, res) {
    try {
      const { id } = req.params;
      const { productId } = req.body;

      if (!productId) {
        return UserController.errorResponse(res, 'Product ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const cart = await user.removeFromCart(productId);

      return UserController.standardResponse(
        res,
        true,
        cart,
        'Product removed from cart'
      );
    } catch (error) {
      console.error('Remove from cart error:', error);
      return UserController.errorResponse(res, 'Failed to remove from cart', 500, error.message);
    }
  }

  /**
   * UPDATE CART ITEM QUANTITY
   */
  static async updateCartItemQuantity(req, res) {
    try {
      const { id } = req.params;
      const { productId, quantity } = req.body;

      if (!productId || !quantity) {
        return UserController.errorResponse(res, 'Product ID and quantity are required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const cart = await user.updateCartItemQuantity(productId, quantity);

      return UserController.standardResponse(
        res,
        true,
        cart,
        'Cart item quantity updated'
      );
    } catch (error) {
      console.error('Update cart item quantity error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to update cart item quantity', 500);
    }
  }

  /**
   * CLEAR CART
   */
  static async clearCart(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const cart = await user.clearCart();

      return UserController.standardResponse(
        res,
        true,
        cart,
        'Cart cleared successfully'
      );
    } catch (error) {
      console.error('Clear cart error:', error);
      return UserController.errorResponse(res, 'Failed to clear cart', 500, error.message);
    }
  }

  /**
   * CALCULATE CART TOTAL
   */
  static async calculateCartTotal(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const total = await user.calculateCartTotal();

      return UserController.standardResponse(
        res,
        true,
        { total },
        'Cart total calculated'
      );
    } catch (error) {
      console.error('Calculate cart total error:', error);
      return UserController.errorResponse(res, 'Failed to calculate cart total', 500, error.message);
    }
  }

  /**
   * GET CART ITEM COUNT
   */
  static async getCartItemCount(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const count = await user.getCartItemCount();

      return UserController.standardResponse(
        res,
        true,
        { count },
        'Cart item count retrieved'
      );
    } catch (error) {
      console.error('Get cart item count error:', error);
      return UserController.errorResponse(res, 'Failed to get cart item count', 500, error.message);
    }
  }

  /**
   * MOVE ITEM FROM CART TO WISHLIST
   */
  static async moveItemCartToWishlist(req, res) {
    try {
      const { id } = req.params;
      const { productId } = req.body;

      if (!productId) {
        return UserController.errorResponse(res, 'Product ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.moveItemCartToWishlist(productId);

      return UserController.standardResponse(
        res,
        true,
        null,
        'Item moved from cart to wishlist'
      );
    } catch (error) {
      console.error('Move item cart to wishlist error:', error);
      return UserController.errorResponse(res, 'Failed to move item', 500, error.message);
    }
  }

  // ========================================
  // ⚙️ PREFERENCES OPERATIONS
  // ========================================

  /**
   * UPDATE PREFERENCES
   */
  static async updatePreferences(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const preferences = await user.updatePreferences(req.body);

      return UserController.standardResponse(
        res,
        true,
        preferences,
        'Preferences updated successfully'
      );
    } catch (error) {
      console.error('Update preferences error:', error);
      return UserController.errorResponse(res, 'Failed to update preferences', 500, error.message);
    }
  }

  /**
   * TOGGLE NEWSLETTER SUBSCRIPTION
   */
  static async toggleNewsletterSubscription(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const newsletter = await user.toggleNewsletterSubscription();

      return UserController.standardResponse(
        res,
        true,
        { newsletter },
        'Newsletter subscription toggled'
      );
    } catch (error) {
      console.error('Toggle newsletter subscription error:', error);
      return UserController.errorResponse(res, 'Failed to toggle newsletter subscription', 500, error.message);
    }
  }

  /**
   * TOGGLE NOTIFICATIONS
   */
  static async toggleNotifications(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const notifications = await user.toggleNotifications();

      return UserController.standardResponse(
        res,
        true,
        { notifications },
        'Notifications toggled'
      );
    } catch (error) {
      console.error('Toggle notifications error:', error);
      return UserController.errorResponse(res, 'Failed to toggle notifications', 500, error.message);
    }
  }

  /**
   * SET THEME PREFERENCE
   */
  static async setThemePreference(req, res) {
    try {
      const { id } = req.params;
      const { theme } = req.body;

      if (!theme || !['light', 'dark'].includes(theme)) {
        return UserController.errorResponse(res, 'Valid theme (light/dark) is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const updatedTheme = await user.setThemePreference(theme);

      return UserController.standardResponse(
        res,
        true,
        { theme: updatedTheme },
        'Theme preference updated'
      );
    } catch (error) {
      console.error('Set theme preference error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to set theme preference', 500);
    }
  }

  /**
   * UPDATE LANGUAGE PREFERENCE
   */
  static async updateLanguagePreference(req, res) {
    try {
      const { id } = req.params;
      const { languageCode } = req.body;

      if (!languageCode) {
        return UserController.errorResponse(res, 'Language code is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.updateLanguagePreference(languageCode);

      return UserController.standardResponse(
        res,
        true,
        { language: languageCode },
        'Language preference updated'
      );
    } catch (error) {
      console.error('Update language preference error:', error);
      return UserController.errorResponse(res, 'Failed to update language preference', 500, error.message);
    }
  }

  // ========================================
  // 🏆 LOYALTY POINTS OPERATIONS
  // ========================================

  /**
   * ADD LOYALTY POINTS
   */
  static async addLoyaltyPoints(req, res) {
    try {
      const { id } = req.params;
      const { points } = req.body;

      if (!points || points <= 0) {
        return UserController.errorResponse(res, 'Valid points amount is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const totalPoints = await user.addLoyaltyPoints(points);

      return UserController.standardResponse(
        res,
        true,
        { loyaltyPoints: totalPoints },
        'Loyalty points added'
      );
    } catch (error) {
      console.error('Add loyalty points error:', error);
      return UserController.errorResponse(res, 'Failed to add loyalty points', 500, error.message);
    }
  }

  /**
   * REDEEM LOYALTY POINTS
   */
  static async redeemLoyaltyPoints(req, res) {
    try {
      const { id } = req.params;
      const { points } = req.body;

      if (!points || points <= 0) {
        return UserController.errorResponse(res, 'Valid points amount is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const totalPoints = await user.redeemLoyaltyPoints(points);

      return UserController.standardResponse(
        res,
        true,
        { loyaltyPoints: totalPoints },
        'Loyalty points redeemed'
      );
    } catch (error) {
      console.error('Redeem loyalty points error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to redeem loyalty points', 500);
    }
  }

  /**
   * TRANSFER LOYALTY POINTS
   */
  static async transferLoyaltyPoints(req, res) {
    try {
      const { id } = req.params;
      const { toUserId, points } = req.body;

      if (!toUserId || !points || points <= 0) {
        return UserController.errorResponse(res, 'Valid recipient user ID and points amount are required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const success = await user.transferLoyaltyPoints(toUserId, points);

      return UserController.standardResponse(
        res,
        true,
        { success },
        'Loyalty points transferred'
      );
    } catch (error) {
      console.error('Transfer loyalty points error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to transfer loyalty points', 500);
    }
  }

  /**
   * RESET LOYALTY POINTS
   */
  static async resetLoyaltyPoints(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.resetLoyaltyPoints();

      return UserController.standardResponse(
        res,
        true,
        { loyaltyPoints: 0 },
        'Loyalty points reset'
      );
    } catch (error) {
      console.error('Reset loyalty points error:', error);
      return UserController.errorResponse(res, 'Failed to reset loyalty points', 500, error.message);
    }
  }

  // ========================================
  // 💳 SUBSCRIPTION OPERATIONS
  // ========================================

  /**
   * UPDATE SUBSCRIPTION
   */
  static async updateSubscription(req, res) {
    try {
      const { id } = req.params;
      const { type } = req.body;

      if (!type || !['free', 'premium', 'enterprise'].includes(type)) {
        return UserController.errorResponse(res, 'Valid subscription type is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const subscription = await user.activateSubscription(type);

      return UserController.standardResponse(
        res,
        true,
        subscription,
        'Subscription updated'
      );
    } catch (error) {
      console.error('Update subscription error:', error);
      return UserController.errorResponse(res, 'Failed to update subscription', 500, error.message);
    }
  }

  /**
   * CANCEL SUBSCRIPTION
   */
  static async cancelSubscription(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const status = await user.cancelSubscription();

      return UserController.standardResponse(
        res,
        true,
        { subscriptionStatus: status },
        'Subscription cancelled'
      );
    } catch (error) {
      console.error('Cancel subscription error:', error);
      return UserController.errorResponse(res, 'Failed to cancel subscription', 500, error.message);
    }
  }

  // ========================================
  // 🚫 ACCOUNT STATUS OPERATIONS
  // ========================================

  /**
   * UPDATE STATUS
   */
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['active', 'inactive', 'pending', 'banned', 'deleted', 'archived', 'draft'];
      if (!status || !validStatuses.includes(status)) {
        return UserController.errorResponse(res, 'Valid status is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const updatedStatus = await user.updateStatus(status);

      return UserController.standardResponse(
        res,
        true,
        { status: updatedStatus },
        'User status updated'
      );
    } catch (error) {
      console.error('Update status error:', error);
      return UserController.errorResponse(res, 'Failed to update status', 500, error.message);
    }
  }

  /**
   * DEACTIVATE ACCOUNT
   */
  static async deactivateAccount(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.deactivateAccount(reason);

      return UserController.standardResponse(
        res,
        true,
        null,
        'Account deactivated'
      );
    } catch (error) {
      console.error('Deactivate account error:', error);
      return UserController.errorResponse(res, 'Failed to deactivate account', 500, error.message);
    }
  }

  // Activate user
  static async activateUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.user._id;

      // Check if admin has permission
      if (!req.user.role || req.user.role.name !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin role required.'
        });
      }

      const user = await User.adminActivateUser(userId, adminId, reason);

      return res.status(200).json({
        success: true,
        message: 'User activated successfully',
        data: {
          userId: user._id,
          username: user.username,
          email: user.email,
          status: user.status,
          updatedAt: user.updatedAt
        }
      });

    } catch (error) {
      console.error('Activate user error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to activate user'
      });
    }
  }

  // Deactivate user
  static async deactivateUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.user._id;

      // Check if admin has permission
      if (!req.user.role || req.user.role.name !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin role required.'
        });
      }

      // Prevent self-deactivation
      if (userId === adminId.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account'
        });
      }

      const user = await User.adminDeactivateUser(userId, adminId, reason);

      return res.status(200).json({
        success: true,
        message: 'User deactivated successfully',
        data: {
          userId: user._id,
          username: user.username,
          email: user.email,
          status: user.status,
          updatedAt: user.updatedAt
        }
      });

    } catch (error) {
      console.error('Deactivate user error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to deactivate user'
      });
    }
  }

  /**
   * REACTIVATE ACCOUNT
   */
  static async reactivateAccount(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.reactivateAccount();

      return UserController.standardResponse(
        res,
        true,
        null,
        'Account reactivated'
      );
    } catch (error) {
      console.error('Reactivate account error:', error);
      return UserController.errorResponse(res, 'Failed to reactivate account', 500, error.message);
    }
  }

  /**
   * LOCK ACCOUNT
   */
  static async lockAccount(req, res) {
    try {
      const { id } = req.params;
      const { durationMs } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.lockAccount(durationMs || 3600000); // Default 1 hour

      return UserController.standardResponse(
        res,
        true,
        null,
        'Account locked'
      );
    } catch (error) {
      console.error('Lock account error:', error);
      return UserController.errorResponse(res, 'Failed to lock account', 500, error.message);
    }
  }

  /**
   * UNLOCK ACCOUNT
   */
  static async unlockAccount(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.unlockAccount();

      return UserController.standardResponse(
        res,
        true,
        null,
        'Account unlocked'
      );
    } catch (error) {
      console.error('Unlock account error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to unlock account', 500);
    }
  }

  // ========================================
  // 🏠 ADDRESS OPERATIONS
  // ========================================

  /**
   * ADD ADDRESS
   */
  static async addAddress(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const addresses = await user.addAddress(req.body);

      return UserController.standardResponse(
        res,
        true,
        addresses,
        'Address added successfully'
      );
    } catch (error) {
      console.error('Add address error:', error);
      return UserController.errorResponse(res, 'Failed to add address', 500, error.message);
    }
  }

  /**
   * REMOVE ADDRESS
   */
  static async removeAddress(req, res) {
    try {
      const { id } = req.params;
      const { addressId } = req.body;

      if (!addressId) {
        return UserController.errorResponse(res, 'Address ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const addresses = await user.removeAddress(addressId);

      return UserController.standardResponse(
        res,
        true,
        addresses,
        'Address removed successfully'
      );
    } catch (error) {
      console.error('Remove address error:', error);
      return UserController.errorResponse(res, 'Failed to remove address', 500, error.message);
    }
  }

  /**
   * SET DEFAULT ADDRESS
   */
  static async setDefaultAddress(req, res) {
    try {
      const { id } = req.params;
      const { addressId } = req.body;

      if (!addressId) {
        return UserController.errorResponse(res, 'Address ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const addresses = await user.setDefaultAddress(addressId);

      return UserController.standardResponse(
        res,
        true,
        addresses,
        'Default address set'
      );
    } catch (error) {
      console.error('Set default address error:', error);
      return UserController.errorResponse(res, 'Failed to set default address', 500, error.message);
    }
  }

  // ========================================
  // 💳 PAYMENT METHOD OPERATIONS
  // ========================================

  /**
   * ADD PAYMENT METHOD
   */
  static async addPaymentMethod(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const paymentMethods = await user.addPaymentMethod(req.body);

      return UserController.standardResponse(
        res,
        true,
        paymentMethods,
        'Payment method added'
      );
    } catch (error) {
      console.error('Add payment method error:', error);
      return UserController.errorResponse(res, 'Failed to add payment method', 500, error.message);
    }
  }

  /**
   * REMOVE PAYMENT METHOD
   */
  static async removePaymentMethod(req, res) {
    try {
      const { id } = req.params;
      const { methodId } = req.body;

      if (!methodId) {
        return UserController.errorResponse(res, 'Method ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const paymentMethods = await user.removePaymentMethod(methodId);

      return UserController.standardResponse(
        res,
        true,
        paymentMethods,
        'Payment method removed'
      );
    } catch (error) {
      console.error('Remove payment method error:', error);
      return UserController.errorResponse(res, 'Failed to remove payment method', 500, error.message);
    }
  }

  /**
   * SET DEFAULT PAYMENT METHOD
   */
  static async setDefaultPaymentMethod(req, res) {
    try {
      const { id } = req.params;
      const { methodId } = req.body;

      if (!methodId) {
        return UserController.errorResponse(res, 'Method ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const paymentMethods = await user.setDefaultPaymentMethod(methodId);

      return UserController.standardResponse(
        res,
        true,
        paymentMethods,
        'Default payment method set'
      );
    } catch (error) {
      console.error('Set default payment method error:', error);
      return UserController.errorResponse(res, 'Failed to set default payment method', 500, error.message);
    }
  }

  // ========================================
  // 📱 SOCIAL MEDIA OPERATIONS
  // ========================================

  /**
   * UPDATE SOCIAL MEDIA
   */
  static async updateSocialMedia(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const socialMedia = await user.updateSocialMedia(req.body);

      return UserController.standardResponse(
        res,
        true,
        socialMedia,
        'Social media updated'
      );
    } catch (error) {
      console.error('Update social media error:', error);
      return UserController.errorResponse(res, 'Failed to update social media', 500, error.message);
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
  // 🏷️ INTERESTS OPERATIONS
  // ========================================

  /**
   * ADD INTEREST
   */
  static async addInterest(req, res) {
    try {
      const { id } = req.params;
      const { interest } = req.body;

      if (!interest) {
        return UserController.errorResponse(res, 'Interest is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const interests = await user.addInterest(interest);

      return UserController.standardResponse(
        res,
        true,
        interests,
        'Interest added'
      );
    } catch (error) {
      console.error('Add interest error:', error);
      return UserController.errorResponse(res, 'Failed to add interest', 500, error.message);
    }
  }

  /**
   * REMOVE INTEREST
   */
  static async removeInterest(req, res) {
    try {
      const { id } = req.params;
      const { interest } = req.body;

      if (!interest) {
        return UserController.errorResponse(res, 'Interest is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const interests = await user.removeInterest(interest);

      return UserController.standardResponse(
        res,
        true,
        interests,
        'Interest removed'
      );
    } catch (error) {
      console.error('Remove interest error:', error);
      return UserController.errorResponse(res, 'Failed to remove interest', 500, error.message);
    }
  }

  /**
   * ADD INTEREST CATEGORY
   */
  static async addInterestCategory(req, res) {
    try {
      const { id } = req.params;
      const { category } = req.body;

      if (!category) {
        return UserController.errorResponse(res, 'Category is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.addInterestCategory(category);

      return UserController.standardResponse(
        res,
        true,
        null,
        'Interest category added'
      );
    } catch (error) {
      console.error('Add interest category error:', error);
      return UserController.errorResponse(res, 'Failed to add interest category', 500, error.message);
    }
  }

  /**
   * CLEAR INTERESTS
   */
  static async clearInterests(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const interests = await user.clearInterests();

      return UserController.standardResponse(
        res,
        true,
        interests,
        'Interests cleared'
      );
    } catch (error) {
      console.error('Clear interests error:', error);
      return UserController.errorResponse(res, 'Failed to clear interests', 500, error.message);
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

  /**
   * UPDATE LOGIN TIMESTAMP
   */
  static async updateLoginTimestamp(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.updateLoginTimestamp();

      return UserController.standardResponse(
        res,
        true,
        null,
        'Login timestamp updated'
      );
    } catch (error) {
      console.error('Update login timestamp error:', error);
      return UserController.errorResponse(res, 'Failed to update login timestamp', 500, error.message);
    }
  }

  /**
   * INCREMENT FAILED LOGINS
   */
  static async incrementFailedLogins(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.incrementFailedLogins();

      return UserController.standardResponse(
        res,
        true,
        null,
        'Failed login count incremented'
      );
    } catch (error) {
      console.error('Increment failed logins error:', error);
      return UserController.errorResponse(res, 'Failed to increment failed logins', 500, error.message);
    }
  }

  /**
   * RESET FAILED LOGINS
   */
  static async resetFailedLogins(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.resetFailedLogins();

      return UserController.standardResponse(
        res,
        true,
        null,
        'Failed login count reset'
      );
    } catch (error) {
      console.error('Reset failed logins error:', error);
      return UserController.errorResponse(res, 'Failed to reset failed logins', 500, error.message);
    }
  }

  // ========================================
  // 📦 ORDER OPERATIONS
  // ========================================

  /**
   * ADD ORDER
   */
  static async addOrder(req, res) {
    try {
      const { id } = req.params;
      const { orderId } = req.body;

      if (!orderId) {
        return UserController.errorResponse(res, 'Order ID is required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      await user.addOrder(orderId);

      return UserController.standardResponse(
        res,
        true,
        null,
        'Order added'
      );
    } catch (error) {
      console.error('Add order error:', error);
      return UserController.errorResponse(res, 'Failed to add order', 500, error.message);
    }
  }

  /**
   * GET ORDER HISTORY
   */
  static async getOrderHistory(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const orders = await user.getOrderHistory();

      return UserController.standardResponse(
        res,
        true,
        orders,
        'Order history retrieved'
      );
    } catch (error) {
      console.error('Get order history error:', error);
      return UserController.errorResponse(res, 'Failed to get order history', 500, error.message);
    }
  }

  // ========================================
  // 📊 REPORTING OPERATIONS
  // ========================================

  /**
   * GET USER STATISTICS
   */
  static async getUserStatistics(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const stats = await user.getUserStatistics();

      return UserController.standardResponse(
        res,
        true,
        stats,
        'User statistics retrieved'
      );
    } catch (error) {
      console.error('Get user statistics error:', error);
      return UserController.errorResponse(res, 'Failed to get user statistics', 500, error.message);
    }
  }

  /**
   * GET USER REPORT
   */
  static async getUserReport(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const report = await user.getUserReport();

      return UserController.standardResponse(
        res,
        true,
        report,
        'User report retrieved'
      );
    } catch (error) {
      console.error('Get user report error:', error);
      return UserController.errorResponse(res, 'Failed to get user report', 500, error.message);
    }
  }

  /**
   * GET ACTIVITY SUMMARY
   */
  static async getActivitySummary(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const summary = await user.getActivitySummary();

      return UserController.standardResponse(
        res,
        true,
        summary,
        'Activity summary retrieved'
      );
    } catch (error) {
      console.error('Get activity summary error:', error);
      return UserController.errorResponse(res, 'Failed to get activity summary', 500, error.message);
    }
  }

  /**
   * DYNAMIC UPDATE
   */
  static async dynamicUpdate(req, res) {
    try {
      const { id } = req.params;
      const { field, value } = req.body;

      if (!field || value === undefined) {
        return UserController.errorResponse(res, 'Field and value are required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const result = await user.dynamicUpdate(field, value);

      return UserController.standardResponse(
        res,
        true,
        { [field]: result },
        `${field} updated successfully`
      );
    } catch (error) {
      console.error('Dynamic update error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to update field', 500);
    }
  }

  // ========================================
  // 🔍 STATIC METHOD ENDPOINTS
  // ========================================

  /**
   * FIND BY EMAIL
   */
  static async findByEmail(req, res) {
    try {
      const { email } = req.query;

      if (!email) {
        return UserController.errorResponse(res, 'Email is required', 400);
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      return UserController.standardResponse(
        res,
        true,
        UserController.enrichUser(user),
        'User found by email'
      );
    } catch (error) {
      console.error('Find by email error:', error);
      return UserController.errorResponse(res, 'Failed to find user by email', 500, error.message);
    }
  }

  /**
   * FIND BY USERNAME
   */
  static async findByUsername(req, res) {
    try {
      const { username } = req.query;

      if (!username) {
        return UserController.errorResponse(res, 'Username is required', 400);
      }

      const user = await User.findByUsername(username);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      return UserController.standardResponse(
        res,
        true,
        UserController.enrichUser(user),
        'User found by username'
      );
    } catch (error) {
      console.error('Find by username error:', error);
      return UserController.errorResponse(res, 'Failed to find user by username', 500, error.message);
    }
  }

  /**
   * SEARCH USERS
   */
  static async searchUsers(req, res) {
    try {
      const { keyword } = req.query;

      if (!keyword) {
        return UserController.errorResponse(res, 'Search keyword is required', 400);
      }

      const users = await User.searchUsers(keyword);
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Users search completed'
      );
    } catch (error) {
      console.error('Search users error:', error);
      return UserController.errorResponse(res, 'Failed to search users', 500, error.message);
    }
  }

  /**
   * SEARCH BY EMAIL OR USERNAME
   */
  static async searchByEmailOrUsername(req, res) {
    try {
      const { term } = req.query;

      if (!term) {
        return UserController.errorResponse(res, 'Search term is required', 400);
      }

      const users = await User.searchByEmailOrUsername(term);
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Search completed'
      );
    } catch (error) {
      console.error('Search by email or username error:', error);
      return UserController.errorResponse(res, 'Failed to search by email or username', 500, error.message);
    }
  }

  /**
   * DYNAMIC SEARCH
   */
  static async dynamicSearch(req, res) {
    try {
      const { field, value } = req.query;

      if (!field || !value) {
        return UserController.errorResponse(res, 'Field and value are required', 400);
      }

      const users = await User.dynamicSearch(field, value);
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Dynamic search completed'
      );
    } catch (error) {
      console.error('Dynamic search error:', error);
      return UserController.errorResponse(res, error.message || 'Failed to perform dynamic search', 500);
    }
  }

  /**
   * GET USERS BY STATUS
   */
  static async getUsersByStatus(req, res) {
    try {
      const { status } = req.query;

      if (!status) {
        return UserController.errorResponse(res, 'Status is required', 400);
      }

      const users = await User.getUsersByStatus(status);
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Users retrieved by status'
      );
    } catch (error) {
      console.error('Get users by status error:', error);
      return UserController.errorResponse(res, 'Failed to get users by status', 500, error.message);
    }
  }

  /**
   * GET ACTIVE USERS
   */
  static async getActiveUsers(req, res) {
    try {
      const users = await User.getActiveUsers();
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Active users retrieved'
      );
    } catch (error) {
      console.error('Get active users error:', error);
      return UserController.errorResponse(res, 'Failed to get active users', 500, error.message);
    }
  }

  /**
   * GET VERIFIED USERS
   */
  static async getVerifiedUsers(req, res) {
    try {
      const users = await User.getVerifiedUsers();
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Verified users retrieved'
      );
    } catch (error) {
      console.error('Get verified users error:', error);
      return UserController.errorResponse(res, 'Failed to get verified users', 500, error.message);
    }
  }

  /**
   * GET USERS BY ROLE
   */
  static async getUsersByRole(req, res) {
    try {
      const { role } = req.query;

      if (!role) {
        return UserController.errorResponse(res, 'Role is required', 400);
      }

      const users = await User.findByRole(role);
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Users retrieved by role'
      );
    } catch (error) {
      console.error('Get users by role error:', error);
      return UserController.errorResponse(res, 'Failed to get users by role', 500, error.message);
    }
  }

  /**
   * GET ADMINS
   */
  static async getAdmins(req, res) {
    try {
      const admins = await User.getAdmins();
      const enrichedAdmins = admins.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedAdmins,
        'Admin users retrieved'
      );
    } catch (error) {
      console.error('Get admins error:', error);
      return UserController.errorResponse(res, 'Failed to get admin users', 500, error.message);
    }
  }

  /**
   * GET CUSTOMERS
   */
  static async getCustomers(req, res) {
    try {
      const customers = await User.getCustomers();
      const enrichedCustomers = customers.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedCustomers,
        'Customer users retrieved'
      );
    } catch (error) {
      console.error('Get customers error:', error);
      return UserController.errorResponse(res, 'Failed to get customer users', 500, error.message);
    }
  }

  /**
   * GET USERS BY SUBSCRIPTION TYPE
   */
  static async getUsersBySubscriptionType(req, res) {
    try {
      const { subscriptionType } = req.query;

      if (!subscriptionType) {
        return UserController.errorResponse(res, 'Subscription type is required', 400);
      }

      const users = await User.getUsersBySubscriptionType(subscriptionType);
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Users retrieved by subscription type'
      );
    } catch (error) {
      console.error('Get users by subscription type error:', error);
      return UserController.errorResponse(res, 'Failed to get users by subscription type', 500, error.message);
    }
  }

  /**
   * FIND ACTIVE USERS WITHIN DAYS
   */
  static async findActiveWithinDays(req, res) {
    try {
      const days = parseInt(req.query.days) || 30;
      const users = await User.findActiveWithinDays(days);
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        `Active users within ${days} days retrieved`
      );
    } catch (error) {
      console.error('Find active within days error:', error);
      return UserController.errorResponse(res, 'Failed to find active users within days', 500, error.message);
    }
  }

  /**
   * GET TOP LOYAL USERS
   */
  static async getTopLoyalUsers(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const users = await User.getTopLoyalUsers(limit);
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Top loyal users retrieved'
      );
    } catch (error) {
      console.error('Get top loyal users error:', error);
      return UserController.errorResponse(res, 'Failed to get top loyal users', 500, error.message);
    }
  }

  /**
   * GET NEVER LOGGED IN USERS
   */
  static async getNeverLoggedInUsers(req, res) {
    try {
      const users = await User.getNeverLoggedInUsers();
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Never logged in users retrieved'
      );
    } catch (error) {
      console.error('Get never logged in users error:', error);
      return UserController.errorResponse(res, 'Failed to get never logged in users', 500, error.message);
    }
  }

  /**
   * FIND OLDEST USER
   */
  static async findOldestUser(req, res) {
    try {
      const user = await User.findOldestUser();

      if (!user) {
        return UserController.errorResponse(res, 'No users found', 404);
      }

      return UserController.standardResponse(
        res,
        true,
        UserController.enrichUser(user),
        'Oldest user retrieved'
      );
    } catch (error) {
      console.error('Find oldest user error:', error);
      return UserController.errorResponse(res, 'Failed to find oldest user', 500, error.message);
    }
  }

  /**
   * FIND USERS WITH FAILED LOGINS
   */
  static async findUsersWithFailedLogins(req, res) {
    try {
      const threshold = parseInt(req.query.threshold) || 5;
      const users = await User.findUsersWithFailedLogins(threshold);
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Users with failed logins retrieved'
      );
    } catch (error) {
      console.error('Find users with failed logins error:', error);
      return UserController.errorResponse(res, 'Failed to find users with failed logins', 500, error.message);
    }
  }

  /**
   * FIND USERS WITH INCOMPLETE PROFILES
   */
  static async findUsersWithIncompleteProfiles(req, res) {
    try {
      const users = await User.findUsersWithIncompleteProfiles();
      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Users with incomplete profiles retrieved'
      );
    } catch (error) {
      console.error('Find users with incomplete profiles error:', error);
      return UserController.errorResponse(res, 'Failed to find users with incomplete profiles', 500, error.message);
    }
  }

  // ========================================
  // 📦 BULK OPERATION ENDPOINTS
  // ========================================

  /**
   * BULK UPDATE ROLE
   */
  static async bulkUpdateRole(req, res) {
    try {
      const { ids, role } = req.body;

      if (!Array.isArray(ids) || !role) {
        return UserController.errorResponse(res, 'Valid IDs array and role are required', 400);
      }

      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length !== ids.length) {
        return UserController.errorResponse(res, 'Some user IDs are invalid', 400);
      }

      const result = await User.bulkUpdateRole(validIds, role);

      return UserController.standardResponse(
        res,
        true,
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          role: role
        },
        'Roles updated successfully'
      );
    } catch (error) {
      console.error('Bulk update role error:', error);
      return UserController.errorResponse(res, 'Failed to bulk update roles', 500, error.message);
    }
  }

  /**
   * BULK DELETE
   */
  static async bulkDelete(req, res) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return UserController.errorResponse(res, 'Valid IDs array is required', 400);
      }

      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length !== ids.length) {
        return UserController.errorResponse(res, 'Some user IDs are invalid', 400);
      }

      const result = await User.bulkDelete(validIds);

      return UserController.standardResponse(
        res,
        true,
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          deletedCount: validIds.length
        },
        'Users deleted successfully'
      );
    } catch (error) {
      console.error('Bulk delete error:', error);
      return UserController.errorResponse(res, 'Failed to bulk delete users', 500, error.message);
    }
  }

  /**
   * BULK UPDATE STATUS
   */
  static async bulkUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;

      const validStatuses = ['active', 'inactive', 'pending', 'banned', 'deleted', 'archived', 'draft'];
      if (!Array.isArray(ids) || !status || !validStatuses.includes(status)) {
        return UserController.errorResponse(res, 'Valid IDs array and status are required', 400);
      }

      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length !== ids.length) {
        return UserController.errorResponse(res, 'Some user IDs are invalid', 400);
      }

      const result = await User.bulkUpdateStatus(validIds, status);

      return UserController.standardResponse(
        res,
        true,
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          status: status
        },
        'Status updated successfully'
      );
    } catch (error) {
      console.error('Bulk update status error:', error);
      return UserController.errorResponse(res, 'Failed to bulk update status', 500, error.message);
    }
  }

  /**
   * BULK ADD LOYALTY POINTS
   */
  static async bulkAddLoyaltyPoints(req, res) {
    try {
      const { ids, points } = req.body;

      if (!Array.isArray(ids) || !points || points <= 0) {
        return UserController.errorResponse(res, 'Valid IDs array and positive points are required', 400);
      }

      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length !== ids.length) {
        return UserController.errorResponse(res, 'Some user IDs are invalid', 400);
      }

      const result = await User.bulkAddLoyaltyPoints(validIds, points);

      return UserController.standardResponse(
        res,
        true,
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          points: points
        },
        'Loyalty points added successfully'
      );
    } catch (error) {
      console.error('Bulk add loyalty points error:', error);
      return UserController.errorResponse(res, 'Failed to bulk add loyalty points', 500, error.message);
    }
  }

  // ========================================
  // 📈 ANALYTICS & STATISTICS ENDPOINTS
  // ========================================

  /**
   * GET USER COUNT BY ROLE
   */
  static async getUserCountByRole(req, res) {
    try {
      const counts = await User.getUserCountByRole();

      return UserController.standardResponse(
        res,
        true,
        counts,
        'User count by role retrieved'
      );
    } catch (error) {
      console.error('Get user count by role error:', error);
      return UserController.errorResponse(res, 'Failed to get user count by role', 500, error.message);
    }
  }

  /**
   * GET USER COUNT BY SUBSCRIPTION
   */
  static async getUserCountBySubscription(req, res) {
    try {
      const counts = await User.getUserCountBySubscription();

      return UserController.standardResponse(
        res,
        true,
        counts,
        'User count by subscription retrieved'
      );
    } catch (error) {
      console.error('Get user count by subscription error:', error);
      return UserController.errorResponse(res, 'Failed to get user count by subscription', 500, error.message);
    }
  }

  /**
   * GET USER COUNT BY COUNTRY
   */
  static async getUserCountByCountry(req, res) {
    try {
      const counts = await User.getUserCountByCountry();

      return UserController.standardResponse(
        res,
        true,
        counts,
        'User count by country retrieved'
      );
    } catch (error) {
      console.error('Get user count by country error:', error);
      return UserController.errorResponse(res, 'Failed to get user count by country', 500, error.message);
    }
  }

  /**
   * GET AVERAGE LOYALTY POINTS
   */
  static async getAverageLoyaltyPoints(req, res) {
    try {
      const average = await User.getAverageLoyaltyPoints();

      return UserController.standardResponse(
        res,
        true,
        { average },
        'Average loyalty points retrieved'
      );
    } catch (error) {
      console.error('Get average loyalty points error:', error);
      return UserController.errorResponse(res, 'Failed to get average loyalty points', 500, error.message);
    }
  }

  /**
   * GET AVERAGE ORDERS PER USER
   */
  static async getAverageOrdersPerUser(req, res) {
    try {
      const average = await User.getAverageOrdersPerUser();

      return UserController.standardResponse(
        res,
        true,
        { average },
        'Average orders per user retrieved'
      );
    } catch (error) {
      console.error('Get average orders per user error:', error);
      return UserController.errorResponse(res, 'Failed to get average orders per user', 500, error.message);
    }
  }

  /**
   * GET USER LOYALTY BRACKETS
   */
  static async getUserLoyaltyBrackets(req, res) {
    try {
      const brackets = await User.getUserLoyaltyBrackets();

      return UserController.standardResponse(
        res,
        true,
        brackets,
        'User loyalty brackets retrieved'
      );
    } catch (error) {
      console.error('Get user loyalty brackets error:', error);
      return UserController.errorResponse(res, 'Failed to get user loyalty brackets', 500, error.message);
    }
  }

  /**
   * GET TOP USER INTERESTS
   */
  static async getTopUserInterests(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const interests = await User.getTopUserInterests(limit);

      return UserController.standardResponse(
        res,
        true,
        interests,
        'Top user interests retrieved'
      );
    } catch (error) {
      console.error('Get top user interests error:', error);
      return UserController.errorResponse(res, 'Failed to get top user interests', 500, error.message);
    }
  }

  /**
   * GET REGISTRATIONS OVER TIME
   */
  static async getRegistrationsOverTime(req, res) {
    try {
      const days = parseInt(req.query.days) || 30;
      const data = await User.getRegistrationsOverTime(days);

      return UserController.standardResponse(
        res,
        true,
        data,
        'Registration data retrieved'
      );
    } catch (error) {
      console.error('Get registrations over time error:', error);
      return UserController.errorResponse(res, 'Failed to get registration data', 500, error.message);
    }
  }

  /**
   * GET LOGIN ACTIVITY OVER TIME
   */
  static async getLoginActivityOverTime(req, res) {
    try {
      const days = parseInt(req.query.days) || 30;
      const data = await User.getLoginActivityOverTime(days);

      return UserController.standardResponse(
        res,
        true,
        data,
        'Login activity data retrieved'
      );
    } catch (error) {
      console.error('Get login activity over time error:', error);
      return UserController.errorResponse(res, 'Failed to get login activity data', 500, error.message);
    }
  }

  /**
   * GET TABLE STATISTICS
   */
  static async getTableStatistics(req, res) {
    try {
      const stats = await User.getTableStatistics();

      return UserController.standardResponse(
        res,
        true,
        stats,
        'Table statistics retrieved'
      );
    } catch (error) {
      console.error('Get table statistics error:', error);
      return UserController.errorResponse(res, 'Failed to get table statistics', 500, error.message);
    }
  }

  /**
   * GET TABLE REPORT
   */
  static async getTableReport(req, res) {
    try {
      const report = await User.getTableReport();

      return UserController.standardResponse(
        res,
        true,
        report,
        'Table report retrieved'
      );
    } catch (error) {
      console.error('Get table report error:', error);
      return UserController.errorResponse(res, 'Failed to get table report', 500, error.message);
    }
  }

  /**
   * GET USER REPORT BY ID (STATIC METHOD)
   */
  static async getUserReportByIdStatic(req, res) {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return UserController.errorResponse(res, 'Invalid user ID format', 400);
      }

      const report = await User.getUserReportById(userId);
      if (!report) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      return UserController.standardResponse(
        res,
        true,
        report,
        'User report retrieved'
      );
    } catch (error) {
      console.error('Get user report by ID static error:', error);
      return UserController.errorResponse(res, 'Failed to get user report', 500, error.message);
    }
  }

  /**
   * GET ACTIVITY SUMMARY BY ID (STATIC METHOD)
   */
  static async getActivitySummaryByIdStatic(req, res) {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return UserController.errorResponse(res, 'Invalid user ID format', 400);
      }

      const summary = await User.getActivitySummaryById(userId);
      if (!summary) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      return UserController.standardResponse(
        res,
        true,
        summary,
        'Activity summary retrieved'
      );
    } catch (error) {
      console.error('Get activity summary by ID static error:', error);
      return UserController.errorResponse(res, 'Failed to get activity summary', 500, error.message);
    }
  }

  // ========================================
  // 📥📤 EXPORT/IMPORT ENDPOINTS
  // ========================================

  /**
   * EXPORT USERS DATA
   */
  static async exportUsersData(req, res) {
    try {
      const { format = 'json', filters = {} } = req.query;

      // Parse filters if they're a string
      const parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;

      // Add default filter to exclude deleted users
      parsedFilters.status = { $ne: 'deleted' };

      const users = await User.find(parsedFilters).populate([
        { path: 'role', select: 'name' },
        { path: 'address' },
        { path: 'orders', select: 'orderNumber status total createdAt' }
      ]);

      if (format === 'csv') {
        // Convert to CSV format
        const csv = users.map(user => ({
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          status: user.status,
          isVerified: user.isVerified,
          loyaltyPoints: user.loyaltyPoints,
          subscriptionType: user.subscriptionType,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }));

        const fields = Object.keys(csv[0] || {});
        const parser = new Parser({ fields });
        const csvData = parser.parse(csv);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
        return res.send(csvData);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=users.json');

        return UserController.standardResponse(
          res,
          true,
          users.map(user => UserController.enrichUser(user)),
          'Users exported successfully'
        );
      }
    } catch (error) {
      console.error('Export users data error:', error);
      return UserController.errorResponse(res, 'Failed to export users data', 500, error.message);
    }
  }

  /**
   * EXPORT USER STATISTICS
   */
  static async exportUserStatistics(req, res) {
    try {
      const stats = await User.getTableStatistics();
      const roleCounts = await User.getUserCountByRole();
      const subscriptionCounts = await User.getUserCountBySubscription();
      const loyaltyBrackets = await User.getUserLoyaltyBrackets();
      const topInterests = await User.getTopUserInterests();

      const exportData = {
        overview: stats,
        roleCounts,
        subscriptionCounts,
        loyaltyBrackets,
        topInterests,
        exportedAt: new Date()
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=user-statistics.json');

      return UserController.standardResponse(
        res,
        true,
        exportData,
        'User statistics exported'
      );
    } catch (error) {
      console.error('Export user statistics error:', error);
      return UserController.errorResponse(res, 'Failed to export user statistics', 500, error.message);
    }
  }

  /**
   * IMPORT USERS DATA
   */
  static async importUsersData(req, res) {
    try {
      const { users } = req.body;

      if (!Array.isArray(users)) {
        return UserController.errorResponse(res, 'Users data must be an array', 400);
      }

      const results = {
        created: 0,
        updated: 0,
        errors: []
      };

      for (let userData of users) {
        try {
          const existingUser = await User.findByEmail(userData.email);
          if (existingUser) {
            Object.assign(existingUser, userData);
            await existingUser.save();
            results.updated++;
          } else {
            const newUser = new User(userData);
            if (userData.password) {
              await newUser.setPassword(userData.password);
            }
            await newUser.save();
            results.created++;
          }
        } catch (error) {
          results.errors.push({
            email: userData.email,
            error: error.message
          });
        }
      }

      return UserController.standardResponse(
        res,
        true,
        results,
        'Users import completed'
      );
    } catch (error) {
      console.error('Import users data error:', error);
      return UserController.errorResponse(res, 'Failed to import users data', 500, error.message);
    }
  }

  // ========================================
  // 🚀 ENHANCED ENDPOINTS (New Features)
  // ========================================

  /**
   * GET USERS WITH ANALYTICS
   */
  static async getUsersWithAnalytics(req, res) {
    try {
      const { limit = 20, sortBy = 'loginFrequency' } = req.query;

      const sortOptions = {
        'loginFrequency': { lastLogin: -1 },
        'loyaltyPoints': { loyaltyPoints: -1 },
        'orders': { 'orders.length': -1 },
        'activity': { updatedAt: -1 }
      };

      const sortObj = sortOptions[sortBy] || { lastLogin: -1 };

      const users = await User.find({
        status: { $ne: 'deleted' }
      })
        .populate([
          { path: 'role', select: 'name' },
          { path: 'orders', select: 'total status createdAt' }
        ])
        .sort(sortObj)
        .limit(parseInt(limit));

      const enrichedUsers = users.map(user => ({
        ...UserController.enrichUser(user),
        analytics: {
          profileCompleteness: UserController.calculateProfileCompleteness(user),
          activityLevel: UserController.getUserActivityLevel(user),
          userScore: UserController.calculateUserScore(user)
        }
      }));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        `Retrieved ${enrichedUsers.length} users with analytics sorted by ${sortBy}`
      );
    } catch (error) {
      console.error('Get users with analytics error:', error);
      return UserController.errorResponse(res, 'Failed to get users with analytics', 500, error.message);
    }
  }

  /**
   * USER ENGAGEMENT METRICS
   */
  static async getUserEngagementMetrics(req, res) {
    try {
      const { from, to } = req.query;
      const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      const metrics = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate, $lte: toDate },
            status: { $ne: 'deleted' }
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            verifiedUsers: {
              $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
            },
            activeUsers: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            avgLoyaltyPoints: { $avg: '$loyaltyPoints' },
            premiumUsers: {
              $sum: { $cond: [{ $eq: ['$subscriptionType', 'premium'] }, 1, 0] }
            }
          }
        }
      ]);

      const result = metrics[0] || {
        totalUsers: 0,
        verifiedUsers: 0,
        activeUsers: 0,
        avgLoyaltyPoints: 0,
        premiumUsers: 0
      };

      return UserController.standardResponse(
        res,
        true,
        result,
        'User engagement metrics retrieved'
      );
    } catch (error) {
      console.error('Get user engagement metrics error:', error);
      return UserController.errorResponse(res, 'Failed to get user engagement metrics', 500, error.message);
    }
  }

  // 1. Favorites / Wishlist Management
  static async addFavorite(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const productId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return UserController.errorResponse(res, 'Invalid product ID', 400);
      }

      if (!user.favoriteProducts.includes(productId)) {
        user.favoriteProducts.push(productId);
        await user.save();
      }

      return UserController.standardResponse(
        res,
        true,
        user.favoriteProducts,
        'Added to favorites'
      );
    } catch (error) {
      console.error('Add favorite error:', error);
      return UserController.errorResponse(res, 'Failed to add favorite', 500, error.message);
    }
  }

  static async removeFavorite(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      const productId = req.params.id;
      user.favoriteProducts = user.favoriteProducts.filter(
        pid => pid.toString() !== productId
      );
      await user.save();

      return UserController.standardResponse(
        res,
        true,
        user.favoriteProducts,
        'Removed from favorites'
      );
    } catch (error) {
      console.error('Remove favorite error:', error);
      return UserController.errorResponse(res, 'Failed to remove favorite', 500, error.message);
    }
  }

  static async listFavorites(req, res) {
    try {
      const user = await User.findById(req.user.id)
        .populate({
          path: 'favoriteProducts',
          select: 'title basePrice mainImage'
        });

      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      return UserController.standardResponse(
        res,
        true,
        user.favoriteProducts,
        'Favorites retrieved successfully'
      );
    } catch (error) {
      console.error('List favorites error:', error);
      return UserController.errorResponse(res, 'Failed to fetch favorites', 500, error.message);
    }
  }

  // 2. Recommendations
  static async getRecommendations(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id).lean();
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      // Get recommendations based on user's interests, past orders, etc.
      const recommendations = await Product.find({
        categories: { $in: user.interests || [] },
        status: 'active'
      })
        .sort({ soldCount: -1 })
        .limit(10)
        .select('title basePrice mainImage');

      return UserController.standardResponse(
        res,
        true,
        recommendations,
        'Recommendations retrieved successfully'
      );
    } catch (error) {
      console.error('Get recommendations error:', error);
      return UserController.errorResponse(res, 'Failed to fetch recommendations', 500, error.message);
    }
  }

  // 3. Import/Export CSV
  static async importCSV(req, res) {
    try {
      if (!req.file) {
        return UserController.errorResponse(res, 'CSV file required', 400);
      }

      const results = [];
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', data => results.push(data))
        .on('end', async () => {
          try {
            const ops = results.map(item => ({
              updateOne: {
                filter: { email: item.email },
                update: { $set: item },
                upsert: true
              }
            }));

            await User.bulkWrite(ops);
            fs.unlinkSync(req.file.path);

            return UserController.standardResponse(
              res,
              true,
              { imported: results.length },
              `Imported ${results.length} users`
            );
          } catch (error) {
            fs.unlinkSync(req.file.path);
            throw error;
          }
        });
    } catch (error) {
      console.error('Import CSV error:', error);
      return UserController.errorResponse(res, 'Import failed', 500, error.message);
    }
  }

  static async exportCSV(req, res) {
    try {
      const users = await User.find({
        status: { $ne: 'deleted' }
      }).lean();

      if (users.length === 0) {
        return UserController.errorResponse(res, 'No users to export', 404);
      }

      const fields = Object.keys(users[0]);
      const parser = new Parser({ fields });
      const csvData = parser.parse(users);

      res.header('Content-Type', 'text/csv');
      res.attachment('users_export.csv');
      res.send(csvData);
    } catch (error) {
      console.error('Export CSV error:', error);
      return UserController.errorResponse(res, 'Export failed', 500, error.message);
    }
  }

  // 4. Enhanced Analytics
  static async getUserMetrics(req, res) {
    try {
      const { from, to } = req.query;
      const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      const metrics = await User.aggregate([
        { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            avgLoyaltyPoints: { $avg: '$loyaltyPoints' },
            verifiedUsers: {
              $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] }
            },
            activeSubscriptions: {
              $sum: { $cond: [{ $ne: ['$subscriptionType', 'free'] }, 1, 0] }
            }
          }
        }
      ]);

      return UserController.standardResponse(
        res,
        true,
        metrics[0] || {},
        'User metrics retrieved successfully'
      );
    } catch (error) {
      console.error('Get user metrics error:', error);
      return UserController.errorResponse(res, 'Failed to fetch user metrics', 500, error.message);
    }
  }

  static async getPopularityMetrics(req, res) {
    try {
      const limit = Number(req.query.limit) || 10;

      const popularUsers = await User.find({
        status: { $ne: 'deleted' }
      })
        .sort({ loyaltyPoints: -1, 'orders.length': -1 })
        .limit(limit)
        .select('username email loyaltyPoints orders createdAt')
        .populate('orders', 'total status');

      const enrichedUsers = popularUsers.map(user => ({
        ...user.toObject(),
        totalSpent: user.orders.reduce((sum, order) => sum + (order.total || 0), 0),
        orderCount: user.orders.length
      }));

      return UserController.standardResponse(
        res,
        true,
        enrichedUsers,
        'Popularity metrics retrieved successfully'
      );
    } catch (error) {
      console.error('Get popularity metrics error:', error);
      return UserController.errorResponse(res, 'Failed to fetch popularity metrics', 500, error.message);
    }
  }

  // 5. Notification Management
  static async sendNotification(req, res) {
    try {
      const { id } = req.params;
      const { title, message, type = 'info' } = req.body;

      if (!title || !message) {
        return UserController.errorResponse(res, 'Title and message are required', 400);
      }

      const user = await User.findById(id);
      if (!user) {
        return UserController.errorResponse(res, 'User not found', 404);
      }

      // Here you would typically integrate with a notification service
      // For now, we'll just simulate sending a notification

      return UserController.standardResponse(
        res,
        true,
        { sent: true, userId: id, title, message, type },
        'Notification sent successfully'
      );
    } catch (error) {
      console.error('Send notification error:', error);
      return UserController.errorResponse(res, 'Failed to send notification', 500, error.message);
    }
  }

  // 6. Advanced Search with Filters
  static async advancedSearch(req, res) {
    try {
      const {
        query,
        filters = {},
        sort = 'createdAt',
        order = 'desc',
        page = 1,
        limit = 20
      } = req.query;

      // Parse filters if string
      const parsedFilters = typeof filters === 'string' ? JSON.parse(filters) : filters;

      // Build search query
      const searchQuery = { status: { $ne: 'deleted' }, ...parsedFilters };

      if (query) {
        searchQuery.$or = [
          { firstName: { $regex: query, $options: 'i' } },
          { lastName: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
          { username: { $regex: query, $options: 'i' } }
        ];
      }

      const sortObj = {};
      sortObj[sort] = order === 'desc' ? -1 : 1;

      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find(searchQuery)
          .populate('role', 'name')
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit)),
        User.countDocuments(searchQuery)
      ]);

      const enrichedUsers = users.map(user => UserController.enrichUser(user));

      return UserController.standardResponse(
        res,
        true,
        {
          users: enrichedUsers,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalUsers: total,
            hasNext: page * limit < total,
            hasPrev: page > 1
          }
        },
        'Advanced search completed'
      );
    } catch (error) {
      console.error('Advanced search error:', error);
      return UserController.errorResponse(res, 'Advanced search failed', 500, error.message);
    }
  }



  static async assignUserRoleById(req, res, next) {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;

      if (!roleId) {
        throw new APIError('roleId field is required', 400);
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new APIError('User not found', 404);
      }

      // Optional: Verify roleId exists in Role collection before assignment here

      user.role = roleId;
      await user.save();

      // Optionally populate role details
      await user.populate('role');

      res.status(200).json(formatResponse('Role assigned to user successfully', {
        id: user._id,
        email: user.email,
        role: user.role.name
      }));
    } catch (err) {
      next(err);
    }
  }

}

module.exports = UserController;