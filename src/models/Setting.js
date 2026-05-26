// setting.model.js
const mongoose = require('mongoose');

// Cache settings in-memory map keyed by siteKey (tenant)
const cachedSettingsMap = new Map();

const settingSchema = new mongoose.Schema(
  {
    siteName: { type: String, required: true, trim: true },
    siteKey: { type: String, required: true, unique: true, trim: true },
    isDeleted: { type: Boolean, default: false },
    name: { type: String, trim: true },

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
    },

    branding: {
      logo: { type: String, trim: true },
      favicon: { type: String, trim: true },
      themeColor: { type: String, default: '#000000' },
    },

    shippingOptions: [{ type: String, trim: true }],
    emailTemplates: {
      orderConfirmation: { type: String },
      passwordReset: { type: String },
    },

    seo: {
      title: { type: String, trim: true },
      description: { type: String, trim: true },
      keywords: [{ type: String, trim: true }],
    },

    analytics: {
      googleAnalyticsID: { type: String, trim: true },
      facebookPixelID: { type: String, trim: true },
    },

    currency: { type: String, required: true, default: 'USD', trim: true },
    taxRate: { type: Number, default: 0 },

    logo: { type: String, trim: true },
    favicon: { type: String, trim: true },
    enabledMFA: { type: Boolean, default: false },
    paymentMethods: [{ type: String, trim: true }],
    shippingMethods: [{ type: String, trim: true }],

    orderConfirmationEmailTemplate: { type: String },
    passwordResetEmailTemplate: { type: String },

    smtpHost: { type: String, trim: true },
    smtpPort: { type: Number },
    smtpUser: { type: String, trim: true },
    smtpPassword: { type: String, trim: true },

    stripeEnabled: { type: Boolean, default: false },
    stripePublicKey: { type: String, trim: true },
    stripeSecretKey: { type: String, trim: true },
    stripeWebhookSecret: { type: String, trim: true },

    paypalEnabled: { type: Boolean, default: false },
    paypalClientId: { type: String, trim: true },
    paypalClientSecret: { type: String, trim: true },
    paypalMode: { type: String, default: 'sandbox', trim: true },
    paypalWebhookId: { type: String, trim: true },

    razorpayEnabled: { type: Boolean, default: false },
    razorpayKeyId: { type: String, trim: true },
    razorpayKeySecret: { type: String, trim: true },
    razorpayWebhookSecret: { type: String, trim: true },

    otpEnabled: { type: Boolean, default: false },
    otpDefaultMethod: { type: String, default: 'email', trim: true },
    otpExpiryMinutes: { type: Number, default: 5 },
    otpMaxAttempts: { type: Number, default: 3 },
    otpLength: { type: Number, default: 6 },

    socialMediaLinks: {
      facebook: { type: String, trim: true },
      twitter: { type: String, trim: true },
      instagram: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      youtube: { type: String, trim: true },
      pinterest: { type: String, trim: true },
      tiktok: { type: String, trim: true },
    },

    isLive: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    maintenanceReason: { type: String, trim: true },

    featuredCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],

    currencySymbol: { type: String, default: '$', trim: true },
    minOrderAmount: { type: Number, default: 0 },
    maxOrderAmount: { type: Number },

    loyaltyProgram: {
      enabled: { type: Boolean, default: false },
      pointsPerDollar: { type: Number, default: 1 },
    },

    returnPolicy: { type: String },
    privacyPolicy: { type: String },
    termsOfService: { type: String },

    features: { type: Map, of: Boolean, default: {} },
  },
   {   timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true } }
);

// ===== Helper / Static Methods =====

// Get the current settings (singleton pattern)
settingSchema.statics.getSettings = async function () {
  if (cachedSettingsMap.has('__default__')) {
    return cachedSettingsMap.get('__default__');
  }
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const settings = await this.findOne({ siteKey: activeTenantKey }).lean();
  if (settings) {
    cachedSettingsMap.set('__default__', settings);
    cachedSettingsMap.set(settings.siteKey, settings);
  }
  return settings;
};

// Get settings strictly by siteKey/tenant
settingSchema.statics.getSettingsBySite = async function (siteKey) {
  if (cachedSettingsMap.has(siteKey)) {
    return cachedSettingsMap.get(siteKey);
  }
  const settings = await this.findOne({ siteKey }).lean();
  if (settings) {
    cachedSettingsMap.set(siteKey, settings);
  }
  return settings;
};

// Retrieve cached settings synchronously
settingSchema.statics.getCachedSettings = function (siteKey) {
  if (siteKey && cachedSettingsMap.has(siteKey)) {
    return cachedSettingsMap.get(siteKey);
  }
  if (cachedSettingsMap.has('__default__')) {
    return cachedSettingsMap.get('__default__');
  }
  return null;
};

// Update settings (create if not exists)
settingSchema.statics.updateSettings = async function (data, updated_by) {
  const updateData = { ...data };
  if (updated_by) updateData.updated_by = updated_by;

  const result = await this.findOneAndUpdate({}, updateData, {
    upsert: true,
    new: true,
    runValidators: true,
  });
  
  cachedSettingsMap.clear();
  return result;
};

// Toggle maintenance mode
settingSchema.statics.toggleMaintenanceMode = async function (status) {
  const result = await this.findOneAndUpdate({}, { maintenanceMode: status }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Toggle live status
settingSchema.statics.toggleLiveStatus = async function (status) {
  const result = await this.findOneAndUpdate({}, { isLive: status }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update branding
settingSchema.statics.updateBranding = async function (branding) {
  const result = await this.findOneAndUpdate({}, { branding }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update SEO settings
settingSchema.statics.updateSEO = async function (seo) {
  const result = await this.findOneAndUpdate({}, { seo }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update payment methods
settingSchema.statics.updatePaymentMethods = async function (methods) {
  const result = await this.findOneAndUpdate({}, { paymentMethods: methods }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// ===== Additional Static Methods =====

// Update contact info
settingSchema.statics.updateContactInfo = async function (contactInfo) {
  const result = await this.findOneAndUpdate({}, { contactInfo }, { new: true, runValidators: true });
  cachedSettingsMap.clear();
  return result;
};

// Update shipping options
settingSchema.statics.updateShippingOptions = async function (options) {
  const result = await this.findOneAndUpdate({}, { shippingOptions: options }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update email templates
settingSchema.statics.updateEmailTemplates = async function (templates) {
  const result = await this.findOneAndUpdate({}, { emailTemplates: templates }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update analytics IDs
settingSchema.statics.updateAnalytics = async function (analytics) {
  const result = await this.findOneAndUpdate({}, { analytics }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update currency & tax settings
settingSchema.statics.updateCurrencyAndTax = async function ({ currency, currencySymbol, taxRate }) {
  const result = await this.findOneAndUpdate({}, { currency, currencySymbol, taxRate }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update loyalty program settings
settingSchema.statics.updateLoyaltyProgram = async function (loyaltyProgram) {
  const result = await this.findOneAndUpdate({}, { loyaltyProgram }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update policies (return, privacy, terms)
settingSchema.statics.updatePolicies = async function (policies) {
  const result = await this.findOneAndUpdate(
    {},
    {
      returnPolicy: policies.returnPolicy,
      privacyPolicy: policies.privacyPolicy,
      termsOfService: policies.termsOfService,
    },
    { new: true }
  );
  cachedSettingsMap.clear();
  return result;
};

// Update featured categories
settingSchema.statics.updateFeaturedCategories = async function (categoryIds) {
  const result = await this.findOneAndUpdate({}, { featuredCategories: categoryIds }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update min/max order amounts
settingSchema.statics.updateOrderLimits = async function ({ minOrderAmount, maxOrderAmount }) {
  const result = await this.findOneAndUpdate({}, { minOrderAmount, maxOrderAmount }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Reset settings to defaults (useful for staging/dev)
settingSchema.statics.resetToDefaults = async function (defaultData) {
  await this.deleteMany({});
  const result = await this.create(defaultData);
  cachedSettingsMap.clear();
  return result;
};

// Safe public settings resolver
settingSchema.statics.getPublicSettings = async function () {
  const settings = await this.getSettings();
  if (!settings) return null;
  return new this(settings).toJSONSafe();
};

// Clear cached settings
settingSchema.statics.clearCache = function () {
  cachedSettingsMap.clear();
};

// Get section
settingSchema.statics.getSection = async function (section) {
  const settings = await this.getSettings();
  if (!settings) return null;
  return settings[section];
};

// Reset section
settingSchema.statics.resetSection = async function (section, defaultValue) {
  const result = await this.findOneAndUpdate({}, { [section]: defaultValue }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Set maintenance mode with reason
settingSchema.statics.setMaintenanceMode = async function (status, reason) {
  const result = await this.findOneAndUpdate({}, { maintenanceMode: status, maintenanceReason: reason }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Toggle dynamic feature flag
settingSchema.statics.toggleFeature = async function (featureName, status) {
  const result = await this.findOneAndUpdate({}, { [`features.${featureName}`]: status }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update a single branding field
settingSchema.statics.updateBrandingField = async function (key, value) {
  const result = await this.findOneAndUpdate({}, { [`branding.${key}`]: value }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Add payment method
settingSchema.statics.addPaymentMethod = async function (method) {
  const result = await this.findOneAndUpdate({}, { $addToSet: { paymentMethods: method } }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Remove payment method
settingSchema.statics.removePaymentMethod = async function (method) {
  const result = await this.findOneAndUpdate({}, { $pull: { paymentMethods: method } }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update currency
settingSchema.statics.updateCurrency = async function (currency) {
  const result = await this.findOneAndUpdate({}, { currency }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Increment loyalty points
settingSchema.statics.incrementLoyaltyPoints = async function (points) {
  const result = await this.findOneAndUpdate({}, { $inc: { 'loyaltyProgram.pointsPerDollar': points } }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Update specific policy
settingSchema.statics.updatePolicy = async function (type, content) {
  const fieldMap = {
    return: 'returnPolicy',
    privacy: 'privacyPolicy',
    terms: 'termsOfService'
  };
  const fieldName = fieldMap[type] || type;
  const result = await this.findOneAndUpdate({}, { [fieldName]: content }, { new: true });
  cachedSettingsMap.clear();
  return result;
};

// Audit update
settingSchema.statics.updateWithAudit = async function (updateObj) {
  const result = await this.findOneAndUpdate({}, updateObj, { new: true, runValidators: true });
  cachedSettingsMap.clear();
  return result;
};

// ===== Additional Instance Methods =====

// Merge partial updates into current settings
settingSchema.methods.mergeAndSave = async function (partialData) {
  Object.assign(this, partialData);
  const result = await this.save();
  cachedSettingsMap.clear();
  return result;
};

// Check if store is in maintenance mode
settingSchema.methods.isInMaintenance = function () {
  return this.maintenanceMode === true;
};

// Check if store is live
settingSchema.methods.isStoreLive = function () {
  return this.isLive === true;
};

// Safe JSON output
settingSchema.methods.toJSONSafe = function () {
  const obj = this.toObject();
  delete obj.smtpPassword; // never expose sensitive data
  delete obj.stripeSecretKey;
  delete obj.stripeWebhookSecret;
  delete obj.paypalClientSecret;
  delete obj.razorpayKeySecret;
  delete obj.razorpayWebhookSecret;
  return obj;
};

// Schema Metadata Definition for Auto-Generating dynamic UI
const SETTING_DEFINITIONS = [
  // Basic Section
  { key: 'siteName', label: 'Site Name', type: 'string', section: 'basic' },
  { key: 'siteKey', label: 'Site Key (Tenant ID)', type: 'string', section: 'basic', disabled: true },
  { key: 'isLive', label: 'Site Live Status', type: 'boolean', section: 'basic' },
  { key: 'maintenanceMode', label: 'Maintenance Mode', type: 'boolean', section: 'basic' },
  { key: 'minOrderAmount', label: 'Min Order Amount ($)', type: 'number', section: 'basic' },
  { key: 'maxOrderAmount', label: 'Max Order Amount ($)', type: 'number', section: 'basic' },

  // Contact Info Section
  { key: 'contactInfo.email', label: 'Contact Email', type: 'string', section: 'contact' },
  { key: 'contactInfo.phone', label: 'Contact Phone', type: 'string', section: 'contact' },
  { key: 'contactInfo.address.street', label: 'Street Address', type: 'string', section: 'contact' },
  { key: 'contactInfo.address.city', label: 'City', type: 'string', section: 'contact' },
  { key: 'contactInfo.address.state', label: 'State / Province', type: 'string', section: 'contact' },
  { key: 'contactInfo.address.zipCode', label: 'ZIP / Postal Code', type: 'string', section: 'contact' },
  { key: 'contactInfo.address.country', label: 'Country', type: 'string', section: 'contact' },

  // Branding Section
  { key: 'branding.logo', label: 'Logo URL', type: 'string', section: 'branding' },
  { key: 'branding.favicon', label: 'Favicon URL', type: 'string', section: 'branding' },
  { key: 'branding.themeColor', label: 'Theme Primary Color', type: 'color', section: 'branding' },

  // Currency & Tax Section
  { key: 'currency', label: 'Currency Code', type: 'select', section: 'currency', options: ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'] },
  { key: 'currencySymbol', label: 'Currency Symbol', type: 'string', section: 'currency' },
  { key: 'taxRate', label: 'Tax Rate (%)', type: 'number', section: 'currency' },

  // SMTP Settings Section
  { key: 'smtpHost', label: 'SMTP Host', type: 'string', section: 'email' },
  { key: 'smtpPort', label: 'SMTP Port', type: 'number', section: 'email' },
  { key: 'smtpUser', label: 'SMTP Username', type: 'string', section: 'email' },
  { key: 'smtpPassword', label: 'SMTP Password', type: 'password', section: 'email' },

  // Stripe Gateway Section
  { key: 'stripeEnabled', label: 'Stripe Enabled', type: 'boolean', section: 'stripe' },
  { key: 'stripePublicKey', label: 'Stripe Public Key', type: 'string', section: 'stripe' },
  { key: 'stripeSecretKey', label: 'Stripe Secret Key', type: 'password', section: 'stripe' },
  { key: 'stripeWebhookSecret', label: 'Stripe Webhook Secret', type: 'password', section: 'stripe' },

  // PayPal Gateway Section
  { key: 'paypalEnabled', label: 'PayPal Enabled', type: 'boolean', section: 'paypal' },
  { key: 'paypalClientId', label: 'PayPal Client ID', type: 'string', section: 'paypal' },
  { key: 'paypalClientSecret', label: 'PayPal Client Secret', type: 'password', section: 'paypal' },
  { key: 'paypalMode', label: 'PayPal Mode', type: 'select', section: 'paypal', options: ['sandbox', 'live'] },
  { key: 'paypalWebhookId', label: 'PayPal Webhook ID', type: 'string', section: 'paypal' },

  // Razorpay Gateway Section
  { key: 'razorpayEnabled', label: 'Razorpay Enabled', type: 'boolean', section: 'razorpay' },
  { key: 'razorpayKeyId', label: 'Razorpay Key ID', type: 'string', section: 'razorpay' },
  { key: 'razorpayKeySecret', label: 'Razorpay Key Secret', type: 'password', section: 'razorpay' },
  { key: 'razorpayWebhookSecret', label: 'Razorpay Webhook Secret', type: 'password', section: 'razorpay' },

  // OTP & Two-Factor MFA Section
  { key: 'otpEnabled', label: 'OTP Multi-Factor Enabled', type: 'boolean', section: 'otp' },
  { key: 'otpDefaultMethod', label: 'Default OTP Delivery', type: 'select', section: 'otp', options: ['email', 'sms', 'totp'] },
  { key: 'otpExpiryMinutes', label: 'OTP Expiry (minutes)', type: 'number', section: 'otp' },
  { key: 'otpMaxAttempts', label: 'Maximum Verification Attempts', type: 'number', section: 'otp' },
  { key: 'otpLength', label: 'OTP Code Length', type: 'number', section: 'otp' },

  // Policies Section
  { key: 'returnPolicy', label: 'Return Policy Text', type: 'text', section: 'policies' },
  { key: 'privacyPolicy', label: 'Privacy Policy Text', type: 'text', section: 'policies' },
  { key: 'termsOfService', label: 'Terms of Service Text', type: 'text', section: 'policies' },
];

const Setting = mongoose.model('Setting', settingSchema);
Setting.SETTING_DEFINITIONS = SETTING_DEFINITIONS;

module.exports = Setting;
