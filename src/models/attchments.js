const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", index: true }, // multi-tenant support

    // File Info
    fileName: { type: String, required: true, trim: true },
    fileType: { type: String, required: true, trim: true },
    fileSize: { type: Number, required: true },
    fileUrl: { type: String, required: true, trim: true },
    thumbnailUrl: { type: String, trim: true },
 isDeleted: { type: Boolean, default: false},
    // Metadata
    storageType: { type: String, enum: ["local", "s3", "cloudinary", "gcs"], default: "local" },
    checksum: { type: String, trim: true },
    encoding: { type: String, trim: true },
    extension: { type: String, trim: true },
    dimensions: {
      width: { type: Number },
      height: { type: Number },
    },
    duration: { type: Number }, // seconds

    // Security & Access
    isPublic: { type: Boolean, default: true, index: true },
    permissions: {
      read: [{ type: String, enum: ["user", "admin", "customer", "guest"] }],
      write: [{ type: String, enum: ["user", "admin", "customer"] }],
    },

    // Classification
    tags: [{ type: String, index: true }],
    category: { type: String, enum: ["image", "video", "document", "audio", "other"], default: "other", index: true },

    // Audit Info
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sourceIp: { type: String, trim: true },

    // Lifecycle
    status: { type: String, enum: ["active", "archived", "deleted"], default: "active", index: true },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

/* ===========================
   📌 INSTANCE METHODS
   =========================== */

// Human-readable file size
attachmentSchema.methods.getReadableSize = function () {
  if (this.fileSize < 1024) return `${this.fileSize} B`;
  if (this.fileSize < 1024 * 1024) return `${(this.fileSize / 1024).toFixed(2)} KB`;
  return `${(this.fileSize / (1024 * 1024)).toFixed(2)} MB`;
};

// Type checks
attachmentSchema.methods.isImage = function () {
  return this.category === "image" || this.fileType.startsWith("image/");
};
attachmentSchema.methods.isVideo = function () {
  return this.category === "video" || this.fileType.startsWith("video/");
};
attachmentSchema.methods.isDocument = function () {
  return this.category === "document" || [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ].includes(this.fileType);
};

// Soft delete
attachmentSchema.methods.softDelete = async function (deletedBy) {
  this.status = "deleted";
  this.deletedAt = new Date();
  if (deletedBy) this.deletedBy = deletedBy;
  await this.save();
  return this;
};

// Restore
attachmentSchema.methods.restore = async function () {
  this.status = "active";
  this.deletedAt = null;
  this.deletedBy = null;
  await this.save();
  return this;
};

// Clone attachment (e.g., for another tenant/user)
attachmentSchema.methods.cloneForTenant = async function (tenantId, uploadedBy) {
  const clone = this.toObject();
  delete clone._id;
  clone.tenant = tenantId;
  clone.uploadedBy = uploadedBy;
  clone.uploadedAt = new Date();
  return this.constructor.create(clone);
};

// Mask sensitive fields for public API
attachmentSchema.methods.maskForPublic = function () {
  const obj = this.toObject();
  if (!this.isPublic) {
    delete obj.fileUrl;
    delete obj.thumbnailUrl;
  }
  delete obj.checksum;
  delete obj.sourceIp;
  return obj;
};

// Get file age in days
attachmentSchema.methods.getFileAgeInDays = function () {
  return Math.floor((Date.now() - this.uploadedAt.getTime()) / (1000 * 60 * 60 * 24));
};

// Check if file exceeds size limit (MB)
attachmentSchema.methods.exceedsSizeLimit = function (maxMB) {
  return this.fileSize > maxMB * 1024 * 1024;
};

// Generate signed URL (for private storage)
attachmentSchema.methods.generateSignedUrl = function (expirySeconds = 3600) {
  // Placeholder — integrate with S3, GCS, etc.
  return `${this.fileUrl}?signed=true&expiresIn=${expirySeconds}`;
};

// Replace file metadata (e.g., after re-upload)
attachmentSchema.methods.replaceFile = async function (newFileData, updatedBy) {
  Object.assign(this, newFileData);
  if (updatedBy) this.updated_by = updatedBy;
  await this.save();
  return this;
};

// Add tags without duplicates
attachmentSchema.methods.addTags = async function (newTags) {
  const tagSet = new Set([...(this.tags || []), ...newTags]);
  this.tags = Array.from(tagSet);
  await this.save();
  return this;
};

// Remove specific tags
attachmentSchema.methods.removeTags = async function (tagsToRemove) {
  this.tags = (this.tags || []).filter(tag => !tagsToRemove.includes(tag));
  await this.save();
  return this;
};

// Check if user has read/write access
attachmentSchema.methods.hasAccess = function (role, type = "read") {
  return this.permissions?.[type]?.includes(role);
};

// Get file extension from fileName if not explicitly stored
attachmentSchema.methods.getFileExtension = function () {
  if (this.extension) return this.extension.toLowerCase();
  const parts = this.fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

// Update permissions
attachmentSchema.methods.updatePermissions = async function (newPermissions) {
  this.permissions = {
    read: newPermissions.read || this.permissions.read,
    write: newPermissions.write || this.permissions.write,
  };
  await this.save();
  return this;
};

// Archive file
attachmentSchema.methods.archiveFile = async function (archivedBy) {
  this.status = "archived";
  this.updatedAt = new Date();
  if (archivedBy) this.updatedBy = archivedBy;
  await this.save();
  return this;
};

/* ===========================
   📌 STATIC METHODS
   =========================== */

// Find by tag
attachmentSchema.statics.findByTag = function (tag) {
  return this.find({ tags: tag });
};

// Find by category
attachmentSchema.statics.findByCategory = function (category) {
  return this.find({ category });
};

// Find public files
attachmentSchema.statics.findPublic = function () {
  return this.find({ isPublic: true, status: "active" });
};

// Bulk delete by tenant
attachmentSchema.statics.bulkDeleteByTenant = function (tenantId) {
  return this.updateMany({ tenant: tenantId }, { $set: { status: "deleted", deletedAt: new Date() } });
};

// Count by category
attachmentSchema.statics.countByCategory = function (tenantId) {
  return this.aggregate([
    { $match: { tenant: tenantId } },
    { $group: { _id: "$category", count: { $sum: 1 } } }
  ]);
};

// Search by filename or tags
attachmentSchema.statics.search = function (query) {
  const regex = new RegExp(query, "i");
  return this.find({ $or: [{ fileName: regex }, { tags: regex }] });
};

// Get total storage used (bytes) for a tenant
attachmentSchema.statics.getTotalStorageByTenant = function (tenantId) {
  return this.aggregate([
    { $match: { tenant: tenantId, status: "active" } },
    { $group: { _id: null, totalBytes: { $sum: "$fileSize" } } }
  ]);
};

// Get top N largest files
attachmentSchema.statics.getLargestFiles = function (limit = 10) {
  return this.find({ status: "active" }).sort({ fileSize: -1 }).limit(limit);
};

// Get most recent uploads
attachmentSchema.statics.getRecentUploads = function (limit = 10) {
  return this.find({ status: "active" }).sort({ uploadedAt: -1 }).limit(limit);
};

// Count files by category for a tenant
attachmentSchema.statics.countByCategoryForTenant = function (tenantId) {
  return this.aggregate([
    { $match: { tenant: tenantId, status: "active" } },
    { $group: { _id: "$category", count: { $sum: 1 } } }
  ]);
};

// Count public vs private files
attachmentSchema.statics.countPublicPrivate = function (tenantId) {
  return this.aggregate([
    { $match: { tenant: tenantId, status: "active" } },
    { $group: { _id: "$isPublic", count: { $sum: 1 } } }
  ]);
};

// Find files without tags
attachmentSchema.statics.findUntagged = function () {
  return this.find({ $or: [{ tags: { $exists: false } }, { tags: { $size: 0 } }] });
};

// Bulk update category by extension
attachmentSchema.statics.bulkCategorizeByExtension = function (extension, category) {
  return this.updateMany({ extension }, { $set: { category } });
};

// Find by uploadedBy
attachmentSchema.statics.findByUploadedBy = function (userId) {
  return this.find({ uploadedBy: userId, status: "active" });
};

// Bulk update tags (add or remove)
attachmentSchema.statics.bulkUpdateTags = function (attachmentIds, tags, action = "add") {
  const update = action === "add"
    ? { $addToSet: { tags: { $each: tags } } }
    : { $pull: { tags: { $in: tags } } };
  return this.updateMany({ _id: { $in: attachmentIds } }, update);
};

// Get oldest files
attachmentSchema.statics.getOldestFiles = function (limit = 10) {
  return this.find({ status: "active" }).sort({ uploadedAt: 1 }).limit(limit);
};

/* ===========================
   📌 QUERY HELPERS
   =========================== */
attachmentSchema.query.active = function () {
  return this.where({ status: "active" });
};
attachmentSchema.query.byTenant = function (tenantId) {
  return this.where({ tenant: tenantId });
};
attachmentSchema.query.withTag = function (tag) {
  return this.where({ tags: tag });
};
attachmentSchema.query.byUploadedBy = function (userId) {
  return this.where({ uploadedBy: userId });
};
attachmentSchema.query.byStorageType = function (storageType) {
  return this.where({ storageType });
};

/* ===========================
   📌 EXTRA STATISTICS HELPERS
   =========================== */

// Average file size for a tenant
attachmentSchema.statics.getAverageFileSize = function (tenantId) {
  return this.aggregate([
    { $match: { tenant: tenantId, status: "active" } },
    { $group: { _id: null, avgSize: { $avg: "$fileSize" } } }
  ]);
};

// Distribution of file sizes (small/medium/large)
attachmentSchema.statics.getSizeDistribution = function (tenantId) {
  return this.aggregate([
    { $match: { tenant: tenantId, status: "active" } },
    {
      $bucket: {
        groupBy: "$fileSize",
        boundaries: [0, 1024 * 1024, 10 * 1024 * 1024, 50 * 1024 * 1024, Infinity],
        default: "50MB+",
        output: { count: { $sum: 1 } }
      }
    }
  ]);
};

// Most common tags
attachmentSchema.statics.getTopTags = function (tenantId, limit = 5) {
  return this.aggregate([
    { $match: { tenant: tenantId, status: "active" } },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);
};

/* ===========================
   📌 HOOKS
   =========================== */
attachmentSchema.pre("save", function (next) {
  if (this.fileName) this.fileName = this.fileName.trim();
  if (this.extension) this.extension = this.extension.toLowerCase();
  next();
});

attachmentSchema.post("save", function (doc) {
  console.log(`[AUDIT] Attachment ${doc._id} saved for tenant ${doc.tenant || "N/A"}`);
});

/* ===========================
   📌 INDEXES
   =========================== */
attachmentSchema.index({ tenant: 1, category: 1 });
attachmentSchema.index({ fileName: "text", tags: "text" });

const Attachment = mongoose.model("Attachment", attachmentSchema);
module.exports = Attachment;