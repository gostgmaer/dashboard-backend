
const { body, param, query, validationResult } = require('express-validator');

// Helper function to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return res.status(400).json({
      success: false,
      message: errorMessages.join(', '),
      data: null,
      errors: errors.array()
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  handleValidationErrors
];

const validateUserLogin = [
  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

// Resume validation rules
const validateResumeCreation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Resume title is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),

  body('template')
    .optional()
    .isMongoId()
    .withMessage('Invalid template ID'),

  handleValidationErrors
];

const validateResumeUpdate = [
  param('id')
    .isMongoId()
    .withMessage('Invalid resume ID'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),

  body('template')
    .optional()
    .isMongoId()
    .withMessage('Invalid template ID'),

  handleValidationErrors
];

// Section validation rules
const validateSectionCreation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid resume ID'),

  body('type')
    .isIn(['personal', 'education', 'experience', 'projects', 'skills', 'certifications', 'languages', 'hobbies', 'references', 'summary', 'awards', 'volunteer', 'custom'])
    .withMessage('Invalid section type'),

  body('data')
    .isObject()
    .withMessage('Section data must be an object'),

  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),

  handleValidationErrors
];

const validateSectionUpdate = [
  param('id')
    .isMongoId()
    .withMessage('Invalid resume ID'),

  param('sectionId')
    .isMongoId()
    .withMessage('Invalid section ID'),

  body('data')
    .optional()
    .isObject()
    .withMessage('Section data must be an object'),

  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),

  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer'),

  handleValidationErrors
];

const validateSectionReorder = [
  param('id')
    .isMongoId()
    .withMessage('Invalid resume ID'),

  body('sections')
    .isArray({ min: 1 })
    .withMessage('Sections array is required'),

  body('sections.*.sectionId')
    .isMongoId()
    .withMessage('Each section must have a valid sectionId'),

  handleValidationErrors
];

// Template validation rules
const validateTemplateApplication = [
  param('id')
    .isMongoId()
    .withMessage('Invalid resume ID'),

  body('template')
    .isMongoId()
    .withMessage('Invalid template ID'),

  handleValidationErrors
];

// User settings validation
const validateUserSettings = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('settings.darkMode')
    .optional()
    .isBoolean()
    .withMessage('darkMode must be a boolean'),

  handleValidationErrors
];

// Export validation rules
const validateExportQuery = [
  param('id')
    .isMongoId()
    .withMessage('Invalid resume ID'),

  query('format')
    .optional()
    .isIn(['pdf', 'docx', 'json'])
    .withMessage('Format must be pdf, docx, or json'),

  handleValidationErrors
];

// Common parameter validation
const validateMongoId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName}`),

  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateResumeCreation,
  validateResumeUpdate,
  validateSectionCreation,
  validateSectionUpdate,
  validateSectionReorder,
  validateTemplateApplication,
  validateUserSettings,
  validateExportQuery,
  validateMongoId
};
