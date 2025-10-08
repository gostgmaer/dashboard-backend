const mime = require('mime-types');
// const logger = require('../utils/logger');

const validateFile = (req, res, next) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    
    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760;
    const allowedMimeTypes = process.env.ALLOWED_MIME_TYPES ? 
      process.env.ALLOWED_MIME_TYPES.split(',') : 
      ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];

    for (const file of files) {
      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `File ${file.originalname} exceeds maximum size of ${maxSize} bytes`
        });
      }

      // Check MIME type
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `File type ${file.mimetype} not allowed for file ${file.originalname}`
        });
      }

      // Validate file extension matches MIME type
      const expectedMimeType = mime.lookup(file.originalname);
      // if (expectedMimeType && expectedMimeType !== file.mimetype) {
      //   logger.warn(`MIME type mismatch for ${file.originalname}: expected ${expectedMimeType}, got ${file.mimetype}`);
      // }

      // Sanitize filename
      const sanitized = file.originalname.replace(/[<>:"/\\|?*]/g, '_');
      // if (sanitized !== file.originalname) {
      //   file.originalname = sanitized;
      //   logger.info(`Sanitized filename: ${sanitized}`);
      // }
    }

    next();
  } catch (error) {
    // logger.error('File validation error:', error);
    res.status(500).json({
      success: false,
      message: 'File validation failed'
    });
  }
};

module.exports = validateFile;