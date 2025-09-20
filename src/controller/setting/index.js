const Setting = require('../../models/Setting');

// Async wrapper
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ================== GETTERS ==================

// Get all settings

exports.createSettings = asyncHandler(async (req, res) => {
  const { siteKey, ...data } = req.body;

  // Prevent duplicate siteKey
  const exists = await Setting.findOne({ siteKey });
  if (exists) {
    return res.status(400).json({ message: `Settings for ${siteKey} already exist` });
  }

  const created = await Setting.create({ siteKey, ...data });
  res.status(201).json(created);
});

// GET settings for a specific site/app
exports.getSettingsBySite = asyncHandler(async (req, res) => {
  const { siteKey } = req.params;
  const settings = await Setting.findOne({ siteKey })
  if (!settings) {
    return res.status(404).json({ message: `No settings found for ${siteKey}` });
  }
  res.json(settings);
});

// UPDATE settings for a specific site/app
exports.updateSettingsBySite = asyncHandler(async (req, res) => {
  const { siteKey } = req.params;
  const updated = await Setting.findOneAndUpdate(
    { siteKey },
    req.body,
    { new: true, upsert: true, runValidators: true }
  );
  res.json(updated);
});

// DELETE settings for a specific site/app
exports.deleteSettingsBySite = asyncHandler(async (req, res) => {
  const { siteKey } = req.params;
  const deleted = await Setting.findOneAndDelete({ siteKey });
  if (!deleted) {
    return res.status(404).json({ message: `No settings found for ${siteKey}` });
  }
  res.json({ message: `Settings for ${siteKey} deleted` });
});

// LIST all site/app settings
exports.listAllSettings = asyncHandler(async (req, res) => {
  const all = await Setting.find().lean();
  res.json(all);
});
exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  res.json(settings);
});

// Get public (safe) settings
exports.getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await Setting.getPublicSettings();
  res.json(settings);
});

// Get a specific section
exports.getSection = asyncHandler(async (req, res) => {
  const section = req.params.section;
  const data = await Setting.getSection(section);
  res.json({ [section]: data });
});

// ================== CORE UPDATES ==================

// Update all settings
exports.updateSettings = asyncHandler(async (req, res) => {
  const updated = await Setting.updateSettings(req.body, req.user?._id);
  res.json(updated);
});

// Reset all settings to defaults
exports.resetToDefaults = asyncHandler(async (req, res) => {
  const updated = await Setting.resetToDefaults(req.body);
  res.json(updated);
});

// Reset a specific section
exports.resetSection = asyncHandler(async (req, res) => {
  const { section, defaultValue } = req.body;
  const updated = await Setting.resetSection(section, defaultValue);
  res.json(updated);
});

// ================== TOGGLES ==================

exports.toggleMaintenanceMode = asyncHandler(async (req, res) => {
  const updated = await Setting.toggleMaintenanceMode(req.body.status);
  res.json(updated);
});

exports.setMaintenanceMode = asyncHandler(async (req, res) => {
  const updated = await Setting.setMaintenanceMode(req.body.status, req.body.reason);
  res.json(updated);
});

exports.toggleLiveStatus = asyncHandler(async (req, res) => {
  const updated = await Setting.toggleLiveStatus(req.body.status);
  res.json(updated);
});

exports.toggleFeature = asyncHandler(async (req, res) => {
  const updated = await Setting.toggleFeature(req.body.featureName, req.body.status);
  res.json(updated);
});

// ================== SECTION UPDATES ==================

exports.updateBranding = asyncHandler(async (req, res) => {
  const updated = await Setting.updateBranding(req.body, req.user?._id);
  res.json(updated.branding);
});

exports.updateBrandingField = asyncHandler(async (req, res) => {
  const updated = await Setting.updateBrandingField(req.body.key, req.body.value, req.user?._id);
  res.json(updated.branding);
});

exports.updateSEO = asyncHandler(async (req, res) => {
  const updated = await Setting.updateSEO(req.body);
  res.json(updated.seo);
});

exports.updatePaymentMethods = asyncHandler(async (req, res) => {
  const updated = await Setting.updatePaymentMethods(req.body.methods);
  res.json(updated.paymentMethods);
});

exports.addPaymentMethod = asyncHandler(async (req, res) => {
  const updated = await Setting.addPaymentMethod(req.body.method);
  res.json(updated.paymentMethods);
});

exports.removePaymentMethod = asyncHandler(async (req, res) => {
  const updated = await Setting.removePaymentMethod(req.body.method);
  res.json(updated.paymentMethods);
});

exports.updateContactInfo = asyncHandler(async (req, res) => {
  const updated = await Setting.updateContactInfo(req.body);
  res.json(updated.contactInfo);
});

exports.updateShippingOptions = asyncHandler(async (req, res) => {
  const updated = await Setting.updateShippingOptions(req.body.options);
  res.json(updated.shippingOptions);
});

exports.updateEmailTemplates = asyncHandler(async (req, res) => {
  const updated = await Setting.updateEmailTemplates(req.body);
  res.json(updated.emailTemplates);
});

exports.updateAnalytics = asyncHandler(async (req, res) => {
  const updated = await Setting.updateAnalytics(req.body);
  res.json(updated.analytics);
});

exports.updateCurrencyAndTax = asyncHandler(async (req, res) => {
  const updated = await Setting.updateCurrencyAndTax(req.body);
  res.json({
    currency: updated.currency,
    currencySymbol: updated.currencySymbol,
    taxRate: updated.taxRate
  });
});

exports.updateCurrency = asyncHandler(async (req, res) => {
  const updated = await Setting.updateCurrency(req.body.currency);
  res.json({
    currency: updated.currency,
    currencySymbol: updated.currencySymbol
  });
});

exports.updateLoyaltyProgram = asyncHandler(async (req, res) => {
  const updated = await Setting.updateLoyaltyProgram(req.body);
  res.json(updated.loyaltyProgram);
});

exports.incrementLoyaltyPoints = asyncHandler(async (req, res) => {
  const updated = await Setting.incrementLoyaltyPoints(req.body.points);
  res.json(updated.loyaltyProgram);
});

exports.updatePolicies = asyncHandler(async (req, res) => {
  const updated = await Setting.updatePolicies(req.body);
  res.json({
    returnPolicy: updated.returnPolicy,
    privacyPolicy: updated.privacyPolicy,
    termsOfService: updated.termsOfService
  });
});

exports.updatePolicy = asyncHandler(async (req, res) => {
  const updated = await Setting.updatePolicy(req.body.type, req.body.content, req.user?._id);
  res.json(updated);
});

exports.updateFeaturedCategories = asyncHandler(async (req, res) => {
  const updated = await Setting.updateFeaturedCategories(req.body.categoryIds);
  res.json(updated.featuredCategories);
});

exports.updateOrderLimits = asyncHandler(async (req, res) => {
  const updated = await Setting.updateOrderLimits(req.body);
  res.json({
    minOrderAmount: updated.minOrderAmount,
    maxOrderAmount: updated.maxOrderAmount
  });
});

// ================== AUDIT / ADVANCED ==================

exports.updateWithAudit = asyncHandler(async (req, res) => {
  const updated = await Setting.updateWithAudit(req.body.updateObj, req.user?._id, req.body.section);
  res.json(updated);
});