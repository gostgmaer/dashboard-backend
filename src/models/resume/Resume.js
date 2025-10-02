
const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  title: {
    type: String,
    required: [true, 'Resume title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    default: null
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  sections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  }],
  draft: {
    type: Boolean,
    default: true
  },
  shareableLink: {
    type: String,
    unique: true,
    sparse: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  metadata: {
    totalSections: {
      type: Number,
      default: 0
    },
    lastModified: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
resumeSchema.index({ user: 1, isDefault: 1 });
resumeSchema.index({ user: 1, createdAt: -1 });
resumeSchema.index({ shareableLink: 1 });

// Ensure only one default resume per user
resumeSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }

  // Update metadata
  this.metadata.lastModified = new Date();

  next();
});

// Update section count after sections are modified
resumeSchema.methods.updateSectionCount = async function() {
  const sectionCount = await mongoose.model('Section').countDocuments({ resume: this._id });
  this.metadata.totalSections = sectionCount;
  await this.save();
};

// Virtual for formatted creation date
resumeSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString();
});

// Static method to find user's resumes
resumeSchema.statics.findByUser = function(userId, includePopulated = false) {
  const query = this.find({ user: userId }).sort({ isDefault: -1, updatedAt: -1 });
  if (includePopulated) {
    return query.populate('template sections');
  }
  return query;
};

module.exports = mongoose.model('Resume', resumeSchema);
