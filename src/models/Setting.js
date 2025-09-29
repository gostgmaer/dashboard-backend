// setting.model.js
const mongoose = require('mongoose');

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
  },
  { timestamps: true }
);

// ===== Helper / Static Methods =====

// Get the current settings (singleton pattern)
settingSchema.statics.getSettings = async function () {
  return this.findOne().lean();
};

// Update settings (create if not exists)
settingSchema.statics.updateSettings = async function (data, updated_by) {
  const updateData = { ...data };
  if (updated_by) updateData.updated_by = updated_by;

  return this.findOneAndUpdate({}, updateData, {
    upsert: true,
    new: true,
    runValidators: true,
  });
};

// Toggle maintenance mode
settingSchema.statics.toggleMaintenanceMode = async function (status) {
  return this.findOneAndUpdate({}, { maintenanceMode: status }, { new: true });
};

// Toggle live status
settingSchema.statics.toggleLiveStatus = async function (status) {
  return this.findOneAndUpdate({}, { isLive: status }, { new: true });
};

// Update branding
settingSchema.statics.updateBranding = async function (branding) {
  return this.findOneAndUpdate({}, { branding }, { new: true });
};

// Update SEO settings
settingSchema.statics.updateSEO = async function (seo) {
  return this.findOneAndUpdate({}, { seo }, { new: true });
};

// Update payment methods
settingSchema.statics.updatePaymentMethods = async function (methods) {
  return this.findOneAndUpdate({}, { paymentMethods: methods }, { new: true });
};
// ===== Additional Static Methods =====

// Update contact info
settingSchema.statics.updateContactInfo = async function (contactInfo) {
  return this.findOneAndUpdate({}, { contactInfo }, { new: true, runValidators: true });
};

// Update shipping options
settingSchema.statics.updateShippingOptions = async function (options) {
  return this.findOneAndUpdate({}, { shippingOptions: options }, { new: true });
};

// Update email templates
settingSchema.statics.updateEmailTemplates = async function (templates) {
  return this.findOneAndUpdate({}, { emailTemplates: templates }, { new: true });
};

// Update analytics IDs
settingSchema.statics.updateAnalytics = async function (analytics) {
  return this.findOneAndUpdate({}, { analytics }, { new: true });
};

// Update currency & tax settings
settingSchema.statics.updateCurrencyAndTax = async function ({ currency, currencySymbol, taxRate }) {
  return this.findOneAndUpdate({}, { currency, currencySymbol, taxRate }, { new: true });
};

// Update loyalty program settings
settingSchema.statics.updateLoyaltyProgram = async function (loyaltyProgram) {
  return this.findOneAndUpdate({}, { loyaltyProgram }, { new: true });
};

// Update policies (return, privacy, terms)
settingSchema.statics.updatePolicies = async function (policies) {
  return this.findOneAndUpdate(
    {},
    {
      returnPolicy: policies.returnPolicy,
      privacyPolicy: policies.privacyPolicy,
      termsOfService: policies.termsOfService,
    },
    { new: true }
  );
};

// Update featured categories
settingSchema.statics.updateFeaturedCategories = async function (categoryIds) {
  return this.findOneAndUpdate({}, { featuredCategories: categoryIds }, { new: true });
};

// Update min/max order amounts
settingSchema.statics.updateOrderLimits = async function ({ minOrderAmount, maxOrderAmount }) {
  return this.findOneAndUpdate({}, { minOrderAmount, maxOrderAmount }, { new: true });
};

// Reset settings to defaults (useful for staging/dev)
settingSchema.statics.resetToDefaults = async function (defaultData) {
  await this.deleteMany({});
  return this.create(defaultData);
};

// ===== Additional Instance Methods =====

// Merge partial updates into current settings
settingSchema.methods.mergeAndSave = async function (partialData) {
  Object.assign(this, partialData);
  return this.save();
};

// Check if store is in maintenance mode
settingSchema.methods.isInMaintenance = function () {
  return this.maintenanceMode === true;
};

// Check if store is live
settingSchema.methods.isStoreLive = function () {
  return this.isLive === true;
};

// ===== Instance Methods =====

// Safe JSON output
settingSchema.methods.toJSONSafe = function () {
  const obj = this.toObject();
  delete obj.smtpPassword; // never expose sensitive data
  return obj;
};

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;
