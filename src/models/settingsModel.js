const mongoose = require('mongoose');
const deepMerge = require('lodash.merge');

const settingSchema = new mongoose.Schema(
  {
    // Basic Settings
    siteName: { type: String, required: true, trim: true },
    siteKey: { type: String, required: true, unique: true, trim: true },
    isDeleted: { type: Boolean, default: false },
    name: { type: String, trim: true },
    isLive: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    siteTimezone: { type: String, default: 'UTC', trim: true },
    siteLocale: { type: String, default: 'en-US', trim: true },
    defaultPageSize: { type: Number, default: 20 },
    maxUploadSizeMB: { type: Number, default: 10 },

    // Contact Information
    contactInfo: {
      email: { type: String, required: true, lowercase: true, trim: true },
      phone: { type: String, trim: true },
      address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        zipCode: { type: String, trim: true },
        country: { type: String, trim: true },
      },
      supportEmail: { type: String, trim: true },
      supportPhone: { type: String, trim: true },
      contactHours: { type: String, trim: true },
    },

    // Branding
    branding: {
      logo: { type: String, trim: true },
      favicon: { type: String, trim: true },
      themeColor: { type: String, default: '#000000' },
      customCSSUrl: { type: String, trim: true },
      customJSUrl: { type: String, trim: true },
    },

    // Shipping
    shipping: {
      shippingOptions: [{ type: String, trim: true }],
      shippingMethods: [{ type: String, trim: true }],
      minOrderAmount: { type: Number, default: 0 },
      maxOrderAmount: { type: Number },
      freeShippingThreshold: { type: Number, default: 100 },
      shippingHandlingFee: { type: Number, default: 5 },
      shippingInsuranceEnabled: { type: Boolean, default: false },
    },

    // Email
    email: {
      smtpHost: { type: String, trim: true },
      smtpPort: { type: Number },
      smtpUser: { type: String, trim: true },
      smtpPassword: { type: String, trim: true },
      templates: {
        orderConfirmation: { type: String },
        passwordReset: { type: String },
        shippingNotification: { type: String },
        promotional: { type: String },
      },
      emailSenderName: { type: String, trim: true },
      emailSenderAddress: { type: String, trim: true },
    },

    // SEO
    seo: {
      title: { type: String, trim: true },
      description: { type: String, trim: true },
      keywords: [{ type: String, trim: true }],
      googleSiteVerification: { type: String, trim: true },
      robotsTxt: { type: String },
    },

    // Analytics
    analytics: {
      googleAnalyticsID: { type: String, trim: true },
      facebookPixelID: { type: String, trim: true },
      hotjarID: { type: String, trim: true },
      segmentWriteKey: { type: String, trim: true },
    },

    // Currency and Taxation
    currencySettings: {
      currency: { type: String, required: true, default: 'USD', trim: true },
      currencySymbol: { type: String, default: '$', trim: true },
      taxRate: { type: Number, default: 0 },
      taxEnabled: { type: Boolean, default: false },
      taxInclusivePricing: { type: Boolean, default: false },
    },

    // Payment
    payment: {
      paymentMethods: [{ type: String, trim: true }],
      enabledMFA: { type: Boolean, default: false },
      defaultPaymentMethod: { type: String, trim: true },
      stripePublicKey: { type: String, trim: true },
      stripeSecretKey: { type: String, trim: true },
      paypalClientId: { type: String, trim: true },
      paypalSecret: { type: String, trim: true },
      currencyConversionEnabled: { type: Boolean, default: false },
    },

    // Social Links
    socialMediaLinks: {
      facebook: { type: String, trim: true },
      twitter: { type: String, trim: true },
      instagram: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      youtube: { type: String, trim: true },
      pinterest: { type: String, trim: true },
      tiktok: { type: String, trim: true },
    },

    // Features
    featuredCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    loyaltyProgram: {
      enabled: { type: Boolean, default: false },
      pointsPerDollar: { type: Number, default: 1 },
      tieredRewardsEnabled: { type: Boolean, default: false },
      extraRewardMultiplier: { type: Number, default: 1 },
    },

    // Policies
    policies: {
      returnPolicy: { type: String },
      privacyPolicy: { type: String },
      termsOfService: { type: String },
      cookiePolicy: { type: String },
      gdprComplianceEnabled: { type: Boolean, default: false },
    },

    // Security
    security: {
      passwordMinLength: { type: Number, default: 8 },
      passwordRequireSymbols: { type: Boolean, default: true },
      passwordRequireNumbers: { type: Boolean, default: true },
      passwordRequireUppercase: { type: Boolean, default: true },
      maxLoginAttempts: { type: Number, default: 5 },
      accountLockoutDurationMinutes: { type: Number, default: 30 },
      sessionTimeoutMinutes: { type: Number, default: 60 },
      refreshTokenExpiryDays: { type: Number, default: 30 },
      enableCaptchaOnLogin: { type: Boolean, default: false },
      enableCaptchaOnSignup: { type: Boolean, default: false },
      enableIPRateLimiting: { type: Boolean, default: true },
      maxRequestsPerMinute: { type: Number, default: 60 },
      allowedIPRanges: [{ type: String, trim: true }],
      auditLoggingEnabled: { type: Boolean, default: true },
      twoFactorAuthRequired: { type: Boolean, default: false },
      jwtSecret: { type: String, trim: true },
      jwtExpiryMinutes: { type: Number, default: 60 },
      passwordResetTokenExpiryMinutes: { type: Number, default: 15 },
    },

    // Miscellaneous
    misc: {
      allowGuestCheckout: { type: Boolean, default: true },
      enableDarkMode: { type: Boolean, default: false },
      defaultLanguage: { type: String, default: 'en' },
      supportedLanguages: [{ type: String, default: ['en'] }],
      defaultPageSize: { type: Number, default: 20 },
      maxUploadSizeMB: { type: Number, default: 10 },
      enablePushNotifications: { type: Boolean, default: false },
      notificationSound: { type: String, default: 'default' },
      customCSSUrl: { type: String, trim: true },
      customJSUrl: { type: String, trim: true },
    },
  },
    {   timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true } }
);


settingSchema.virtual('fullContactInfo').get(function () {
  if (!this.contactInfo) return '';
  const addr = this.contactInfo.address;
  let addressParts = [];
  if (addr) {
    if (addr.street) addressParts.push(addr.street);
    if (addr.city) addressParts.push(addr.city);
    if (addr.state) addressParts.push(addr.state);
    if (addr.zipCode) addressParts.push(addr.zipCode);
    if (addr.country) addressParts.push(addr.country);
  }
  return `${this.contactInfo.email} | ${addressParts.join(', ')}`;
});

// Pre-save hook for normalization and validations
settingSchema.pre('save', async function (next) {
  // Ensure siteKey is lowercase (example normalization)
  if (this.siteKey) {
    this.siteKey = this.siteKey.toLowerCase();
  }
  // Example validation: maxUploadSizeMB should be positive
  if (this.maxUploadSizeMB < 0) {
    return next(new Error('maxUploadSizeMB must be non-negative'));
  }
  next();
});

// Instance Methods
settingSchema.methods.mergeAndSave = async function (partialData) {
  Object.assign(this, partialData);
  return this.save();
};

settingSchema.methods.isInMaintenance = function () {
  return this.basic?.maintenanceMode || false;
};

settingSchema.methods.isStoreLive = function () {
  return this.basic?.isLive || false;
};


settingSchema.methods.toJSONSafe = function () {
  const obj = this.toObject();
  if (obj.email && obj.email.smtpPassword) {
    delete obj.email.smtpPassword;
  }
  if (obj.security) {
    delete obj.security.jwtSecret;
  }
  return obj;
};

// Additional Instance Methods
settingSchema.methods.toggleMaintenance = async function () {
  this.maintenanceMode = !this.maintenanceMode;
  return this.save();
};

settingSchema.methods.addFeaturedCategory = async function (categoryId) {
  if (!this.featuredCategories.includes(categoryId)) {
    this.featuredCategories.push(categoryId);
  }
  return this.save();
};

settingSchema.methods.removeFeaturedCategory = async function (categoryId) {
  this.featuredCategories = this.featuredCategories.filter(
    (id) => id.toString() !== categoryId.toString()
  );
  return this.save();
};

settingSchema.methods.updateSocialLink = async function (platform, url) {
  if (this.socialMediaLinks.hasOwnProperty(platform)) {
    this.socialMediaLinks[platform] = url;
    return this.save();
  } else {
    throw new Error(`Unsupported social media platform: ${platform}`);
  }
};

settingSchema.methods.resetSecuritySettings = async function () {
  this.security = {
    passwordMinLength: 8,
    passwordRequireSymbols: true,
    passwordRequireNumbers: true,
    passwordRequireUppercase: true,
    maxLoginAttempts: 5,
    accountLockoutDurationMinutes: 30,
    sessionTimeoutMinutes: 60,
    refreshTokenExpiryDays: 30,
    enableCaptchaOnLogin: false,
    enableCaptchaOnSignup: false,
    enableIPRateLimiting: true,
    maxRequestsPerMinute: 60,
    allowedIPRanges: [],
    auditLoggingEnabled: true,
    twoFactorAuthRequired: false,
    jwtSecret: '',
    jwtExpiryMinutes: 60,
    passwordResetTokenExpiryMinutes: 15,
  };
  return this.save();
};


settingSchema.methods.deepMergeUpdate = async function (partialUpdates) {
  for (const key in partialUpdates) {
    if (typeof partialUpdates[key] === 'object' && !Array.isArray(partialUpdates[key])) {
      this[key] = deepMerge(this[key] || {}, partialUpdates[key]);
    } else {
      this[key] = partialUpdates[key];
    }
  }
  return this.save();
};

/**
 * Toggle any boolean flag nested under specified path (dot notation supported).
 * E.g. toggleFlag('basic.isLive')
 */
settingSchema.methods.toggleFlag = async function (path) {
  const keys = path.split('.');
  let obj = this;
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
    if (!obj) throw new Error(`Invalid path ${path}`);
  }
  const lastKey = keys[keys.length - 1];
  obj[lastKey] = !obj[lastKey];
  return this.save();
};

/**
 * Append a value to an array property if not already present.
 * Supports dot notation for nested arrays.
 */
settingSchema.methods.appendToArray = async function (path, value) {
  const keys = path.split('.');
  let obj = this;
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
    if (!obj) throw new Error(`Invalid path ${path}`);
  }
  const lastKey = keys[keys.length - 1];
  if (!obj[lastKey].includes(value)) {
    obj[lastKey].push(value);
    return this.save();
  }
  return this;
};

/**
 * Remove a value from an array property.
 * Supports dot notation for nested arrays.
 */
settingSchema.methods.removeFromArray = async function (path, value) {
  const keys = path.split('.');
  let obj = this;
  for (let i = 0; i < keys.length - 1; i++) {
    obj = obj[keys[i]];
    if (!obj) throw new Error(`Invalid path ${path}`);
  }
  const lastKey = keys[keys.length - 1];
  obj[lastKey] = obj[lastKey].filter((v) => v.toString() !== value.toString());
  return this.save();
};


// Additional Static Methods

// Resets policies to minimal empty strings
settingSchema.statics.clearPolicies = async function () {
  return this.findOneAndUpdate(
    {},
    {
      'policies.returnPolicy': '',
      'policies.privacyPolicy': '',
      'policies.termsOfService': '',
      'policies.cookiePolicy': '',
      'policies.gdprComplianceEnabled': false,
    },
    { new: true }
  );
};

settingSchema.statics.setDarkModeForAllUsers = async function (enabled) {
  return this.updateMany({}, { 'misc.enableDarkMode': enabled });
};

settingSchema.statics.getActivePaymentMethods = async function () {
  const settings = await this.findOne({});
  return settings?.payment?.paymentMethods || [];
};

settingSchema.statics.enableTwoFactorAuth = async function (enabled) {
  return this.findOneAndUpdate({}, { 'security.twoFactorAuthRequired': enabled }, { new: true });
};

settingSchema.statics.addAllowedIPRange = async function (ipRange) {
  const settings = await this.findOne({});
  if (!settings.security.allowedIPRanges.includes(ipRange)) {
    settings.security.allowedIPRanges.push(ipRange);
    await settings.save();
  }
  return settings;
};

settingSchema.statics.removeAllowedIPRange = async function (ipRange) {
  const settings = await this.findOne({});
  settings.security.allowedIPRanges = settings.security.allowedIPRanges.filter(
    (ip) => ip !== ipRange
  );
  await settings.save();
  return settings;
};

settingSchema.statics.enablePushNotificationsForAllUsers = async function (enabled) {
  return this.updateMany({}, { 'misc.enablePushNotifications': enabled });
};

settingSchema.statics.getDefaultLanguage = async function () {
  const settings = await this.findOne({});
  return settings?.misc?.defaultLanguage || 'en';
};

settingSchema.statics.setDefaultLanguage = async function (langCode) {
  return this.findOneAndUpdate({}, { 'misc.defaultLanguage': langCode }, { new: true });
};


// Static Methods for singleton pattern and updates

settingSchema.statics.getSettings = async function () {
  let settings = await this.findOne().lean();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

settingSchema.statics.updateSettings = async function (data, updated_by) {
  const updateData = { ...data };
  if (updated_by) {
    updateData.updated_by = updated_by;
  }
  return this.findOneAndUpdate({}, updateData, {
    upsert: true,
    new: true,
    runValidators: true,
  });
};

settingSchema.statics.toggleMaintenanceMode = async function (status) {
  return this.findOneAndUpdate(
    {},
    { 'basic.maintenanceMode': status },
    { new: true }
  );
};

settingSchema.statics.toggleLiveStatus = async function (status) {
  return this.findOneAndUpdate({}, { 'basic.isLive': status }, { new: true });
};

// Update methods for specific sub-documents for granular updates

settingSchema.statics.updateBranding = async function (branding) {
  return this.findOneAndUpdate({}, { branding }, { new: true });
};

settingSchema.statics.updateSEO = async function (seo) {
  return this.findOneAndUpdate({}, { seo }, { new: true });
};

settingSchema.statics.updatePaymentMethods = async function (methods) {
  return this.findOneAndUpdate({}, { 'payment.paymentMethods': methods }, { new: true });
};

settingSchema.statics.updateContactInfo = async function (contactInfo) {
  return this.findOneAndUpdate({}, { contactInfo }, { new: true, runValidators: true });
};

settingSchema.statics.updateShippingOptions = async function (options) {
  return this.findOneAndUpdate({}, { 'shipping.shippingOptions': options }, { new: true });
};

settingSchema.statics.updateEmailTemplates = async function (templates) {
  return this.findOneAndUpdate({}, { 'email.templates': templates }, { new: true });
};

settingSchema.statics.updateAnalytics = async function (analytics) {
  return this.findOneAndUpdate({}, { analytics }, { new: true });
};

settingSchema.statics.updateCurrencyAndTax = async function (currency, currencySymbol, taxRate) {
  return this.findOneAndUpdate(
    {},
    { 'currencySettings.currency': currency, 'currencySettings.currencySymbol': currencySymbol, 'currencySettings.taxRate': taxRate },
    { new: true }
  );
};

settingSchema.statics.updateLoyaltyProgram = async function (loyaltyProgram) {
  return this.findOneAndUpdate({}, { loyaltyProgram }, { new: true });
};

settingSchema.statics.updatePolicies = async function (policies) {
  return this.findOneAndUpdate(
    {},
    {
      'policies.returnPolicy': policies.returnPolicy,
      'policies.privacyPolicy': policies.privacyPolicy,
      'policies.termsOfService': policies.termsOfService,
      'policies.cookiePolicy': policies.cookiePolicy,
      'policies.gdprComplianceEnabled': policies.gdprComplianceEnabled,
    },
    { new: true }
  );
};

settingSchema.statics.updateFeaturedCategories = async function (categoryIds) {
  return this.findOneAndUpdate({}, { featuredCategories: categoryIds }, { new: true });
};

settingSchema.statics.updateOrderLimits = async function (minOrderAmount, maxOrderAmount) {
  return this.findOneAndUpdate(
    {},
    { 'shipping.minOrderAmount': minOrderAmount, 'shipping.maxOrderAmount': maxOrderAmount },
    { new: true }
  );
};

settingSchema.statics.resetToDefaults = async function (defaultData) {
  await this.deleteMany();
  return this.create(defaultData);
};

/**
 * Bulk update multiple subfields of settings in one atomic update operation.
 * Input is an object with dot notation keys and values to update.
 */
settingSchema.statics.bulkUpdateFields = async function (updateFields) {
  const updateOps = {};
  for (let key in updateFields) {
    updateOps[key] = updateFields[key];
  }
  return this.findOneAndUpdate({}, updateOps, { new: true });
};

/**
 * Query settings by partial match in nested fields - useful for feature flags or partial configs.
 * Supports dot notation keys in filter object.
 */
settingSchema.statics.findByPartialFields = async function (filterFields) {
  const query = {};
  for (let key in filterFields) {
    query[key] = { $regex: filterFields[key], $options: 'i' };
  }
  return this.findOne(query).lean();
};

/**
 * Audit log wrapper for updates: accepts user info and logs changes before update.
 * Assumes auditLogs is an array field on schema for storing logs.
 */
settingSchema.statics.auditUpdate = async function (updates, user) {
  const settings = await this.findOne({});
  const before = settings.toObject();
  const after = { ...before, ...updates };
  const changedFields = [];

  for (const key in updates) {
    if (JSON.stringify(before[key]) !== JSON.stringify(updates[key])) {
      changedFields.push({ field: key, before: before[key], after: updates[key] });
    }
  }

  const logEntry = {
    user: user || 'system',
    timestamp: new Date(),
    changes: changedFields,
  };

  if (!settings.auditLogs) {
    settings.auditLogs = [];
  }
  settings.auditLogs.push(logEntry);

  Object.assign(settings, updates);
  await settings.save();

  return settings;
};

/**
 * Reset specific sections to default values.
 * Provide array of section keys, e.g. ['security', 'payment']
 */
settingSchema.statics.resetSectionsToDefaults = async function (sections = []) {
  const defaults = {
    security: {
      passwordMinLength: 8,
      passwordRequireSymbols: true,
      passwordRequireNumbers: true,
      passwordRequireUppercase: true,
      maxLoginAttempts: 5,
      accountLockoutDurationMinutes: 30,
      sessionTimeoutMinutes: 60,
      refreshTokenExpiryDays: 30,
      enableCaptchaOnLogin: false,
      enableCaptchaOnSignup: false,
      enableIPRateLimiting: true,
      maxRequestsPerMinute: 60,
      allowedIPRanges: [],
      auditLoggingEnabled: true,
      twoFactorAuthRequired: false,
      jwtSecret: '',
      jwtExpiryMinutes: 60,
      passwordResetTokenExpiryMinutes: 15,
    },
    payment: {
      paymentMethods: [],
      enabledMFA: false,
      defaultPaymentMethod: '',
      stripePublicKey: '',
      stripeSecretKey: '',
      paypalClientId: '',
      paypalSecret: '',
      currencyConversionEnabled: false,
    },
    // Add more defaults for other sections as needed
  };

  const update = {};

  for (const section of sections) {
    if (defaults[section]) {
      update[section] = defaults[section];
    }
  }

  return this.findOneAndUpdate({}, update, { new: true });
};

// Export Model
const Setting = mongoose.model('Setting', settingSchema);
module.exports = Setting;
