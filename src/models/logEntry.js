const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    // Actor Info
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["user", "admin", "customer", "system"], default: "user" },
    sessionId: { type: String },

    // Action Info
    action: { type: String, required: true },                        // e.g., LOGIN, ORDER_PLACED
    description: { type: String },                                   // human-readable description
    entity: { type: String },                                        // affected entity: Order, Product, etc.
    entityId: { type: mongoose.Schema.Types.ObjectId },              // entity _id
    subEntity: { type: String },                                     // e.g., "CartItem", "PaymentMethod"
    subEntityId: { type: mongoose.Schema.Types.ObjectId },
 isDeleted: { type: Boolean, default: true },
    // Request Metadata
    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String },                                     // request trace ID (for debugging microservices)
    endpoint: { type: String },                                      // API endpoint (/api/orders/123)
    httpMethod: { type: String, enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },

    // Geo + Device Info
    location: {
      country: { type: String },
      region: { type: String },
      city: { type: String },
      lat: { type: Number },
      lng: { type: Number },
    },
    device: {
      os: { type: String },
      browser: { type: String },
      deviceType: { type: String, enum: ["desktop", "mobile", "tablet", "bot", "unknown"], default: "unknown" },
    },

    // Extra Metadata
    metadata: { type: Object, default: {} },
    changes: {                                                     // store old vs new values
      before: { type: Object },
      after: { type: Object },
    },

    // Status
    status: { type: String, enum: ["success", "failure", "pending"], default: "success" },
    errorCode: { type: String },                                   // if failure
    errorMessage: { type: String },                                // if failure

    // Compliance
    sensitive: { type: Boolean, default: false },                   // mark if action involves PII
    retentionPolicy: { type: String, enum: ["30d", "90d", "1y", "forever"], default: "1y" },
  },
  { timestamps: true }
);
/**
 * 🛠 Instance Methods
 */

// Get a short human-readable summary
activityLogSchema.methods.getSummary = function () {
  return `[${this.createdAt.toISOString()}] ${this.role.toUpperCase()} (${this.userId || "SYSTEM"}) performed ${this.action} on ${this.entity || "N/A"} (${this.entityId || "N/A"})`;
};

// Check if log is an error
activityLogSchema.methods.hasError = function () {
  return this.status === "failure";
};

// Get change diff
activityLogSchema.methods.getChangeDiff = function () {
  return {
    before: this.changes?.before || {},
    after: this.changes?.after || {}
  };
};

// Mask sensitive metadata for safe display
activityLogSchema.methods.getSafeMetadata = function () {
  if (this.sensitive) {
    return { masked: true };
  }
  return this.metadata;
};

// Format log for API response
activityLogSchema.methods.toAPIResponse = function () {
  return {
    id: this._id,
    summary: this.getSummary(),
    status: this.status,
    action: this.action,
    entity: this.entity,
    entityId: this.entityId,
    createdAt: this.createdAt
  };
};

/**
 * 📌 Static Methods
 */

// Find logs by user
activityLogSchema.statics.findByUser = function (userId, limit = 50) {
  return this.find({ userId }).sort({ createdAt: -1 }).limit(limit);
};

// Find logs by entity
activityLogSchema.statics.findByEntity = function (entity, entityId, limit = 50) {
  return this.find({ entity, entityId }).sort({ createdAt: -1 }).limit(limit);
};

// Find logs by action
activityLogSchema.statics.findByAction = function (action, limit = 50) {
  return this.find({ action }).sort({ createdAt: -1 }).limit(limit);
};

// Find failed logs
activityLogSchema.statics.findFailures = function (limit = 50) {
  return this.find({ status: "failure" }).sort({ createdAt: -1 }).limit(limit);
};

// Get logs within a date range
activityLogSchema.statics.findByDateRange = function (startDate, endDate) {
  return this.find({
    createdAt: { $gte: startDate, $lte: endDate }
  }).sort({ createdAt: -1 });
};

// Search logs by keyword in description or metadata
activityLogSchema.statics.searchLogs = function (keyword) {
  return this.find({
    $or: [
      { description: { $regex: keyword, $options: "i" } },
      { "metadata": { $regex: keyword, $options: "i" } }
    ]
  }).sort({ createdAt: -1 });
};

// Get logs by status
activityLogSchema.statics.findByStatus = function (status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

// Get logs by role
activityLogSchema.statics.findByRole = function (role) {
  return this.find({ role }).sort({ createdAt: -1 });
};

// Paginated logs with filters
activityLogSchema.statics.getPaginatedLogs = async function ({
  page = 1,
  limit = 20,
  filters = {}
}) {
  const skip = (page - 1) * limit;
  const query = { ...filters };

  const [items, total] = await Promise.all([
    this.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    this.countDocuments(query)
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) };
};

// Aggregate logs by action
activityLogSchema.statics.getActionStats = function () {
  return this.aggregate([
    { $group: { _id: "$action", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

// Aggregate logs by entity
activityLogSchema.statics.getEntityStats = function () {
  return this.aggregate([
    { $group: { _id: "$entity", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

// Delete logs older than X days
activityLogSchema.statics.deleteOlderThan = function (days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return this.deleteMany({ createdAt: { $lt: cutoff } });
};

// Bulk delete by IDs
activityLogSchema.statics.bulkDelete = function (ids) {
  return this.deleteMany({ _id: { $in: ids } });
};

// Bulk update status
activityLogSchema.statics.bulkUpdateStatus = function (ids, status) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { status } });
};
const LogEntry = mongoose.model("ActivityLog", activityLogSchema);
module.exports = LogEntry;
