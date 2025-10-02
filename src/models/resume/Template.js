
const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: [true, 'Template slug is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  thumbnail: {
    type: String,
    required: [true, 'Template thumbnail is required'],
    validate: {
      validator: function(url) {
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url);
      },
      message: 'Thumbnail must be a valid image URL'
    }
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    enum: ['modern', 'classic', 'creative', 'professional', 'minimal', 'academic'],
    default: 'professional'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  features: [{
    type: String,
    trim: true
  }],
  supportedSections: [{
    type: String,
    enum: [
      'personal', 'education', 'experience', 'projects', 'skills',
      'certifications', 'languages', 'hobbies', 'references',
      'summary', 'awards', 'volunteer', 'custom'
    ]
  }],
  metadata: {
    createdBy: {
      type: String,
      default: 'system'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
templateSchema.index({ slug: 1 });
templateSchema.index({ category: 1, isActive: 1 });
templateSchema.index({ isPremium: 1, isActive: 1 });
templateSchema.index({ 'rating.average': -1 });

// Pre-save middleware to generate slug if not provided
templateSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  this.metadata.lastUpdated = new Date();
  next();
});

// Method to increment usage count
templateSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  await this.save();
};

// Method to update rating
templateSchema.methods.updateRating = async function(newRating) {
  const totalScore = this.rating.average * this.rating.count + newRating;
  this.rating.count += 1;
  this.rating.average = totalScore / this.rating.count;
  await this.save();
};

// Static method to find active templates
templateSchema.statics.findActive = function(category = null, premiumOnly = false) {
  const query = { isActive: true };
  if (category) query.category = category;
  if (premiumOnly) query.isPremium = true;

  return this.find(query)
    .sort({ 'rating.average': -1, usageCount: -1 })
    .select('-metadata -supportedSections');
};

// Virtual for popularity score
templateSchema.virtual('popularityScore').get(function() {
  return (this.rating.average * 0.7) + (Math.log(this.usageCount + 1) * 0.3);
});

module.exports = mongoose.model('Template', templateSchema);
