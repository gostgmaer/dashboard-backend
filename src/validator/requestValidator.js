// validator/requestValidator.js
const { validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  try {
    const errors = validationResult(req);
    
    
    if (!errors.isEmpty()) {
         const messages = errors.array().map(error => error.msg);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages
      });
    }
    
    next();
  } catch (error) {
    console.error('Validation middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = validateRequest;
