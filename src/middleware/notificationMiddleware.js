const notificationService = require('../services/NotificationService');
const User = require('../models/user');

class NotificationMiddleware {
  // ==== USER-RELATED NOTIFICATIONS ====

  static async onUserCreate(req, res, next) {
    try {
      const user = res.locals.createdUser || req.body;

      // Notify the user
      await notificationService.create({
        recipient: user._id,
        type: 'USER_CREATED',
        title: 'Welcome to our platform!',
        message: `Welcome ${user.username}! Your account has been successfully created.`,
        data: {
          username: user.username,
          email: user.email,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'user',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });

      // Notify admins
      const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'USER_CREATED',
          title: 'New User Registration',
          message: `New user ${user.username} has registered`,
          data: {
            userId: user._id,
            username: user.username,
            email: user.email,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'admin',
            relatedResource: user._id,
            resourceModel: 'User',
            actionUrl: `/admin/users/${user._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating user notification:', error);
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
        data: {
          changes: changes,
          username: user.username,
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'user',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating user update notification:', error);
    }
    next();
  }

  static async onUserDelete(req, res, next) {
    try {
      const user = res.locals.deletedUser;

      // Notify admins about user deletion
      const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'USER_DELETED',
          title: 'User Account Deleted',
          message: `User account ${user.username} has been deleted`,
          data: {
            userId: user._id,
            username: user.username,
            email: user.email,
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'admin',
            relatedResource: user._id,
            resourceModel: 'User',
          },
        });
      }
    } catch (error) {
      console.error('Error creating user delete notification:', error);
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
        data: {
          roleName: newRole.name,
          permissions: newRole.permissions,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'role',
          relatedResource: newRole._id,
          resourceModel: 'Role',
        },
      });
    } catch (error) {
      console.error('Error creating role assignment notification:', error);
    }
    next();
  }

  static async onPasswordChange(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'PASSWORD_CHANGED',
        title: 'Password Changed',
        message: 'Your password has been successfully changed.',
        data: {
          changeTime: new Date(),
          ipAddress: req.ip,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating password change notification:', error);
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
        data: {
          email: user.email,
          verifiedAt: new Date(),
        },
        channels: ['IN_APP'],
        priority: 'MEDIUM',
        metadata: {
          category: 'verification',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating email verified notification:', error);
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
        data: {
          phone: user.phone,
          verifiedAt: new Date(),
        },
        channels: ['IN_APP'],
        priority: 'MEDIUM',
        metadata: {
          category: 'verification',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating phone verified notification:', error);
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
        data: {
          completionPercentage: 100,
          completedAt: new Date(),
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'profile',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating profile completed notification:', error);
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
        data: {
          enabledAt: new Date(),
          method: res.locals.twoFactorMethod || 'app',
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating 2FA enabled notification:', error);
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
        data: {
          disabledAt: new Date(),
          ipAddress: req.ip,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating 2FA disabled notification:', error);
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
        data: {
          loginTime: new Date(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'authentication',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating login success notification:', error);
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
          data: {
            attemptTime: new Date(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'security',
            relatedResource: user._id,
            resourceModel: 'User',
          },
        });
      }
    } catch (error) {
      console.error('Error creating login failed notification:', error);
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
        data: {
          logoutTime: new Date(),
          sessionDuration: res.locals.sessionDuration,
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'authentication',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating logout notification:', error);
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
        data: {
          addressId: address._id,
          addressType: address.type,
          city: address.city,
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'profile',
          relatedResource: address._id,
          resourceModel: 'Address',
        },
      });
    } catch (error) {
      console.error('Error creating address added notification:', error);
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
        data: {
          addressId: address._id,
          addressType: address.type,
          changes: res.locals.changes || [],
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'profile',
          relatedResource: address._id,
          resourceModel: 'Address',
        },
      });
    } catch (error) {
      console.error('Error creating address updated notification:', error);
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
        data: {
          addressId: address._id,
          addressType: address.type,
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'profile',
          relatedResource: address._id,
          resourceModel: 'Address',
        },
      });
    } catch (error) {
      console.error('Error creating address deleted notification:', error);
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
        data: {
          updatedPreferences: res.locals.updatedPreferences,
          updatedAt: new Date(),
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'profile',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating preferences updated notification:', error);
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
        data: {
          lockReason: res.locals.lockReason,
          lockedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'URGENT',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating account locked notification:', error);
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
        data: {
          unlockedAt: new Date(),
          unlockedBy: res.locals.unlockedBy,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating account unlocked notification:', error);
    }
    next();
  }

  // ==== MISSING USER-RELATED NOTIFICATIONS (29) ====

  static async onSubscriptionStarted(req, res, next) {
    try {
      const user = res.locals.user;
      const subscription = res.locals.subscription;

      await notificationService.create({
        recipient: user._id,
        type: 'SUBSCRIPTION_STARTED',
        title: 'Subscription Activated',
        message: `Your ${subscription.planName || 'subscription'} is now active!`,
        data: {
          planName: subscription.planName,
          price: subscription.price,
          billingCycle: subscription.billingCycle,
          nextBillingDate: subscription.nextBillingDate,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'subscription',
          relatedResource: subscription._id,
          resourceModel: 'Subscription',
        },
      });
    } catch (error) {
      console.error('Error creating subscription started notification:', error);
    }
    next();
  }

  static async onSubscriptionCancelled(req, res, next) {
    try {
      const user = res.locals.user;
      const subscription = res.locals.subscription;

      await notificationService.create({
        recipient: user._id,
        type: 'SUBSCRIPTION_CANCELLED',
        title: 'Subscription Cancelled',
        message: `Your ${subscription.planName || 'subscription'} has been cancelled.`,
        data: {
          planName: subscription.planName,
          cancelledAt: new Date(),
          refundAmount: res.locals.refundAmount,
          accessUntil: subscription.accessUntil,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'subscription',
          relatedResource: subscription._id,
          resourceModel: 'Subscription',
        },
      });
    } catch (error) {
      console.error('Error creating subscription cancelled notification:', error);
    }
    next();
  }

  static async onSubscriptionRenewed(req, res, next) {
    try {
      const user = res.locals.user;
      const subscription = res.locals.subscription;

      await notificationService.create({
        recipient: user._id,
        type: 'SUBSCRIPTION_RENEWED',
        title: 'Subscription Renewed',
        message: `Your ${subscription.planName || 'subscription'} has been renewed successfully.`,
        data: {
          planName: subscription.planName,
          renewedAt: new Date(),
          amount: subscription.price,
          nextBillingDate: subscription.nextBillingDate,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'subscription',
          relatedResource: subscription._id,
          resourceModel: 'Subscription',
        },
      });
    } catch (error) {
      console.error('Error creating subscription renewed notification:', error);
    }
    next();
  }

  static async onDataExportRequested(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'DATA_EXPORT_REQUESTED',
        title: 'Data Export Requested',
        message: 'Your data export request has been received and is being processed.',
        data: {
          requestedAt: new Date(),
          exportType: res.locals.exportType || 'full',
          estimatedCompletionTime: res.locals.estimatedTime || '24-48 hours',
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'data',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating data export requested notification:', error);
    }
    next();
  }

  static async onDataExportCompleted(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'DATA_EXPORT_COMPLETED',
        title: 'Data Export Ready',
        message: 'Your data export is ready for download.',
        data: {
          completedAt: new Date(),
          downloadLink: res.locals.downloadLink,
          expiresAt: res.locals.expiresAt,
          fileSize: res.locals.fileSize,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'data',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating data export completed notification:', error);
    }
    next();
  }

  static async onEmailPhoneVerificationReminder(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'EMAIL_PHONE_VERIFICATION_REMINDER',
        title: 'Verification Reminder',
        message: 'Please verify your email address and phone number to secure your account.',
        data: {
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          reminderCount: res.locals.reminderCount || 1,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'verification',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating verification reminder notification:', error);
    }
    next();
  }

  static async onEmailChangeRequested(req, res, next) {
    try {
      const user = res.locals.user;
      const newEmail = res.locals.newEmail;

      await notificationService.create({
        recipient: user._id,
        type: 'EMAIL_CHANGE_REQUESTED',
        title: 'Email Change Request',
        message: `Please confirm your email change to ${newEmail}`,
        data: {
          currentEmail: user.email,
          newEmail: newEmail,
          confirmationToken: res.locals.confirmationToken,
          expiresAt: res.locals.tokenExpiresAt,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating email change requested notification:', error);
    }
    next();
  }

  static async onEmailChangeConfirmed(req, res, next) {
    try {
      const user = res.locals.user;
      const oldEmail = res.locals.oldEmail;

      await notificationService.create({
        recipient: user._id,
        type: 'EMAIL_CHANGE_CONFIRMED',
        title: 'Email Changed Successfully',
        message: `Your email has been changed from ${oldEmail} to ${user.email}`,
        data: {
          oldEmail: oldEmail,
          newEmail: user.email,
          changedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating email change confirmed notification:', error);
    }
    next();
  }

  static async onPhoneChangeRequested(req, res, next) {
    try {
      const user = res.locals.user;
      const newPhone = res.locals.newPhone;

      await notificationService.create({
        recipient: user._id,
        type: 'PHONE_CHANGE_REQUESTED',
        title: 'Phone Change Request',
        message: `Please confirm your phone number change to ${newPhone}`,
        data: {
          currentPhone: user.phone,
          newPhone: newPhone,
          verificationCode: res.locals.verificationCode,
          expiresAt: res.locals.codeExpiresAt,
        },
        channels: ['IN_APP', 'SMS'],
        priority: 'HIGH',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating phone change requested notification:', error);
    }
    next();
  }

  static async onPhoneChangeConfirmed(req, res, next) {
    try {
      const user = res.locals.user;
      const oldPhone = res.locals.oldPhone;

      await notificationService.create({
        recipient: user._id,
        type: 'PHONE_CHANGE_CONFIRMED',
        title: 'Phone Number Changed',
        message: `Your phone number has been updated successfully.`,
        data: {
          oldPhone: oldPhone,
          newPhone: user.phone,
          changedAt: new Date(),
        },
        channels: ['IN_APP', 'SMS'],
        priority: 'HIGH',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating phone change confirmed notification:', error);
    }
    next();
  }

  static async onAccountDeactivated(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'ACCOUNT_DEACTIVATED',
        title: 'Account Deactivated',
        message: 'Your account has been temporarily deactivated.',
        data: {
          deactivatedAt: new Date(),
          reason: res.locals.deactivationReason || 'Policy violation',
          reactivationProcess: res.locals.reactivationProcess,
          contactInfo: res.locals.supportContact,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'URGENT',
        metadata: {
          category: 'account',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating account deactivated notification:', error);
    }
    next();
  }

  static async onAccountReactivated(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'ACCOUNT_REACTIVATED',
        title: 'Account Reactivated',
        message: 'Welcome back! Your account has been reactivated.',
        data: {
          reactivatedAt: new Date(),
          deactivationDuration: res.locals.deactivationDuration,
          welcomeBackOffer: res.locals.welcomeBackOffer,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'account',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating account reactivated notification:', error);
    }
    next();
  }

  static async onPrivacyPolicyUpdated(req, res, next) {
    try {
      const users = await User.find({ isActive: true });
      const policyUpdate = res.locals.policyUpdate;

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'PRIVACY_POLICY_UPDATED',
          title: 'Privacy Policy Updated',
          message: 'We have updated our privacy policy. Please review the changes.',
          data: {
            updatedAt: new Date(),
            effectiveDate: policyUpdate.effectiveDate,
            majorChanges: policyUpdate.majorChanges,
            policyUrl: policyUpdate.policyUrl,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'policy',
            relatedResource: policyUpdate._id,
            resourceModel: 'Policy',
          },
        });
      }
    } catch (error) {
      console.error('Error creating privacy policy updated notification:', error);
    }
    next();
  }

  static async onTermsOfServiceUpdated(req, res, next) {
    try {
      const users = await User.find({ isActive: true });
      const termsUpdate = res.locals.termsUpdate;

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'TERMS_OF_SERVICE_UPDATED',
          title: 'Terms of Service Updated',
          message: 'Our terms of service have been updated. Please review the changes.',
          data: {
            updatedAt: new Date(),
            effectiveDate: termsUpdate.effectiveDate,
            keyChanges: termsUpdate.keyChanges,
            termsUrl: termsUpdate.termsUrl,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'policy',
            relatedResource: termsUpdate._id,
            resourceModel: 'Terms',
          },
        });
      }
    } catch (error) {
      console.error('Error creating terms updated notification:', error);
    }
    next();
  }

  static async onAccountRecoveryRequested(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'ACCOUNT_RECOVERY_REQUESTED',
        title: 'Account Recovery Request',
        message: 'We received a request to recover your account.',
        data: {
          requestedAt: new Date(),
          recoveryMethod: res.locals.recoveryMethod,
          recoveryCode: res.locals.recoveryCode,
          expiresAt: res.locals.expiresAt,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating account recovery requested notification:', error);
    }
    next();
  }

  // ==== REMAINING USER NOTIFICATIONS (14 more) ====

  static async onBackupEmailAdded(req, res, next) {
    try {
      const user = res.locals.user;
      const backupEmail = res.locals.backupEmail;

      await notificationService.create({
        recipient: user._id,
        type: 'BACKUP_EMAIL_ADDED',
        title: 'Backup Email Added',
        message: `Backup email ${backupEmail} has been added to your account.`,
        data: {
          backupEmail: backupEmail,
          addedAt: new Date(),
          verificationRequired: true,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating backup email added notification:', error);
    }
    next();
  }

  static async onBackupEmailRemoved(req, res, next) {
    try {
      const user = res.locals.user;
      const removedEmail = res.locals.removedEmail;

      await notificationService.create({
        recipient: user._id,
        type: 'BACKUP_EMAIL_REMOVED',
        title: 'Backup Email Removed',
        message: `Backup email ${removedEmail} has been removed from your account.`,
        data: {
          removedEmail: removedEmail,
          removedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating backup email removed notification:', error);
    }
    next();
  }

  static async onTrustedDeviceUpdated(req, res, next) {
    try {
      const user = res.locals.user;
      const device = res.locals.device;

      await notificationService.create({
        recipient: user._id,
        type: 'TRUSTED_DEVICE_UPDATED',
        title: 'Trusted Device Updated',
        message: `Trusted device "${device.name}" has been updated.`,
        data: {
          deviceName: device.name,
          deviceType: device.type,
          updatedAt: new Date(),
          ipAddress: device.ipAddress,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating trusted device updated notification:', error);
    }
    next();
  }

  static async onMfaSetupReminder(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'MFA_SETUP_REMINDER',
        title: 'Set Up Multi-Factor Authentication',
        message: 'Secure your account by enabling multi-factor authentication.',
        data: {
          reminderCount: res.locals.reminderCount || 1,
          securityScore: res.locals.securityScore,
          setupUrl: res.locals.setupUrl,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating MFA setup reminder notification:', error);
    }
    next();
  }

  static async onAccountActivitySummary(req, res, next) {
    try {
      const user = res.locals.user;
      const summary = res.locals.activitySummary;

      await notificationService.create({
        recipient: user._id,
        type: 'ACCOUNT_ACTIVITY_SUMMARY',
        title: 'Account Activity Summary',
        message: 'Here s your recent account activity summary.',
        data: {
          period: summary.period,
          loginCount: summary.loginCount,
          ordersPlaced: summary.ordersPlaced,
          pointsEarned: summary.pointsEarned,
          securityEvents: summary.securityEvents,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'activity',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating account activity summary notification:', error);
    }
    next();
  }

  static async onSecondaryPhoneVerified(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'SECONDARY_PHONE_VERIFIED',
        title: 'Secondary Phone Verified',
        message: 'Your secondary phone number has been verified successfully.',
        data: {
          secondaryPhone: res.locals.secondaryPhone,
          verifiedAt: new Date(),
        },
        channels: ['IN_APP', 'SMS'],
        priority: 'MEDIUM',
        metadata: {
          category: 'verification',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating secondary phone verified notification:', error);
    }
    next();
  }

  static async onIdentityVerificationRequested(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'IDENTITY_VERIFICATION_REQUESTED',
        title: 'Identity Verification Required',
        message: 'Please complete your identity verification to continue.',
        data: {
          requestedAt: new Date(),
          verificationType: res.locals.verificationType,
          requiredDocuments: res.locals.requiredDocuments,
          deadline: res.locals.deadline,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'verification',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating identity verification requested notification:', error);
    }
    next();
  }

  static async onIdentityVerificationApproved(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'IDENTITY_VERIFICATION_APPROVED',
        title: 'Identity Verified Successfully',
        message: 'Your identity has been verified. Welcome to full access!',
        data: {
          approvedAt: new Date(),
          verificationLevel: res.locals.verificationLevel,
          newFeatures: res.locals.newFeatures,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'verification',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating identity verification approved notification:', error);
    }
    next();
  }

  static async onIdentityVerificationRejected(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'IDENTITY_VERIFICATION_REJECTED',
        title: 'Identity Verification Failed',
        message: 'Your identity verification was not successful. Please try again.',
        data: {
          rejectedAt: new Date(),
          rejectionReason: res.locals.rejectionReason,
          retryInstructions: res.locals.retryInstructions,
          supportContact: res.locals.supportContact,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'verification',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating identity verification rejected notification:', error);
    }
    next();
  }

  static async onAccountAccessRevoked(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'ACCOUNT_ACCESS_REVOKED',
        title: 'Account Access Revoked',
        message: 'Your account access has been revoked due to security concerns.',
        data: {
          revokedAt: new Date(),
          reason: res.locals.revocationReason,
          appealProcess: res.locals.appealProcess,
          contactInfo: res.locals.supportContact,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'URGENT',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating account access revoked notification:', error);
    }
    next();
  }

  static async onPasswordStrengthWarning(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'PASSWORD_STRENGTH_WARNING',
        title: 'Weak Password Detected',
        message: 'Your password is weak. Please update it for better security.',
        data: {
          strengthScore: res.locals.strengthScore,
          recommendations: res.locals.recommendations,
          lastPasswordChange: user.passwordChangedAt,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating password strength warning notification:', error);
    }
    next();
  }

  static async onAccountMergeConfirmed(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'ACCOUNT_MERGE_CONFIRMED',
        title: 'Account Merge Completed',
        message: 'Your accounts have been successfully merged.',
        data: {
          mergedAt: new Date(),
          primaryAccount: user._id,
          mergedAccounts: res.locals.mergedAccounts,
          combinedData: res.locals.combinedData,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'account',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating account merge confirmed notification:', error);
    }
    next();
  }

  static async onSocialLoginConnected(req, res, next) {
    try {
      const user = res.locals.user;
      const provider = res.locals.provider;

      await notificationService.create({
        recipient: user._id,
        type: 'SOCIAL_LOGIN_CONNECTED',
        title: 'Social Login Connected',
        message: `Your ${provider} account has been connected successfully.`,
        data: {
          provider: provider,
          connectedAt: new Date(),
          providerUserId: res.locals.providerUserId,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'social',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating social login connected notification:', error);
    }
    next();
  }

  static async onSocialLoginDisconnected(req, res, next) {
    try {
      const user = res.locals.user;
      const provider = res.locals.provider;

      await notificationService.create({
        recipient: user._id,
        type: 'SOCIAL_LOGIN_DISCONNECTED',
        title: 'Social Login Disconnected',
        message: `Your ${provider} account has been disconnected.`,
        data: {
          provider: provider,
          disconnectedAt: new Date(),
          alternativeLoginMethods: res.locals.alternativeLoginMethods,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'social',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating social login disconnected notification:', error);
    }
    next();
  }

  // ==== SHOPPING NOTIFICATIONS (8) ====

  static async onCartAbandonment(req, res, next) {
    try {
      const user = res.locals.user;
      const cart = res.locals.cart;

      await notificationService.create({
        recipient: user._id,
        type: 'CART_ABANDONMENT',
        title: 'Don t Forget Your Cart!',
        message: `You have ${cart.items?.length || 0} item(s) waiting in your cart.`,
        data: {
          cartId: cart._id,
          itemCount: cart.items?.length || 0,
          totalAmount: cart.totalAmount,
          abandonedAt: new Date(),
          items: cart.items?.slice(0, 3), // First 3 items
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'shopping',
          relatedResource: cart._id,
          resourceModel: 'Cart',
          actionUrl: '/cart',
        },
      });
    } catch (error) {
      console.error('Error creating cart abandonment notification:', error);
    }
    next();
  }

  static async onWishlistReminder(req, res, next) {
    try {
      const user = res.locals.user;
      const wishlist = res.locals.wishlist;

      await notificationService.create({
        recipient: user._id,
        type: 'WISHLIST_REMINDER',
        title: 'Items in Your Wishlist',
        message: `You have ${wishlist.items?.length || 0} item(s) in your wishlist.`,
        data: {
          wishlistId: wishlist._id,
          itemCount: wishlist.items?.length || 0,
          items: wishlist.items?.slice(0, 3), // First 3 items
          reminderType: res.locals.reminderType || 'periodic',
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'wishlist',
          relatedResource: wishlist._id,
          resourceModel: 'Wishlist',
          actionUrl: '/wishlist',
        },
      });
    } catch (error) {
      console.error('Error creating wishlist reminder notification:', error);
    }
    next();
  }

  static async onWishlistBackInStock(req, res, next) {
    try {
      const product = res.locals.product;
      const users = res.locals.interestedUsers || [];

      for (const user of users) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'WISHLIST_BACK_IN_STOCK',
          title: 'Item Back in Stock!',
          message: `Great news! "${product.name}" is back in stock.`,
          data: {
            productId: product._id,
            productName: product.name,
            currentStock: product.stock,
            price: product.price,
            currency: product.currency || 'USD',
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'wishlist',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating wishlist back in stock notification:', error);
    }
    next();
  }

  static async onWishlistPriceDrop(req, res, next) {
    try {
      const product = res.locals.product;
      const users = res.locals.interestedUsers || [];
      const oldPrice = res.locals.oldPrice;
      const discountPercentage = res.locals.discountPercentage;

      for (const user of users) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'WISHLIST_PRICE_DROP',
          title: 'Price Drop Alert!',
          message: `"${product.name}" is now ${discountPercentage}% off!`,
          data: {
            productId: product._id,
            productName: product.name,
            oldPrice: oldPrice,
            newPrice: product.price,
            discountPercentage: discountPercentage,
            savings: oldPrice - product.price,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'wishlist',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating wishlist price drop notification:', error);
    }
    next();
  }

  static async onSavedForLaterReminder(req, res, next) {
    try {
      const user = res.locals.user;
      const savedItems = res.locals.savedItems;

      await notificationService.create({
        recipient: user._id,
        type: 'SAVED_FOR_LATER_REMINDER',
        title: 'Saved Items Reminder',
        message: `You have ${savedItems?.length || 0} item(s) saved for later.`,
        data: {
          itemCount: savedItems?.length || 0,
          items: savedItems?.slice(0, 3), // First 3 items
          totalValue: res.locals.totalValue,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'shopping',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/saved-items',
        },
      });
    } catch (error) {
      console.error('Error creating saved for later reminder notification:', error);
    }
    next();
  }

  static async onCartItemPriceChanged(req, res, next) {
    try {
      const user = res.locals.user;
      const item = res.locals.item;

      await notificationService.create({
        recipient: user._id,
        type: 'CART_ITEM_PRICE_CHANGED',
        title: 'Cart Item Price Updated',
        message: `The price of "${item.productName}" in your cart has changed.`,
        data: {
          productId: item.productId,
          productName: item.productName,
          oldPrice: item.oldPrice,
          newPrice: item.newPrice,
          priceChange: item.newPrice - item.oldPrice,
        },
        channels: ['IN_APP'],
        priority: 'MEDIUM',
        metadata: {
          category: 'shopping',
          relatedResource: item.productId,
          resourceModel: 'Product',
          actionUrl: '/cart',
        },
      });
    } catch (error) {
      console.error('Error creating cart item price changed notification:', error);
    }
    next();
  }

  static async onWishlistItemDiscontinued(req, res, next) {
    try {
      const product = res.locals.product;
      const users = res.locals.interestedUsers || [];

      for (const user of users) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'WISHLIST_ITEM_DISCONTINUED',
          title: 'Item Discontinued',
          message: `"${product.name}" from your wishlist has been discontinued.`,
          data: {
            productId: product._id,
            productName: product.name,
            discontinuedAt: new Date(),
            alternatives: res.locals.alternatives || [],
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'wishlist',
            relatedResource: product._id,
            resourceModel: 'Product',
          },
        });
      }
    } catch (error) {
      console.error('Error creating wishlist item discontinued notification:', error);
    }
    next();
  }

  static async onCartExpiryNotification(req, res, next) {
    try {
      const user = res.locals.user;
      const cart = res.locals.cart;

      await notificationService.create({
        recipient: user._id,
        type: 'CART_EXPIRY_NOTIFICATION',
        title: 'Cart Expiring Soon',
        message: `Your cart will expire in ${res.locals.hoursUntilExpiry || 24} hours.`,
        data: {
          cartId: cart._id,
          expiresAt: res.locals.expiresAt,
          itemCount: cart.items?.length || 0,
          totalAmount: cart.totalAmount,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'shopping',
          relatedResource: cart._id,
          resourceModel: 'Cart',
          actionUrl: '/cart',
        },
      });
    } catch (error) {
      console.error('Error creating cart expiry notification:', error);
    }
    next();
  }

  // ==== ORDER-RELATED NOTIFICATIONS ====

  // ==== ORDER NOTIFICATIONS (16) ====

  static async onOrderUpdated(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_UPDATED',
        title: 'Order Updated',
        message: `Your order #${order.orderNumber} has been updated.`,
        data: {
          orderId: order.orderNumber,
          updateType: res.locals.updateType || 'general',
          changes: res.locals.changes,
          updatedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'order',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating order updated notification:', error);
    }
    next();
  }

  static async onOrderCancelledByAdmin(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_CANCELLED_BY_ADMIN',
        title: 'Order Cancelled',
        message: `Your order #${order.orderNumber} has been cancelled by our team.`,
        data: {
          orderId: order.orderNumber,
          cancelledAt: new Date(),
          reason: res.locals.cancellationReason,
          refundAmount: res.locals.refundAmount,
          refundTimeline: res.locals.refundTimeline,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'order',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating order cancelled by admin notification:', error);
    }
    next();
  }

  static async onOrderPaymentPending(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_PAYMENT_PENDING',
        title: 'Payment Pending',
        message: `Payment for order #${order.orderNumber} is pending verification.`,
        data: {
          orderId: order.orderNumber,
          amount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          pendingSince: new Date(),
          expectedResolution: res.locals.expectedResolution,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'payment',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/payment`,
        },
      });
    } catch (error) {
      console.error('Error creating order payment pending notification:', error);
    }
    next();
  }

  static async onOrderPaymentFailed(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_PAYMENT_FAILED',
        title: 'Payment Failed',
        message: `Payment for order #${order.orderNumber} has failed.`,
        data: {
          orderId: order.orderNumber,
          amount: order.totalAmount,
          failureReason: res.locals.failureReason,
          failedAt: new Date(),
          retryOptions: res.locals.retryOptions,
        },
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        priority: 'URGENT',
        metadata: {
          category: 'payment',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/payment-retry`,
        },
      });
    } catch (error) {
      console.error('Error creating order payment failed notification:', error);
    }
    next();
  }

  static async onOrderPaymentSuccess(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_PAYMENT_SUCCESS',
        title: 'Payment Successful',
        message: `Payment for order #${order.orderNumber} has been processed successfully.`,
        data: {
          orderId: order.orderNumber,
          amount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          transactionId: res.locals.transactionId,
          paidAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'payment',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating order payment success notification:', error);
    }
    next();
  }

  static async onOrderReviewed(req, res, next) {
    try {
      const order = res.locals.order;
      const review = res.locals.review;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_REVIEWED',
        title: 'Thank You for Your Review',
        message: `Thank you for reviewing order #${order.orderNumber}!`,
        data: {
          orderId: order.orderNumber,
          reviewId: review._id,
          rating: review.rating,
          reviewedAt: new Date(),
          loyaltyPoints: res.locals.loyaltyPointsEarned,
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'review',
          relatedResource: review._id,
          resourceModel: 'Review',
          actionUrl: `/orders/${order._id}/review`,
        },
      });
    } catch (error) {
      console.error('Error creating order reviewed notification:', error);
    }
    next();
  }

  static async onOrderDisputed(req, res, next) {
    try {
      const order = res.locals.order;
      const dispute = res.locals.dispute;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_DISPUTED',
        title: 'Order Dispute Filed',
        message: `Your dispute for order #${order.orderNumber} has been filed.`,
        data: {
          orderId: order.orderNumber,
          disputeId: dispute._id,
          disputeReason: dispute.reason,
          filedAt: new Date(),
          expectedResolution: res.locals.expectedResolution,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'dispute',
          relatedResource: dispute._id,
          resourceModel: 'Dispute',
          actionUrl: `/orders/${order._id}/dispute`,
        },
      });
    } catch (error) {
      console.error('Error creating order disputed notification:', error);
    }
    next();
  }

  static async onOrderPartiallyShipped(req, res, next) {
    try {
      const order = res.locals.order;
      const shipment = res.locals.shipment;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_PARTIALLY_SHIPPED',
        title: 'Partial Shipment',
        message: `Part of your order #${order.orderNumber} has been shipped.`,
        data: {
          orderId: order.orderNumber,
          shippedItems: shipment.items,
          trackingNumber: shipment.trackingNumber,
          carrier: shipment.carrier,
          remainingItems: res.locals.remainingItems,
          estimatedDelivery: shipment.estimatedDelivery,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'shipping',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/track`,
        },
      });
    } catch (error) {
      console.error('Error creating order partially shipped notification:', error);
    }
    next();
  }

  static async onOrderPartiallyReturned(req, res, next) {
    try {
      const order = res.locals.order;
      const returnRequest = res.locals.returnRequest;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_PARTIALLY_RETURNED',
        title: 'Partial Return Processed',
        message: `Part of your order #${order.orderNumber} has been returned.`,
        data: {
          orderId: order.orderNumber,
          returnId: returnRequest._id,
          returnedItems: returnRequest.items,
          refundAmount: res.locals.refundAmount,
          processedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'return',
          relatedResource: returnRequest._id,
          resourceModel: 'Return',
          actionUrl: `/orders/${order._id}/returns`,
        },
      });
    } catch (error) {
      console.error('Error creating order partially returned notification:', error);
    }
    next();
  }

  static async onPreOrderConfirmed(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'PRE_ORDER_CONFIRMED',
        title: 'Pre-Order Confirmed',
        message: `Your pre-order #${order.orderNumber} has been confirmed!`,
        data: {
          orderId: order.orderNumber,
          productName: order.items[0]?.productName,
          expectedReleaseDate: res.locals.expectedReleaseDate,
          totalAmount: order.totalAmount,
          preOrderNumber: res.locals.preOrderNumber,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'pre-order',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating pre-order confirmed notification:', error);
    }
    next();
  }

  static async onPreOrderShipped(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'PRE_ORDER_SHIPPED',
        title: 'Pre-Order Shipped!',
        message: `Your pre-order #${order.orderNumber} has been shipped!`,
        data: {
          orderId: order.orderNumber,
          trackingNumber: res.locals.trackingNumber,
          carrier: res.locals.carrier,
          estimatedDelivery: res.locals.estimatedDelivery,
          shippedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        priority: 'HIGH',
        metadata: {
          category: 'pre-order',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/track`,
        },
      });
    } catch (error) {
      console.error('Error creating pre-order shipped notification:', error);
    }
    next();
  }

  static async onDigitalDownloadReady(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'DIGITAL_DOWNLOAD_READY',
        title: 'Digital Download Ready',
        message: `Your digital purchase is ready for download!`,
        data: {
          orderId: order.orderNumber,
          productName: order.items[0]?.productName,
          downloadLinks: res.locals.downloadLinks,
          licenseKey: res.locals.licenseKey,
          validUntil: res.locals.downloadExpiry,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'digital',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/downloads`,
        },
      });
    } catch (error) {
      console.error('Error creating digital download ready notification:', error);
    }
    next();
  }

  static async onCustomOrderConfirmed(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'CUSTOM_ORDER_CONFIRMED',
        title: 'Custom Order Confirmed',
        message: `Your custom order #${order.orderNumber} has been confirmed!`,
        data: {
          orderId: order.orderNumber,
          customSpecs: res.locals.customSpecs,
          estimatedCompletionTime: res.locals.estimatedCompletionTime,
          totalAmount: order.totalAmount,
          designApprovalRequired: res.locals.designApprovalRequired,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'custom-order',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating custom order confirmed notification:', error);
    }
    next();
  }

  static async onOrderModificationRequested(req, res, next) {
    try {
      const order = res.locals.order;
      const modification = res.locals.modification;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_MODIFICATION_REQUESTED',
        title: 'Order Modification Requested',
        message: `Your request to modify order #${order.orderNumber} has been received.`,
        data: {
          orderId: order.orderNumber,
          modificationId: modification._id,
          requestedChanges: modification.requestedChanges,
          requestedAt: new Date(),
          status: 'pending',
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'order-modification',
          relatedResource: modification._id,
          resourceModel: 'OrderModification',
          actionUrl: `/orders/${order._id}/modifications`,
        },
      });
    } catch (error) {
      console.error('Error creating order modification requested notification:', error);
    }
    next();
  }

  static async onOrderModificationApproved(req, res, next) {
    try {
      const order = res.locals.order;
      const modification = res.locals.modification;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_MODIFICATION_APPROVED',
        title: 'Order Modification Approved',
        message: `Your modification request for order #${order.orderNumber} has been approved.`,
        data: {
          orderId: order.orderNumber,
          modificationId: modification._id,
          approvedChanges: modification.approvedChanges,
          priceDifference: modification.priceDifference,
          approvedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'order-modification',
          relatedResource: modification._id,
          resourceModel: 'OrderModification',
          actionUrl: `/orders/${order._id}/modifications`,
        },
      });
    } catch (error) {
      console.error('Error creating order modification approved notification:', error);
    }
    next();
  }

  static async onOrderModificationRejected(req, res, next) {
    try {
      const order = res.locals.order;
      const modification = res.locals.modification;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_MODIFICATION_REJECTED',
        title: 'Order Modification Rejected',
        message: `Your modification request for order #${order.orderNumber} could not be approved.`,
        data: {
          orderId: order.orderNumber,
          modificationId: modification._id,
          rejectionReason: modification.rejectionReason,
          rejectedAt: new Date(),
          alternativeOptions: res.locals.alternativeOptions,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'order-modification',
          relatedResource: modification._id,
          resourceModel: 'OrderModification',
          actionUrl: `/orders/${order._id}/modifications`,
        },
      });
    } catch (error) {
      console.error('Error creating order modification rejected notification:', error);
    }
    next();
  }

  static async onOrderCreate(req, res, next) {
    try {
      const order = res.locals.createdOrder;

      // Notify customer
      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_CREATED',
        title: 'Order Confirmed',
        message: `Your order #${order.orderNumber} has been placed successfully.`,
        data: {
          orderId: order.orderNumber,
          amount: order.totalAmount,
          items: order.items.length,
        },
        priority: 'HIGH',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'order',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}`,
        },
      });

      // Notify staff
      const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const member of staff) {
        await notificationService.create({
          recipient: member._id,
          type: 'ORDER_CREATED',
          title: 'New Order Received',
          message: `Order #${order.orderNumber} placed for $${order.totalAmount}`,
          data: {
            orderId: order.orderNumber,
            customerId: order.customer,
            amount: order.totalAmount,
          },
          priority: 'HIGH',
          channels: ['IN_APP'],
          metadata: {
            category: 'staff',
            relatedResource: order._id,
            resourceModel: 'Order',
            actionUrl: `/admin/orders/${order._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating order notification:', error);
    }
    next();
  }

  static async onOrderUpdate(req, res, next) {
    try {
      const order = res.locals.updatedOrder;
      const previousStatus = res.locals.previousStatus;

      // Only notify on status changes
      if (order.status !== previousStatus) {
        let notificationType = 'ORDER_UPDATED';
        let title = 'Order Updated';
        let message = `Your order #${order.orderNumber} has been updated`;

        // Specific status notifications
        if (order.status === 'SHIPPED') {
          notificationType = 'ORDER_SHIPPED';
          title = 'Order Shipped';
          message = `Your order #${order.orderNumber} has been shipped`;
        } else if (order.status === 'DELIVERED') {
          notificationType = 'ORDER_DELIVERED';
          title = 'Order Delivered';
          message = `Your order #${order.orderNumber} has been delivered`;
        }

        await notificationService.create({
          recipient: order.customer,
          type: notificationType,
          title: title,
          message: message,
          data: {
            orderId: order.orderNumber,
            status: order.status,
            previousStatus: previousStatus,
            trackingNumber: order.trackingNumber,
          },
          priority: 'HIGH',
          channels: ['IN_APP', 'EMAIL'],
          metadata: {
            category: 'order',
            relatedResource: order._id,
            resourceModel: 'Order',
            actionUrl: `/orders/${order._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating order update notification:', error);
    }
    next();
  }

  static async onOrderShipped(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_SHIPPED',
        title: 'Order Shipped',
        message: `Great news! Your order #${order.orderNumber} has been shipped.`,
        data: {
          orderId: order.orderNumber,
          trackingNumber: order.trackingNumber,
          carrier: order.carrier,
          estimatedDelivery: order.estimatedDelivery,
        },
        priority: 'HIGH',
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        metadata: {
          category: 'shipping',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/track`,
        },
      });
    } catch (error) {
      console.error('Error creating order shipped notification:', error);
    }
    next();
  }

  static async onOrderDelivered(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_DELIVERED',
        title: 'Order Delivered',
        message: `Your order #${order.orderNumber} has been delivered successfully!`,
        data: {
          orderId: order.orderNumber,
          deliveredAt: new Date(),
          deliveryLocation: res.locals.deliveryLocation,
        },
        priority: 'HIGH',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'delivery',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/review`,
        },
      });
    } catch (error) {
      console.error('Error creating order delivered notification:', error);
    }
    next();
  }

  static async onOrderCancelled(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_CANCELLED',
        title: 'Order Cancelled',
        message: `Your order #${order.orderNumber} has been cancelled.`,
        data: {
          orderId: order.orderNumber,
          cancelReason: res.locals.cancelReason,
          refundAmount: res.locals.refundAmount,
          cancelledAt: new Date(),
        },
        priority: 'HIGH',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'cancellation',
          relatedResource: order._id,
          resourceModel: 'Order',
        },
      });
    } catch (error) {
      console.error('Error creating order cancelled notification:', error);
    }
    next();
  }

  static async onOrderReturned(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_RETURNED',
        title: 'Order Return Processed',
        message: `Your return request for order #${order.orderNumber} has been processed.`,
        data: {
          orderId: order.orderNumber,
          returnReason: res.locals.returnReason,
          refundAmount: res.locals.refundAmount,
          returnedAt: new Date(),
        },
        priority: 'MEDIUM',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'return',
          relatedResource: order._id,
          resourceModel: 'Order',
        },
      });
    } catch (error) {
      console.error('Error creating order returned notification:', error);
    }
    next();
  }

  static async onOrderRefunded(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_REFUNDED',
        title: 'Refund Processed',
        message: `Your refund for order #${order.orderNumber} has been processed.`,
        data: {
          orderId: order.orderNumber,
          refundAmount: res.locals.refundAmount,
          refundMethod: res.locals.refundMethod,
          refundedAt: new Date(),
        },
        priority: 'HIGH',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'refund',
          relatedResource: order._id,
          resourceModel: 'Order',
        },
      });
    } catch (error) {
      console.error('Error creating order refunded notification:', error);
    }
    next();
  }

  static async onOrderDelayed(req, res, next) {
    try {
      const order = res.locals.order;

      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_DELAYED',
        title: 'Order Delayed',
        message: `We apologize, but your order #${order.orderNumber} has been delayed.`,
        data: {
          orderId: order.orderNumber,
          delayReason: res.locals.delayReason,
          newEstimatedDelivery: res.locals.newEstimatedDelivery,
        },
        priority: 'MEDIUM',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'delay',
          relatedResource: order._id,
          resourceModel: 'Order',
        },
      });
    } catch (error) {
      console.error('Error creating order delayed notification:', error);
    }
    next();
  }
  // ==== RETURN NOTIFICATIONS (8) ====

  static async onReturnRequestReceived(req, res, next) {
    try {
      const returnRequest = res.locals.returnRequest;

      await notificationService.create({
        recipient: returnRequest.customer,
        type: 'RETURN_REQUEST_RECEIVED',
        title: 'Return Request Received',
        message: `We've received your return request #${returnRequest.returnNumber}.`,
        data: {
          returnId: returnRequest.returnNumber,
          orderId: returnRequest.orderId,
          items: returnRequest.items,
          reason: returnRequest.reason,
          requestedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'return',
          relatedResource: returnRequest._id,
          resourceModel: 'Return',
          actionUrl: `/returns/${returnRequest._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating return request received notification:', error);
    }
    next();
  }

  static async onReturnApproved(req, res, next) {
    try {
      const returnRequest = res.locals.returnRequest;

      await notificationService.create({
        recipient: returnRequest.customer,
        type: 'RETURN_APPROVED',
        title: 'Return Approved',
        message: `Your return request #${returnRequest.returnNumber} has been approved.`,
        data: {
          returnId: returnRequest.returnNumber,
          approvedAt: new Date(),
          returnInstructions: res.locals.returnInstructions,
          shippingLabel: res.locals.shippingLabel,
          refundAmount: res.locals.refundAmount,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'return',
          relatedResource: returnRequest._id,
          resourceModel: 'Return',
          actionUrl: `/returns/${returnRequest._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating return approved notification:', error);
    }
    next();
  }

  static async onReturnRejected(req, res, next) {
    try {
      const returnRequest = res.locals.returnRequest;

      await notificationService.create({
        recipient: returnRequest.customer,
        type: 'RETURN_REJECTED',
        title: 'Return Request Rejected',
        message: `Your return request #${returnRequest.returnNumber} has been rejected.`,
        data: {
          returnId: returnRequest.returnNumber,
          rejectionReason: res.locals.rejectionReason,
          rejectedAt: new Date(),
          appealProcess: res.locals.appealProcess,
          supportContact: res.locals.supportContact,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'return',
          relatedResource: returnRequest._id,
          resourceModel: 'Return',
          actionUrl: `/returns/${returnRequest._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating return rejected notification:', error);
    }
    next();
  }

  static async onRefundProcessed(req, res, next) {
    try {
      const refund = res.locals.refund;

      await notificationService.create({
        recipient: refund.customer,
        type: 'REFUND_PROCESSED',
        title: 'Refund Processed',
        message: `Your refund of $${refund.amount} has been processed.`,
        data: {
          refundId: refund._id,
          amount: refund.amount,
          refundMethod: refund.method,
          processedAt: new Date(),
          expectedInAccount: res.locals.expectedInAccount,
          transactionId: refund.transactionId,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'refund',
          relatedResource: refund._id,
          resourceModel: 'Refund',
        },
      });
    } catch (error) {
      console.error('Error creating refund processed notification:', error);
    }
    next();
  }

  static async onExchangeApproved(req, res, next) {
    try {
      const exchange = res.locals.exchange;

      await notificationService.create({
        recipient: exchange.customer,
        type: 'EXCHANGE_APPROVED',
        title: 'Exchange Approved',
        message: `Your exchange request #${exchange.exchangeNumber} has been approved.`,
        data: {
          exchangeId: exchange.exchangeNumber,
          originalItem: exchange.originalItem,
          newItem: exchange.newItem,
          priceDifference: exchange.priceDifference,
          approvedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'exchange',
          relatedResource: exchange._id,
          resourceModel: 'Exchange',
          actionUrl: `/exchanges/${exchange._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating exchange approved notification:', error);
    }
    next();
  }

  static async onExchangeRejected(req, res, next) {
    try {
      const exchange = res.locals.exchange;

      await notificationService.create({
        recipient: exchange.customer,
        type: 'EXCHANGE_REJECTED',
        title: 'Exchange Request Rejected',
        message: `Your exchange request #${exchange.exchangeNumber} has been rejected.`,
        data: {
          exchangeId: exchange.exchangeNumber,
          rejectionReason: res.locals.rejectionReason,
          rejectedAt: new Date(),
          alternativeOptions: res.locals.alternativeOptions,
          supportContact: res.locals.supportContact,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'exchange',
          relatedResource: exchange._id,
          resourceModel: 'Exchange',
          actionUrl: `/exchanges/${exchange._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating exchange rejected notification:', error);
    }
    next();
  }

  static async onReturnShipmentReceived(req, res, next) {
    try {
      const returnRequest = res.locals.returnRequest;

      await notificationService.create({
        recipient: returnRequest.customer,
        type: 'RETURN_SHIPMENT_RECEIVED',
        title: 'Return Shipment Received',
        message: `We've received your return shipment for request #${returnRequest.returnNumber}.`,
        data: {
          returnId: returnRequest.returnNumber,
          receivedAt: new Date(),
          inspectionStatus: res.locals.inspectionStatus || 'pending',
          refundTimeline: res.locals.refundTimeline,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'return',
          relatedResource: returnRequest._id,
          resourceModel: 'Return',
          actionUrl: `/returns/${returnRequest._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating return shipment received notification:', error);
    }
    next();
  }

  static async onPartialRefundProcessed(req, res, next) {
    try {
      const refund = res.locals.refund;

      await notificationService.create({
        recipient: refund.customer,
        type: 'PARTIAL_REFUND_PROCESSED',
        title: 'Partial Refund Processed',
        message: `A partial refund of $${refund.amount} has been processed.`,
        data: {
          refundId: refund._id,
          partialAmount: refund.amount,
          totalRefundAmount: res.locals.totalRefundAmount,
          remainingAmount: res.locals.remainingAmount,
          reason: res.locals.partialRefundReason,
          processedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'refund',
          relatedResource: refund._id,
          resourceModel: 'Refund',
        },
      });
    } catch (error) {
      console.error('Error creating partial refund processed notification:', error);
    }
    next();
  }

  // ==== PAYMENT NOTIFICATIONS (15) ====

  static async onInvoiceGenerated(req, res, next) {
    try {
      const invoice = res.locals.invoice;

      await notificationService.create({
        recipient: invoice.customer,
        type: 'INVOICE_GENERATED',
        title: 'Invoice Generated',
        message: `Invoice #${invoice.invoiceNumber} has been generated.`,
        data: {
          invoiceId: invoice.invoiceNumber,
          amount: invoice.totalAmount,
          dueDate: invoice.dueDate,
          downloadLink: res.locals.downloadLink,
          generatedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'invoice',
          relatedResource: invoice._id,
          resourceModel: 'Invoice',
          actionUrl: `/invoices/${invoice._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating invoice generated notification:', error);
    }
    next();
  }

  static async onInvoicePaid(req, res, next) {
    try {
      const invoice = res.locals.invoice;

      await notificationService.create({
        recipient: invoice.customer,
        type: 'INVOICE_PAID',
        title: 'Invoice Paid',
        message: `Invoice #${invoice.invoiceNumber} has been paid successfully.`,
        data: {
          invoiceId: invoice.invoiceNumber,
          amount: invoice.totalAmount,
          paidAt: new Date(),
          paymentMethod: res.locals.paymentMethod,
          receiptLink: res.locals.receiptLink,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'invoice',
          relatedResource: invoice._id,
          resourceModel: 'Invoice',
          actionUrl: `/invoices/${invoice._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating invoice paid notification:', error);
    }
    next();
  }

  static async onInvoiceOverdue(req, res, next) {
    try {
      const invoice = res.locals.invoice;

      await notificationService.create({
        recipient: invoice.customer,
        type: 'INVOICE_OVERDUE',
        title: 'Invoice Overdue',
        message: `Invoice #${invoice.invoiceNumber} is now overdue.`,
        data: {
          invoiceId: invoice.invoiceNumber,
          amount: invoice.totalAmount,
          originalDueDate: invoice.dueDate,
          overdueDays: res.locals.overdueDays,
          lateFee: res.locals.lateFee,
          paymentLink: res.locals.paymentLink,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'invoice',
          relatedResource: invoice._id,
          resourceModel: 'Invoice',
          actionUrl: `/invoices/${invoice._id}/pay`,
        },
      });
    } catch (error) {
      console.error('Error creating invoice overdue notification:', error);
    }
    next();
  }

  static async onChargebackInitiated(req, res, next) {
    try {
      const chargeback = res.locals.chargeback;

      await notificationService.create({
        recipient: chargeback.customer,
        type: 'CHARGEBACK_INITIATED',
        title: 'Chargeback Initiated',
        message: `A chargeback has been initiated for transaction ${chargeback.transactionId}.`,
        data: {
          chargebackId: chargeback._id,
          transactionId: chargeback.transactionId,
          amount: chargeback.amount,
          reason: chargeback.reason,
          initiatedAt: new Date(),
          disputeProcess: res.locals.disputeProcess,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'chargeback',
          relatedResource: chargeback._id,
          resourceModel: 'Chargeback',
        },
      });
    } catch (error) {
      console.error('Error creating chargeback initiated notification:', error);
    }
    next();
  }

  static async onChargebackResolved(req, res, next) {
    try {
      const chargeback = res.locals.chargeback;

      await notificationService.create({
        recipient: chargeback.customer,
        type: 'CHARGEBACK_RESOLVED',
        title: 'Chargeback Resolved',
        message: `The chargeback for transaction ${chargeback.transactionId} has been resolved.`,
        data: {
          chargebackId: chargeback._id,
          transactionId: chargeback.transactionId,
          resolution: chargeback.resolution,
          resolvedAt: new Date(),
          outcome: res.locals.outcome,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'chargeback',
          relatedResource: chargeback._id,
          resourceModel: 'Chargeback',
        },
      });
    } catch (error) {
      console.error('Error creating chargeback resolved notification:', error);
    }
    next();
  }

  static async onPaymentMethodExpiring(req, res, next) {
    try {
      const user = res.locals.user;
      const paymentMethod = res.locals.paymentMethod;

      await notificationService.create({
        recipient: user._id,
        type: 'PAYMENT_METHOD_EXPIRING',
        title: 'Payment Method Expiring',
        message: `Your payment method ending in ${paymentMethod.lastFourDigits} expires soon.`,
        data: {
          cardType: paymentMethod.cardType,
          lastFourDigits: paymentMethod.lastFourDigits,
          expiryDate: paymentMethod.expiryDate,
          daysUntilExpiry: res.locals.daysUntilExpiry,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'payment',
          relatedResource: paymentMethod._id,
          resourceModel: 'PaymentMethod',
          actionUrl: '/account/payment-methods',
        },
      });
    } catch (error) {
      console.error('Error creating payment method expiring notification:', error);
    }
    next();
  }

  static async onSubscriptionPaused(req, res, next) {
    try {
      const subscription = res.locals.subscription;

      await notificationService.create({
        recipient: subscription.customer,
        type: 'SUBSCRIPTION_PAUSED',
        title: 'Subscription Paused',
        message: `Your ${subscription.planName} subscription has been paused.`,
        data: {
          subscriptionId: subscription._id,
          planName: subscription.planName,
          pausedAt: new Date(),
          reason: res.locals.pauseReason,
          resumeOptions: res.locals.resumeOptions,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'subscription',
          relatedResource: subscription._id,
          resourceModel: 'Subscription',
          actionUrl: `/subscriptions/${subscription._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating subscription paused notification:', error);
    }
    next();
  }

  static async onGiftCardPurchased(req, res, next) {
    try {
      const giftCard = res.locals.giftCard;
      const purchaser = res.locals.purchaser;

      await notificationService.create({
        recipient: purchaser._id,
        type: 'GIFT_CARD_PURCHASED',
        title: 'Gift Card Purchased',
        message: `Your gift card worth $${giftCard.amount} has been created successfully.`,
        data: {
          giftCardId: giftCard._id,
          amount: giftCard.amount,
          recipientEmail: giftCard.recipientEmail,
          message: giftCard.message,
          deliveryDate: giftCard.deliveryDate,
          giftCardCode: giftCard.code,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'gift-card',
          relatedResource: giftCard._id,
          resourceModel: 'GiftCard',
        },
      });
    } catch (error) {
      console.error('Error creating gift card purchased notification:', error);
    }
    next();
  }

  static async onGiftCardRedeemed(req, res, next) {
    try {
      const giftCard = res.locals.giftCard;
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'GIFT_CARD_REDEEMED',
        title: 'Gift Card Redeemed',
        message: `You've successfully redeemed a gift card worth $${res.locals.redeemedAmount}.`,
        data: {
          giftCardCode: giftCard.code,
          redeemedAmount: res.locals.redeemedAmount,
          remainingBalance: res.locals.remainingBalance,
          redeemedAt: new Date(),
          orderId: res.locals.orderId,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'gift-card',
          relatedResource: giftCard._id,
          resourceModel: 'GiftCard',
        },
      });
    } catch (error) {
      console.error('Error creating gift card redeemed notification:', error);
    }
    next();
  }

  static async onStoreCreditAdded(req, res, next) {
    try {
      const user = res.locals.user;
      const creditAmount = res.locals.creditAmount;

      await notificationService.create({
        recipient: user._id,
        type: 'STORE_CREDIT_ADDED',
        title: 'Store Credit Added',
        message: `$${creditAmount} has been added to your account as store credit.`,
        data: {
          amount: creditAmount,
          reason: res.locals.creditReason,
          totalBalance: res.locals.totalBalance,
          expiryDate: res.locals.expiryDate,
          addedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'store-credit',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/account/credits',
        },
      });
    } catch (error) {
      console.error('Error creating store credit added notification:', error);
    }
    next();
  }

  static async onStoreCreditUsed(req, res, next) {
    try {
      const user = res.locals.user;
      const usedAmount = res.locals.usedAmount;

      await notificationService.create({
        recipient: user._id,
        type: 'STORE_CREDIT_USED',
        title: 'Store Credit Applied',
        message: `$${usedAmount} store credit has been applied to your order.`,
        data: {
          usedAmount: usedAmount,
          remainingBalance: res.locals.remainingBalance,
          orderId: res.locals.orderId,
          usedAt: new Date(),
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'store-credit',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/account/credits',
        },
      });
    } catch (error) {
      console.error('Error creating store credit used notification:', error);
    }
    next();
  }

  static async onEmiPaymentReminder(req, res, next) {
    try {
      const user = res.locals.user;
      const emiDetails = res.locals.emiDetails;

      await notificationService.create({
        recipient: user._id,
        type: 'EMI_PAYMENT_REMINDER',
        title: 'EMI Payment Due',
        message: `Your EMI payment of $${emiDetails.amount} is due on ${emiDetails.dueDate}.`,
        data: {
          emiId: emiDetails._id,
          amount: emiDetails.amount,
          dueDate: emiDetails.dueDate,
          installmentNumber: emiDetails.installmentNumber,
          totalInstallments: emiDetails.totalInstallments,
          paymentLink: res.locals.paymentLink,
        },
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        priority: 'HIGH',
        metadata: {
          category: 'emi',
          relatedResource: emiDetails._id,
          resourceModel: 'EMI',
          actionUrl: `/account/emi/${emiDetails._id}/pay`,
        },
      });
    } catch (error) {
      console.error('Error creating EMI payment reminder notification:', error);
    }
    next();
  }

  static async onPaymentDisputeInitiated(req, res, next) {
    try {
      const dispute = res.locals.dispute;

      await notificationService.create({
        recipient: dispute.customer,
        type: 'PAYMENT_DISPUTE_INITIATED',
        title: 'Payment Dispute Initiated',
        message: `Your payment dispute for transaction ${dispute.transactionId} has been initiated.`,
        data: {
          disputeId: dispute._id,
          transactionId: dispute.transactionId,
          amount: dispute.amount,
          reason: dispute.reason,
          initiatedAt: new Date(),
          expectedResolution: res.locals.expectedResolution,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'dispute',
          relatedResource: dispute._id,
          resourceModel: 'PaymentDispute',
        },
      });
    } catch (error) {
      console.error('Error creating payment dispute initiated notification:', error);
    }
    next();
  }

  static async onPaymentDisputeResolved(req, res, next) {
    try {
      const dispute = res.locals.dispute;

      await notificationService.create({
        recipient: dispute.customer,
        type: 'PAYMENT_DISPUTE_RESOLVED',
        title: 'Payment Dispute Resolved',
        message: `Your payment dispute for transaction ${dispute.transactionId} has been resolved.`,
        data: {
          disputeId: dispute._id,
          transactionId: dispute.transactionId,
          resolution: dispute.resolution,
          outcome: res.locals.outcome,
          resolvedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'dispute',
          relatedResource: dispute._id,
          resourceModel: 'PaymentDispute',
        },
      });
    } catch (error) {
      console.error('Error creating payment dispute resolved notification:', error);
    }
    next();
  }

  static async onPaymentMethodUpdated(req, res, next) {
    try {
      const user = res.locals.user;
      const paymentMethod = res.locals.paymentMethod;

      await notificationService.create({
        recipient: user._id,
        type: 'PAYMENT_METHOD_UPDATED',
        title: 'Payment Method Updated',
        message: `Your payment method has been updated successfully.`,
        data: {
          paymentMethodId: paymentMethod._id,
          cardType: paymentMethod.cardType,
          lastFourDigits: paymentMethod.lastFourDigits,
          updatedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'payment',
          relatedResource: paymentMethod._id,
          resourceModel: 'PaymentMethod',
          actionUrl: '/account/payment-methods',
        },
      });
    } catch (error) {
      console.error('Error creating payment method updated notification:', error);
    }
    next();
  }

  // ==== PAYMENT-RELATED NOTIFICATIONS ====

  static async onPaymentSuccess(req, res, next) {
    try {
      const payment = res.locals.payment;

      await notificationService.create({
        recipient: payment.user,
        type: 'PAYMENT_SUCCESS',
        title: 'Payment Successful',
        message: `Your payment of $${payment.amount} has been processed successfully.`,
        data: {
          amount: payment.amount,
          orderId: payment.orderId,
          paymentMethod: payment.method,
          transactionId: payment.transactionId,
        },
        priority: 'HIGH',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'payment',
          relatedResource: payment._id,
          resourceModel: 'Payment',
          actionUrl: `/orders/${payment.orderId}`,
        },
      });
    } catch (error) {
      console.error('Error creating payment success notification:', error);
    }
    next();
  }

  static async onPaymentFailed(req, res, next) {
    try {
      const payment = res.locals.payment;

      await notificationService.create({
        recipient: payment.user,
        type: 'PAYMENT_FAILED',
        title: 'Payment Failed',
        message: `Your payment of $${payment.amount} has failed. Please try again.`,
        data: {
          amount: payment.amount,
          orderId: payment.orderId,
          reason: payment.failureReason,
        },
        priority: 'URGENT',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'payment',
          relatedResource: payment._id,
          resourceModel: 'Payment',
          actionUrl: `/orders/${payment.orderId}/payment`,
        },
      });
    } catch (error) {
      console.error('Error creating payment failed notification:', error);
    }
    next();
  }

  static async onPaymentRefunded(req, res, next) {
    try {
      const payment = res.locals.payment;

      await notificationService.create({
        recipient: payment.user,
        type: 'PAYMENT_REFUNDED',
        title: 'Payment Refunded',
        message: `Your refund of $${payment.refundAmount} has been processed.`,
        data: {
          originalAmount: payment.amount,
          refundAmount: payment.refundAmount,
          orderId: payment.orderId,
          refundReason: res.locals.refundReason,
        },
        priority: 'HIGH',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'refund',
          relatedResource: payment._id,
          resourceModel: 'Payment',
        },
      });
    } catch (error) {
      console.error('Error creating payment refunded notification:', error);
    }
    next();
  }

  // ==== PRODUCT-RELATED NOTIFICATIONS ====

  static async onProductCreated(req, res, next) {
    try {
      const product = res.locals.createdProduct;

      // Notify admins/staff
      const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const member of admins) {
        await notificationService.create({
          recipient: member._id,
          type: 'PRODUCT_CREATED',
          title: 'New Product Added',
          message: `New product "${product.title}" has been added to the catalog.`,
          data: {
            productId: product._id,
            productName: product.title,
            category: product.category,
            price: product.basePrice,
          },
          priority: 'MEDIUM',
          channels: ['IN_APP'],
          metadata: {
            category: 'product',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/admin/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating product created notification:', error);
    }
    next();
  }
  static async onProductUpdated(req, res, next) {
    try {
      const product = res.locals.updateProduct;

      // Notify admins/staff
      const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const member of admins) {
        await notificationService.create({
          recipient: member._id,
          type: 'PRODUCT_UPDATE',
          title: 'Product Updated',
          message: `product "${product.name}" has been Update to the catalog.`,
          data: {
            productId: product._id,
            productName: product.name,
            category: product.category,
            price: product.price,
          },
          priority: 'MEDIUM',
          channels: ['IN_APP'],
          metadata: {
            category: 'product',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/admin/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating product created notification:', error);
    }
    next();
  }

  static async onProductOutOfStock(req, res, next) {
    try {
      const product = res.locals.product;

      // Notify users who have this product in wishlist
      const users = await User.find({ 'wishList.productId': product._id });

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'PRODUCT_OUT_OF_STOCK',
          title: 'Product Out of Stock',
          message: `"${product.name}" is currently out of stock.`,
          data: {
            productId: product._id,
            productName: product.name,
            category: product.category,
          },
          priority: 'MEDIUM',
          channels: ['IN_APP'],
          metadata: {
            category: 'inventory',
            relatedResource: product._id,
            resourceModel: 'Product',
          },
        });
      }
    } catch (error) {
      console.error('Error creating out of stock notification:', error);
    }
    next();
  }

  static async onProductBackInStock(req, res, next) {
    try {
      const product = res.locals.product;

      // Notify users who have this product in wishlist
      const users = await User.find({ 'wishList.productId': product._id });

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'PRODUCT_BACK_IN_STOCK',
          title: 'Product Back in Stock',
          message: `Great news! "${product.name}" is back in stock.`,
          data: {
            productId: product._id,
            productName: product.name,
            currentStock: product.stock,
            price: product.price,
          },
          priority: 'HIGH',
          channels: ['IN_APP', 'EMAIL'],
          metadata: {
            category: 'inventory',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating back in stock notification:', error);
    }
    next();
  }

  static async onProductDiscounted(req, res, next) {
    try {
      const product = res.locals.product;

      // Notify users who have this product in wishlist
      const users = await User.find({ 'wishList.productId': product._id });

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'PRODUCT_DISCOUNTED',
          title: 'Product on Sale',
          message: `"${product.name}" is now on sale with ${res.locals.discountPercentage}% off!`,
          data: {
            productId: product._id,
            productName: product.name,
            originalPrice: res.locals.originalPrice,
            salePrice: product.price,
            discountPercentage: res.locals.discountPercentage,
          },
          priority: 'HIGH',
          channels: ['IN_APP', 'EMAIL'],
          metadata: {
            category: 'promotion',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating product discounted notification:', error);
    }
    next();
  }

  // ==== SYSTEM NOTIFICATIONS ====

  static async onSystemAlert(req, res, next) {
    try {
      const alert = res.locals.systemAlert;

      // Notify all admins
      const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'SYSTEM_ALERT',
          title: 'System Alert',
          message: alert.message,
          data: {
            severity: alert.severity,
            component: alert.component,
            details: alert.details,
          },
          priority: 'URGENT',
          channels: ['IN_APP', 'EMAIL'],
          metadata: {
            category: 'system',
            relatedResource: alert._id,
            resourceModel: 'SystemAlert',
          },
        });
      }
    } catch (error) {
      console.error('Error creating system alert notification:', error);
    }
    next();
  }

  static async onMaintenanceScheduled(req, res, next) {
    try {
      const maintenance = res.locals.maintenance;

      // Notify all users
      const users = await User.find({ isActive: true });

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'MAINTENANCE_SCHEDULED',
          title: 'Scheduled Maintenance',
          message: `System maintenance is scheduled for ${maintenance.scheduledTime}.`,
          data: {
            scheduledTime: maintenance.scheduledTime,
            estimatedDuration: maintenance.estimatedDuration,
            affectedServices: maintenance.affectedServices,
          },
          priority: 'MEDIUM',
          channels: ['IN_APP', 'EMAIL'],
          metadata: {
            category: 'maintenance',
            relatedResource: maintenance._id,
            resourceModel: 'Maintenance',
          },
        });
      }
    } catch (error) {
      console.error('Error creating maintenance scheduled notification:', error);
    }
    next();
  }

  // ==== SUPPORT NOTIFICATIONS ====

  static async onTicketCreated(req, res, next) {
    try {
      const ticket = res.locals.createdTicket;

      // Notify customer
      await notificationService.create({
        recipient: ticket.customerId,
        type: 'TICKET_CREATED',
        title: 'Support Ticket Created',
        message: `Your support ticket #${ticket.ticketNumber} has been created.`,
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          priority: ticket.priority,
        },
        priority: 'MEDIUM',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'support',
          relatedResource: ticket._id,
          resourceModel: 'Ticket',
          actionUrl: `/support/tickets/${ticket._id}`,
        },
      });

      // Notify support team
      const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['support'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const agent of admins) {
        await notificationService.create({
          recipient: agent._id,
          type: 'TICKET_CREATED',
          title: 'New Support Ticket',
          message: `New support ticket #${ticket.ticketNumber} has been created.`,
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            customerId: ticket.customerId,
            subject: ticket.subject,
            priority: ticket.priority,
          },
          priority: 'HIGH',
          channels: ['IN_APP'],
          metadata: {
            category: 'support_staff',
            relatedResource: ticket._id,
            resourceModel: 'Ticket',
            actionUrl: `/admin/support/tickets/${ticket._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating ticket created notification:', error);
    }
    next();
  }

  static async onTicketResolved(req, res, next) {
    try {
      const ticket = res.locals.ticket;

      await notificationService.create({
        recipient: ticket.customerId,
        type: 'TICKET_RESOLVED',
        title: 'Support Ticket Resolved',
        message: `Your support ticket #${ticket.ticketNumber} has been resolved.`,
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          resolution: ticket.resolution,
          resolvedBy: ticket.resolvedBy,
        },
        priority: 'MEDIUM',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'support',
          relatedResource: ticket._id,
          resourceModel: 'Ticket',
          actionUrl: `/support/tickets/${ticket._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating ticket resolved notification:', error);
    }
    next();
  }

  // ==== MARKETING NOTIFICATIONS ====

  static async onNewsletterSubscribed(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'NEWSLETTER_SUBSCRIBED',
        title: 'Newsletter Subscription Confirmed',
        message: 'You have successfully subscribed to our newsletter.',
        data: {
          subscribedAt: new Date(),
          frequency: res.locals.frequency || 'weekly',
        },
        priority: 'LOW',
        channels: ['IN_APP', 'EMAIL'],
        metadata: {
          category: 'marketing',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating newsletter subscription notification:', error);
    }
    next();
  }

  static async onPromotionalOffer(req, res, next) {
    try {
      const offer = res.locals.offer;
      const users = res.locals.targetUsers || [];

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'PROMOTIONAL_OFFER',
          title: offer.title,
          message: offer.description,
          data: {
            offerId: offer._id,
            discountCode: offer.code,
            discountPercentage: offer.discountPercentage,
            validUntil: offer.validUntil,
          },
          priority: 'MEDIUM',
          channels: ['IN_APP', 'EMAIL'],
          metadata: {
            category: 'marketing',
            relatedResource: offer._id,
            resourceModel: 'Offer',
            actionUrl: `/offers/${offer._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating promotional offer notification:', error);
    }
    next();
  }

  // ==== MARKETING NOTIFICATIONS (30) ====

  static async onLoyaltyPointsEarned(req, res, next) {
    try {
      const user = res.locals.user;
      const pointsEarned = res.locals.pointsEarned;

      await notificationService.create({
        recipient: user._id,
        type: 'LOYALTY_POINTS_EARNED',
        title: 'Loyalty Points Earned!',
        message: `You've earned ${pointsEarned} loyalty points!`,
        data: {
          pointsEarned: pointsEarned,
          totalPoints: res.locals.totalPoints,
          source: res.locals.source, // order, review, referral, etc.
          orderId: res.locals.orderId,
          multiplier: res.locals.multiplier,
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'loyalty',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/account/loyalty',
        },
      });
    } catch (error) {
      console.error('Error creating loyalty points earned notification:', error);
    }
    next();
  }

  static async onLoyaltyPointsRedeemed(req, res, next) {
    try {
      const user = res.locals.user;
      const pointsRedeemed = res.locals.pointsRedeemed;

      await notificationService.create({
        recipient: user._id,
        type: 'LOYALTY_POINTS_REDEEMED',
        title: 'Points Redeemed Successfully',
        message: `You've redeemed ${pointsRedeemed} loyalty points!`,
        data: {
          pointsRedeemed: pointsRedeemed,
          remainingPoints: res.locals.remainingPoints,
          rewardReceived: res.locals.rewardReceived,
          redeemedAt: new Date(),
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'loyalty',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/account/loyalty',
        },
      });
    } catch (error) {
      console.error('Error creating loyalty points redeemed notification:', error);
    }
    next();
  }

  static async onSurveyRequest(req, res, next) {
    try {
      const user = res.locals.user;
      const survey = res.locals.survey;

      await notificationService.create({
        recipient: user._id,
        type: 'SURVEY_REQUEST',
        title: 'We Value Your Feedback',
        message: `Please take a moment to complete our ${survey.title} survey.`,
        data: {
          surveyId: survey._id,
          surveyTitle: survey.title,
          estimatedTime: survey.estimatedTime,
          incentive: survey.incentive,
          expiresAt: survey.expiresAt,
          surveyUrl: res.locals.surveyUrl,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'survey',
          relatedResource: survey._id,
          resourceModel: 'Survey',
          actionUrl: `/surveys/${survey._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating survey request notification:', error);
    }
    next();
  }

  static async onEventInvitation(req, res, next) {
    try {
      const user = res.locals.user;
      const event = res.locals.event;

      await notificationService.create({
        recipient: user._id,
        type: 'EVENT_INVITATION',
        title: 'You re Invited!',
        message: `You're invited to our exclusive event: ${event.title}`,
        data: {
          eventId: event._id,
          eventTitle: event.title,
          eventDate: event.date,
          eventLocation: event.location,
          eventType: event.type,
          rsvpDeadline: event.rsvpDeadline,
          rsvpUrl: res.locals.rsvpUrl,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'event',
          relatedResource: event._id,
          resourceModel: 'Event',
          actionUrl: `/events/${event._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating event invitation notification:', error);
    }
    next();
  }

  static async onWebinarReminder(req, res, next) {
    try {
      const user = res.locals.user;
      const webinar = res.locals.webinar;

      await notificationService.create({
        recipient: user._id,
        type: 'WEBINAR_REMINDER',
        title: 'Webinar Starting Soon',
        message: `"${webinar.title}" starts in ${res.locals.minutesUntilStart} minutes.`,
        data: {
          webinarId: webinar._id,
          webinarTitle: webinar.title,
          startTime: webinar.startTime,
          joinLink: webinar.joinLink,
          duration: webinar.duration,
          presenter: webinar.presenter,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'webinar',
          relatedResource: webinar._id,
          resourceModel: 'Webinar',
          actionUrl: webinar.joinLink,
        },
      });
    } catch (error) {
      console.error('Error creating webinar reminder notification:', error);
    }
    next();
  }

  static async onReferralBonusEarned(req, res, next) {
    try {
      const user = res.locals.user;
      const bonusAmount = res.locals.bonusAmount;

      await notificationService.create({
        recipient: user._id,
        type: 'REFERRAL_BONUS_EARNED',
        title: 'Referral Bonus Earned!',
        message: `You've earned $${bonusAmount} for referring a friend!`,
        data: {
          bonusAmount: bonusAmount,
          bonusType: res.locals.bonusType, // cash, credit, points
          referredUser: res.locals.referredUser,
          earnedAt: new Date(),
          totalReferrals: res.locals.totalReferrals,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'referral',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/account/referrals',
        },
      });
    } catch (error) {
      console.error('Error creating referral bonus earned notification:', error);
    }
    next();
  }

  static async onReferralInvitation(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'REFERRAL_INVITATION',
        title: 'Invite Friends & Earn Rewards',
        message: `Invite friends and earn $${res.locals.bonusAmount} for each successful referral!`,
        data: {
          bonusAmount: res.locals.bonusAmount,
          referralCode: res.locals.referralCode,
          shareLink: res.locals.shareLink,
          termsAndConditions: res.locals.termsAndConditions,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'referral',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/account/referrals',
        },
      });
    } catch (error) {
      console.error('Error creating referral invitation notification:', error);
    }
    next();
  }

  static async onReferralBonusUsed(req, res, next) {
    try {
      const user = res.locals.user;
      const usedAmount = res.locals.usedAmount;

      await notificationService.create({
        recipient: user._id,
        type: 'REFERRAL_BONUS_USED',
        title: 'Referral Bonus Applied',
        message: `Your referral bonus of $${usedAmount} has been applied to your order.`,
        data: {
          usedAmount: usedAmount,
          orderId: res.locals.orderId,
          remainingBonus: res.locals.remainingBonus,
          usedAt: new Date(),
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'referral',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating referral bonus used notification:', error);
    }
    next();
  }

  static async onSeasonalSaleAnnouncement(req, res, next) {
    try {
      const sale = res.locals.sale;
      const users = res.locals.targetUsers || [];

      for (const user of users) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'SEASONAL_SALE_ANNOUNCEMENT',
          title: sale.title,
          message: sale.description,
          data: {
            saleId: sale._id,
            saleName: sale.title,
            discountPercentage: sale.discountPercentage,
            startDate: sale.startDate,
            endDate: sale.endDate,
            categories: sale.categories,
            saleUrl: res.locals.saleUrl,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'marketing',
            relatedResource: sale._id,
            resourceModel: 'Sale',
            actionUrl: `/sales/${sale._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating seasonal sale announcement notification:', error);
    }
    next();
  }

  static async onFlashSaleOffer(req, res, next) {
    try {
      const sale = res.locals.sale;
      const users = res.locals.targetUsers || [];

      for (const user of users) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'FLASH_SALE_OFFER',
          title: '⚡ Flash Sale Alert!',
          message: `Limited time: ${sale.discountPercentage}% off ${sale.category}!`,
          data: {
            saleId: sale._id,
            discountPercentage: sale.discountPercentage,
            category: sale.category,
            endsAt: sale.endDate,
            timeRemaining: res.locals.timeRemaining,
            saleUrl: res.locals.saleUrl,
          },
          channels: ['IN_APP', 'PUSH'],
          priority: 'HIGH',
          metadata: {
            category: 'flash-sale',
            relatedResource: sale._id,
            resourceModel: 'Sale',
            actionUrl: `/sales/${sale._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating flash sale offer notification:', error);
    }
    next();
  }

  static async onVipSaleEarlyAccess(req, res, next) {
    try {
      const sale = res.locals.sale;
      const vipUsers = res.locals.vipUsers || [];

      for (const user of vipUsers) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'VIP_SALE_EARLY_ACCESS',
          title: '🌟 VIP Early Access',
          message: `Exclusive VIP access to our ${sale.title} before everyone else!`,
          data: {
            saleId: sale._id,
            saleName: sale.title,
            discountPercentage: sale.discountPercentage,
            earlyAccessStartsAt: sale.earlyAccessStart,
            publicSaleStartsAt: sale.startDate,
            exclusiveUrl: res.locals.exclusiveUrl,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'vip',
            relatedResource: sale._id,
            resourceModel: 'Sale',
            actionUrl: res.locals.exclusiveUrl,
          },
        });
      }
    } catch (error) {
      console.error('Error creating VIP sale early access notification:', error);
    }
    next();
  }

  static async onProductSneakPeek(req, res, next) {
    try {
      const product = res.locals.product;
      const users = res.locals.interestedUsers || [];

      for (const user of users) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'PRODUCT_SNEAK_PEEK',
          title: 'Sneak Peek: Coming Soon!',
          message: `Get an exclusive preview of our upcoming product: ${product.name}`,
          data: {
            productId: product._id,
            productName: product.name,
            category: product.category,
            launchDate: product.launchDate,
            estimatedPrice: product.estimatedPrice,
            previewImages: res.locals.previewImages,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'product-preview',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}/preview`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating product sneak peek notification:', error);
    }
    next();
  }

  static async onExclusiveEventInvitation(req, res, next) {
    try {
      const event = res.locals.event;
      const exclusiveUsers = res.locals.exclusiveUsers || [];

      for (const user of exclusiveUsers) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'EXCLUSIVE_EVENT_INVITATION',
          title: '✨ Exclusive Invitation',
          message: `You're exclusively invited to ${event.title}`,
          data: {
            eventId: event._id,
            eventTitle: event.title,
            eventDate: event.date,
            eventLocation: event.location,
            exclusivePerks: event.exclusivePerks,
            rsvpDeadline: event.rsvpDeadline,
            rsvpUrl: res.locals.rsvpUrl,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'exclusive-event',
            relatedResource: event._id,
            resourceModel: 'Event',
            actionUrl: `/events/${event._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating exclusive event invitation notification:', error);
    }
    next();
  }

  static async onPersonalizedRecommendations(req, res, next) {
    try {
      const user = res.locals.user;
      const recommendations = res.locals.recommendations || [];

      await notificationService.create({
        recipient: user._id,
        type: 'PERSONALIZED_RECOMMENDATIONS',
        title: 'Products Just for You',
        message: `We found ${recommendations.length} products you might love!`,
        data: {
          recommendationId: res.locals.recommendationId,
          products: recommendations.slice(0, 5), // Top 5 recommendations
          recommendationReason: res.locals.recommendationReason,
          generatedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'recommendation',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/recommendations',
        },
      });
    } catch (error) {
      console.error('Error creating personalized recommendations notification:', error);
    }
    next();
  }

  static async onCrossSellOffer(req, res, next) {
    try {
      const user = res.locals.user;
      const mainProduct = res.locals.mainProduct;
      const crossSellProducts = res.locals.crossSellProducts || [];

      await notificationService.create({
        recipient: user._id,
        type: 'CROSS_SELL_OFFER',
        title: 'Complete Your Look',
        message: `Products that go perfectly with ${mainProduct.name}`,
        data: {
          mainProductId: mainProduct._id,
          mainProductName: mainProduct.name,
          crossSellProducts: crossSellProducts.slice(0, 3),
          specialOffer: res.locals.specialOffer,
          discount: res.locals.discount,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'cross-sell',
          relatedResource: mainProduct._id,
          resourceModel: 'Product',
          actionUrl: `/products/${mainProduct._id}/complete-the-look`,
        },
      });
    } catch (error) {
      console.error('Error creating cross-sell offer notification:', error);
    }
    next();
  }

  static async onUpsellOffer(req, res, next) {
    try {
      const user = res.locals.user;
      const currentProduct = res.locals.currentProduct;
      const upgradeProduct = res.locals.upgradeProduct;

      await notificationService.create({
        recipient: user._id,
        type: 'UPSELL_OFFER',
        title: 'Upgrade Available',
        message: `Upgrade to ${upgradeProduct.name} for even better value!`,
        data: {
          currentProductId: currentProduct._id,
          currentProductName: currentProduct.name,
          upgradeProductId: upgradeProduct._id,
          upgradeProductName: upgradeProduct.name,
          priceDifference: upgradeProduct.price - currentProduct.price,
          upgradeDiscount: res.locals.upgradeDiscount,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'upsell',
          relatedResource: upgradeProduct._id,
          resourceModel: 'Product',
          actionUrl: `/products/${upgradeProduct._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating upsell offer notification:', error);
    }
    next();
  }

  static async onBackInStockNotification(req, res, next) {
    try {
      const product = res.locals.product;
      const users = res.locals.subscribedUsers || [];

      for (const user of users) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'BACK_IN_STOCK_NOTIFICATION',
          title: 'Back in Stock!',
          message: `"${product.name}" is back in stock!`,
          data: {
            productId: product._id,
            productName: product.name,
            currentStock: product.stock,
            price: product.price,
            category: product.category,
            restockedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'inventory',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating back in stock notification:', error);
    }
    next();
  }

  static async onPriceDropAlert(req, res, next) {
    try {
      const product = res.locals.product;
      const users = res.locals.interestedUsers || [];

      for (const user of users) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'PRICE_DROP_ALERT',
          title: 'Price Drop Alert! 📉',
          message: `"${product.name}" price dropped by ${res.locals.discountPercentage}%!`,
          data: {
            productId: product._id,
            productName: product.name,
            oldPrice: res.locals.oldPrice,
            newPrice: product.price,
            discountPercentage: res.locals.discountPercentage,
            savings: res.locals.oldPrice - product.price,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'price-drop',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating price drop alert notification:', error);
    }
    next();
  }

  static async onNewProductLaunch(req, res, next) {
    try {
      const product = res.locals.product;
      const users = res.locals.targetUsers || [];

      for (const user of users) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'NEW_PRODUCT_LAUNCH',
          title: 'New Product Launch! 🎉',
          message: `Discover our latest product: "${product.name}"`,
          data: {
            productId: product._id,
            productName: product.name,
            price: product.price,
            category: product.category,
            launchDate: new Date(),
            launchOffer: res.locals.launchOffer,
            features: product.keyFeatures,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'product-launch',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating new product launch notification:', error);
    }
    next();
  }

  static async onWinBackCampaign(req, res, next) {
    try {
      const user = res.locals.user;
      const offer = res.locals.winBackOffer;

      await notificationService.create({
        recipient: user._id,
        type: 'WIN_BACK_CAMPAIGN',
        title: 'We Miss You! Come Back',
        message: `We miss you! Here's a special ${offer.discountPercentage}% discount to welcome you back.`,
        data: {
          lastOrderDate: res.locals.lastOrderDate,
          daysSinceLastOrder: res.locals.daysSinceLastOrder,
          discountCode: offer.code,
          discountPercentage: offer.discountPercentage,
          expiresAt: offer.expiresAt,
          personalizedMessage: res.locals.personalizedMessage,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'win-back',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: `/offers/${offer._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating win back campaign notification:', error);
    }
    next();
  }

  static async onProductReviewRequest(req, res, next) {
    try {
      const user = res.locals.user;
      const order = res.locals.order;

      await notificationService.create({
        recipient: user._id,
        type: 'PRODUCT_REVIEW_REQUEST',
        title: 'How Was Your Purchase?',
        message: `Please share your experience with your recent order #${order.orderNumber}`,
        data: {
          orderId: order.orderNumber,
          products: order.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
          })),
          deliveredAt: res.locals.deliveredAt,
          reviewIncentive: res.locals.reviewIncentive,
          reviewUrl: res.locals.reviewUrl,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'review',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/review`,
        },
      });
    } catch (error) {
      console.error('Error creating product review request notification:', error);
    }
    next();
  }

  static async onCustomerSatisfactionSurvey(req, res, next) {
    try {
      const user = res.locals.user;
      const survey = res.locals.survey;

      await notificationService.create({
        recipient: user._id,
        type: 'CUSTOMER_SATISFACTION_SURVEY',
        title: 'Help Us Improve',
        message: `Your feedback matters! Please take our customer satisfaction survey.`,
        data: {
          surveyId: survey._id,
          surveyTitle: survey.title,
          estimatedTime: survey.estimatedTime,
          incentive: survey.incentive,
          expiresAt: survey.expiresAt,
          surveyUrl: res.locals.surveyUrl,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'survey',
          relatedResource: survey._id,
          resourceModel: 'Survey',
          actionUrl: `/surveys/${survey._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating customer satisfaction survey notification:', error);
    }
    next();
  }

  static async onHolidayGreetings(req, res, next) {
    try {
      const user = res.locals.user;
      const holiday = res.locals.holiday;

      await notificationService.create({
        recipient: user._id,
        type: 'HOLIDAY_GREETINGS',
        title: `Happy ${holiday.name}! 🎉`,
        message: holiday.message,
        data: {
          holidayName: holiday.name,
          holidayDate: holiday.date,
          greeting: holiday.message,
          specialOffer: res.locals.specialOffer,
          celebrationTheme: holiday.theme,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'holiday',
          relatedResource: holiday._id,
          resourceModel: 'Holiday',
        },
      });
    } catch (error) {
      console.error('Error creating holiday greetings notification:', error);
    }
    next();
  }

  static async onCsrStoryShared(req, res, next) {
    try {
      const user = res.locals.user;
      const story = res.locals.csrStory;

      await notificationService.create({
        recipient: user._id,
        type: 'CSR_STORY_SHARED',
        title: 'Making a Difference Together',
        message: `See how your purchases are helping: ${story.title}`,
        data: {
          storyId: story._id,
          storyTitle: story.title,
          impact: story.impact,
          beneficiaries: story.beneficiaries,
          userContribution: res.locals.userContribution,
          storyUrl: res.locals.storyUrl,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'csr',
          relatedResource: story._id,
          resourceModel: 'CSRStory',
          actionUrl: `/csr/${story._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating CSR story shared notification:', error);
    }
    next();
  }

  static async onAppDownloadInvitation(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'APP_DOWNLOAD_INVITATION',
        title: 'Get Our Mobile App',
        message: `Download our app for exclusive deals and better shopping experience!`,
        data: {
          appStoreUrl: res.locals.appStoreUrl,
          playStoreUrl: res.locals.playStoreUrl,
          appFeatures: res.locals.appFeatures,
          exclusiveOffer: res.locals.exclusiveOffer,
          downloadIncentive: res.locals.downloadIncentive,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'app',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating app download invitation notification:', error);
    }
    next();
  }

  static async onNewsletterRegular(req, res, next) {
    try {
      const user = res.locals.user;
      const newsletter = res.locals.newsletter;

      await notificationService.create({
        recipient: user._id,
        type: 'NEWSLETTER_REGULAR',
        title: newsletter.title,
        message: newsletter.excerpt,
        data: {
          newsletterId: newsletter._id,
          newsletterTitle: newsletter.title,
          edition: newsletter.edition,
          topics: newsletter.topics,
          readTime: newsletter.estimatedReadTime,
          newsletterUrl: res.locals.newsletterUrl,
        },
        channels: ['EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'newsletter',
          relatedResource: newsletter._id,
          resourceModel: 'Newsletter',
          actionUrl: `/newsletters/${newsletter._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating regular newsletter notification:', error);
    }
    next();
  }

  static async onAbandonedBrowseReminder(req, res, next) {
    try {
      const user = res.locals.user;
      const browsingData = res.locals.browsingData;

      await notificationService.create({
        recipient: user._id,
        type: 'ABANDONED_BROWSE_REMINDER',
        title: 'Still Interested?',
        message: `You were looking at "${browsingData.lastViewedProduct}". Ready to purchase?`,
        data: {
          lastViewedProductId: browsingData.lastViewedProductId,
          lastViewedProduct: browsingData.lastViewedProduct,
          viewedAt: browsingData.viewedAt,
          category: browsingData.category,
          relatedProducts: res.locals.relatedProducts,
          specialOffer: res.locals.specialOffer,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'LOW',
        metadata: {
          category: 'browsing',
          relatedResource: browsingData.lastViewedProductId,
          resourceModel: 'Product',
          actionUrl: `/products/${browsingData.lastViewedProductId}`,
        },
      });
    } catch (error) {
      console.error('Error creating abandoned browse reminder notification:', error);
    }
    next();
  }

  static async onLoyaltyTierChange(req, res, next) {
    try {
      const user = res.locals.user;
      const tierChange = res.locals.tierChange;

      await notificationService.create({
        recipient: user._id,
        type: 'LOYALTY_TIER_CHANGE',
        title: `Welcome to ${tierChange.newTier}! 🌟`,
        message: `Congratulations! You've been upgraded to ${tierChange.newTier} status.`,
        data: {
          oldTier: tierChange.oldTier,
          newTier: tierChange.newTier,
          newBenefits: tierChange.newBenefits,
          requiredSpending: tierChange.requiredSpending,
          currentSpending: tierChange.currentSpending,
          upgradedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'loyalty',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/account/loyalty',
        },
      });
    } catch (error) {
      console.error('Error creating loyalty tier change notification:', error);
    }
    next();
  }

  static async onBirthdayOffer(req, res, next) {
    try {
      const user = res.locals.user;
      const offer = res.locals.birthdayOffer;

      await notificationService.create({
        recipient: user._id,
        type: 'BIRTHDAY_OFFER',
        title: 'Happy Birthday! 🎂',
        message: `Happy Birthday! Enjoy a special ${offer.discountPercentage}% discount on us!`,
        data: {
          discountCode: offer.code,
          discountPercentage: offer.discountPercentage,
          validUntil: offer.validUntil,
          birthdayMessage: offer.message,
          specialProducts: res.locals.specialProducts,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'birthday',
          relatedResource: offer._id,
          resourceModel: 'Offer',
          actionUrl: `/offers/${offer._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating birthday offer notification:', error);
    }
    next();
  }

  static async onCustomerMilestone(req, res, next) {
    try {
      const user = res.locals.user;
      const milestone = res.locals.milestone;

      await notificationService.create({
        recipient: user._id,
        type: 'CUSTOMER_MILESTONE',
        title: `${milestone.title} Milestone! 🏆`,
        message: milestone.message,
        data: {
          milestoneType: milestone.type, // first_order, spending_milestone, loyalty_years, etc.
          milestoneValue: milestone.value,
          achievedAt: new Date(),
          reward: milestone.reward,
          nextMilestone: res.locals.nextMilestone,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'milestone',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/account/milestones',
        },
      });
    } catch (error) {
      console.error('Error creating customer milestone notification:', error);
    }
    next();
  }

  // ==== INVENTORY NOTIFICATIONS ====

  static async onStockLow(req, res, next) {
    try {
      const product = res.locals.product;

      // Notify inventory managers
      const managers = await User.find({ role: { $in: ['admin', 'inventory_manager'] } });

      for (const manager of managers) {
        await notificationService.create({
          recipient: manager._id,
          type: 'STOCK_LOW',
          title: 'Low Stock Alert',
          message: `Product "${product.name}" is running low on stock.`,
          data: {
            productId: product._id,
            productName: product.name,
            currentStock: product.stock,
            minStockLevel: product.minStockLevel,
          },
          priority: 'MEDIUM',
          channels: ['IN_APP', 'EMAIL'],
          metadata: {
            category: 'inventory',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/admin/inventory/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating low stock notification:', error);
    }
    next();
  }

  static async onStockCritical(req, res, next) {
    try {
      const product = res.locals.product;

      // Notify inventory managers
      const managers = await User.find({ role: { $in: ['admin', 'inventory_manager'] } });

      for (const manager of managers) {
        await notificationService.create({
          recipient: manager._id,
          type: 'STOCK_CRITICAL',
          title: 'Critical Stock Alert',
          message: `URGENT: Product "${product.name}" has critically low stock!`,
          data: {
            productId: product._id,
            productName: product.name,
            currentStock: product.stock,
            criticalLevel: product.criticalLevel,
          },
          priority: 'URGENT',
          channels: ['IN_APP', 'EMAIL', 'SMS'],
          metadata: {
            category: 'inventory',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/admin/inventory/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating critical stock notification:', error);
    }
    next();
  }

  // ==== SYSTEM NOTIFICATIONS (13) ====

  static async onMaintenanceStarted(req, res, next) {
    try {
      const maintenance = res.locals.maintenance;
      const users = await User.find({ isActive: true });

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'MAINTENANCE_STARTED',
          title: 'Maintenance in Progress',
          message: 'System maintenance has begun. Some features may be temporarily unavailable.',
          data: {
            maintenanceId: maintenance._id,
            startTime: new Date(),
            estimatedDuration: maintenance.estimatedDuration,
            affectedServices: maintenance.affectedServices,
            priority: maintenance.priority,
          },
          channels: ['IN_APP'],
          priority: 'HIGH',
          metadata: {
            category: 'maintenance',
            relatedResource: maintenance._id,
            resourceModel: 'Maintenance',
          },
        });
      }
    } catch (error) {
      console.error('Error creating maintenance started notification:', error);
    }
    next();
  }

  static async onMaintenanceCompleted(req, res, next) {
    try {
      const maintenance = res.locals.maintenance;
      const users = await User.find({ isActive: true });

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'MAINTENANCE_COMPLETED',
          title: 'Maintenance Complete',
          message: 'System maintenance has been completed. All services are now operational.',
          data: {
            maintenanceId: maintenance._id,
            completedAt: new Date(),
            actualDuration: res.locals.actualDuration,
            improvements: res.locals.improvements,
            restoredServices: maintenance.affectedServices,
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'maintenance',
            relatedResource: maintenance._id,
            resourceModel: 'Maintenance',
          },
        });
      }
    } catch (error) {
      console.error('Error creating maintenance completed notification:', error);
    }
    next();
  }

  static async onNewFeatureReleased(req, res, next) {
    try {
      const feature = res.locals.feature;
      const users = await User.find({ isActive: true });

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'NEW_FEATURE_RELEASED',
          title: 'New Feature Available!',
          message: `Check out our new feature: ${feature.name}`,
          data: {
            featureId: feature._id,
            featureName: feature.name,
            description: feature.description,
            releaseDate: new Date(),
            tutorialUrl: feature.tutorialUrl,
            benefits: feature.benefits,
          },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: {
            category: 'feature-release',
            relatedResource: feature._id,
            resourceModel: 'Feature',
          },
        });
      }
    } catch (error) {
      console.error('Error creating new feature released notification:', error);
    }
    next();
  }

  static async onBugFixDeployed(req, res, next) {
    try {
      const bugFix = res.locals.bugFix;
      const affectedUsers = res.locals.affectedUsers || [];

      for (const user of affectedUsers) {
        await notificationService.create({
          recipient: user._id,
          type: 'BUG_FIX_DEPLOYED',
          title: 'Issue Resolved',
          message: `The issue you reported has been fixed: ${bugFix.description}`,
          data: {
            bugFixId: bugFix._id,
            bugDescription: bugFix.description,
            fixDescription: bugFix.fixDescription,
            deployedAt: new Date(),
            version: bugFix.version,
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'bug-fix',
            relatedResource: bugFix._id,
            resourceModel: 'BugFix',
          },
        });
      }
    } catch (error) {
      console.error('Error creating bug fix deployed notification:', error);
    }
    next();
  }

  static async onSystemError(req, res, next) {
    try {
      const error = res.locals.systemError;
      const affectedUsers = res.locals.affectedUsers || [];

      for (const user of affectedUsers) {
        await notificationService.create({
          recipient: user._id,
          type: 'SYSTEM_ERROR',
          title: 'System Issue Detected',
          message: 'We detected a system issue and are working to resolve it.',
          data: {
            errorId: error._id,
            errorType: error.type,
            affectedServices: error.affectedServices,
            detectedAt: new Date(),
            estimatedResolution: error.estimatedResolution,
          },
          channels: ['IN_APP'],
          priority: 'HIGH',
          metadata: {
            category: 'system-error',
            relatedResource: error._id,
            resourceModel: 'SystemError',
          },
        });
      }
    } catch (error) {
      console.error('Error creating system error notification:', error);
    }
    next();
  }

  static async onSecurityAlert(req, res, next) {
    try {
      const alert = res.locals.securityAlert;
      const affectedUsers = res.locals.affectedUsers || [];

      for (const user of affectedUsers) {
        await notificationService.create({
          recipient: user._id,
          type: 'SECURITY_ALERT',
          title: 'Security Alert',
          message: alert.message,
          data: {
            alertId: alert._id,
            alertType: alert.type,
            severity: alert.severity,
            detectedAt: alert.detectedAt,
            actionRequired: alert.actionRequired,
            recommendations: alert.recommendations,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'URGENT',
          metadata: {
            category: 'security',
            relatedResource: alert._id,
            resourceModel: 'SecurityAlert',
          },
        });
      }
    } catch (error) {
      console.error('Error creating security alert notification:', error);
    }
    next();
  }

  static async onDataBackupCompleted(req, res, next) {
    try {
      const backup = res.locals.backup;
        const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'DATA_BACKUP_COMPLETED',
          title: 'Data Backup Completed',
          message: `System backup has been completed successfully.`,
          data: {
            backupId: backup._id,
            backupType: backup.type,
            completedAt: new Date(),
            backupSize: backup.size,
            duration: backup.duration,
            status: 'completed',
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'LOW',
          metadata: {
            category: 'backup',
            relatedResource: backup._id,
            resourceModel: 'Backup',
          },
        });
      }
    } catch (error) {
      console.error('Error creating data backup completed notification:', error);
    }
    next();
  }

  static async onApiRateLimitExceeded(req, res, next) {
    try {
      const user = res.locals.user;
      const rateLimitInfo = res.locals.rateLimitInfo;

      await notificationService.create({
        recipient: user._id,
        type: 'API_RATE_LIMIT_EXCEEDED',
        title: 'API Rate Limit Exceeded',
        message: 'You have exceeded the API rate limit. Please slow down your requests.',
        data: {
          currentRate: rateLimitInfo.currentRate,
          limitPerHour: rateLimitInfo.limitPerHour,
          resetTime: rateLimitInfo.resetTime,
          blockedUntil: rateLimitInfo.blockedUntil,
        },
        channels: ['IN_APP'],
        priority: 'MEDIUM',
        metadata: {
          category: 'api',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating API rate limit exceeded notification:', error);
    }
    next();
  }

  static async onUnexpectedShutdown(req, res, next) {
    try {
      const shutdownInfo = res.locals.shutdownInfo;
      const users = await User.find({ isActive: true });

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'UNEXPECTED_SHUTDOWN',
          title: 'Service Interruption',
          message: 'We experienced an unexpected service interruption. Services are being restored.',
          data: {
            shutdownTime: shutdownInfo.shutdownTime,
            cause: shutdownInfo.cause,
            affectedServices: shutdownInfo.affectedServices,
            estimatedRestoreTime: shutdownInfo.estimatedRestoreTime,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'URGENT',
          metadata: {
            category: 'system',
            relatedResource: shutdownInfo._id,
            resourceModel: 'SystemEvent',
          },
        });
      }
    } catch (error) {
      console.error('Error creating unexpected shutdown notification:', error);
    }
    next();
  }

  static async onServerRestarted(req, res, next) {
    try {
      const restartInfo = res.locals.restartInfo;
       const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'SERVER_RESTARTED',
          title: 'Server Restarted',
          message: 'Server has been restarted successfully.',
          data: {
            restartTime: new Date(),
            reason: restartInfo.reason,
            downtime: restartInfo.downtime,
            servicesRestored: restartInfo.servicesRestored,
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'system',
            relatedResource: restartInfo._id,
            resourceModel: 'SystemEvent',
          },
        });
      }
    } catch (error) {
      console.error('Error creating server restarted notification:', error);
    }
    next();
  }

  static async onOtpSent(req, res, next) {
    try {
      const user = res.locals.user;
      const otp = res.locals.otp;

      await notificationService.create({
        recipient: user._id,
        type: 'OTP_SENT',
        title: 'Verification Code Sent',
        message: 'Your verification code has been sent.',
        data: {
          otpType: otp.type,
          sentTo: otp.sentTo,
          expiresAt: otp.expiresAt,
          attemptNumber: otp.attemptNumber || 1,
        },
        channels: ['IN_APP'],
        priority: 'HIGH',
        metadata: {
          category: 'authentication',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating OTP sent notification:', error);
    }
    next();
  }

  static async onAccountSecurityCheckReminder(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'ACCOUNT_SECURITY_CHECK_REMINDER',
        title: 'Security Check Reminder',
        message: 'Please review your account security settings.',
        data: {
          lastSecurityCheck: res.locals.lastSecurityCheck,
          securityScore: res.locals.securityScore,
          recommendedActions: res.locals.recommendedActions,
          reminderType: res.locals.reminderType || 'periodic',
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
          actionUrl: '/account/security',
        },
      });
    } catch (error) {
      console.error('Error creating account security check reminder notification:', error);
    }
    next();
  }

  static async onSessionTimeout(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'SESSION_TIMEOUT',
        title: 'Session Expired',
        message: 'Your session has expired for security reasons. Please log in again.',
        data: {
          sessionId: res.locals.sessionId,
          expiredAt: new Date(),
          lastActivity: res.locals.lastActivity,
          reason: res.locals.timeoutReason || 'inactivity',
        },
        channels: ['IN_APP'],
        priority: 'MEDIUM',
        metadata: {
          category: 'session',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });
    } catch (error) {
      console.error('Error creating session timeout notification:', error);
    }
    next();
  }

  // ==== ADMIN NOTIFICATIONS (39) ====

  static async onNewOrderPlaced(req, res, next) {
    try {
      const order = res.locals.order;
     
          const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin','sales_manager'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'NEW_ORDER_PLACED',
          title: 'New Order Placed',
          message: `New order #${order.orderNumber} placed for $${order.totalAmount}`,
          data: {
            orderId: order.orderNumber,
            customerId: order.customer,
            amount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            placedAt: new Date(),
            itemCount: order.items?.length || 0,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'sales',
            relatedResource: order._id,
            resourceModel: 'Order',
            actionUrl: `/admin/orders/${order._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating new order placed notification:', error);
    }
    next();
  }

  static async onHighValueOrder(req, res, next) {
    try {
      const order = res.locals.order;
     
          const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin','sales_manager'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'HIGH_VALUE_ORDER',
          title: 'High Value Order Alert',
          message: `High value order #${order.orderNumber} placed for $${order.totalAmount}`,
          data: {
            orderId: order.orderNumber,
            customerId: order.customer,
            amount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            threshold: res.locals.highValueThreshold,
            customerTier: res.locals.customerTier,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'sales',
            relatedResource: order._id,
            resourceModel: 'Order',
            actionUrl: `/admin/orders/${order._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating high value order notification:', error);
    }
    next();
  }

  static async onLowStockAlert(req, res, next) {
    try {
      const product = res.locals.product;
      const managers = await User.find({ role: { $in: ['admin', 'inventory_manager'] } });

      for (const manager of managers) {
        await notificationService.create({
          recipient: manager._id,
          type: 'LOW_STOCK_ALERT',
          title: 'Low Stock Alert',
          message: `Product "${product.name}" is running low on stock (${product.stock} remaining)`,
          data: {
            productId: product._id,
            productName: product.name,
            currentStock: product.stock,
            minStockLevel: product.minStockLevel,
            reorderPoint: product.reorderPoint,
            category: product.category,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'inventory',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/admin/inventory/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating low stock alert notification:', error);
    }
    next();
  }

  static async onOutOfStockAlert(req, res, next) {
    try {
      const product = res.locals.product;
      const managers = await User.find({ role: { $in: ['admin', 'inventory_manager'] } });

      for (const manager of managers) {
        await notificationService.create({
          recipient: manager._id,
          type: 'OUT_OF_STOCK_ALERT',
          title: 'Out of Stock Alert',
          message: `Product "${product.name}" is now out of stock!`,
          data: {
            productId: product._id,
            productName: product.name,
            outOfStockAt: new Date(),
            lastStockLevel: res.locals.lastStockLevel,
            pendingOrders: res.locals.pendingOrders,
            category: product.category,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'inventory',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/admin/inventory/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating out of stock alert notification:', error);
    }
    next();
  }

  static async onProductDisabled(req, res, next) {
    try {
      const product = res.locals.product;
    
          const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin','product_manager'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'PRODUCT_DISABLED',
          title: 'Product Disabled',
          message: `Product "${product.name}" has been disabled.`,
          data: {
            productId: product._id,
            productName: product.name,
            disabledAt: new Date(),
            reason: res.locals.disableReason,
            disabledBy: res.locals.disabledBy,
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'product',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/admin/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating product disabled notification:', error);
    }
    next();
  }

  static async onNewUserRegistered(req, res, next) {
    try {
      const user = res.locals.registeredUser;
       const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'NEW_USER_REGISTERED',
          title: 'New User Registration',
          message: `New user "${user.username}" has registered.`,
          data: {
            userId: user._id,
            username: user.username,
            email: user.email,
            registeredAt: new Date(),
            registrationSource: res.locals.registrationSource,
          },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: {
            category: 'user',
            relatedResource: user._id,
            resourceModel: 'User',
            actionUrl: `/admin/users/${user._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating new user registered notification:', error);
    }
    next();
  }

  static async onNewReviewSubmitted(req, res, next) {
    try {
      const review = res.locals.review;
      const moderators = await User.find({ role: { $in: ['admin', 'content_moderator'] } });

      for (const moderator of moderators) {
        await notificationService.create({
          recipient: moderator._id,
          type: 'NEW_REVIEW_SUBMITTED',
          title: 'New Review for Moderation',
          message: `New ${review.rating}-star review submitted for "${review.productName}".`,
          data: {
            reviewId: review._id,
            productId: review.productId,
            productName: review.productName,
            rating: review.rating,
            reviewText: review.text?.substring(0, 100) + '...',
            submittedAt: new Date(),
            needsModeration: review.needsModeration,
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'review',
            relatedResource: review._id,
            resourceModel: 'Review',
            actionUrl: `/admin/reviews/${review._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating new review submitted notification:', error);
    }
    next();
  }

  static async onPaymentDisputeAlert(req, res, next) {
    try {
      const dispute = res.locals.dispute;
        const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin','finance_manager'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'PAYMENT_DISPUTE_ALERT',
          title: 'Payment Dispute Alert',
          message: `Payment dispute initiated for transaction ${dispute.transactionId}`,
          data: {
            disputeId: dispute._id,
            transactionId: dispute.transactionId,
            amount: dispute.amount,
            reason: dispute.reason,
            customerId: dispute.customerId,
            initiatedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'dispute',
            relatedResource: dispute._id,
            resourceModel: 'PaymentDispute',
            actionUrl: `/admin/disputes/${dispute._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating payment dispute alert notification:', error);
    }
    next();
  }

  static async onReturnRequestNotification(req, res, next) {
    try {
      const returnRequest = res.locals.returnRequest;
       const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin','customer_service'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'RETURN_REQUEST_NOTIFICATION',
          title: 'New Return Request',
          message: `Return request #${returnRequest.returnNumber} submitted for order #${returnRequest.orderId}`,
          data: {
            returnId: returnRequest.returnNumber,
            orderId: returnRequest.orderId,
            customerId: returnRequest.customer,
            items: returnRequest.items,
            reason: returnRequest.reason,
            requestedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'return',
            relatedResource: returnRequest._id,
            resourceModel: 'Return',
            actionUrl: `/admin/returns/${returnRequest._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating return request notification:', error);
    }
    next();
  }

  static async onRefundProcessedNotification(req, res, next) {
    try {
      const refund = res.locals.refund;
      const admins = await User.aggregate([
        {
          $lookup: {
            from: 'roles',
            localField: 'role',
            foreignField: '_id',
            as: 'role_info',
          },
        },
        {
          $unwind: {
            path: '$role_info',
          },
        },
        {
          $match: {
            'role_info.name': { $in: ['super_admin', 'admin','finance_manager'] }, // ✅ Match both roles
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1, // optional – include if you need it
            role: '$role_info.name',
          },
        },
      ]);

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'REFUND_PROCESSED_NOTIFICATION',
          title: 'Refund Processed',
          message: `Refund of $${refund.amount} has been processed.`,
          data: {
            refundId: refund._id,
            amount: refund.amount,
            customerId: refund.customer,
            orderId: refund.orderId,
            refundMethod: refund.method,
            processedAt: new Date(),
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'refund',
            relatedResource: refund._id,
            resourceModel: 'Refund',
            actionUrl: `/admin/refunds/${refund._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating refund processed notification:', error);
    }
    next();
  }

  static async onFraudulentActivityDetected(req, res, next) {
    try {
      const activity = res.locals.fraudActivity;
      const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } });

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'FRAUDULENT_ACTIVITY_DETECTED',
          title: 'Fraudulent Activity Alert',
          message: `Suspicious activity detected: ${activity.type}`,
          data: {
            activityId: activity._id,
            activityType: activity.type,
            userId: activity.userId,
            riskScore: activity.riskScore,
            details: activity.details,
            detectedAt: new Date(),
            ipAddress: activity.ipAddress,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'URGENT',
          metadata: {
            category: 'fraud',
            relatedResource: activity._id,
            resourceModel: 'FraudActivity',
            actionUrl: `/admin/security/fraud/${activity._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating fraudulent activity notification:', error);
    }
    next();
  }

  // Additional ADMIN notification methods will continue in the next part due to size...

  // ==== REMAINING ADMIN NOTIFICATIONS (27) ====

  static async onDailySalesReport(req, res, next) {
    try {
      const report = res.locals.salesReport;
      const admins = await User.find({ role: { $in: ['admin', 'sales_manager'] } });

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'DAILY_SALES_REPORT',
          title: 'Daily Sales Report',
          message: `Daily sales report for ${report.date} is ready.`,
          data: {
            reportId: report._id,
            date: report.date,
            totalSales: report.totalSales,
            orderCount: report.orderCount,
            topProducts: report.topProducts,
            reportUrl: res.locals.reportUrl,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'LOW',
          metadata: {
            category: 'report',
            relatedResource: report._id,
            resourceModel: 'SalesReport',
            actionUrl: `/admin/reports/sales/${report._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating daily sales report notification:', error);
    }
    next();
  }

  static async onWeeklySalesReport(req, res, next) {
    try {
      const report = res.locals.salesReport;
      const admins = await User.find({ role: { $in: ['admin', 'sales_manager'] } });

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'WEEKLY_SALES_REPORT',
          title: 'Weekly Sales Report',
          message: `Weekly sales report for week ${report.week} is ready.`,
          data: {
            reportId: report._id,
            week: report.week,
            totalSales: report.totalSales,
            orderCount: report.orderCount,
            growthPercentage: report.growthPercentage,
            reportUrl: res.locals.reportUrl,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'LOW',
          metadata: {
            category: 'report',
            relatedResource: report._id,
            resourceModel: 'SalesReport',
            actionUrl: `/admin/reports/sales/${report._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating weekly sales report notification:', error);
    }
    next();
  }

  static async onMonthlySalesReport(req, res, next) {
    try {
      const report = res.locals.salesReport;
      const admins = await User.find({ role: { $in: ['admin', 'sales_manager'] } });

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'MONTHLY_SALES_REPORT',
          title: 'Monthly Sales Report',
          message: `Monthly sales report for ${report.month} is ready.`,
          data: {
            reportId: report._id,
            month: report.month,
            totalSales: report.totalSales,
            orderCount: report.orderCount,
            growthPercentage: report.growthPercentage,
            topCategories: report.topCategories,
            reportUrl: res.locals.reportUrl,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'report',
            relatedResource: report._id,
            resourceModel: 'SalesReport',
            actionUrl: `/admin/reports/sales/${report._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating monthly sales report notification:', error);
    }
    next();
  }

  static async onSystemErrorAlert(req, res, next) {
    try {
      const error = res.locals.systemError;
      const admins = await User.find({ role: { $in: ['admin', 'tech_support'] } });

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'SYSTEM_ERROR_ALERT',
          title: 'System Error Alert',
          message: `System error detected: ${error.type}`,
          data: {
            errorId: error._id,
            errorType: error.type,
            errorMessage: error.message,
            severity: error.severity,
            affectedUsers: error.affectedUsers,
            detectedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'URGENT',
          metadata: {
            category: 'system-error',
            relatedResource: error._id,
            resourceModel: 'SystemError',
            actionUrl: `/admin/system/errors/${error._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating system error alert notification:', error);
    }
    next();
  }

  static async onCustomerSupportTicketCreated(req, res, next) {
    try {
      const ticket = res.locals.ticket;
      const supportAgents = await User.find({ role: { $in: ['admin', 'support_agent'] } });

      for (const agent of supportAgents) {
        await notificationService.create({
          recipient: agent._id,
          type: 'CUSTOMER_SUPPORT_TICKET_CREATED',
          title: 'New Support Ticket',
          message: `New support ticket #${ticket.ticketNumber} created.`,
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            customerId: ticket.customerId,
            subject: ticket.subject,
            priority: ticket.priority,
            category: ticket.category,
            createdAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: ticket.priority === 'urgent' ? 'URGENT' : 'MEDIUM',
          metadata: {
            category: 'support',
            relatedResource: ticket._id,
            resourceModel: 'Ticket',
            actionUrl: `/admin/support/tickets/${ticket._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating customer support ticket created notification:', error);
    }
    next();
  }

  static async onInventoryRestocked(req, res, next) {
    try {
      const restock = res.locals.restock;
      const managers = await User.find({ role: { $in: ['admin', 'inventory_manager'] } });

      for (const manager of managers) {
        await notificationService.create({
          recipient: manager._id,
          type: 'INVENTORY_RESTOCKED',
          title: 'Inventory Restocked',
          message: `Product "${restock.productName}" has been restocked with ${restock.quantity} units.`,
          data: {
            productId: restock.productId,
            productName: restock.productName,
            restockedQuantity: restock.quantity,
            newStockLevel: restock.newStockLevel,
            restockedAt: new Date(),
            supplier: restock.supplier,
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'inventory',
            relatedResource: restock.productId,
            resourceModel: 'Product',
            actionUrl: `/admin/inventory/${restock.productId}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating inventory restocked notification:', error);
    }
    next();
  }

  static async onBulkOrderRequest(req, res, next) {
    try {
      const bulkOrder = res.locals.bulkOrder;
      const salesTeam = await User.find({ role: { $in: ['admin', 'sales_manager', 'bulk_sales'] } });

      for (const member of salesTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'BULK_ORDER_REQUEST',
          title: 'Bulk Order Request',
          message: `Bulk order request for ${bulkOrder.quantity} units received.`,
          data: {
            bulkOrderId: bulkOrder._id,
            customerId: bulkOrder.customerId,
            productId: bulkOrder.productId,
            productName: bulkOrder.productName,
            quantity: bulkOrder.quantity,
            estimatedValue: bulkOrder.estimatedValue,
            requestedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'bulk-order',
            relatedResource: bulkOrder._id,
            resourceModel: 'BulkOrder',
            actionUrl: `/admin/bulk-orders/${bulkOrder._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating bulk order request notification:', error);
    }
    next();
  }

  static async onDataDeletionRequest(req, res, next) {
    try {
      const request = res.locals.deletionRequest;
      const admins = await User.find({ role: { $in: ['admin', 'privacy_officer'] } });

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'DATA_DELETION_REQUEST',
          title: 'Data Deletion Request',
          message: `User ${request.userId} has requested account and data deletion.`,
          data: {
            requestId: request._id,
            userId: request.userId,
            requestType: request.type,
            reason: request.reason,
            requestedAt: new Date(),
            deadline: request.deadline,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'privacy',
            relatedResource: request._id,
            resourceModel: 'DeletionRequest',
            actionUrl: `/admin/privacy/deletion-requests/${request._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating data deletion request notification:', error);
    }
    next();
  }

  static async onSuspiciousAccountActivity(req, res, next) {
    try {
      const activity = res.locals.suspiciousActivity;
      const securityTeam = await User.find({ role: { $in: ['admin', 'security_manager'] } });

      for (const member of securityTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'SUSPICIOUS_ACCOUNT_ACTIVITY',
          title: 'Suspicious Account Activity',
          message: `Suspicious activity detected for user ${activity.userId}`,
          data: {
            activityId: activity._id,
            userId: activity.userId,
            activityType: activity.type,
            riskLevel: activity.riskLevel,
            detectionRules: activity.detectionRules,
            detectedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'security',
            relatedResource: activity._id,
            resourceModel: 'SuspiciousActivity',
            actionUrl: `/admin/security/activities/${activity._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating suspicious account activity notification:', error);
    }
    next();
  }

  static async onMultipleLoginAttempts(req, res, next) {
    try {
      const attempts = res.locals.loginAttempts;
      const securityTeam = await User.find({ role: { $in: ['admin', 'security_manager'] } });

      for (const member of securityTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'MULTIPLE_LOGIN_ATTEMPTS',
          title: 'Multiple Login Attempts',
          message: `${attempts.count} failed login attempts detected for user ${attempts.userId}`,
          data: {
            userId: attempts.userId,
            attemptCount: attempts.count,
            timeWindow: attempts.timeWindow,
            lastAttemptAt: new Date(),
            ipAddresses: attempts.ipAddresses,
            accountLocked: attempts.accountLocked,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'security',
            relatedResource: attempts.userId,
            resourceModel: 'User',
            actionUrl: `/admin/security/login-attempts/${attempts.userId}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating multiple login attempts notification:', error);
    }
    next();
  }

  // Continue with remaining admin notifications...

  static async onAccountSuspensionReinstatement(req, res, next) {
    try {
      const reinstatement = res.locals.reinstatement;
      const admins = await User.find({ role: { $in: ['admin', 'user_manager'] } });

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'ACCOUNT_SUSPENSION_REINSTATEMENT',
          title: 'Account Reinstatement Request',
          message: `User ${reinstatement.userId} has requested account reinstatement.`,
          data: {
            requestId: reinstatement._id,
            userId: reinstatement.userId,
            suspensionReason: reinstatement.suspensionReason,
            reinstatementReason: reinstatement.reason,
            requestedAt: new Date(),
            supportingDocuments: reinstatement.documents,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'user-management',
            relatedResource: reinstatement._id,
            resourceModel: 'Reinstatement',
            actionUrl: `/admin/users/reinstatements/${reinstatement._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating account suspension reinstatement notification:', error);
    }
    next();
  }

  static async onUserProfileUpdate(req, res, next) {
    try {
      const update = res.locals.profileUpdate;
      const admins = await User.find({ role: { $in: ['admin', 'user_manager'] } });

      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'USER_PROFILE_UPDATE',
          title: 'User Profile Update',
          message: `User ${update.userId} has updated their profile.`,
          data: {
            userId: update.userId,
            changedFields: update.changedFields,
            updatedAt: new Date(),
            requiresApproval: update.requiresApproval,
          },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: {
            category: 'user-management',
            relatedResource: update.userId,
            resourceModel: 'User',
            actionUrl: `/admin/users/${update.userId}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating user profile update notification:', error);
    }
    next();
  }

  static async onTwoFactorStatusChange(req, res, next) {
    try {
      const change = res.locals.twoFactorChange;
      const securityTeam = await User.find({ role: { $in: ['admin', 'security_manager'] } });

      for (const member of securityTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'TWO_FACTOR_STATUS_CHANGE',
          title: '2FA Status Changed',
          message: `User ${change.userId} has ${change.enabled ? 'enabled' : 'disabled'} two-factor authentication.`,
          data: {
            userId: change.userId,
            enabled: change.enabled,
            method: change.method,
            changedAt: new Date(),
            ipAddress: change.ipAddress,
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'security',
            relatedResource: change.userId,
            resourceModel: 'User',
            actionUrl: `/admin/security/2fa/${change.userId}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating two factor status change notification:', error);
    }
    next();
  }

  // ==== SHIPPING NOTIFICATIONS (8) ====

  static async onShippingLabelCreated(req, res, next) {
    try {
      const order = res.locals.order;
      const shipment = res.locals.shipment;

      await notificationService.create({
        recipient: order.customer,
        type: 'SHIPPING_LABEL_CREATED',
        title: 'Shipping Label Created',
        message: `Shipping label has been created for order #${order.orderNumber}`,
        data: {
          orderId: order.orderNumber,
          shipmentId: shipment._id,
          trackingNumber: shipment.trackingNumber,
          carrier: shipment.carrier,
          createdAt: new Date(),
        },
        channels: ['IN_APP'],
        priority: 'MEDIUM',
        metadata: {
          category: 'shipping',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/track`,
        },
      });
    } catch (error) {
      console.error('Error creating shipping label created notification:', error);
    }
    next();
  }

  static async onPackageDispatched(req, res, next) {
    try {
      const order = res.locals.order;
      const shipment = res.locals.shipment;

      await notificationService.create({
        recipient: order.customer,
        type: 'PACKAGE_DISPATCHED',
        title: 'Package Dispatched',
        message: `Your package for order #${order.orderNumber} has been dispatched.`,
        data: {
          orderId: order.orderNumber,
          trackingNumber: shipment.trackingNumber,
          carrier: shipment.carrier,
          dispatchedAt: new Date(),
          estimatedDelivery: shipment.estimatedDelivery,
        },
        channels: ['IN_APP', 'SMS'],
        priority: 'HIGH',
        metadata: {
          category: 'shipping',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/track`,
        },
      });
    } catch (error) {
      console.error('Error creating package dispatched notification:', error);
    }
    next();
  }

  static async onPackageInTransit(req, res, next) {
    try {
      const order = res.locals.order;
      const shipment = res.locals.shipment;

      await notificationService.create({
        recipient: order.customer,
        type: 'PACKAGE_IN_TRANSIT',
        title: 'Package In Transit',
        message: `Your package for order #${order.orderNumber} is on its way!`,
        data: {
          orderId: order.orderNumber,
          trackingNumber: shipment.trackingNumber,
          currentLocation: shipment.currentLocation,
          estimatedDelivery: shipment.estimatedDelivery,
          transitSince: shipment.transitSince,
        },
        channels: ['IN_APP', 'SMS'],
        priority: 'MEDIUM',
        metadata: {
          category: 'shipping',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/track`,
        },
      });
    } catch (error) {
      console.error('Error creating package in transit notification:', error);
    }
    next();
  }

  static async onPackageDelivered(req, res, next) {
    try {
      const order = res.locals.order;
      const delivery = res.locals.delivery;

      await notificationService.create({
        recipient: order.customer,
        type: 'PACKAGE_DELIVERED',
        title: 'Package Delivered! 📦',
        message: `Your order #${order.orderNumber} has been delivered successfully.`,
        data: {
          orderId: order.orderNumber,
          deliveredAt: new Date(),
          deliveredTo: delivery.deliveredTo,
          deliveryLocation: delivery.location,
          signedBy: delivery.signedBy,
          trackingNumber: delivery.trackingNumber,
        },
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        priority: 'HIGH',
        metadata: {
          category: 'delivery',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating package delivered notification:', error);
    }
    next();
  }

  static async onPackageDelayed(req, res, next) {
    try {
      const order = res.locals.order;
      const delay = res.locals.delay;

      await notificationService.create({
        recipient: order.customer,
        type: 'PACKAGE_DELAYED',
        title: 'Package Delayed',
        message: `Your order #${order.orderNumber} delivery has been delayed.`,
        data: {
          orderId: order.orderNumber,
          originalDeliveryDate: delay.originalDeliveryDate,
          newDeliveryDate: delay.newDeliveryDate,
          delayReason: delay.reason,
          compensation: delay.compensation,
        },
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        priority: 'HIGH',
        metadata: {
          category: 'delivery',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/track`,
        },
      });
    } catch (error) {
      console.error('Error creating package delayed notification:', error);
    }
    next();
  }

  static async onDeliveryException(req, res, next) {
    try {
      const order = res.locals.order;
      const exception = res.locals.exception;

      await notificationService.create({
        recipient: order.customer,
        type: 'DELIVERY_EXCEPTION',
        title: 'Delivery Exception',
        message: `There's been an issue with delivering order #${order.orderNumber}`,
        data: {
          orderId: order.orderNumber,
          exceptionType: exception.type,
          exceptionReason: exception.reason,
          nextAttempt: exception.nextAttempt,
          actionRequired: exception.actionRequired,
          contactInfo: exception.contactInfo,
        },
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        priority: 'URGENT',
        metadata: {
          category: 'delivery',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/delivery-issue`,
        },
      });
    } catch (error) {
      console.error('Error creating delivery exception notification:', error);
    }
    next();
  }

  static async onCustomsHold(req, res, next) {
    try {
      const order = res.locals.order;
      const customs = res.locals.customs;

      await notificationService.create({
        recipient: order.customer,
        type: 'CUSTOMS_HOLD',
        title: 'Package Held at Customs',
        message: `Your international order #${order.orderNumber} is held at customs.`,
        data: {
          orderId: order.orderNumber,
          holdReason: customs.holdReason,
          documentsRequired: customs.documentsRequired,
          customsLocation: customs.location,
          expectedReleaseDate: customs.expectedReleaseDate,
          contactInfo: customs.contactInfo,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'customs',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/customs`,
        },
      });
    } catch (error) {
      console.error('Error creating customs hold notification:', error);
    }
    next();
  }

  static async onPackageReturned(req, res, next) {
    try {
      const order = res.locals.order;
      const returnInfo = res.locals.returnInfo;

      await notificationService.create({
        recipient: order.customer,
        type: 'PACKAGE_RETURNED',
        title: 'Package Returned to Sender',
        message: `Your order #${order.orderNumber} package has been returned to us.`,
        data: {
          orderId: order.orderNumber,
          returnReason: returnInfo.reason,
          returnedAt: new Date(),
          refundOptions: returnInfo.refundOptions,
          reshipOptions: returnInfo.reshipOptions,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'return-to-sender',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/returned`,
        },
      });
    } catch (error) {
      console.error('Error creating package returned notification:', error);
    }
    next();
  }

  // ==== SUPPORT NOTIFICATIONS (5) ====

  static async onTicketUpdated(req, res, next) {
    try {
      const ticket = res.locals.ticket;
      const update = res.locals.update;

      await notificationService.create({
        recipient: ticket.customerId,
        type: 'TICKET_UPDATED',
        title: 'Support Ticket Updated',
        message: `Your support ticket #${ticket.ticketNumber} has been updated.`,
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          updateType: update.type,
          message: update.message,
          updated_by: update.updated_by,
          updatedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'support',
          relatedResource: ticket._id,
          resourceModel: 'Ticket',
          actionUrl: `/support/tickets/${ticket._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating ticket updated notification:', error);
    }
    next();
  }

  static async onTicketReopened(req, res, next) {
    try {
      const ticket = res.locals.ticket;

      await notificationService.create({
        recipient: ticket.customerId,
        type: 'TICKET_REOPENED',
        title: 'Support Ticket Reopened',
        message: `Your support ticket #${ticket.ticketNumber} has been reopened.`,
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          reopenedAt: new Date(),
          reopenReason: res.locals.reopenReason,
          assignedAgent: res.locals.assignedAgent,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'support',
          relatedResource: ticket._id,
          resourceModel: 'Ticket',
          actionUrl: `/support/tickets/${ticket._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating ticket reopened notification:', error);
    }
    next();
  }

  static async onSupportAgentAssigned(req, res, next) {
    try {
      const ticket = res.locals.ticket;
      const agent = res.locals.agent;

      await notificationService.create({
        recipient: ticket.customerId,
        type: 'SUPPORT_AGENT_ASSIGNED',
        title: 'Support Agent Assigned',
        message: `${agent.name} has been assigned to your support ticket #${ticket.ticketNumber}.`,
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          agentId: agent._id,
          agentName: agent.name,
          assignedAt: new Date(),
          agentExperience: agent.experience,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'support',
          relatedResource: ticket._id,
          resourceModel: 'Ticket',
          actionUrl: `/support/tickets/${ticket._id}`,
        },
      });
    } catch (error) {
      console.error('Error creating support agent assigned notification:', error);
    }
    next();
  }

  static async onSupportFeedbackReceived(req, res, next) {
    try {
      const feedback = res.locals.feedback;
      const supportTeam = await User.find({ role: { $in: ['admin', 'support_manager'] } });

      for (const member of supportTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'SUPPORT_FEEDBACK_RECEIVED',
          title: 'Customer Feedback Received',
          message: `Customer feedback received for ticket #${feedback.ticketNumber} - Rating: ${feedback.rating}/5`,
          data: {
            feedbackId: feedback._id,
            ticketId: feedback.ticketId,
            ticketNumber: feedback.ticketNumber,
            rating: feedback.rating,
            comment: feedback.comment,
            customerId: feedback.customerId,
            receivedAt: new Date(),
          },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: {
            category: 'feedback',
            relatedResource: feedback._id,
            resourceModel: 'Feedback',
            actionUrl: `/admin/support/feedback/${feedback._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating support feedback received notification:', error);
    }
    next();
  }

  static async onKnowledgeBaseUpdated(req, res, next) {
    try {
      const article = res.locals.article;
      const users = res.locals.interestedUsers || [];

      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'KNOWLEDGE_BASE_UPDATED',
          title: 'Help Article Updated',
          message: `The help article "${article.title}" has been updated with new information.`,
          data: {
            articleId: article._id,
            articleTitle: article.title,
            category: article.category,
            updatedAt: new Date(),
            updateType: res.locals.updateType,
            articleUrl: res.locals.articleUrl,
          },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: {
            category: 'knowledge-base',
            relatedResource: article._id,
            resourceModel: 'Article',
            actionUrl: `/help/${article._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating knowledge base updated notification:', error);
    }
    next();
  }

  // ==== PRODUCT NOTIFICATIONS (6) ====

  static async onProductUpdated(req, res, next) {
    try {
      const product = res.locals.product;
      const changes = res.locals.changes;
      const interestedUsers = res.locals.interestedUsers || [];

      for (const user of interestedUsers) {
        await notificationService.create({
          recipient: user._id,
          type: 'PRODUCT_UPDATED',
          title: 'Product Updated',
          message: `"${product.name}" has been updated.`,
          data: {
            productId: product._id,
            productName: product.name,
            changes: changes,
            updatedAt: new Date(),
            price: product.price,
          },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: {
            category: 'product',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating product updated notification:', error);
    }
    next();
  }

  static async onProductDeleted(req, res, next) {
    try {
      const product = res.locals.product;
      const alternatives = res.locals.alternatives || [];
      const affectedUsers = res.locals.affectedUsers || [];

      for (const user of affectedUsers) {
        await notificationService.create({
          recipient: user._id,
          type: 'PRODUCT_DELETED',
          title: 'Product No Longer Available',
          message: `"${product.name}" is no longer available.`,
          data: {
            productId: product._id,
            productName: product.name,
            deletedAt: new Date(),
            reason: res.locals.deletionReason,
            alternatives: alternatives.slice(0, 3),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'product',
            relatedResource: product._id,
            resourceModel: 'Product',
          },
        });
      }
    } catch (error) {
      console.error('Error creating product deleted notification:', error);
    }
    next();
  }

  static async onProductFeatured(req, res, next) {
    try {
      const product = res.locals.product;
      const targetUsers = res.locals.targetUsers || [];

      for (const user of targetUsers) {
        await notificationService.create({
          recipient: user._id,
          type: 'PRODUCT_FEATURED',
          title: 'Featured Product',
          message: `Check out our featured product: "${product.name}"`,
          data: {
            productId: product._id,
            productName: product.name,
            featuredAt: new Date(),
            specialOffer: res.locals.specialOffer,
            price: product.price,
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'featured',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating product featured notification:', error);
    }
    next();
  }

  static async onProductReviewed(req, res, next) {
    try {
      const review = res.locals.review;
      const product = res.locals.product;

      // Notify product owner/admin
      const productManagers = await User.find({ role: { $in: ['admin', 'product_manager'] } });

      for (const manager of productManagers) {
        await notificationService.create({
          recipient: manager._id,
          type: 'PRODUCT_REVIEWED',
          title: 'New Product Review',
          message: `New ${review.rating}-star review for "${product.name}"`,
          data: {
            reviewId: review._id,
            productId: product._id,
            productName: product.name,
            rating: review.rating,
            reviewText: review.text?.substring(0, 100),
            customerId: review.customerId,
            reviewedAt: new Date(),
          },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: {
            category: 'review',
            relatedResource: review._id,
            resourceModel: 'Review',
            actionUrl: `/admin/reviews/${review._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating product reviewed notification:', error);
    }
    next();
  }

  static async onProductQaAnswered(req, res, next) {
    try {
      const question = res.locals.question;
      const answer = res.locals.answer;

      await notificationService.create({
        recipient: question.customerId,
        type: 'PRODUCT_QA_ANSWERED',
        title: 'Your Question Was Answered',
        message: `Your question about "${question.productName}" has been answered.`,
        data: {
          questionId: question._id,
          productId: question.productId,
          productName: question.productName,
          question: question.text,
          answer: answer.text,
          answeredAt: new Date(),
          answeredBy: answer.answeredBy,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'qa',
          relatedResource: question._id,
          resourceModel: 'ProductQuestion',
          actionUrl: `/products/${question.productId}#qa`,
        },
      });
    } catch (error) {
      console.error('Error creating product QA answered notification:', error);
    }
    next();
  }

  static async onProductQaPosted(req, res, next) {
    try {
      const question = res.locals.question;
      const productExperts = await User.find({ role: { $in: ['admin', 'product_expert'] } });

      for (const expert of productExperts) {
        await notificationService.create({
          recipient: expert._id,
          type: 'PRODUCT_QA_POSTED',
          title: 'New Product Question',
          message: `New question posted for "${question.productName}"`,
          data: {
            questionId: question._id,
            productId: question.productId,
            productName: question.productName,
            question: question.text,
            customerId: question.customerId,
            postedAt: new Date(),
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'qa',
            relatedResource: question._id,
            resourceModel: 'ProductQuestion',
            actionUrl: `/admin/qa/${question._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating product QA posted notification:', error);
    }
    next();
  }

  // ==== INVENTORY NOTIFICATIONS (3) ====

  static async onRestockRequested(req, res, next) {
    try {
      const request = res.locals.restockRequest;
      const inventoryManagers = await User.find({ role: { $in: ['admin', 'inventory_manager'] } });

      for (const manager of inventoryManagers) {
        await notificationService.create({
          recipient: manager._id,
          type: 'RESTOCK_REQUESTED',
          title: 'Restock Request',
          message: `Restock requested for "${request.productName}"`,
          data: {
            requestId: request._id,
            productId: request.productId,
            productName: request.productName,
            requestedQuantity: request.quantity,
            currentStock: request.currentStock,
            requestedBy: request.requestedBy,
            requestedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'inventory',
            relatedResource: request._id,
            resourceModel: 'RestockRequest',
            actionUrl: `/admin/inventory/restock/${request._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating restock requested notification:', error);
    }
    next();
  }

  static async onInventoryAuditCompleted(req, res, next) {
    try {
      const audit = res.locals.audit;
      const inventoryTeam = await User.find({ role: { $in: ['admin', 'inventory_manager'] } });

      for (const member of inventoryTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'INVENTORY_AUDIT_COMPLETED',
          title: 'Inventory Audit Completed',
          message: `Inventory audit for ${audit.location} has been completed.`,
          data: {
            auditId: audit._id,
            location: audit.location,
            completedAt: new Date(),
            discrepancies: audit.discrepancies,
            totalItems: audit.totalItems,
            auditedBy: audit.auditedBy,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'audit',
            relatedResource: audit._id,
            resourceModel: 'InventoryAudit',
            actionUrl: `/admin/inventory/audits/${audit._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating inventory audit completed notification:', error);
    }
    next();
  }

  static async onSupplierDelay(req, res, next) {
    try {
      const delay = res.locals.supplierDelay;
      const procurementTeam = await User.find({ role: { $in: ['admin', 'procurement_manager'] } });

      for (const member of procurementTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'SUPPLIER_DELAY',
          title: 'Supplier Delay Alert',
          message: `Supplier ${delay.supplierName} has reported a delay for order ${delay.purchaseOrderId}.`,
          data: {
            delayId: delay._id,
            supplierId: delay.supplierId,
            supplierName: delay.supplierName,
            purchaseOrderId: delay.purchaseOrderId,
            originalDeliveryDate: delay.originalDeliveryDate,
            newDeliveryDate: delay.newDeliveryDate,
            delayReason: delay.reason,
            affectedProducts: delay.affectedProducts,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'supplier',
            relatedResource: delay._id,
            resourceModel: 'SupplierDelay',
            actionUrl: `/admin/procurement/delays/${delay._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating supplier delay notification:', error);
    }
    next();
  }

  // ==== CUSTOM NOTIFICATIONS (3) ====

  static async onCustomNotification(req, res, next) {
    try {
      const notification = res.locals.customNotification;

      await notificationService.create({
        recipient: notification.recipient,
        type: 'CUSTOM',
        title: notification.title || 'Custom Notification',
        message: notification.message,
        data: notification.data || {},
        channels: notification.channels || ['IN_APP'],
        priority: notification.priority || 'MEDIUM',
        metadata: {
          category: 'custom',
          relatedResource: notification.relatedResource,
          resourceModel: notification.resourceModel || 'Custom',
          actionUrl: notification.actionUrl,
        },
      });
    } catch (error) {
      console.error('Error creating custom notification:', error);
    }
    next();
  }

  static async onUserDefinedEvent1(req, res, next) {
    try {
      const event = res.locals.userDefinedEvent1;

      await notificationService.create({
        recipient: event.recipient,
        type: 'USER_DEFINED_EVENT1',
        title: event.title || 'User Defined Event 1',
        message: event.message,
        data: event.data || {},
        channels: event.channels || ['IN_APP'],
        priority: event.priority || 'MEDIUM',
        metadata: {
          category: 'custom',
          relatedResource: event.relatedResource,
          resourceModel: event.resourceModel || 'UserEvent',
          actionUrl: event.actionUrl,
        },
      });
    } catch (error) {
      console.error('Error creating user defined event 1 notification:', error);
    }
    next();
  }

  static async onUserDefinedEvent2(req, res, next) {
    try {
      const event = res.locals.userDefinedEvent2;

      await notificationService.create({
        recipient: event.recipient,
        type: 'USER_DEFINED_EVENT2',
        title: event.title || 'User Defined Event 2',
        message: event.message,
        data: event.data || {},
        channels: event.channels || ['IN_APP'],
        priority: event.priority || 'MEDIUM',
        metadata: {
          category: 'custom',
          relatedResource: event.relatedResource,
          resourceModel: event.resourceModel || 'UserEvent',
          actionUrl: event.actionUrl,
        },
      });
    } catch (error) {
      console.error('Error creating user defined event 2 notification:', error);
    }
    next();
  }

  // ==== DUAL NOTIFICATIONS (Admin + User) - Optimized Single Methods ====

  /**
   * Order created - Notifies both customer and admin
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static async onOrderCreatedDual(req, res, next) {
    try {
      const order = res.locals.order;

      // Customer notification
      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_CREATED',
        title: 'Order Confirmed',
        message: `Your order #${order.orderNumber} has been confirmed.`,
        data: {
          orderId: order.orderNumber,
          totalAmount: order.totalAmount,
          itemCount: order.items?.length || 0,
          estimatedDelivery: order.estimatedDelivery,
          paymentMethod: order.paymentMethod,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'order',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}`,
        },
      });

      // Admin notifications
      const admins = await User.find({ role: { $in: ['admin', 'sales_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'NEW_ORDER_PLACED',
          title: 'New Order Placed',
          message: `New order #${order.orderNumber} placed for $${order.totalAmount}`,
          data: {
            orderId: order.orderNumber,
            customerId: order.customer,
            amount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            placedAt: new Date(),
            itemCount: order.items?.length || 0,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: order.totalAmount > 500 ? 'HIGH' : 'MEDIUM', // High priority for high-value orders
          metadata: {
            category: 'sales',
            relatedResource: order._id,
            resourceModel: 'Order',
            actionUrl: `/admin/orders/${order._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual order created notifications:', error);
    }
    next();
  }

  /**
   * Payment failed - Notifies both customer and admin
   */
  static async onPaymentFailedDual(req, res, next) {
    try {
      const order = res.locals.order;
      const paymentError = res.locals.paymentError;

      // Customer notification
      await notificationService.create({
        recipient: order.customer,
        type: 'PAYMENT_FAILED',
        title: 'Payment Failed',
        message: `Payment for order #${order.orderNumber} has failed.`,
        data: {
          orderId: order.orderNumber,
          amount: order.totalAmount,
          failureReason: paymentError.reason,
          failedAt: new Date(),
          retryOptions: res.locals.retryOptions,
        },
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        priority: 'URGENT',
        metadata: {
          category: 'payment',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/payment-retry`,
        },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'finance_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'PAYMENT_FAILED',
          title: 'Payment Failure Alert',
          message: `Payment failed for order #${order.orderNumber} - $${order.totalAmount}`,
          data: {
            orderId: order.orderNumber,
            customerId: order.customer,
            amount: order.totalAmount,
            failureReason: paymentError.reason,
            paymentMethod: order.paymentMethod,
            failedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'payment-alert',
            relatedResource: order._id,
            resourceModel: 'Order',
            actionUrl: `/admin/payments/failed/${order._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual payment failed notifications:', error);
    }
    next();
  }

  /**
   * Return request - Notifies both customer and admin
   */
  static async onReturnRequestDual(req, res, next) {
    try {
      const returnRequest = res.locals.returnRequest;

      // Customer notification
      await notificationService.create({
        recipient: returnRequest.customer,
        type: 'RETURN_REQUEST_RECEIVED',
        title: 'Return Request Received',
        message: `We've received your return request #${returnRequest.returnNumber}.`,
        data: {
          returnId: returnRequest.returnNumber,
          orderId: returnRequest.orderId,
          items: returnRequest.items,
          reason: returnRequest.reason,
          requestedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'return',
          relatedResource: returnRequest._id,
          resourceModel: 'Return',
          actionUrl: `/returns/${returnRequest._id}`,
        },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'customer_service'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'RETURN_REQUEST_NOTIFICATION',
          title: 'New Return Request',
          message: `Return request #${returnRequest.returnNumber} submitted for order #${returnRequest.orderId}`,
          data: {
            returnId: returnRequest.returnNumber,
            orderId: returnRequest.orderId,
            customerId: returnRequest.customer,
            items: returnRequest.items,
            reason: returnRequest.reason,
            requestedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'return',
            relatedResource: returnRequest._id,
            resourceModel: 'Return',
            actionUrl: `/admin/returns/${returnRequest._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual return request notifications:', error);
    }
    next();
  }

  /**
   * Refund processed - Notifies both customer and admin
   */
  static async onRefundProcessedDual(req, res, next) {
    try {
      const refund = res.locals.refund;

      // Customer notification
      await notificationService.create({
        recipient: refund.customer,
        type: 'REFUND_PROCESSED',
        title: 'Refund Processed',
        message: `Your refund of $${refund.amount} has been processed.`,
        data: {
          refundId: refund._id,
          amount: refund.amount,
          refundMethod: refund.method,
          processedAt: new Date(),
          expectedInAccount: res.locals.expectedInAccount,
          transactionId: refund.transactionId,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'refund',
          relatedResource: refund._id,
          resourceModel: 'Refund',
        },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'finance_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'REFUND_PROCESSED_NOTIFICATION',
          title: 'Refund Processed',
          message: `Refund of $${refund.amount} has been processed.`,
          data: {
            refundId: refund._id,
            amount: refund.amount,
            customerId: refund.customer,
            orderId: refund.orderId,
            refundMethod: refund.method,
            processedAt: new Date(),
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'refund',
            relatedResource: refund._id,
            resourceModel: 'Refund',
            actionUrl: `/admin/refunds/${refund._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual refund processed notifications:', error);
    }
    next();
  }

  /**
   * User registration - Notifies both user (welcome) and admin (new user alert)
   */
  static async onUserRegistrationDual(req, res, next) {
    try {
      const user = res.locals.createdUser || req.body;

      // Welcome notification to user
      await notificationService.create({
        recipient: user._id,
        type: 'USER_CREATED',
        title: 'Welcome to our platform!',
        message: `Welcome ${user.username}! Your account has been successfully created.`,
        data: {
          username: user.username,
          email: user.email,
          registeredAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'user',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'user_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'NEW_USER_REGISTERED',
          title: 'New User Registration',
          message: `New user "${user.username}" has registered.`,
          data: {
            userId: user._id,
            username: user.username,
            email: user.email,
            registeredAt: new Date(),
            registrationSource: res.locals.registrationSource,
          },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: {
            category: 'user',
            relatedResource: user._id,
            resourceModel: 'User',
            actionUrl: `/admin/users/${user._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual user registration notifications:', error);
    }
    next();
  }

  /**
   * Support ticket - Notifies both customer and support team
   */
  static async onSupportTicketDual(req, res, next) {
    try {
      const ticket = res.locals.ticket;

      // Customer confirmation
      await notificationService.create({
        recipient: ticket.customerId,
        type: 'TICKET_CREATED',
        title: 'Support Ticket Created',
        message: `Your support ticket #${ticket.ticketNumber} has been created.`,
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          priority: ticket.priority,
          createdAt: new Date(),
          expectedResponse: res.locals.expectedResponse,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'support',
          relatedResource: ticket._id,
          resourceModel: 'Ticket',
          actionUrl: `/support/tickets/${ticket._id}`,
        },
      });

      // Support team notification
      const supportAgents = await User.find({ role: { $in: ['admin', 'support_agent'] } });
      for (const agent of supportAgents) {
        await notificationService.create({
          recipient: agent._id,
          type: 'CUSTOMER_SUPPORT_TICKET_CREATED',
          title: 'New Support Ticket',
          message: `New support ticket #${ticket.ticketNumber} created.`,
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            customerId: ticket.customerId,
            subject: ticket.subject,
            priority: ticket.priority,
            category: ticket.category,
            createdAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: ticket.priority === 'urgent' ? 'URGENT' : 'MEDIUM',
          metadata: {
            category: 'support',
            relatedResource: ticket._id,
            resourceModel: 'Ticket',
            actionUrl: `/admin/support/tickets/${ticket._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual support ticket notifications:', error);
    }
    next();
  }

  /**
   * Product review - Notifies both customer (thank you) and product team (new review)
   */
  static async onProductReviewDual(req, res, next) {
    try {
      const review = res.locals.review;
      const order = res.locals.order;

      // Customer thank you
      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_REVIEWED',
        title: 'Thank You for Your Review',
        message: `Thank you for reviewing order #${order.orderNumber}!`,
        data: {
          orderId: order.orderNumber,
          reviewId: review._id,
          rating: review.rating,
          reviewedAt: new Date(),
          loyaltyPoints: res.locals.loyaltyPointsEarned,
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'review',
          relatedResource: review._id,
          resourceModel: 'Review',
          actionUrl: `/orders/${order._id}/review`,
        },
      });

      // Product team/admin notification
      const productTeam = await User.find({ role: { $in: ['admin', 'product_manager', 'content_moderator'] } });
      for (const member of productTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'NEW_REVIEW_SUBMITTED',
          title: 'New Review for Moderation',
          message: `New ${review.rating}-star review submitted for "${review.productName}".`,
          data: {
            reviewId: review._id,
            productId: review.productId,
            productName: review.productName,
            rating: review.rating,
            reviewText: review.text?.substring(0, 100) + '...',
            submittedAt: new Date(),
            needsModeration: review.needsModeration,
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'review',
            relatedResource: review._id,
            resourceModel: 'Review',
            actionUrl: `/admin/reviews/${review._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual product review notifications:', error);
    }
    next();
  }

  /**
   * Payment dispute - Notifies both customer and finance team
   */
  static async onPaymentDisputeDual(req, res, next) {
    try {
      const dispute = res.locals.dispute;

      // Customer notification
      await notificationService.create({
        recipient: dispute.customer,
        type: 'PAYMENT_DISPUTE_INITIATED',
        title: 'Payment Dispute Initiated',
        message: `Your payment dispute for transaction ${dispute.transactionId} has been initiated.`,
        data: {
          disputeId: dispute._id,
          transactionId: dispute.transactionId,
          amount: dispute.amount,
          reason: dispute.reason,
          initiatedAt: new Date(),
          expectedResolution: res.locals.expectedResolution,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'dispute',
          relatedResource: dispute._id,
          resourceModel: 'PaymentDispute',
        },
      });

      // Admin/finance team notification
      const financeTeam = await User.find({ role: { $in: ['admin', 'finance_manager'] } });
      for (const member of financeTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'PAYMENT_DISPUTE_ALERT',
          title: 'Payment Dispute Alert',
          message: `Payment dispute initiated for transaction ${dispute.transactionId}`,
          data: {
            disputeId: dispute._id,
            transactionId: dispute.transactionId,
            amount: dispute.amount,
            reason: dispute.reason,
            customerId: dispute.customerId,
            initiatedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'dispute',
            relatedResource: dispute._id,
            resourceModel: 'PaymentDispute',
            actionUrl: `/admin/disputes/${dispute._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual payment dispute notifications:', error);
    }
    next();
  }

  /**
   * Account security issue - Notifies both user and security team
   */
  static async onSecurityIssueDual(req, res, next) {
    try {
      const user = res.locals.user;
      const securityEvent = res.locals.securityEvent;

      // User notification
      await notificationService.create({
        recipient: user._id,
        type: 'SECURITY_ALERT',
        title: 'Security Alert',
        message: securityEvent.userMessage,
        data: {
          eventType: securityEvent.type,
          detectedAt: new Date(),
          actionRequired: securityEvent.actionRequired,
          recommendations: securityEvent.recommendations,
          ipAddress: securityEvent.ipAddress,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'URGENT',
        metadata: {
          category: 'security',
          relatedResource: user._id,
          resourceModel: 'User',
        },
      });

      // Security team notification
      const securityTeam = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const member of securityTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'SUSPICIOUS_ACCOUNT_ACTIVITY',
          title: 'Security Event Alert',
          message: `Security event detected for user ${user._id}`,
          data: {
            userId: user._id,
            eventType: securityEvent.type,
            severity: securityEvent.severity,
            detectedAt: new Date(),
            ipAddress: securityEvent.ipAddress,
            userAgent: securityEvent.userAgent,
            riskScore: securityEvent.riskScore,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'security',
            relatedResource: user._id,
            resourceModel: 'User',
            actionUrl: `/admin/security/events/${user._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual security issue notifications:', error);
    }
    next();
  }

  /**
   * System maintenance - Notifies both users and admins with different priorities
   */
  static async onSystemMaintenanceDual(req, res, next) {
    try {
      const maintenance = res.locals.maintenance;

      // User notifications (lower priority, basic info)
      const users = await User.find({ isActive: true });
      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'MAINTENANCE_SCHEDULED',
          title: 'Scheduled Maintenance',
          message: `System maintenance is scheduled for ${maintenance.scheduledDate}.`,
          data: {
            scheduledDate: maintenance.scheduledDate,
            estimatedDuration: maintenance.estimatedDuration,
            affectedServices: maintenance.affectedServices,
            userImpact: maintenance.userImpact,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'maintenance',
            relatedResource: maintenance._id,
            resourceModel: 'Maintenance',
          },
        });
      }

      // Admin notifications (higher priority, detailed info)
      const admins = await User.find({ role: { $in: ['admin', 'tech_support'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'MAINTENANCE_SCHEDULED',
          title: 'System Maintenance Scheduled',
          message: `System maintenance scheduled: ${maintenance.title}`,
          data: {
            maintenanceId: maintenance._id,
            title: maintenance.title,
            scheduledDate: maintenance.scheduledDate,
            estimatedDuration: maintenance.estimatedDuration,
            affectedServices: maintenance.affectedServices,
            maintenanceType: maintenance.type,
            assignedTeam: maintenance.assignedTeam,
            rollbackPlan: maintenance.rollbackPlan,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'maintenance',
            relatedResource: maintenance._id,
            resourceModel: 'Maintenance',
            actionUrl: `/admin/maintenance/${maintenance._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual system maintenance notifications:', error);
    }
    next();
  }

  /**
   * Product out of stock - Notifies both interested customers and inventory managers
   */
  static async onProductOutOfStockDual(req, res, next) {
    try {
      const product = res.locals.product;
      const interestedUsers = res.locals.interestedUsers || [];

      // Customer notifications (for those who have the item in cart/wishlist)
      for (const user of interestedUsers) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'PRODUCT_OUT_OF_STOCK',
          title: 'Product Out of Stock',
          message: `"${product.name}" is currently out of stock.`,
          data: {
            productId: product._id,
            productName: product.name,
            outOfStockAt: new Date(),
            alternatives: res.locals.alternatives || [],
            restockAlert: true,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'inventory',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/products/${product._id}`,
          },
        });
      }

      // Admin/inventory manager notifications
      const inventoryManagers = await User.find({ role: { $in: ['admin', 'inventory_manager'] } });
      for (const manager of inventoryManagers) {
        await notificationService.create({
          recipient: manager._id,
          type: 'OUT_OF_STOCK_ALERT',
          title: 'Out of Stock Alert',
          message: `Product "${product.name}" is now out of stock!`,
          data: {
            productId: product._id,
            productName: product.name,
            outOfStockAt: new Date(),
            lastStockLevel: res.locals.lastStockLevel,
            pendingOrders: res.locals.pendingOrders,
            category: product.category,
            reorderPoint: product.reorderPoint,
            supplier: product.supplier,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'inventory',
            relatedResource: product._id,
            resourceModel: 'Product',
            actionUrl: `/admin/inventory/${product._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error creating dual product out of stock notifications:', error);
    }
    next();
  }

  // All Dual Notifications (continued) - New Implementations

  static async onPasswordResetDual(req, res, next) {
    try {
      const user = res.locals.user;
      const resetToken = res.locals.resetToken;

      // Customer notification
      await notificationService.create({
        recipient: user._id,
        type: 'PASSWORD_RESET_REQUESTED',
        title: 'Password Reset Requested',
        message: 'You requested a password reset. Use the link sent to your email.',
        data: { resetToken, expiresAt: res.locals.expiresAt },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: { category: 'security', relatedResource: user._id, resourceModel: 'User' },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'USER_PASSWORD_RESET_ALERT',
          title: 'User Password Reset',
          message: `User ${user.username} requested a password reset.`,
          data: { userId: user._id, requestedAt: new Date() },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: { category: 'security', relatedResource: user._id, resourceModel: 'User' },
        });
      }
    } catch (error) {
      console.error('Error in onPasswordResetDual:', error);
    }
    next();
  }

  // 2. Subscription renewal reminder dual notification
  static async onSubscriptionRenewalReminderDual(req, res, next) {
    try {
      const user = res.locals.user;
      const sub = res.locals.subscription;

      // Customer notification
      await notificationService.create({
        recipient: user._id,
        type: 'SUBSCRIPTION_RENEWAL_REMINDER',
        title: 'Subscription Renewal Reminder',
        message: `Your ${sub.planName} subscription renews on ${sub.nextBillingDate}.`,
        data: { subscriptionId: sub._id, nextBillingDate: sub.nextBillingDate },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: { category: 'subscription', relatedResource: sub._id, resourceModel: 'Subscription' },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'finance_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'SUBSCRIPTION_RENEWAL_FORECAST',
          title: 'Upcoming Subscription Renewal',
          message: `Subscription for ${user.username} renews on ${sub.nextBillingDate}.`,
          data: { userId: user._id, subscriptionId: sub._id, renewalDate: sub.nextBillingDate },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'LOW',
          metadata: { category: 'subscription', relatedResource: sub._id, resourceModel: 'Subscription' },
        });
      }
    } catch (error) {
      console.error('Error in onSubscriptionRenewalReminderDual:', error);
    }
    next();
  }

  // 3. Invoice overdue dual notification
  static async onInvoiceOverdueDual(req, res, next) {
    try {
      const invoice = res.locals.invoice;

      // Customer notification
      await notificationService.create({
        recipient: invoice.customer,
        type: 'INVOICE_OVERDUE',
        title: 'Invoice Overdue',
        message: `Invoice #${invoice.invoiceNumber} is overdue. Please pay now.`,
        data: { invoiceId: invoice._id, dueDate: invoice.dueDate },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: { category: 'billing', relatedResource: invoice._id, resourceModel: 'Invoice' },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'finance_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'INVOICE_OVERDUE_ALERT',
          title: 'Customer Invoice Overdue',
          message: `Invoice #${invoice.invoiceNumber} for ${invoice.customer} is overdue.`,
          data: { invoiceId: invoice._id, customerId: invoice.customer },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: { category: 'billing', relatedResource: invoice._id, resourceModel: 'Invoice' },
        });
      }
    } catch (error) {
      console.error('Error in onInvoiceOverdueDual:', error);
    }
    next();
  }

  // 4. Fraudulent transaction dual notification
  static async onFraudulentTransactionDual(req, res, next) {
    try {
      const txn = res.locals.transaction;
      const user = res.locals.user;

      // Customer notification
      await notificationService.create({
        recipient: user._id,
        type: 'FRAUDULENT_TRANSACTION_ALERT',
        title: 'Suspicious Transaction Detected',
        message: `A suspicious transaction of $${txn.amount} was detected on your account.`,
        data: { transactionId: txn.id, amount: txn.amount, detectedAt: new Date() },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'URGENT',
        metadata: { category: 'security', relatedResource: user._id, resourceModel: 'User' },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'FRAUDULENT_ACTIVITY_DETECTED',
          title: 'Fraudulent Activity Alert',
          message: `Suspicious transaction ${txn.id} by user ${user.username}.`,
          data: { transactionId: txn.id, userId: user._id, riskScore: txn.riskScore },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'URGENT',
          metadata: { category: 'fraud', relatedResource: txn.id, resourceModel: 'Transaction' },
        });
      }
    } catch (error) {
      console.error('Error in onFraudulentTransactionDual:', error);
    }
    next();
  }

  // 5. High-value cart abandonment dual notification
  static async onHighValueCartAbandonmentDual(req, res, next) {
    try {
      const user = res.locals.user;
      const cart = res.locals.cart;

      // Customer notification
      await notificationService.create({
        recipient: user._id,
        type: 'CART_ABANDONMENT',
        title: 'You Left Items in Your Cart',
        message: `You have items worth $${cart.totalAmount} waiting. Complete your purchase!`,
        data: { cartId: cart._id, totalAmount: cart.totalAmount },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: { category: 'shopping', relatedResource: cart._id, resourceModel: 'Cart' },
      });

      // Admin notification for high-value carts
      const admins = await User.find({ role: { $in: ['admin', 'sales_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'HIGH_VALUE_CART_ABANDONMENT',
          title: 'High-Value Cart Abandoned',
          message: `User ${user.username} abandoned a cart worth $${cart.totalAmount}.`,
          data: { userId: user._id, cartId: cart._id, totalAmount: cart.totalAmount },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: { category: 'shopping', relatedResource: cart._id, resourceModel: 'Cart' },
        });
      }
    } catch (error) {
      console.error('Error in onHighValueCartAbandonmentDual:', error);
    }
    next();
  }

  // 1. Order Created – notify both customer and admin
  static async onOrderCreatedDual(req, res, next) {
    try {
      const order = res.locals.order;

      // Customer notification
      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_CREATED',
        title: 'Order Confirmed',
        message: `Your order #${order.orderNumber} has been confirmed.`,
        data: {
          orderId: order.orderNumber,
          totalAmount: order.totalAmount,
          itemCount: order.items?.length || 0,
          estimatedDelivery: order.estimatedDelivery,
          paymentMethod: order.paymentMethod,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'order',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}`,
        },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'sales_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'NEW_ORDER_PLACED',
          title: 'New Order Placed',
          message: `New order #${order.orderNumber} placed for $${order.totalAmount}`,
          data: {
            orderId: order.orderNumber,
            customerId: order.customer,
            amount: order.totalAmount,
            paymentMethod: order.paymentMethod,
            placedAt: new Date(),
            itemCount: order.items?.length || 0,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: order.totalAmount > 500 ? 'HIGH' : 'MEDIUM',
          metadata: {
            category: 'sales',
            relatedResource: order._id,
            resourceModel: 'Order',
            actionUrl: `/admin/orders/${order._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error in onOrderCreatedDual:', error);
    }
    next();
  }

  // 2. Payment Failed – notify both customer and finance team
  static async onPaymentFailedDual(req, res, next) {
    try {
      const order = res.locals.order;
      const paymentError = res.locals.paymentError;

      // Customer notification
      await notificationService.create({
        recipient: order.customer,
        type: 'PAYMENT_FAILED',
        title: 'Payment Failed',
        message: `Payment for order #${order.orderNumber} has failed.`,
        data: {
          orderId: order.orderNumber,
          amount: order.totalAmount,
          failureReason: paymentError.reason,
          failedAt: new Date(),
          retryOptions: res.locals.retryOptions,
        },
        channels: ['IN_APP', 'EMAIL', 'SMS'],
        priority: 'URGENT',
        metadata: {
          category: 'payment',
          relatedResource: order._id,
          resourceModel: 'Order',
          actionUrl: `/orders/${order._id}/payment-retry`,
        },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'finance_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'PAYMENT_FAILED',
          title: 'Payment Failure Alert',
          message: `Payment failed for order #${order.orderNumber} – $${order.totalAmount}`,
          data: {
            orderId: order.orderNumber,
            customerId: order.customer,
            amount: order.totalAmount,
            failureReason: paymentError.reason,
            paymentMethod: order.paymentMethod,
            failedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'payment-alert',
            relatedResource: order._id,
            resourceModel: 'Order',
            actionUrl: `/admin/payments/failed/${order._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error in onPaymentFailedDual:', error);
    }
    next();
  }

  // 3. Return Request – notify both customer and support staff
  static async onReturnRequestDual(req, res, next) {
    try {
      const returnRequest = res.locals.returnRequest;

      // Customer notification
      await notificationService.create({
        recipient: returnRequest.customer,
        type: 'RETURN_REQUEST_RECEIVED',
        title: 'Return Request Received',
        message: `We've received your return request #${returnRequest.returnNumber}.`,
        data: {
          returnId: returnRequest.returnNumber,
          orderId: returnRequest.orderId,
          items: returnRequest.items,
          reason: returnRequest.reason,
          requestedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'return',
          relatedResource: returnRequest._id,
          resourceModel: 'Return',
          actionUrl: `/returns/${returnRequest._id}`,
        },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'customer_service'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'RETURN_REQUEST_NOTIFICATION',
          title: 'New Return Request',
          message: `Return request #${returnRequest.returnNumber} for order #${returnRequest.orderId}.`,
          data: {
            returnId: returnRequest.returnNumber,
            orderId: returnRequest.orderId,
            customerId: returnRequest.customer,
            items: returnRequest.items,
            reason: returnRequest.reason,
            requestedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: {
            category: 'return',
            relatedResource: returnRequest._id,
            resourceModel: 'Return',
            actionUrl: `/admin/returns/${returnRequest._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error in onReturnRequestDual:', error);
    }
    next();
  }

  // 4. Refund Processed – notify both customer and finance team
  static async onRefundProcessedDual(req, res, next) {
    try {
      const refund = res.locals.refund;

      // Customer notification
      await notificationService.create({
        recipient: refund.customer,
        type: 'REFUND_PROCESSED',
        title: 'Refund Processed',
        message: `Your refund of $${refund.amount} has been processed.`,
        data: {
          refundId: refund._id,
          amount: refund.amount,
          refundMethod: refund.method,
          processedAt: new Date(),
          expectedInAccount: res.locals.expectedInAccount,
          transactionId: refund.transactionId,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'refund',
          relatedResource: refund._id,
          resourceModel: 'Refund',
        },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'finance_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'REFUND_PROCESSED_NOTIFICATION',
          title: 'Refund Processed',
          message: `Refund of $${refund.amount} processed for order #${refund.orderId}.`,
          data: {
            refundId: refund._id,
            customerId: refund.customer,
            orderId: refund.orderId,
            amount: refund.amount,
            processedAt: new Date(),
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'refund',
            relatedResource: refund._id,
            resourceModel: 'Refund',
            actionUrl: `/admin/refunds/${refund._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error in onRefundProcessedDual:', error);
    }
    next();
  }

  // 5. User Registration – notify both user and admin
  static async onUserRegistrationDual(req, res, next) {
    try {
      const user = res.locals.createdUser || req.body;

      // Welcome notification to user
      await notificationService.create({
        recipient: user._id,
        type: 'USER_CREATED',
        title: 'Welcome to Our Platform!',
        message: `Hello ${user.username}, your account has been created.`,
        data: { userId: user._id, username: user.username, email: user.email, registeredAt: new Date() },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: { category: 'user', relatedResource: user._id, resourceModel: 'User' },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'user_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'NEW_USER_REGISTERED',
          title: 'New User Registration',
          message: `New user \"${user.username}\" has signed up.`,
          data: { userId: user._id, username: user.username, email: user.email, registeredAt: new Date() },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: {
            category: 'user',
            relatedResource: user._id,
            resourceModel: 'User',
            actionUrl: `/admin/users/${user._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error in onUserRegistrationDual:', error);
    }
    next();
  }

  // 6. Support Ticket Created – notify both customer and support team
  static async onSupportTicketDual(req, res, next) {
    try {
      const ticket = res.locals.ticket;

      // Customer confirmation
      await notificationService.create({
        recipient: ticket.customerId,
        type: 'TICKET_CREATED',
        title: 'Support Ticket Created',
        message: `Your ticket #${ticket.ticketNumber} has been created.`,
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          priority: ticket.priority,
          createdAt: new Date(),
          expectedResponse: res.locals.expectedResponse,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'MEDIUM',
        metadata: {
          category: 'support',
          relatedResource: ticket._id,
          resourceModel: 'Ticket',
          actionUrl: `/support/tickets/${ticket._id}`,
        },
      });

      // Support team notification
      const agents = await User.find({ role: { $in: ['admin', 'support_agent'] } });
      for (const agent of agents) {
        await notificationService.create({
          recipient: agent._id,
          type: 'CUSTOMER_SUPPORT_TICKET_CREATED',
          title: 'New Support Ticket',
          message: `Ticket #${ticket.ticketNumber} requires your attention.`,
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            customerId: ticket.customerId,
            subject: ticket.subject,
            priority: ticket.priority,
            createdAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: ticket.priority === 'urgent' ? 'URGENT' : 'MEDIUM',
          metadata: {
            category: 'support',
            relatedResource: ticket._id,
            resourceModel: 'Ticket',
            actionUrl: `/admin/support/tickets/${ticket._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error in onSupportTicketDual:', error);
    }
    next();
  }

  // 7. Product Review – notify both customer and product team
  static async onProductReviewDual(req, res, next) {
    try {
      const review = res.locals.review;
      const order = res.locals.order;

      // Thank-you to customer
      await notificationService.create({
        recipient: order.customer,
        type: 'ORDER_REVIEWED',
        title: 'Thank You for Your Review',
        message: `Thanks for reviewing order #${order.orderNumber}!`,
        data: {
          orderId: order.orderNumber,
          reviewId: review._id,
          rating: review.rating,
          reviewedAt: new Date(),
          loyaltyPoints: res.locals.loyaltyPointsEarned,
        },
        channels: ['IN_APP'],
        priority: 'LOW',
        metadata: {
          category: 'review',
          relatedResource: review._id,
          resourceModel: 'Review',
          actionUrl: `/orders/${order._id}/review`,
        },
      });

      // Moderation alert to product team
      const team = await User.find({ role: { $in: ['admin', 'product_manager', 'content_moderator'] } });
      for (const member of team) {
        await notificationService.create({
          recipient: member._id,
          type: 'NEW_REVIEW_SUBMITTED',
          title: 'New Product Review',
          message: `New ${review.rating}-star review for "${review.productName}".`,
          data: {
            reviewId: review._id,
            productId: review.productId,
            rating: review.rating,
            reviewText: review.text?.substring(0, 100) + '...',
            customerId: review.customerId,
            submittedAt: new Date(),
          },
          channels: ['IN_APP'],
          priority: 'MEDIUM',
          metadata: {
            category: 'review',
            relatedResource: review._id,
            resourceModel: 'Review',
            actionUrl: `/admin/reviews/${review._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error in onProductReviewDual:', error);
    }
    next();
  }

  // 8. Payment Dispute – notify both customer and finance team
  static async onPaymentDisputeDual(req, res, next) {
    try {
      const dispute = res.locals.dispute;

      // Customer notification
      await notificationService.create({
        recipient: dispute.customer,
        type: 'PAYMENT_DISPUTE_INITIATED',
        title: 'Payment Dispute Initiated',
        message: `Your dispute for transaction ${dispute.transactionId} is in process.`,
        data: {
          disputeId: dispute._id,
          transactionId: dispute.transactionId,
          amount: dispute.amount,
          reason: dispute.reason,
          initiatedAt: new Date(),
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: {
          category: 'dispute',
          relatedResource: dispute._id,
          resourceModel: 'PaymentDispute',
        },
      });

      // Admin/finance alert
      const financeTeam = await User.find({ role: { $in: ['admin', 'finance_manager'] } });
      for (const member of financeTeam) {
        await notificationService.create({
          recipient: member._id,
          type: 'PAYMENT_DISPUTE_ALERT',
          title: 'Payment Dispute Alert',
          message: `Dispute opened for transaction ${dispute.transactionId}.`,
          data: {
            disputeId: dispute._id,
            transactionId: dispute.transactionId,
            amount: dispute.amount,
            customerId: dispute.customer,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'dispute',
            relatedResource: dispute._id,
            resourceModel: 'PaymentDispute',
            actionUrl: `/admin/disputes/${dispute._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error in onPaymentDisputeDual:', error);
    }
    next();
  }

  // 9. Security Issue – notify both user and security team
  static async onSecurityIssueDual(req, res, next) {
    try {
      const user = res.locals.user;
      const event = res.locals.securityEvent;

      // User alert
      await notificationService.create({
        recipient: user._id,
        type: 'SECURITY_ALERT',
        title: 'Security Alert',
        message: event.userMessage,
        data: {
          eventType: event.type,
          detectedAt: new Date(),
          actionRequired: event.actionRequired,
        },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'URGENT',
        metadata: { category: 'security', relatedResource: user._id, resourceModel: 'User' },
      });

      // Security team alert
      const team = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const member of team) {
        await notificationService.create({
          recipient: member._id,
          type: 'SUSPICIOUS_ACCOUNT_ACTIVITY',
          title: 'Security Event Alert',
          message: `Suspicious event for user ${user.username}.`,
          data: {
            userId: user._id,
            eventType: event.type,
            riskScore: event.riskScore,
            detectedAt: new Date(),
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'security',
            relatedResource: user._id,
            resourceModel: 'User',
            actionUrl: `/admin/security/events/${user._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error in onSecurityIssueDual:', error);
    }
    next();
  }

  // 10. System Maintenance – user notice + admin details
  static async onSystemMaintenanceDual(req, res, next) {
    try {
      const maintenance = res.locals.maintenance;

      // User notification
      const users = await User.find({ isActive: true });
      for (const user of users) {
        await notificationService.create({
          recipient: user._id,
          type: 'MAINTENANCE_SCHEDULED',
          title: 'Scheduled Maintenance',
          message: `Maintenance on ${maintenance.scheduledDate}. Some features may be unavailable.`,
          data: { scheduledDate: maintenance.scheduledDate, estimatedDuration: maintenance.estimatedDuration },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: { category: 'maintenance', relatedResource: maintenance._id, resourceModel: 'Maintenance' },
        });
      }

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'tech_support'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'MAINTENANCE_SCHEDULED',
          title: 'System Maintenance Scheduled',
          message: maintenance.title,
          data: {
            maintenanceId: maintenance._id,
            title: maintenance.title,
            scheduledDate: maintenance.scheduledDate,
            estimatedDuration: maintenance.estimatedDuration,
            rollbackPlan: maintenance.rollbackPlan,
          },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: {
            category: 'maintenance',
            relatedResource: maintenance._id,
            resourceModel: 'Maintenance',
            actionUrl: `/admin/maintenance/${maintenance._id}`,
          },
        });
      }
    } catch (error) {
      console.error('Error in onSystemMaintenanceDual:', error);
    }
    next();
  }

  // 11. Product Out of Stock – customers + inventory managers
  static async onProductOutOfStockDual(req, res, next) {
    try {
      const product = res.locals.product;
      const users = res.locals.interestedUsers || [];

      // Customer notification
      for (const user of users) {
        await notificationService.create({
          recipient: user._id || user,
          type: 'PRODUCT_OUT_OF_STOCK',
          title: 'Out of Stock',
          message: `\"${product.name}\" is out of stock.`,
          data: { productId: product._id, discontinuedAt: new Date() },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: { category: 'inventory', relatedResource: product._id, resourceModel: 'Product', actionUrl: `/products/${product._id}` },
        });
      }

      // Admin notification
      const managers = await User.find({ role: { $in: ['admin', 'inventory_manager'] } });
      for (const manager of managers) {
        await notificationService.create({
          recipient: manager._id,
          type: 'OUT_OF_STOCK_ALERT',
          title: 'Out of Stock Alert',
          message: `Product \"${product.name}\" is now out of stock!`,
          data: { productId: product._id, currentStock: product.stock, lastStockLevel: res.locals.lastStockLevel },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: { category: 'inventory', relatedResource: product._id, resourceModel: 'Product', actionUrl: `/admin/inventory/${product._id}` },
        });
      }
    } catch (error) {
      console.error('Error in onProductOutOfStockDual:', error);
    }
    next();
  }
  static async onEmailChangeDual(req, res, next) {
    try {
      const user = res.locals.user;
      const newEmail = res.locals.newEmail;

      // Customer notification
      await notificationService.create({
        recipient: user._id,
        type: 'EMAIL_CHANGE_REQUESTED',
        title: 'Email Change Requested',
        message: `Please confirm your email change to ${newEmail}.`,
        data: { newEmail, token: res.locals.token },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: { category: 'security', relatedResource: user._id },
      });

      // Admin notification
      const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'USER_EMAIL_CHANGE_ALERT',
          title: 'User Email Change Alert',
          message: `User ${user.username} requested an email change.`,
          data: { userId: user._id, newEmail },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: { category: 'security', relatedResource: user._id },
        });
      }
    } catch (err) {
      console.error(err);
    }
    next();
  }

  // 2. Phone Change
  static async onPhoneChangeDual(req, res, next) {
    try {
      const user = res.locals.user;
      const newPhone = res.locals.newPhone;

      await notificationService.create({
        recipient: user._id,
        type: 'PHONE_CHANGE_REQUESTED',
        title: 'Phone Change Requested',
        message: `Please confirm your phone change to ${newPhone}.`,
        data: { newPhone, code: res.locals.code },
        channels: ['IN_APP', 'SMS'],
        priority: 'HIGH',
        metadata: { category: 'security', relatedResource: user._id },
      });

      const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'USER_PHONE_CHANGE_ALERT',
          title: 'User Phone Change Alert',
          message: `User ${user.username} requested phone change.`,
          data: { userId: user._id, newPhone },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: { category: 'security', relatedResource: user._id },
        });
      }
    } catch (err) {
      console.error(err);
    }
    next();
  }

  // 3. Account Deactivated/Reactivated
  static async onAccountStatusDual(req, res, next) {
    try {
      const user = res.locals.user;
      const action = res.locals.action; // 'deactivated' or 'reactivated'

      await notificationService.create({
        recipient: user._id,
        type: action === 'deactivated' ? 'ACCOUNT_DEACTIVATED' : 'ACCOUNT_REACTIVATED',
        title: `Account ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        message: `Your account has been ${action}.`,
        data: { at: new Date(), reason: res.locals.reason },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'URGENT',
        metadata: { category: 'account', relatedResource: user._id },
      });

      const admins = await User.find({ role: { $in: ['admin', 'user_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: action === 'deactivated' ? 'USER_ACCOUNT_DEACTIVATION_ALERT' : 'USER_ACCOUNT_REACTIVATION_ALERT',
          title: `User Account ${action.charAt(0).toUpperCase() + action.slice(1)} Alert`,
          message: `User ${user.username} account ${action}.`,
          data: { userId: user._id, action, at: new Date() },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: { category: 'account', relatedResource: user._id },
        });
      }
    } catch (err) {
      console.error(err);
    }
    next();
  }

  // 4. Account Recovery
  static async onAccountRecoveryDual(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'ACCOUNT_RECOVERY_REQUESTED',
        title: 'Account Recovery Requested',
        message: 'We received your account recovery request.',
        data: { method: res.locals.method, requestedAt: new Date() },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: { category: 'security', relatedResource: user._id },
      });

      const admins = await User.find({ role: { $in: ['admin', 'support_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'ACCOUNT_RECOVERY_ALERT',
          title: 'Account Recovery Alert',
          message: `User ${user.username} initiated account recovery.`,
          data: { userId: user._id, method: res.locals.method },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: { category: 'security', relatedResource: user._id },
        });
      }
    } catch (err) {
      console.error(err);
    }
    next();
  }

  // 5. Identity Verification
  static async onIdentityVerificationDual(req, res, next) {
    try {
      const user = res.locals.user;
      const status = res.locals.status; // 'requested','approved','rejected'

      // Customer
      await notificationService.create({
        recipient: user._id,
        type: `IDENTITY_VERIFICATION_${status.toUpperCase()}`,
        title: `Identity Verification ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Your identity verification was ${status}.`,
        data: { at: new Date(), docs: res.locals.docs },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: { category: 'verification', relatedResource: user._id },
      });

      // Admin
      const admins = await User.find({ role: { $in: ['admin', 'compliance_officer'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'IDENTITY_VERIFICATION_ALERT',
          title: 'Identity Verification Alert',
          message: `User ${user.username} verification ${status}.`,
          data: { userId: user._id, status, at: new Date() },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: { category: 'verification', relatedResource: user._id },
        });
      }
    } catch (err) {
      console.error(err);
    }
    next();
  }

  // SECURITY & AUTHENTICATION

  // 6. Password Reset
  static async onPasswordResetDual(req, res, next) {
    try {
      const user = res.locals.user;
      const token = res.locals.token;

      await notificationService.create({
        recipient: user._id,
        type: 'PASSWORD_RESET_REQUESTED',
        title: 'Password Reset Requested',
        message: 'Use the link sent to your email to reset your password.',
        data: { token, expiresAt: res.locals.expiresAt },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: { category: 'security', relatedResource: user._id },
      });

      const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'USER_PASSWORD_RESET_ALERT',
          title: 'User Password Reset',
          message: `User ${user.username} requested a password reset.`,
          data: { userId: user._id, requestedAt: new Date() },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'MEDIUM',
          metadata: { category: 'security', relatedResource: user._id },
        });
      }
    } catch (err) {
      console.error(err);
    }
    next();
  }

  // 7. Account Locked
  static async onAccountLockoutDual(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'ACCOUNT_LOCKED',
        title: 'Account Locked',
        message: 'Your account has been locked due to security concerns.',
        data: { lockedAt: new Date(), reason: res.locals.reason },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'URGENT',
        metadata: { category: 'security', relatedResource: user._id },
      });

      const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'USER_ACCOUNT_LOCKED_ALERT',
          title: 'User Account Locked Alert',
          message: `User ${user.username} account locked.`,
          data: { userId: user._id, at: new Date() },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: { category: 'security', relatedResource: user._id },
        });
      }
    } catch (err) {
      console.error(err);
    }
    next();
  }

  // 8. OTP Sent
  static async onOtpSentDual(req, res, next) {
    try {
      const user = res.locals.user;
      const otp = res.locals.otp;

      await notificationService.create({
        recipient: user._id,
        type: 'OTP_SENT',
        title: 'Verification Code Sent',
        message: 'Your OTP has been sent.',
        data: { otpType: otp.type, sentTo: otp.sentTo, expiresAt: otp.expiresAt },
        channels: ['IN_APP'],
        priority: 'HIGH',
        metadata: { category: 'security', relatedResource: user._id },
      });

      const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._1,
          type: 'OTP_USAGE_ALERT',
          title: 'OTP Usage Alert',
          message: `OTP sent to user ${user.username}.`,
          data: { userId: user._id, otpType: otp.type },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: { category: 'security', relatedResource: user._id },
        });
      }
    } catch (err) {
      console.error(err);
    }
    next();
  }

  // 9. Multiple Login Attempts
  static async onMultipleLoginAttemptsDual(req, res, next) {
    try {
      const user = res.locals.user;
      const attempts = res.locals.attempts;

      await notificationService.create({
        recipient: user._id,
        type: 'LOGIN_FAILED',
        title: 'Suspicious Login Warning',
        message: `${attempts.count} failed login attempts detected.`,
        data: { count: attempts.count, window: attempts.window, lastAttempt: new Date() },
        channels: ['IN_APP', 'EMAIL'],
        priority: 'HIGH',
        metadata: { category: 'security', relatedResource: user._id },
      });

      const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'MULTIPLE_LOGIN_ATTEMPTS_ALERT',
          title: 'Multiple Login Attempts Alert',
          message: `${attempts.count} failed login attempts for user ${user.username}.`,
          data: { userId: user._id, count: attempts.count },
          channels: ['IN_APP', 'EMAIL'],
          priority: 'HIGH',
          metadata: { category: 'security', relatedResource: user._id },
        });
      }
    } catch (err) {
      console.error(err);
    }
    next();
  }

  // 10. Session Timeout
  static async onSessionTimeoutDual(req, res, next) {
    try {
      const user = res.locals.user;

      await notificationService.create({
        recipient: user._id,
        type: 'SESSION_TIMEOUT',
        title: 'Session Expired',
        message: 'Your session has expired. Please log in again.',
        data: { expiredAt: new Date() },
        channels: ['IN_APP'],
        priority: 'MEDIUM',
        metadata: { category: 'session', relatedResource: user._id },
      });

      const admins = await User.find({ role: { $in: ['admin', 'security_manager'] } });
      for (const admin of admins) {
        await notificationService.create({
          recipient: admin._id,
          type: 'SESSION_EXPIRY_ALERT',
          title: 'Session Expiry Alert',
          message: `Session expired for user ${user.username}.`,
          data: { userId: user._id, expiredAt: new Date() },
          channels: ['IN_APP'],
          priority: 'LOW',
          metadata: { category: 'session', relatedResource: user._id },
        });
      }
    } catch (err) {
      console.error(err);
    }
    next();
  }
}

module.exports = NotificationMiddleware;
