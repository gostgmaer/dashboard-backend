const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    label: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    email: { type: String },
    status: {
      type: String,
      default: 'pending',
      trim: true,
      enum: ['pending', 'active', 'deleted', 'archived', 'draft'],
      index: true,
    },
    addressLine1: { type: String, required: true },
    addressLine2: String,
    addressLine3: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: {
      type: String,
      default: 'IN',
      trim: true,
      required: true,
    },

    postalCode: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tags: [{ type: String, trim: true }],
    history: [
      {
        action: {
          type: String,
          enum: ['created', 'updated', 'soft_deleted', 'archived', 'restored', 'tag_added', 'tag_removed', 'merged', 'status_changed', 'label_changed', 'verified', 'standardized'],
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        changes: [{ field: String, value: String }],
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
addressSchema.index({ user: 1, isDefault: 1, status: 1 });
addressSchema.index({ coordinates: '2dsphere' });
addressSchema.index({ tags: 1 });
addressSchema.index({ isVerified: 1 });
addressSchema.index({ isActive: 1, isDeleted: 1 });

// Virtuals
addressSchema.virtual('formattedAddress').get(function () {
  return `${this.addressLine1 || ''}, ${this.addressLine2 ? this.addressLine2 + ', ' : ''}${this.addressLine3 ? this.addressLine3 + ', ' : ''}${this.city || ''}, ${this.state || ''}, ${this.country || ''}${this.postalCode ? ' - ' + this.postalCode : ''}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '');
});

// Middleware: Ensure one default address
addressSchema.pre('save', async function (next) {
  if (this.isDefault && this.isActive && !this.isDeleted) {
    await this.constructor.updateMany(
      {
        user: this.user,
        _id: { $ne: this._id },
        isDeleted: false,
      },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Middleware: Update updated_by
addressSchema.pre('save', function (next) {
  if (this.isModified() && !this.isNew) {
    this.updated_by = this.updated_by || this.created_by;
  }
});

// Middleware: Track history on create
addressSchema.pre('save', function (next) {
  if (this.isNew) {
    this.history = [
      {
        action: 'created',
        user: this.created_by,
        timestamp: new Date(),
        changes: [],
      },
    ];
  }
});

// Middleware: Track history on update
addressSchema.pre('save', function (next) {
  if (this.isModified() && !this.isNew) {
    const changes = this.modifiedPaths().map((field) => ({
      field,
      value: String(this[field]),
    }));
    this.history.push({
      action: 'updated',
      user: this.updated_by || this.created_by,
      timestamp: new Date(),
      changes,
    });
  }
  // Cap history at 100 entries
  if (this.history.length > 100) {
    this.history = this.history.slice(-100);
  }
});

// Middleware: Soft delete
addressSchema.pre('deleteOne', { document: true, query: true }, async function (next) {
  this.status = 'deleted';
  this.history.push({
    action: 'soft_deleted',
    user: this.updated_by || this.created_by,
    timestamp: new Date(),
    changes: [],
  });
  await this.save();
});

// Middleware: Log sensitive operations to external audit system (placeholder)
addressSchema.post('save', async function (doc, next) {
  if (this.isModified('status') || this.isModified('isDefault') || this.isModified('isVerified')) {
    // Placeholder: Log to external audit system
    // await auditService.logOperation('address', this._id, this.updated_by, this.history[this.history.length - 1]);
  }
});

// Instance Methods

addressSchema.methods = {
  /* ---------------- DEFAULT ---------------- */

  async setAsDefault(updated_by) {
    await this.model('Address').updateMany({ user: this.user, _id: { $ne: this._id }, isDeleted: false }, { $set: { isDefault: false } });

    this.isDefault = true;
    this.updated_by = updated_by;

    this.history.push({
      action: 'updated',
      user: updated_by,
      changes: [{ field: 'isDefault', value: 'true' }],
    });

    return this.save();
  },

  formatAddress() {
    return this.formattedAddress;
  },

  /* ---------------- LIFECYCLE ---------------- */

  async softDelete(updated_by) {
    this.isDeleted = true;
    this.isActive = false;
    this.isDefault = false;
    this.status = 'archived';
    this.updated_by = updated_by;

    this.history.push({ action: 'soft_deleted', user: updated_by });
    return this.save();
  },

  async restore(updated_by) {
    this.isDeleted = false;
    this.isActive = true;
    this.status = 'active';
    this.updated_by = updated_by;

    this.history.push({ action: 'restored', user: updated_by });
    return this.save();
  },
  /* ---------------- UPDATE ---------------- */

  async partialUpdate(updates, updated_by) {
    const allowedFields = ['fullName', 'phoneNumber', 'addressLine1', 'addressLine2', 'addressLine3', 'city', 'state', 'country', 'postalCode', 'label', 'coordinates', 'isDefault', 'isVerified', 'tags'];

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        this[key] = updates[key];
      }
    });

    this.updated_by = updated_by;

    this.history.push({
      action: 'updated',
      user: updated_by,
      changes: Object.keys(updates).map((k) => ({
        field: k,
        value: String(updates[k]),
      })),
    });

    return this.save();
  },

  /* ---------------- TAGS ---------------- */

  async addTag(tag, updated_by) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updated_by = updated_by;

      this.history.push({
        action: 'tag_added',
        user: updated_by,
        changes: [{ field: 'tag', value: tag }],
      });

      await this.save();
    }
    return this;
  },

  async removeTag(tag, updated_by) {
    this.tags = this.tags.filter((t) => t !== tag);
    this.updated_by = updated_by;

    this.history.push({
      action: 'tag_removed',
      user: updated_by,
      changes: [{ field: 'tag', value: tag }],
    });

    return this.save();
  },

  async clearTags(updated_by) {
    const removed = [...this.tags];
    this.tags = [];
    this.updated_by = updated_by;

    this.history.push({
      action: 'tag_removed',
      user: updated_by,
      changes: removed.map((t) => ({ field: 'tag', value: t })),
    });

    return this.save();
  },

  /* ---------------- GEO ---------------- */

  async updateCoordinates(lat, lng, updated_by) {
    this.coordinates = { type: 'Point', coordinates: [lng, lat] };
    this.updated_by = updated_by;

    this.history.push({
      action: 'updated',
      user: updated_by,
      changes: [{ field: 'coordinates', value: `${lat},${lng}` }],
    });

    return this.save();
  },

  /* ---------------- CLONE ---------------- */

  async cloneAddress() {
    return this.model('Address').create({
      user: this.user,

      status: 'draft',
      isActive: false,
      isDeleted: false,
      isDefault: false,
      isVerified: false,

      label: this.label,
      fullName: this.fullName,
      phoneNumber: this.phoneNumber,
      email: this.email,

      addressLine1: this.addressLine1,
      addressLine2: this.addressLine2,
      addressLine3: this.addressLine3,
      city: this.city,
      state: this.state,
      country: this.country,
      postalCode: this.postalCode,

      coordinates: this.coordinates,
      tags: [...(this.tags || [])],

      created_by: this.updated_by || this.created_by,
      updated_by: this.updated_by || this.created_by,

      history: [
        {
          action: 'created',
          user: this.updated_by || this.created_by,
          changes: [{ field: 'clonedFrom', value: String(this._id) }],
        },
      ],
    });
  },

  /* ---------------- MERGE ---------------- */

  async mergeAddress(otherAddress) {
    const fields = ['fullName', 'phoneNumber', 'email', 'addressLine1', 'addressLine2', 'addressLine3', 'city', 'state', 'country', 'postalCode', 'label', 'coordinates', 'tags'];

    const changes = [];

    for (const field of fields) {
      if (!this[field] && otherAddress[field]) {
        this[field] = otherAddress[field];
        changes.push({ field, value: String(otherAddress[field]) });
      }
    }

    if (changes.length) {
      this.history.push({
        action: 'merged',
        user: this.updated_by || this.created_by,
        changes,
      });
      await this.save();
    }

    return this;
  },

  /* ---------------- COMPARE ---------------- */

  compareAddress(otherAddress) {
    const fields = ['fullName', 'phoneNumber', 'email', 'addressLine1', 'addressLine2', 'addressLine3', 'city', 'state', 'country', 'postalCode'];

    const differences = {};

    for (const field of fields) {
      if (String(this[field] || '') !== String(otherAddress[field] || '')) {
        differences[field] = {
          current: this[field],
          other: otherAddress[field],
        };
      }
    }

    return {
      isIdentical: Object.keys(differences).length === 0,
      differences,
    };
  },

  /* ---------------- LABEL ---------------- */

  async setLabel(label) {
    this.label = label;

    this.history.push({
      action: 'label_changed',
      user: this.updated_by || this.created_by,
      changes: [{ field: 'label', value: label }],
    });

    return this.save();
  },

  /* ---------------- VERIFY ---------------- */

  async verifyAddress() {
    this.isVerified = true;

    this.history.push({
      action: 'verified',
      user: this.updated_by || this.created_by,
      changes: [{ field: 'isVerified', value: 'true' }],
    });

    return this.save();
  },

  /* ---------------- STANDARDIZE ---------------- */

  async standardizeAddress() {
    this.history.push({
      action: 'standardized',
      user: this.updated_by || this.created_by,
      changes: [],
    });

    return this.save();
  },
};

addressSchema.statics = {
  /* ---------------- BASIC GETTERS ---------------- */

  getDeletedAddresses(userId) {
    return this.find({ user: userId, isDeleted: true }).lean();
  },

  getDefaultAddress(userId) {
    return this.findOne({
      user: userId,
      isDefault: true,
      isDeleted: false,
      isActive: true,
    });
  },

  async ensureDefaultAddress(userId) {
    const existing = await this.findOne({
      user: userId,
      isDefault: true,
      isDeleted: false,
      isActive: true,
    });

    if (existing) return existing;

    const firstActive = await this.findOne({
      user: userId,
      isDeleted: false,
      isActive: true,
    }).sort({ createdAt: 1 });

    if (!firstActive) return null;

    await this.updateOne({ _id: firstActive._id }, { $set: { isDefault: true } });

    return firstActive;
  },

  getUserAddresses(userId, { page = 1, limit = 10 } = {}) {
    return this.find({
      user: userId,
      isDeleted: false,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  },

  /* ---------------- BULK LIFECYCLE ---------------- */

  bulkSoftDelete(filter, updated_by) {
    return this.updateMany(
      { ...filter, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          isActive: false,
          isDefault: false,
          status: 'archived',
          updated_by,
        },
        $push: {
          history: {
            action: 'soft_deleted',
            user: updated_by,
            timestamp: new Date(),
            changes: [],
          },
        },
      }
    );
  },

  bulkRestore(filter, updated_by) {
    return this.updateMany(
      { ...filter, isDeleted: true },
      {
        $set: {
          isDeleted: false,
          isActive: true,
          status: 'active',
          updated_by,
        },
        $push: {
          history: {
            action: 'restored',
            user: updated_by,
            timestamp: new Date(),
            changes: [],
          },
        },
      }
    );
  },

  bulkArchive(filter, updated_by) {
    return this.updateMany(
      { ...filter, isDeleted: false },
      {
        $set: {
          status: 'archived',
          updated_by,
        },
        $push: {
          history: {
            action: 'archived',
            user: updated_by,
            timestamp: new Date(),
            changes: [],
          },
        },
      }
    );
  },

  purgeDeletedAddresses(days = 30) {
    const threshold = new Date(Date.now() - days * 86400000);
    return this.deleteMany({
      isDeleted: true,
      updatedAt: { $lte: threshold },
    });
  },

  /* ---------------- SEARCH & FILTER ---------------- */

  searchAddresses(userId, query, { page = 1, limit = 10 } = {}) {
    const regex = new RegExp(query, 'i');

    return this.find({
      user: userId,
      isDeleted: false,
      $or: [{ fullName: regex }, { addressLine1: regex }, { addressLine2: regex }, { addressLine3: regex }, { city: regex }, { state: regex }, { country: regex }, { postalCode: regex }],
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  },

  getAddressesByTag(userId, tag, { page = 1, limit = 10 } = {}) {
    return this.find({
      user: userId,
      tags: tag,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  },

  findByLabel(userId, label, { page = 1, limit = 10 } = {}) {
    return this.find({
      user: userId,
      label,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  },

  /* ---------------- GEO ---------------- */

  findNearbyAddresses(lat, lng, maxDistance = 10000, filter = {}) {
    return this.find({
      ...filter,
      isDeleted: false,
      coordinates: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxDistance,
        },
      },
    }).lean();
  },

  /* ---------------- HISTORY ---------------- */

  getAddressHistory(addressId) {
    return this.findById(addressId).select('history').lean();
  },

  getRecentChanges(userId, { limit = 10 } = {}) {
    return this.aggregate([
      { $match: { user: userId } },
      { $unwind: '$history' },
      { $sort: { 'history.timestamp': -1 } },
      { $limit: limit },
      {
        $project: {
          addressId: '$_id',
          action: '$history.action',
          user: '$history.user',
          timestamp: '$history.timestamp',
          changes: '$history.changes',
        },
      },
    ]);
  },

  /* ---------------- ANALYTICS ---------------- */

  async getAddressAnalytics(userId) {
    const match = userId ? { user: userId, isDeleted: false } : { isDeleted: false };

    return Promise.all([this.aggregate([{ $match: match }, { $group: { _id: '$city', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]), this.aggregate([{ $match: match }, { $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]), this.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }])]).then(([cityCounts, tagCounts, statusCounts]) => ({
      cityCounts,
      tagCounts,
      statusCounts,
    }));
  },

  /* ---------------- STREAM ---------------- */

  async streamUserAddresses(userId, callback) {
    const cursor = this.find({
      user: userId,
      isDeleted: false,
    })
      .lean()
      .cursor();

    for await (const doc of cursor) {
      await callback(doc);
    }
  },
  async exportUserAddresses(userId, format = 'json') {
    const addresses = await this.find({
      user: userId,
      isDeleted: false,
    }).lean();

    if (format === 'csv') {
      const headers = ['fullName', 'phoneNumber', 'email', 'addressLine1', 'addressLine2', 'addressLine3', 'city', 'state', 'country', 'postalCode', 'label', 'isDefault', 'isVerified', 'tags', 'status', 'createdAt', 'updatedAt'];

      let csv = headers.join(',') + '\n';

      for (const addr of addresses) {
        const row = headers
          .map((field) => {
            let value = addr[field] ?? '';

            if (Array.isArray(value)) {
              value = value.join(';');
            }

            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(',');

        csv += row + '\n';
      }

      return csv;
    }

    // Default JSON export
    return addresses;
  },

  async importUserAddresses(addresses, userId, created_by) {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return [];
    }

    const docs = addresses.map((addr) => ({
      user: userId,

      // lifecycle
      status: addr.status || 'draft',
      isActive: addr.isActive ?? true,
      isDeleted: false,
      isDefault: false,
      isVerified: false,

      // core fields
      label: addr.label || 'home',
      fullName: addr.fullName,
      phoneNumber: addr.phoneNumber,
      email: addr.email,

      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2,
      addressLine3: addr.addressLine3,
      city: addr.city,
      state: addr.state,
      country: addr.country || 'IN',
      postalCode: addr.postalCode,

      coordinates: addr.coordinates,
      tags: addr.tags || [],

      created_by,
      updated_by: created_by,

      history: [
        {
          action: 'created',
          user: created_by,
          timestamp: new Date(),
          changes: [{ field: 'imported', value: 'true' }],
        },
      ],
    }));

    // ordered:false → continue on individual document errors
    return this.insertMany(docs, { ordered: false });
  },
  findDuplicateAddresses(userId) {
    return this.aggregate([
      {
        $match: {
          user: userId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: {
            addressLine1: '$addressLine1',
            city: '$city',
            state: '$state',
            country: '$country',
            postalCode: '$postalCode',
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          address: '$_id',
          count: 1,
          ids: 1,
        },
      },
    ]);
  },
  async batchCreateAddresses(addresses, userId, created_by) {
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return [];
    }

    const docs = addresses.map((addr) => ({
      user: userId,

      isActive: addr.isActive ?? true,
      isDeleted: false,
      isDefault: false,
      isVerified: false,

      status: addr.status || 'draft',

      label: addr.label || 'home',
      fullName: addr.fullName,
      phoneNumber: addr.phoneNumber,
      email: addr.email,

      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2,
      addressLine3: addr.addressLine3,
      city: addr.city,
      state: addr.state,
      country: addr.country || 'IN',
      postalCode: addr.postalCode,

      coordinates: addr.coordinates,
      tags: addr.tags || [],

      created_by,
      updated_by: created_by,

      history: [
        {
          action: 'created',
          user: created_by,
          changes: [],
        },
      ],
    }));

    return this.insertMany(docs, { ordered: false });
  },
  /* =========================
     GETTERS
  ========================= */

  getDeletedAddresses(userId) {
    return this.find({
      user: userId,
      isDeleted: true,
    }).lean();
  },

  getDefaultAddress(userId) {
    return this.findOne({
      user: userId,
      isDefault: true,
      isDeleted: false,
      isActive: true,
    });
  },

  /* =========================
     BULK SOFT DELETE
  ========================= */

  async bulkSoftDelete(filter, updated_by) {
    return this.updateMany(
      {
        ...filter,
        isDeleted: false,
      },
      {
        $set: {
          isDeleted: true,
          isActive: false,
          isDefault: false,
          status: 'archived',
          updated_by,
        },
        $push: {
          history: {
            action: 'soft_deleted',
            user: updated_by,
            timestamp: new Date(),
            changes: [],
          },
        },
      }
    );
  },

  /* =========================
     BULK RESTORE
  ========================= */

  async bulkRestore(filter, updated_by) {
    return this.updateMany(
      {
        ...filter,
        isDeleted: true,
      },
      {
        $set: {
          isDeleted: false,
          isActive: true,
          status: 'active',
          updated_by,
        },
        $push: {
          history: {
            action: 'restored',
            user: updated_by,
            timestamp: new Date(),
            changes: [],
          },
        },
      }
    );
  },
};

// Error handling middleware
addressSchema.post('save', function (error, doc, next) {
  next(error);
});

const Address = mongoose.model('Address', addressSchema);
module.exports = Address;
