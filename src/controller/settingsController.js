const Setting = require('../models/settingsModel');
const { validationResult } = require('express-validator');
const { sendSuccess, HTTP_STATUS } = require('../utils/responseHelper');
const AppError = require('../utils/appError');
const { catchAsync } = require('../middleware/errorHandler');

// Settings Controller with all possible methods covering model statics and instance methods

const settingController = {
    // Basic Settings Operations
    getSettings: catchAsync(async (req, res) => {
        const settings = await Setting.getSettings();
        return sendSuccess(res, {
            data: settings,
            message: 'Settings retrieved successfully',
        });
    }),

    getSettingsSafe: catchAsync(async (req, res) => {
        const settings = await Setting.findOne().lean();
        if (!settings) {
            throw AppError.notFound('Settings not found');
        }
        const safeSetting = new Setting(settings);
        const safeData = safeSetting.toJSONSafe();
        return sendSuccess(res, {
            data: safeData,
            message: 'Settings retrieved successfully',
        });
    }),

    updateSettings: catchAsync(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw AppError.validation('Validation failed', errors.array());
        }

        const updated_by = req.user?.id || 'system';
        const settings = await Setting.updateSettings(req.body, updated_by);
        return sendSuccess(res, {
            data: settings,
            message: 'Settings updated successfully',
        });
    }),

    // Maintenance and Live Status Operations
    toggleMaintenanceMode: catchAsync(async (req, res) => {
        const { status } = req.body;
        const settings = await Setting.toggleMaintenanceMode(status);
        return sendSuccess(res, {
            data: settings,
            message: `Maintenance mode ${status ? 'enabled' : 'disabled'}`,
        });
    }),

    toggleLiveStatus: catchAsync(async (req, res) => {
        const { status } = req.body;
        const settings = await Setting.toggleLiveStatus(status);
        return sendSuccess(res, {
            data: settings,
            message: `Site status set to ${status ? 'live' : 'offline'}`,
        });
    }),

    isMaintenanceMode: catchAsync(async (req, res) => {
        const settings = await Setting.findOne();
        const isInMaintenance = settings ? settings.isInMaintenance() : false;
        return sendSuccess(res, {
            data: { isMaintenanceMode: isInMaintenance },
            message: 'Maintenance mode status retrieved',
        });
    }),

    isStoreLive: catchAsync(async (req, res) => {
        const settings = await Setting.findOne();
        const isLive = settings ? settings.isStoreLive() : false;
        return sendSuccess(res, {
            data: { isStoreLive: isLive },
            message: 'Store live status retrieved',
        });
    }),

    // Branding Operations
    updateBranding: catchAsync(async (req, res) => {
        const settings = await Setting.updateBranding(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'Branding updated successfully',
        });
    }),

    // SEO Operations
    updateSEO: catchAsync(async (req, res) => {
        const settings = await Setting.updateSEO(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'SEO settings updated successfully',
        });
    }),

    // Payment Operations
    updatePaymentMethods: catchAsync(async (req, res) => {
        const { methods } = req.body;
        const settings = await Setting.updatePaymentMethods(methods);
        return sendSuccess(res, {
            data: settings,
            message: 'Payment methods updated successfully',
        });
    }),

    getActivePaymentMethods: catchAsync(async (req, res) => {
        const methods = await Setting.getActivePaymentMethods();
        return sendSuccess(res, {
            data: methods,
            message: 'Active payment methods retrieved',
        });
    }),

    // Contact Information Operations
    updateContactInfo: catchAsync(async (req, res) => {
        const settings = await Setting.updateContactInfo(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'Contact information updated successfully',
        });
    }),

    // Shipping Operations
    updateShippingOptions: catchAsync(async (req, res) => {
        const { options } = req.body;
        const settings = await Setting.updateShippingOptions(options);
        return sendSuccess(res, {
            data: settings,
            message: 'Shipping options updated successfully',
        });
    }),

    updateOrderLimits: catchAsync(async (req, res) => {
        const { minOrderAmount, maxOrderAmount } = req.body;
        const settings = await Setting.updateOrderLimits(minOrderAmount, maxOrderAmount);
        return sendSuccess(res, {
            data: settings,
            message: 'Order limits updated successfully',
        });
    }),

    // Email Operations
    updateEmailTemplates: catchAsync(async (req, res) => {
        const settings = await Setting.updateEmailTemplates(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'Email templates updated successfully',
        });
    }),

    // Analytics Operations
    updateAnalytics: catchAsync(async (req, res) => {
        const settings = await Setting.updateAnalytics(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'Analytics settings updated successfully',
        });
    }),

    // Currency and Tax Operations
    updateCurrencyAndTax: catchAsync(async (req, res) => {
        const { currency, currencySymbol, taxRate } = req.body;
        const settings = await Setting.updateCurrencyAndTax(currency, currencySymbol, taxRate);
        return sendSuccess(res, {
            data: settings,
            message: 'Currency and tax settings updated successfully',
        });
    }),

    // Loyalty Program Operations
    updateLoyaltyProgram: catchAsync(async (req, res) => {
        const settings = await Setting.updateLoyaltyProgram(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'Loyalty program updated successfully',
        });
    }),

    // Policies Operations
    updatePolicies: catchAsync(async (req, res) => {
        const settings = await Setting.updatePolicies(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'Policies updated successfully',
        });
    }),

    clearPolicies: catchAsync(async (req, res) => {
        const settings = await Setting.clearPolicies();
        return sendSuccess(res, {
            data: settings,
            message: 'All policies cleared successfully',
        });
    }),

    // Featured Categories Operations
    updateFeaturedCategories: catchAsync(async (req, res) => {
        const { categoryIds } = req.body;
        const settings = await Setting.updateFeaturedCategories(categoryIds);
        return sendSuccess(res, {
            data: settings,
            message: 'Featured categories updated successfully',
        });
    }),

    addFeaturedCategory: catchAsync(async (req, res) => {
        const { categoryId } = req.params;
        const settings = await Setting.findOne();
        if (!settings) {
            throw AppError.notFound('Settings not found');
        }
        await settings.addFeaturedCategory(categoryId);
        return sendSuccess(res, {
            data: settings,
            message: 'Category added to featured list',
        });
    }),

    removeFeaturedCategory: catchAsync(async (req, res) => {
        const { categoryId } = req.params;
        const settings = await Setting.findOne();
        if (!settings) {
            throw AppError.notFound('Settings not found');
        }
        await settings.removeFeaturedCategory(categoryId);
        return sendSuccess(res, {
            data: settings,
            message: 'Category removed from featured list',
        });
    }),

    // Social Media Operations
    updateSocialLink: catchAsync(async (req, res) => {
        const { platform } = req.params;
        const { url } = req.body;
        const settings = await Setting.findOne();
        if (!settings) {
            throw AppError.notFound('Settings not found');
        }
        await settings.updateSocialLink(platform, url);
        return sendSuccess(res, {
            data: settings,
            message: `${platform} link updated successfully`,
        });
    }),

    // Security Operations
    resetSecuritySettings: catchAsync(async (req, res) => {
        const settings = await Setting.findOne();
        if (!settings) {
            throw AppError.notFound('Settings not found');
        }
        await settings.resetSecuritySettings();
        return sendSuccess(res, {
            data: settings,
            message: 'Security settings reset to defaults',
        });
    }),

    enableTwoFactorAuth: catchAsync(async (req, res) => {
        const { enabled } = req.body;
        const settings = await Setting.enableTwoFactorAuth(enabled);
        return sendSuccess(res, {
            data: settings,
            message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`,
        });
    }),

    addAllowedIPRange: catchAsync(async (req, res) => {
        const { ipRange } = req.body;
        const settings = await Setting.addAllowedIPRange(ipRange);
        return sendSuccess(res, {
            data: settings,
            message: 'IP range added to allowed list',
        });
    }),

    removeAllowedIPRange: catchAsync(async (req, res) => {
        const { ipRange } = req.body;
        const settings = await Setting.removeAllowedIPRange(ipRange);
        return sendSuccess(res, {
            data: settings,
            message: 'IP range removed from allowed list',
        });
    }),

    // UI/UX Operations
    setDarkModeForAllUsers: catchAsync(async (req, res) => {
        const { enabled } = req.body;
        await Setting.setDarkModeForAllUsers(enabled);
        return sendSuccess(res, {
            message: `Dark mode ${enabled ? 'enabled' : 'disabled'} for all users`,
        });
    }),

    getDefaultLanguage: catchAsync(async (req, res) => {
        const language = await Setting.getDefaultLanguage();
        return sendSuccess(res, {
            data: { defaultLanguage: language },
            message: 'Default language retrieved',
        });
    }),

    setDefaultLanguage: catchAsync(async (req, res) => {
        const { langCode } = req.body;
        const settings = await Setting.setDefaultLanguage(langCode);
        return sendSuccess(res, {
            data: settings,
            message: 'Default language updated successfully',
        });
    }),

    // Notification Operations
    enablePushNotificationsForAllUsers: catchAsync(async (req, res) => {
        const { enabled } = req.body;
        await Setting.enablePushNotificationsForAllUsers(enabled);
        return sendSuccess(res, {
            message: `Push notifications ${enabled ? 'enabled' : 'disabled'} for all users`,
        });
    }),

    // Advanced Operations
    deepMergeUpdate: catchAsync(async (req, res) => {
        const settings = await Setting.findOne();
        if (!settings) {
            throw AppError.notFound('Settings not found');
        }
        await settings.deepMergeUpdate(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'Settings deep merged successfully',
        });
    }),

    toggleFlag: catchAsync(async (req, res) => {
        const { path } = req.body;
        const settings = await Setting.findOne();
        if (!settings) {
            throw AppError.notFound('Settings not found');
        }
        await settings.toggleFlag(path);
        return sendSuccess(res, {
            data: settings,
            message: `Flag at ${path} toggled successfully`,
        });
    }),

    appendToArray: catchAsync(async (req, res) => {
        const { path, value } = req.body;
        const settings = await Setting.findOne();
        if (!settings) {
            throw AppError.notFound('Settings not found');
        }
        await settings.appendToArray(path, value);
        return sendSuccess(res, {
            data: settings,
            message: `Value appended to ${path} successfully`,
        });
    }),

    removeFromArray: catchAsync(async (req, res) => {
        const { path, value } = req.body;
        const settings = await Setting.findOne();
        if (!settings) {
            throw AppError.notFound('Settings not found');
        }
        await settings.removeFromArray(path, value);
        return sendSuccess(res, {
            data: settings,
            message: `Value removed from ${path} successfully`,
        });
    }),

    bulkUpdateFields: catchAsync(async (req, res) => {
        const settings = await Setting.bulkUpdateFields(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'Bulk fields updated successfully',
        });
    }),

    findByPartialFields: catchAsync(async (req, res) => {
        const settings = await Setting.findByPartialFields(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'Settings found',
        });
    }),

    auditUpdate: catchAsync(async (req, res) => {
        const user = req.user?.username || req.user?.email || 'unknown';
        const settings = await Setting.auditUpdate(req.body, user);
        return sendSuccess(res, {
            data: settings,
            message: 'Settings updated with audit trail',
        });
    }),

    // Reset Operations
    resetToDefaults: catchAsync(async (req, res) => {
        const settings = await Setting.resetToDefaults(req.body);
        return sendSuccess(res, {
            data: settings,
            message: 'Settings reset to default values',
        });
    }),

    resetSectionsToDefaults: catchAsync(async (req, res) => {
        const { sections } = req.body;
        const settings = await Setting.resetSectionsToDefaults(sections);
        return sendSuccess(res, {
            data: settings,
            message: 'Selected sections reset to defaults',
        });
    }),
};

module.exports = settingController;
