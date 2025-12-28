const mongoose = require('mongoose');
const AppError = require('../utils/appError');

const masterSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true, uppercase: true, trim: true },
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    altLabel: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', default: null, index: true },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    domain: { type: String, trim: true, index: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: undefined },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false }
);
/**
 * PRE-SAVE HOOK: Automatic duplicate check + normalization
 * Runs BEFORE every .save(), .create(), bulkWrite upsert
 */
masterSchema.pre('save', async function (next) {
  try {
    // Normalize fields
    this.type = this.type?.toUpperCase()?.trim();
    this.code = this.code?.trim();
    this.label = this.label?.trim();
    this.tenantId = this.tenantId?.trim() || null;

    // SKIP if soft-deleted (allow updates to deleted records)
    if (this.isDeleted) return next();

    // ✅ 1. isDefault LOGIC (NEW)
    if (this.isDefault === true) {
      // Reset ALL existing defaults for same type (active only)
      await this.constructor.updateMany(
        {
          type: this.type,
          isDefault: true,
          isActive: true,
          isDeleted: false,
          _id: { $ne: this._id }, // exclude current doc
        },
        {
          $set: {
            isDefault: false,
          },
        }
      );
    }

    // 2. CHECK CODE DUPLICATES (EXISTING)
    const codeDuplicate = await this.constructor.findOne({
      type: this.type,
      code: this.code,
      tenantId: this.tenantId,
      _id: { $ne: this._id }, // Exclude self for updates
      isDeleted: false,
    });

    if (codeDuplicate) {
      return next(new AppError(409, `Duplicate CODE '${this.code}' already exists for TYPE '${this.type}'${this.tenantId ? ` in TENANT '${this.tenantId}'` : ''}`));
    }

    // 3. CHECK LABEL DUPLICATES (EXISTING)
    const labelDuplicate = await this.constructor.findOne({
      type: this.type,
      label: this.label,
      tenantId: this.tenantId,
      _id: { $ne: this._id }, // Exclude self for updates
      isDeleted: false,
    });

    if (labelDuplicate) {
      return next(new AppError(409, `Duplicate LABEL '${this.label}' already exists for TYPE '${this.type}'${this.tenantId ? ` in TENANT '${this.tenantId}'` : ''}`));
    }

    next();
  } catch (error) {
    next(error);
  }
});

masterSchema.index({ tenantId: 1, type: 1, code: 1 }, { unique: true, sparse: true });
masterSchema.index({ tenantId: 1, type: 1, isActive: 1, isDeleted: 1, sortOrder: 1, label: 1 });
masterSchema.index({ tenantId: 1, domain: 1, isActive: 1 });

module.exports = mongoose.model('Master', masterSchema);
