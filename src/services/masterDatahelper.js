const { default: mongoose } = require('mongoose');
const Master = require('../models/master');
const AppError = require('../utils/appError');
const DEFAULT_EXCLUDE_FIELDS = ['isDeleted', 'metadata', 'created_by', 'updated_by'];

class MasterService {
  // Build projection: exclude defaults OR include only requested fields
  buildProjection(fields) {
    if (!fields) {
      // Exclude sensitive fields by default
      const projection = {};
      DEFAULT_EXCLUDE_FIELDS.forEach((field) => {
        projection[field] = 0;
      });
      return projection;
    }

    // Include only requested fields (comma-separated or array)
    if (typeof fields === 'string') {
      fields = fields.split(',');
    }

    const projection = {};
    fields.forEach((field) => {
      const trimmed = field.trim();
      // Always exclude these keys even if requested
      if (!DEFAULT_EXCLUDE_FIELDS.includes(trimmed)) {
        projection[trimmed] = 1;
      }
    });

    return projection;
  }
  async create(payload) {
    const doc = await Master.create({
      ...payload,
    });
    return doc;
  }

  async bulkUpsert(list, userId) {
    if (!Array.isArray(list) || list.length === 0) return { result: null, count: 0 };

    // PRE-CHECK DUPLICATES (before bulkWrite)
    for (const item of list) {
      const existing = await Master.findOne({
        type: item.type.toUpperCase(),
        $or: [{ code: item.code.trim() }, { label: item.label.trim() }],
        tenantId: item.tenantId || null,
        isDeleted: false,
      });

      if (existing) {
        throw new AppError(409, `Duplicate found: ${existing.code === item.code.trim() ? 'CODE' : 'LABEL'} '${item.code || item.label}' for type ${item.type}`);
      }
    }

    // Your existing bulkWrite logic (unchanged)
    const ops = list.map((item) => {
      const type = item.type.toUpperCase();
      const code = item.code.trim();
      // ... rest of your existing code EXACTLY SAME
      return {
        updateOne: {
          filter: { tenantId: item.tenantId || null, type, code },
          update: {
            $set: {
              type,
              code,
              label: item.label.trim(),
              altLabel: item.altLabel || null,
              // ... your existing fields
              updatedBy: userId || null,
            },
            $setOnInsert: { createdBy: userId || null },
          },
          upsert: true,
        },
      };
    });

    const result = await Master.bulkWrite(ops, { ordered: false });
    return { result, count: list.length };
  }
  // Bulk update by matching criteria (e.g., all GENDER items)
  async bulkUpdateByFilter(filter, update) {
    const fullUpdate = {
      ...update,
    };

    const result = await Master.updateMany(filter, { $set: fullUpdate });
    return { result, matched: result.matchedCount, modified: result.modifiedCount };
  }

  // Bulk update by list of IDs
  async bulkUpdateByIds(ids, update) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { result: null, count: 0 };
    }

    const fullUpdate = {
      ...update,
    };

    const result = await Master.updateMany({ _id: { $in: ids } }, { $set: fullUpdate });

    return { result, count: ids.length };
  }

  // Bulk update by type (common pattern)
  async bulkUpdateByType(type, update, tenantId) {
    const filter = {
      type: type.toUpperCase(),
      isActive: true,
      isDeleted: false,
    };

    if (tenantId) {
      filter.tenantId = tenantId;
    }

    return this.bulkUpdateByFilter(filter, update);
  }

  async bulkDeleteByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { result: null, count: 0 };
    }

    const result = await Master.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          isDeleted: true,
          isActive: false,
        },
      }
    );

    return { result, count: ids.length };
  }

  async getByIdOrCode(idOrCode, fields) {
    if (!idOrCode) return null;

    const isObjectId = mongoose.Types.ObjectId.isValid(idOrCode);

    const filter = {
      ...(isObjectId ? { _id: idOrCode } : { code: idOrCode }),
      isActive: true,
      isDeleted: false,
    };

    const projection = this.buildProjection(fields);

    const doc = await Master.findOne(filter, projection).lean().populate('tenantId', 'name slug');

    if (!doc) return null;

    // 🔥 Transform tenantId → tenantName
    return {
      ...doc,
      tenantId: doc.tenantId?.name || null,
      tenantSlug: doc.tenantId?.slug || null,
    };
  }

  async getList({ page = 1, limit = 20, sortBy = 'sortOrder', sortOrder = 'asc', search = '', type, tenantId, domain, isActive = false, includeDeleted = false, fields = null }) {
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const baseFilter = {
      isActive: isActive ? { $ne: false } : true,
      isDeleted: includeDeleted ? true : false,
    };

    if (type) baseFilter.type = type.toUpperCase();
    if (tenantId) baseFilter.tenantId = tenantId;
    if (domain) baseFilter.domain = domain;

    if (search) {
      baseFilter.$or = [{ code: { $regex: search, $options: 'i' } }, { label: { $regex: search, $options: 'i' } }, { altLabel: { $regex: search, $options: 'i' } }, { type: { $regex: search, $options: 'i' } }];
    }

    const projection = this.buildProjection(fields);

    const [docs, total] = await Promise.all([
      Master.find(baseFilter, projection)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(parseInt(limit))
        .lean()
        .populate('tenantId', 'name slug'),
      Master.countDocuments(baseFilter),
    ]);
    const transformedDocs = docs.map((doc) => ({
      ...doc,
      tenantId: doc.tenantId?.name || null,
      tenantSlug: doc.tenantId?.slug || null,
    }));

    return {
      result: transformedDocs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        pages: Math.ceil(total / limit),
        hasNext: skip + docs.length < total,
        hasPrev: page > 1,
      },
    };
  }
  async getGroupedByType({ tenantId, domain, includeInactive = false, includeDeleted = false, limitPerType = 1000 }) {
    const baseFilter = {
      isActive: includeInactive ? { $ne: false } : true,
      isDeleted: includeDeleted ? { $ne: true } : false,
    };

    if (tenantId) baseFilter.tenantId = tenantId;
    if (domain) baseFilter.domain = domain;

    // Fixed projection: only _id, type, code, label, isActive
    const projection = {
      _id: 1,
      type: 1,
      code: 1,
      label: 1,
      // isActive: 1
    };

    // Pipeline 1: Group + count total records per type
    const countPipeline = [
      { $match: baseFilter },
      {
        $group: {
          _id: '$type',
          totalCount: { $sum: 1 },
        },
      },
    ];

    // Pipeline 2: Group + limited values
    const dataPipeline = [
      { $match: baseFilter },
      { $project: projection },
      {
        $group: {
          _id: '$type',
          values: { $push: '$$ROOT' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          _id: 1,
          'values.sortOrder': 1,
          'values.label': 1,
        },
      },
      {
        $project: {
          type: '$_id',
          values: {
            $slice: ['$values', limitPerType],
          },
          count: 1, // limited count
        },
      },
    ];

    const [typeCounts, groupedData] = await Promise.all([Master.aggregate(countPipeline), Master.aggregate(dataPipeline)]);

    // Merge total counts with grouped data
    const typeCountMap = {};
    typeCounts.forEach((item) => {
      typeCountMap[item._id] = item.totalCount;
    });

    const types = groupedData.map((group) => ({
      type: group.type,
      values: group.values,
      count: group.count, // limited records returned
      // totalCount: typeCountMap[group.type] || group.count, // actual total
    }));

    return {
      types,
    };
  }

  async updateById(id, payload, user) {
    const doc = await Master.findById(id);
    if (!doc) throw new AppError(404, 'Record not found');
    // Apply updates
    Object.assign(doc, payload);
    if (payload.type) doc.type = payload.type.toUpperCase();
    if (payload.code) doc.code = payload.code.trim();
    if (payload.label) doc.label = payload.label.trim();
    doc.updated_by = user?._id || null;

    // ✅ Use .save() to trigger pre-save hook
    await doc.save();
    return doc;
  }

  async softDeleteById(id) {
    const doc = await Master.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        isActive: false,
      },
      { new: true }
    );
    return doc;
  }
}

module.exports = new MasterService();
