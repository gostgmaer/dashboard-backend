 
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
                    email: user.email
                },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'MEDIUM',
                metadata: {
                    category: 'user',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
            });
            
            // Notify admins
            const admins = await User.aggregate([
                {
                    $lookup: {
                        from: 'roles',
                        localField: 'role',
                        foreignField: '_id',
                        as: 'role_info'
                    }
                },
                {
                    $unwind: {
                        path: '$role_info'
                    }
                },
                {
                    $match: {
                        'role_info.name': 'super_admin'
                    }
                },
                {
                    $project: {
                        name: 1,
                        role: '$role_info.name',
                        _id: 1
                    }
                }
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
                        email: user.email
                    },
                    channels: ['IN_APP', 'EMAIL'],
                    priority: 'MEDIUM',
                    metadata: {
                        category: 'admin',
                        relatedResource: user._id,
                        resourceModel: 'User',
                        actionUrl: `/admin/users/${user._id}`
                    }
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
                    username: user.username
                },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: {
                    category: 'user',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
            const admins = await User.find({ 'role.name': 'super_admin' });
            
            for (const admin of admins) {
                await notificationService.create({
                    recipient: admin._id,
                    type: 'USER_DELETED',
                    title: 'User Account Deleted',
                    message: `User account ${user.username} has been deleted`,
                    data: {
                        userId: user._id,
                        username: user.username,
                        email: user.email
                    },
                    channels: ['IN_APP'],
                    priority: 'MEDIUM',
                    metadata: {
                        category: 'admin',
                        relatedResource: user._id,
                        resourceModel: 'User'
                    }
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
                    permissions: newRole.permissions
                },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'MEDIUM',
                metadata: {
                    category: 'role',
                    relatedResource: newRole._id,
                    resourceModel: 'Role'
                }
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
                    ipAddress: req.ip
                },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'HIGH',
                metadata: {
                    category: 'security',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                    verifiedAt: new Date()
                },
                channels: ['IN_APP'],
                priority: 'MEDIUM',
                metadata: {
                    category: 'verification',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                    verifiedAt: new Date()
                },
                channels: ['IN_APP'],
                priority: 'MEDIUM',
                metadata: {
                    category: 'verification',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                    completedAt: new Date()
                },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: {
                    category: 'profile',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                    method: res.locals.twoFactorMethod || 'app'
                },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'HIGH',
                metadata: {
                    category: 'security',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                    ipAddress: req.ip
                },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'HIGH',
                metadata: {
                    category: 'security',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                    userAgent: req.headers['user-agent']
                },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: {
                    category: 'authentication',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                        userAgent: req.headers['user-agent']
                    },
                    channels: ['IN_APP', 'EMAIL'],
                    priority: 'HIGH',
                    metadata: {
                        category: 'security',
                        relatedResource: user._id,
                        resourceModel: 'User'
                    }
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
                    sessionDuration: res.locals.sessionDuration
                },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: {
                    category: 'authentication',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                    city: address.city
                },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: {
                    category: 'profile',
                    relatedResource: address._id,
                    resourceModel: 'Address'
                }
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
                    changes: res.locals.changes || []
                },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: {
                    category: 'profile',
                    relatedResource: address._id,
                    resourceModel: 'Address'
                }
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
                    addressType: address.type
                },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: {
                    category: 'profile',
                    relatedResource: address._id,
                    resourceModel: 'Address'
                }
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
                    updatedAt: new Date()
                },
                channels: ['IN_APP'],
                priority: 'LOW',
                metadata: {
                    category: 'profile',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                    lockedAt: new Date()
                },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'URGENT',
                metadata: {
                    category: 'security',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                    unlockedBy: res.locals.unlockedBy
                },
                channels: ['IN_APP', 'EMAIL'],
                priority: 'MEDIUM',
                metadata: {
                    category: 'security',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
            });
        } catch (error) {
            console.error('Error creating account unlocked notification:', error);
        }
        next();
    }
    
    // ==== ORDER-RELATED NOTIFICATIONS ====
    
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
                    items: order.items.length
                },
                priority: 'HIGH',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'order',
                    relatedResource: order._id,
                    resourceModel: 'Order',
                    actionUrl: `/orders/${order._id}`
                }
            });
            
            // Notify staff
            const staff = await User.find({ role: { $in: ['admin', 'staff'] } });
            
            for (const member of staff) {
                await notificationService.create({
                    recipient: member._id,
                    type: 'ORDER_CREATED',
                    title: 'New Order Received',
                    message: `Order #${order.orderNumber} placed for $${order.totalAmount}`,
                    data: {
                        orderId: order.orderNumber,
                        customerId: order.customer,
                        amount: order.totalAmount
                    },
                    priority: 'HIGH',
                    channels: ['IN_APP'],
                    metadata: {
                        category: 'staff',
                        relatedResource: order._id,
                        resourceModel: 'Order',
                        actionUrl: `/admin/orders/${order._id}`
                    }
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
                        trackingNumber: order.trackingNumber
                    },
                    priority: 'HIGH',
                    channels: ['IN_APP', 'EMAIL'],
                    metadata: {
                        category: 'order',
                        relatedResource: order._id,
                        resourceModel: 'Order',
                        actionUrl: `/orders/${order._id}`
                    }
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
                    estimatedDelivery: order.estimatedDelivery
                },
                priority: 'HIGH',
                channels: ['IN_APP', 'EMAIL', 'SMS'],
                metadata: {
                    category: 'shipping',
                    relatedResource: order._id,
                    resourceModel: 'Order',
                    actionUrl: `/orders/${order._id}/track`
                }
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
                    deliveryLocation: res.locals.deliveryLocation
                },
                priority: 'HIGH',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'delivery',
                    relatedResource: order._id,
                    resourceModel: 'Order',
                    actionUrl: `/orders/${order._id}/review`
                }
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
                    cancelledAt: new Date()
                },
                priority: 'HIGH',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'cancellation',
                    relatedResource: order._id,
                    resourceModel: 'Order'
                }
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
                    returnedAt: new Date()
                },
                priority: 'MEDIUM',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'return',
                    relatedResource: order._id,
                    resourceModel: 'Order'
                }
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
                    refundedAt: new Date()
                },
                priority: 'HIGH',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'refund',
                    relatedResource: order._id,
                    resourceModel: 'Order'
                }
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
                    newEstimatedDelivery: res.locals.newEstimatedDelivery
                },
                priority: 'MEDIUM',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'delay',
                    relatedResource: order._id,
                    resourceModel: 'Order'
                }
            });
        } catch (error) {
            console.error('Error creating order delayed notification:', error);
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
                    transactionId: payment.transactionId
                },
                priority: 'HIGH',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'payment',
                    relatedResource: payment._id,
                    resourceModel: 'Payment',
                    actionUrl: `/orders/${payment.orderId}`
                }
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
                    reason: payment.failureReason
                },
                priority: 'URGENT',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'payment',
                    relatedResource: payment._id,
                    resourceModel: 'Payment',
                    actionUrl: `/orders/${payment.orderId}/payment`
                }
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
                    refundReason: res.locals.refundReason
                },
                priority: 'HIGH',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'refund',
                    relatedResource: payment._id,
                    resourceModel: 'Payment'
                }
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
            const staff = await User.find({ role: { $in: ['admin', 'product_manager'] } });
            
            for (const member of staff) {
                await notificationService.create({
                    recipient: member._id,
                    type: 'PRODUCT_CREATED',
                    title: 'New Product Added',
                    message: `New product "${product.name}" has been added to the catalog.`,
                    data: {
                        productId: product._id,
                        productName: product.name,
                        category: product.category,
                        price: product.price
                    },
                    priority: 'MEDIUM',
                    channels: ['IN_APP'],
                    metadata: {
                        category: 'product',
                        relatedResource: product._id,
                        resourceModel: 'Product',
                        actionUrl: `/admin/products/${product._id}`
                    }
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
                        category: product.category
                    },
                    priority: 'MEDIUM',
                    channels: ['IN_APP'],
                    metadata: {
                        category: 'inventory',
                        relatedResource: product._id,
                        resourceModel: 'Product'
                    }
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
                        price: product.price
                    },
                    priority: 'HIGH',
                    channels: ['IN_APP', 'EMAIL'],
                    metadata: {
                        category: 'inventory',
                        relatedResource: product._id,
                        resourceModel: 'Product',
                        actionUrl: `/products/${product._id}`
                    }
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
                        discountPercentage: res.locals.discountPercentage
                    },
                    priority: 'HIGH',
                    channels: ['IN_APP', 'EMAIL'],
                    metadata: {
                        category: 'promotion',
                        relatedResource: product._id,
                        resourceModel: 'Product',
                        actionUrl: `/products/${product._id}`
                    }
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
            const admins = await User.find({ role: 'admin' });
            
            for (const admin of admins) {
                await notificationService.create({
                    recipient: admin._id,
                    type: 'SYSTEM_ALERT',
                    title: 'System Alert',
                    message: alert.message,
                    data: {
                        severity: alert.severity,
                        component: alert.component,
                        details: alert.details
                    },
                    priority: 'URGENT',
                    channels: ['IN_APP', 'EMAIL'],
                    metadata: {
                        category: 'system',
                        relatedResource: alert._id,
                        resourceModel: 'SystemAlert'
                    }
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
                        affectedServices: maintenance.affectedServices
                    },
                    priority: 'MEDIUM',
                    channels: ['IN_APP', 'EMAIL'],
                    metadata: {
                        category: 'maintenance',
                        relatedResource: maintenance._id,
                        resourceModel: 'Maintenance'
                    }
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
                    priority: ticket.priority
                },
                priority: 'MEDIUM',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'support',
                    relatedResource: ticket._id,
                    resourceModel: 'Ticket',
                    actionUrl: `/support/tickets/${ticket._id}`
                }
            });
            
            // Notify support team
            const supportTeam = await User.find({ role: 'support' });
            
            for (const agent of supportTeam) {
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
                        priority: ticket.priority
                    },
                    priority: 'HIGH',
                    channels: ['IN_APP'],
                    metadata: {
                        category: 'support_staff',
                        relatedResource: ticket._id,
                        resourceModel: 'Ticket',
                        actionUrl: `/admin/support/tickets/${ticket._id}`
                    }
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
                    resolvedBy: ticket.resolvedBy
                },
                priority: 'MEDIUM',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'support',
                    relatedResource: ticket._id,
                    resourceModel: 'Ticket',
                    actionUrl: `/support/tickets/${ticket._id}`
                }
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
                    frequency: res.locals.frequency || 'weekly'
                },
                priority: 'LOW',
                channels: ['IN_APP', 'EMAIL'],
                metadata: {
                    category: 'marketing',
                    relatedResource: user._id,
                    resourceModel: 'User'
                }
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
                        validUntil: offer.validUntil
                    },
                    priority: 'MEDIUM',
                    channels: ['IN_APP', 'EMAIL'],
                    metadata: {
                        category: 'marketing',
                        relatedResource: offer._id,
                        resourceModel: 'Offer',
                        actionUrl: `/offers/${offer._id}`
                    }
                });
            }
        } catch (error) {
            console.error('Error creating promotional offer notification:', error);
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
                        minStockLevel: product.minStockLevel
                    },
                    priority: 'MEDIUM',
                    channels: ['IN_APP', 'EMAIL'],
                    metadata: {
                        category: 'inventory',
                        relatedResource: product._id,
                        resourceModel: 'Product',
                        actionUrl: `/admin/inventory/${product._id}`
                    }
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
                        criticalLevel: product.criticalLevel
                    },
                    priority: 'URGENT',
                    channels: ['IN_APP', 'EMAIL', 'SMS'],
                    metadata: {
                        category: 'inventory',
                        relatedResource: product._id,
                        resourceModel: 'Product',
                        actionUrl: `/admin/inventory/${product._id}`
                    }
                });
            }
        } catch (error) {
            console.error('Error creating critical stock notification:', error);
        }
        next();
    }
}

module.exports = NotificationMiddleware;
