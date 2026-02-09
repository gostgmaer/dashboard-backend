/**
 * User-Related Notification Middleware
 * Handles notifications for user account operations
 */

const notificationService = require('../../services/NotificationService');
const User = require('../../models/user');
const LoggerService = require('../../services/logger');

/**
 * Helper: Get admin users
 */
const getAdminUsers = async () => {
    return await User.aggregate([
        {
            $lookup: {
                from: 'roles',
                localField: 'role',
                foreignField: '_id',
                as: 'role_info',
            },
        },
        { $unwind: { path: '$role_info' } },
        { $match: { 'role_info.name': { $in: ['super_admin', 'admin'] } } },
        { $project: { _id: 1, username: 1, email: 1, role: '$role_info.name' } },
    ]);
};

class UserNotifications {
    static async onUserCreate(req, res, next) {
        try {
            const user = res.locals.createdUser || req.body;

            // Notify the user
            await notificationService.create({
                recipient: user._id,
                type: 'USER_CREATED',
                title: 'Welcome to our platform!',
                message: `Welcome ${user.username}! Your account has been successfully created.`,
                data: { username: user.username, email: user.email },
                channels: ['EMAIL'],
                priority: 'MEDIUM',
                metadata: { category: 'user', relatedResource: user._id, resourceModel: 'User' },
            });

            // Notify admins
            const admins = await getAdminUsers();
            for (const admin of admins) {
                await notificationService.create({
                    recipient: admin._id,
                    type: 'USER_CREATED',
                    title: 'New User Registration',
                    message: `New user ${user.username} has registered`,
                    data: { userId: user._id, username: user.username, email: user.email, admin: admin.username },
                    channels: ['IN_APP', 'EMAIL'],
                    priority: 'MEDIUM',
                    metadata: { category: 'admin', relatedResource: user._id, resourceModel: 'User', actionUrl: `/admin/users/${user._id}` },
                });
            }
        } catch (error) {
            LoggerService.error('Error creating user notification:', { error });
        }
        next();
    }

    static async onUserUpdate(req, res, next) {
        try {
            const user = res.locals.user;
            const changes = res.locals.changes || [];

            await notificationService.create({
                recipient: user._id,
                type: 'USER_UPDATED',
                title: 'Profile Updated',
                message: 'Your profile has been successfully updated.',
                data: { changes, username: user.username },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: { category: 'user', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating user update notification:', { error });
        }
        next();
    }

    static async onUserDelete(req, res, next) {
        try {
            const user = res.locals.deletedUser;
            const admins = await getAdminUsers();

            for (const admin of admins) {
                await notificationService.create({
                    recipient: admin._id,
                    type: 'USER_DELETED',
                    title: 'User Account Deleted',
                    message: `User account ${user.username} has been deleted`,
                    data: { userId: user._id, username: user.username, email: user.email },
                    channels: ['IN_APP'],
                    priority: 'MEDIUM',
                    metadata: { category: 'admin', relatedResource: user._id, resourceModel: 'User' },
                });
            }
        } catch (error) {
            LoggerService.error('Error creating user delete notification:', { error });
        }
        next();
    }

    static async onRoleAssign(req, res, next) {
        try {
            const user = res.locals.user;
            const newRole = res.locals.newRole;

            await notificationService.create({
                recipient: user._id,
                type: 'ROLE_ASSIGNED',
                title: 'New Role Assigned',
                message: `You have been assigned the role: ${newRole.name}`,
                data: { roleName: newRole.name, username: user.username, permissions: newRole.permissions },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'MEDIUM',
                metadata: { category: 'role', relatedResource: newRole._id, resourceModel: 'Role' },
            });
        } catch (error) {
            LoggerService.error('Error creating role assignment notification:', { error });
        }
        next();
    }

    static async onEmailVerified(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'EMAIL_VERIFIED',
                title: 'Email Verified',
                message: 'Your email address has been successfully verified.',
                data: { email: user.email, verifiedAt: new Date() },
                channels: ['IN_APP'],
                priority: 'MEDIUM',
                metadata: { category: 'verification', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating email verified notification:', { error });
        }
        next();
    }

    static async onPhoneVerified(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'PHONE_VERIFIED',
                title: 'Phone Verified',
                message: 'Your phone number has been successfully verified.',
                data: { phone: user.phone, verifiedAt: new Date() },
                channels: ['IN_APP'],
                priority: 'MEDIUM',
                metadata: { category: 'verification', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating phone verified notification:', { error });
        }
        next();
    }

    static async onProfileCompleted(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'PROFILE_COMPLETED',
                title: 'Profile Complete',
                message: 'Congratulations! Your profile is now complete.',
                data: { completionPercentage: 100, completedAt: new Date() },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: { category: 'profile', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating profile completed notification:', { error });
        }
        next();
    }

    static async onAddressAdded(req, res, next) {
        try {
            const user = res.locals.user;
            const address = res.locals.address;

            await notificationService.create({
                recipient: user._id,
                type: 'ADDRESS_ADDED',
                title: 'Address Added',
                message: 'A new address has been added to your account.',
                data: { addressId: address._id, addressType: address.type, city: address.city },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: { category: 'profile', relatedResource: address._id, resourceModel: 'Address' },
            });
        } catch (error) {
            LoggerService.error('Error creating address added notification:', { error });
        }
        next();
    }

    static async onAddressUpdated(req, res, next) {
        try {
            const user = res.locals.user;
            const address = res.locals.address;

            await notificationService.create({
                recipient: user._id,
                type: 'ADDRESS_UPDATED',
                title: 'Address Updated',
                message: 'Your address has been successfully updated.',
                data: { addressId: address._id, addressType: address.type, changes: res.locals.changes || [] },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: { category: 'profile', relatedResource: address._id, resourceModel: 'Address' },
            });
        } catch (error) {
            LoggerService.error('Error creating address updated notification:', { error });
        }
        next();
    }

    static async onAddressDeleted(req, res, next) {
        try {
            const user = res.locals.user;
            const address = res.locals.deletedAddress;

            await notificationService.create({
                recipient: user._id,
                type: 'ADDRESS_DELETED',
                title: 'Address Removed',
                message: 'An address has been removed from your account.',
                data: { addressId: address._id, addressType: address.type },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: { category: 'profile', relatedResource: address._id, resourceModel: 'Address' },
            });
        } catch (error) {
            LoggerService.error('Error creating address deleted notification:', { error });
        }
        next();
    }

    static async onPreferencesUpdated(req, res, next) {
        try {
            const user = res.locals.user;

            await notificationService.create({
                recipient: user._id,
                type: 'PREFERENCES_UPDATED',
                title: 'Preferences Updated',
                message: 'Your account preferences have been updated.',
                data: { updatedPreferences: res.locals.updatedPreferences, updatedAt: new Date() },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: { category: 'profile', relatedResource: user._id, resourceModel: 'User' },
            });
        } catch (error) {
            LoggerService.error('Error creating preferences updated notification:', { error });
        }
        next();
    }
}

module.exports = UserNotifications;
