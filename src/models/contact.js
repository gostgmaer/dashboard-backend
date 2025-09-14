const mongoose = require('mongoose');

const contactUsSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isAgreed: { type: String },
    category: {
      type: String,
      enum: ['General Inquiry', 'Technical Support', 'Feedback', 'Other']
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium'
    },
    status: { type: String, default: 'New' }, // Added default
    userAgent: { type: String },
    ipAddress: { type: String }
  },
  { timestamps: true }
);

//
// ===== Instance Methods =====
//

// Get full name
contactUsSchema.methods.getFullName = function () {
  return `${this.firstName} ${this.lastName}`;
};

// Mark as resolved
contactUsSchema.methods.markResolved = async function (updatedBy) {
  this.status = 'Resolved';
  if (updatedBy) this.updated_by = updatedBy;
  return this.save();
};

// Mark as pending
contactUsSchema.methods.markPending = async function (updatedBy) {
  this.status = 'Pending';
  if (updatedBy) this.updated_by = updatedBy;
  return this.save();
};

// Change priority
contactUsSchema.methods.updatePriority = async function (priority) {
  this.priority = priority;
  return this.save();
};

// Add internal note (optional: extend schema to store notes)
contactUsSchema.methods.addInternalNote = async function (note) {
  if (!this.notes) this.notes = [];
  this.notes.push({ note, date: new Date() });
  return this.save();
};

//
// ===== Static Methods =====
//

// Get all contacts with pagination & filters
contactUsSchema.statics.getPaginatedContacts = async function ({
  page = 1,
  limit = 10,
  status,
  category,
  priority,
  search
}) {
  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;
  if (priority) query.priority = priority;
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { subject: { $regex: search, $options: 'i' } },
      { message: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    this.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    this.countDocuments(query)
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) };
};

// Bulk update status
contactUsSchema.statics.bulkUpdateStatus = function (ids, status) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { status } });
};

// Bulk delete
contactUsSchema.statics.bulkDelete = function (ids) {
  return this.deleteMany({ _id: { $in: ids } });
};

// Get stats by category
contactUsSchema.statics.getStatsByCategory = async function () {
  return this.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

// Get stats by status
contactUsSchema.statics.getStatsByStatus = async function () {
  return this.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

// Get high priority unresolved contacts
contactUsSchema.statics.getHighPriorityUnresolved = function () {
  return this.find({ priority: 'High', status: { $ne: 'Resolved' } }).sort({ createdAt: -1 });
};

// Search by email
contactUsSchema.statics.findByEmail = function (email) {
  return this.find({ email: { $regex: `^${email}$`, $options: 'i' } });
};

// Delete old resolved contacts (cleanup)
contactUsSchema.statics.deleteResolvedOlderThan = function (days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return this.deleteMany({ status: 'Resolved', updatedAt: { $lt: cutoff } });
};

const Contact = mongoose.model('Contact', contactUsSchema);

module.exports = Contact;