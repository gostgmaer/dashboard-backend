// setting.model.js
const mongoose = require('mongoose');

// Cache settings in-memory map keyed by siteKey (tenant)
const cachedSettingsMap = new Map();

const settingSchema = new mongoose.Schema(
  {
    siteKey: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed }
  },
  {
    timestamps: true
  }
);

// Compound unique index for tenant + key
settingSchema.index({ siteKey: 1, key: 1 }, { unique: true });

// ===== Helper Utilities =====

// Flatten nested object to dot-notation keys
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const pre = prefix ? prefix + '.' + k : k;
      if (
        typeof obj[k] === 'object' &&
        obj[k] !== null &&
        !Array.isArray(obj[k]) &&
        !(obj[k] instanceof Date) &&
        !(obj[k] instanceof mongoose.Types.ObjectId)
      ) {
        Object.assign(result, flattenObject(obj[k], pre));
      } else {
        result[pre] = obj[k];
      }
    }
  }
  return result;
}

// Reconstruct a nested object from flat dot-notation keys
function inflateSettings(docs, siteKey) {
  const settingsObj = {
    siteKey,
    isInMaintenance() {
      return this.maintenanceMode === true;
    },
    isStoreLive() {
      return this.isLive === true;
    },
    toJSONSafe() {
      return toJSONSafe(this);
    }
  };
  for (const doc of docs) {
    if (!doc.key) continue;
    const keys = doc.key.split('.');
    let current = settingsObj;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (i === keys.length - 1) {
        current[k] = doc.value;
      } else {
        if (!current[k] || typeof current[k] !== 'object') {
          current[k] = {};
        }
        current = current[k];
      }
    }
  }
  return settingsObj;
}

// Strip password/secret fields
function toJSONSafe(settingsObj) {
  const safeObj = JSON.parse(JSON.stringify(settingsObj));
  const definitions = Setting.SETTING_DEFINITIONS || [];
  definitions.forEach(def => {
    if (def.type === 'password') {
      const parts = def.key.split('.');
      let current = safeObj;
      for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1) {
          if (current) delete current[parts[i]];
        } else {
          current = current ? current[parts[i]] : undefined;
        }
      }
    }
  });
  return safeObj;
}

// ===== Static / Instance Methods =====

// Get the current settings (singleton pattern)
settingSchema.statics.getSettings = async function () {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  if (cachedSettingsMap.has(activeTenantKey)) {
    return cachedSettingsMap.get(activeTenantKey);
  }
  const docs = await this.find({ siteKey: activeTenantKey }).lean();
  let settings = null;
  if (docs && docs.length > 0) {
    settings = inflateSettings(docs, activeTenantKey);
    cachedSettingsMap.set(activeTenantKey, settings);
    cachedSettingsMap.set('__default__', settings);
  }
  return settings;
};

// Get settings strictly by siteKey/tenant
settingSchema.statics.getSettingsBySite = async function (siteKey) {
  if (cachedSettingsMap.has(siteKey)) {
    return cachedSettingsMap.get(siteKey);
  }
  const docs = await this.find({ siteKey }).lean();
  let settings = null;
  if (docs && docs.length > 0) {
    settings = inflateSettings(docs, siteKey);
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

// Clear cached settings
settingSchema.statics.clearCache = function () {
  cachedSettingsMap.clear();
};

// Update settings (create if not exists)
settingSchema.statics.updateSettings = async function (data, updated_by) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const flat = flattenObject(data);
  for (const [k, v] of Object.entries(flat)) {
    await this.findOneAndUpdate(
      { siteKey: activeTenantKey, key: k },
      { value: v },
      { upsert: true, new: true }
    );
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Toggle maintenance mode
settingSchema.statics.toggleMaintenanceMode = async function (status) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: 'maintenanceMode' },
    { value: status },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Toggle live status
settingSchema.statics.toggleLiveStatus = async function (status) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: 'isLive' },
    { value: status },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update branding
settingSchema.statics.updateBranding = async function (branding) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const flat = flattenObject({ branding });
  for (const [k, v] of Object.entries(flat)) {
    await this.findOneAndUpdate(
      { siteKey: activeTenantKey, key: k },
      { value: v },
      { upsert: true, new: true }
    );
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update SEO settings
settingSchema.statics.updateSEO = async function (seo) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const flat = flattenObject({ seo });
  for (const [k, v] of Object.entries(flat)) {
    await this.findOneAndUpdate(
      { siteKey: activeTenantKey, key: k },
      { value: v },
      { upsert: true, new: true }
    );
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update payment methods
settingSchema.statics.updatePaymentMethods = async function (methods) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: 'paymentMethods' },
    { value: methods },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update contact info
settingSchema.statics.updateContactInfo = async function (contactInfo) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const flat = flattenObject({ contactInfo });
  for (const [k, v] of Object.entries(flat)) {
    await this.findOneAndUpdate(
      { siteKey: activeTenantKey, key: k },
      { value: v },
      { upsert: true, new: true }
    );
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update shipping options
settingSchema.statics.updateShippingOptions = async function (options) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: 'shippingOptions' },
    { value: options },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update email templates
settingSchema.statics.updateEmailTemplates = async function (templates) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const flat = flattenObject({ emailTemplates: templates });
  for (const [k, v] of Object.entries(flat)) {
    await this.findOneAndUpdate(
      { siteKey: activeTenantKey, key: k },
      { value: v },
      { upsert: true, new: true }
    );
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update analytics IDs
settingSchema.statics.updateAnalytics = async function (analytics) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const flat = flattenObject({ analytics });
  for (const [k, v] of Object.entries(flat)) {
    await this.findOneAndUpdate(
      { siteKey: activeTenantKey, key: k },
      { value: v },
      { upsert: true, new: true }
    );
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update currency & tax settings
settingSchema.statics.updateCurrencyAndTax = async function ({ currency, currencySymbol, taxRate }) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  if (currency !== undefined) {
    await this.findOneAndUpdate({ siteKey: activeTenantKey, key: 'currency' }, { value: currency }, { upsert: true });
  }
  if (currencySymbol !== undefined) {
    await this.findOneAndUpdate({ siteKey: activeTenantKey, key: 'currencySymbol' }, { value: currencySymbol }, { upsert: true });
  }
  if (taxRate !== undefined) {
    await this.findOneAndUpdate({ siteKey: activeTenantKey, key: 'taxRate' }, { value: taxRate }, { upsert: true });
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update loyalty program settings
settingSchema.statics.updateLoyaltyProgram = async function (loyaltyProgram) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const flat = flattenObject({ loyaltyProgram });
  for (const [k, v] of Object.entries(flat)) {
    await this.findOneAndUpdate(
      { siteKey: activeTenantKey, key: k },
      { value: v },
      { upsert: true, new: true }
    );
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update policies (return, privacy, terms)
settingSchema.statics.updatePolicies = async function (policies) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  if (policies.returnPolicy !== undefined) {
    await this.findOneAndUpdate({ siteKey: activeTenantKey, key: 'returnPolicy' }, { value: policies.returnPolicy }, { upsert: true });
  }
  if (policies.privacyPolicy !== undefined) {
    await this.findOneAndUpdate({ siteKey: activeTenantKey, key: 'privacyPolicy' }, { value: policies.privacyPolicy }, { upsert: true });
  }
  if (policies.termsOfService !== undefined) {
    await this.findOneAndUpdate({ siteKey: activeTenantKey, key: 'termsOfService' }, { value: policies.termsOfService }, { upsert: true });
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update featured categories
settingSchema.statics.updateFeaturedCategories = async function (categoryIds) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: 'featuredCategories' },
    { value: categoryIds },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update min/max order amounts
settingSchema.statics.updateOrderLimits = async function ({ minOrderAmount, maxOrderAmount }) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  if (minOrderAmount !== undefined) {
    await this.findOneAndUpdate({ siteKey: activeTenantKey, key: 'minOrderAmount' }, { value: minOrderAmount }, { upsert: true });
  }
  if (maxOrderAmount !== undefined) {
    await this.findOneAndUpdate({ siteKey: activeTenantKey, key: 'maxOrderAmount' }, { value: maxOrderAmount }, { upsert: true });
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Reset settings to defaults (useful for staging/dev)
settingSchema.statics.resetToDefaults = async function (defaultData) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  await this.deleteMany({ siteKey: activeTenantKey });
  const flat = flattenObject(defaultData);
  const docs = Object.keys(flat).map(k => ({
    siteKey: activeTenantKey,
    key: k,
    value: flat[k]
  }));
  await this.insertMany(docs);
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Safe public settings resolver
settingSchema.statics.getPublicSettings = async function () {
  const settings = await this.getSettings();
  if (!settings) return null;
  return toJSONSafe(settings);
};

// Get section
settingSchema.statics.getSection = async function (section) {
  const settings = await this.getSettings();
  if (!settings) return null;
  return settings[section];
};

// Reset section
settingSchema.statics.resetSection = async function (section, defaultValue) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const regex = new RegExp(`^${section}\\.`);
  await this.deleteMany({ siteKey: activeTenantKey, key: { $regex: regex } });
  const flat = flattenObject({ [section]: defaultValue });
  const docs = Object.keys(flat).map(k => ({
    siteKey: activeTenantKey,
    key: k,
    value: flat[k]
  }));
  await this.insertMany(docs);
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Set maintenance mode with reason
settingSchema.statics.setMaintenanceMode = async function (status, reason) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: 'maintenanceMode' },
    { value: status },
    { upsert: true, new: true }
  );
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: 'maintenanceReason' },
    { value: reason },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Toggle dynamic feature flag
settingSchema.statics.toggleFeature = async function (featureName, status) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: `features.${featureName}` },
    { value: status },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update a single branding field
settingSchema.statics.updateBrandingField = async function (key, value) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: `branding.${key}` },
    { value },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Add payment method
settingSchema.statics.addPaymentMethod = async function (method) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const doc = await this.findOne({ siteKey: activeTenantKey, key: 'paymentMethods' });
  const current = doc ? doc.value : [];
  if (!current.includes(method)) {
    current.push(method);
    await this.findOneAndUpdate(
      { siteKey: activeTenantKey, key: 'paymentMethods' },
      { value: current },
      { upsert: true, new: true }
    );
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Remove payment method
settingSchema.statics.removePaymentMethod = async function (method) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const doc = await this.findOne({ siteKey: activeTenantKey, key: 'paymentMethods' });
  const current = doc ? doc.value : [];
  const updated = current.filter(m => m !== method);
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: 'paymentMethods' },
    { value: updated },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update currency
settingSchema.statics.updateCurrency = async function (currency) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: 'currency' },
    { value: currency },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Increment loyalty points
settingSchema.statics.incrementLoyaltyPoints = async function (points) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const doc = await this.findOne({ siteKey: activeTenantKey, key: 'loyaltyProgram.pointsPerDollar' });
  const current = doc ? doc.value : 1;
  const updated = current + points;
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: 'loyaltyProgram.pointsPerDollar' },
    { value: updated },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Update specific policy
settingSchema.statics.updatePolicy = async function (type, content) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const fieldMap = {
    return: 'returnPolicy',
    privacy: 'privacyPolicy',
    terms: 'termsOfService'
  };
  const fieldName = fieldMap[type] || type;
  await this.findOneAndUpdate(
    { siteKey: activeTenantKey, key: fieldName },
    { value: content },
    { upsert: true, new: true }
  );
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
};

// Audit update
settingSchema.statics.updateWithAudit = async function (updateObj) {
  const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
  const flat = flattenObject(updateObj);
  for (const [k, v] of Object.entries(flat)) {
    await this.findOneAndUpdate(
      { siteKey: activeTenantKey, key: k },
      { value: v },
      { upsert: true, new: true }
    );
  }
  cachedSettingsMap.clear();
  return this.getSettingsBySite(activeTenantKey);
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
  { key: 'twilioAccountSid', label: 'Twilio Account SID', type: 'string', section: 'otp' },
  { key: 'twilioAuthToken', label: 'Twilio Auth Token', type: 'password', section: 'otp' },
  { key: 'twilioPhoneNumber', label: 'Twilio Phone Number', type: 'string', section: 'otp' },

  // Policies Section
  { key: 'returnPolicy', label: 'Return Policy Text', type: 'text', section: 'policies' },
  { key: 'privacyPolicy', label: 'Privacy Policy Text', type: 'text', section: 'policies' },
  { key: 'termsOfService', label: 'Terms of Service Text', type: 'text', section: 'policies' },
];

const Setting = mongoose.model('Setting', settingSchema);
Setting.SETTING_DEFINITIONS = SETTING_DEFINITIONS;
Setting.flattenObject = flattenObject;
Setting.inflateSettings = inflateSettings;
Setting.toJSONSafe = toJSONSafe;

module.exports = Setting;
