
// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('./errorHandler');

// Ensure upload directories exist
const ensureUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage for resume files
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'resumes');
    ensureUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// Configure storage for template files
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;

    if (file.fieldname === 'previewImage' || file.fieldname === 'thumbnailImage') {
      uploadPath = path.join(process.cwd(), 'uploads', 'templates', 'images');
    } else {
      uploadPath = path.join(process.cwd(), 'uploads', 'templates', 'files');
    }

    ensureUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

// File filters
const resumeFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/json',
    'text/plain',
    'application/pdf', // For parsing existing resumes
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only JSON, TXT, PDF, DOC, and DOCX files are allowed.', 400), false);
  }
};

const templateFileFilter = (req, file, cb) => {
  let allowedTypes = [];

  switch (file.fieldname) {
    case 'htmlTemplate':
      allowedTypes = ['text/html'];
      break;
    case 'cssStyles':
      allowedTypes = ['text/css'];
      break;
    case 'jsScripts':
      allowedTypes = ['text/javascript', 'application/javascript'];
      break;
    case 'previewImage':
    case 'thumbnailImage':
      allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      break;
    default:
      allowedTypes = [];
  }

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Invalid file type for ${file.fieldname}. Allowed types: ${allowedTypes.join(', ')}`, 400), false);
  }
};

// Size limits
const fileSizeLimits = {
  resume: 10 * 1024 * 1024, // 10MB
  template: {
    htmlTemplate: 5 * 1024 * 1024, // 5MB
    cssStyles: 2 * 1024 * 1024,    // 2MB
    jsScripts: 2 * 1024 * 1024,    // 2MB
    previewImage: 5 * 1024 * 1024, // 5MB
    thumbnailImage: 2 * 1024 * 1024 // 2MB
  }
};

// Create multer instances
const uploadResume = multer({
  storage: resumeStorage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: fileSizeLimits.resume,
    files: 1
  }
});

const uploadTemplate = multer({
  storage: templateStorage,
  fileFilter: templateFileFilter,
  limits: {
    fileSize: Math.max(...Object.values(fileSizeLimits.template)),
    files: 5 // Max 5 files per template
  }
});

// Memory storage for processing files without saving to disk initially
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: fileSizeLimits.resume,
    files: 1
  }
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Maximum size allowed is ' + 
                 Math.round((error.field === 'resume' ? fileSizeLimits.resume : 
                           fileSizeLimits.template[error.field] || fileSizeLimits.resume) / (1024 * 1024)) + 'MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = `Unexpected field: ${error.field}`;
        break;
      default:
        message = 'File upload error: ' + error.message;
    }

    return next(new AppError(message, 400));
  }

  next(error);
};

// Validation middleware for uploaded files
const validateUploadedFiles = (req, res, next) => {
  if (req.files) {
    // Validate template files
    const templateFields = ['htmlTemplate', 'cssStyles', 'jsScripts', 'previewImage', 'thumbnailImage'];
    const uploadedFields = Object.keys(req.files);

    for (const field of uploadedFields) {
      if (!templateFields.includes(field)) {
        return next(new AppError(`Invalid file field: ${field}`, 400));
      }
    }

    // Validate HTML template is required for new templates
    if (req.method === 'POST' && !req.files.htmlTemplate) {
      return next(new AppError('HTML template file is required', 400));
    }
  }

  if (req.file) {
    // Validate single file upload
    if (req.file.size === 0) {
      return next(new AppError('Uploaded file is empty', 400));
    }
  }

  next();
};

// Clean up temporary files middleware
const cleanupTempFiles = (req, res, next) => {
  const cleanup = () => {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error cleaning up temp file:', err);
      });
    }

    if (req.files) {
      Object.values(req.files).forEach(files => {
        if (Array.isArray(files)) {
          files.forEach(file => {
            if (file.path) {
              fs.unlink(file.path, (err) => {
                if (err) console.error('Error cleaning up temp file:', err);
              });
            }
          });
        }
      });
    }
  };

  // Clean up on response finish
  res.on('finish', cleanup);
  res.on('close', cleanup);

  next();
};

module.exports = {
  uploadResume,
  uploadTemplate,
  memoryUpload,
  handleMulterError,
  validateUploadedFiles,
  cleanupTempFiles,
  fileSizeLimits
};
