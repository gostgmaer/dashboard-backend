const mongoose = require('mongoose');

const allowedFilterFields = ['name', 'action', 'category', 'isActive']; // whitelist filterable fields
const allowedSortFields = ['name', 'category', 'createdAt', 'updatedAt', 'action'];
const defaultExcludeFields = ['__v', 'created_by', 'updated_by', 'isDeleted']; // fields to exclude by default
const permissionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      required: [true, 'Permission category is required'],
      enum: ['cart', 'wishlist', 'checkout', 'users', 'products', 'orders', 'inventory', 'reports', 'settings', 'system', 'content', 'analytics', 'finance', 'support', 'roles', 'permissions', 'address', 'attributes', 'category', 'brand', 'coupon', 'notifications', 'activitylogs', 'review', 'projects', 'tasks', 'resume', 'transactions', 'integrations', 'audit', 'compliance', 'localization', 'translation', 'billing', 'subscription', 'license', 'tax', 'shipment', 'warehouse', 'inventory_transfer', 'ticketing', 'escalation', 'message', 'announcement', 'banner', 'settings_advanced', 'environment', 'deployment', 'webhook', 'api_key', 'external_service', 'email_template', 'sms_template', 'dashboard', 'schedule', 'calendar', 'event', 'milestone', 'feedback', 'SLA', 'contract', 'document', 'attachment', 'onboarding', 'offboarding', 'maintenance', 'sync', 'import_export', 'backup', 'restore', 'migration', 'template', 'theme', 'branding', 'affiliate', 'referral', 'campaign', 'marketing', 'promotion', 'lead', 'crm', 'segment', 'workflow', 'automation', 'report_schedule', 'datalake', 'datamart', 'analytics_dashboard', 'visualization', 'retention', 'user_group', 'delegation', 'access_token', 'oauth', 'notification_channel', 'payment_gateway', 'payout', 'settlement', 'dispute', 'reconciliation', 'compliance_report', 'legal', 'consent', 'privacy', 'risk', 'fraud', 'monitoring', 'log', 'healthcheck', 'performance', 'quota', 'limit', 'threshold', 'policy', 'guideline', 'escalation_policy', 'knowledge_base', 'helpdesk', 'tutorial', 'faq', 'training', 'certification', 'award', 'badge', 'achievement', 'gamification', 'scoring', 'objective', 'kpi', 'roadmap', 'requirement', 'version', 'release', 'changelog'],
    },
    isDefault: { type: Boolean, default: false },
    key: {
      type: String,
      required: [true, 'Permission key is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z]+:[a-z_]+$/, 'Permission key must follow format: action:resource (e.g., create:product)'],
    },
    resource: {
      type: String,
      required: [true, 'Resource is required'],
      trim: true,
      lowercase: true,
    },

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: ['create','write', 'read', 'update', 'delete', 'view', 'manage', 'approve', 'reject', 'publish', 'archive', 'export', 'import'],
    },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

permissionSchema.pre('save', function (next) {
  if (!this.key && this.action && this.resource) {
    this.key = `${this.action}:${this.resource}`;
  }
  next();
});
permissionSchema.pre('validate', function (next) {
  if (!this.key && this.action && this.resource) {
    this.key = `${this.action.trim().toLowerCase()}:${this.resource.trim().toLowerCase()}`;
  }
  next();
});
// ===== Static Methods =====

// Get all active permissions
permissionSchema.statics.getActivePermissions = function () {
  return this.find({ isActive: true }).sort({ category: 1, name: 1 });
};

// Search permissions by keyword
permissionSchema.statics.searchPermissions = function (keyword) {
  return this.find({ name: { $regex: keyword, $options: 'i' } });
};

// Bulk create permissions
permissionSchema.statics.addManyPermissions = function (permissions) {
  return this.insertMany(permissions, { ordered: false });
};

// ===== Instance Methods =====

// Disable a permission
permissionSchema.methods.disable = async function () {
  this.isActive = false;
  await this.save();
  return this;
};

// Enable a permission
permissionSchema.methods.enable = async function () {
  this.isActive = true;
  await this.save();
  return this;
};
// ===== Instance Methods =====

// Rename a permission
permissionSchema.methods.rename = async function (newName) {
  this.name = newName.trim().toLowerCase();
  await this.save();
  return this;
};

// Update description
permissionSchema.methods.updateDescription = async function (desc) {
  this.description = desc;
  await this.save();
  return this;
};

// Move permission to a different category
permissionSchema.methods.changeCategory = async function (category) {
  this.category = category;
  await this.save();
  return this;
};

// Toggle active/inactive
permissionSchema.methods.toggleActive = async function () {
  this.isActive = !this.isActive;
  await this.save();
  return this.isActive;
};

// Format for API response
permissionSchema.methods.toAPIResponse = function () {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    category: this.category,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// ===== Static Methods =====

permissionSchema.statics.getAll = async function (options = {}) {
  const {
    filter = {},
    page = 1,
    limit = 20,
    isDeleted = false,
    sort = { createdAt: -1 },
    selectFields = null, // comma separated string of fields or array of fields
    search = null, // string keyword for text search on allowed fields
  } = options;

  // Basic safety and sanitization
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);
  const skip = (safePage - 1) * safeLimit;

  // Start with base filter excluding soft deleted documents
  const baseFilter = {
    $or: [{ isDeleted: isDeleted }, { isDeleted: { $exists: false } }],
  };

  // Build final filter by including only allowed fields and values
  const finalFilter = { ...baseFilter };
  for (const key of Object.keys(filter)) {
    if (allowedFilterFields.includes(key)) {
      finalFilter[key] = filter[key];
    }
  }

  // Add full text-like search on selected fields using regex (case insensitive)
  if (search) {
    const regex = new RegExp(search, 'i');
    finalFilter.$or = [
      { name: regex },
      // { category: regex },
      { action: regex },
    ];
  }

  // Validate sorting
  let sortOptions = {};
  if (typeof sort === 'string') {
    // comma separated "field:direction"
    sort.split(',').forEach((fieldStr) => {
      const [field, dir] = fieldStr.split(':').map((s) => s.trim());
      if (allowedSortFields.includes(field)) {
        sortOptions[field] = dir === 'asc' ? 1 : -1;
      }
    });
  } else if (typeof sort === 'object' && !Array.isArray(sort)) {
    for (const [field, dir] of Object.entries(sort)) {
      if (allowedSortFields.includes(field) && (dir === 1 || dir === -1)) {
        sortOptions[field] = dir;
      }
    }
  }
  if (Object.keys(sortOptions).length === 0) {
    sortOptions = { createdAt: -1 }; // default
  }

  // Select fields with exclusion of default fields, override if specified by client
  let projection = {};
  if (selectFields) {
    let fieldsArray = Array.isArray(selectFields) ? selectFields : selectFields.split(',').map((f) => f.trim());
    fieldsArray = fieldsArray.filter((f) => !defaultExcludeFields.includes(f));
    for (const field of fieldsArray) {
      projection[field] = 1;
    }
  } else {
    // Default exclude sensitive/internal fields
    for (const field of defaultExcludeFields) {
      projection[field] = 0;
    }
  }

  try {
    // Query data with pagination, sorting, and projection
    const query = this.find(finalFilter).skip(skip).limit(safeLimit).sort(sortOptions).select(projection);

    const result = await query.lean();
    const totalCount = await this.countDocuments(finalFilter);

    // Optional caching placeholder:
    // cache.set(cacheKey, { data, totalCount }, cacheTTL);

    return {
      result,
      pagination: {
        total: totalCount,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(totalCount / safeLimit),
      },
    };
  } catch (error) {
    // Enhance error to give clearer message based on error type
    if (error.name === 'CastError') {
      throw new Error('Invalid query parameter');
    }
    throw new Error(`Failed to get permissions: ${error.message}`);
  }
};

// Get permissions by category
permissionSchema.statics.getByCategory = function (category) {
  return this.find({ category }).sort({ name: 1 });
};

// Get inactive permissions
permissionSchema.statics.getInactivePermissions = function () {
  return this.find({ isActive: false });
};

// Bulk enable permissions
permissionSchema.statics.bulkEnable = function (ids) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { isActive: true } });
};

// Bulk disable permissions
permissionSchema.statics.bulkDisable = function (ids) {
  return this.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
};

// Delete multiple permissions
permissionSchema.statics.bulkDelete = function (ids) {
  return this.deleteMany({ _id: { $in: ids } });
};

// Check if a permission exists by name
permissionSchema.statics.existsByName = async function (name) {
  return !!(await this.findOne({ name: name.trim().toLowerCase() }));
};

// Create permission if it doesn't exist
permissionSchema.statics.createIfNotExists = async function (name, description = '', category = '') {
  const existing = await this.findOne({ name: name.trim().toLowerCase() });
  if (existing) return existing;
  return this.create({ name: name.trim().toLowerCase(), description, category });
};

// Get all permissions grouped by category
permissionSchema.statics.getGroupedByCategory = async function () {
  return await this.aggregate([
    { $match: { isActive: true, isDeleted: false, action: { $in: ['read', 'write', 'update', 'export', 'delete', 'manage'] } } },
    { $sort: { category: 1, name: 1 } },
    {
      $group: {
        _id: { $ifNull: ['$category', 'Uncategorized'] },
        action: { $push: { id: '$_id', action: '$action', name: '$name' } },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        action: 1,
      },
    },
    {
      $sort: { category: 1 },
    },
  ]);
};

permissionSchema.statics.getStatistics = async function () {
  return this.aggregate([
    {
      $group: {
        _id: {
          category: '$category',
          action: '$action',
          isActive: '$isActive',
        },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.category',
        actions: {
          $push: {
            action: '$_id.action',
            isActive: '$_id.isActive',
            count: '$count',
          },
        },
        totalCount: { $sum: '$count' },
      },
    },
    {
      $project: {
        category: '$_id',
        actions: 1,
        totalCount: 1,
        _id: 0,
      },
    },
    {
      $sort: { category: 1 },
    },
  ]);
};

// Search by partial match in name or description
permissionSchema.statics.search = function (keyword) {
  return this.find({
    $or: [{ name: { $regex: keyword, $options: 'i' } }, { description: { $regex: keyword, $options: 'i' } }],
  });
};

permissionSchema.statics.createPermission = async function (data) {
  if (!data.name || !data.action) {
    throw new Error('Name and action are required to create permission');
  }

  const payload = {
    ...data,
    name: `${data.name}:${data.action}`,
  };

  const existing = await this.findOne({ name: payload.name, action: payload.action, category: payload.category });
  if (existing) {
    throw new Error('Permission name must be unique');
  }

  const permission = new this(payload);
  return permission.save();
};

permissionSchema.statics.updatePermissionById = async function (permissionId, data) {
  if (!permissionId) {
    throw new Error('Permission ID is required');
  }
  if (!data.name || !data.action) {
    throw new Error('Name and action are required to update permission');
  }

  const updatedPayload = {
    ...data,
    name: `${data.name}:${data.action}`,
  };

  // Check if name is unique for other documents
  const existing = await this.findOne({ name: updatedPayload.name, _id: { $ne: permissionId } });
  if (existing) {
    throw new Error('Permission name must be unique');
  }

  return this.findByIdAndUpdate(permissionId, updatedPayload, { new: true });
};

permissionSchema.statics.getPermissionsGroupedByCategoryAndAction = async function () {
  const permissions = await this.find({ isActive: true, category: { $exists: true, $ne: '' } })
    .select('name action category isActive') // isActive of permission
    .lean();

  // Group by category, collect action info under each category
  const grouped = permissions.reduce((acc, perm) => {
    const cat = perm.category || 'Uncategorized';
    if (!acc[cat])
      acc[cat] = {
        actions: [],
        isActive: true, // Since this permission is active, category considered active
      };
    acc[cat].actions.push({
      id: perm._id,
      name: perm.name,
      action: perm.action,
    });
    return acc;
  }, {});

  // Convert to array and keep only active categories per presence of active permissions
  const result = Object.entries(grouped)
    .filter(([_, val]) => val.isActive) // keep only if active category
    .map(([category, val]) => ({
      category,
      action: val.actions,
    }));

  return { permissions: result };
};

const Permission = mongoose.model('Permission', permissionSchema);
module.exports = Permission;
