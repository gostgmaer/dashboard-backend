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
masterSchema.pre('save', async function () {
  // Normalize fields
  this.type = this.type?.toUpperCase()?.trim();
  this.code = this.code?.trim();
  this.label = this.label?.trim();

  // Allow updates to soft-deleted records, but skip validations
  if (this.isDeleted) return;

  // ✅ 1. isDefault LOGIC
  if (this.isDefault === true) {
    await this.constructor.updateMany(
      {
        type: this.type,
        isDefault: true,
        isActive: true,
        isDeleted: false,
        _id: { $ne: this._id }, // exclude current doc
      },
      {
        $set: { isDefault: false },
      }
    );
  }

  // ✅ 2. CHECK CODE DUPLICATES
  const codeDuplicate = await this.constructor.findOne({
    type: this.type,
    code: this.code,
    _id: { $ne: this._id },
    isDeleted: false,
  });

  if (codeDuplicate) {
    throw new AppError(409, `Duplicate CODE '${this.code}' already exists for TYPE '${this.type}'${this.tenantId ? ` in TENANT '${this.tenantId}'` : ''}`);
  }

  // ✅ 3. CHECK LABEL DUPLICATES
  const labelDuplicate = await this.constructor.findOne({
    type: this.type,
    label: this.label,
    _id: { $ne: this._id },
    isDeleted: false,
  });

  if (labelDuplicate) {
    throw new AppError(409, `Duplicate LABEL '${this.label}' already exists for TYPE '${this.type}'${this.tenantId ? ` in TENANT '${this.tenantId}'` : ''}`);
  }
});

masterSchema.index({ tenantId: 1, type: 1, code: 1 }, { unique: true, sparse: true });
masterSchema.index({ tenantId: 1, type: 1, isActive: 1, isDeleted: 1, sortOrder: 1, label: 1 });
masterSchema.index({ tenantId: 1, domain: 1, isActive: 1 });

module.exports = mongoose.model('Master', masterSchema);
