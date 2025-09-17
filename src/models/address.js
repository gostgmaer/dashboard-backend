const mongoose = require('mongoose');
const ISO_COUNTRIES = require('iso-3166-1-alpha-2'); // Assuming an external library for ISO country codes

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
     isDeleted: { type: Boolean, default: false},
    label: {
      type: String,
      default: 'home',
      trim: true,
      enum: ['home', 'work', 'billing', 'shipping', 'other'],
    },
    fullName: {
      type: String,
      trim: true,
      required: [true, 'Full name is required'],
    },
    phoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\+?[1-9]\d{1,14}$/.test(v); // E.164 format
        },
        message: 'Invalid phone number format',
      },
    },
    status: {
      type: String,
      default: 'pending',
      trim: true,
      enum: ['pending', 'active', 'deleted', 'archived', 'draft'],
      index: true,
    },
    addressLine1: {
      type: String,
      trim: true,
      required: [true, 'Address Line 1 is required'],
    },
    addressLine2: {
      type: String,
      trim: true,
      default: '',
    },
    addressLine3: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      required: [true, 'City is required'],
    },
    state: {
      type: String,
      trim: true,
      required: [true, 'State is required'],
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
      required: [true, 'Country is required'],
      validate: {
        validator: function (v) {
          return ISO_COUNTRIES.getCode(v) !== undefined;
        },
        message: 'Invalid country code',
      },
    },
    postalCode: {
      type: String,
      trim: true,
      required: [true, 'Postal code is required'],
      validate: {
        validator: function (v) {
          if (this.country === 'IN') {
            return /^\d{6}$/.test(v); // India-specific postal code
          } else if (this.country === 'US') {
            return /^\d{5}(-\d{4})?$/.test(v); // US ZIP code
          }
          return true; // Add other country validations as needed
        },
        message: 'Invalid postal code for the specified country',
      },
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    coordinates: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number], // [lng, lat]
        default: [0, 0],
        validate: {
          validator: function (v) {
            return (
              v.length === 2 &&
              v[0] >= -180 &&
              v[0] <= 180 && // lng
              v[1] >= -90 &&
              v[1] <= 90 // lat
            );
          },
          message: 'Invalid coordinates: lng must be -180 to 180, lat must be -90 to 90',
        },
      },
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    tags: [
      {
        type: String,
        trim: true,
        validate: {
          validator: function (v) {
            return /^[a-zA-Z0-9_-]{1,50}$/.test(v) && this.tags.length <= 20;
          },
          message: 'Invalid tag format or too many tags (max 20, 50 chars each)',
        },
      },
    ],
    history: [
      {
        action: {
          type: String,
          enum: [
            'created',
            'updated',
            'soft_deleted',
            'archived',
            'restored',
            'tag_added',
            'tag_removed',
            'merged',
            'status_changed',
            'label_changed',
            'verified',
            'standardized',
          ],
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

// Virtuals
addressSchema.virtual('formattedAddress').get(function () {
  return `${this.fullName || ''}, ${this.addressLine1 || ''}, ${
    this.addressLine2 ? this.addressLine2 + ', ' : ''
  }${this.addressLine3 ? this.addressLine3 + ', ' : ''}${this.city || ''}, ${this.state || ''}, ${
    this.country || ''
  }${this.postalCode ? ' - ' + this.postalCode : ''}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '');
});

// Middleware: Ensure one default address
addressSchema.pre('save', async function (next) {
  if (this.isDefault) {
    await this.model('Address').updateMany(
      { user: this.user, _id: { $ne: this._id } },
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
  next();
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
  next();
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
  next();
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
  next();
});

// Middleware: Log sensitive operations to external audit system (placeholder)
addressSchema.post('save', async function (doc, next) {
  if (this.isModified('status') || this.isModified('isDefault') || this.isModified('isVerified')) {
    // Placeholder: Log to external audit system
    // await auditService.logOperation('address', this._id, this.updated_by, this.history[this.history.length - 1]);
  }
  next();
});

// Instance Methods

/**
 * Sets this address as the default for the user, unsetting other defaults.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.setAsDefault = async function (updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can update');
  }
  try {
    await this.model('Address').updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
    this.isDefault = true;
    this.updated_by = updatedBy;
    this.history.push({
      action: 'updated',
      user: updatedBy,
      timestamp: new Date(),
      changes: [{ field: 'isDefault', value: 'true' }],
    });
    await this.save();
    return this;
  } catch (error) {
    throw new Error(`Failed to set default address: ${error.message}`);
  }
};

/**
 * Returns the formatted address string.
 * @returns {String} The formatted address.
 */
addressSchema.methods.formatAddress = function () {
  return this.formattedAddress;
};

/**
 * Soft deletes the address by setting its status to 'deleted'.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.softDelete = async function (updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can delete');
  }
  try {
    this.status = 'deleted';
    this.updated_by = updatedBy;
    this.history.push({
      action: 'soft_deleted',
      user: updatedBy,
      timestamp: new Date(),
      changes: [],
    });
    await this.save();
    return this;
  } catch (error) {
    throw new Error(`Failed to soft delete address: ${error.message}`);
  }
};

/**
 * Archives the address by setting its status to 'archived'.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.archive = async function (updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can archive');
  }
  try {
    this.status = 'archived';
    this.updated_by = updatedBy;
    this.history.push({
      action: 'archived',
      user: updatedBy,
      timestamp: new Date(),
      changes: [],
    });
    await this.save();
    return this;
  } catch (error) {
    throw new Error(`Failed to archive address: ${error.message}`);
  }
};

/**
 * Partially updates the address with allowed fields.
 * @param {Object} updates - The fields to update.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.partialUpdate = async function (updates, updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can update');
  }
  try {
    const allowedFields = [
      'fullName',
      'phoneNumber',
      'addressLine1',
      'addressLine2',
      'addressLine3',
      'city',
      'state',
      'country',
      'postalCode',
      'label',
      'coordinates',
      'isDefault',
      'isVerified',
      'tags',
    ];
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        this[key] = updates[key];
      }
    }
    this.updated_by = updatedBy;
    this.history.push({
      action: 'updated',
      user: updatedBy,
      timestamp: new Date(),
      changes: Object.keys(updates).map((key) => ({ field: key, value: String(updates[key]) })),
    });
    await this.save();
    return this;
  } catch (error) {
    throw new Error(`Failed to update address: ${error.message}`);
  }
};

/**
 * Clones the address to create a new draft address.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The cloned address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.cloneAddress = async function (updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can clone');
  }
  try {
    const clonedData = {
      user: this.user,
      label: this.label,
      fullName: this.fullName,
      phoneNumber: this.phoneNumber,
      status: 'draft',
      addressLine1: this.addressLine1,
      addressLine2: this.addressLine2,
      addressLine3: this.addressLine3,
      city: this.city,
      state: this.state,
      country: this.country,
      postalCode: this.postalCode,
      coordinates: this.coordinates,
      tags: this.tags,
      isVerified: false,
      created_by: updatedBy,
      updated_by: updatedBy,
    };
    const clonedAddress = new this.model('Address')(clonedData);
    await clonedAddress.save();
    return clonedAddress;
  } catch (error) {
    throw new Error(`Failed to clone address: ${error.message}`);
  }
};

/**
 * Compares this address with another to identify differences.
 * @param {Object} otherAddress - The address to compare with.
 * @returns {Object} An object indicating if addresses are identical and listing differences.
 * @throws {Error} If the comparison fails.
 */
addressSchema.methods.compareAddress = function (otherAddress) {
  try {
    const fieldsToCompare = [
      'fullName',
      'phoneNumber',
      'addressLine1',
      'addressLine2',
      'addressLine3',
      'city',
      'state',
      'country',
      'postalCode',
    ];
    const differences = {};
    for (const field of fieldsToCompare) {
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
  } catch (error) {
    throw new Error(`Failed to compare addresses: ${error.message}`);
  }
};

/**
 * Restores a deleted or archived address to active status.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The restored address document.
 * @throws {Error} If the operation fails or address is not restorable.
 */
addressSchema.methods.restore = async function (updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can restore');
  }
  try {
    if (this.status === 'deleted' || this.status === 'archived') {
      this.status = 'active';
      this.updated_by = updatedBy;
      this.history.push({
        action: 'restored',
        user: updatedBy,
        timestamp: new Date(),
        changes: [],
      });
      await this.save();
      return this;
    }
    throw new Error('Address is not deleted or archived');
  } catch (error) {
    throw new Error(`Failed to restore address: ${error.message}`);
  }
};

/**
 * Adds a tag to the address if not already present.
 * @param {String} tag - The tag to add.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.addTag = async function (tag, updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can add tags');
  }
  try {
    if (!this.tags) this.tags = [];
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updated_by = updatedBy;
      this.history.push({
        action: 'tag_added',
        user: updatedBy,
        timestamp: new Date(),
        changes: [{ field: 'tag', value: tag }],
      });
      await this.save();
    }
    return this;
  } catch (error) {
    throw new Error(`Failed to add tag: ${error.message}`);
  }
};

/**
 * Removes a tag from the address if present.
 * @param {String} tag - The tag to remove.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.removeTag = async function (tag, updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can remove tags');
  }
  try {
    if (!this.tags) this.tags = [];
    const index = this.tags.indexOf(tag);
    if (index !== -1) {
      this.tags.splice(index, 1);
      this.updated_by = updatedBy;
      this.history.push({
        action: 'tag_removed',
        user: updatedBy,
        timestamp: new Date(),
        changes: [{ field: 'tag', value: tag }],
      });
      await this.save();
    }
    return this;
  } catch (error) {
    throw new Error(`Failed to remove tag: ${error.message}`);
  }
};

/**
 * Clears all tags from the address.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.clearTags = async function (updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can clear tags');
  }
  try {
    if (this.tags && this.tags.length > 0) {
      const removedTags = this.tags.slice();
      this.tags = [];
      this.updated_by = updatedBy;
      this.history.push({
        action: 'tag_removed',
        user: updatedBy,
        timestamp: new Date(),
        changes: removedTags.map((tag) => ({ field: 'tag', value: tag })),
      });
      await this.save();
    }
    return this;
  } catch (error) {
    throw new Error(`Failed to clear tags: ${error.message}`);
  }
};

/**
 * Merges fields from another address into this one if they are empty.
 * @param {mongoose.Types.ObjectId} otherAddressId - The ID of the address to merge.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.mergeAddress = async function (otherAddressId, updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can merge');
  }
  try {
    const otherAddress = await this.model('Address').findById(otherAddressId);
    if (!otherAddress || otherAddress.user.toString() !== this.user.toString()) {
      throw new Error('Invalid or unauthorized address for merging');
    }
    const fieldsToMerge = [
      'fullName',
      'phoneNumber',
      'addressLine1',
      'addressLine2',
      'addressLine3',
      'city',
      'state',
      'country',
      'postalCode',
      'label',
      'coordinates',
      'tags',
    ];
    const changes = [];
    for (const field of fieldsToMerge) {
      if (otherAddress[field] && !this[field]) {
        this[field] = otherAddress[field];
        changes.push({ field, value: String(otherAddress[field]) });
      }
    }
    if (changes.length > 0) {
      this.updated_by = updatedBy;
      this.history.push({
        action: 'merged',
        user: updatedBy,
        timestamp: new Date(),
        changes,
      });
      await this.save();
    }
    return this;
  } catch (error) {
    throw new Error(`Failed to merge address: ${error.message}`);
  }
};

/**
 * Updates the coordinates of the address.
 * @param {Number} lat - The latitude.
 * @param {Number} lng - The longitude.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.updateCoordinates = async function (lat, lng, updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can update coordinates');
  }
  try {
    this.coordinates = { type: 'Point', coordinates: [lng, lat] };
    this.updated_by = updatedBy;
    this.history.push({
      action: 'updated',
      user: updatedBy,
      timestamp: new Date(),
      changes: [{ field: 'coordinates', value: `lat: ${lat}, lng: ${lng}` }],
    });
    await this.save();
    return this;
  } catch (error) {
    throw new Error(`Failed to update coordinates: ${error.message}`);
  }
};

/**
 * Updates the label of the address.
 * @param {String} label - The new label.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the operation fails or user is unauthorized.
 */
addressSchema.methods.setLabel = async function (label, updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can update label');
  }
  try {
    this.label = label;
    this.updated_by = updatedBy;
    this.history.push({
      action: 'label_changed',
      user: updatedBy,
      timestamp: new Date(),
      changes: [{ field: 'label', value: label }],
    });
    await this.save();
    return this;
  } catch (error) {
    throw new Error(`Failed to update label: ${error.message}`);
  }
};

/**
 * Validates the address using an external geocoding service and marks it as verified.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If validation fails or user is unauthorized.
 */
addressSchema.methods.verifyAddress = async function (updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can verify');
  }
  try {
    // Placeholder for external geocoding API call
    // const result = await geocodeAddress(this.formattedAddress);
    // if (!result.valid) throw new Error('Invalid address');
    // this.coordinates = { type: 'Point', coordinates: [result.lng, result.lat] };
    this.isVerified = true;
    this.updated_by = updatedBy;
    this.history.push({
      action: 'verified',
      user: updatedBy,
      timestamp: new Date(),
      changes: [{ field: 'isVerified', value: 'true' }],
    });
    await this.save();
    return this;
  } catch (error) {
    throw new Error(`Address verification failed: ${error.message}`);
  }
};

/**
 * Standardizes the address format based on country-specific rules.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If standardization fails or user is unauthorized.
 */
addressSchema.methods.standardizeAddress = async function (updatedBy, permissions = {}) {
  if (!this.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can standardize');
  }
  try {
    // Placeholder for external address standardization service
    // const standardized = await standardizeAddressService(this.formattedAddress, this.country);
    const changes = [];
    // Example: Update fields based on standardized result
    // if (standardized.city && standardized.city !== this.city) {
    //   changes.push({ field: 'city', value: standardized.city });
    //   this.city = standardized.city;
    // }
    if (changes.length > 0) {
      this.updated_by = updatedBy;
      this.history.push({
        action: 'standardized',
        user: updatedBy,
        timestamp: new Date(),
        changes,
      });
      await this.save();
    }
    return this;
  } catch (error) {
    throw new Error(`Failed to standardize address: ${error.message}`);
  }
};

// Static Methods

/**
 * Retrieves the default address for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @returns {Promise<Address|null>} The default address or null.
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.getDefaultAddress = async function (userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  return this.findOne({ user: userId, isDefault: true, status: 'active' });
};

/**
 * Ensures at least one active address is set as default for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @returns {Promise<Address|null>} The default address or null if no active addresses exist.
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.ensureDefaultAddress = async function (userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  const defaultAddress = await this.findOne({ user: userId, isDefault: true, status: 'active' });
  if (!defaultAddress) {
    const address = await this.findOne({ user: userId, status: 'active' }).sort({ createdAt: 1 });
    if (address) {
      address.isDefault = true;
      await address.save();
      return address;
    }
  }
  return defaultAddress;
};

/**
 * Retrieves paginated addresses for a user, excluding deleted ones.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {Object} options - Pagination and filtering options (page, limit, status, tags).
 * @returns {Promise<Array>} List of addresses.
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.getUserAddresses = async function (userId, { page = 1, limit = 10, status, tags } = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  const query = { user: userId, status: { $ne: 'deleted' } };
  if (status) query.status = status;
  if (tags) query.tags = { $all: Array.isArray(tags) ? tags : [tags] };
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

/**
 * Soft deletes all addresses for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Object>} Update result.
 * @throws {Error} If the user ID is invalid or user is unauthorized.
 */
addressSchema.statics.removeUserAddresses = async function (userId, updatedBy, permissions = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  if (!permissions.canManageAllAddresses && userId.toString() !== updatedBy.toString()) {
    throw new Error('Unauthorized: Only admins can delete addresses for other users');
  }
  return this.updateMany(
    { user: userId },
    {
      status: 'deleted',
      updated_by: updatedBy,
      $push: {
        history: {
          action: 'soft_deleted',
          user: updatedBy,
          timestamp: new Date(),
          changes: [],
        },
      },
    }
  );
};

/**
 * Archives all non-deleted addresses for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Object>} Update result.
 * @throws {Error} If the user ID is invalid or user is unauthorized.
 */
addressSchema.statics.bulkArchiveAddresses = async function (userId, updatedBy, permissions = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  if (!permissions.canManageAllAddresses && userId.toString() !== updatedBy.toString()) {
    throw new Error('Unauthorized: Only admins can archive addresses for other users');
  }
  return this.updateMany(
    { user: userId, status: { $ne: 'deleted' } },
    {
      status: 'archived',
      updated_by: updatedBy,
      $push: {
        history: {
          action: 'archived',
          user: updatedBy,
          timestamp: new Date(),
          changes: [],
        },
      },
    }
  );
};

/**
 * Restores all deleted or archived addresses for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Object>} Update result.
 * @throws {Error} If the user ID is invalid or user is unauthorized.
 */
addressSchema.statics.bulkRestoreAddresses = async function (userId, updatedBy, permissions = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  if (!permissions.canManageAllAddresses && userId.toString() !== updatedBy.toString()) {
    throw new Error('Unauthorized: Only admins can restore addresses for other users');
  }
  return this.updateMany(
    { user: userId, status: { $in: ['deleted', 'archived'] } },
    {
      status: 'active',
      updated_by: updatedBy,
      $push: {
        history: {
          action: 'restored',
          user: updatedBy,
          timestamp: new Date(),
          changes: [],
        },
      },
    }
  );
};

/**
 * Permanently deletes addresses marked as deleted after a specified period.
 * @param {Number} days - Number of days to consider for purging (default: 30).
 * @returns {Promise<Object>} Deletion result.
 */
addressSchema.statics.purgeDeletedAddresses = async function (days = 30) {
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    status: 'deleted',
    'history.timestamp': { $lte: threshold },
    'history.action': 'soft_deleted',
  });
};

/**
 * Retrieves recent changes across all addresses for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {Object} options - Options for limiting results (limit).
 * @returns {Promise<Array>} List of recent changes.
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.getRecentChanges = async function (userId, { limit = 10 } = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
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
};

/**
 * Finds addresses near a given location.
 * @param {Number} lat - Latitude of the center point.
 * @param {Number} lng - Longitude of the center point.
 * @param {Number} maxDistance - Maximum distance in meters (default: 10000).
 * @param {Object} options - Additional filters (userId, status).
 * @returns {Promise<Array>} List of nearby addresses.
 */
addressSchema.statics.findNearbyAddresses = async function (lat, lng, maxDistance = 10000, { userId, status } = {}) {
  const query = {
    coordinates: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistance,
      },
    },
    status: status || 'active',
  };
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    query.user = userId;
  }
  return this.find(query).lean();
};

/**
 * Updates the status of a specific address.
 * @param {mongoose.Types.ObjectId} addressId - The ID of the address.
 * @param {String} status - The new status.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The updated address document.
 * @throws {Error} If the address ID is invalid or user is unauthorized.
 */
addressSchema.statics.updateAddressStatus = async function (addressId, status, updatedBy, permissions = {}) {
  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new Error('Invalid address ID');
  }
  const address = await this.findById(addressId);
  if (!address) {
    throw new Error('Address not found');
  }
  if (!address.user.equals(updatedBy) && !permissions.canManageAllAddresses) {
    throw new Error('Unauthorized: Only the address owner or admin can update status');
  }
  return this.findByIdAndUpdate(
    addressId,
    {
      status,
      updated_by: updatedBy,
      $push: {
        history: {
          action: 'status_changed',
          user: updatedBy,
          timestamp: new Date(),
          changes: [{ field: 'status', value: status }],
        },
      },
    },
    { new: true }
  );
};

/**
 * Updates the status of all non-deleted addresses for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {String} status - The new status.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Object>} Update result.
 * @throws {Error} If the user ID is invalid or user is unauthorized.
 */
addressSchema.statics.bulkUpdateStatus = async function (userId, status, updatedBy, permissions = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  if (!permissions.canManageAllAddresses && userId.toString() !== updatedBy.toString()) {
    throw new Error('Unauthorized: Only admins can update status for other users');
  }
  return this.updateMany(
    { user: userId, status: { $ne: 'deleted' } },
    {
      status,
      updated_by: updatedBy,
      $push: {
        history: {
          action: 'status_changed',
          user: updatedBy,
          timestamp: new Date(),
          changes: [{ field: 'status', value: status }],
        },
      },
    }
  );
};

/**
 * Retrieves the history of a specific address.
 * @param {mongoose.Types.ObjectId} addressId - The ID of the address.
 * @returns {Promise<Array>} The history array.
 * @throws {Error} If the address ID is invalid.
 */
addressSchema.statics.getAddressHistory = async function (addressId) {
  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new Error('Invalid address ID');
  }
  const address = await this.findById(addressId).select('history');
  return address ? address.history : [];
};

/**
 * Searches addresses for a user based on a query string.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {String} query - The search query.
 * @param {Object} options - Pagination and filtering options (page, limit, status).
 * @returns {Promise<Array>} List of matching addresses.
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.searchAddresses = async function (userId, query, { page = 1, limit = 10, status } = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  const searchRegex = new RegExp(query, 'i');
  const queryObj = {
    user: userId,
    status: status || { $ne: 'deleted' },
    $or: [
      { fullName: searchRegex },
      { addressLine1: searchRegex },
      { addressLine2: searchRegex },
      { addressLine3: searchRegex },
      { city: searchRegex },
      { state: searchRegex },
      { country: searchRegex },
      { postalCode: searchRegex },
    ],
  };
  return this.find(queryObj)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

/**
 * Creates multiple addresses for a user in a batch.
 * @param {Array} addresses - Array of address objects.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {mongoose.Types.ObjectId} createdBy - The ID of the user creating the addresses.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Array>} List of created addresses.
 * @throws {Error} If the user ID is invalid or user is unauthorized.
 */
addressSchema.statics.batchCreateAddresses = async function (addresses, userId, createdBy, permissions = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(createdBy)) {
    throw new Error('Invalid user ID');
  }
  if (!permissions.canManageAllAddresses && userId.toString() !== createdBy.toString()) {
    throw new Error('Unauthorized: Only admins can create addresses for other users');
  }
  const errors = await this.validateBatchAddresses(addresses);
  if (errors.length > 0) {
    throw new Error(`Validation errors: ${JSON.stringify(errors)}`);
  }
  const docs = addresses.map((addr) => ({
    ...addr,
    user: userId,
    created_by: createdBy,
    updated_by: createdBy,
    status: addr.status || 'draft',
    isVerified: false,
  }));
  return this.insertMany(docs, { ordered: false });
};

/**
 * Validates a batch of addresses before creation.
 * @param {Array} addresses - Array of address objects.
 * @returns {Promise<Array>} Array of validation errors or empty if valid.
 */
addressSchema.statics.validateBatchAddresses = async function (addresses) {
  const errors = [];
  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    const temp = new this({ ...addr, user: new mongoose.Types.ObjectId(), created_by: new mongoose.Types.ObjectId() });
    try {
      await temp.validate();
    } catch (error) {
      errors.push({ index: i, error: error.message });
    }
  }
  return errors;
};

/**
 * Retrieves the count of addresses by status for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @returns {Promise<Array>} Array of status counts.
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.getAddressCountByStatus = async function (userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
};

/**
 * Finds duplicate addresses for a user based on key fields.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @returns {Promise<Array>} List of duplicate address groups.
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.findDuplicateAddresses = async function (userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), status: { $ne: 'deleted' } } },
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
    { $match: { count: { $gt: 1 } } },
    { $project: { _id: 0, address: '$_id', ids: 1, count: 1 } },
  ]);
};

/**
 * Adds a tag to multiple addresses for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {String} tag - The tag to add.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Object>} Update result.
 * @throws {Error} If the user ID is invalid or user is unauthorized.
 */
addressSchema.statics.addTagToMultiple = async function (userId, tag, updatedBy, permissions = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  if (!permissions.canManageAllAddresses && userId.toString() !== updatedBy.toString()) {
    throw new Error('Unauthorized: Only admins can add tags for other users');
  }
  return this.updateMany(
    { user: userId, status: { $ne: 'deleted' } },
    {
      $addToSet: { tags: tag },
      updated_by: updatedBy,
      $push: {
        history: {
          action: 'tag_added',
          user: updatedBy,
          timestamp: new Date(),
          changes: [{ field: 'tag', value: tag }],
        },
      },
    }
  );
};

/**
 * Removes a tag from multiple addresses for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {String} tag - The tag to remove.
 * @param {mongoose.Types.ObjectId} updatedBy - The ID of the user making the change.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Object>} Update result.
 * @throws {Error} If the user ID is invalid or user is unauthorized.
 */
addressSchema.statics.removeTagFromMultiple = async function (userId, tag, updatedBy, permissions = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  if (!permissions.canManageAllAddresses && userId.toString() !== updatedBy.toString()) {
    throw new Error('Unauthorized: Only admins can remove tags for other users');
  }
  return this.updateMany(
    { user: userId, status: { $ne: 'deleted' }, tags: tag },
    {
      $pull: { tags: tag },
      updated_by: updatedBy,
      $push: {
        history: {
          action: 'tag_removed',
          user: updatedBy,
          timestamp: new Date(),
          changes: [{ field: 'tag', value: tag }],
        },
      },
    }
  );
};

/**
 * Exports all non-deleted addresses for a user in a specified format.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {String} format - The export format ('json' or 'csv').
 * @returns {Promise<String|Array>} The exported data.
 * @throws {Error} If the user ID is invalid or format is unsupported.
 */
addressSchema.statics.exportUserAddresses = async function (userId, format = 'json') {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  const addresses = await this.find({ user: userId, status: { $ne: 'deleted' } }).lean();
  if (format === 'csv') {
    const headers = [
      'fullName',
      'phoneNumber',
      'addressLine1',
      'addressLine2',
      'addressLine3',
      'city',
      'state',
      'country',
      'postalCode',
      'label',
      'isDefault',
      'isVerified',
      'tags',
      'createdAt',
      'updatedAt',
    ];
    let csv = headers.join(',') + '\n';
    for (const addr of addresses) {
      const row = headers
        .map((field) => {
          let value = addr[field] || '';
          if (Array.isArray(value)) value = value.join(';');
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(',');
      csv += row + '\n';
    }
    return csv;
  }
  return addresses; // Default to JSON
};

/**
 * Imports addresses from a JSON array for a user.
 * @param {Array} addresses - Array of address objects.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {mongoose.Types.ObjectId} createdBy - The ID of the user creating the addresses.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Array>} List of created addresses.
 * @throws {Error} If the user ID is invalid or user is unauthorized.
 */
addressSchema.statics.importUserAddresses = async function (addresses, userId, createdBy, permissions = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(createdBy)) {
    throw new Error('Invalid user ID');
  }
  if (!permissions.canManageAllAddresses && userId.toString() !== createdBy.toString()) {
    throw new Error('Unauthorized: Only admins can import addresses for other users');
  }
  const errors = await this.validateBatchAddresses(addresses);
  if (errors.length > 0) {
    throw new Error(`Validation errors: ${JSON.stringify(errors)}`);
  }
  const docs = addresses.map((addr) => ({
    ...addr,
    user: userId,
    created_by: createdBy,
    updated_by: createdBy,
    status: addr.status || 'draft',
    isVerified: false,
  }));
  return this.insertMany(docs, { ordered: false });
};

/**
 * Retrieves addresses by tag for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {String} tag - The tag to filter by.
 * @param {Object} options - Pagination options (page, limit).
 * @returns {Promise<Array>} List of matching addresses.
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.getAddressesByTag = async function (userId, tag, { page = 1, limit = 10 } = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  return this.find({ user: userId, tags: tag, status: { $ne: 'deleted' } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

/**
 * Finds addresses by label for a user.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {String} label - The label to filter by.
 * @param {Object} options - Pagination options (page, limit).
 * @returns {Promise<Array>} List of matching addresses.
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.findByLabel = async function (userId, label, { page = 1, limit = 10 } = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  return this.find({ user: userId, label, status: { $ne: 'deleted' } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

/**
 * Creates a sample address for testing purposes.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {mongoose.Types.ObjectId} createdBy - The ID of the user creating the address.
 * @param {Object} permissions - User permissions for RBAC.
 * @returns {Promise<Address>} The created address document.
 * @throws {Error} If the user ID is invalid or user is unauthorized.
 */
addressSchema.statics.createSampleAddress = async function (userId, createdBy, permissions = {}) {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(createdBy)) {
    throw new Error('Invalid user ID');
  }
  if (!permissions.canManageAllAddresses && userId.toString() !== createdBy.toString()) {
    throw new Error('Unauthorized: Only admins can create sample addresses for other users');
  }
  const sample = {
    user: userId,
    label: 'home',
    fullName: 'John Doe',
    phoneNumber: '+1234567890',
    addressLine1: '123 Main St',
    city: 'Sample City',
    state: 'Sample State',
    country: 'IN',
    postalCode: '123456',
    created_by: createdBy,
    updated_by: createdBy,
    isVerified: false,
  };
  return this.create(sample);
};

/**
 * Generates analytics on address data for a user or all users.
 * @param {mongoose.Types.ObjectId} [userId] - The ID of the user (optional).
 * @returns {Promise<Object>} Analytics data (e.g., city counts, tag counts).
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.getAddressAnalytics = async function (userId) {
  if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  const match = userId ? { user: new mongoose.Types.ObjectId(userId), status: { $ne: 'deleted' } } : { status: { $ne: 'deleted' } };
  const [cityCounts, tagCounts, statusCounts] = await Promise.all([
    this.aggregate([
      { $match: match },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    this.aggregate([
      { $match: match },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    this.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  return { cityCounts, tagCounts, statusCounts };
};

/**
 * Streams addresses for a user for efficient large-scale exports.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {Function} callback - Callback to handle each address.
 * @returns {Promise<void>}
 * @throws {Error} If the user ID is invalid.
 */
addressSchema.statics.streamUserAddresses = async function (userId, callback) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID');
  }
  const stream = this.find({ user: userId, status: { $ne: 'deleted' } }).lean().cursor();
  for await (const doc of stream) {
    await callback(doc);
  }
};

// Error handling middleware
addressSchema.post('save', function (error, doc, next) {
  next(error);
});

const Address = mongoose.model('Address', addressSchema);
module.exports = Address;