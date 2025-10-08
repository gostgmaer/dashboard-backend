const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
  versionId: {
    type: String,
    required: true
  },
  storageKey: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const fileSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  storageKey: {
    type: String,
    required: true,
    unique: true
  },
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  extension: {
    type: String,
    required: true
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  publicUrl: {
    type: String
  },
  metadata: {
    description: {
      type: String,
      trim: true
    },
    tags: [{
      type: String,
      trim: true
    }],
    custom: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  versions: [versionSchema],
  status: {
    type: String,
    enum: ['active', 'deleted', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
fileSchema.index({ uploader: 1, createdAt: -1 });
fileSchema.index({ mimeType: 1 });
fileSchema.index({ status: 1 });
fileSchema.index({ 'metadata.tags': 1 });

// Virtual for current version
fileSchema.virtual('currentVersion').get(function() {
  if (this.versions.length === 0) {
    return {
      versionId: '1',
      storageKey: this.storageKey,
      size: this.size,
      mimeType: this.mimeType,
      createdAt: this.createdAt
    };
  }
  return this.versions[this.versions.length - 1];
});

module.exports = mongoose.model('File', fileSchema);