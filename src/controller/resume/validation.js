
// middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

// Resume validation rules
const resumeValidationRules = () => {
  return [
    body('title')
      .notEmpty()
      .withMessage('Title is required')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Title must be between 2 and 100 characters'),

    body('personalInfo.firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters'),

    body('personalInfo.lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters'),

    body('personalInfo.email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),

    body('personalInfo.phone')
      .optional()
      .isMobilePhone()
      .withMessage('Please provide a valid phone number'),

    body('summary')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Summary must not exceed 2000 characters'),

    body('experience')
      .optional()
      .isArray()
      .withMessage('Experience must be an array'),

    body('experience.*.company')
      .if(body('experience').exists())
      .notEmpty()
      .withMessage('Company name is required')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Company name must be between 1 and 100 characters'),

    body('experience.*.position')
      .if(body('experience').exists())
      .notEmpty()
      .withMessage('Position is required')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Position must be between 1 and 100 characters'),

    body('experience.*.startDate')
      .if(body('experience').exists())
      .isISO8601()
      .withMessage('Start date must be a valid date'),

    body('experience.*.endDate')
      .if(body('experience').exists())
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date'),

    body('education')
      .optional()
      .isArray()
      .withMessage('Education must be an array'),

    body('education.*.institution')
      .if(body('education').exists())
      .notEmpty()
      .withMessage('Institution name is required')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Institution name must be between 1 and 100 characters'),

    body('education.*.degree')
      .if(body('education').exists())
      .notEmpty()
      .withMessage('Degree is required')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Degree must be between 1 and 100 characters'),

    body('skills')
      .optional()
      .isArray()
      .withMessage('Skills must be an array'),

    body('skills.*.category')
      .if(body('skills').exists())
      .notEmpty()
      .withMessage('Skill category is required')
      .trim(),

    body('skills.*.skills')
      .if(body('skills').exists())
      .isArray()
      .withMessage('Skills must be an array'),

    body('visibility')
      .optional()
      .isIn(['private', 'public', 'link-only'])
      .withMessage('Visibility must be private, public, or link-only'),

    body('status')
      .optional()
      .isIn(['draft', 'active', 'archived'])
      .withMessage('Status must be draft, active, or archived'),

    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),

    body('tags.*')
      .if(body('tags').exists())
      .trim()
      .isLength({ min: 1, max: 30 })
      .withMessage('Each tag must be between 1 and 30 characters')
  ];
};

// Resume section validation rules
const resumeSectionValidationRules = () => {
  return [
    body('sectionType')
      .notEmpty()
      .withMessage('Section type is required')
      .isIn(['personalInfo', 'experience', 'education', 'projects', 'skills', 'certifications', 'awards', 'volunteer', 'languages', 'customSections'])
      .withMessage('Invalid section type'),

    body('operation')
      .optional()
      .isIn(['add', 'update', 'replace'])
      .withMessage('Operation must be add, update, or replace'),

    body('data')
      .notEmpty()
      .withMessage('Data is required')
      .custom((value, { req }) => {
        if (typeof value !== 'object') {
          throw new Error('Data must be an object');
        }
        return true;
      })
  ];
};

// Template validation rules
const templateValidationRules = () => {
  return [
    body('name')
      .notEmpty()
      .withMessage('Template name is required')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Template name must be between 2 and 100 characters'),

    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must not exceed 500 characters'),

    body('category')
      .optional()
      .isIn(['professional', 'creative', 'modern', 'classic', 'minimal', 'academic', 'technical'])
      .withMessage('Invalid template category'),

    body('status')
      .optional()
      .isIn(['draft', 'active', 'deprecated', 'archived'])
      .withMessage('Invalid template status'),

    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be a boolean'),

    body('isPremium')
      .optional()
      .isBoolean()
      .withMessage('isPremium must be a boolean'),

    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),

    body('tags.*')
      .if(body('tags').exists())
      .trim()
      .isLength({ min: 1, max: 30 })
      .withMessage('Each tag must be between 1 and 30 characters')
  ];
};

// ID parameter validation
const validateObjectId = (paramName = 'id') => {
  return param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} format`);
};

// Query parameter validation
const paginationValidation = () => {
  return [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ];
};

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    return next(new AppError('Validation failed', 400, errorMessages));
  }
  next();
};

// Export validation middleware functions
const validateResume = [
  ...resumeValidationRules(),
  handleValidationErrors
];

const validateResumeSection = [
  ...resumeSectionValidationRules(),
  handleValidationErrors
];

const validateTemplate = [
  ...templateValidationRules(),
  handleValidationErrors
];

const validatePagination = [
  ...paginationValidation(),
  handleValidationErrors
];

module.exports = {
  validateResume,
  validateResumeSection,
  validateTemplate,
  validateObjectId,
  validatePagination,
  handleValidationErrors,
  resumeValidationRules,
  resumeSectionValidationRules,
  templateValidationRules,
  paginationValidation
};
