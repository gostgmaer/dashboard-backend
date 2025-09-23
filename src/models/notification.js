const mongoose = require('mongoose');
const User = require('./user');
const { Schema } = mongoose;

const notificationTypeGroups = {
  USER: ['USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'ROLE_ASSIGNED', 'PASSWORD_CHANGED', 'EMAIL_VERIFIED', 'PHONE_VERIFIED', 'PROFILE_COMPLETED', 'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'ADDRESS_ADDED', 'ADDRESS_UPDATED', 'ADDRESS_DELETED', 'PREFERENCES_UPDATED', 'SUBSCRIPTION_STARTED', 'SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_RENEWED', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'DATA_EXPORT_REQUESTED', 'DATA_EXPORT_COMPLETED', 'EMAIL_PHONE_VERIFICATION_REMINDER', 'EMAIL_CHANGE_REQUESTED', 'EMAIL_CHANGE_CONFIRMED', 'PHONE_CHANGE_REQUESTED', 'PHONE_CHANGE_CONFIRMED', 'ACCOUNT_DEACTIVATED', 'ACCOUNT_REACTIVATED', 'PRIVACY_POLICY_UPDATED', 'TERMS_OF_SERVICE_UPDATED', 'ACCOUNT_RECOVERY_REQUESTED', 'BACKUP_EMAIL_ADDED', 'BACKUP_EMAIL_REMOVED', 'TRUSTED_DEVICE_UPDATED', 'MFA_SETUP_REMINDER', 'ACCOUNT_ACTIVITY_SUMMARY', 'SECONDARY_PHONE_VERIFIED', 'IDENTITY_VERIFICATION_REQUESTED', 'IDENTITY_VERIFICATION_APPROVED', 'IDENTITY_VERIFICATION_REJECTED', 'ACCOUNT_ACCESS_REVOKED', 'PASSWORD_STRENGTH_WARNING', 'ACCOUNT_MERGE_CONFIRMED', 'SOCIAL_LOGIN_CONNECTED', 'SOCIAL_LOGIN_DISCONNECTED'],
  SHOPPING: ['CART_ABANDONMENT', 'WISHLIST_REMINDER', 'WISHLIST_BACK_IN_STOCK', 'WISHLIST_PRICE_DROP', 'SAVED_FOR_LATER_REMINDER', 'CART_ITEM_PRICE_CHANGED', 'WISHLIST_ITEM_DISCONTINUED', 'CART_EXPIRY_NOTIFICATION'],
  ORDER: ['ORDER_CREATED', 'ORDER_UPDATED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'ORDER_CANCELLED_BY_ADMIN', 'ORDER_RETURNED', 'ORDER_REFUNDED', 'ORDER_DELAYED', 'ORDER_PAYMENT_PENDING', 'ORDER_PAYMENT_FAILED', 'ORDER_PAYMENT_SUCCESS', 'ORDER_REVIEWED', 'ORDER_DISPUTED', 'ORDER_PARTIALLY_SHIPPED', 'ORDER_PARTIALLY_RETURNED', 'PRE_ORDER_CONFIRMED', 'PRE_ORDER_SHIPPED', 'DIGITAL_DOWNLOAD_READY', 'CUSTOM_ORDER_CONFIRMED', 'ORDER_MODIFICATION_REQUESTED', 'ORDER_MODIFICATION_APPROVED', 'ORDER_MODIFICATION_REJECTED'],
  RETURN: ['RETURN_REQUEST_RECEIVED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'REFUND_PROCESSED', 'EXCHANGE_APPROVED', 'EXCHANGE_REJECTED', 'RETURN_SHIPMENT_RECEIVED', 'PARTIAL_REFUND_PROCESSED'],
  PAYMENT: ['PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED', 'INVOICE_GENERATED', 'INVOICE_PAID', 'INVOICE_OVERDUE', 'CHARGEBACK_INITIATED', 'CHARGEBACK_RESOLVED', 'PAYMENT_METHOD_EXPIRING', 'SUBSCRIPTION_PAUSED', 'GIFT_CARD_PURCHASED', 'GIFT_CARD_REDEEMED', 'STORE_CREDIT_ADDED', 'STORE_CREDIT_USED', 'EMI_PAYMENT_REMINDER', 'PAYMENT_DISPUTE_INITIATED', 'PAYMENT_DISPUTE_RESOLVED', 'PAYMENT_METHOD_UPDATED'],
  MARKETING: ['NEWSLETTER_SUBSCRIBED', 'PROMOTIONAL_OFFER', 'LOYALTY_POINTS_EARNED', 'LOYALTY_POINTS_REDEEMED', 'SURVEY_REQUEST', 'EVENT_INVITATION', 'WEBINAR_REMINDER', 'REFERRAL_BONUS_EARNED', 'REFERRAL_INVITATION', 'REFERRAL_BONUS_USED', 'SEASONAL_SALE_ANNOUNCEMENT', 'FLASH_SALE_OFFER', 'VIP_SALE_EARLY_ACCESS', 'PRODUCT_SNEAK_PEEK', 'EXCLUSIVE_EVENT_INVITATION', 'PERSONALIZED_RECOMMENDATIONS', 'CROSS_SELL_OFFER', 'UPSELL_OFFER', 'BACK_IN_STOCK_NOTIFICATION', 'PRICE_DROP_ALERT', 'NEW_PRODUCT_LAUNCH', 'WIN_BACK_CAMPAIGN', 'PRODUCT_REVIEW_REQUEST', 'CUSTOMER_SATISFACTION_SURVEY', 'HOLIDAY_GREETINGS', 'CSR_STORY_SHARED', 'APP_DOWNLOAD_INVITATION', 'NEWSLETTER_REGULAR', 'ABANDONED_BROWSE_REMINDER', 'LOYALTY_TIER_CHANGE', 'BIRTHDAY_OFFER', 'CUSTOMER_MILESTONE'],
  SYSTEM: ['SYSTEM_ALERT', 'MAINTENANCE_SCHEDULED', 'MAINTENANCE_STARTED', 'MAINTENANCE_COMPLETED', 'NEW_FEATURE_RELEASED', 'BUG_FIX_DEPLOYED', 'SYSTEM_ERROR', 'SECURITY_ALERT', 'DATA_BACKUP_COMPLETED', 'API_RATE_LIMIT_EXCEEDED', 'UNEXPECTED_SHUTDOWN', 'SERVER_RESTARTED', 'OTP_SENT', 'ACCOUNT_SECURITY_CHECK_REMINDER', 'SESSION_TIMEOUT'],
  ADMIN: ['NEW_ORDER_PLACED', 'HIGH_VALUE_ORDER', 'LOW_STOCK_ALERT', 'OUT_OF_STOCK_ALERT', 'PRODUCT_DISABLED', 'NEW_USER_REGISTERED', 'NEW_REVIEW_SUBMITTED', 'PAYMENT_DISPUTE_ALERT', 'RETURN_REQUEST_NOTIFICATION', 'REFUND_PROCESSED_NOTIFICATION', 'DAILY_SALES_REPORT', 'WEEKLY_SALES_REPORT', 'MONTHLY_SALES_REPORT', 'SYSTEM_ERROR_ALERT', 'CUSTOMER_SUPPORT_TICKET_CREATED', 'INVENTORY_RESTOCKED', 'FRAUDULENT_ACTIVITY_DETECTED', 'BULK_ORDER_REQUEST', 'DATA_DELETION_REQUEST', 'SUSPICIOUS_ACCOUNT_ACTIVITY', 'MULTIPLE_LOGIN_ATTEMPTS', 'ACCOUNT_SUSPENSION_REINSTATEMENT', 'USER_PROFILE_UPDATE', 'TWO_FACTOR_STATUS_CHANGE', 'ACCOUNT_DELETION_DENIED', 'UNUSUAL_LOGIN_PATTERN', 'PHONE_VERIFICATION_STATUS', 'EMAIL_VERIFICATION_FAILURE', 'ACCOUNT_SECURITY_VIOLATION', 'USER_ACCOUNT_ACTIVITY_REPORT', 'MASS_ACCOUNT_CREATION_ALERT', 'ACCOUNT_RECOVERY_REQUEST', 'SECONDARY_PHONE_VERIFICATION_STATUS', 'IDENTITY_VERIFICATION_REQUEST', 'IDENTITY_VERIFICATION_OUTCOME', 'ACCOUNT_ACCESS_REVOCATION', 'SOCIAL_LOGIN_CONNECTION_ALERT', 'ACCOUNT_MERGE_REQUEST', 'HIGH_RISK_ACCOUNT_ACTIVITY'],
  SHIPPING: ['SHIPPING_LABEL_CREATED', 'PACKAGE_DISPATCHED', 'PACKAGE_IN_TRANSIT', 'PACKAGE_DELIVERED', 'PACKAGE_DELAYED', 'DELIVERY_EXCEPTION', 'CUSTOMS_HOLD', 'PACKAGE_RETURNED'],
  SUPPORT: ['TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_RESOLVED', 'TICKET_REOPENED', 'SUPPORT_AGENT_ASSIGNED', 'SUPPORT_FEEDBACK_RECEIVED', 'KNOWLEDGE_BASE_UPDATED'],
  PRODUCT: ['PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED', 'PRODUCT_OUT_OF_STOCK', 'PRODUCT_BACK_IN_STOCK', 'PRODUCT_FEATURED', 'PRODUCT_DISCOUNTED', 'PRODUCT_REVIEWED', 'PRODUCT_QA_ANSWERED', 'PRODUCT_QA_POSTED'],
  INVENTORY: ['STOCK_LOW', 'STOCK_CRITICAL', 'RESTOCK_REQUESTED', 'INVENTORY_AUDIT_COMPLETED', 'SUPPLIER_DELAY'],
  CUSTOM: ['CUSTOM', 'USER_DEFINED_EVENT1', 'USER_DEFINED_EVENT2'],
};

const allNotificationTypes = Object.values(notificationTypeGroups).flat();
const NOTIFICATION_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'CRITICAL',
  CRITICAL: 'BLOCKER',
};
const NOTIFICATION_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  ARCHIVED: 'ARCHIVED',
  UNREAD: 'UNREAD',
};
const DELIVERY_CHANNELS = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
  WEBHOOK: 'WEB_HOOK',
};

// ===== SUB-SCHEMAS =====
const readStatusSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
    deviceType: { type: String, enum: ['web', 'mobile', 'tablet', 'desktop'], default: 'web' },
    ipAddress: String,
    userAgent: String,
  },
  { _id: false }
);

const deliveryStatusSchema = new Schema(
  {
    channel: { type: String, enum: Object.values(DELIVERY_CHANNELS), required: true },
    status: { type: String, enum: Object.values(NOTIFICATION_STATUS), default: NOTIFICATION_STATUS.PENDING },
    attemptCount: { type: Number, default: 0, min: 0 },
    lastAttemptAt: Date,
    deliveredAt: Date,
    failureReason: String,
    externalId: String,
    metadata: { type: Map, of: Schema.Types.Mixed },
  },
  { _id: false }
);

const actionButtonSchema = new Schema(
  {
    text: { type: String, required: true, maxlength: 50 },
    url: String,
    action: { type: String, enum: ['redirect', 'api_call', 'modal', 'dismiss'], default: 'redirect' },
    style: { type: String, enum: ['primary', 'secondary', 'danger', 'success'], default: 'primary' },
    metadata: { type: Map, of: Schema.Types.Mixed },
  },
  { _id: false }
);

// ===== MAIN SCHEMA =====
const notificationSchema = new Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    title: { type: String, required: true, trim: true, maxlength: 200, index: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    shortMessage: { type: String, trim: true, maxlength: 160 },
    type: { type: String, enum: Object.values(allNotificationTypes), required: true, index: true },
    priority: { type: String, enum: Object.values(NOTIFICATION_PRIORITY), default: NOTIFICATION_PRIORITY.MEDIUM, index: true },
    category: { type: String, trim: true, maxlength: 50, index: true },
    tags: [{ type: String, trim: true, maxlength: 30 }],
    channels: { type: [String], enum: Object.values(DELIVERY_CHANNELS), default: ['IN_APP'], index: true },
    targetAudience: {
      userRoles: [{ type: String, enum: ['customer', 'admin', 'vendor', 'support', 'manager'] }],
      userSegments: [String],
      geolocation: {
        countries: [String],
        cities: [String],
        coordinates: {
          type: { type: String, enum: ['Point'] },
          coordinates: [Number],
        },
      },
      demographics: {
        ageRange: { min: Number, max: Number },
        interests: [String],
      },
    },
    content: {
      html: String,
      markdown: String,
      richText: { type: Map, of: Schema.Types.Mixed },
    },
    media: {
      imageUrl: String,
      thumbnailUrl: String,
      iconUrl: String,
      attachments: [
        {
          filename: String,
          url: String,
          size: Number,
          mimeType: String,
        },
      ],
    },
    actions: [actionButtonSchema],
    deepLink: {
      url: String,
      fallbackUrl: String,
      parameters: { type: Map, of: Schema.Types.Mixed },
    },
    status: { type: String, enum: Object.values(NOTIFICATION_STATUS), default: NOTIFICATION_STATUS.PENDING, index: true },
    readBy: [readStatusSchema],
    deliveryStatus: [deliveryStatusSchema],
    scheduledFor: { type: Date, index: true },
    expiresAt: { type: Date, index: true },
    timezone: { type: String, default: 'UTC' },
    socketRooms: [String],
    realTimeConfig: {
      enableRealTime: { type: Boolean, default: true },
      socketNamespace: { type: String, default: '/notifications' },
      broadcastToAll: { type: Boolean, default: false },
    },
    template: {
      templateId: { type: Schema.Types.ObjectId, ref: 'NotificationTemplate' },
      variables: { type: Map, of: Schema.Types.Mixed },
    },
    localization: {
      language: { type: String, default: 'en', maxlength: 5 },
      translations: { type: Map, of: { title: String, message: String, shortMessage: String } },
    },
    relatedEntity: {
      entityType: { type: String, enum: ['order', 'user', 'product', 'payment', 'review', 'support_ticket'], index: true },
      entityId: { type: Schema.Types.ObjectId, index: true },
      entityData: { type: Map, of: Schema.Types.Mixed },
    },
    analytics: {
      impressions: { type: Number, default: 0, min: 0 },
      clicks: { type: Number, default: 0, min: 0 },
      conversions: { type: Number, default: 0, min: 0 },
      engagementScore: { type: Number, default: 0, min: 0, max: 100 },
    },
    version: { type: Number, default: 1, min: 1 },
    metadata: { type: Map, of: Schema.Types.Mixed },
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ===== INDEXES =====
notificationSchema.index({ 'recipients.userId': 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, priority: 1, scheduledFor: 1 });
notificationSchema.index({ 'relatedEntity.entityType': 1, 'relatedEntity.entityId': 1 });
notificationSchema.index({ 'targetAudience.userRoles': 1, status: 1 });
notificationSchema.index({ 'sender.userId': 1, createdAt: -1 });
notificationSchema.index({ tags: 1, category: 1 });
notificationSchema.index({ 'content.html': 'text', title: 'text', message: 'text' });
notificationSchema.index({ 'targetAudience.geolocation.coordinates': '2dsphere' });

// --- Expiration & Schedule Status ---
notificationSchema.virtual('isExpired').get(function () {
  return !!this.expiresAt && this.expiresAt < new Date();
});
notificationSchema.virtual('isScheduled').get(function () {
  return !!this.scheduledFor && this.scheduledFor > new Date();
});
notificationSchema.virtual('isPending').get(function () {
  return this.status === 'pending';
});

// --- Read Status & Metrics ---
notificationSchema.virtual('isRead').get(function () {
  return this.status === 'read' || (Array.isArray(this.readBy) && this.readBy.length > 0);
});
notificationSchema.virtual('readCount').get(function () {
  return Array.isArray(this.readBy) ? this.readBy.length : 0;
});
notificationSchema.virtual('unreadCount').get(function () {
  const total = Array.isArray(this.recipients) ? this.recipients.length : 0;
  return total - this.readCount;
});
notificationSchema.virtual('totalRecipients').get(function () {
  return Array.isArray(this.recipients) ? this.recipients.length : 0;
});
notificationSchema.virtual('readPercentage').get(function () {
  if (!this.totalRecipients) return 0;
  return Math.round((this.readCount / this.totalRecipients) * 100);
});

// --- Delivery & Engagement ---
notificationSchema.virtual('deliveryRate').get(function () {
  if (!Array.isArray(this.deliveryStatus) || this.deliveryStatus.length === 0) return 0;
  const delivered = this.deliveryStatus.filter((d) => d.status === 'delivered').length;
  return Math.round((delivered / this.deliveryStatus.length) * 100);
});
notificationSchema.virtual('engagementRate').get(function () {
  if (!this.analytics || !this.analytics.impressions) return 0;
  return Math.round((this.analytics.clicks / this.analytics.impressions) * 100);
});
notificationSchema.virtual('conversionRate').get(function () {
  if (!this.analytics || !this.analytics.clicks) return 0;
  return Math.round((this.analytics.conversions / this.analytics.clicks) * 100);
});

// --- Age & Priority ---
notificationSchema.virtual('age').get(function () {
  if (!this.createdAt) return 0;
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});
notificationSchema.virtual('priorityScore').get(function () {
  const scores = { low: 1, medium: 2, high: 3, urgent: 4, critical: 5 };
  return scores[this.priority] || 2;
});

// --- Content, Personalization, Media ---
notificationSchema.virtual('hasActions').get(function () {
  return Array.isArray(this.actions) && this.actions.length > 0;
});
notificationSchema.virtual('hasMedia').get(function () {
  return !!(this.media && (this.media.imageUrl || (Array.isArray(this.media.attachments) && this.media.attachments.length > 0)));
});
notificationSchema.virtual('isPersonalized').get(function () {
  return Array.isArray(this.recipients) && this.recipients.some((r) => r.personalizedData && Object.keys(r.personalizedData).length > 0);
});

// --- Delivery Channels ---
notificationSchema.virtual('deliveryChannels').get(function () {
  return Array.isArray(this.deliveryStatus) ? [...new Set(this.deliveryStatus.map((d) => d.channel))] : [];
});
notificationSchema.virtual('failedDeliveries').get(function () {
  return Array.isArray(this.deliveryStatus) ? this.deliveryStatus.filter((d) => d.status === 'failed') : [];
});
notificationSchema.virtual('successfulDeliveries').get(function () {
  return Array.isArray(this.deliveryStatus) ? this.deliveryStatus.filter((d) => d.status === 'delivered') : [];
});

// --- Origin & Retry Status ---
notificationSchema.virtual('isSystemGenerated').get(function () {
  return this.sender && this.sender.systemGenerated === true;
});
notificationSchema.virtual('isUserGenerated').get(function () {
  return !!(this.sender && this.sender.userId && !this.sender.systemGenerated);
});
notificationSchema.virtual('canBeRetried').get(function () {
  return this.status === 'failed' && Array.isArray(this.deliveryStatus) && this.deliveryStatus.some((d) => d.attemptCount < 3);
});

// --- Analytics & Channels ---
notificationSchema.virtual('averageEngagement').get(function () {
  if (!this.analytics) return 0;
  const total = (this.analytics.impressions || 0) + (this.analytics.clicks || 0) + (this.analytics.conversions || 0);
  return total > 0 ? Math.round(total / 3) : 0;
});
notificationSchema.virtual('isMultiChannel').get(function () {
  return Array.isArray(this.deliveryChannels) && this.deliveryChannels.length > 1;
});

// --- Localization & Display ---
notificationSchema.virtual('displayTitle').get(function () {
  if (this.localization && this.localization.language && this.localization.translations && this.localization.translations[this.localization.language] && this.localization.translations[this.localization.language].title) {
    return this.localization.translations[this.localization.language].title;
  }
  return this.title;
});
notificationSchema.virtual('displayMessage').get(function () {
  if (this.localization && this.localization.language && this.localization.translations && this.localization.translations[this.localization.language] && this.localization.translations[this.localization.language].message) {
    return this.localization.translations[this.localization.language].message;
  }
  return this.message;
});
// Days until expiration (returns negative if already expired)
notificationSchema.virtual('daysToExpire').get(function () {
  if (!this.expiresAt) return null;
  return Math.round((this.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
});

// Indicates if notification was created today
notificationSchema.virtual('isNewToday').get(function () {
  if (!this.createdAt) return false;
  const today = new Date();
  return this.createdAt.getDate() === today.getDate() && this.createdAt.getMonth() === today.getMonth() && this.createdAt.getFullYear() === today.getFullYear();
});

// Returns the latest read timestamp, or null if unread
notificationSchema.virtual('lastReadAt').get(function () {
  if (!Array.isArray(this.readBy) || this.readBy.length === 0) return null;
  return this.readBy.reduce((latest, r) => (!latest || r.readAt > latest ? r.readAt : latest), null);
});

// Returns the list of unread recipient user IDs
notificationSchema.virtual('unreadUserIds').get(function () {
  if (!Array.isArray(this.recipients)) return [];
  const readIds = new Set(this.readBy ? this.readBy.map((r) => r.userId.toString()) : []);
  return this.recipients.filter((rec) => !readIds.has(rec.userId.toString())).map((rec) => rec.userId);
});

// True if notification contains any clickable actions
notificationSchema.virtual('hasClickableActions').get(function () {
  return Array.isArray(this.actions) && this.actions.some((act) => ['redirect', 'api_call', 'modal'].includes(act.action));
});

// True if notification contains attachments (media)
notificationSchema.virtual('hasAttachments').get(function () {
  return !!(this.media && Array.isArray(this.media.attachments) && this.media.attachments.length > 0);
});

// Returns first image URL available (thumbnail, image, or icon)
notificationSchema.virtual('firstImageUrl').get(function () {
  if (this.media) {
    return this.media.thumbnailUrl || this.media.imageUrl || this.media.iconUrl || null;
  }
  return null;
});

// Returns unique list of all recipient roles
notificationSchema.virtual('recipientRoles').get(function () {
  if (!Array.isArray(this.recipients)) return [];
  return [...new Set(this.recipients.map((r) => r.userRole).filter(Boolean))];
});

// Returns display status label (for UI)
notificationSchema.virtual('displayStatusLabel').get(function () {
  // Customizable mapping, example:
  const labels = {
    pending: 'Pending',
    sent: 'Sent',
    delivered: 'Delivered',
    read: 'Read',
    failed: 'Failed',
    archived: 'Archived',
  };
  return labels[this.status] || 'Unknown';
});
notificationSchema.virtual('timeAgo').get(function () {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
});
// ==== PRE-SAVE MIDDLEWARE ====
notificationSchema.pre('save', async function (next) {
  try {
    // Title/message sanitization
    if (this.isModified('title') && this.title) {
      this.title = this.title.trim().replace(/\s+/g, ' ');
    }
    if (this.isModified('message') && this.message) {
      this.message = this.message.trim().replace(/\s+/g, ' ');
    }
    // Auto-generate shortMessage if missing
    if (!this.shortMessage && this.message) {
      this.shortMessage = this.message.length > 140 ? this.message.slice(0, 137) + '...' : this.message;
    }

    if (this.status === 'read' && !this.readAt) {
      this.readAt = new Date();
    }
    // Deduplicate recipients
    if (Array.isArray(this.recipients)) {
      const seen = new Set();
      this.recipients = this.recipients.filter((r) => {
        const uid = r.userId.toString();
        if (!seen.has(uid)) {
          seen.add(uid);
          return true;
        }
        return false;
      });
    }
    // Validate scheduled and expiration dates
    if (this.expiresAt && this.scheduledFor && this.expiresAt <= this.scheduledFor) {
      return next(new Error('Expiration date must be after scheduled date'));
    }
    // Default scheduledFor to now if missing
    if (!this.scheduledFor) {
      this.scheduledFor = new Date();
    }
    // Priority-based expiration
    if (!this.expiresAt) {
      const expiryDays = { low: 30, medium: 14, high: 7, urgent: 3, critical: 1 };
      this.expiresAt = new Date(Date.now() + (expiryDays[this.priority] || 14) * 24 * 60 * 60 * 1000);
    }
    // Socket room setup for real-time notification delivery
    if (this.realTimeConfig?.enableRealTime && Array.isArray(this.recipients)) {
      this.socketRooms = this.socketRooms || [];
      this.recipients.forEach((recipient) => {
        const room = `user_${recipient.userId}`;
        if (!this.socketRooms.includes(room)) this.socketRooms.push(room);
      });
      // Role rooms
      const roleRooms = [...new Set(this.recipients.map((r) => r.userRole).filter(Boolean))].map((role) => `role_${role}`);
      roleRooms.forEach((room) => {
        if (!this.socketRooms.includes(room)) this.socketRooms.push(room);
      });
    }
    // Initialize analytics if missing
    if (!this.analytics) {
      this.analytics = { impressions: 0, clicks: 0, conversions: 0, engagementScore: 0 };
    }
    // Validate attachment/media URLs
    if (this.media) {
      const urlPattern = /^https?:\/\/.+/;
      ['imageUrl', 'thumbnailUrl'].forEach((field) => {
        if (this.media[field] && !urlPattern.test(this.media[field])) {
          return next(new Error(`Invalid URL format for ${field}`));
        }
      });
    }
    // Audit creation/update fields
    if (this.isNew && !this.createdBy && this.constructor.currentUser) {
      this.createdBy = this.constructor.currentUser;
    }
    if (!this.isNew && this.constructor.currentUser) {
      this.updatedBy = this.constructor.currentUser;
    }
    // Archiving logic
    if (this.isModified('isArchived')) {
      if (this.isArchived && !this.archivedAt) this.archivedAt = new Date();
      if (!this.isArchived) this.archivedAt = undefined;
    }
    // Versioning
    if (this.isNew) {
      this.version = 1;
    } else {
      this.version = (this.version || 1) + 1;
    }
    // Any other custom validations/error triggers here
    next();
  } catch (err) {
    next(err);
  }
});

// ==== POST-SAVE MIDDLEWARE ====
notificationSchema.post('save', async function (doc, next) {
  try {
    // Real-time socket emission (for new or status change)
    if (doc.realTimeConfig?.enableRealTime && typeof require !== 'undefined') {
      try {
        const io = require('../utils/socket').getIO?.();
        if (io) {
          const eventData = {
            id: doc._id,
            title: doc.displayTitle,
            message: doc.displayMessage,
            type: doc.type,
            priority: doc.priority,
            status: doc.status,
            createdAt: doc.createdAt,
            actions: doc.actions,
            media: doc.media,
            deepLink: doc.deepLink,
          };
          // Broadcast to all or emit to rooms/users
          if (doc.realTimeConfig.broadcastToAll) {
            io.to(doc.realTimeConfig.socketNamespace || '/notifications').emit('notification:new', eventData);
          } else {
            if (Array.isArray(doc.socketRooms)) {
              doc.socketRooms.forEach((room) => {
                io.to(room).emit('notification:new', eventData);
              });
            }
          }
        }
      } catch (e) {
        /* ignore socket errors to not fail save */
      }
    }
    // Analytics events (increment system-wide counters)
    if (doc.isNew) {
      try {
        const NotificationMetrics = require('./NotificationMetrics');
        await NotificationMetrics.incrementCounter('notifications_created');
        await NotificationMetrics.incrementCounter(`notifications_${doc.type}`);
        await NotificationMetrics.incrementCounter(`notifications_${doc.priority}`);
      } catch (e) {
        /* ignore metrics errors */
      }
    }
    // Queue delivery for external channels (email/SMS/etc)
    if (doc.isNew && doc.status === 'pending') {
      try {
        const NotificationService = require('../services/NotificationService');
        if (Array.isArray(doc.deliveryStatus)) {
          for (const delivery of doc.deliveryStatus) {
            if (delivery.status === 'pending') {
              await NotificationService.queueDelivery(doc._id, delivery.channel);
            }
          }
        }
      } catch (e) {}
    }
    // Webhook notification for integration
    if (process.env.NOTIFICATION_WEBHOOK_URL) {
      try {
        const WebhookService = require('../services/WebhookService');
        await WebhookService.sendWebhook(process.env.NOTIFICATION_WEBHOOK_URL, {
          event: doc.isNew ? 'notification.created' : 'notification.updated',
          notification: {
            id: doc._id,
            type: doc.type,
            priority: doc.priority,
            status: doc.status,
            recipientCount: Array.isArray(doc.recipients) ? doc.recipients.length : 0,
            createdAt: doc.createdAt,
          },
        });
      } catch (e) {}
    }
    // Add extra integrations/analytics here
    next();
  } catch (err) {
    next(); // Don't fail save based on analytics/integration errors
  }
});

// Mark notification as read by a specific user
notificationSchema.methods.markAsRead = async function (userId, deviceInfo = {}) {
  if (!this.recipients.some((r) => r.userId.toString() === userId.toString())) {
    throw new Error('User is not a recipient of this notification');
  }
  if (this.readBy.some((r) => r.userId.toString() === userId.toString())) {
    return this;
  }
  this.readBy.push({
    userId,
    readAt: new Date(),
    deviceType: deviceInfo.deviceType || 'web',
    ipAddress: deviceInfo.ipAddress || '',
    userAgent: deviceInfo.userAgent || '',
  });
  if (this.readBy.length >= this.recipients.length) {
    this.status = 'read';
  }
  this.analytics.impressions = (this.analytics.impressions || 0) + 1;
  return this.save();
};

// Track user click on notification action(s)
notificationSchema.methods.trackClick = async function (userId, actionIndex = null, metadata = {}) {
  if (!this.recipients.some((r) => r.userId.toString() === userId.toString())) {
    throw new Error('User is not a recipient of this notification');
  }
  this.analytics.clicks = (this.analytics.clicks || 0) + 1;
  if (this.analytics.impressions > 0) {
    this.analytics.engagementScore = Math.round((this.analytics.clicks / this.analytics.impressions) * 100);
  }
  if (!this.metadata) this.metadata = {};
  this.metadata.lastClick = {
    userId,
    timestamp: new Date(),
    actionIndex,
    ...metadata,
  };
  return this.save();
};

// Track conversion event for user
notificationSchema.methods.trackConversion = async function (userId, conversionData = {}) {
  if (!this.recipients.some((r) => r.userId.toString() === userId.toString())) {
    throw new Error('User is not a recipient of this notification');
  }
  this.analytics.conversions = (this.analytics.conversions || 0) + 1;
  if (this.analytics.clicks > 0) {
    const conversionRate = (this.analytics.conversions / this.analytics.clicks) * 100;
    this.analytics.engagementScore = Math.min((this.analytics.engagementScore || 0) + conversionRate, 100);
  }
  if (!this.metadata) this.metadata = {};
  this.metadata.lastConversion = {
    userId,
    timestamp: new Date(),
    ...conversionData,
  };
  return this.save();
};

// Update delivery status for a given channel
notificationSchema.methods.updateDeliveryStatus = async function (channel, status, metadata = {}) {
  let delivery = this.deliveryStatus.find((d) => d.channel === channel);
  if (!delivery) {
    delivery = {
      channel,
      status,
      attemptCount: 1,
      lastAttemptAt: new Date(),
      metadata: metadata || {},
    };
    this.deliveryStatus.push(delivery);
  } else {
    delivery.status = status;
    delivery.lastAttemptAt = new Date();
    if (status === 'delivered') {
      delivery.deliveredAt = new Date();
    } else if (status === 'failed') {
      delivery.attemptCount = (delivery.attemptCount || 0) + 1;
      if (metadata.error) delivery.failureReason = metadata.error;
    }
    if (metadata.externalId) delivery.externalId = metadata.externalId;
    delivery.metadata = { ...(delivery.metadata || {}), ...metadata };
  }
  // Update overall notification status
  const allDelivered = this.deliveryStatus.every((d) => d.status === 'delivered');
  const anyFailed = this.deliveryStatus.some((d) => d.status === 'failed');
  if (allDelivered) this.status = 'delivered';
  else if (anyFailed && !this.deliveryStatus.some((d) => d.status === 'pending')) this.status = 'failed';
  return this.save();
};

// Schedule notification for future delivery
notificationSchema.methods.schedule = async function (scheduledDate, timezone = 'UTC') {
  if (scheduledDate <= new Date()) {
    throw new Error('Scheduled date must be in the future');
  }
  this.scheduledFor = scheduledDate;
  this.timezone = timezone;
  this.status = 'pending';
  return this.save();
};

// Cancel a pending notification
notificationSchema.methods.cancel = async function (reason = 'Cancelled by user') {
  if (this.status !== 'pending') {
    throw new Error('Only pending notifications can be cancelled');
  }
  this.status = 'failed';
  if (!this.metadata) this.metadata = {};
  this.metadata.cancellation = { reason, cancelledAt: new Date() };
  return this.save();
};

// Archive notification with reason
notificationSchema.methods.archive = async function (reason = 'Archived by system') {
  this.isArchived = true;
  this.archivedAt = new Date();
  if (!this.metadata) this.metadata = {};
  this.metadata.archival = { reason, archivedAt: new Date() };
  return this.save();
};

// Duplicate notification with optional modifications
notificationSchema.methods.duplicate = function (modifications = {}) {
  const dupData = this.toObject();
  delete dupData._id;
  delete dupData.createdAt;
  delete dupData.updatedAt;
  delete dupData.readBy;
  delete dupData.deliveryStatus;
  delete dupData.analytics;
  dupData.status = 'pending';
  dupData.scheduledFor = new Date();
  dupData.isArchived = false;
  dupData.archivedAt = undefined;
  Object.assign(dupData, modifications);
  return new this.constructor(dupData);
};

// Get personalized content for a specific user
notificationSchema.methods.getPersonalizedContent = function (userId) {
  const recipient = this.recipients.find((r) => r.userId.toString() === userId.toString());
  if (!recipient) throw new Error('User is not a recipient of this notification');
  let title = this.displayTitle;
  let message = this.displayMessage;
  if (recipient.personalizedData) {
    const data = recipient.personalizedData;
    title = title.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] || match);
    message = message.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] || match);
  }
  return { title, message, shortMessage: this.shortMessage, personalizedData: recipient.personalizedData };
};

// Check if user can interact with notification
notificationSchema.methods.canUserInteract = function (userId) {
  const isRecipient = this.recipients.some((r) => r.userId.toString() === userId.toString());
  const validStatus = !this.isExpired && !this.isArchived;
  return isRecipient && validStatus;
};

// Get notification summary for a user (for UI or API responses)
notificationSchema.methods.getSummaryForUser = function (userId) {
  if (!this.canUserInteract(userId)) return null;
  const isRead = this.readBy.some((r) => r.userId.toString() === userId.toString());
  const personalizedContent = this.getPersonalizedContent(userId);
  return {
    id: this._id,
    title: personalizedContent.title,
    message: personalizedContent.message,
    shortMessage: personalizedContent.shortMessage,
    type: this.type,
    priority: this.priority,
    status: this.status,
    isRead,
    createdAt: this.createdAt,
    actions: this.actions,
    media: this.media,
    deepLink: this.deepLink,
    age: this.age,
    hasActions: this.hasActions,
    hasMedia: this.hasMedia,
  };
};

// Add new recipients to existing notification
notificationSchema.methods.addRecipients = async function (newRecipients) {
  if (!Array.isArray(newRecipients) || newRecipients.length === 0) {
    throw new Error('New recipients must be a non-empty array');
  }
  const existingIds = new Set(this.recipients.map((r) => r.userId.toString()));
  const uniqueNew = newRecipients.filter((r) => !existingIds.has(r.userId.toString()));
  if (uniqueNew.length === 0) throw new Error('All recipients already exist');
  this.recipients.push(...uniqueNew);
  if (this.realTimeConfig?.enableRealTime) {
    uniqueNew.forEach((rec) => {
      const room = `user_${rec.userId}`;
      if (!this.socketRooms.includes(room)) this.socketRooms.push(room);
    });
  }
  return this.save();
};

// Generate delivery report for notification
notificationSchema.methods.getDeliveryReport = function () {
  const total = this.recipients.length;
  const read = this.readBy.length;
  const stats = {};
  this.deliveryStatus.forEach((d) => {
    if (!stats[d.channel]) {
      stats[d.channel] = { pending: 0, delivered: 0, failed: 0, total: 0 };
    }
    stats[d.channel][d.status] = (stats[d.channel][d.status] || 0) + 1;
    stats[d.channel].total++;
  });
  return {
    overview: {
      totalRecipients: total,
      readCount: read,
      unreadCount: total - read,
      readPercentage: this.readPercentage,
      deliveryRate: this.deliveryRate,
      engagementRate: this.engagementRate,
      conversionRate: this.conversionRate,
    },
    analytics: this.analytics,
    deliveryChannels: Object.values(stats),
    createdAt: this.createdAt,
    lastActivity: this.readBy.length > 0 ? new Date(Math.max(...this.readBy.map((r) => r.readAt.getTime()))) : this.createdAt,
  };
};

// Additional helpful methods

// Reset read status (e.g., for re-notification)
notificationSchema.methods.resetReadStatus = async function () {
  this.readBy = [];
  this.status = 'pending';
  return this.save();
};

// Mark notification as failed with reason
notificationSchema.methods.markAsFailed = async function (reason = 'Marked as failed') {
  this.status = 'failed';
  if (!this.metadata) this.metadata = {};
  this.metadata.failureReason = reason;
  return this.save();
};

// Update localized content dynamically
notificationSchema.methods.updateLocalization = function (language, translations) {
  this.localization = this.localization || {};
  this.localization.language = language;
  this.localization.translations = this.localization.translations || {};
  this.localization.translations[language] = translations;
  return this.save();
};

// Set notification priority level
notificationSchema.methods.setPriority = async function (priorityLevel) {
  const validPriorities = ['low', 'medium', 'high', 'urgent', 'critical'];
  if (!validPriorities.includes(priorityLevel)) throw new Error('Invalid priority level');
  this.priority = priorityLevel;
  return this.save();
};

// Add a single action button dynamically
notificationSchema.methods.addAction = async function (action) {
  if (!action || !action.text) throw new Error('Action must have a text property');
  this.actions = this.actions || [];
  this.actions.push(action);
  return this.save();
};

// Remove a recipient by userId
notificationSchema.methods.removeRecipient = async function (userId) {
  const initialCount = this.recipients.length;
  this.recipients = this.recipients.filter((r) => r.userId.toString() !== userId.toString());
  this.readBy = this.readBy.filter((r) => r.userId.toString() !== userId.toString());
  // Optionally update socketRooms:
  this.socketRooms = this.socketRooms.filter((room) => room !== `user_${userId}`);
  if (this.recipients.length === initialCount) {
    throw new Error('Recipient not found');
  }
  return this.save();
};

// Update deep link parameters
notificationSchema.methods.updateDeepLink = async function (params) {
  this.deepLink = this.deepLink || {};
  this.deepLink.parameters = { ...(this.deepLink.parameters || {}), ...params };
  return this.save();
};

// Toggle notification archiving state
notificationSchema.methods.toggleArchive = async function () {
  this.isArchived = !this.isArchived;
  this.archivedAt = this.isArchived ? new Date() : undefined;
  return this.save();
};

// Get recipients count by role (e.g. customers, admins, etc.)
notificationSchema.methods.getRecipientCountByRole = function (role) {
  if (!role) return this.recipients.length;
  return this.recipients.filter((r) => r.userRole === role).length;
};

// Get array of unread recipient user objects
notificationSchema.methods.getUnreadRecipients = function () {
  const readSet = new Set((this.readBy || []).map((r) => r.userId.toString()));
  return this.recipients.filter((r) => !readSet.has(r.userId.toString()));
};

// Mark notification as read for multiple users in batch
notificationSchema.methods.batchMarkAsRead = async function (userIds) {
  userIds.forEach((userId) => {
    if (!this.readBy.some((r) => r.userId.toString() === userId.toString()) && this.recipients.some((r) => r.userId.toString() === userId.toString())) {
      this.readBy.push({ userId, readAt: new Date() });
    }
  });
  if (this.readBy.length >= this.recipients.length) {
    this.status = 'read';
  }
  return this.save();
};

// Bulk create notifications with transaction
notificationSchema.statics.createBulk = async function (notifications) {
  const session = await this.db.startSession();
  session.startTransaction();
  try {
    const docs = notifications.map((data) => new this(data));
    const saved = await this.insertMany(docs, { session });
    await session.commitTransaction();
    return saved;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// Find notifications for a specific user with filtering & pagination
notificationSchema.statics.findForUser = function (userId, options = {}) {
  const { status, type, priority, limit = 50, skip = 0, sortBy = 'createdAt', sortOrder = -1, includeArchived = false } = options;

  const query = { 'recipients.userId': userId };
  if (status) query.status = status;
  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (!includeArchived) query.isArchived = { $ne: true };

  return this.find(query)
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .skip(skip)
    .populate('sender.userId', 'username email')
    .populate('template.templateId');
};

// Get count of unread notifications for a user
notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({
    'recipients.userId': userId,
    status: { $ne: 'read' },
    isArchived: { $ne: true },
    expiresAt: { $gt: new Date() },
  });
};

// Mark notifications as read for a user (all or specified IDs)
notificationSchema.statics.markAsReadForUser = async function (userId, notificationIds = null) {
  const filter = {
    'recipients.userId': userId,
    'readBy.userId': { $ne: userId },
  };
  if (notificationIds) {
    filter._id = { $in: notificationIds };
  }
  return this.updateMany(filter, {
    $push: { readBy: { userId, readAt: new Date() } },
    $set: { status: 'read' },
  });
};

// Broadcast notification to all users with specific roles
notificationSchema.statics.broadcastToRoles = async function (roles, notificationData) {
  const users = await User.find({ role: { $in: roles } }, '_id role');
  const recipients = users.map((user) => ({ userId: user._id, userRole: user.role }));

  const notification = new this({
    ...notificationData,
    recipients,
    targetAudience: { userRoles: roles },
    realTimeConfig: { enableRealTime: true, broadcastToAll: false },
  });
  return notification.save();
};

// Send a system-generated notification
notificationSchema.statics.sendSystemNotification = async function (data) {
  const notification = new this({
    ...data,
    sender: { systemGenerated: true, service: data.service || 'system' },
    type: data.type || 'system',
    priority: data.priority || 'medium',
  });
  return notification.save();
};

// Archive expired notifications automatically
notificationSchema.statics.cleanupExpired = async function () {
  return this.updateMany({ expiresAt: { $lt: new Date() }, isArchived: false }, { $set: { isArchived: true, archivedAt: new Date(), status: 'archived' } });
};

// Get analytics summary aggregated over a date range
notificationSchema.statics.getAnalyticsSummary = async function (dateRange = {}) {
  const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = dateRange;
  const pipeline = [
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: null,
        totalNotifications: { $sum: 1 },
        totalImpressions: { $sum: '$analytics.impressions' },
        totalClicks: { $sum: '$analytics.clicks' },
        totalConversions: { $sum: '$analytics.conversions' },
        averageEngagement: { $avg: '$analytics.engagementScore' },
      },
    },
  ];
  const result = await this.aggregate(pipeline);
  return result[0] || {};
};

// Find notifications by related entity reference
notificationSchema.statics.findByEntity = function (entityType, entityId, options = {}) {
  const query = { 'relatedEntity.entityType': entityType, 'relatedEntity.entityId': entityId };
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 20)
    .populate('sender.userId', 'username');
};

// Retry failed deliveries (up to maxRetries)
notificationSchema.statics.retryFailedDeliveries = async function (maxRetries = 3) {
  const failedNotifications = await this.find({
    'deliveryStatus.status': 'failed',
    'deliveryStatus.attemptCount': { $lt: maxRetries },
  });
  const NotificationService = require('../services/NotificationService');
  const results = [];
  for (const notification of failedNotifications) {
    const failedDeliveries = notification.deliveryStatus.filter((d) => d.status === 'failed' && d.attemptCount < maxRetries);
    for (const delivery of failedDeliveries) {
      try {
        await NotificationService.queueDelivery(notification._id, delivery.channel);
        results.push({ notificationId: notification._id, channel: delivery.channel, status: 'queued' });
      } catch (err) {
        results.push({ notificationId: notification._id, channel: delivery.channel, status: 'error', error: err.message });
      }
    }
  }
  return results;
};

// Get trending notifications by engagement score in given timeframe
notificationSchema.statics.getTrending = async function (timeframe = '24h', limit = 10) {
  const durations = { '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
  const startDate = new Date(Date.now() - (durations[timeframe] || 86400000));
  return this.find({
    createdAt: { $gte: startDate },
    'analytics.engagementScore': { $gt: 0 },
  })
    .sort({ 'analytics.engagementScore': -1 })
    .limit(limit)
    .populate('sender.userId', 'username');
};

// Full-text search notifications
notificationSchema.statics.search = function (searchTerm, options = {}) {
  const { userId, type, priority, limit = 20, skip = 0 } = options;
  const query = { $text: { $search: searchTerm } };
  if (userId) query['recipients.userId'] = userId;
  if (type) query.type = type;
  if (priority) query.priority = priority;

  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .skip(skip);
};

// Update delivery status (atomic update)
notificationSchema.statics.updateDeliveryStatus = async function (notificationId, channel, status, metadata = {}) {
  const update = {
    'deliveryStatus.$.status': status,
    'deliveryStatus.$.lastAttemptAt': new Date(),
  };
  if (status === 'delivered') update['deliveryStatus.$.deliveredAt'] = new Date();
  else if (status === 'failed') {
    update['$inc'] = { 'deliveryStatus.$.attemptCount': 1 };
    if (metadata.error) update['deliveryStatus.$.failureReason'] = metadata.error;
  }
  if (metadata.externalId) update['deliveryStatus.$.externalId'] = metadata.externalId;

  return this.updateOne({ _id: notificationId, 'deliveryStatus.channel': channel }, update);
};

// Archive notifications older than a specified number of days
notificationSchema.statics.archiveOld = async function (olderThanDays = 90) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  return this.updateMany({ createdAt: { $lt: cutoff }, isArchived: false }, { $set: { isArchived: true, archivedAt: new Date() } });
};

// Bulk archive notifications for a list of IDs
notificationSchema.statics.bulkArchive = async function (notificationIds) {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw new Error('notificationIds must be a non-empty array');
  }
  return this.updateMany({ _id: { $in: notificationIds }, isArchived: false }, { $set: { isArchived: true, archivedAt: new Date(), status: 'archived' } });
};

// Purge notifications that are archived and older than certain days
notificationSchema.statics.purgeOldArchived = async function (olderThanDays = 365) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  return this.deleteMany({ isArchived: true, archivedAt: { $lt: cutoff } });
};

// Aggregate notification counts grouped by type and status within a date range
notificationSchema.statics.countGroupedByTypeAndStatus = async function (dateRange = {}) {
  const { startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate = new Date() } = dateRange;
  return this.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: { type: '$type', status: '$status' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.type': 1, '_id.status': 1 } },
  ]);
};

// Find notifications that failed delivery and have not been retried recently (e.g. 24h)
notificationSchema.statics.findPendingRetryFailures = async function (hoursSinceLastAttempt = 24) {
  const cutoff = new Date(Date.now() - hoursSinceLastAttempt * 3600000);
  return this.find({
    'deliveryStatus.status': 'failed',
    'deliveryStatus.lastAttemptAt': { $lt: cutoff },
  });
};

// Bulk update status for list of notification IDs
notificationSchema.statics.bulkUpdateStatus = async function (notificationIds, status) {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw new Error('notificationIds must be a non-empty array');
  }
  if (!['pending', 'sent', 'delivered', 'read', 'failed', 'archived'].includes(status)) {
    throw new Error('Invalid status value');
  }
  return this.updateMany({ _id: { $in: notificationIds } }, { $set: { status } });
};

// Get recent notifications summary count by user (last N days)
notificationSchema.statics.getRecentSummaryByUser = async function (userId, days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { 'recipients.userId': userId, createdAt: { $gte: cutoff } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
};

// Find notifications with a specific tag or set of tags
notificationSchema.statics.findByTags = function (tags, options = {}) {
  if (!Array.isArray(tags)) {
    tags = [tags];
  }
  const { limit = 50, skip = 0 } = options;
  return this.find({ tags: { $in: tags }, isArchived: { $ne: true } })
    .limit(limit)
    .skip(skip)
    .sort({ createdAt: -1 });
};

// Get daily notification creation counts for last N days
notificationSchema.statics.dailyNotificationCount = async function (days = 30) {
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { createdAt: { $gte: fromDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

notificationSchema.statics.getAll = async function ({
  filter = {},
  pagination = {},
  sorting = {},
  selectFields = null, // optional: string or array of projection fields
  populateFields = [], // optional: array of populate options, e.g. [{ path: 'sender.userId', select: 'username' }]
  excludeReadByUser = null, // optional: ObjectId userId to exclude notifications read by user
  useCursor = false, // optional: boolean, enable cursor pagination instead of limit/skip
  cursor = null, // optional: cursor value (e.g. createdAt timestamp or _id)
  cacheHint = false, // optional: if set, applies MongoDB cache hint for performance
  maxLimit = 100, // server-controlled maximum limit
} = {}) {
  const query = {};

  // Support multiple statuses, types, priorities as arrays for inclusion
  if (filter.status) query.status = Array.isArray(filter.status) ? { $in: filter.status } : filter.status;
  if (filter.type) query.type = Array.isArray(filter.type) ? { $in: filter.type } : filter.type;
  if (filter.priority) query.priority = Array.isArray(filter.priority) ? { $in: filter.priority } : filter.priority;

  if (typeof filter.isArchived === 'boolean') query.isArchived = filter.isArchived;
  if (filter.senderUserId) query['sender.userId'] = filter.senderUserId;
  if (filter.recipientUserId) query['recipients.userId'] = filter.recipientUserId;

  // Nested object filter example: filter.relatedEntity.entityType
  if (filter.relatedEntity && filter.relatedEntity.entityType) {
    query['relatedEntity.entityType'] = filter.relatedEntity.entityType;
  }

  // Flexible date filtering supporting from/to inclusive
  ['createdAt', 'scheduledFor', 'expiresAt'].forEach((dateField) => {
    if (filter[dateField]) {
      query[dateField] = {};
      if (filter[dateField].from) query[dateField].$gte = new Date(filter[dateField].from);
      if (filter[dateField].to) query[dateField].$lte = new Date(filter[dateField].to);
      if (Object.keys(query[dateField]).length === 0) delete query[dateField];
    }
  });

  // Regex partial, case-insensitive filtering on title or message for flexible matches
  if (filter.title) {
    query.title = { $regex: filter.title, $options: 'i' };
  }
  if (filter.message) {
    query.message = { $regex: filter.message, $options: 'i' };
  }

  // Tags inclusion (any match)
  if (filter.tags) {
    query.tags = { $in: Array.isArray(filter.tags) ? filter.tags : [filter.tags] };
  }

  // Full-text search term
  if (filter.search && filter.search.trim().length > 0) {
    query.$text = { $search: filter.search };
  }

  // Exclude notifications read by a specific user
  if (excludeReadByUser) {
    query['readBy.userId'] = { $ne: excludeReadByUser };
  }

  // Handle pagination parameters and enforce server max
  let limit = Math.min(pagination.limit > 0 ? pagination.limit : 50, maxLimit);
  let page = pagination.page > 0 ? pagination.page : 1;
  let skip = (page - 1) * limit;

  // Cursor pagination support: uses createdAt or _id as cursor field
  if (useCursor && cursor) {
    // Assume cursor is timestamp string or ObjectId
    query.$or = [{ createdAt: { $lt: new Date(cursor) } }, { createdAt: new Date(cursor) }];
    skip = 0; // no skip for cursor pagination
  }

  // Sorting: multi-field support, fallback to createdAt desc
  let sortObj = {};
  if (sorting.fields && Array.isArray(sorting.fields)) {
    sorting.fields.forEach((f) => {
      let [key, order] = f.split(':');
      order = order === 'asc' ? 1 : -1;
      sortObj[key] = order;
    });
  } else {
    sortObj[sorting.sortBy || 'createdAt'] = sorting.sortOrder === 1 ? 1 : -1;
  }
  if (Object.keys(sortObj).length === 0) {
    sortObj = { createdAt: -1 };
  }

  // Build query
  let dataQuery = this.find(query).sort(sortObj).limit(limit).skip(skip).lean();
  if (selectFields) dataQuery = dataQuery.select(selectFields);

  // Populate dynamically
  for (const popOption of populateFields) {
    dataQuery = dataQuery.populate(popOption);
  }

  // Cache hint if requested (requires MongoDB 4.4+ and setup)
  if (cacheHint && this.collection.getIndexes) {
    const indexName = await this.collection.getIndexes().then((idx) => Object.keys(idx)[0]);
    if (indexName) dataQuery = dataQuery.hint(indexName);
  }

  // Execute count and data queries in parallel
  const [totalCount, data] = await Promise.all([this.countDocuments(query), dataQuery.exec()]);

  return { data, totalCount, page, limit };
};

const Notification = mongoose.model('Notification', notificationSchema);
Notification.TYPES = allNotificationTypes;
Notification.PRIORITIES = NOTIFICATION_PRIORITY;
Notification.STATUSES = NOTIFICATION_STATUS;
Notification.CHANNELS = DELIVERY_CHANNELS;

module.exports = Notification;
