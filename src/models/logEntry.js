const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    // Actor Info
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["user", "admin", "customer", "system"], default: "user" },
    sessionId: { type: String },
    operation: { type: String, enum: ['create', 'update', 'delete', 'read','remove'], required: true },
    // Action Info
    action: { type: String, required: true },                        // e.g., LOGIN, ORDER_PLACED
    description: { type: String },                                   // human-readable description
    entity: { type: String },                                        // affected entity: Order, Product, etc.
    entityId: { type: mongoose.Schema.Types.ObjectId },              // entity _id
    subEntity: { type: String },                                     // e.g., "CartItem", "PaymentMethod"
    subEntityId: { type: mongoose.Schema.Types.ObjectId },
    isDeleted: { type: Boolean, default: false },
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
  {   timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }, }
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

}

  activityLogSchema.statics.createFromRequest = async function (req, logData = {}) {
  // Parse user-agent
  const agent = useragent.parse(req.headers["user-agent"] || "");

  const deviceType =
    /mobile/i.test(agent.device.toString())
      ? "mobile"
      : /tablet/i.test(agent.device.toString())
      ? "tablet"
      : /bot/i.test(agent.device.toString())
      ? "bot"
      : "desktop";

  const log = new this({
    // User Info (from req.user if available)
    userId: req.user?._id,
    role: req.user?.role || "user",
    sessionId: req.sessionID,

    // Request Info
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    endpoint: req.originalUrl,
    httpMethod: req.method,

    // Device Info
    device: {
      os: agent.os.toString(),
      browser: agent.toAgent(),
      deviceType,
    },

    // Custom Data
    operation: logData.operation,
    action: logData.action,
    description: logData.description,
    entity: logData.entity,
    entityId: logData.entityId,
    subEntity: logData.subEntity,
    subEntityId: logData.subEntityId,
    changes: logData.changes,
    metadata: logData.metadata,
    status: "pending",
  });

  return log.save();
};

/* ---------------------- METHODS ---------------------- */
activityLogSchema.methods.markSuccess = async function () {
  this.status = "success";
  this.errorCode = null;
  this.errorMessage = null;
  return this.save();
};

activityLogSchema.methods.markFailure = async function (errorCode, errorMessage) {
  this.status = "failure";
  this.errorCode = errorCode;
  this.errorMessage = errorMessage;
  return this.save();
};

activityLogSchema.statics.findByUserId = function (userId, limit = 10) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user_id format');
  }
  return this.find({ user_id: userId })
    .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

activityLogSchema.statics.findByUserFullname = function (fullname, limit = 10) {
  return this.find({ user_fullname: fullname })
    .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

activityLogSchema.statics.findByOperation = function (operation, limit = 10) {
  if (!['create', 'update', 'delete', 'read'].includes(operation)) {
    throw new Error('Invalid operation');
  }
  return this.find({ operation })
    .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

activityLogSchema.statics.findByDateRange = function (startDate, endDate, limit = 10) {
  return this.find({
    timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
  })
    .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

activityLogSchema.statics.getOperationStats = function () {
  return this.aggregate([
    { $group: { _id: '$operation', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
};

activityLogSchema.statics.getUserActivityStats = function () {
  return this.aggregate([
    { $group: { _id: { user_id: '$user_id', user_fullname: '$user_fullname' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

// tableEndpointMap should be defined somewhere globally or imported
activityLogSchema.statics.findByTable = function (table, limit = 10) {
  const endpoints = tableEndpointMap[table] || [];
  if (endpoints.length === 0) {
    throw new Error(`Invalid table: ${table}`);
  }
  return this.find({ endpoint: { $regex: `^(${endpoints.join('|')})` } })
    .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

activityLogSchema.statics.findByUserAndTable = function (userId, table, limit = 10) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user_id format');
  }
  const endpoints = tableEndpointMap[table] || [];
  if (endpoints.length === 0) {
    throw new Error(`Invalid table: ${table}`);
  }
  return this.find({
    user_id: userId,
    endpoint: { $regex: `^(${endpoints.join('|')})` }
  })
    .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

activityLogSchema.statics.findFailedRequests = function (limit = 10) {
  return this.find({ response_status: { $gte: 400 } })
    .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

activityLogSchema.statics.getDailyActivity = function (days = 7) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
  return this.aggregate([
    { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          operation: '$operation'
        },
        count: { $sum: 1 },
        users: { $addToSet: '$user_fullname' }
      }
    },
    { $sort: { '_id.day': -1 } }
  ]);
};

activityLogSchema.statics.getTopEndpoints = function (limit = 10) {
  return this.aggregate([
    { $group: { _id: '$endpoint', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

activityLogSchema.statics.getTableStats = function () {
  return this.aggregate([
    {
      $addFields: {
        table: {
          $let: {
            vars: {
              path: {
                $regexFind: {
                  input: '$endpoint',
                  regex: '^/([a-zA-Z]+)'
                }
              }
            },
            in: { $ifNull: ['$$path.captures.0', 'unknown'] }
          }
        }
      }
    },
    { $group: { _id: '$table', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

// Example cleanup method
activityLogSchema.statics.deleteOlderThan = function (days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return this.deleteMany({ createdAt: { $lt: cutoff } });
};



const LogEntry = mongoose.model("ActivityLog", activityLogSchema);
module.exports = LogEntry;
