
const mongoose = require('mongoose');

// Define the allowed section types
const SECTION_TYPES = [
  'personal', 'education', 'experience', 'projects', 'skills', 
  'certifications', 'languages', 'hobbies', 'references', 
  'summary', 'awards', 'volunteer', 'custom'
];

const sectionSchema = new mongoose.Schema({
  resume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    required: [true, 'Resume reference is required'],
    index: true
  },
  type: {
    type: String,
    enum: {
      values: SECTION_TYPES,
      message: 'Invalid section type. Must be one of: ' + SECTION_TYPES.join(', ')
    },
    required: [true, 'Section type is required']
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Section data is required'],
    validate: {
      validator: function(data) {
        // Basic validation - ensure data is an object
        return typeof data === 'object' && data !== null;
      },
      message: 'Section data must be a valid object'
    }
  },
  order: {
    type: Number,
    default: 0,
    min: [0, 'Order cannot be negative']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  isVisible: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
sectionSchema.index({ resume: 1, order: 1 });
sectionSchema.index({ resume: 1, type: 1 });

// Auto-increment order for new sections
sectionSchema.pre('save', async function(next) {
  if (this.isNew && this.order === 0) {
    const maxOrder = await this.constructor.findOne({ resume: this.resume })
      .sort({ order: -1 })
      .select('order')
      .exec();

    this.order = maxOrder ? maxOrder.order + 1 : 1;
  }
  next();
});

// Post-save hook to update resume's section count
sectionSchema.post('save', async function() {
  const Resume = mongoose.model('Resume');
  const resume = await Resume.findById(this.resume);
  if (resume) {
    await resume.updateSectionCount();
  }
});

// Post-remove hook to update resume's section count
sectionSchema.post('findOneAndDelete', async function() {
  if (this.resume) {
    const Resume = mongoose.model('Resume');
    const resume = await Resume.findById(this.resume);
    if (resume) {
      await resume.updateSectionCount();
    }
  }
});

// Virtual for section type display name
sectionSchema.virtual('displayName').get(function() {
  return this.title || this.type.charAt(0).toUpperCase() + this.type.slice(1);
});

// Static method to reorder sections
sectionSchema.statics.reorderSections = async function(resumeId, sectionOrders) {
  const bulkOps = sectionOrders.map((item, index) => ({
    updateOne: {
      filter: { _id: item.sectionId, resume: resumeId },
      update: { order: index + 1 }
    }
  }));

  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
  }
};

// Static method to find sections by resume with proper ordering
sectionSchema.statics.findByResume = function(resumeId, onlyVisible = false) {
  const query = { resume: resumeId };
  if (onlyVisible) {
    query.isVisible = true;
  }
  return this.find(query).sort({ order: 1 });
};

module.exports = mongoose.model('Section', sectionSchema);
