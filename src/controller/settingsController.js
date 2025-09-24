const Setting = require('../models/settingsModel');
const { validationResult } = require('express-validator');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../utils/apiUtils');
// Settings Controller with all possible methods covering model statics and instance methods

const settingController = {

    // Basic Settings Operations
    async getSettings(req, res) {
        try {
            const settings = await Setting.getSettings();
            res.status(200).json({
                success: true,
                data: settings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async getSettingsSafe(req, res) {
        try {
            const settings = await Setting.findOne().lean();
            if (settings) {
                const safeSetting = new Setting(settings);
                const safeData = safeSetting.toJSONSafe();
                res.status(200).json({
                    success: true,
                    data: safeData
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Settings not found'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async updateSettings(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const updatedBy = req.user?.id || 'system';
            const settings = await Setting.updateSettings(req.body, updatedBy);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Settings updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Maintenance and Live Status Operations
    async toggleMaintenanceMode(req, res) {
        try {
            const { status } = req.body;
            const settings = await Setting.toggleMaintenanceMode(status);
            res.status(200).json({
                success: true,
                data: settings,
                message: `Maintenance mode ${status ? 'enabled' : 'disabled'}`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async toggleLiveStatus(req, res) {
        try {
            const { status } = req.body;
            const settings = await Setting.toggleLiveStatus(status);
            res.status(200).json({
                success: true,
                data: settings,
                message: `Site status set to ${status ? 'live' : 'offline'}`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async isMaintenanceMode(req, res) {
        try {
            const settings = await Setting.findOne();
            const isInMaintenance = settings ? settings.isInMaintenance() : false;
            res.status(200).json({
                success: true,
                data: { isMaintenanceMode: isInMaintenance }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async isStoreLive(req, res) {
        try {
            const settings = await Setting.findOne();
            const isLive = settings ? settings.isStoreLive() : false;
            res.status(200).json({
                success: true,
                data: { isStoreLive: isLive }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Branding Operations
    async updateBranding(req, res) {
        try {
            const settings = await Setting.updateBranding(req.body);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Branding updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // SEO Operations
    async updateSEO(req, res) {
        try {
            const settings = await Setting.updateSEO(req.body);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'SEO settings updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Payment Operations
    async updatePaymentMethods(req, res) {
        try {
            const { methods } = req.body;
            const settings = await Setting.updatePaymentMethods(methods);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Payment methods updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async getActivePaymentMethods(req, res) {
        try {
            const methods = await Setting.getActivePaymentMethods();
            res.status(200).json({
                success: true,
                data: methods
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Contact Information Operations
    async updateContactInfo(req, res) {
        try {
            const settings = await Setting.updateContactInfo(req.body);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Contact information updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Shipping Operations
    async updateShippingOptions(req, res) {
        try {
            const { options } = req.body;
            const settings = await Setting.updateShippingOptions(options);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Shipping options updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async updateOrderLimits(req, res) {
        try {
            const { minOrderAmount, maxOrderAmount } = req.body;
            const settings = await Setting.updateOrderLimits(minOrderAmount, maxOrderAmount);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Order limits updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Email Operations
    async updateEmailTemplates(req, res) {
        try {
            const settings = await Setting.updateEmailTemplates(req.body);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Email templates updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Analytics Operations
    async updateAnalytics(req, res) {
        try {
            const settings = await Setting.updateAnalytics(req.body);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Analytics settings updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Currency and Tax Operations
    async updateCurrencyAndTax(req, res) {
        try {
            const { currency, currencySymbol, taxRate } = req.body;
            const settings = await Setting.updateCurrencyAndTax(currency, currencySymbol, taxRate);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Currency and tax settings updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Loyalty Program Operations
    async updateLoyaltyProgram(req, res) {
        try {
            const settings = await Setting.updateLoyaltyProgram(req.body);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Loyalty program updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Policies Operations
    async updatePolicies(req, res) {
        try {
            const settings = await Setting.updatePolicies(req.body);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Policies updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async clearPolicies(req, res) {
        try {
            const settings = await Setting.clearPolicies();
            res.status(200).json({
                success: true,
                data: settings,
                message: 'All policies cleared successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Featured Categories Operations
    async updateFeaturedCategories(req, res) {
        try {
            const { categoryIds } = req.body;
            const settings = await Setting.updateFeaturedCategories(categoryIds);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Featured categories updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async addFeaturedCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const settings = await Setting.findOne();
            if (settings) {
                await settings.addFeaturedCategory(categoryId);
                res.status(200).json({
                    success: true,
                    data: settings,
                    message: 'Category added to featured list'
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Settings not found'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async removeFeaturedCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const settings = await Setting.findOne();
            if (settings) {
                await settings.removeFeaturedCategory(categoryId);
                res.status(200).json({
                    success: true,
                    data: settings,
                    message: 'Category removed from featured list'
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Settings not found'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Social Media Operations
    async updateSocialLink(req, res) {
        try {
            const { platform } = req.params;
            const { url } = req.body;
            const settings = await Setting.findOne();
            if (settings) {
                await settings.updateSocialLink(platform, url);
                res.status(200).json({
                    success: true,
                    data: settings,
                    message: `${platform} link updated successfully`
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Settings not found'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Security Operations
    async resetSecuritySettings(req, res) {
        try {
            const settings = await Setting.findOne();
            if (settings) {
                await settings.resetSecuritySettings();
                res.status(200).json({
                    success: true,
                    data: settings,
                    message: 'Security settings reset to defaults'
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Settings not found'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async enableTwoFactorAuth(req, res) {
        try {
            const { enabled } = req.body;
            const settings = await Setting.enableTwoFactorAuth(enabled);
            res.status(200).json({
                success: true,
                data: settings,
                message: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async addAllowedIPRange(req, res) {
        try {
            const { ipRange } = req.body;
            const settings = await Setting.addAllowedIPRange(ipRange);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'IP range added to allowed list'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async removeAllowedIPRange(req, res) {
        try {
            const { ipRange } = req.body;
            const settings = await Setting.removeAllowedIPRange(ipRange);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'IP range removed from allowed list'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // UI/UX Operations
    async setDarkModeForAllUsers(req, res) {
        try {
            const { enabled } = req.body;
            await Setting.setDarkModeForAllUsers(enabled);
            res.status(200).json({
                success: true,
                message: `Dark mode ${enabled ? 'enabled' : 'disabled'} for all users`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async getDefaultLanguage(req, res) {
        try {
            const language = await Setting.getDefaultLanguage();
            res.status(200).json({
                success: true,
                data: { defaultLanguage: language }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async setDefaultLanguage(req, res) {
        try {
            const { langCode } = req.body;
            const settings = await Setting.setDefaultLanguage(langCode);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Default language updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Notification Operations
    async enablePushNotificationsForAllUsers(req, res) {
        try {
            const { enabled } = req.body;
            await Setting.enablePushNotificationsForAllUsers(enabled);
            res.status(200).json({
                success: true,
                message: `Push notifications ${enabled ? 'enabled' : 'disabled'} for all users`
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Advanced Operations
    async deepMergeUpdate(req, res) {
        try {
            const settings = await Setting.findOne();
            if (settings) {
                await settings.deepMergeUpdate(req.body);
                res.status(200).json({
                    success: true,
                    data: settings,
                    message: 'Settings deep merged successfully'
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Settings not found'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async toggleFlag(req, res) {
        try {
            const { path } = req.body;
            const settings = await Setting.findOne();
            if (settings) {
                await settings.toggleFlag(path);
                res.status(200).json({
                    success: true,
                    data: settings,
                    message: `Flag at ${path} toggled successfully`
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Settings not found'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async appendToArray(req, res) {
        try {
            const { path, value } = req.body;
            const settings = await Setting.findOne();
            if (settings) {
                await settings.appendToArray(path, value);
                res.status(200).json({
                    success: true,
                    data: settings,
                    message: `Value appended to ${path} successfully`
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Settings not found'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async removeFromArray(req, res) {
        try {
            const { path, value } = req.body;
            const settings = await Setting.findOne();
            if (settings) {
                await settings.removeFromArray(path, value);
                res.status(200).json({
                    success: true,
                    data: settings,
                    message: `Value removed from ${path} successfully`
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Settings not found'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async bulkUpdateFields(req, res) {
        try {
            const settings = await Setting.bulkUpdateFields(req.body);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Bulk fields updated successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async findByPartialFields(req, res) {
        try {
            const settings = await Setting.findByPartialFields(req.body);
            res.status(200).json({
                success: true,
                data: settings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async auditUpdate(req, res) {
        try {
            const user = req.user?.username || req.user?.email || 'unknown';
            const settings = await Setting.auditUpdate(req.body, user);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Settings updated with audit trail'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Reset Operations
    async resetToDefaults(req, res) {
        try {
            const settings = await Setting.resetToDefaults(req.body);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Settings reset to default values'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    async resetSectionsToDefaults(req, res) {
        try {
            const { sections } = req.body;
            const settings = await Setting.resetSectionsToDefaults(sections);
            res.status(200).json({
                success: true,
                data: settings,
                message: 'Selected sections reset to defaults'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = settingController;
