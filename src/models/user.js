const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const Wishlist = require('./wishlist');
const Cart = require('./cart');
const Product = require('./products');
const Address = require('./address');
const Order = require('./orders');
const Role = require('./role');
const { jwtSecret } = require('../config/setting');
const otpService = require('../services/otpService');
const SALT_ROUNDS = 10;

// Environment variables with enhanced defaults
const {
  JWT_SECRET = 'your-super-secret-jwt-key',
  JWT_ID_SECRET = "dasd98a7sd97as89d7a98sd7",
  JWT_REFRESH_SECRET = 'your-super-secret-refresh-key',
  JWT_EXPIRY = '15m',
  JWT_REFRESH_EXPIRY = '7d',
  JWT_ID_EXPIRY = '30d',
  JWT_ALGORITHM = 'HS256',
  JWT_ISSUER = 'your-app-name',
  JWT_AUDIENCE = 'your-app-users',
  OTP_TYPE = 'email', // 'email' or 'sms'
  OTP_EXPIRY_MINUTES = '5',
  MAX_LOGIN_ATTEMPTS = '5',
  LOCKOUT_TIME_MINUTES = '30',
  OTP_SECRET = 'your-otp-secret',
  ENABLE_OTP_VERIFICATION = 'false',
  OTP_PRIORITY_ORDER = 'totp,email,sms',
  DEFAULT_OTP_METHOD = 'totp',

  SESSION_TIMEOUT_MINUTES = '120',
  MAX_CONCURRENT_SESSIONS = '3',
  REQUIRE_DEVICE_VERIFICATION = 'false',
  ENABLE_SUSPICIOUS_LOGIN_DETECTION = 'true'
} = process.env;


const MAX_ATTEMPTS = parseInt(MAX_LOGIN_ATTEMPTS);
const LOCK_TIME = parseInt(LOCKOUT_TIME_MINUTES) * 60 * 1000;
const OTP_EXPIRY = parseInt(OTP_EXPIRY_MINUTES) * 60 * 1000;
const SESSION_TIMEOUT = parseInt(SESSION_TIMEOUT_MINUTES) * 60 * 1000;
const MAX_SESSIONS = parseInt(MAX_CONCURRENT_SESSIONS);

const userSchema = new mongoose.Schema(
  {
    // ─────────── Identity & Authentication ───────────
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    socialID: { type: String, default: null },
    email: { type: String, required: true, unique: true, lowercase: true },
    hash_password: { type: String, required: false },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },

    // ─────────── Personal Information ───────────
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    dateOfBirth: { type: Date, default: null },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer_not_to_say"],
      default: null,
      trim: true,
    },
    phoneNumber: { type: String, default: null, match: /^[0-9]{10}$/ },
    profilePicture: { type: String, default: null },

    // ─────────── Verification & Security ───────────
    isVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null },
    emailVerificationExpiry: { type: Date, default: null },
    confirmToken: { type: String, default: null },

    // OTP Management
    otpCode: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    otpType: { type: String, enum: ["email", "sms", "login", "reset", "verification"], default: null },
    otpAttempts: { type: Number, default: 0 },
    otpLastSent: { type: Date, default: null },

    // Login & Security Events
    failedLoginAttempts: { type: Number, default: 0 },
    consecutiveFailedAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, default: null },
    lastLoginAttempt: { type: Date, default: null },
    lastLogin: { type: Date, default: null },

    loginHistory: [{
      loginTime: Date,
      ipAddress: String,
      userAgent: String,
      successful: Boolean,
      failureReason: String,
      deviceId: String,
      otpUsed: { type: String, enum: ['totp', 'email', 'sms', 'backup', 'none'], default: 'none' }
    }],

    // Security Events & Audit Log
    securityEvents: [{
      event: { type: String, required: true },
      description: { type: String, default: null },
      severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
      timestamp: { type: Date, default: Date.now },
      ipAddress: { type: String, default: null },
      userAgent: { type: String, default: null },
      deviceId: { type: String, default: null },
      metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
    }],

    // ─────────── Session & Tokens ───────────
    refreshTokens: [
      {
        token: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        userAgent: { type: String, default: null },
        ipAddress: { type: String, default: null },
        isActive: { type: Boolean, default: true },
      },
    ],
    // Session Management
    activeSessions: [
      {
        sessionId: { type: String, required: true },
        deviceId: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        lastActivity: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        ipAddress: { type: String, default: null },
        userAgent: { type: String, default: null },
        isActive: { type: Boolean, default: true }
      }
    ],
    tokens: [{ token: { type: String } }],
     isDeleted: { type: Boolean, default: false },
    // Password Reset
    passwordReset: {
      token: { type: String, default: null },
      tokenExpiry: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
      lastAttempt: { type: Date, default: null }
    },
    resetToken: { type: String, default: null },
    resetTokenExpiration: { type: Date, default: null },

    tempPasswordActive: { type: Boolean, default: false },

    // ─────────── Two-Factor Authentication ───────────
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null },
    backupCodes: [
      {
        code: String,
        used: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],



    // Email Verification
    emailVerificationTokens: [{
      token: { type: String, required: true },
      purpose: { type: String, enum: ['email_verification', 'email_change'], default: 'email_verification' },
      expiresAt: { type: Date, required: true },
      used: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }],

    // Enhanced OTP System
    otpSettings: {
      enabled: { type: Boolean, default: () => ENABLE_OTP_VERIFICATION === 'true' },
      preferredMethod: { type: String, enum: ['totp', 'email', 'sms'], default: DEFAULT_OTP_METHOD },
      allowFallback: { type: Boolean, default: true },
      requireForLogin: { type: Boolean, default: true },
      requireForSensitiveOps: { type: Boolean, default: true }
    },

    // Current OTP Session
    currentOTP: {
      code: { type: String, default: null },
      hashedCode: { type: String, default: null },
      type: { type: String, enum: ['totp', 'email', 'sms', 'backup'], default: null },
      purpose: { type: String, enum: ['login', 'reset', 'verification', 'sensitive_op'], default: null },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
      maxAttempts: { type: Number, default: 3 },
      lastSent: { type: Date, default: null },
      verified: { type: Boolean, default: false }
    },

    // TOTP/2FA Configuration
    twoFactorAuth: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, default: null },
      backupCodes: [{
        code: { type: String, required: true },
        used: { type: Boolean, default: false },
        usedAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now }
      }],
      setupCompleted: { type: Boolean, default: false },
      lastUsed: { type: Date, default: null }
    },

    // Login Security
    loginSecurity: {
      failedAttempts: { type: Number, default: 0 },
      lockedUntil: { type: Date, default: null },
      lastLoginAttempt: { type: Date, default: null },
      consecutiveFailures: { type: Number, default: 0 },
      suspiciousActivityDetected: { type: Boolean, default: false }
    },

    // Enhanced Token Management
    authTokens: [{
      token: { type: String, required: true },
      type: { type: String, enum: ['access', 'refresh', 'id'], required: true },
      deviceId: { type: String, required: true },
      deviceInfo: {
        name: { type: String, default: null },
        type: { type: String, default: null },
        os: { type: String, default: null },
        browser: { type: String, default: null },
        ipAddress: { type: String, default: null }
      },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true },
      lastUsed: { type: Date, default: Date.now },
      isRevoked: { type: Boolean, default: false },
      revokedAt: { type: Date, default: null },
      revokedReason: { type: String, default: null }
    }],

    // Device Management
    knownDevices: [{
      deviceId: { type: String, required: true, unique: true },
      name: { type: String, default: null },
      type: { type: String, default: null },
      os: { type: String, default: null },
      browser: { type: String, default: null },
      firstSeen: { type: Date, default: Date.now },
      lastSeen: { type: Date, default: Date.now },
      isTrusted: { type: Boolean, default: false },
      isActive: { type: Boolean, default: true },
      fingerprint: { type: String, default: null },
      location: {
        country: { type: String, default: null },
        region: { type: String, default: null },
        city: { type: String, default: null },
        coordinates: {
          lat: { type: Number, default: null },
          lng: { type: Number, default: null }
        }
      }
    }],

    // ─────────── Relationships ───────────
    address: [{ type: mongoose.Schema.Types.ObjectId, ref: "Address" }],
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    favoriteProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    shoppingCart: { type: mongoose.Schema.Types.ObjectId, ref: "Cart" },
    wishList: { type: mongoose.Schema.Types.ObjectId, ref: "Wishlist" },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ─────────── Social Accounts ───────────
    socialAccounts: [
      {
        provider: { type: String, enum: ["google", "facebook", "twitter", "github"] },
        providerId: String,
        email: String,
        verified: { type: Boolean, default: false },
        connectedAt: { type: Date, default: Date.now },
      },
    ],

    socialMedia: {
      facebook: { type: String, default: null },
      twitter: { type: String, default: null },
      instagram: { type: String, default: null },
      linkedin: { type: String, default: null },
      google: { type: String, default: null },
      pinterest: { type: String, default: null },
    },

    // ─────────── Preferences ───────────
    preferences: {
      newsletter: { type: Boolean, default: false },
      notifications: { type: Boolean, default: true },
      language: { type: String, default: "en" },
      currency: { type: String, default: "USD" },
      theme: { type: String, enum: ["light", "dark"], default: "light" },
    },
    interests: { type: [String], default: [] },

    // ─────────── E-commerce Features ───────────
    loyaltyPoints: { type: Number, default: 0 },
    referralCode: { type: String },
    paymentMethods: [
      {
        method: { type: String, enum: ["credit_card", "paypal", "bank_transfer"], required: true },
        details: {
          cardNumber: { type: String, default: null },
          expiryDate: { type: Date, default: null },
          holderName: { type: String, default: null },
        },
        isDefault: { type: Boolean, default: false },
      },
    ],
    shippingPreferences: {
      deliveryMethod: { type: String, enum: ["standard", "express"], default: "standard" },
      deliveryInstructions: { type: String, default: null },
      preferredTime: { type: String, default: null },
    },
    subscriptionStatus: { type: String, enum: ["active", "inactive"], default: "inactive" },
    subscriptionType: { type: String, enum: ["free", "premium", "enterprise"], default: "free" },

    // ─────────── Audit Fields ───────────
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["active", "inactive", "pending", "banned", "deleted", "archived", "draft"],
      default: "draft",
      trim: true,
    },

    // Misc
    session: [{ type: Object }],
  },
  { timestamps: true }
);



userSchema.virtual('fullName').get(function () {
  if (!this.firstName) return null;
  return this.lastName ? `${this.firstName} ${this.lastName}` : this.firstName;
});

userSchema.virtual('isLocked').get(function () {
  return !!(this.lockoutUntil && this.lockoutUntil > Date.now());
});

userSchema.virtual('hasActiveTOTP').get(function () {
  return this.twoFactorAuth.enabled && this.twoFactorAuth.secret && this.twoFactorAuth.setupCompleted;
});

userSchema.virtual('availableOTPMethods').get(function () {
  return otpService.getAvailableMethods(this);
});
userSchema.pre('save', function (next) {
  if (this.isModified('hash_password') && this.hash_password) {
    // Password will be hashed in the setPassword method
  }
  // Auto-verify user if both email and phone are verified (or phone not required)
  if (this.isModified('emailVerified') || this.isModified('phoneVerified')) {
    this.isVerified = this.emailVerified && (this.phoneVerified || !this.phoneNumber);
    if (this.isVerified && this.status === 'pending') {
      this.status = 'active';
    }
  }
  next();
});
// Common population logic for all get methods
const populateFields = ['role', 'address', 'orders', 'favoriteProducts', 'shoppingCart', 'wishList', 'referredBy', 'created_by', 'updated_by'];

userSchema.method({

  /**
 * Generate JWT tokens
 */
  async generateTokens(deviceInfo = {}) {
    try {
      const deviceId = deviceInfo.deviceId || crypto.randomBytes(16).toString('hex');

      // Clean up expired tokens
      await User.cleanupExpiredTokens();

      // Check session limit
      const activeSessions = this.authTokens.filter(t =>
        !t.isRevoked && t.expiresAt > new Date()
      );

      if (activeSessions.length >= MAX_SESSIONS) {
        // Revoke oldest session
        const oldestSession = activeSessions.sort((a, b) => a.createdAt - b.createdAt)[0];
        oldestSession.isRevoked = true;
        oldestSession.revokedAt = new Date();
        oldestSession.revokedReason = 'session_limit_exceeded';
      }


      const accessToken = await this.generateAccessToken(deviceId)
      const idToken = await this.generateIdToken(deviceId)
      const refreshToken = await this.generateRefreshToken(deviceId)

      // Store tokens
      const now = new Date();
      const accessTokenExpiry = new Date(now.getTime() + await this.parseTimeToMs(JWT_EXPIRY));
      const refreshTokenExpiry = new Date(now.getTime() + await this.parseTimeToMs(JWT_REFRESH_EXPIRY));
      const idTokenExpiry = new Date(now.getTime() + await this.parseTimeToMs(JWT_ID_EXPIRY));


      // console.log(this.parseTimeToMs(JWT_EXPIRY),this.parseTimeToMs(JWT_REFRESH_EXPIRY));


      const deviceData = {
        name: deviceInfo.name,
        type: deviceInfo.type,
        os: deviceInfo.os.name,
        browser: deviceInfo.browser.name,
        ipAddress: deviceInfo.ipAddress
      }

      this.authTokens.push({
        token: accessToken,
        type: 'access',
        deviceId,
        deviceInfo: deviceData,
        expiresAt: accessTokenExpiry,
        lastUsed: now
      });
      this.authTokens.push({
        token: idToken,
        type: 'id',
        deviceId,
        deviceInfo: deviceData,
        expiresAt: idTokenExpiry,
        lastUsed: now
      });

      this.authTokens.push({
        token: refreshToken,
        type: 'refresh',
        deviceId,
        deviceInfo: deviceData,
        expiresAt: refreshTokenExpiry,
        lastUsed: now
      });

      // Register/update device
      await this.registerDevice(deviceInfo);

      await this.save();

      return {
        accessToken,
        refreshToken,
        idToken,
        idTokenExpiry,
        accessTokenExpiresAt: accessTokenExpiry,
        refreshTokenExpiresAt: refreshTokenExpiry,
        deviceId
      };
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  },

  async setupTOTP() {
    try {
      const setupData = await otpService.setupTOTP(this);

      this.twoFactorAuth.secret = setupData.secret;
      this.twoFactorAuth.enabled = false; // Will be enabled after verification
      this.twoFactorAuth.setupCompleted = false;

      await this.save();

      return {
        qrCode: setupData.qrCode,
        manualEntryKey: setupData.manualEntryKey,
        setupUri: setupData.setupUri
      };
    } catch (error) {
      throw new Error(`TOTP setup failed: ${error.message}`);
    }
  }
  ,
  /**
   * Verify TOTP setup and enable it
   */
  async verifyTOTPSetup(token) {
    try {
      const result = await otpService.verifyTOTPSetup(this, token);

      if (result.success) {
        this.twoFactorAuth.enabled = true;
        this.twoFactorAuth.setupCompleted = true;
        this.twoFactorAuth.backupCodes = result.backupCodes.map(code => ({
          code: crypto.createHash('sha256').update(code).digest('hex'),
          used: false,
          createdAt: new Date()
        }));

        await this.save();
        await this.logSecurityEvent('totp_enabled', 'TOTP authentication enabled', 'medium');

        return {
          success: true,
          backupCodes: result.backupCodes
        };
      }

      throw new Error('TOTP verification failed');
    } catch (error) {
      throw new Error(`TOTP setup verification failed: ${error.message}`);
    }
  },

  /**
   * Disable TOTP
   */
  async disableTOTP(token) {
    try {
      const isValid = await otpService.verifyTOTP(this, token);

      if (!isValid) {
        throw new Error('Invalid TOTP token');
      }

      this.twoFactorAuth.enabled = false;
      this.twoFactorAuth.secret = null;
      this.twoFactorAuth.setupCompleted = false;
      this.twoFactorAuth.backupCodes = [];

      await this.save();
      await this.logSecurityEvent('totp_disabled', 'TOTP authentication disabled', 'high');

      return { success: true };
    } catch (error) {
      throw new Error(`TOTP disable failed: ${error.message}`);
    }
  },

  /**
   * Generate OTP using configured method
   */
  async generateOTP(purpose = 'login', deviceInfo = {}, preferredMethod = null) {
    try {
      if (!otpService.isEnabled()) {
        throw new Error('OTP verification is disabled');
      }

      const result = await otpService.sendOTP(this, purpose, deviceInfo, preferredMethod);

      // Store OTP session info
      this.currentOTP = {
        type: result.type,
        purpose,
        expiresAt: result.expiresAt,
        attempts: 0,
        maxAttempts: 3,
        lastSent: new Date(),
        verified: false
      };

      await this.save();

      return result;
    } catch (error) {
      throw new Error(`OTP generation failed: ${error.message}`);
    }
  },

  /**
   * Verify OTP
   */
  async verifyOTP(code, purpose = 'login', deviceInfo = {}) {
    try {
      const isValid = await otpService.verifyOTP(this, code, purpose, deviceInfo);

      if (isValid) {
        this.currentOTP.verified = true;
        this.currentOTP.code = null;
        this.currentOTP.hashedCode = null;

        if (this.twoFactorAuth.enabled) {
          this.twoFactorAuth.lastUsed = new Date();
        }

        await this.save();
        await this.logSecurityEvent('otp_verified', `OTP verified for ${purpose}`, 'low');
      }

      return isValid;
    } catch (error) {
      if (this.currentOTP.attempts < this.currentOTP.maxAttempts) {
        this.currentOTP.attempts += 1;
        await this.save();
      }
      throw error;
    }
  },

  /**
   * Check if user needs OTP for operation
   */
  async requiresOTP(operation = 'login') {
    if (!otpService.isEnabled()) {
      return false;
    }

    switch (operation) {
      case 'login':
        return this.otpSettings.requireForLogin;
      case 'sensitive_op':
        return this.otpSettings.requireForSensitiveOps;
      default:
        return false;
    }
  },


  async getMyProfile() {

    await this.populate(['role']);


    return {
      id: this._id,
      fullName: this.fullName,
      email: this.email,
      username: this.username,
      dateOfBirth: this.dateOfBirth,
      gender: this.gender,
      phoneNumber: this.phoneNumber,
      image: this.profilePicture,
      role: this.role ? this.role.name : null,
      loyaltyPoints: this.loyaltyPoints,
      isVerified: this.isVerified,
      preferences: this.preferences,
      accountStatus: this.status,
    };
  },

  async getMyProfileStatistics() {

    await this.populate(['role', 'address', 'orders', 'favoriteProducts', 'shoppingCart', 'wishList', 'referredBy', 'created_by', 'updated_by']);

    // const Wishlist = mongoose.model('Wishlist');
    // const Cart = mongoose.model('Cart');
    // const Order = mongoose.model('Order');
    // const User = mongoose.model('User');

    const wishlistCount = this.wishList ? (await Wishlist.findById(this.wishList)).items.length : 0;

    const cartItemsCount = this.shoppingCart ? (await Cart.findById(this.shoppingCart)).items.reduce((acc, i) => acc + i.quantity, 0) : 0;

    const referralUsers = await User.find({ referredBy: this._id });
    const referralCount = referralUsers.length;
    const referralLoyaltyPoints = referralUsers.reduce((sum, u) => sum + (u.loyaltyPoints || 0), 0);

    const userOrders = await Order.find({ _id: { $in: this.orders } });
    const totalSpent = userOrders
      .filter((o) => o.status === 'completed') // Assuming order has a 'status' field
      .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    const lastCompletedOrder = userOrders.filter((o) => o.status === 'completed').sort((a, b) => b.createdAt - a.createdAt)[0];

    const orderStatusCounts = userOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    // Engagement tier example
    let engagementTier = 'bronze';
    if (this.loyaltyPoints > 1000) engagementTier = 'gold';
    else if (this.loyaltyPoints > 500) engagementTier = 'silver';

    // Payment method summary with masked cards
    const paymentMethodsSummary = this.paymentMethods.map((m) => ({
      method: m.method,
      isDefault: m.isDefault,
      maskedCardNumber: m.details.cardNumber ? '**** **** **** ' + m.details.cardNumber.slice(-4) : null,
      expiryDate: m.details.expiryDate,
    }));

    return {
      id: this._id,
      fullName: this.fullName,
      email: this.email,
      username: this.username,
      dateOfBirth: this.dateOfBirth,
      gender: this.gender,
      phoneNumber: this.phoneNumber,
      profilePicture: this.profilePicture,
      role: this.role ? this.role.name : null,
      address: this.address,
      orderCount: this.orders.length,
      favoriteProductsCount: this.favoriteProducts.length,
      wishlistItemsCount: wishlistCount,
      cartItemsCount: cartItemsCount,
      loyaltyPoints: this.loyaltyPoints,
      totalSpent,
      lastCompletedOrderDate: lastCompletedOrder?.createdAt || null,
      orderStatusCounts,
      referralCount,
      referralLoyaltyPoints,
      engagementTier,
      lastLogin: this.lastLogin,
      isVerified: this.isVerified,
      subscriptionStatus: this.subscriptionStatus,
      subscriptionType: this.subscriptionType,
      socialMedia: this.socialMedia,
      preferences: this.preferences,
      interests: this.interests,
      paymentMethods: paymentMethodsSummary,
      shippingPreferences: this.shippingPreferences,
      notificationSettings: {
        email: this.preferences.notifications,
        newsletter: this.preferences.newsletter,
        // add sms/push flags if tracked
      },
      accountStatus: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },

  async authenticate(password) {
    return bcrypt.compare(password, this.hash_password);
  },

  // Set password (hash before save)
  async setPassword(password) {
    this.hash_password = await bcrypt.hash(password, SALT_ROUNDS);
    return this;
  },

  // Validate password
  async validatePassword(password) {
    return bcrypt.compare(password, this.hash_password);
  },

  // Add product to wishlist
  async addToWishlist(productId) {
    if (!this.wishList) {
      this.wishList = await Wishlist.create({ items: [] });
    }
    const wishList = await Wishlist.findById(this.wishList);
    if (!wishList.items.includes(productId)) {
      wishList.items.push(productId);
      await wishList.save();
    }
    return (await this.populate(populateFields)).wishList;
  },

  // Remove product from wishlist
  async removeFromWishlist(productId) {
    if (this.wishList) {
      const wishList = await Wishlist.findById(this.wishList);
      wishList.items = wishList.items.filter((id) => id.toString() !== productId.toString());
      await wishList.save();
    }
    return (await this.populate(populateFields)).wishList;
  },

  // Add product to favorites
  async addFavoriteProduct(productId) {
    if (!this.favoriteProducts.includes(productId)) {
      this.favoriteProducts.push(productId);
      await this.save();
    }
    return (await this.populate(populateFields)).favoriteProducts;
  },

  // Remove product from favorites
  async removeFavoriteProduct(productId) {
    this.favoriteProducts = this.favoriteProducts.filter((id) => id.toString() !== productId.toString());
    await this.save();
    return (await this.populate(populateFields)).favoriteProducts;
  },

  // Add item to shopping cart
  async addToCart(productId, quantity = 1) {
    if (!this.shoppingCart) {
      this.shoppingCart = await Cart.create({ items: [], total: 0 });
    }
    const cart = await Cart.findById(this.shoppingCart);
    const existingItem = cart.items.find((item) => item.product.toString() === productId.toString());
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }
    await cart.save();
    return (await this.populate(populateFields)).shoppingCart;
  },

  // Remove item from shopping cart
  async removeFromCart(productId) {
    if (this.shoppingCart) {
      const cart = await Cart.findById(this.shoppingCart);
      cart.items = cart.items.filter((item) => item.product.toString() !== productId.toString());
      await cart.save();
    }
    return (await this.populate(populateFields)).shoppingCart;
  },

  // Clear shopping cart
  async clearCart() {
    if (this.shoppingCart) {
      const cart = await Cart.findById(this.shoppingCart);
      cart.items = [];
      cart.total = 0;
      await cart.save();
    }
    return (await this.populate(populateFields)).shoppingCart;
  },

  // Update preferences
  async updatePreferences(prefs) {
    this.preferences = { ...this.preferences, ...prefs };
    await this.save();
    return (await this.populate(populateFields)).preferences;
  },

  // Add loyalty points
  async addLoyaltyPoints(points) {
    this.loyaltyPoints += points;
    await this.save();
    return (await this.populate(populateFields)).loyaltyPoints;
  },

  // Redeem loyalty points
  async redeemLoyaltyPoints(points) {
    if (this.loyaltyPoints >= points) {
      this.loyaltyPoints -= points;
      await this.save();
      return (await this.populate(populateFields)).loyaltyPoints;
    }
    throw new Error('Insufficient loyalty points');
  },
  // async sendEmailVerification(deviceInfo) {
  //   const user = this;
  //   user.generateEmailVerificationToken()
  //   // Delete old tokens of this type for user
  //   await this.emailVerificationTokens.deleteMany({ userId: user._id, type: 'email_verification' });
  //   // Save new token
  //   await this.emailVerificationTokens.create({
  //     userId: user._id,
  //     token: user.emailVerificationToken,
  //     type: 'email_verification',
  //     expiresAt: user.emailVerificationExpiry,
  //     deviceInfo: deviceInfo || null,
  //   });
  //   return this.user
  // },


  // Mark user as verified
  async verifyUser() {
    this.isVerified = true;
    this.confirmToken = null;
    await this.save();
    return (await this.populate(populateFields)).isVerified;
  },
  async getPermissions() {
    await this.populate({
      path: 'role',
      populate: ['permissions', "name", "isActive"]
    })

    const rolePermissions = (this.role?.permissions || []).map(p => p.name);
    // Return unique permissions as an array
    const uniquePermissions = Array.from(new Set(rolePermissions));
    return uniquePermissions;
  },
  // Update last login timestamp
  async updateLastLogin() {
    this.lastLogin = new Date();
    await this.save();
    return (await this.populate(populateFields)).lastLogin;
  },

  // Update user status
  async updateStatus(status) {
    this.status = status;
    await this.save();
    return (await this.populate(populateFields)).status;
  },

  // Add payment method
  async addPaymentMethod(method) {
    this.paymentMethods.push(method);
    await this.save();
    return (await this.populate(populateFields)).paymentMethods;
  },

  // Remove payment method
  async removePaymentMethod(methodId) {
    this.paymentMethods = this.paymentMethods.filter((m) => m._id.toString() !== methodId.toString());
    await this.save();
    return (await this.populate(populateFields)).paymentMethods;
  },

  // Set default payment method
  async setDefaultPaymentMethod(methodId) {
    this.paymentMethods.forEach((m) => {
      m.isDefault = m._id.toString() === methodId.toString();
    });
    await this.save();
    return (await this.populate(populateFields)).paymentMethods;
  },

  // Update social media links
  async updateSocialMedia(socialMedia) {
    this.socialMedia = { ...this.socialMedia, ...socialMedia };
    await this.save();
    return (await this.populate(populateFields)).socialMedia;
  },

  // Add interest
  async addInterest(interest) {
    if (!this.interests.includes(interest)) {
      this.interests.push(interest);
      await this.save();
    }
    return (await this.populate(populateFields)).interests;
  },

  // Remove interest
  async removeInterest(interest) {
    this.interests = this.interests.filter((i) => i !== interest);
    await this.save();
    return (await this.populate(populateFields)).interests;
  },

  // Generate single user statistics
  async getUserStatistics() {
    const stats = {
      orderCount: this.orders.length,
      favoriteProductsCount: this.favoriteProducts.length,
      wishlistItemsCount: this.wishList ? (await Wishlist.findById(this.wishList)).items.length : 0,
      cartItemsCount: this.shoppingCart ? (await Cart.findById(this.shoppingCart)).items.length : 0,
      loyaltyPoints: this.loyaltyPoints,
      lastLogin: this.lastLogin,
      isVerified: this.isVerified,
      subscriptionStatus: this.subscriptionStatus,
      subscriptionType: this.subscriptionType,
    };
    return stats;
  },

  // Generate single user report
  async getUserReport() {
    const populatedUser = await this.populate(populateFields);
    return {
      id: populatedUser._id,
      fullName: populatedUser.fullName,
      email: populatedUser.email,
      username: populatedUser.username,
      role: populatedUser.role ? populatedUser.role.name : null,
      status: populatedUser.status,
      isVerified: populatedUser.isVerified,
      lastLogin: populatedUser.lastLogin,
      loyaltyPoints: populatedUser.loyaltyPoints,
      orders: populatedUser.orders.map((order) => order._id),
      favoriteProducts: populatedUser.favoriteProducts.map((product) => product._id),
      wishlistItems: populatedUser.wishList ? (await Wishlist.findById(populatedUser.wishList)).items : [],
      cartItems: populatedUser.shoppingCart ? (await Cart.findById(populatedUser.shoppingCart)).items : [],
      subscription: {
        status: populatedUser.subscriptionStatus,
        type: populatedUser.subscriptionType,
      },
      createdAt: populatedUser.createdAt,
      updatedAt: populatedUser.updatedAt,
    };
  },

  // Dynamic instance method to update any field
  async dynamicUpdate(field, value) {
    if (this.schema.paths[field]) {
      this[field] = value;
      await this.save();
      return (await this.populate(populateFields))[field];
    }
    throw new Error(`Field ${field} does not exist in schema`);
  },

  async changePassword(oldPassword, newPassword) {
    if (!await this.validatePassword(oldPassword)) {
      throw new Error('Current password is incorrect');
    }
    await this.setPassword(newPassword);
    this.tempPasswordActive = false;
    // Invalidate all refresh tokens and sessions
    await this.invalidateAllSessions();
    await this.revokeAllTokens('password_change')
    await this.save();
    return true;
  },

  async resetPassword(token, newPassword) {
    if (!this.resetToken || this.resetToken !== token) {
      throw new Error('Invalid reset token');
    }

    if (this.resetTokenExpiration < new Date()) {
      throw new Error('Reset token has expired');
    }

    await this.setPassword(newPassword);
    this.resetToken = null;
    this.resetTokenExpiration = null;
    this.tempPasswordActive = false;

    // Invalidate all sessions for security
    await this.invalidateAllSessions();

    await this.save();
    return true;
  },

  // Security Events
  async addSecurityEvent(event, ipAddress = null, userAgent = null, details = {}) {
    this.securityEvents.push({
      event,
      timestamp: new Date(),
      ipAddress,
      userAgent,
      details
    });

    // Limit to last 100 security events
    if (this.securityEvents.length > 100) {
      this.securityEvents = this.securityEvents.slice(-100);
    }
  },

  // JWT Token Management

  async generateIdToken(deviceId) {
    const payload = {
      // Standard OpenID claims
      sub: this._id.toString(),
      email: this.email,
      emailVerified: this.emailVerified || false,
      username: this.username,

      // Personal info
      firstName: this.firstName || null,
      lastName: this.lastName || null,
      fullName: this.fullName || null,
      profileImage: this.profileImage || null,
      phoneNumber: this.phoneNumber || null,
      gender: this.gender || null,
      dateOfBirth: this.dateOfBirth || null,
      // Account info
      lastLogin: this.lastLogin || null,
      status: this.status || 'active',
      // Preferences
      locale: this.locale || 'en-US',
      preferences: this.preferences || { theme: 'light', currency: 'USD' },
      // System
      role: this.role,
      type: 'id',
      deviceId,
    };

    return jwt.sign(payload, JWT_ID_SECRET, {
      expiresIn: process.env.JWT_ID_EXPIRY || '30d',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  },



  async generateAccessToken(deviceId) {
    const payload = {
      userId: this._id,
      username: this.username,
      email: this.email,
      role: this.role,
      type: 'access',
      deviceId: deviceId,
      permissions: this.permissions || []
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
  },

  async generateRefreshToken(deviceId) {
    const payload = {
      userId: this._id,
      tokenType: 'refresh',
      deviceId
    };

    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRY,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
  },

  async storeRefreshToken(token, userAgent = null, ipAddress = null) {
    const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days

    this.refreshTokens.push({
      token,
      expiresAt,
      userAgent,
      ipAddress,
      isActive: true
    });

    // Clean up expired tokens
    this.refreshTokens = this.refreshTokens.filter(rt =>
      rt.expiresAt > new Date() && rt.isActive
    );

    // Limit to 5 active refresh tokens
    if (this.refreshTokens.length > 5) {
      this.refreshTokens = this.refreshTokens.slice(-5);
    }

    await this.save();
  },



  async refreshAccessToken(refreshToken) {


    try {
      const tokenData = this.authTokens.find(t =>
        t.token === refreshToken &&
        !t.isRevoked &&
        t.type === 'refresh' &&
        t.expiresAt > new Date()
      );
      if (!tokenData) {
        throw new Error('Invalid or expired refresh token');
      }
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      if (decoded.userId !== this._id.toString()) {
        throw new Error('Token mismatch');
      }

      const token = await this.generateAccessToken(decoded.deviceId)

      // Add new token
      const now = new Date();
      const accessTokenExpiry = new Date(now.getTime() + await this.parseTimeToMs(JWT_EXPIRY));

      this.authTokens.push({
        token: token,
        type: 'access',
        deviceId: decoded.deviceId,
        deviceInfo: tokenData.deviceInfo,
        expiresAt: accessTokenExpiry,
        lastUsed: now
      });

      // Update refresh token last used
      tokenData.lastUsed = now;

      await this.save();
      return {
        accessToken: token,
        expiresAt: accessTokenExpiry
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }



  },

  async revokeRefreshToken(token) {
    this.refreshTokens = this.refreshTokens.map(rt =>
      rt.token === token ? { ...rt, isActive: false } : rt
    );
    await this.save();
  },

  generateEmailVerificationToken() {
    this.emailVerificationToken = crypto.randomBytes(32).toString('hex');
    this.emailVerificationExpiry = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours
    return this.emailVerificationToken;
  },

  async generateResetPasswordToken() {
    const t = crypto.randomBytes(32).toString('hex');
    const time = new Date(Date.now() + 60 * 60 * 1000);
    this.resetToken = t;
    this.resetTokenExpiration = time; // 1 hour
    this.passwordReset = {
      token: t,
      tokenExpiry: time, // 1 hour
      attempts: 0,
      lastAttempt: new Date()
    };
    await this.save();
    return this.resetToken;
  },
  async checkResetTokenValidity(token) {
    return this.passwordReset.token === token && this.passwordReset.tokenExpiry > Date.now();
  },

  async verifyEmail(token) {
    if (!this.emailVerificationToken || this.emailVerificationToken !== token) {
      throw new Error('Invalid verification token');
    }

    if (this.emailVerificationExpiry < new Date()) {
      throw new Error('Verification token has expired');
    }

    this.emailVerified = true;
    this.isVerified = this.emailVerified && (this.phoneVerified || !this.phoneNumber);
    this.emailVerificationToken = null;
    this.emailVerificationExpiry = null;
    this.status = this.isVerified ? 'active' : 'pending';
    this.confirmToken = null;
    await this.save();
    return true;
  },




  async confirmEmail(token) {
    if (this.confirmToken !== token) throw new Error('Invalid confirmation token');
    this.isVerified = true;
    this.confirmToken = null;
    await this.save();
    return true;
  },

  // OTP Management
  generateOTP(type = 'login') {
    // Use crypto for secure OTP generation
    const otp = crypto.randomInt(100000, 1000000).toString();

    this.otpCode = crypto
      .createHmac('sha256', OTP_SECRET)
      .update(otp + this.email + Date.now())
      .digest('hex')
      .substring(0, 6)
      .toUpperCase();

    this.otpExpiry = new Date(Date.now() + OTP_EXPIRY);
    this.otpType = type;
    this.otpAttempts = 0;
    this.otpLastSent = new Date();

    return this.otpCode;
  },

  async validateOTP(inputOTP, type = 'login') {
    if (!this.otpCode || !this.otpExpiry) {
      throw new Error('No OTP found for this user');
    }

    if (this.otpExpiry < new Date()) {
      this.clearOTP();
      await this.save();
      throw new Error('OTP has expired');
    }

    if (this.otpType !== type) {
      throw new Error('OTP type mismatch');
    }

    if (this.otpAttempts >= 3) {
      this.clearOTP();
      await this.save();
      throw new Error('Maximum OTP attempts exceeded');
    }

    if (this.otpCode !== inputOTP.toUpperCase()) {
      this.otpAttempts += 1;
      await this.save();
      throw new Error('Invalid OTP');
    }

    // OTP is valid
    this.clearOTP();
    return true;
  },

  clearOTP() {
    this.otpCode = null;
    this.otpExpiry = null;
    this.otpType = null;
    this.otpAttempts = 0;
  },

  canSendOTP() {
    if (!this.otpLastSent) return true;
    const oneMinuteAgo = new Date(Date.now() - 60000);
    return this.otpLastSent < oneMinuteAgo;
  },

  // Email confirmation & reset


  // ========================================
  // 🔐 SECURITY & DEVICE MANAGEMENT
  // ========================================

  /**
   * Register or update device information
   */
  async registerDevice(deviceInfo) {
    if (!deviceInfo.deviceId) {
      return;
    }

    let device = this.knownDevices.find(d => d.deviceId === deviceInfo.deviceId);

    if (device) {
      // Update existing device
      device.lastSeen = new Date();
      if (deviceInfo.name) device.name = deviceInfo.name;
      if (deviceInfo.type) device.type = deviceInfo.type;
      if (deviceInfo.os) device.os = deviceInfo.os.name;
      if (deviceInfo.browser) device.browser = deviceInfo.browser.name;
    } else {
      // Register new device
      device = {
        deviceId: deviceInfo.deviceId,
        name: deviceInfo?.name || 'Unknown Device',
        type: deviceInfo?.type || 'unknown',
        os: deviceInfo?.os.name || 'unknown',
        browser: deviceInfo?.browser.name || 'unknown',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isTrusted: false,
        isActive: true,
        fingerprint: deviceInfo.fingerprint || null
      };
      console.log(device);


      this.knownDevices.push(device);

      // Log new device
      await this.logSecurityEvent('new_device_registered',
        `New device registered: ${device.name}`, 'medium', deviceInfo);
    }
  },

  /**
   * Trust a device
   */
  async trustDevice(deviceId) {
    const device = this.knownDevices.find(d => d.deviceId === deviceId);
    if (device) {
      device.isTrusted = true;
      await this.save();
      await this.logSecurityEvent('device_trusted', `Device trusted: ${device.name}`, 'low');
      return true;
    }
    return false;
  },

  /**
   * Remove a device
   */
  async removeDevice(deviceId) {
    // Revoke all tokens for this device
    this.authTokens.forEach(token => {
      if (token.deviceId === deviceId && !token.isRevoked) {
        token.isRevoked = true;
        token.revokedAt = new Date();
        token.revokedReason = 'device_removed';
      }
    });

    // Remove device
    this.knownDevices = this.knownDevices.filter(d => d.deviceId !== deviceId);

    await this.save();
    await this.logSecurityEvent('device_removed', `Device removed: ${deviceId}`, 'medium');
    return true;
  },




  async handleFailedLogin(ipAddress = null, userAgent = null, deviceInfo = {}, reason = 'invalid_credentials') {
    this.failedLoginAttempts += 1;
    this.consecutiveFailedAttempts += 1;
    this.lastLoginAttempt = new Date();
    this.loginSecurity.failedAttempts += 1;
    this.loginSecurity.consecutiveFailures += 1;
    this.loginSecurity.lastLoginAttempt = new Date();

    // Add to login history
    this.loginHistory.push({
      loginTime: new Date(),
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      successful: false,
      failureReason: reason,
      deviceId: deviceInfo.deviceId
    });

    // Check if account should be locked
    if (this.loginSecurity.consecutiveFailures >= MAX_ATTEMPTS) {
      this.loginSecurity.lockedUntil = new Date(Date.now() + LOCK_TIME);
      await this.logSecurityEvent('account_locked',
        `Account locked due to ${MAX_ATTEMPTS} failed login attempts`, 'high', deviceInfo);
    }

    // Lock account after max attempts
    if (this.consecutiveFailedAttempts >= MAX_ATTEMPTS) {
      this.lockoutUntil = new Date(Date.now() + LOCK_TIME);

      // Add security event
      this.securityEvents.push({
        event: 'account_locked',
        ipAddress,
        userAgent,
        details: { reason: 'Too many failed login attempts', attempts: this.consecutiveFailedAttempts }
      });
    }
    await this.save();
    await this.logSecurityEvent('login_failed', `Failed login: ${reason}`, 'medium', deviceInfo);

    return this.isLocked;
  },


  async logSecurityEvent(event, description = null, severity = 'medium', metadata = {}) {
    this.securityEvents.push({
      event,
      description,
      severity,
      timestamp: new Date(),
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      deviceId: metadata.deviceId,
      metadata
    });

    // Keep only last 100 security events
    if (this.securityEvents.length > 100) {
      this.securityEvents = this.securityEvents.slice(-100);
    }

    await this.save();
  },

  async handleSuccessfulLogin(ipAddress = null, userAgent = null, deviceInfo = {}) {
    this.lastLogin = new Date();
    this.failedLoginAttempts = 0;
    this.consecutiveFailedAttempts = 0;
    this.lockoutUntil = null;
    this.lastLoginAttempt = new Date();
    this.loginSecurity.failedAttempts = 0;
    this.loginSecurity.consecutiveFailures = 0;
    this.loginSecurity.lockedUntil = null;
    this.loginSecurity.lastLoginAttempt = new Date();

    // Add to login history
    this.loginHistory.push({
      loginTime: new Date(),
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      successful: true,
      deviceId: deviceInfo.deviceId,
      otpUsed: this.currentOTP.type || 'none'
    });
    // Limit login history to last 50 entries
    if (this.loginHistory.length > 50) {
      this.loginHistory = this.loginHistory.slice(-50);
    }
    await this.registerDevice(deviceInfo);
    await this.save();
    await this.logSecurityEvent('login_success', 'Successful login', 'low', deviceInfo);

  },

  async parseTimeToMs(str) {
    // e.g. '15m', '1h', '30s'
    if (!str) return '15m';
    const unit = str.slice(-1);
    const num = parseInt(str.slice(0, -1), 10);
    if (isNaN(num)) return NaN;

    switch (unit) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      default: return NaN;
    }
  },




  async invalidateAllSessions() {
    this.refreshTokens = [];
    this.activeSessions = [];
    this.tokens = [];
    this.session = [];
    await this.save();
    return true;
  },

  async lockAccount(durationMs) {
    this.status = 'inactive';
    this.lockExpires = Date.now() + durationMs;
    await this.save();
  },
  async unlockAccount() {
    if (this.lockExpires && this.lockExpires > Date.now()) throw new Error('Account still locked');
    this.status = 'active';
    this.lockExpires = null;
    this.lockoutUntil = null;
    this.failedLoginAttempts = 0;
    this.consecutiveFailedAttempts = 0;
    await this.save();
  },
  async handleFailedLoginAttempt(maxAttempts = 5, lockDurationMs = 3600000) {
    this.failedLogins = (this.failedLogins || 0) + 1;
    if (this.failedLogins >= maxAttempts) {
      this.status = 'inactive';
      this.lockExpires = Date.now() + lockDurationMs; // lock for e.g. 1 hour
    }
    await this.save();
    return this.status === 'inactive';
  },
  // Profile
  async updateProfile(updates) {
    Object.assign(this, updates);
    await this.save();
    return this.populate(populateFields);
  },
  async updateProfilePicture(url) {
    this.profilePicture = url;
    await this.save();
    return this.profilePicture;
  },

  // Wishlist & favorites

  async clearWishlist() {
    if (this.wishList) {
      const wl = await Wishlist.findById(this.wishList);
      wl.items = [];
      await wl.save();
    }
    return [];
  },

  // Cart management

  async updateCartItemQuantity(productId, qty) {
    if (!this.shoppingCart) throw new Error('No cart');
    const cart = await Cart.findById(this.shoppingCart);
    const item = cart.items.find((i) => i.product.toString() === productId.toString());
    if (!item) throw new Error('Item not in cart');
    if (qty <= 0) cart.items = cart.items.filter((i) => i.product.toString() !== productId.toString());
    else item.quantity = qty;
    await cart.save();
    return this.populate(populateFields).shoppingCart;
  },
  async clearCart() {
    /* ... */
  },

  // Loyalty & referrals

  async transferLoyaltyPoints(toUserId, points) {
    if (this.loyaltyPoints < points) throw new Error('Insufficient points');
    this.loyaltyPoints -= points;
    await this.save();
    const other = await User.findById(toUserId);
    other.loyaltyPoints += points;
    await other.save();
    return true;
  },

  // Preferences & notifications

  async toggleNewsletterSubscription() {
    this.preferences.newsletter = !this.preferences.newsletter;
    await this.save();
    return this.preferences.newsletter;
  },
  async toggleNotifications() {
    this.preferences.notifications = !this.preferences.notifications;
    await this.save();
    return this.preferences.notifications;
  },
  async setThemePreference(theme) {
    if (!['light', 'dark'].includes(theme)) throw new Error('Invalid theme');
    this.preferences.theme = theme;
    await this.save();
    return this.preferences.theme;
  },

  // Social media

  async clearAllSocialLinks() {
    this.socialMedia = {};
    await this.save();
    return this.socialMedia;
  },

  // Interests

  async clearInterests() {
    this.interests = [];
    await this.save();
    return this.interests;
  },

  // Subscription & billing
  async activateSubscription(type) {
    this.subscriptionType = type;
    this.subscriptionStatus = 'active';
    await this.save();
    return { type, status: this.subscriptionStatus };
  },
  async cancelSubscription() {
    this.subscriptionStatus = 'inactive';
    await this.save();
    return this.subscriptionStatus;
  },

  async getOrderHistory() {
    return this.populate('orders').orders;
  },

  async updateEmail(newEmail) {
    if (!newEmail) throw new Error('Email required');
    this.email = newEmail.toLowerCase();
    this.isVerified = false;
    this.confirmToken = crypto.randomBytes(20).toString('hex');
    await this.save();
    return { email: this.email, confirmToken: this.confirmToken };
  },
  async updatePhoneNumber(newPhone) {
    if (!newPhone.match(/^[0-9]{10}$/)) throw new Error('Invalid phone number');
    this.phoneNumber = newPhone;
    await this.save();
    return this.phoneNumber;
  },

  async deactivateAccount(reason) {
    this.status = 'inactive';
    this.deactivationReason = reason || 'No reason provided';
    await this.save();
  },

  async deactivateUser(adminId, reason) {
    if (this.status === 'inactive') {
      throw new Error('User is already inactive');
    }
    this.status = 'inactive';

    this.updated_by = adminId;
    await this.revokeAllTokens('admin_deactivation');
    this.deactivationReason = reason || 'No reason provided';
    await this.logSecurityEvent('account_deactivated',
      `Account deactivated by admin: ${reason || 'No reason provided'}`,
      'high',
      { adminId, reason }
    );
    await this.save();
    return this;
  },

  async reactivateAccount() {
    this.status = 'active';
    this.deactivationReason = null;
    await this.save();
  },

  async activateUser(adminId, reason = null) {
    if (this.status === 'active') {
      throw new Error('User is already active');
    }
    this.deactivationReason = null;
    this.status = 'active';
    this.updated_by = adminId;

    // Log security event
    await this.logSecurityEvent('account_activated',
      `Account activated by admin: ${reason || 'No reason provided'}`,
      'medium',
      { adminId, reason }
    );

    await this.save();
    return this;
  },

  async deleteAccount() {
    this.status = 'deleted';
    this.email = null;
    this.hash_password = null;
    this.tokens = [];
    await this.save();
  },
  async addAddress(addressObj) {
    const newAddress = await Address.create(addressObj);
    this.address.push(newAddress._id);
    await this.save();
    return this.populate('address');
  },
  async removeAddress(addressId) {
    this.address = this.address.filter((id) => id.toString() !== addressId.toString());
    await this.save();
    return this.populate('address');
  },
  async setDefaultAddress(addressId) {
    for (const addrId of this.address) {
      const addr = await Address.findById(addrId);
      if (!addr) continue;
      addr.isDefault = addr._id.toString() === addressId.toString();
      await addr.save();
    }
    return this.populate('address');
  },


  async revokeToken(token) {
    this.tokens = this.tokens.filter((t) => t.token !== token);
    const tokenData = this.authTokens.find(t => t.token === token);
    if (tokenData) {
      tokenData.isRevoked = true;
      tokenData.revokedAt = new Date();
      tokenData.revokedReason = reason;
      await this.save();
    }
    return true;

  },

  async revokeAllTokens(reason = 'user_logout_all') {
    this.authTokens.forEach(token => {
      if (!token.isRevoked) {
        token.isRevoked = true;
        token.revokedAt = new Date();
        token.revokedReason = reason;
      }
    });

    this.activeSessions.forEach(session => {
      session.isActive = false;
    });

    await this.save();
    await this.logSecurityEvent('tokens_revoked_all', 'All tokens revoked', 'medium');
    return true;
  },

  async updateLoginTimestamp() {
    this.lastLogin = new Date();
    await this.save();
  },

  async incrementFailedLogins() {
    this.failedLogins = (this.failedLogins || 0) + 1;
    await this.save();
  },
  async resetFailedLogins() {
    this.failedLogins = 0;
    await this.save();
  },

  async moveItemWishlistToFavorites(productId) {
    await this.removeFromWishlist(productId);
    await this.addFavoriteProduct(productId);
  },
  async moveItemCartToWishlist(productId) {
    await this.removeFromCart(productId);
    await this.addToWishlist(productId);
  },

  async calculateCartTotal() {
    if (!this.shoppingCart) return 0;

    const cart = await Cart.findById(this.shoppingCart).populate('items.product');
    let total = 0;
    for (const item of cart.items) {
      total += (item.product.price || 0) * item.quantity;
    }
    return total;
  },
  async getWishlistCount() {
    if (!this.wishList) return 0;
    const WishList = Wishlist;
    const wl = await WishList.findById(this.wishList);
    return wl ? wl.items.length : 0;
  },
  async getCartItemCount() {
    if (!this.shoppingCart) return 0;

    const cart = await Cart.findById(this.shoppingCart);
    return cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
  },

  // Social Media & Interests
  async linkSocialAccount(platform, id) {
    if (!this.socialMedia) this.socialMedia = {};
    this.socialMedia[platform] = id;
    await this.save();
  },
  async unlinkSocialAccount(platform) {
    if (!this.socialMedia) return;
    this.socialMedia[platform] = null;
    await this.save();
  },

  async addInterestCategory(category) {
    if (!this.interests.includes(category)) {
      this.interests.push(category);
      await this.save();
    }
  },
  async clearInterests() {
    this.interests = [];
    await this.save();
  },

  async resetLoyaltyPoints() {
    this.loyaltyPoints = 0;
    await this.save();
  },

  // Notifications & Preferences

  async updateLanguagePreference(languageCode) {
    this.preferences.language = languageCode;
    await this.save();
  },

  // Orders & Purchase History
  async addOrder(orderId) {
    this.orders.push(orderId);
    await this.save();
  },

  // Reporting & Analytics
  async getActivitySummary() {
    return {
      orderCount: this.orders.length,
      wishlistCount: await this.getWishlistCount(),
      cartItemCount: await this.getCartItemCount(),
      loyaltyPoints: this.loyaltyPoints,
      lastLogin: this.lastLogin,
    };
  },
});
userSchema.statics.findFullyPopulatedById = async function (userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  return this.findById(userId).populate([
    'role',
    'address',
    'orders',
    'favoriteProducts',
    'shoppingCart',
    'wishList',
    'referredBy',
    'created_by',
    'updated_by'
  ]);
};

userSchema.statics.findActiveWithinDays = async function (days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({ lastLogin: { $gte: cutoff }, status: 'active' }).populate(populateFields);
};

userSchema.statics.getUserCountByRole = async function () {
  return this.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $project: { role: '$_id', count: 1, _id: 0 } }]);
};

// Static Methods
userSchema.statics.findOldestUser = async function () {
  return this.findOne().sort({ dateOfBirth: 1 }).populate(populateFields);
};

userSchema.statics.getTopLoyalUsers = async function (limit = 10) {
  return this.find({}).sort({ loyaltyPoints: -1 }).limit(limit).populate(populateFields);
};

userSchema.statics.getNeverLoggedInUsers = async function () {
  return this.find({ lastLogin: null }).populate(populateFields);
};

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() }).populate(populateFields);
};

userSchema.statics.findByUsername = function (username) {
  return this.findOne({ username }).populate(populateFields);
};

userSchema.statics.getAdmins = function () {
  return this.find({ role: 'admin' }).populate(populateFields);
};

userSchema.statics.findByRole = async function (role) {
  return this.find({ role }).populate(populateFields);
};

userSchema.statics.getCustomers = function () {
  return this.find({ role: 'customer' }).populate(populateFields);
};

userSchema.statics.searchUsers = function (keyword) {
  return this.find({
    $or: [{ firstName: { $regex: keyword, $options: 'i' } }, { lastName: { $regex: keyword, $options: 'i' } }, { email: { $regex: keyword, $options: 'i' } }, { username: { $regex: keyword, $options: 'i' } }],
  }).populate(populateFields);
};

userSchema.statics.getPaginatedUsers = async function ({ page = 1, limit = 20, filters = {} }) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([this.find(filters).skip(skip).limit(limit).sort({ createdAt: -1 }).populate(populateFields), this.countDocuments(filters)]);
  return { items, total, page, pages: Math.ceil(total / limit) };
};

userSchema.statics.bulkUpdateRole = function (ids, role) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { role } });
};

userSchema.statics.bulkDelete = function (ids) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { status: 'deleted' } });
};

// Bulk update status
userSchema.statics.bulkUpdateStatus = function (ids, status) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { status } });
};

// Get users by status
userSchema.statics.getUsersByStatus = function (status) {
  return this.find({ status }).populate(populateFields);
};

// Get active users
userSchema.statics.getActiveUsers = function () {
  return this.find({ status: 'active', isVerified: true }).populate(populateFields);
};

// Get verified users
userSchema.statics.getVerifiedUsers = function () {
  return this.find({ isVerified: true }).populate(populateFields);
};

// Dynamic search by any field
userSchema.statics.dynamicSearch = function (field, value) {
  if (this.schema.paths[field]) {
    return this.find({ [field]: { $regex: value, $options: 'i' } }).populate(populateFields);
  }
  throw new Error(`Field ${field} does not exist in schema`);
};

// Bulk add loyalty points
userSchema.statics.bulkAddLoyaltyPoints = function (ids, points) {
  return this.updateMany({ _id: { $in: ids } }, { $inc: { loyaltyPoints: points } });
};

// Get users by subscription type
userSchema.statics.getUsersBySubscriptionType = function (subscriptionType) {
  return this.find({ subscriptionType }).populate(populateFields);
};

userSchema.statics.getUserCountBySubscription = async function () {
  return this.aggregate([{ $group: { _id: '$subscriptionType', count: { $sum: 1 } } }, { $project: { subscriptionType: '$_id', count: 1, _id: 0 } }]);
};

// Assign a role to a user by userId and roleId
userSchema.statics.assignRoleById = async function (userId, roleId) {
  const user = await this.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Optional: Validate roleId exists in Role collection here

  user.role = roleId;
  await user.save();

  // Populate role details when returning
  await user.populate('role').execPopulate();

  return user;
};

userSchema.statics.searchByEmailOrUsername = async function (term) {
  return this.find({
    $or: [{ email: { $regex: term, $options: 'i' } }, { username: { $regex: term, $options: 'i' } }],
  }).populate(populateFields);
};

userSchema.statics.getAverageLoyaltyPoints = async function () {
  const result = await this.aggregate([{ $group: { _id: null, avgPoints: { $avg: '$loyaltyPoints' } } }]);
  return result[0]?.avgPoints || 0;
};
// Generate table statistics

userSchema.statics.getTableStatistics = async function () {
  try {
    const [totalUsers, statusCounts, subscriptionCounts, verifiedCount, averageLoyaltyPoints, recentLogins] = await Promise.all([this.countDocuments(), this.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $project: { status: '$_id', count: 1, _id: 0 } }, { $sort: { count: -1 } }]), this.aggregate([{ $group: { _id: '$subscriptionType', count: { $sum: 1 } } }, { $project: { subscriptionType: '$_id', count: 1, _id: 0 } }]), this.countDocuments({ isVerified: true }), this.aggregate([{ $group: { _id: null, avgPoints: { $avg: '$loyaltyPoints' } } }, { $project: { avgPoints: 1, _id: 0 } }]), this.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } })]);
    return {
      totalUsers,
      statusCounts,
      subscriptionCounts,
      verifiedCount,
      averageLoyaltyPoints: averageLoyaltyPoints[0]?.avgPoints || 0,
      recentLogins,
    };
  } catch (error) {
    throw new Error(`Failed to get table statistics: ${error.message}`);
  }
};

userSchema.statics.getTableReport = async function () {
  try {
    const stats = await this.getTableStatistics();
    const recentUsers = await this.find().sort({ createdAt: -1 }).limit(5).populate(populateFields).select('username email fullName role status isVerified createdAt lastLogin');

    const formattedRecentUsers = recentUsers.map((user) => ({
      id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role?.name || null,
      status: user.status,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    }));

    return {
      ...stats,
      recentUsers: formattedRecentUsers,
    };
  } catch (error) {
    throw new Error(`Failed to get table report: ${error.message}`);
  }
};

userSchema.statics.getUserReportById = async function (userId) {
  try {
    const user = await this.findById(userId).populate(populateFields);
    if (!user) return null;

    const wishlistItems = user.wishList ? (await Wishlist.findById(user.wishList)).items : [];

    const cartItems = user.shoppingCart ? (await Cart.findById(user.shoppingCart)).items : [];

    return {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role?.name || null,
      status: user.status,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin,
      loyaltyPoints: user.loyaltyPoints,
      orders: user.orders.map((order) => order._id),
      favoriteProducts: user.favoriteProducts.map((product) => product._id),
      wishlistItems,
      cartItems,
      subscription: {
        status: user.subscriptionStatus,
        type: user.subscriptionType,
      },
      preferences: user.preferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    throw new Error(`Failed to get user report: ${error.message}`);
  }
};

userSchema.statics.getActivitySummaryById = async function (userId) {
  try {
    const user = await this.findById(userId);
    if (!user) return null;

    const wishlistCount = user.wishList ? (await Wishlist.findById(user.wishList)).items.length : 0;

    const cartItemCount = user.shoppingCart ? (await Cart.findById(user.shoppingCart)).items.reduce((acc, i) => acc + i.quantity, 0) : 0;

    return {
      orderCount: user.orders.length,
      wishlistCount,
      cartItemCount,
      loyaltyPoints: user.loyaltyPoints,
      lastLogin: user.lastLogin,
    };
  } catch (error) {
    throw new Error(`Failed to get activity summary: ${error.message}`);
  }
};
// Aggregate users by country (assumes one primary address with country field)
userSchema.statics.getUserCountByCountry = async function () {
  // Aggregate from Address collection with lookup to User
  return this.aggregate([
    {
      $lookup: {
        from: Address.collection.name,
        localField: 'address',
        foreignField: '_id',
        as: 'addressDetails',
      },
    },
    { $unwind: '$addressDetails' },
    { $match: { 'addressDetails.country': { $exists: true, $ne: null } } },
    { $group: { _id: '$addressDetails.country', count: { $sum: 1 } } },
    { $project: { country: '$_id', count: 1, _id: 0 } },
    { $sort: { count: -1 } },
  ]);
};

userSchema.statics.registerNewUser = async function (userData, registrationMetadata = {}) {
  try {
    let { password, role: roleId, email, username, ...rest } = userData;

    // Check uniqueness of email and username
    const exists = await this.findOne({
      $or: [{ email }, { username }],
    });
    if (exists) throw new Error('Email or username already registered');


    email = email.trim().toLowerCase();
    username = username.trim();

    // Role assignment with validation
    if (!roleId) {
      const defaultRole = await Role.findOne({ isDefault: true, isActive: true });
      if (!defaultRole) throw new Error('Default role not configured');
      roleId = defaultRole._id;
    } else {
      const roleExists = await Role.exists({ _id: roleId, isActive: true });
      if (!roleExists) throw new Error('Assigned role does not exist or not active');
    }


    const confirmToken = jwt.sign(
      {
        email,
      },
      jwtSecret,
      {
        expiresIn: '72h',
      }
    );

    // Create user doc including register metadata & security flags
    const user = new this({
      email,
      username,
      role: roleId,
      confirmToken,
      status: 'pending', // pending email verification
      ...rest,
    });

    if (!password) {
      password = Math.random().toString(36).slice(-8);
      user.tempPasswordActive = true;
    }
    // Auto-generate referral code
    if (!user.referralCode) {
      user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    }
    await user.setPassword(password);
    user.generateEmailVerificationToken();
    await user.save();

    return user;
  } catch (err) {
    throw err;
  }
};


userSchema.statics.initiateOTPLogin = async function (identifier, type = 'login') {
  const user = await this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.isLocked) {
    throw new Error('Account is locked');
  }

  if (!user.canSendOTP()) {
    throw new Error('Please wait before requesting another OTP');
  }

  const otp = user.generateOTP(type);
  await user.save();

  return { user, otp };
},

  userSchema.statics.verifyOTPLogin = async function (identifier, otp, ipAddress = null, userAgent = null) {
    const user = await this.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    }).populate('role');

    if (!user) {
      throw new Error('User not found');
    }

    await user.validateOTP(otp, 'login');
    await user.handleSuccessfulLogin(ipAddress, userAgent);
    await user.save();

    return user;
  },

  // Token Management
  userSchema.statics.verifyAccessToken = async function (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await this.findById(decoded.userId).populate('role');

      if (!user || user.status !== 'active') {
        throw new Error('User not found or inactive');
      }

      return { user, decoded };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  },

  userSchema.statics.verifyRefreshToken = async function (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      const user = await this.findById(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      const tokenData = user.refreshTokens.find(rt =>
        rt.token === refreshToken && rt.isActive && rt.expiresAt > new Date()
      );

      if (!tokenData) {
        throw new Error('Invalid refresh token');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  },

  userSchema.statics.verifyUserEmail = async function (token) {
    const user = await this.findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    await user.verifyEmail(token);
    return user;
  },



  // Get new user registrations count by day over last N days
  userSchema.statics.getRegistrationsOverTime = async function (days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.aggregate([
      { $match: { createdAt: { $gte: cutoff } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
          count: 1,
          _id: 0,
        },
      },
      { $sort: { date: 1 } },
    ]);
  };

// Get active user login counts by day over last N days
userSchema.statics.getLoginActivityOverTime = async function (days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.aggregate([
    { $match: { lastLogin: { $gte: cutoff } } },
    {
      $group: {
        _id: {
          year: { $year: '$lastLogin' },
          month: { $month: '$lastLogin' },
          day: { $dayOfMonth: '$lastLogin' },
        },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day',
          },
        },
        count: 1,
        _id: 0,
      },
    },
    { $sort: { date: 1 } },
  ]);
};

// Find users with failed login attempts above a threshold
userSchema.statics.findUsersWithFailedLogins = function (threshold = 5) {
  return this.find({ failedLogins: { $gte: threshold } }).populate(populateFields);
};

// Find users with incomplete profiles (missing phone or address)
userSchema.statics.findUsersWithIncompleteProfiles = function () {
  return this.find({
    $or: [{ phoneNumber: null }, { address: { $size: 0 } }],
  }).populate(populateFields);
};

// Group users by loyalty points brackets (0-100, 101-500, 501+)
userSchema.statics.getUserLoyaltyBrackets = async function () {
  return this.aggregate([
    {
      $bucket: {
        groupBy: '$loyaltyPoints',
        boundaries: [0, 101, 501, 1000000],
        default: 'Unknown',
        output: { count: { $sum: 1 } },
      },
    },
  ]);
};

// Aggregate and count most common user interests (top N)
userSchema.statics.getTopUserInterests = async function (limit = 10) {
  return this.aggregate([
    { $unwind: '$interests' },
    {
      $group: {
        _id: '$interests',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { interest: '$_id', count: 1, _id: 0 } },
  ]);
};

userSchema.statics.getAverageOrdersPerUser = async function () {
  const result = await this.aggregate([{ $project: { orderCount: { $size: '$orders' } } }, { $group: { _id: null, avgOrders: { $avg: '$orderCount' } } }]);
  return result[0]?.avgOrders || 0;
};



userSchema.statics.findLockedAccounts = async function () {
  return this.find({ lockoutUntil: { $gt: new Date() } }).populate('role');
},

  userSchema.statics.cleanupExpiredTokens = async function () {
    const now = new Date();

    // Clean up expired refresh tokens
    await this.updateMany(
      {},
      {
        $pull: {
          refreshTokens: {
            $or: [
              { expiresAt: { $lt: now } },
              { isActive: false }
            ]
          }
        }
      }
    );

    // Clean up expired OTPs
    await this.updateMany(
      { otpExpiry: { $lt: now } },
      {
        $unset: {
          otpCode: 1,
          otpExpiry: 1,
          otpType: 1,
          otpAttempts: 1
        }
      }
    );

    // Clean up expired verification tokens
    await this.updateMany(
      { emailVerificationExpiry: { $lt: now } },
      {
        $unset: {
          emailVerificationToken: 1,
          emailVerificationExpiry: 1
        }
      }
    );

    // Clean up expired reset tokens
    await this.updateMany(
      { resetTokenExpiration: { $lt: now } },
      {
        $unset: {
          resetToken: 1,
          resetTokenExpiration: 1
        }
      }
    );
  },

  // Password Reset Flow
  userSchema.statics.initiatePasswordReset = async function (email) {
    const user = await this.findOne({ email: email.toLowerCase() });

    if (!user) {
      return { success: true };
    }

    const resetToken = await user.generateResetPasswordToken();
    await user.save();

    return { user, resetToken };
  },

  userSchema.statics.completePasswordReset = async function (token, newPassword) {
    const user = await this.findOne({
      resetToken: token,
      resetTokenExpiration: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    await user.resetPassword(token, newPassword);
    return user;
  },


  userSchema.statics.authenticateUser = async function (identifier, password, ipAddress = null, userAgent = null, deviceInfo = {}) {
    const user = await this.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    }).populate('role');

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.isLocked) {
      const lockTimeRemaining = Math.ceil((user.loginSecurity.lockedUntil - new Date()) / (1000 * 60));
      throw new Error(`Account locked. Try again in ${lockTimeRemaining} minutes`);
    }

    // Check if account is active
    if (user.status !== 'active') {
      throw new Error('Account is not active');
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      await user.handleFailedLogin(deviceInfo, 'invalid_password');
      throw new Error('Invalid credentials');
    }
    // Check if OTP is required
    const requiresOTP = user.requiresOTP('login') && otpService.isEnabled();

    if (requiresOTP) {
      // Return user with OTP requirement flag
      return {
        user,
        requiresMFA: true,
        availableMethods: user.availableOTPMethods
      };
    }


    await user.handleSuccessfulLogin(deviceInfo);

    return {
      user,
      requiresMFA: false
    };
  };

userSchema.statics.authenticateSocial = async function (profileData, identifier, deviceInfo = {}) {
  const user = await this.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { username: identifier }
    ]
  }).populate('role');

  if (!user) {
    user = new User({
      email: email,
      username: profileData.username || email.split('@')[0],
      isVerified: true,                // Assume verified by social provider
      isEmailVerified: true,
      role: 'customer',
      firstName: profileData.firstName || '',
      lastName: profileData.lastName || '',
      socialLogins: [{
        provider: profileData.provider,
        email: identifier,
        verified: true,
        providerId: profileData.providerId,
        connectedAt: new Date()
      }],
      activeSessions: []
    });
    await user.save();
    await user.handleSuccessfulLogin(deviceInfo);
    return {
      user,
      requiresMFA: false
    };
  }

  // Check if account is locked
  if (user.isLocked) {
    const lockTimeRemaining = Math.ceil((user.loginSecurity.lockedUntil - new Date()) / (1000 * 60));
    throw new Error(`Account locked. Try again in ${lockTimeRemaining} minutes`);
  }

  // Check if account is active
  if (user.status !== 'active') {
    throw new Error('Account is not active');
  }

  await user.handleSuccessfulLogin(deviceInfo);

  return {
    user,
    requiresMFA: false
  };
};

userSchema.statics.handleSocialLogin = async function (identifier, deviceInfo = {}) {


}

/**
 * Verify user credentials with OTP
 */
userSchema.statics.authenticateWithOTP = async function (userId, otpCode, deviceInfo = {}) {
  try {
    const user = await this.findById(userId).populate('role');

    if (!user) {
      throw new Error('User not found');
    }

    // Verify OTP
    const otpValid = await user.verifyOTP(otpCode, 'login', deviceInfo);

    if (!otpValid) {
      throw new Error('Invalid or expired OTP');
    }

    // Complete authentication
    await user.handleSuccessfulLogin(deviceInfo);

    return user;
  } catch (error) {
    throw error;
  }
};


userSchema.statics.adminActivateUser = async function (userId, adminId, reason = null) {
  const user = await this.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return await user.activateUser(adminId, reason);
};

userSchema.statics.adminDeactivateUser = async function (userId, adminId, reason = null) {
  const user = await this.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  return await user.deactivateUser(adminId, reason);
};

userSchema.statics.getSecurityReport = async function (timeframe = 30) {
  const startDate = new Date(Date.now() - (timeframe * 24 * 60 * 60 * 1000));

  const stats = await this.aggregate([
    {
      $match: {
        'loginHistory.loginTime': { $gte: startDate }
      }
    },
    {
      $unwind: '$loginHistory'
    },
    {
      $match: {
        'loginHistory.loginTime': { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalLogins: { $sum: 1 },
        successfulLogins: {
          $sum: { $cond: ['$loginHistory.successful', 1, 0] }
        },
        failedLogins: {
          $sum: { $cond: ['$loginHistory.successful', 0, 1] }
        },
        uniqueUsers: { $addToSet: '$_id' }
      }
    },
    {
      $project: {
        totalLogins: 1,
        successfulLogins: 1,
        failedLogins: 1,
        uniqueUsersCount: { $size: '$uniqueUsers' },
        successRate: {
          $multiply: [
            { $divide: ['$successfulLogins', '$totalLogins'] },
            100
          ]
        }
      }
    }
  ]);

  const lockedAccounts = await this.countDocuments({
    lockoutUntil: { $gt: new Date() }
  });

  const unverifiedAccounts = await this.countDocuments({
    emailVerified: false,
    createdAt: { $lt: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)) }
  });

  return {
    loginStats: stats[0] || {
      totalLogins: 0,
      successfulLogins: 0,
      failedLogins: 0,
      uniqueUsersCount: 0,
      successRate: 0
    },
    lockedAccounts,
    unverifiedAccounts,
    timeframe
  };
}

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
