// models/Resume.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Resume section schemas
const PersonalInfoSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    dateOfBirth: Date,
    website: String,
    linkedin: String,
    github: String,
    portfolio: String,
  },
  { _id: false }
);

const ExperienceSchema = new Schema(
  {
    company: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true },
    location: String,
    startDate: { type: Date, required: true },
    endDate: Date,
    isCurrent: { type: Boolean, default: false },
    description: String,
    achievements: [String],
    technologies: [String],
  },
  { timestamps: true }
);

const EducationSchema = new Schema(
  {
    institution: { type: String, required: true, trim: true },
    degree: { type: String, required: true, trim: true },
    fieldOfStudy: String,
    location: String,
    startDate: { type: Date, required: true },
    endDate: Date,
    gpa: String,
    honors: [String],
    coursework: [String],
  },
  { timestamps: true }
);

const ProjectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    technologies: [String],
    startDate: Date,
    endDate: Date,
    url: String,
    githubUrl: String,
    highlights: [String],
    role: String,
  },
  { timestamps: true }
);

const SkillSchema = new Schema(
  {
    category: { type: String, required: true, trim: true }, // e.g., "Programming Languages", "Frameworks"
    skills: [
      {
        name: { type: String, required: true, trim: true },
        level: {
          type: String,
          enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
          default: 'Intermediate',
        },
        yearsOfExperience: Number,
      },
    ],
  },
  { _id: false }
);

const CertificationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    issuer: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    expiryDate: Date,
    credentialId: String,
    credentialUrl: String,
  },
  { timestamps: true }
);

const AwardSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    issuer: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    description: String,
  },
  { timestamps: true }
);

const VolunteerSchema = new Schema(
  {
    organization: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: Date,
    isCurrent: { type: Boolean, default: false },
    description: String,
    achievements: [String],
  },
  { timestamps: true }
);

const LanguageSchema = new Schema(
  {
    language: { type: String, required: true, trim: true },
    proficiency: {
      type: String,
      enum: ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'],
      required: true,
    },
  },
  { _id: false }
);

const ResumeVersionSchema = new Schema(
  {
    versionNumber: { type: Number, required: true },
    personalInfo: PersonalInfoSchema,
    summary: String,
    experience: [ExperienceSchema],
    education: [EducationSchema],
    projects: [ProjectSchema],
    skills: [SkillSchema],
    certifications: [CertificationSchema],
    awards: [AwardSchema],
    volunteer: [VolunteerSchema],
    languages: [LanguageSchema],
    customSections: [
      {
        title: { type: String, required: true },
        content: { type: Schema.Types.Mixed, required: true },
      },
    ],
    // createdAt: { type: Date, default: Date.now },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    changeDescription: String,
  },
  { _id: false }
);

// Main Resume Schema
const ResumeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },

    // Current version data
    personalInfo: PersonalInfoSchema,
    summary: String,
    experience: [ExperienceSchema],
    education: [EducationSchema],
    projects: [ProjectSchema],
    skills: [SkillSchema],
    certifications: [CertificationSchema],
    awards: [AwardSchema],
    volunteer: [VolunteerSchema],
    languages: [LanguageSchema],
    customSections: [
      {
        title: { type: String, required: true },
        content: { type: Schema.Types.Mixed, required: true },
      },
    ],

    // Resume metadata
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', default: null },

    // Versioning
    currentVersion: { type: Number, default: 1 },
    versions: [ResumeVersionSchema],

    // Sharing settings
    visibility: {
      type: String,
      enum: ['private', 'public', 'link-only'],
      default: 'private',
      index: true,
    },
    shareToken: { type: String, unique: true, sparse: true },
    shareSettings: {
      allowDownload: { type: Boolean, default: false },
      showContactInfo: { type: Boolean, default: true },
      expiresAt: Date,
    },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },

    // SEO and metadata
    slug: { type: String, unique: true, sparse: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    category: { type: String, trim: true },

    // Analytics
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    lastViewedAt: Date,

    // Status
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
      index: true,
    },

    // Import metadata
    importSource: {
      type: { type: String, enum: ['json', 'linkedin', 'manual'] },
      originalData: Schema.Types.Mixed,
      importedAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
ResumeSchema.index({ userId: 1, status: 1 });
ResumeSchema.index({ userId: 1, createdAt: -1 });
// ResumeSchema.index({ shareToken: 1 }, { sparse: true });
ResumeSchema.index({ visibility: 1, status: 1 });
ResumeSchema.index({ tags: 1 });
ResumeSchema.index({ 'personalInfo.firstName': 'text', 'personalInfo.lastName': 'text', title: 'text' });

// Virtual for full name
ResumeSchema.virtual('fullName').get(function () {
  if (this.personalInfo && this.personalInfo.firstName && this.personalInfo.lastName) {
    return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
  }
  return null;
});

// Methods
ResumeSchema.methods.createVersion = function (changeDescription = '') {
  const currentData = {
    versionNumber: this.currentVersion,
    personalInfo: this.personalInfo,
    summary: this.summary,
    experience: this.experience,
    education: this.education,
    projects: this.projects,
    skills: this.skills,
    certifications: this.certifications,
    awards: this.awards,
    volunteer: this.volunteer,
    languages: this.languages,
    customSections: this.customSections,
    createdAt: new Date(),
    createdBy: this.userId,
    changeDescription,
  };

  this.versions.push(currentData);
  this.currentVersion += 1;

  // Keep only last 50 versions to prevent document bloat
  if (this.versions.length > 50) {
    this.versions = this.versions.slice(-50);
  }

  return this.save();
};

ResumeSchema.methods.rollbackToVersion = function (versionNumber) {
  const version = this.versions.find((v) => v.versionNumber === versionNumber);
  if (!version) {
    throw new Error('Version not found');
  }

  // Save current state as new version before rollback
  this.createVersion(`Rollback to version ${versionNumber}`);

  // Restore data from version
  this.personalInfo = version.personalInfo;
  this.summary = version.summary;
  this.experience = version.experience;
  this.education = version.education;
  this.projects = version.projects;
  this.skills = version.skills;
  this.certifications = version.certifications;
  this.awards = version.awards;
  this.volunteer = version.volunteer;
  this.languages = version.languages;
  this.customSections = version.customSections;

  return this.save();
};

ResumeSchema.methods.generateShareToken = function () {
  const crypto = require('crypto');
  this.shareToken = crypto.randomBytes(32).toString('hex');
  return this.save();
};

ResumeSchema.methods.generateSlug = function () {
  if (!this.personalInfo || !this.personalInfo.firstName || !this.personalInfo.lastName) {
    return null;
  }

  const baseSlug = `${this.personalInfo.firstName}-${this.personalInfo.lastName}-${this.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  this.slug = `${baseSlug}-${this._id.toString().slice(-6)}`;
  return this.slug;
};

// Statics
ResumeSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId };

  if (options.status) {
    query.status = options.status;
  }

  if (options.visibility) {
    query.visibility = options.visibility;
  }

  return this.find(query)
    .populate('templateId', 'name previewUrl')
    .sort(options.sort || { updatedAt: -1 })
    .limit(options.limit || 50);
};

ResumeSchema.statics.searchResumes = function (userId, searchQuery, options = {}) {
  const pipeline = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: options.status || { $ne: 'archived' },
      },
    },
  ];

  if (searchQuery) {
    pipeline.push({
      $match: {
        $or: [{ title: { $regex: searchQuery, $options: 'i' } }, { 'personalInfo.firstName': { $regex: searchQuery, $options: 'i' } }, { 'personalInfo.lastName': { $regex: searchQuery, $options: 'i' } }, { tags: { $in: [new RegExp(searchQuery, 'i')] } }, { summary: { $regex: searchQuery, $options: 'i' } }],
      },
    });
  }

  if (options.tags && options.tags.length > 0) {
    pipeline.push({
      $match: {
        tags: { $in: options.tags },
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'templates',
        localField: 'templateId',
        foreignField: '_id',
        as: 'template',
      },
    },
    {
      $sort: options.sort || { updatedAt: -1 },
    },
    {
      $skip: options.skip || 0,
    },
    {
      $limit: options.limit || 20,
    }
  );

  return this.aggregate(pipeline);
};

// Pre-save middleware
ResumeSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('personalInfo') || this.isModified('title')) {
    if (!this.slug) {
      this.generateSlug();
    }
  }

  if (this.visibility === 'link-only' && !this.shareToken) {
    this.generateShareToken();
  }

  next();
});

module.exports = mongoose.model('Resume', ResumeSchema);
