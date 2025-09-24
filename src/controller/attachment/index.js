// controllers/attachment.controller.js
const Attachment = require("../../models/attchments");
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
/**
 * Create a new attachment
 */
const createAttachment = async (req, res, next) => {
  try {
    const data = {
      ...req.body,
      tenant: req.tenantId,
      uploadedBy: req.userId,
      sourceIp: req.ip
    };
    const attachment = await Attachment.create(data);
    res.status(201).json(attachment);
  } catch (err) {
    next(err);
  }
};

/**
 * Get attachment by ID
 */
const getAttachmentById = async (req, res, next) => {
  try {
    const attachment = await Attachment.findOne({
      _id: req.params.id,
      tenant: req.tenantId
    });
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });
    res.json(attachment);
  } catch (err) {
    next(err);
  }
};

/**
 * List attachments with filters, pagination, and sorting
 */
const listAttachments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, tag, isPublic, status, search } = req.query;
    const filter = { tenant: req.tenantId };
    if (category) filter.category = category;
    if (tag) filter.tags = tag;
    if (isPublic !== undefined) filter.isPublic = isPublic === "true";
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { fileName: new RegExp(search, "i") },
        { tags: new RegExp(search, "i") }
      ];
    }

    const attachments = await Attachment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Attachment.countDocuments(filter);

    res.json({ total, page: Number(page), limit: Number(limit), data: attachments });
  } catch (err) {
    next(err);
  }
};

/**
 * Update attachment metadata
 */
const updateAttachment = async (req, res, next) => {
  try {
    const attachment = await Attachment.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      { ...req.body, updated_by: req.userId },
      { new: true }
    );
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });
    res.json(attachment);
  } catch (err) {
    next(err);
  }
};

/**
 * Soft delete attachment
 */
const deleteAttachment = async (req, res, next) => {
  try {
    const attachment = await Attachment.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });
    await attachment.softDelete(req.userId);
    res.json({ message: "Attachment deleted" });
  } catch (err) {
    next(err);
  }
};

/**
 * Restore soft-deleted attachment
 */
const restoreAttachment = async (req, res, next) => {
  try {
    const attachment = await Attachment.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });
    await attachment.restore();
    res.json({ message: "Attachment restored" });
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk delete attachments
 */
const bulkDeleteAttachments = async (req, res, next) => {
  try {
    const { ids } = req.body;
    await Attachment.updateMany(
      { _id: { $in: ids }, tenant: req.tenantId },
      { $set: { status: "deleted", deletedAt: new Date(), deletedBy: req.userId } }
    );
    res.json({ message: "Bulk delete completed" });
  } catch (err) {
    next(err);
  }
};

/**
 * Search attachments
 */
const searchAttachments = async (req, res, next) => {
  try {
    const { q } = req.query;
    const results = await Attachment.search(q).byTenant(req.tenantId);
    res.json(results);
  } catch (err) {
    next(err);
  }
};

/**
 * Analytics: total storage used
 */
const getTotalStorage = async (req, res, next) => {
  try {
    const result = await Attachment.getTotalStorageByTenant(req.tenantId);
    res.json(result[0] || { totalBytes: 0 });
  } catch (err) {
    next(err);
  }
};

/**
 * Analytics: count by category
 */
const getCountByCategory = async (req, res, next) => {
  try {
    const result = await Attachment.countByCategoryForTenant(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Analytics: public vs private
 */
const getPublicPrivateCount = async (req, res, next) => {
  try {
    const result = await Attachment.countPublicPrivate(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Analytics: top tags
 */
const getTopTags = async (req, res, next) => {
  try {
    const { limit = 5 } = req.query;
    const result = await Attachment.getTopTags(req.tenantId, Number(limit));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get largest files
 */
const getLargestFiles = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const result = await Attachment.getLargestFiles(Number(limit));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get recent uploads
 */
const getRecentUploads = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const result = await Attachment.getRecentUploads(Number(limit));
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Find untagged files
 */
const getUntaggedFiles = async (req, res, next) => {
  try {
    const result = await Attachment.findUntagged().byTenant(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Archive an attachment (soft lifecycle change)
 */
const archiveAttachment = async (req, res, next) => {
  try {
    const attachment = await Attachment.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });
    attachment.status = "archived";
    attachment.updated_by = req.userId;
    await attachment.save();
    res.json({ message: "Attachment archived" });
  } catch (err) {
    next(err);
  }
};

/**
 * Permanently purge an attachment (hard delete)
 */
const purgeAttachment = async (req, res, next) => {
  try {
    const result = await Attachment.deleteOne({ _id: req.params.id, tenant: req.tenantId });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Attachment not found" });
    res.json({ message: "Attachment permanently deleted" });
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk archive attachments
 */
const bulkArchiveAttachments = async (req, res, next) => {
  try {
    const { ids } = req.body;
    await Attachment.updateMany(
      { _id: { $in: ids }, tenant: req.tenantId },
      { $set: { status: "archived", updated_by: req.userId } }
    );
    res.json({ message: "Bulk archive completed" });
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk restore attachments
 */
const bulkRestoreAttachments = async (req, res, next) => {
  try {
    const { ids } = req.body;
    await Attachment.updateMany(
      { _id: { $in: ids }, tenant: req.tenantId },
      { $set: { status: "active", deletedAt: null, deletedBy: null } }
    );
    res.json({ message: "Bulk restore completed" });
  } catch (err) {
    next(err);
  }
};

/**
 * Analytics: average file size
 */
const getAverageFileSize = async (req, res, next) => {
  try {
    const result = await Attachment.getAverageFileSize(req.tenantId);
    res.json(result[0] || { avgSize: 0 });
  } catch (err) {
    next(err);
  }
};

/**
 * Analytics: size distribution
 */
const getSizeDistribution = async (req, res, next) => {
  try {
    const result = await Attachment.getSizeDistribution(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Analytics: top uploaders
 */
const getTopUploaders = async (req, res, next) => {
  try {
    const { limit = 5 } = req.query;
    const result = await Attachment.aggregate([
      { $match: { tenant: req.tenantId, status: "active" } },
      { $group: { _id: "$uploadedBy", count: { $sum: 1 }, totalSize: { $sum: "$fileSize" } } },
      { $sort: { count: -1 } },
      { $limit: Number(limit) }
    ]);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Maintenance: delete old files beyond retention period
 */
const deleteOldFiles = async (req, res, next) => {
  try {
    const { days = 365 } = req.query;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await Attachment.updateMany(
      { tenant: req.tenantId, uploadedAt: { $lt: cutoff }, status: "active" },
      { $set: { status: "deleted", deletedAt: new Date(), deletedBy: req.userId } }
    );
    res.json({ message: `Deleted ${result.modifiedCount} old files` });
  } catch (err) {
    next(err);
  }
};

/**
 * Maintenance: bulk categorize by extension
 */
const bulkCategorizeByExtension = async (req, res, next) => {
  try {
    const { extension, category } = req.body;
    const result = await Attachment.bulkCategorizeByExtension(extension, category);
    res.json({ message: `Updated ${result.modifiedCount} files to category ${category}` });
  } catch (err) {
    next(err);
  }
};

/**
 * Security: check access for a role
 */
const checkAccess = async (req, res, next) => {
  try {
    const { role, type = "read" } = req.query;
    const attachment = await Attachment.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });
    const hasAccess = attachment.hasAccess(role, type);
    res.json({ hasAccess });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  // CRUD
  createAttachment,
  getAttachmentById,
  listAttachments,
  updateAttachment,
  deleteAttachment,
  restoreAttachment,
  // Lifecycle
  archiveAttachment,
  purgeAttachment,
  bulkArchiveAttachments,
  bulkRestoreAttachments,
  // Bulk Ops
  bulkDeleteAttachments,
  // Search
  searchAttachments,
  // Analytics
  getTotalStorage,
  getCountByCategory,
  getPublicPrivateCount,
  getTopTags,
  getLargestFiles,
  getRecentUploads,
  getUntaggedFiles,
  getAverageFileSize,
  getSizeDistribution,
  getTopUploaders,
  // Maintenance
  deleteOldFiles,
  bulkCategorizeByExtension,
  // Security
  checkAccess
};