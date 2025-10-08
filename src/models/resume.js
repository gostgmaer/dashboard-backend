const mongoose = require('mongoose');
const js2xmlparser = require('js2xmlparser');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const PDFDocument = require('pdfkit');
const streamBuffers = require('stream-buffers');
const { Schema } = mongoose;

// Reference existing User, Address, Contact models
// Assume User, Address models exist and imported elsewhere for population
// Project Schema (Separate Model)
// Main Resume Schema
const resumeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' }, // 1:1 with user
    contact: { type: Schema.Types.ObjectId, ref: 'Contact' }, // integration with Contact API/model
    personalInfo: {
      fullName: { type: String, trim: true },
      dateOfBirth: Date,
      placeOfBirth: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      address: { type: Schema.Types.ObjectId, ref: 'Address' },

      linkedIn: { type: String, trim: true },
      twitter: { type: String, trim: true },
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      github: { type: String, trim: true },
      website: { type: String, trim: true },

      nationality: { type: String, trim: true },
      maritalStatus: { type: String, trim: true },
      gender: { type: String, enum: ['male', 'female', 'other'], trim: true },

      languagesSpoken: [{ type: String, trim: true }],
      militaryService: { type: String, trim: true },
      religion: { type: String, trim: true },
      disabilityStatus: { type: String, trim: true },
      visaStatus: { type: String, trim: true },
      driverLicense: { type: String, trim: true },

      emergencyContactName: { type: String, trim: true },
      emergencyContactPhone: { type: String, trim: true },
      emergencyContactRelation: { type: String, trim: true },

      referral: {
        name: { type: String, trim: true },
        relationship: { type: String, trim: true },
        contactInfo: { type: String, trim: true },
        referredDate: Date,
      },
    },

    // Optional: array of friends/references related to resume (with consent)
    references: [
      {
        name: { type: String, required: true, trim: true },
        relation: { type: String, trim: true },
        phone: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        address: { type: Schema.Types.ObjectId, ref: 'Address' },
        notes: { type: String, trim: true },
      },
    ],

    personalInfoCustom: [
      {
        label: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true },
      },
    ],

    education: [
      {
        institution: { type: String, required: true, trim: true },
        degree: { type: String, required: true, trim: true },
        fieldOfStudy: { type: String, trim: true },
        startDate: Date,
        endDate: Date,
        grade: { type: String, trim: true },
        description: { type: String, trim: true },
        address: { type: Schema.Types.ObjectId, ref: 'Address' }, // Reference to Address model
      },
    ],

    // Embedded Work Experience info
    workExperience: [
      {
        company: { type: String, required: true, trim: true },
        position: { type: String, required: true, trim: true },
        startDate: Date,
        endDate: Date,
        currentlyWorking: { type: Boolean, default: false },
        description: { type: String, trim: true },
        address: { type: Schema.Types.ObjectId, ref: 'Address' },
      },
    ],
    skills: [
      {
        name: { type: String, required: true, trim: true },
        level: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'], default: 'beginner' },
        yearsOfExperience: { type: Number, min: 0 },
      },
    ],
    languages: [
      {
        name: { type: String, required: true, trim: true },
        proficiency: { type: String, enum: ['basic', 'conversational', 'fluent', 'native'], default: 'basic' },
      },
    ],
    certifications: [
      {
        name: { type: String, required: true },
        authority: String,
        licenseNumber: String,
        url: String,
        date: Date,
      },
    ],
    languages: [languageSchema],
    summary: { type: String, maxlength: 500 },
    hobbies: [String],
    awards: [String],
    // Optionally add profile picture, resume template id, preferences, privacy settings etc.
    imageUrl: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
      url: { type: String, default: null },
      name: { type: String, required: true }, // Original or current filename
      size: { type: Number }, // File size in bytes
      type: { type: String }, // MIME type (image/jpeg, application/pdf, etc.)
    },
    resumeTemplateId: { type: Schema.Types.ObjectId, ref: 'ResumeTemplate' },
    isPublic: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published', 'archived', 'under_review', 'rejected'], default: 'draft', index: true },
    order: { type: Number, default: 0, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    currentlyUsed: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
// Indexes for quick lookup
resumeSchema.index({ user: 1 }, { unique: true });
resumeSchema.index({ status: 1 });
resumeSchema.index({ isDeleted: 1 });
resumeSchema.index({ order: 1 });
// Virtual to fetch full name from User model if desired
resumeSchema.virtual('userFullName').get(function () {
  // Example: populated user model with firstName and lastName
  if (this.user && this.user.firstName && this.user.lastName) {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
  return null;
});

resumeSchema.pre('save', async function (next) {
  const resume = this;

  // 1. Reset isDefault and currentlyUsed flags on other resumes of the same user if this resume sets them true
  if (resume.isDefault || resume.currentlyUsed) {
    try {
      await resume.constructor.updateMany(
        {
          user: resume.user,
          _id: { $ne: resume._id },
          $or: [{ isDefault: true }, { currentlyUsed: true }],
        },
        { $set: { isDefault: false, currentlyUsed: false } }
      );
    } catch (err) {
      return next(err);
    }
  }

  // 2. If resumeTemplateId is not set, assign the default ResumeTemplate id from ResumeTemplate collection
  if (!resume.resumeTemplateId) {
    try {
      const ResumeTemplate = resume.constructor.db.model('ResumeTemplate');
      const defaultTemplate = await ResumeTemplate.findOne({ isDefault: true }).select('_id').lean();

      if (defaultTemplate) {
        resume.resumeTemplateId = defaultTemplate._id;
      }
    } catch (err) {
      return next(err);
    }
  }

  next();
});

// Virtual populate for project count (Projects linked by resume _id)
// Virtual to count number of linked projects
resumeSchema.virtual('projectCount', {
  ref: 'Project',
  localField: '_id',
  foreignField: 'resume',
  count: true,
});

// Virtual to populate all linked projects array
resumeSchema.virtual('projects', {
  ref: 'Project',
  localField: '_id',
  foreignField: 'resume',
});

// Update the summary field and save
resumeSchema.methods.updateSummary = async function (newSummary) {
  this.summary = newSummary;
  return this.save();
};

// Soft delete - mark as deleted without removing
resumeSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  return this.save();
};

// Toggle public visibility
resumeSchema.methods.togglePublic = async function () {
  this.isPublic = !this.isPublic;
  return this.save();
};

// Mark resume as currently used and default
resumeSchema.methods.setAsDefaultAndCurrentlyUsed = async function () {
  this.isDefault = true;
  this.currentlyUsed = true;
  return this.save();
};

resumeSchema.statics.getSingleWithProjectCount = async function (id, options = {}) {
  // Determine query filter based on whether id is Resume _id or a User _id
  // If id matches a resume _id, fetch by that directly.
  // If id is treated as user id, fetch resume where user = id AND isDefault and currentlyUsed are true.

  let filter = { isDeleted: false };

  // Check if id is a valid ObjectId or string representing ObjectId
  const ObjectId = require('mongoose').Types.ObjectId;

  if (ObjectId.isValid(id)) {
    // Try to find resume by _id = id first
    // For this, try a query to check presence quickly (can be optimized if needed)
    // But here, we will assume if id references a resume _id, use it; else treat as user id.

    // We'll query with $or: resume _id or user id with condition.
    filter = {
      isDeleted: false,
      $or: [{ _id: id }, { user: id, isDefault: true, currentlyUsed: true }],
    };
  } else {
    // If id not valid ObjectId treat as user id with condition
    filter = { user: id, isDefault: true, currentlyUsed: true, isDeleted: false };
  }

  const query = this.findOne(filter);

  // Always populate user and resumeTemplateId
  query.populate('user');
  query.populate('resumeTemplateId');

  // Optionally populate contact
  if (options.populateContact) {
    query.populate('contact');
  }

  // Populate virtual projectCount
  query.populate('projectCount');

  // Populate linked projects array
  query.populate({
    path: 'projects',
    match: { isDeleted: false },
    options: { sort: { createdAt: -1 } },
  });

  return query.lean().exec();
};

resumeSchema.statics.getListWithProjectCounts = async function (filter = {}, options = {}) {
  const page = options.page > 0 ? options.page : 1;
  const limit = options.limit > 0 ? options.limit : 20;
  const sort = options.sort || { createdAt: -1 };
  const skip = (page - 1) * limit;

  // Ensure soft-deleted are excluded unless explicitly included
  if (filter.isDeleted === undefined) {
    filter.isDeleted = false;
  }

  // Construct the query with flexible filter (including personalInfo.*)
  const query = this.find(filter).sort(sort).skip(skip).limit(limit).populate('projectCount');

  if (options.populateUser) {
    query.populate('user');
  }
  if (options.populateContact) {
    query.populate('contact');
  }

  const totalCount = await this.countDocuments(filter);
  const resumes = await query.lean().exec();

  return {
    totalCount,
    resumes,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  };
};

resumeSchema.statics.getAdvancedList = async function (filter = {}, options = {}) {
  const { page = 1, limit = 20, sort = { createdAt: -1 }, fullText = '', dateRange = {}, skillName, languageName, facetFields = [], cursor } = options;

  const skip = (page - 1) * limit;

  const baseFilter = { ...filter, isDeleted: false };

  if (fullText) {
    const regex = new RegExp(fullText, 'i');
    baseFilter.$or = [{ 'personalInfo.fullName': regex }, { summary: regex }, { 'skills.name': regex }];
  }

  if (dateRange.createdAt) {
    baseFilter.createdAt = dateRange.createdAt;
  }

  if (skillName) {
    baseFilter['skills.name'] = skillName;
  }

  if (languageName) {
    baseFilter['languages.name'] = languageName;
  }

  // Facets pipeline if requested
  const facetsPipeline = facetFields.length
    ? [
        {
          $facet: facetFields.reduce((acc, field) => {
            acc[field] = [{ $unwind: { path: `$${field.split('.')[0]}`, preserveNullAndEmptyArrays: true } }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }];
            return acc;
          }, {}),
        },
      ]
    : [];

  // Main aggregation pipeline with facets, total count, and paginated results
  const pipeline = [
    { $match: baseFilter },
    ...facetsPipeline,
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
      },
    },
  ];

  const aggResults = await this.aggregate(pipeline).exec();

  const facets = facetFields.length && aggResults.length ? aggResults[0] : {};
  const metadata = aggResults.length ? aggResults[0].metadata : [];
  const results = aggResults.length ? aggResults[0].data : [];

  const totalCount = metadata.length > 0 ? metadata[0].total : 0;
  const totalPages = Math.ceil(totalCount / limit);

  return {
    results,
    facets,
    page,
    limit,
    totalCount,
    totalPages,
  };
};

const js2xmlparser = require('js2xmlparser');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const PDFDocument = require('pdfkit');
const streamBuffers = require('stream-buffers');

resumeSchema.statics.downloadResume = async function (id, options = {}) {
  const format = options.format || 'json'; // 'pdf', 'word', 'xml', 'json'

  // Fetch full resume with details populated
  const resume = await this.getSingleWithProjectCount(id, {
    populateUser: true,
    populateContact: true,
  });

  if (!resume) {
    throw new Error('Resume not found');
  }

  switch (format.toLowerCase()) {
    case 'json':
      // Return JSON string
      return {
        contentType: 'application/json',
        filename: `resume_${id}.json`,
        content: JSON.stringify(resume, null, 2),
      };

    case 'xml':
      // Convert resume JSON to XML string
      const xml = js2xmlparser.parse('resume', resume);
      return {
        contentType: 'application/xml',
        filename: `resume_${id}.xml`,
        content: xml,
      };

    case 'word':
      // Simplistic Word document creation using docx package
      const doc = new Document();
      doc.addSection({
        children: [
          new Paragraph({
            children: [new TextRun(`Resume for ${resume.user.name || 'N/A'}`)],
          }),
          new Paragraph(`Summary: ${resume.summary || ''}`),
          // add more structured content here as needed
        ],
      });
      const buffer = await Packer.toBuffer(doc);
      return {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename: `resume_${id}.docx`,
        content: buffer,
      };

    case 'pdf':
      // Generate PDF with pdfkit in memory buffer
      const pdfBuffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const bufferStream = new streamBuffers.WritableStreamBuffer();

        doc.pipe(bufferStream);
        doc.fontSize(20).text(`Resume for ${resume.user.name || 'N/A'}`, { underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Summary: ${resume.summary || ''}`);

        // add more content as needed here...

        doc.end();
        bufferStream.on('finish', () => {
          resolve(bufferStream.getContents());
        });
        bufferStream.on('error', reject);
      });

      return {
        contentType: 'application/pdf',
        filename: `resume_${id}.pdf`,
        content: pdfBuffer,
      };

    default:
      throw new Error('Unsupported format');
  }
};

module.exports = mongoose.model('Project', projectSchema);
