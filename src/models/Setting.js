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
  // ── Basic ──
  { key: 'siteName', label: 'Site Name', type: 'string', section: 'basic' },
  { key: 'name', label: 'Application Name', type: 'string', section: 'basic' },
  { key: 'isLive', label: 'Site Live Status', type: 'boolean', section: 'basic' },
  { key: 'maintenanceMode', label: 'Maintenance Mode', type: 'boolean', section: 'basic' },

  // ── Contact Info ──
  { key: 'contactInfo.email', label: 'Contact Email', type: 'string', section: 'contact' },
  { key: 'contactInfo.phone', label: 'Contact Phone', type: 'string', section: 'contact' },
  { key: 'contactInfo.address.street', label: 'Street Address', type: 'string', section: 'contact' },
  { key: 'contactInfo.address.city', label: 'City', type: 'string', section: 'contact' },
  { key: 'contactInfo.address.state', label: 'State / Province', type: 'string', section: 'contact' },
  { key: 'contactInfo.address.zipCode', label: 'ZIP / Postal Code', type: 'string', section: 'contact' },
  { key: 'contactInfo.address.country', label: 'Country', type: 'string', section: 'contact' },

  // ── Branding ──
  { key: 'branding.logo', label: 'Logo URL', type: 'string', section: 'branding' },
  { key: 'branding.favicon', label: 'Favicon URL', type: 'string', section: 'branding' },
  { key: 'branding.themeColor', label: 'Theme Primary Color', type: 'color', section: 'branding' },

  // ── Currency & Tax ──
  { key: 'currency', label: 'Currency Code', type: 'select', section: 'currency', options: ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'] },
  { key: 'currencySymbol', label: 'Currency Symbol', type: 'string', section: 'currency' },
  { key: 'taxRate', label: 'Tax Rate (%)', type: 'number', section: 'currency' },

  // ── Client URLs ──
  { key: 'client.url', label: 'Frontend URL', type: 'string', section: 'client' },
  { key: 'client.loginPage', label: 'Login Page Path', type: 'string', section: 'client' },
  { key: 'client.resetPasswordUrl', label: 'Reset Password Path', type: 'string', section: 'client' },
  { key: 'client.emailVerifyUrl', label: 'Email Verify Path', type: 'string', section: 'client' },

  // ── Security / CORS ──
  { key: 'security.allowedOrigins', label: 'Allowed CORS Origins (comma-separated)', type: 'text', section: 'security' },
  { key: 'security.allowedIPs', label: 'Allowed IP Addresses (comma-separated)', type: 'text', section: 'security' },
  { key: 'security.requireDeviceVerification', label: 'Require Device Verification', type: 'boolean', section: 'security' },
  { key: 'security.enableSuspiciousLoginDetection', label: 'Suspicious Login Detection', type: 'boolean', section: 'security' },
  { key: 'security.enableIpWhitelist', label: 'Enable IP Whitelist', type: 'boolean', section: 'security' },

  // ── Email / SMTP ──
  { key: 'email.name', label: 'Sender Display Name', type: 'string', section: 'email' },
  { key: 'email.sender', label: 'From Email Address', type: 'string', section: 'email' },
  { key: 'email.service', label: 'Email Service (e.g. gmail, brevo)', type: 'string', section: 'email' },
  { key: 'email.host', label: 'SMTP Host', type: 'string', section: 'email' },
  { key: 'email.port', label: 'SMTP Port', type: 'number', section: 'email' },
  { key: 'email.secure', label: 'SMTP Secure (TLS)', type: 'boolean', section: 'email' },
  { key: 'email.user', label: 'SMTP Username', type: 'string', section: 'email' },
  { key: 'email.password', label: 'SMTP Password', type: 'password', section: 'email' },
  { key: 'email.oauth2ClientId', label: 'OAuth2 Client ID', type: 'string', section: 'email' },
  { key: 'email.oauth2ClientSecret', label: 'OAuth2 Client Secret', type: 'password', section: 'email' },
  { key: 'email.oauth2RefreshToken', label: 'OAuth2 Refresh Token', type: 'password', section: 'email' },
  { key: 'email.oauth2RedirectUri', label: 'OAuth2 Redirect URI', type: 'string', section: 'email' },
  { key: 'email.fallback.service', label: 'Fallback Email Service', type: 'string', section: 'email_fallback' },
  { key: 'email.fallback.host', label: 'Fallback SMTP Host', type: 'string', section: 'email_fallback' },
  { key: 'email.fallback.port', label: 'Fallback SMTP Port', type: 'number', section: 'email_fallback' },
  { key: 'email.fallback.user', label: 'Fallback SMTP User', type: 'string', section: 'email_fallback' },
  { key: 'email.fallback.password', label: 'Fallback SMTP Password', type: 'password', section: 'email_fallback' },
  { key: 'email.debug', label: 'Email Debug Mode', type: 'boolean', section: 'email' },

  // ── Stripe Gateway ──
  { key: 'payment.stripe.enabled', label: 'Stripe Enabled', type: 'boolean', section: 'stripe' },
  { key: 'payment.stripe.publicKey', label: 'Stripe Public Key', type: 'string', section: 'stripe' },
  { key: 'payment.stripe.secretKey', label: 'Stripe Secret Key', type: 'password', section: 'stripe' },
  { key: 'payment.stripe.webhookSecret', label: 'Stripe Webhook Secret', type: 'password', section: 'stripe' },

  // ── PayPal Gateway ──
  { key: 'payment.paypal.enabled', label: 'PayPal Enabled', type: 'boolean', section: 'paypal' },
  { key: 'payment.paypal.clientId', label: 'PayPal Client ID', type: 'string', section: 'paypal' },
  { key: 'payment.paypal.clientSecret', label: 'PayPal Client Secret', type: 'password', section: 'paypal' },
  { key: 'payment.paypal.mode', label: 'PayPal Mode', type: 'select', section: 'paypal', options: ['sandbox', 'live'] },
  { key: 'payment.paypal.webhookId', label: 'PayPal Webhook ID', type: 'string', section: 'paypal' },

  // ── Razorpay Gateway ──
  { key: 'payment.razorpay.enabled', label: 'Razorpay Enabled', type: 'boolean', section: 'razorpay' },
  { key: 'payment.razorpay.publicKey', label: 'Razorpay Key ID', type: 'string', section: 'razorpay' },
  { key: 'payment.razorpay.secretKey', label: 'Razorpay Key Secret', type: 'password', section: 'razorpay' },
  { key: 'payment.razorpay.webhookSecret', label: 'Razorpay Webhook Secret', type: 'password', section: 'razorpay' },

  // ── Storage ──
  { key: 'storage.type', label: 'Storage Provider', type: 'select', section: 'storage', options: ['local', 's3', 'gcs', 'azure', 'r2'] },
  { key: 'storage.localPath', label: 'Local Storage Path', type: 'string', section: 'storage' },
  { key: 'storage.maxFileSize', label: 'Max File Size (bytes)', type: 'number', section: 'storage' },
  { key: 'storage.signedUrlExpiry', label: 'Signed URL Expiry (seconds)', type: 'number', section: 'storage' },

  // ── Storage: Azure ──
  { key: 'storage.azure.container', label: 'Azure Container', type: 'string', section: 'storage_azure' },
  { key: 'storage.azure.account', label: 'Azure Account', type: 'string', section: 'storage_azure' },
  { key: 'storage.azure.accessKey', label: 'Azure Access Key', type: 'password', section: 'storage_azure' },
  { key: 'storage.azure.connectionString', label: 'Azure Connection String', type: 'password', section: 'storage_azure' },

  // ── Storage: S3 ──
  { key: 'storage.s3.bucket', label: 'S3 Bucket', type: 'string', section: 'storage_s3' },
  { key: 'storage.s3.region', label: 'S3 Region', type: 'string', section: 'storage_s3' },
  { key: 'storage.s3.accessKey', label: 'S3 Access Key', type: 'password', section: 'storage_s3' },
  { key: 'storage.s3.secretKey', label: 'S3 Secret Key', type: 'password', section: 'storage_s3' },

  // ── Storage: GCS ──
  { key: 'storage.gcs.bucket', label: 'GCS Bucket', type: 'string', section: 'storage_gcs' },
  { key: 'storage.gcs.projectId', label: 'GCS Project ID', type: 'string', section: 'storage_gcs' },
  { key: 'storage.gcs.clientEmail', label: 'GCS Client Email', type: 'string', section: 'storage_gcs' },
  { key: 'storage.gcs.privateKey', label: 'GCS Private Key', type: 'password', section: 'storage_gcs' },

  // ── Storage: R2 ──
  { key: 'storage.r2.endpoint', label: 'R2 Endpoint', type: 'string', section: 'storage_r2' },
  { key: 'storage.r2.bucket', label: 'R2 Bucket', type: 'string', section: 'storage_r2' },
  { key: 'storage.r2.accessKey', label: 'R2 Access Key', type: 'password', section: 'storage_r2' },
  { key: 'storage.r2.secretKey', label: 'R2 Secret Key', type: 'password', section: 'storage_r2' },
  { key: 'storage.r2.publicDomain', label: 'R2 Public Domain', type: 'string', section: 'storage_r2' },

  // ── Services: Twilio ──
  { key: 'services.twilio.accountSid', label: 'Twilio Account SID', type: 'string', section: 'twilio' },
  { key: 'services.twilio.authToken', label: 'Twilio Auth Token', type: 'password', section: 'twilio' },
  { key: 'services.twilio.phoneNumber', label: 'Twilio Phone Number', type: 'string', section: 'twilio' },

  // ── Services: OAuth / Social ──
  { key: 'services.google.clientId', label: 'Google Client ID', type: 'string', section: 'oauth' },
  { key: 'services.google.placesApiKey', label: 'Google Places API Key', type: 'password', section: 'oauth' },
  { key: 'services.facebook.appId', label: 'Facebook App ID', type: 'string', section: 'oauth' },
  { key: 'services.github.clientId', label: 'GitHub Client ID', type: 'string', section: 'oauth' },
  { key: 'services.apple.clientId', label: 'Apple Client ID', type: 'string', section: 'oauth' },
  { key: 'services.twitter.apiKey', label: 'Twitter API Key', type: 'string', section: 'oauth' },
  { key: 'services.twitter.apiSecret', label: 'Twitter API Secret', type: 'password', section: 'oauth' },
  { key: 'services.storeUrl', label: 'Store URL (for emails)', type: 'string', section: 'oauth' },

  // ── OTP & Two-Factor ──
  { key: 'otp.enabled', label: 'OTP Verification Enabled', type: 'boolean', section: 'otp' },
  { key: 'otp.defaultMethod', label: 'Default OTP Method', type: 'select', section: 'otp', options: ['email', 'sms', 'totp'] },
  { key: 'otp.expiryMinutes', label: 'OTP Expiry (minutes)', type: 'number', section: 'otp' },
  { key: 'otp.maxAttempts', label: 'Max Verification Attempts', type: 'number', section: 'otp' },
  { key: 'otp.totp.appName', label: 'TOTP App Name', type: 'string', section: 'otp' },
  { key: 'otp.totp.issuer', label: 'TOTP Issuer', type: 'string', section: 'otp' },
  { key: 'otp.smsOtp.length', label: 'SMS OTP Code Length', type: 'number', section: 'otp' },
  { key: 'otp.emailOtp.length', label: 'Email OTP Code Length', type: 'number', section: 'otp' },

  // ── Business ──
  { key: 'business.companyName', label: 'Company Name', type: 'string', section: 'business' },
  { key: 'business.brandName', label: 'Brand Name', type: 'string', section: 'business' },
  { key: 'business.currency', label: 'Business Currency', type: 'select', section: 'business', options: ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD'] },

  // ── Features ──
  { key: 'features.socketingEnabled', label: 'WebSocket / Socket.IO Enabled', type: 'boolean', section: 'features' },

  // ── Notifications ──
  { key: 'notifications.webhookUrl', label: 'Notification Webhook URL', type: 'string', section: 'notifications' },

  // ── Policies ──
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
