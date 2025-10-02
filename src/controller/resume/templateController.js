
// controllers/templateController.js
const Resume = require('./model');
const Template = require('./Template');
const { validationResult } = require('express-validator');
const { AppError, catchAsync } = require('./errorHandler');
const { sendResponse } = require('./response');
// const { uploadToStorage, deleteFromStorage } = require('./fileStorage');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;

// Get public templates
exports.getPublicTemplates = catchAsync(async (req, res, next) => {
  const {
    category,
    tags,
    isPremium,
    sortBy = 'usage',
    page = 1,
    limit = 20
  } = req.query;

  const options = {
    category,
    tags: tags ? tags.split(',') : undefined,
    isPremium: isPremium !== undefined ? isPremium === 'true' : undefined,
    sortBy,
    limit: parseInt(limit)
  };

  const templates = await Template.findPublicTemplates(options);

  const total = await Template.countDocuments({
    status: 'active',
    isPublic: true,
    ...(category && { category }),
    ...(isPremium !== undefined && { isPremium: isPremium === 'true' }),
    ...(tags && { tags: { $in: tags.split(',') } })
  });

  const pagination = {
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / limit),
    totalItems: total,
    hasNext: page * limit < total,
    hasPrev: page > 1
  };

  sendResponse(res, 200, 'Templates retrieved successfully', {
    templates,
    pagination
  });
});

// Search templates
exports.searchTemplates = catchAsync(async (req, res, next) => {
  const {
    q: searchQuery,
    category,
    tags,
    isPremium,
    sortBy = 'relevance',
    page = 1,
    limit = 20
  } = req.query;

  if (!searchQuery) {
    return next(new AppError('Search query is required', 400));
  }

  const options = {
    category,
    tags: tags ? tags.split(',') : undefined,
    isPremium: isPremium !== undefined ? isPremium === 'true' : undefined,
    sortBy,
    skip: (page - 1) * limit,
    limit: parseInt(limit)
  };

  const templates = await Template.searchTemplates(searchQuery, options);

  sendResponse(res, 200, 'Template search completed', {
    templates,
    searchQuery,
    filters: { category, tags, isPremium }
  });
});

// Get template categories
exports.getTemplateCategories = catchAsync(async (req, res, next) => {
  const categories = await Template.aggregate([
    { $match: { status: 'active', isPublic: true } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating.average' },
        templates: { $push: { _id: '$_id', name: '$name', thumbnailUrl: '$files.thumbnailImage' } }
      }
    },
    {
      $project: {
        category: '$_id',
        count: 1,
        avgRating: { $round: ['$avgRating', 1] },
        sampleTemplates: { $slice: ['$templates', 3] },
        _id: 0
      }
    },
    { $sort: { count: -1 } }
  ]);

  sendResponse(res, 200, 'Template categories retrieved successfully', categories);
});

// Get single template
exports.getTemplate = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { includeFiles = false } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid template ID', 400));
  }

  const selectFields = includeFiles ? '' : '-files.htmlTemplate -files.cssStyles -files.jsScripts';

  const template = await Template.findOne({
    _id: id,
    status: 'active'
  }).select(selectFields);

  if (!template) {
    return next(new AppError('Template not found', 404));
  }

  // Check access permissions for non-public templates
  if (!template.isPublic && (!req.user || template.createdBy.toString() !== req.user._id.toString())) {
    return next(new AppError('Template access denied', 403));
  }

  sendResponse(res, 200, 'Template retrieved successfully', template);
});

// Get template preview image
exports.getTemplatePreview = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid template ID', 400));
  }

  const template = await Template.findOne({
    _id: id,
    status: 'active'
  }).select('files.previewImage name');

  if (!template) {
    return next(new AppError('Template not found', 404));
  }

  if (!template.files.previewImage) {
    return next(new AppError('Preview image not available', 404));
  }

  try {
    const imagePath = path.join(process.cwd(), 'uploads', 'templates', template.files.previewImage);
    const imageBuffer = await fs.readFile(imagePath);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.send(imageBuffer);
  } catch (error) {
    return next(new AppError('Preview image not found', 404));
  }
});

// Get template thumbnail image
exports.getTemplateThumbnail = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid template ID', 400));
  }

  const template = await Template.findOne({
    _id: id,
    status: 'active'
  }).select('files.thumbnailImage name');

  if (!template) {
    return next(new AppError('Template not found', 404));
  }

  if (!template.files.thumbnailImage) {
    return next(new AppError('Thumbnail image not available', 404));
  }

  try {
    const imagePath = path.join(process.cwd(), 'uploads', 'templates', template.files.thumbnailImage);
    const imageBuffer = await fs.readFile(imagePath);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.send(imageBuffer);
  } catch (error) {
    return next(new AppError('Thumbnail image not found', 404));
  }
});

// Create new template (Admin only)
exports.createTemplate = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const templateData = req.body;
  templateData.createdBy = req.user._id;

  // Handle file uploads
  if (req.files) {
    const files = {};

    if (req.files.htmlTemplate) {
      files.htmlTemplate = req.files.htmlTemplate[0].filename;
    }
    if (req.files.cssStyles) {
      files.cssStyles = req.files.cssStyles[0].filename;
    }
    if (req.files.jsScripts) {
      files.jsScripts = req.files.jsScripts[0].filename;
    }
    if (req.files.previewImage) {
      files.previewImage = req.files.previewImage[0].filename;
    }
    if (req.files.thumbnailImage) {
      files.thumbnailImage = req.files.thumbnailImage[0].filename;
    }

    templateData.files = files;
  }

  // Parse JSON fields if they're strings
  if (typeof templateData.sections === 'string') {
    templateData.sections = JSON.parse(templateData.sections);
  }
  if (typeof templateData.style === 'string') {
    templateData.style = JSON.parse(templateData.style);
  }
  if (typeof templateData.supportedFormats === 'string') {
    templateData.supportedFormats = JSON.parse(templateData.supportedFormats);
  }
  if (typeof templateData.validationRules === 'string') {
    templateData.validationRules = JSON.parse(templateData.validationRules);
  }

  const template = await Template.create(templateData);

  sendResponse(res, 201, 'Template created successfully', template);
});

// Update template (Admin only)
exports.updateTemplate = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { id } = req.params;
  const updateData = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid template ID', 400));
  }

  const template = await Template.findById(id);
  if (!template) {
    return next(new AppError('Template not found', 404));
  }

  // Handle file uploads
  if (req.files) {
    const files = { ...template.files };

    // Remove old files if new ones are uploaded
    if (req.files.htmlTemplate) {
      if (files.htmlTemplate) {
        // await deleteFromStorage('templates', files.htmlTemplate);
      }
      files.htmlTemplate = req.files.htmlTemplate[0].filename;
    }
    if (req.files.cssStyles) {
      if (files.cssStyles) {
        // await deleteFromStorage('templates', files.cssStyles);
      }
      files.cssStyles = req.files.cssStyles[0].filename;
    }
    if (req.files.jsScripts) {
      if (files.jsScripts) {
        // await deleteFromStorage('templates', files.jsScripts);
      }
      files.jsScripts = req.files.jsScripts[0].filename;
    }
    if (req.files.previewImage) {
      if (files.previewImage) {
        // await deleteFromStorage('templates', files.previewImage);
      }
      files.previewImage = req.files.previewImage[0].filename;
    }
    if (req.files.thumbnailImage) {
      if (files.thumbnailImage) {
        // await deleteFromStorage('templates', files.thumbnailImage);
      }
      files.thumbnailImage = req.files.thumbnailImage[0].filename;
    }

    updateData.files = files;
  }

  // Parse JSON fields if they're strings
  if (typeof updateData.sections === 'string') {
    updateData.sections = JSON.parse(updateData.sections);
  }
  if (typeof updateData.style === 'string') {
    updateData.style = JSON.parse(updateData.style);
  }
  if (typeof updateData.supportedFormats === 'string') {
    updateData.supportedFormats = JSON.parse(updateData.supportedFormats);
  }
  if (typeof updateData.validationRules === 'string') {
    updateData.validationRules = JSON.parse(updateData.validationRules);
  }

  Object.assign(template, updateData);
  await template.save();

  sendResponse(res, 200, 'Template updated successfully', template);
});

// Delete template (Admin only)
exports.deleteTemplate = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid template ID', 400));
  }

  const template = await Template.findById(id);
  if (!template) {
    return next(new AppError('Template not found', 404));
  }

  // Check if template is being used
  const resumeCount = await Resume.countDocuments({ templateId: id });
  if (resumeCount > 0) {
    return next(new AppError(`Cannot delete template. It is being used by ${resumeCount} resume(s)`, 400));
  }

  // Delete associated files
  if (template.files) {
    const filePromises = [];
    Object.values(template.files).forEach(filename => {
      if (filename) {
        // filePromises.push(deleteFromStorage('templates', filename));
      }
    });
    await Promise.allSettled(filePromises);
  }

  await Template.findByIdAndDelete(id);

  sendResponse(res, 200, 'Template deleted successfully');
});

// Update template status (Admin only)
exports.updateTemplateStatus = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid template ID', 400));
  }

  if (!['draft', 'active', 'deprecated', 'archived'].includes(status)) {
    return next(new AppError('Invalid status value', 400));
  }

  const template = await Template.findByIdAndUpdate(
    id,
    { 
      status,
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    },
    { new: true, runValidators: true }
  );

  if (!template) {
    return next(new AppError('Template not found', 404));
  }

  sendResponse(res, 200, 'Template status updated successfully', template);
});

// Rate template
exports.rateTemplate = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { rating } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid template ID', 400));
  }

  if (!rating || rating < 1 || rating > 5) {
    return next(new AppError('Rating must be between 1 and 5', 400));
  }

  const template = await Template.findOne({
    _id: id,
    status: 'active',
    isPublic: true
  });

  if (!template) {
    return next(new AppError('Template not found or not accessible', 404));
  }

  await template.updateRating(rating);

  sendResponse(res, 200, 'Template rated successfully', {
    averageRating: template.rating.average,
    totalRatings: template.rating.count
  });
});

// Validate resume with template
exports.validateResumeWithTemplate = catchAsync(async (req, res, next) => {
  const { id: templateId, resumeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(resumeId)) {
    return next(new AppError('Invalid ID format', 400));
  }

  const template = await Template.findOne({
    _id: templateId,
    status: 'active'
  });

  if (!template) {
    return next(new AppError('Template not found', 404));
  }

  const resume = await Resume.findOne({
    _id: resumeId,
    userId: req.user._id
  });

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  const validation = template.validateResumeData(resume.toObject());

  sendResponse(res, 200, 'Validation completed', {
    isValid: validation.isValid,
    errors: validation.errors,
    templateName: template.name,
    resumeTitle: resume.title
  });
});

module.exports = exports;
