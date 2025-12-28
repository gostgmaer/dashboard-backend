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
    isDeleted: { type: Boolean, default: false },
    // Metadata
    storageType: { type: String, enum: ["local", "s3", "cloudinary", "gcs", "firebase", "azure"], default: "local" },
    bucketName: { type: String, trim: true }, // S3 bucket, Firebase storage bucket, or Azure container
    storagePath: { type: String, trim: true }, // Full path in cloud storage
    cloudMetadata: { type: Map, of: String }, // Store cloud-specific metadata (e.g., ETag for S3)
    checksum: { type: String, trim: true },
    encoding: { type: String, trim: true },
    extension: { type: String, trim: true },
    dimensions: {
      width: { type: Number },
      height: { type: Number },
    },
    duration: { type: Number }, // seconds

    // Security & Access
    isPublic: { type: Boolean, default: true, immutable: true, index: true },
    permissions: {
      read: [{ type: String, enum: ["user", "admin", "customer", "guest"] }],
      write: [{ type: String, enum: ["user", "admin", "customer"] }],
    },

    // Classification
    tags: [{ type: String, index: true }],
    category: { type: String, enum: ["image", "video", "document", "audio", "other"], default: "other", index: true },

    // Audit Info
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
  delete obj.cloudMetadata;
  delete obj.sourceIp;
  return obj;
};

// Get file age in days
attachmentSchema.methods.getFileAgeInDays = function () {
  return Math.floor((Date.now() - this.uploadedAt.getTime()) / (1000 * 60 * 60 * 24));
};
// Generate signed URL for cloud storage
attachmentSchema.methods.generateSignedUrl = async function (expirySeconds = 3600) {
  let signedUrl = this.fileUrl;
  
  switch (this.storageType) {
    case "s3":
      // Implement AWS S3 signed URL generation
      // Example: const AWS = require('aws-sdk');
      // const s3 = new AWS.S3();
      // signedUrl = await s3.getSignedUrlPromise('getObject', {
      //   Bucket: this.bucketName,
      //   Key: this.storagePath,
      //   Expires: expirySeconds
      // });
      break;
    case "firebase":
      // Implement Firebase Storage signed URL generation
      // Example: const { getStorage, getDownloadURL } = require('firebase/storage');
      // const storage = getStorage();
      // signedUrl = await getDownloadURL(ref(storage, this.storagePath));
      break;
    case "azure":
      // Implement Azure Blob Storage SAS token generation
      // Example: const { BlobServiceClient } = require('@azure/storage-blob');
      // const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_CONNECTION_STRING);
      // const containerClient = blobServiceClient.getContainerClient(this.bucketName);
      // const blobClient = containerClient.getBlobClient(this.storagePath);
      // signedUrl = await blobClient.generateSasUrl({ expiresOn: new Date(Date.now() + expirySeconds * 1000) });
      break;
    case "gcs":
      // Implement Google Cloud Storage signed URL generation
      // Example: const { Storage } = require('@google-cloud/storage');
      // const storage = new Storage();
      // signedUrl = await storage.bucket(this.bucketName).file(this.storagePath).getSignedUrl({
      //   action: 'read',
      //   expires: Date.now() + expirySeconds * 1000
      // });
      break;
  }
  
  return `${signedUrl}?signed=true&expiresIn=${expirySeconds}`;
};

// Check if file exceeds size limit (MB)
attachmentSchema.methods.exceedsSizeLimit = function (maxMB) {
  return this.fileSize > maxMB * 1024 * 1024;
};


// Replace file metadata (e.g., after re-upload)
attachmentSchema.methods.replaceFile = async function (newFileData, updated_by) {
  Object.assign(this, newFileData);
  if (updated_by) this.updated_by = updated_by;
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

// Get file extension from fileName if not explicitly stored
attachmentSchema.methods.getFileExtension = function () {
  if (this.extension) return this.extension.toLowerCase();
  const parts = this.fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

// Archive file
attachmentSchema.methods.archiveFile = async function (archivedBy) {
  this.status = "archived";
  this.updatedAt = new Date();
  if (archivedBy) this.updated_by = archivedBy;
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
  
  // Validate cloud storage configuration
  if (["s3", "firebase", "azure", "gcs"].includes(this.storageType)) {
    if (!this.bucketName) {
      return next(new Error("bucketName is required for cloud storage"));
    }
    if (!this.storagePath) {
      return next(new Error("storagePath is required for cloud storage"));
    }
  }
  
  next();
});

attachmentSchema.post("save", function (doc) {
  //console.log(`[AUDIT] Attachment ${doc._id} saved for tenant ${doc.tenant || "N/A"}`);
});

/* ===========================
   📌 INDEXES
   =========================== */
attachmentSchema.index({ tenant: 1, category: 1 });
attachmentSchema.index({ fileName: "text", tags: "text" });
attachmentSchema.index({ storageType: 1, bucketName: 1 });

const Attachment = mongoose.model("Attachment", attachmentSchema);
module.exports = Attachment;