const mongoose = require('mongoose');

// A simple counter collection used for auto-incrementing sequences
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});

// we create the model here so it can be reused by other modules if needed
const Counter = mongoose.model('Counter', counterSchema);

const inquirySchema = new mongoose.Schema({
  // Contact Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  website: {
    type: String,
    trim: true,
    maxlength: [200, 'Website URL cannot exceed 200 characters']
  },

  // Project Details
  projectType: {
    type: String,
    enum: {
      values: ['website', 'webapp', 'mobile', 'ecommerce', 'redesign', 'maintenance', 'consulting', 'other'],
      message: '{VALUE} is not a valid project type'
    },
    required: [true, 'Project type is required']
  },
  budget: {
    type: String,
    enum: {
      values: ['under-5k', '5k-10k', '10k-25k', '25k-50k', '50k-100k', 'over-100k', 'not-sure'],
      message: '{VALUE} is not a valid budget range'
    },
    required: [true, 'Budget is required']
  },
  timeline: {
    type: String,
    enum: {
      values: ['asap', '1-month', '2-3months', '3-6months', '6months+', 'flexible'],
      message: '{VALUE} is not a valid timeline'
    },
    required: [true, 'Timeline is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  requirements: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Optional contact preferences
  preferredContactMethod: {
    type: String,
    enum: ['email', 'phone', 'any'],
    default: 'email'
  },

  // Sequential identifier for tracking inquiries
  inquiryNumber: {
    type: Number,
    unique: true,
    index: true
  },

  // Status & Assignment
  status: {
    type: String,
    enum: {
      values: ['new', 'reviewing', 'contacted', 'quoted', 'proposal-sent', 'negotiating', 'accepted', 'rejected', 'completed', 'cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'new'
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: '{VALUE} is not a valid priority'
    },
    default: 'medium'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },

  // internal notes stored by admins
  internalNotes: {
    type: String,
    trim: true,
    default: ''
  },

  // Quoting
  quotedAmount: {
    type: Number,
    min: 0
  },
  quotedCurrency: {
    type: String,
    default: 'USD',
    maxlength: 3
  },
  quotedAt: {
    type: Date
  },
  quotedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },

  // Notes and History
  notes: [{
    content: {
      type: String,
      required: true,
      maxlength: 2000
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isInternal: {
      type: Boolean,
      default: true
    }
  }],

  // Status History for tracking changes
  statusHistory: [{
    status: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    note: String
  }],

  // Follow-up
  nextFollowUp: {
    type: Date
  },
  lastContactedAt: {
    type: Date
  },

  // Proposal Management
  proposalUrl: {
    type: String,
    trim: true
  },
  proposalSentAt: {
    type: Date
  },
  proposalTemplateName: {
    type: String,
    default: 'static_basic',
    trim: true
  },

  // Metadata
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  source: {
    type: String,
    enum: ['website', 'referral', 'social', 'email', 'phone', 'other'],
    default: 'website'
  },
  referrer: {
    type: String
  },

  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
inquirySchema.index({ status: 1 });
inquirySchema.index({ priority: 1 });
inquirySchema.index({ projectType: 1 });
inquirySchema.index({ createdAt: -1 });
inquirySchema.index({ assignedTo: 1 });
inquirySchema.index({ email: 1 });
inquirySchema.index({ isDeleted: 1 });
inquirySchema.index({ nextFollowUp: 1 });

// Text search
inquirySchema.index({
  name: 'text',
  email: 'text',
  company: 'text',
  description: 'text'
}, {
  name: 'InquiryTextIndex'
});

// Auto-set priority based on budget and assign a sequential inquiry number
inquirySchema.pre('save', async function () {
  if (this.isNew) {
    // --- sequential number logic ------------------------------------------------
    try {
      const counter = await Counter.findOneAndUpdate(
        { name: 'inquiry' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.inquiryNumber = counter.seq;
    } catch (err) {
      throw err;
    }

    // --- priority logic ---------------------------------------------------------
    const highBudgets = ['50k-100k', 'over-100k'];
    const mediumBudgets = ['25k-50k', '10k-25k'];

    if (highBudgets.includes(this.budget)) {
      this.priority = 'high';
    } else if (mediumBudgets.includes(this.budget)) {
      this.priority = 'medium';
    }

    // ASAP timeline increases priority
    if (this.timeline === 'asap' && this.priority !== 'urgent') {
      this.priority = this.priority === 'high' ? 'urgent' : 'high';
    }
  }
});

// Change status with history tracking
inquirySchema.methods.changeStatus = async function (newStatus, adminId, note = '') {
  this.statusHistory.push({
    status: this.status,
    changedBy: adminId,
    changedAt: new Date(),
    note
  });
  this.status = newStatus;
  return this.save();
};

// Add note
inquirySchema.methods.addNote = async function (content, adminId, isInternal = true) {
  this.notes.push({
    content,
    createdBy: adminId,
    createdAt: new Date(),
    isInternal
  });
  return this.save();
};

// Set quote
inquirySchema.methods.setQuote = async function (amount, currency, adminId) {
  this.quotedAmount = amount;
  this.quotedCurrency = currency;
  this.quotedAt = new Date();
  this.quotedBy = adminId;
  this.status = 'quoted';
  return this.save();
};

// Assign to admin
inquirySchema.methods.assignTo = async function (adminId, assignedByAdminId) {
  this.assignedTo = adminId;
  this.statusHistory.push({
    status: `assigned to ${adminId}`,
    changedBy: assignedByAdminId,
    changedAt: new Date()
  });
  if (this.status === 'new') {
    this.status = 'reviewing';
  }
  return this.save();
};

// Soft delete
inquirySchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static: find active inquiries
inquirySchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isDeleted: false });
};

// Static: find due for follow-up
inquirySchema.statics.findDueForFollowUp = function () {
  return this.find({
    isDeleted: false,
    nextFollowUp: { $lte: new Date() },
    status: { $nin: ['completed', 'cancelled', 'rejected'] }
  });
};

// Static: count by status
inquirySchema.statics.countByStatus = async function () {
  return this.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
};

// Virtuals for backward compatibility with older controller/email shape
inquirySchema.virtual('client').get(function () {
  return {
    name: this.name,
    email: this.email,
    phone: this.phone,
    companyName: this.company,
    websiteUrl: this.website,
  };
});

inquirySchema.virtual('projectDetails').get(function () {
  return {
    servicesInterested: this.projectType ? [this.projectType] : [],
    budgetRange: this.budget,
    timelinePreference: this.timeline,
  };
});

inquirySchema.virtual('message').get(function () {
  return {
    subject: '',
    body: this.description,
  };
});

inquirySchema.virtual('preferences').get(function () {
  return {
    preferredContactMethod: this.preferredContactMethod,
  };
});

inquirySchema.virtual('admin').get(function () {
  return {
    priority: this.priority,
    assignedTo: this.assignedTo,
    internalNotes: this.internalNotes,
  };
});

// Instance helper to produce a cleaned API response
inquirySchema.methods.toAPIResponse = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  if (obj.isDeleted) delete obj.isDeleted;
  return obj;
};

// Flexible search helper used by controller
inquirySchema.statics.searchInquiries = function (params = {}) {
  const {
    search,
    status,
    priority,
    service,
    assignedTo,
    projectType,
  } = params;

  const query = { isDeleted: false };
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo;
  if (service) query.projectType = service;
  if (projectType) query.projectType = projectType;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  return this.find(query);
};

// Bulk update helper
inquirySchema.statics.bulkUpdateStatus = function (ids, updates) {
  return this.updateMany({ _id: { $in: ids } }, { $set: updates });
};

// Dashboard statistics
inquirySchema.statics.getDashboardStats = async function () {
  const match = { isDeleted: false };
  const [byStatus, byPriority] = await Promise.all([
    this.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    this.aggregate([{ $match: match }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
  ]);
  return { byStatus, byPriority };
};

// High priority inquiries over the last N days
inquirySchema.statics.getHighPriority = function (days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return this.find({
    isDeleted: false,
    priority: { $in: ['high', 'urgent'] },
    createdAt: { $gte: cutoff },
  });
};

// Generic pagination helper (used by controller)
inquirySchema.statics.paginate = async function (query = {}, options = {}) {
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 20;
  const sort = options.sort || { createdAt: -1 };
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    this.find(query).sort(sort).skip(skip).limit(limit),
    this.countDocuments(query),
  ]);
  return {
    docs,
    total,
    page,
    pages: Math.ceil(total / limit),
    limit,
  };
};

// helper for API responses
inquirySchema.methods.toAPIResponse = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  if (obj.isDeleted) delete obj.isDeleted;
  return obj;
};

// search with filters and optional text
inquirySchema.statics.searchInquiries = function (params = {}) {
  const {
    search,
    status,
    priority,
    service,
    assignedTo,
    projectType,
  } = params;

  const query = { isDeleted: false };
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (assignedTo) query.assignedTo = assignedTo;
  if (service) query.projectType = service;
  if (projectType) query.projectType = projectType;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  return this.find(query);
};

const Inquiry = mongoose.model('Inquiry', inquirySchema);

module.exports = Inquiry;