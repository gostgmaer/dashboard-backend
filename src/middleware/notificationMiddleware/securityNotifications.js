/**
 * Security-Related Notification Middleware
 * Handles notifications for security events (login, logout, password changes, 2FA, etc.)
 */

const notificationService = require('../../services/NotificationService');
const User = require('../../models/user');
const LoggerService = require('../../services/logger');
const { loginAlertTemplate } = require('../../email/emailTemplate');

class SecurityNotifications {
    static async onPasswordChange(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'PASSWORD_CHANGED',
                title: 'Password Changed',
                message: 'Your password has been successfully changed.',
                data: { changeTime: new Date(), ipAddress: req.ip },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'HIGH',
                metadata: { category: 'security', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating password change notification:', { error });
        }
        next();
    }

    static async onTwoFactorEnabled(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'TWO_FACTOR_ENABLED',
                title: 'Two-Factor Authentication Enabled',
                message: 'Two-factor authentication has been enabled for your account.',
                data: { enabledAt: new Date(), method: res.locals.twoFactorMethod || 'app' },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'HIGH',
                metadata: { category: 'security', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating 2FA enabled notification:', { error });
        }
        next();
    }

    static async onTwoFactorDisabled(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'TWO_FACTOR_DISABLED',
                title: 'Two-Factor Authentication Disabled',
                message: 'Two-factor authentication has been disabled for your account.',
                data: { disabledAt: new Date(), ipAddress: req.ip },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'HIGH',
                metadata: { category: 'security', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating 2FA disabled notification:', { error });
        }
        next();
    }

    static async onLoginSuccess(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'LOGIN_SUCCESS',
                title: 'Successful Login',
                message: 'You have successfully logged in to your account.',
                data: { loginTime: new Date(), ipAddress: req.ip, userAgent: req.headers['user-agent'] },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: { category: 'authentication', relatedResource: user._id, resourceModel: 'User' },
                loginAlertTemplate,
            });
        } catch (error) {
            LoggerService.error('Error creating login success notification:', { error });
        }
        next();
    }

    static async onLoginFailed(req, res, next) {
        try {
            const email = req.body.email;
            const user = await User.findOne({ email });

            if (user) {
                await notificationService.create({
                    recipient: user._id,
                    type: 'LOGIN_FAILED',
                    title: 'Failed Login Attempt',
                    message: 'There was a failed login attempt on your account.',
                    data: { attemptTime: new Date(), ipAddress: req.ip, userAgent: req.headers['user-agent'] },
                    channels: ['IN_APP', 'EMAIL'],
                    priority: 'HIGH',
                    metadata: { category: 'security', relatedResource: user._id, resourceModel: 'User' },
                });
            }
        } catch (error) {
            LoggerService.error('Error creating login failed notification:', { error });
        }
        next();
    }

    static async onLogout(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'LOGOUT',
                title: 'Logged Out',
                message: 'You have been logged out successfully.',
                data: { logoutTime: new Date(), sessionDuration: res.locals.sessionDuration },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: { category: 'authentication', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating logout notification:', { error });
        }
        next();
    }

    static async onAccountLocked(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'ACCOUNT_LOCKED',
                title: 'Account Locked',
                message: 'Your account has been temporarily locked due to security reasons.',
                data: { lockReason: res.locals.lockReason, lockedAt: new Date() },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'URGENT',
                metadata: { category: 'security', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating account locked notification:', { error });
        }
        next();
    }

    static async onAccountUnlocked(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'ACCOUNT_UNLOCKED',
                title: 'Account Unlocked',
                message: 'Your account has been unlocked and is now accessible.',
                data: { unlockedAt: new Date(), unlockedBy: res.locals.unlockedBy },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'MEDIUM',
                metadata: { category: 'security', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating account unlocked notification:', { error });
        }
        next();
    }
}

module.exports = SecurityNotifications;
