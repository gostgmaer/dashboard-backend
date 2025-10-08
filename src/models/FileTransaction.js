const mongoose = require('mongoose');

const fileTransactionSchema = new mongoose.Schema({
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
  },
  operation: {
    type: String,
    enum: ['upload', 'update_metadata', 'replace', 'delete', 'permanent_delete'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestId: {
    type: String,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed
  },
  providerResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
fileTransactionSchema.index({ fileId: 1, createdAt: -1 });
fileTransactionSchema.index({ performedBy: 1, createdAt: -1 });
fileTransactionSchema.index({ status: 1 });
fileTransactionSchema.index({ operation: 1 });

module.exports = mongoose.model('FileTransaction', fileTransactionSchema);