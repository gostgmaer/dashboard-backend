const Joi = require('joi');
// const logger = require('../utils/logger');

const validateUpload = (req, res, next) => {
  const schema = Joi.object({
    description: Joi.string().max(1000).optional(),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string().max(50))
    ).optional(),
    custom: Joi.string().optional() // JSON string
  });

  const { error } = schema.validate(req.body);
  if (error) {
    // logger.error('Upload validation error:', error);
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  // Parse JSON custom field if provided
  if (req.body.custom) {
    try {
      JSON.parse(req.body.custom);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON in custom field'
      });
    }
  }

  next();
};

const validateUpdate = (req, res, next) => {
  const schema = Joi.object({
    originalName: Joi.string().max(255).optional(),
    metadata: Joi.object({
      description: Joi.string().max(1000).optional(),
      tags: Joi.array().items(Joi.string().max(50)).optional(),
      custom: Joi.object().optional()
    }).optional()
  }).min(1);

  const { error } = schema.validate(req.body);
  if (error) {
    // logger.error('Update validation error:', error);
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  next();
};

const validateQuery = (req, res, next) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().pattern(/^-?(originalName|size|createdAt|updatedAt)$/).optional(),
    uploader: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
    mimeType: Joi.string().optional(),
    tags: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional(),
    dateFrom: Joi.date().iso().optional(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
    search: Joi.string().max(100).optional()
  });

  const { error } = schema.validate(req.query);
  if (error) {
    // logger.error('Query validation error:', error);
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  next();
};

module.exports = {
  validateUpload,
  validateUpdate,
  validateQuery
};