
// models/Template.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TemplateFieldSchema = new Schema({
  fieldName: { type: String, required: true },
  fieldType: { 
    type: String, 
    enum: ['text', 'textarea', 'date', 'array', 'object', 'boolean', 'number'],
    required: true 
  },
  required: { type: Boolean, default: false },
  placeholder: String,
  validation: {
    minLength: Number,
    maxLength: Number,
    pattern: String,
    min: Number,
    max: Number
  },
  displayName: String,
  description: String,
  defaultValue: Schema.Types.Mixed
}, { _id: false });

const TemplateStyleSchema = new Schema({
  // Layout settings
  layout: {
    type: { type: String, enum: ['single-column', 'two-column', 'three-column'], default: 'single-column' },
    pageSize: { type: String, enum: ['A4', 'Letter', 'Legal'], default: 'A4' },
    margins: {
      top: { type: Number, default: 20 },
      right: { type: Number, default: 20 },
      bottom: { type: Number, default: 20 },
      left: { type: Number, default: 20 }
    },
    orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' }
  },

  // Typography
  fonts: {
    primary: { type: String, default: 'Arial' },
    secondary: { type: String, default: 'Georgia' },
    heading: { type: String, default: 'Arial' }
  },

  fontSizes: {
    heading1: { type: Number, default: 24 },
    heading2: { type: Number, default: 18 },
    heading3: { type: Number, default: 16 },
    body: { type: Number, default: 12 },
    small: { type: Number, default: 10 }
  },

  // Colors
  colors: {
    primary: { type: String, default: '#000000' },
    secondary: { type: String, default: '#666666' },
    accent: { type: String, default: '#0066cc' },
    background: { type: String, default: '#ffffff' },
    text: { type: String, default: '#000000' }
  },

  // Spacing
  spacing: {
    sectionGap: { type: Number, default: 16 },
    itemGap: { type: Number, default: 8 },
    lineHeight: { type: Number, default: 1.4 }
  },

  // Custom CSS
  customCSS: String
}, { _id: false });

const TemplateSectionSchema = new Schema({
  name: { type: String, required: true }, // e.g., 'personalInfo', 'experience'
  displayName: { type: String, required: true }, // e.g., 'Personal Information', 'Work Experience'
  order: { type: Number, required: true },
  required: { type: Boolean, default: false },
  visible: { type: Boolean, default: true },
  fields: [TemplateFieldSchema],

  // Section-specific styling
  style: {
    showBorder: { type: Boolean, default: false },
    backgroundColor: String,
    padding: {
      top: Number,
      right: Number,
      bottom: Number,
      left: Number
    },
    customCSS: String
  }
}, { _id: false });

const TemplateSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: String,
  category: { 
    type: String, 
    enum: ['professional', 'creative', 'modern', 'classic', 'minimal', 'academic', 'technical'],
    default: 'professional'
  },

  // Template metadata
  version: { type: String, default: '1.0.0' },
  author: {
    name: String,
    email: String,
    website: String
  },

  // Template files and assets
  files: {
    htmlTemplate: { type: String, required: true }, // Path to HTML template file
    cssStyles: String, // Path to CSS file or inline CSS
    jsScripts: String, // Path to JS file or inline JS
    previewImage: String, // Path to preview image
    thumbnailImage: String // Path to thumbnail image
  },

  // Template configuration
  sections: [TemplateSectionSchema],
  style: TemplateStyleSchema,

  // Export formats supported by this template
  supportedFormats: [{
    format: { 
      type: String, 
      enum: ['pdf', 'docx', 'html', 'txt', 'json'],
      required: true 
    },
    enabled: { type: Boolean, default: true },
    settings: Schema.Types.Mixed // Format-specific settings
  }],

  // Template status and access
  status: { 
    type: String, 
    enum: ['draft', 'active', 'deprecated', 'archived'],
    default: 'draft'
  },

  isPublic: { type: Boolean, default: true },
  isPremium: { type: Boolean, default: false },

  // Usage statistics
  usageCount: { type: Number, default: 0 },
  downloadCount: { type: Number, default: 0 },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },

  // SEO and discovery
  tags: [{ type: String, trim: true, lowercase: true }],
  keywords: [String],

  // Template validation rules
  validationRules: [{
    field: String,
    rule: String,
    message: String,
    params: Schema.Types.Mixed
  }],

  // Admin fields
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,

  // Pricing (if premium)
  pricing: {
    price: Number,
    currency: { type: String, default: 'USD' },
    billingType: { type: String, enum: ['one-time', 'subscription'] }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
TemplateSchema.index({ status: 1, isPublic: 1 });
TemplateSchema.index({ category: 1, status: 1 });
TemplateSchema.index({ tags: 1 });
TemplateSchema.index({ usageCount: -1 });
TemplateSchema.index({ 'rating.average': -1 });
TemplateSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Virtuals
TemplateSchema.virtual('previewUrl').get(function() {
  return this.files.previewImage ? `/templates/${this._id}/preview` : null;
});

TemplateSchema.virtual('thumbnailUrl').get(function() {
  return this.files.thumbnailImage ? `/templates/${this._id}/thumbnail` : null;
});

// Methods
TemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

TemplateSchema.methods.updateRating = function(newRating) {
  const totalRating = this.rating.average * this.rating.count + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  return this.save();
};

TemplateSchema.methods.validateResumeData = function(resumeData) {
  const errors = [];

  // Validate required sections
  for (const section of this.sections) {
    if (section.required && (!resumeData[section.name] || 
        (Array.isArray(resumeData[section.name]) && resumeData[section.name].length === 0))) {
      errors.push(`${section.displayName} is required`);
    }

    // Validate fields within sections
    if (resumeData[section.name] && section.fields) {
      for (const field of section.fields) {
        if (field.required) {
          const fieldValue = resumeData[section.name][field.fieldName];
          if (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim())) {
            errors.push(`${field.displayName || field.fieldName} in ${section.displayName} is required`);
          }
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Statics
TemplateSchema.statics.findPublicTemplates = function(options = {}) {
  const query = { 
    status: 'active', 
    isPublic: true 
  };

  if (options.category) {
    query.category = options.category;
  }

  if (options.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }

  if (options.isPremium !== undefined) {
    query.isPremium = options.isPremium;
  }

  let sortOption = { usageCount: -1 };
  if (options.sortBy === 'rating') {
    sortOption = { 'rating.average': -1, 'rating.count': -1 };
  } else if (options.sortBy === 'newest') {
    sortOption = { createdAt: -1 };
  } else if (options.sortBy === 'name') {
    sortOption = { name: 1 };
  }

  return this.find(query)
    .sort(sortOption)
    .limit(options.limit || 50)
    .select('-files.htmlTemplate -files.cssStyles -files.jsScripts'); // Don't return template content in list
};

TemplateSchema.statics.searchTemplates = function(searchQuery, options = {}) {
  const pipeline = [
    {
      $match: {
        status: 'active',
        isPublic: true,
        ...(options.category && { category: options.category }),
        ...(options.isPremium !== undefined && { isPremium: options.isPremium })
      }
    }
  ];

  if (searchQuery) {
    pipeline.push({
      $match: {
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } },
          { tags: { $in: [new RegExp(searchQuery, 'i')] } },
          { keywords: { $in: [new RegExp(searchQuery, 'i')] } }
        ]
      }
    });
  }

  if (options.tags && options.tags.length > 0) {
    pipeline.push({
      $match: {
        tags: { $in: options.tags }
      }
    });
  }

  pipeline.push(
    {
      $addFields: {
        score: {
          $add: [
            { $multiply: ['$rating.average', 2] },
            { $divide: ['$usageCount', 100] },
            { $cond: [{ $eq: ['$isPremium', false] }, 1, 0] }
          ]
        }
      }
    },
    {
      $sort: options.sortBy === 'rating' ? { 'rating.average': -1 } :
             options.sortBy === 'newest' ? { createdAt: -1 } :
             options.sortBy === 'name' ? { name: 1 } : { score: -1 }
    },
    {
      $project: {
        'files.htmlTemplate': 0,
        'files.cssStyles': 0,
        'files.jsScripts': 0,
        score: 0
      }
    },
    {
      $skip: options.skip || 0
    },
    {
      $limit: options.limit || 20
    }
  );

  return this.aggregate(pipeline);
};

// Pre-save middleware
TemplateSchema.pre('save', function(next) {
  // Ensure sections are ordered
  if (this.sections && this.sections.length > 0) {
    this.sections.sort((a, b) => a.order - b.order);
  }

  // Set default supported formats if not specified
  if (!this.supportedFormats || this.supportedFormats.length === 0) {
    this.supportedFormats = [
      { format: 'pdf', enabled: true },
      { format: 'html', enabled: true },
      { format: 'json', enabled: true }
    ];
  }

  next();
});

module.exports = mongoose.model('Template', TemplateSchema);
