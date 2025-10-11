const Setting = require('../../models/Setting');
// const { standardResponse } = require('../../utils/apiUtils');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
// ================== GETTERS ==================

exports.createSettings = async (req, res) => {
  try {
    const { siteKey, ...data } = req.body;
    const exists = await Setting.findOne({ siteKey });
    if (exists) {
      return errorResponse(res, `Settings for ${siteKey} already exist`, 400);
    }
    const created = await Setting.create({ siteKey, ...data });
    return standardResponse(res, true, created, `Settings for ${siteKey} created`, 201);
  } catch (error) {
    return errorResponse(res, 'Failed to create settings', 500, error);
  }
};

exports.getSettingsBySite = async (req, res) => {
  try {
    const { siteKey } = req.params;
    const settings = await Setting.findOne({ siteKey }).select('-_id -id -isDeleted -siteKey');
    if (!settings) {
      return errorResponse(res, `No settings found for ${siteKey}`, 404);
    }
    return standardResponse(res, true, settings, `Settings for ${siteKey} retrieved`);
  } catch (error) {
    return errorResponse(res, 'Failed to get settings', 500, error);
  }
};

exports.updateSettingsBySite = async (req, res) => {
  try {
    const { siteKey } = req.params;
    const updated = await Setting.findOneAndUpdate(
      { siteKey },
      req.body,
      { new: true, upsert: true, runValidators: true }
    );
    return standardResponse(res, true, updated, `Settings for ${siteKey} updated`);
  } catch (error) {
    return errorResponse(res, 'Failed to update settings', 500, error);
  }
};

exports.deleteSettingsBySite = async (req, res) => {
  try {
    const { siteKey } = req.params;
    const deleted = await Setting.findOneAndDelete({ siteKey });
    if (!deleted) {
      return errorResponse(res, `No settings found for ${siteKey}`, 404);
    }
    return standardResponse(res, true, null, `Settings for ${siteKey} deleted`);
  } catch (error) {
    return errorResponse(res, 'Failed to delete settings', 500, error);
  }
};

exports.listAllSettings = async (req, res) => {
  try {
    const all = await Setting.find().lean();
    return standardResponse(res, true, all, 'All settings retrieved');
  } catch (error) {
    return errorResponse(res, 'Failed to list settings', 500, error);
  }
};

exports.getSettings = async (req, res) => {
  try {
    const settings = await Setting.getSettings();
    return standardResponse(res, true, settings, 'Settings retrieved');
  } catch (error) {
    return errorResponse(res, 'Failed to get settings', 500, error);
  }
};

exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await Setting.getPublicSettings();
    return standardResponse(res, true, settings, 'Public settings retrieved');
  } catch (error) {
    return errorResponse(res, 'Failed to get public settings', 500, error);
  }
};

exports.getSection = async (req, res) => {
  try {
    const section = req.params.section;
    const data = await Setting.getSection(section);
    return standardResponse(res, true, { [section]: data }, `Section ${section} retrieved`);
  } catch (error) {
    return errorResponse(res, `Failed to get section ${req.params.section}`, 500, error);
  }
};

// ================== CORE UPDATES ==================

exports.updateSettings = async (req, res) => {
  try {
    const updated = await Setting.updateSettings(req.body, req.user?._id);
    return standardResponse(res, true, updated, 'Settings updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update settings', 500, error);
  }
};

exports.resetToDefaults = async (req, res) => {
  try {
    const updated = await Setting.resetToDefaults(req.body);
    return standardResponse(res, true, updated, 'Settings reset to defaults');
  } catch (error) {
    return errorResponse(res, 'Failed to reset settings', 500, error);
  }
};

exports.resetSection = async (req, res) => {
  try {
    const { section, defaultValue } = req.body;
    const updated = await Setting.resetSection(section, defaultValue);
    return standardResponse(res, true, updated, `Section ${section} reset`);
  } catch (error) {
    return errorResponse(res, `Failed to reset section ${req.body.section}`, 500, error);
  }
};

// ================== TOGGLES ==================

exports.toggleMaintenanceMode = async (req, res) => {
  try {
    const updated = await Setting.toggleMaintenanceMode(req.body.status);
    return standardResponse(res, true, updated, 'Maintenance mode toggled');
  } catch (error) {
    return errorResponse(res, 'Failed to toggle maintenance mode', 500, error);
  }
};

exports.setMaintenanceMode = async (req, res) => {
  try {
    const updated = await Setting.setMaintenanceMode(req.body.status, req.body.reason);
    return standardResponse(res, true, updated, 'Maintenance mode set');
  } catch (error) {
    return errorResponse(res, 'Failed to set maintenance mode', 500, error);
  }
};

exports.toggleLiveStatus = async (req, res) => {
  try {
    const updated = await Setting.toggleLiveStatus(req.body.status);
    return standardResponse(res, true, updated, 'Live status toggled');
  } catch (error) {
    return errorResponse(res, 'Failed to toggle live status', 500, error);
  }
};

exports.toggleFeature = async (req, res) => {
  try {
    const updated = await Setting.toggleFeature(req.body.featureName, req.body.status);
    return standardResponse(res, true, updated, `Feature ${req.body.featureName} toggled`);
  } catch (error) {
    return errorResponse(res, 'Failed to toggle feature', 500, error);
  }
};

// ================== SECTION UPDATES ==================

exports.updateBranding = async (req, res) => {
  try {
    const updated = await Setting.updateBranding(req.body, req.user?._id);
    return standardResponse(res, true, updated.branding, 'Branding updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update branding', 500, error);
  }
};

exports.updateBrandingField = async (req, res) => {
  try {
    const updated = await Setting.updateBrandingField(req.body.key, req.body.value, req.user?._id);
    return standardResponse(res, true, updated.branding, `Branding field ${req.body.key} updated`);
  } catch (error) {
    return errorResponse(res, 'Failed to update branding field', 500, error);
  }
};

exports.updateSEO = async (req, res) => {
  try {
    const updated = await Setting.updateSEO(req.body);
    return standardResponse(res, true, updated.seo, 'SEO updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update SEO', 500, error);
  }
};

exports.updatePaymentMethods = async (req, res) => {
  try {
    const updated = await Setting.updatePaymentMethods(req.body.methods);
    return standardResponse(res, true, updated.paymentMethods, 'Payment methods updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update payment methods', 500, error);
  }
};

exports.addPaymentMethod = async (req, res) => {
  try {
    const updated = await Setting.addPaymentMethod(req.body.method);
    return standardResponse(res, true, updated.paymentMethods, 'Payment method added');
  } catch (error) {
    return errorResponse(res, 'Failed to add payment method', 500, error);
  }
};

exports.removePaymentMethod = async (req, res) => {
  try {
    const updated = await Setting.removePaymentMethod(req.body.method);
    return standardResponse(res, true, updated.paymentMethods, 'Payment method removed');
  } catch (error) {
    return errorResponse(res, 'Failed to remove payment method', 500, error);
  }
};

exports.updateContactInfo = async (req, res) => {
  try {
    const updated = await Setting.updateContactInfo(req.body);
    return standardResponse(res, true, updated.contactInfo, 'Contact info updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update contact info', 500, error);
  }
};

exports.updateShippingOptions = async (req, res) => {
  try {
    const updated = await Setting.updateShippingOptions(req.body.options);
    return standardResponse(res, true, updated.shippingOptions, 'Shipping options updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update shipping options', 500, error);
  }
};

exports.updateEmailTemplates = async (req, res) => {
  try {
    const updated = await Setting.updateEmailTemplates(req.body);
    return standardResponse(res, true, updated.emailTemplates, 'Email templates updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update email templates', 500, error);
  }
};

exports.updateAnalytics = async (req, res) => {
  try {
    const updated = await Setting.updateAnalytics(req.body);
    return standardResponse(res, true, updated.analytics, 'Analytics updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update analytics', 500, error);
  }
};

exports.updateCurrencyAndTax = async (req, res) => {
  try {
    const updated = await Setting.updateCurrencyAndTax(req.body);
    return standardResponse(res, true, {
      currency: updated.currency,
      currencySymbol: updated.currencySymbol,
      taxRate: updated.taxRate
    }, 'Currency and tax updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update currency and tax', 500, error);
  }
};

exports.updateCurrency = async (req, res) => {
  try {
    const updated = await Setting.updateCurrency(req.body.currency);
    return standardResponse(res, true, {
      currency: updated.currency,
      currencySymbol: updated.currencySymbol
    }, 'Currency updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update currency', 500, error);
  }
};

exports.updateLoyaltyProgram = async (req, res) => {
  try {
    const updated = await Setting.updateLoyaltyProgram(req.body);
    return standardResponse(res, true, updated.loyaltyProgram, 'Loyalty program updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update loyalty program', 500, error);
  }
};

exports.incrementLoyaltyPoints = async (req, res) => {
  try {
    const updated = await Setting.incrementLoyaltyPoints(req.body.points);
    return standardResponse(res, true, updated.loyaltyProgram, 'Loyalty points incremented');
  } catch (error) {
    return errorResponse(res, 'Failed to increment loyalty points', 500, error);
  }
};

exports.updatePolicies = async (req, res) => {
  try {
    const updated = await Setting.updatePolicies(req.body);
    return standardResponse(res, true, {
      returnPolicy: updated.returnPolicy,
      privacyPolicy: updated.privacyPolicy,
      termsOfService: updated.termsOfService
    }, 'Policies updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update policies', 500, error);
  }
};

exports.updatePolicy = async (req, res) => {
  try {
    const updated = await Setting.updatePolicy(req.body.type, req.body.content, req.user?._id);
    return standardResponse(res, true, updated, `Policy ${req.body.type} updated`);
  } catch (error) {
    return errorResponse(res, 'Failed to update policy', 500, error);
  }
};

exports.updateFeaturedCategories = async (req, res) => {
  try {
    const updated = await Setting.updateFeaturedCategories(req.body.categoryIds);
    return standardResponse(res, true, updated.featuredCategories, 'Featured categories updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update featured categories', 500, error);
  }
};

exports.updateOrderLimits = async (req, res) => {
  try {
    const updated = await Setting.updateOrderLimits(req.body);
    return standardResponse(res, true, {
      minOrderAmount: updated.minOrderAmount,
      maxOrderAmount: updated.maxOrderAmount
    }, 'Order limits updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update order limits', 500, error);
  }
};

// ================== AUDIT / ADVANCED ==================

exports.updateWithAudit = async (req, res) => {
  try {
    const updated = await Setting.updateWithAudit(req.body.updateObj, req.user?._id, req.body.section);
    return standardResponse(res, true, updated, 'Settings updated with audit');
  } catch (error) {
    return errorResponse(res, 'Failed to update settings with audit', 500, error);
  }
};
