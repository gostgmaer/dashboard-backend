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
  JWT_REFRESH_SECRET = 'your-super-secret-refresh-key',
  JWT_EXPIRY = '15m',
  JWT_REFRESH_EXPIRY = '7d',
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

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ─────────── Identity & Authentication ───────────
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    socialID: { type: String, default: null },
    email: { type: String, required: true, unique: true, lowercase: true },
    hash_password: { type: String, required: false },
    role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },

    // ─────────── Personal Information ───────────
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
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
    loginHistory: [
      {
        loginTime: Date,
        ipAddress: String,
        userAgent: String,
        successful: Boolean,
        failureReason: String,
      },
    ],
    securityEvents: [
      {
        event: String,
        timestamp: { type: Date, default: Date.now },
        ipAddress: String,
        userAgent: String,
        details: Object,
      },
    ],

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
  return `${this.firstName} ${this.lastName}`;
});
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockoutUntil && this.lockoutUntil > Date.now());
});
userSchema.pre('save', function (next) {
  if (this.isModified('hash_password') && this.hash_password) {
    // Password will be hashed in the setPassword method
  }
  next();
});
// Common population logic for all get methods
const populateFields = ['role', 'address', 'orders', 'favoriteProducts', 'shoppingCart', 'wishList', 'referredBy', 'created_by', 'updated_by'];

userSchema.method({
  async getMyProfile() {
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

  // Mark user as verified
  async verifyUser() {
    this.isVerified = true;
    this.confirmToken = null;
    await this.save();
    return (await this.populate(populateFields)).isVerified;
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
  addSecurityEvent(event, ipAddress = null, userAgent = null, details = {}) {
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
  generateAccessToken() {
    const payload = {
      userId: this._id,
      username: this.username,
      email: this.email,
      role: this.role,
      permissions: this.permissions || []
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
      issuer: 'your-app-name',
      audience: 'your-app-users'
    });
  },

  generateRefreshToken() {
    const payload = {
      userId: this._id,
      tokenType: 'refresh'
    };

    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRY,
      issuer: 'your-app-name',
      audience: 'your-app-users'
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
    const tokenData = this.refreshTokens.find(rt =>
      rt.token === refreshToken && rt.isActive && rt.expiresAt > new Date()
    );

    if (!tokenData) {
      throw new Error('Invalid or expired refresh token');
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      if (decoded.userId !== this._id.toString()) {
        throw new Error('Token mismatch');
      }

      return this.generateAccessToken();
    } catch (error) {
      throw new Error('Invalid refresh token');
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
    this.resetToken = crypto.randomBytes(20).toString('hex');
    this.resetTokenExpiration = Date.now() + 3600000; // 1 hour
    await this.save();
    return this.resetToken;
  },
  async checkResetTokenValidity(token) {
    return this.resetToken === token && this.resetTokenExpiration > Date.now();
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


  // Account security & sessions



  async handleFailedLogin(ipAddress = null, userAgent = null) {
    this.failedLoginAttempts += 1;
    this.consecutiveFailedAttempts += 1;
    this.lastLoginAttempt = new Date();

    // Add to login history
    this.loginHistory.push({
      loginTime: new Date(),
      ipAddress,
      userAgent,
      successful: false,
      failureReason: 'Invalid credentials'
    });

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
    return this.isLocked;
  },



  async handleSuccessfulLogin(ipAddress = null, userAgent = null) {
    this.lastLogin = new Date();
    this.failedLoginAttempts = 0;
    this.consecutiveFailedAttempts = 0;
    this.lockoutUntil = null;
    this.lastLoginAttempt = new Date();

    // Add to login history
    this.loginHistory.push({
      loginTime: new Date(),
      ipAddress,
      userAgent,
      successful: true
    });

    // Limit login history to last 50 entries
    if (this.loginHistory.length > 50) {
      this.loginHistory = this.loginHistory.slice(-50);
    }

    await this.save();
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
  async reactivateAccount() {
    this.status = 'active';
    this.deactivationReason = null;
    await this.save();
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

  // Security & Session Management
  async invalidateAllSessions() {
    this.tokens = [];
    this.session = [];
    await this.save();
  },
  async revokeToken(token) {
    this.tokens = this.tokens.filter((t) => t.token !== token);
    await this.save();
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
      // Don't reveal if user exists for security
      return { success: true };
    }

    const resetToken = user.generateResetPasswordToken();
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


  userSchema.statics.authenticateUser = async function (identifier, password, ipAddress = null, userAgent = null) {
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
      const lockTimeRemaining = Math.ceil((user.lockoutUntil - new Date()) / (1000 * 60));
      throw new Error(`Account locked. Try again in ${lockTimeRemaining} minutes`);
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);

    if (!isValidPassword) {
      await user.handleFailedLogin(ipAddress, userAgent);
      throw new Error('Invalid credentials');
    }

    // Check if user is active and verified for login
    if (user.status !== 'active') {
      throw new Error('Account is not active');
    }

    await user.handleSuccessfulLogin(ipAddress, userAgent);
    return user;
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
