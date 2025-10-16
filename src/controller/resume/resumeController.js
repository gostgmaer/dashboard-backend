// controllers/resumeController.js
const Resume = require('./model');
const Template = require('./Template');
const { validationResult } = require('express-validator');
const { AppError, catchAsync } = require('./errorHandler');
const { generateSlug, sanitizeData } = require('./helpers');
const { sendResponse } = require('./response');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Create a new resume
exports.createResume = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const resumeData = {
    ...req.body,
    userId: req.user._id,
  };

  // Sanitize input data
  resumeData.personalInfo = sanitizeData(resumeData.personalInfo);

  // Generate slug if personal info is provided
  if (resumeData.personalInfo?.firstName && resumeData.personalInfo?.lastName) {
    resumeData.slug = generateSlug(`${resumeData.personalInfo.firstName}-${resumeData.personalInfo.lastName}-${resumeData.title}`);
  }

  const resume = await Resume.create(resumeData);
  await resume.populate('templateId', 'name previewUrl');

  sendResponse(res, 201, 'Resume created successfully', resume);
});

// Get all resumes for a user
exports.getResumes = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20, status, visibility, search, sortBy = 'updatedAt', sortOrder = 'desc', tags } = req.query;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  let resumes;
  let total;

  if (search) {
    // Use search aggregation for text search
    const searchOptions = {
      status,
      visibility,
      tags: tags ? tags.split(',') : undefined,
      sort,
      skip: parseInt(skip),
      limit: parseInt(limit),
    };

    resumes = await Resume.searchResumes(req.user._id, search, searchOptions);

    // Get total count for pagination
    const countPipeline = resumes.slice(0, -2); // Remove skip and limit stages
    countPipeline.push({ $count: 'total' });
    const countResult = await Resume.aggregate(countPipeline);
    total = countResult[0]?.total || 0;
  } else {
    // Regular query
    const query = { userId: req.user._id };

    if (status) query.status = status;
    if (visibility) query.visibility = visibility;
    if (tags) query.tags = { $in: tags.split(',') };

    resumes = await Resume.find(query).populate('templateId', 'name previewUrl category').sort(sort).skip(skip).limit(parseInt(limit)).lean();

    total = await Resume.countDocuments(query);
  }

  const pagination = {
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    totalItems: total,
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };

  sendResponse(res, 200, 'Resumes retrieved successfully', {
    resumes,
    pagination,
  });
});

// Search resumes with advanced filters
exports.searchResumes = catchAsync(async (req, res, next) => {
  const { q: searchQuery, page = 1, limit = 20, status, tags, dateFrom, dateTo, sortBy = 'relevance' } = req.query;

  if (!searchQuery) {
    return next(new AppError('Search query is required', 400));
  }

  const skip = (page - 1) * limit;
  const searchOptions = {
    status,
    tags: tags ? tags.split(',') : undefined,
    skip: parseInt(skip),
    limit: parseInt(limit),
  };

  // Add date filtering if provided
  if (dateFrom || dateTo) {
    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);
    searchOptions.dateRange = dateFilter;
  }

  // Set sort options
  if (sortBy === 'date') {
    searchOptions.sort = { updatedAt: -1 };
  } else if (sortBy === 'name') {
    searchOptions.sort = { title: 1 };
  }

  const resumes = await Resume.searchResumes(req.user._id, searchQuery, searchOptions);

  sendResponse(res, 200, 'Search completed successfully', {
    resumes,
    searchQuery,
    filters: { status, tags, dateFrom, dateTo },
  });
});

// Get single resume
exports.getResume = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  }).populate('templateId', 'name previewUrl category supportedFormats');

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  // Update last viewed
  resume.lastViewedAt = new Date();
  await resume.save();

  sendResponse(res, 200, 'Resume retrieved successfully', resume);
});

// Update resume
exports.updateResume = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { id } = req.params;
  const updateData = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  // Create version before updating if significant changes
  const significantFields = ['personalInfo', 'experience', 'education', 'skills'];
  const hasSignificantChanges = significantFields.some((field) => updateData[field] && JSON.stringify(updateData[field]) !== JSON.stringify(resume[field]));

  if (hasSignificantChanges) {
    // await resume.createVersion('Updated via API');
  }

  // Sanitize update data
  if (updateData.personalInfo) {
    updateData.personalInfo = sanitizeData(updateData.personalInfo);
  }

  // Update resume
  Object.assign(resume, updateData);
  await resume.save();
  await resume.populate('templateId', 'name previewUrl');

  sendResponse(res, 200, 'Resume updated successfully', resume);
});

// Delete resume
exports.deleteResume = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOneAndDelete({
    _id: id,
    userId: req.user._id,
  });

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  sendResponse(res, 200, 'Resume deleted successfully');
});

// Update specific section
exports.updateSection = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { id } = req.params;
  const { sectionType, data, operation = 'update' } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  // Validate section type
  const validSections = ['personalInfo', 'experience', 'education', 'projects', 'skills', 'certifications', 'awards', 'volunteer', 'languages', 'customSections'];

  if (!validSections.includes(sectionType)) {
    return next(new AppError('Invalid section type', 400));
  }

  // Create version before making changes
  await resume.createVersion(`Updated ${sectionType} section`);

  // Handle different operations
  switch (operation) {
    case 'add':
      if (Array.isArray(resume[sectionType])) {
        resume[sectionType].push(data);
      } else {
        resume[sectionType] = data;
      }
      break;

    case 'update':
      if (data.index !== undefined && Array.isArray(resume[sectionType])) {
        resume[sectionType][data.index] = { ...resume[sectionType][data.index], ...data.updates };
      } else {
        resume[sectionType] = { ...resume[sectionType], ...data };
      }
      break;

    case 'replace':
      resume[sectionType] = data;
      break;

    default:
      return next(new AppError('Invalid operation', 400));
  }

  await resume.save();
  sendResponse(res, 200, 'Section updated successfully', resume);
});

// Delete section item
exports.deleteSection = catchAsync(async (req, res, next) => {
  const { id, sectionType, sectionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  // Create version before deletion
  await resume.createVersion(`Deleted item from ${sectionType} section`);

  // Handle section deletion
  if (Array.isArray(resume[sectionType])) {
    resume[sectionType] = resume[sectionType].filter((item) => item._id.toString() !== sectionId);
  } else {
    return next(new AppError('Cannot delete from non-array section', 400));
  }

  await resume.save();
  sendResponse(res, 200, 'Section item deleted successfully', resume);
});

// Apply template to resume
exports.applyTemplate = catchAsync(async (req, res, next) => {
  const { id, templateId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(templateId)) {
    return next(new AppError('Invalid ID format', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  const template = await Template.findOne({
    _id: templateId,
    status: 'active',
    $or: [{ isPublic: true }, { createdBy: req.user._id }],
  });

  if (!template) {
    return next(new AppError('Template not found or not accessible', 404));
  }

  // Validate resume data against template
  const validation = template.validateResumeData(resume.toObject());
  if (!validation.isValid) {
    return next(new AppError('Resume data is not compatible with template', 400, validation.errors));
  }

  // Create version before applying template
  await resume.createVersion(`Applied template: ${template.name}`);

  // Apply template
  resume.templateId = templateId;
  await resume.save();

  // Increment template usage
  await template.incrementUsage();

  await resume.populate('templateId', 'name previewUrl category');

  sendResponse(res, 200, 'Template applied successfully', resume);
});

// Duplicate resume
exports.duplicateResume = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const originalResume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!originalResume) {
    return next(new AppError('Resume not found', 404));
  }

  // Create duplicate
  const duplicateData = originalResume.toObject();
  delete duplicateData._id;
  delete duplicateData.createdAt;
  delete duplicateData.updatedAt;
  delete duplicateData.versions;
  delete duplicateData.shareToken;
  delete duplicateData.slug;

  duplicateData.title = title || `Copy of ${duplicateData.title}`;
  duplicateData.currentVersion = 1;
  duplicateData.status = 'draft';
  duplicateData.visibility = 'private';
  duplicateData.viewCount = 0;
  duplicateData.downloadCount = 0;

  const duplicatedResume = await Resume.create(duplicateData);
  await duplicatedResume.populate('templateId', 'name previewUrl');

  sendResponse(res, 201, 'Resume duplicated successfully', duplicatedResume);
});

// Import resume from various sources
exports.importResume = catchAsync(async (req, res, next) => {
  const { source = 'json' } = req.body;

  if (!req.file && !req.body.data) {
    return next(new AppError('No file or data provided for import', 400));
  }

  let importData;
  let originalData;

  try {
    if (req.file) {
      const fileContent = req.file.buffer.toString('utf8');
      originalData = fileContent;

      if (source === 'json') {
        importData = JSON.parse(fileContent);
      } else if (source === 'linkedin') {
        // Process LinkedIn export format
        importData = processLinkedInData(JSON.parse(fileContent));
      } else {
        return next(new AppError('Unsupported import source', 400));
      }
    } else {
      importData = req.body.data;
      originalData = JSON.stringify(importData);
    }

    // Map imported data to our resume schema
    const resumeData = mapImportedData(importData, source);
    resumeData.userId = req.user._id;
    resumeData.importSource = {
      type: source,
      originalData,
      importedAt: new Date(),
    };

    const resume = await Resume.create(resumeData);
    await resume.populate('templateId', 'name previewUrl');

    sendResponse(res, 201, 'Resume imported successfully', resume);
  } catch (error) {
    return next(new AppError('Failed to parse import data: ' + error.message, 400));
  }
});

// Get resume statistics
exports.getResumeStats = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const stats = await Resume.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalResumes: { $sum: 1 },
        activeResumes: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        draftResumes: {
          $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] },
        },
        publicResumes: {
          $sum: { $cond: [{ $eq: ['$visibility', 'public'] }, 1, 0] },
        },
        totalViews: { $sum: '$viewCount' },
        totalDownloads: { $sum: '$downloadCount' },
        averageViews: { $avg: '$viewCount' },
      },
    },
  ]);

  const recentActivity = await Resume.find({ userId }).sort({ updatedAt: -1 }).limit(5).select('title updatedAt status').lean();

  const result = {
    ...(stats[0] || {
      totalResumes: 0,
      activeResumes: 0,
      draftResumes: 0,
      publicResumes: 0,
      totalViews: 0,
      totalDownloads: 0,
      averageViews: 0,
    }),
    recentActivity,
  };

  delete result._id;

  sendResponse(res, 200, 'Resume statistics retrieved successfully', result);
});

// Get resume versions
exports.getVersions = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  }).select('versions currentVersion title');

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  const skip = (page - 1) * limit;
  const versions = resume.versions.sort((a, b) => b.versionNumber - a.versionNumber).slice(skip, skip + limit);

  const total = resume.versions.length;
  const pagination = {
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    totalItems: total,
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };

  sendResponse(res, 200, 'Resume versions retrieved successfully', {
    currentVersion: resume.currentVersion,
    versions,
    pagination,
  });
});

// Rollback to specific version
exports.rollbackVersion = catchAsync(async (req, res, next) => {
  const { id, version } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  try {
    await resume.rollbackToVersion(parseInt(version));
    await resume.populate('templateId', 'name previewUrl');

    sendResponse(res, 200, `Resume rolled back to version ${version}`, resume);
  } catch (error) {
    return next(new AppError(error.message, 400));
  }
});

// Create manual version
exports.createVersion = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { description = 'Manual version created' } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  await resume.createVersion(description);

  sendResponse(res, 200, 'Version created successfully', {
    currentVersion: resume.currentVersion,
    totalVersions: resume.versions.length,
  });
});

// Update visibility settings
exports.updateVisibility = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { visibility, shareSettings } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  if (!['private', 'public', 'link-only'].includes(visibility)) {
    return next(new AppError('Invalid visibility setting', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  resume.visibility = visibility;

  if (shareSettings) {
    resume.shareSettings = { ...resume.shareSettings, ...shareSettings };
  }

  // Generate share token for link-only visibility
  if (visibility === 'link-only' && !resume.shareToken) {
    await resume.generateShareToken();
  }

  await resume.save();

  sendResponse(res, 200, 'Visibility updated successfully', {
    visibility: resume.visibility,
    shareToken: resume.shareToken,
    shareSettings: resume.shareSettings,
  });
});

// Generate share link
exports.generateShareLink = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  await resume.generateShareToken();

  const shareUrl = `${req.protocol}://${req.get('host')}/api/resumes/${id}/share/${resume.shareToken}`;

  sendResponse(res, 200, 'Share link generated successfully', {
    shareUrl,
    shareToken: resume.shareToken,
    expiresAt: resume.shareSettings?.expiresAt,
  });
});

// Get shared resume (public access)
exports.getSharedResume = catchAsync(async (req, res, next) => {
  const { id, token } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    $or: [{ visibility: 'public' }, { visibility: 'link-only', shareToken: token }],
  }).populate('templateId', 'name previewUrl category');

  if (!resume) {
    return next(new AppError('Resume not found or not accessible', 404));
  }

  // Check if share link is expired
  if (resume.shareSettings?.expiresAt && new Date() > resume.shareSettings.expiresAt) {
    return next(new AppError('Share link has expired', 403));
  }

  // Filter sensitive information for public access
  const publicResume = resume.toObject();
  delete publicResume.userId;
  delete publicResume.versions;
  delete publicResume.shareToken;
  delete publicResume.importSource;

  // Hide contact info if configured
  if (!resume.shareSettings?.showContactInfo) {
    if (publicResume.personalInfo) {
      delete publicResume.personalInfo.email;
      delete publicResume.personalInfo.phone;
      delete publicResume.personalInfo.address;
    }
  }

  // Increment view count
  resume.viewCount += 1;
  resume.lastViewedAt = new Date();
  await resume.save();

  sendResponse(res, 200, 'Shared resume retrieved successfully', publicResume);
});

// Helper functions
function processLinkedInData(linkedinData) {
  // Process LinkedIn export format and map to our schema
  // This is a simplified version - you'd need to handle LinkedIn's actual export format
  return {
    title: 'Imported from LinkedIn',
    personalInfo: {
      firstName: linkedinData.firstName,
      lastName: linkedinData.lastName,
      email: linkedinData.emailAddress,
      linkedin: linkedinData.publicProfileUrl,
    },
    summary: linkedinData.summary,
    experience:
      linkedinData.positions?.values?.map((pos) => ({
        company: pos.company?.name,
        position: pos.title,
        startDate: new Date(pos.startDate?.year, pos.startDate?.month - 1),
        endDate: pos.endDate ? new Date(pos.endDate.year, pos.endDate.month - 1) : null,
        isCurrent: !pos.endDate,
        description: pos.summary,
      })) || [],
    education:
      linkedinData.educations?.values?.map((edu) => ({
        institution: edu.schoolName,
        degree: edu.degree,
        fieldOfStudy: edu.fieldOfStudy,
        startDate: new Date(edu.startDate?.year, 0),
        endDate: new Date(edu.endDate?.year, 11),
      })) || [],
  };
}

function mapImportedData(data, source) {
  if (source === 'json') {
    // Handle JSON Resume format or our own format
    if (data.basics) {
      // JSON Resume format
      return {
        title: 'Imported Resume',
        personalInfo: {
          firstName: data.basics.name?.split(' ')[0],
          lastName: data.basics.name?.split(' ').slice(1).join(' '),
          email: data.basics.email,
          phone: data.basics.phone,
          website: data.basics.website,
          address: data.basics.location,
        },
        summary: data.basics.summary,
        experience:
          data.work?.map((work) => ({
            company: work.company,
            position: work.position,
            startDate: new Date(work.startDate),
            endDate: work.endDate ? new Date(work.endDate) : null,
            description: work.summary,
            achievements: work.highlights || [],
          })) || [],
        education:
          data.education?.map((edu) => ({
            institution: edu.institution,
            degree: edu.studyType,
            fieldOfStudy: edu.area,
            startDate: new Date(edu.startDate),
            endDate: new Date(edu.endDate),
          })) || [],
      };
    }

    // Our own format
    return data;
  }

  return data;
}

module.exports = exports;
