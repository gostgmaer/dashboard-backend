const mongoose = require('mongoose');
const { Schema } = mongoose;

const contactInquirySchema = new Schema(
  {
    // --- 1. THE LEAD (Client Info) ---
    client: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        match: [/\S+@\S+\.\S+/, 'Invalid email format'],
      },
      phone: { type: String, trim: true },
      companyName: { type: String, trim: true },
      websiteUrl: { type: String, trim: true },
      socialHandle: { type: String, trim: true },
    },

    // --- 2. THE PROJECT (Scope & Details) ---
    projectDetails: {
      servicesInterested: [
        {
          type: String,
          enum: ['Web Design', 'Development', 'SEO', 'Consulting', 'Maintenance'],
        },
      ],
      budgetRange: {
        type: String,
        default: 'Not sure',
      },
      timelinePreference: {
        type: String,
        default: 'Flexible',
      },
      attachments: [
        {
          fileName: String,
          fileUrl: String,
        },
      ],
    },

    // --- 3. THE MESSAGE ---
    message: {
      subject: { type: String, default: 'New Inquiry' },
      body: { type: String, required: true },
    },

    // --- 4. COMPLIANCE & PREFERENCES ---
    preferences: {
      preferredContactMethod: {
        type: String,
        enum: ['Email', 'Phone', 'WhatsApp'],
        default: 'Email',
      },
      newsletterOptIn: { type: Boolean, default: false },
      privacyConsent: { type: Boolean, required: true },
    },

    // --- 5. INTERNAL ADMIN USE (Hidden from Client) ---
    admin: {
      priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Junk'],
        default: 'Medium',
      },
      internalNotes: { type: String },
      assignedTo: { type: String },
    },

    status: {
      type: String,
      enum: ['New', 'Contacted', 'Proposal Sent', 'Negotiating', 'Closed', 'Lost'],
      default: 'New',
    },
  },
  {
    timestamps: true,
  }
);

// ================================
// VIRTUALS
// ===============================

// Virtual for full client identifier
contactInquirySchema.virtual('client.fullIdentifier').get(function () {
  return `${this.client.name} <${this.client.email}>`;
});

// Virtual for services count
contactInquirySchema.virtual('servicesCount').get(function () {
  return this.projectDetails.servicesInterested?.length || 0;
});

// Virtual for hasAttachments
contactInquirySchema.virtual('hasAttachments').get(function () {
  return !!(this.projectDetails.attachments?.length > 0);
});

// Virtual for contactInfo summary
contactInquirySchema.virtual('contactSummary').get(function () {
  const methods = [];
  if (this.client.email) methods.push('Email');
  if (this.client.phone) methods.push('Phone');
  if (this.preferences.preferredContactMethod) methods.push(this.preferences.preferredContactMethod);
  return methods.join(', ') || 'No contact info';
});

// Virtual for age in days
contactInquirySchema.virtual('ageInDays').get(function () {
  if (!this.createdAt) return 0;
  const diffTime = Math.abs(Date.now() - new Date(this.createdAt));
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// ================================
// PRE-SAVE MIDDLEWARES (Document)
// ===============================

contactInquirySchema.pre('save', function (next) {
  // Normalize phone number (remove spaces, dashes)
  if (this.client.phone) {
    this.client.phone = this.client.phone.replace(/[\s\-\(\)]/g, '');
  }

  // Generate a unique inquiry ID if not present
  if (!this.inquiryId) {
    this.inquiryId = `INQ-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }

  // Auto-set high priority for premium services or urgent timelines
  if (!this.admin.priority || this.admin.priority === 'Medium') {
    const highPriorityServices = ['Development', 'SEO'];
    const urgentTimeline = this.projectDetails.timelinePreference === 'ASAP';

    if (this.projectDetails.servicesInterested?.some((s) => highPriorityServices.includes(s)) || urgentTimeline) {
      this.admin.priority = 'High';
    }
  }

  // Ensure privacyConsent is true for new documents
  if (this.isNew && !this.preferences.privacyConsent) {
    const err = new Error('Privacy consent is required');
    err.name = 'ValidationError';
    return next(err);
  }

  next();
});

// Pre-save: Clean up empty arrays/objects
contactInquirySchema.pre('save', function (next) {
  // Remove empty servicesInterested array
  if (this.projectDetails.servicesInterested?.length === 0) {
    this.projectDetails.servicesInterested = undefined;
  }

  // Remove empty attachments array
  if (this.projectDetails.attachments?.length === 0) {
    this.projectDetails.attachments = undefined;
  }

  // Trim all string fields recursively
  this.trimAllStrings();
  next();
});

// ================================
// POST-SAVE MIDDLEWARES
// ===============================

contactInquirySchema.post('save', function (doc) {
  console.log(`New inquiry saved: ${doc.client.fullIdentifier} [${doc.status}]`);
});

// ================================
// STATIC METHODS
// ===============================

// Find inquiries by client email (exact match)
contactInquirySchema.statics.findByClientEmail = function (email) {
  return this.find({ 'client.email': email.toLowerCase() }).sort({ createdAt: -1 });
};

// Get dashboard stats
contactInquirySchema.statics.getDashboardStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgAge: { $avg: { $divide: [{ $subtract: ['$$NOW', '$createdAt'] }, 1000 * 60 * 60 * 24] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

// Search inquiries by multiple criteria
contactInquirySchema.statics.searchInquiries = function (query = {}) {
  const searchQuery = {};

  if (query.clientName) {
    searchQuery['client.name'] = { $regex: query.clientName, $options: 'i' };
  }

  if (query.email) {
    searchQuery['client.email'] = { $regex: query.email, $options: 'i' };
  }

  if (query.status) {
    searchQuery.status = query.status;
  }

  if (query.service) {
    searchQuery['projectDetails.servicesInterested'] = service;
  }

  if (query.minPriority) {
    searchQuery['admin.priority'] = { $gte: query.minPriority };
  }

  return this.find(searchQuery)
    .sort({ createdAt: query.sort === 'newest' ? -1 : 1 })
    .limit(query.limit || 50);
};

// Bulk update status
contactInquirySchema.statics.bulkUpdateStatus = async function (inquiryIds, newStatus, assignedTo = null) {
  const update = { status: newStatus };
  if (assignedTo) update['admin.assignedTo'] = assignedTo;

  return this.updateMany({ _id: { $in: inquiryIds } }, { $set: update });
};

// Get high priority inquiries
contactInquirySchema.statics.getHighPriority = function (days = 7) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.find({
    'admin.priority': { $in: ['High'] },
    status: { $in: ['New', 'Contacted'] },
    createdAt: { $gte: cutoffDate },
  }).sort({ createdAt: -1 });
};

// ================================
// QUERY HELPERS (INSTANCE METHODS)
// ===============================

// Custom trim method for all strings
contactInquirySchema.methods.trimAllStrings = function () {
  const trimRecursively = (obj) => {
    if (typeof obj === 'string') {
      return obj.trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(trimRecursively);
    }
    if (obj && typeof obj === 'object') {
      const trimmed = {};
      for (const [key, value] of Object.entries(obj)) {
        trimmed[key] = trimRecursively(value);
      }
      return trimmed;
    }
    return obj;
  };

  // Apply to client, projectDetails, message, preferences, admin
  // ['client', 'projectDetails', 'message', 'preferences', 'admin'].forEach((section) => {
  //   if (this[section]) {
  //     this[section] = trimRecursively(this[section]);
  //   }
  // });
};

// Format for API response (hide admin fields)
contactInquirySchema.methods.toAPIResponse = function () {
  const { admin, ...publicData } = this.toObject();
  publicData.client.fullIdentifier = this.client.fullIdentifier;
  publicData.servicesCount = this.servicesCount;
  publicData.hasAttachments = this.hasAttachments;
  publicData.ageInDays = this.ageInDays;
  return publicData;
};

// ================================
// INDEXES
// ===============================

contactInquirySchema.index({ 'client.email': 1 });
contactInquirySchema.index({ status: 1 });
contactInquirySchema.index({ 'admin.priority': 1 });
contactInquirySchema.index({ 'admin.assignedTo': 1 });
contactInquirySchema.index({ createdAt: -1 });
contactInquirySchema.index({ 'projectDetails.servicesInterested': 1 });

module.exports = mongoose.model('Inquiry', contactInquirySchema);
