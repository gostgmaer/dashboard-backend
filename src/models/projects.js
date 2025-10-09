const mongoose = require('mongoose');
const { Schema } = mongoose;

const projectSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    url: { type: String },
    technologies: [{ type: String }],
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    resume: { type: Schema.Types.ObjectId, ref: 'Resume' },

    image: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
      url: { type: String, default: null },
      name: { type: String, }, // Original or current filename
      size: { type: Number }, // File size in bytes
      type: { type: String }, // MIME type (image/jpeg, application/pdf, etc.)
    },

    client: { type: String, trim: true },
    role: { type: String, trim: true },
    responsibilities: { type: String },

    status: {
      type: String,
      enum: ['planned', 'ongoing', 'completed', 'canceled'],
      default: 'completed',
    },
    isPublic: { type: Boolean, default: true },
    tags: [{ type: String }],
    repositoryUrl: { type: String },

    rating: { type: Number, min: 0, max: 5 },
    commentsCount: { type: Number, default: 0 },

    budget: { type: Number },
    clientContact: { type: String, trim: true },
    teamSize: { type: Number, default: 1 },
    deliverables: [{ type: String }],
    documentationUrl: { type: String },
    demoUrl: { type: String },
    metadata: { type: Map, of: Schema.Types.Mixed },

    awards: [{ type: String }],
    links: [
      {
        title: String,
        url: String,
      },
    ],
    privacyLevel: {
      type: String,
      enum: ['public', 'private', 'restricted'],
      default: 'public',
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtuals

// Duration in days of the project based on start and end dates
projectSchema.virtual('durationDays').get(function () {
  if (this.startDate && this.endDate) {
    const diffMs = this.endDate - this.startDate;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
  return null;
});

projectSchema.virtual('isActive').get(function () {
  if (this.status === 'ongoing') {
    if (!this.endDate) return true;
    return this.endDate > new Date();
  }
  return false;
});

// Returns a formatted duration string like '3 months 10 days'
projectSchema.virtual('durationFormatted').get(function () {
  if (this.startDate && this.endDate) {
    let diffMs = this.endDate - this.startDate;
    if (diffMs < 0) return null;
    const dayMs = 1000 * 60 * 60 * 24;
    const daysTotal = Math.floor(diffMs / dayMs);
    const months = Math.floor(daysTotal / 30);
    const days = daysTotal % 30;
    let result = months > 0 ? months + ' month' + (months > 1 ? 's ' : ' ') : '';
    result += days > 0 ? days + ' day' + (days > 1 ? 's' : '') : '';
    return result.trim();
  }
  return null;
});

// Returns concatenated string of all technology tags
projectSchema.virtual('technologyTags').get(function () {
  if (this.technologies && this.technologies.length > 0) {
    return this.technologies.join(', ');
  }
  return '';
});

// Returns URL of image or a placeholder if not set
projectSchema.virtual('imageUrlOrPlaceholder').get(function () {
  if (this.image && this.image.url) {
    return this.image.url;
  }
  return 'https://example.com/default-project-image.png';
});

// Returns total number of links present
projectSchema.virtual('linksCount').get(function () {
  return this.links ? this.links.length : 0;
});

// Checks if the project is overdue (endDate past & not completed or canceled)
projectSchema.virtual('isOverdue').get(function () {
  if (this.endDate && ['planned', 'ongoing'].includes(this.status)) {
    return this.endDate < new Date();
  }
  return false;
});
// Instance Methods

// Add new link to project
projectSchema.methods.addLink = async function (title, url) {
  this.links = this.links || [];
  this.links.push({ title, url });
  return this.save();
};

// Remove link by title
projectSchema.methods.removeLinkByTitle = async function (title) {
  if (!this.links) return this;
  this.links = this.links.filter((link) => link.title !== title);
  return this.save();
};

// Increment budget by a specified amount
projectSchema.methods.incrementBudget = async function (amount) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }
  this.budget = (this.budget || 0) + amount;
  return this.save();
};

projectSchema.methods.updateRating = async function (newRating) {
  if (newRating < 0 || newRating > 5) {
    throw new Error('Rating must be between 0 and 5');
  }
  this.rating = newRating;
  return this.save();
};

projectSchema.methods.incrementCommentsCount = async function () {
  this.commentsCount += 1;
  return this.save();
};

projectSchema.methods.addTag = function (tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
  return this.save();
};

projectSchema.methods.removeTag = function (tag) {
  this.tags = this.tags.filter((t) => t !== tag);
  return this.save();
};

projectSchema.methods.setPrivacyLevel = async function (level) {
  const validLevels = ['public', 'private', 'restricted'];
  if (!validLevels.includes(level)) {
    throw new Error('Invalid privacy level');
  }
  this.privacyLevel = level;
  return this.save();
};

// Add a deliverable if not present
projectSchema.methods.addDeliverable = async function (deliverable) {
  if (!this.deliverables.includes(deliverable)) {
    this.deliverables.push(deliverable);
    return this.save();
  }
  return this;
};

// Remove a deliverable if present
projectSchema.methods.removeDeliverable = async function (deliverable) {
  this.deliverables = this.deliverables.filter((d) => d !== deliverable);
  return this.save();
};

// Update project metadata key-value
projectSchema.methods.updateMetadata = async function (key, value) {
  if (!this.metadata) {
    this.metadata = new Map();
  }
  this.metadata.set(key, value);
  this.markModified('metadata');
  return this.save();
};

// Clear all metadata
projectSchema.methods.clearMetadata = async function () {
  this.metadata = new Map();
  this.markModified('metadata');
  return this.save();
};

// Static Methods

// Find projects with rating above a threshold
projectSchema.statics.findTopRated = function (minRating = 4, limit = 10) {
  return this.find({ rating: { $gte: minRating } })
    .sort({ rating: -1, createdAt: -1 })
    .limit(limit)
    .lean()
    .exec();
};

// Aggregate average rating grouped by status (planned, ongoing, etc.)
projectSchema.statics.avgRatingGroupByStatus = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
    { $sort: { avgRating: -1 } },
  ]).exec();
};

// Count projects by privacy level for a user
projectSchema.statics.countByPrivacyLevel = function (userId) {
  return this.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: '$privacyLevel',
        count: { $sum: 1 },
      },
    },
  ]).exec();
};

// Fetch public projects with keyword search for demo or listing
projectSchema.statics.findPublicByKeyword = function (keyword, limit = 10) {
  const regex = new RegExp(keyword, 'i');
  return this.find({
    isPublic: true,
    $or: [{ title: regex }, { description: regex }, { tags: regex }],
  })
    .limit(limit)
    .lean()
    .exec();
};

/**
 * Fetch a project by ID with all relevant refs populated
 * @param {ObjectId} id - Project _id
 * @param {Object} options - { populateUser: Boolean, populateResume: Boolean }
 */
projectSchema.statics.getByIdWithDetails = async function (id, options = {}) {
  const query = this.findById(id);
  if (options.populateUser) {
    query.populate('user');
  }
  if (options.populateResume) {
    query.populate('resume');
  }
  return query.lean().exec();
};

// Find projects with a minimum team size
projectSchema.statics.findByMinTeamSize = function (minSize = 2) {
  return this.find({ teamSize: { $gte: minSize } })
    .sort({ teamSize: -1 })
    .lean()
    .exec();
};

// List projects grouped by client with counts
projectSchema.statics.groupByClient = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$client',
        count: { $sum: 1 },
        projects: { $push: '$$ROOT' },
      },
    },
    { $sort: { count: -1 } },
  ]).exec();
};

// Fetch projects updated within last X days
projectSchema.statics.findRecentlyUpdated = function (days = 7) {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  return this.find({ updatedAt: { $gte: sinceDate } })
    .sort({ updatedAt: -1 })
    .lean()
    .exec();
};
/**
 * Search and paginate projects with filters, sorting, and text search
 * Supports filtering by technologies, status, privacyLevel, user, date range, etc.
 * @param {Object} filter - filter object, allows nested fields
 * @param {Object} options - pagination, sort, fullText search, etc.
 */
projectSchema.statics.searchPaginated = async function (filter = {}, options = {}) {
  const { page = 1, limit = 20, sort = { createdAt: -1 }, fullText = '', dateRange = {}, technologies, privacyLevel, userId } = options;

  const skip = (page - 1) * limit;

  const baseFilter = { ...filter };
  if ('isDeleted' in baseFilter === false) {
    // If soft delete support, you can implement isDeleted logic here.
  }

  if (fullText) {
    const regex = new RegExp(fullText, 'i');
    baseFilter.$or = [{ title: regex }, { description: regex }, { client: regex }, { role: regex }, { responsibilities: regex }, { tags: regex }];
  }

  if (dateRange.startDate) {
    baseFilter.startDate = baseFilter.startDate || {};
    if (dateRange.startDate.$gte != null) baseFilter.startDate.$gte = dateRange.startDate.$gte;
    if (dateRange.startDate.$lte != null) baseFilter.startDate.$lte = dateRange.startDate.$lte;
  }

  if (technologies && Array.isArray(technologies) && technologies.length > 0) {
    baseFilter.technologies = { $in: technologies };
  }

  if (privacyLevel) {
    baseFilter.privacyLevel = privacyLevel;
  }

  if (userId) {
    baseFilter.user = userId;
  }

  // Get total count for pagination
  const totalCount = await this.countDocuments(baseFilter);

  const projects = await this.find(baseFilter).sort(sort).skip(skip).limit(limit).lean().exec();

  return {
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
    limit,
    projects,
  };
};

// Pre-save hook

projectSchema.pre('save', async function (next) {
  // Ensure status is valid enum, default completed
  const validStatuses = ['planned', 'ongoing', 'completed', 'canceled'];
  if (!validStatuses.includes(this.status)) {
    this.status = 'completed';
  }

  // Ensure privacyLevel is valid enum, default public
  const validPrivacy = ['public', 'private', 'restricted'];
  if (!validPrivacy.includes(this.privacyLevel)) {
    this.privacyLevel = 'public';
  }

  // Ensure teamSize is at least 1
  if (!this.teamSize || this.teamSize < 1) {
    this.teamSize = 1;
  }

  // Auto-set endDate if project is completed but endDate missing
  if (this.status === 'completed' && !this.endDate) {
    this.endDate = new Date();
  }

  // Auto-clear endDate if project restarted (planned or ongoing)
  if (['planned', 'ongoing'].includes(this.status)) {
    this.endDate = undefined;
  }

  // Normalize tags - all lowercase and trimmed
  if (this.tags && this.tags.length) {
    this.tags = this.tags.map((tag) => tag.trim().toLowerCase());
  }

  // Validate rating bounds
  if (this.rating < 0) this.rating = 0;
  if (this.rating > 5) this.rating = 5;

  // If clientContact provided, trim it
  if (this.clientContact) {
    this.clientContact = this.clientContact.trim();
  }

  next();
});

// Export model
const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
