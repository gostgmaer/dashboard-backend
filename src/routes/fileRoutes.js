const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const {
  uploadFiles,
  getFiles,
  getFileById,
  downloadFile,
  updateFileMetadata,
  replaceFileContent,
  deleteFile,
  getFileTransactions
} = require('../controller/fileUploader/fileController');
const {authMiddleware} = require('../middleware/auth');
const validateFile = require('../controller/fileUploader/validateFile');
const { validateUpload, validateUpdate, validateQuery } = require('../controller/fileUploader/validation');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = process.env.ALLOWED_MIME_TYPES ? 
      process.env.ALLOWED_MIME_TYPES.split(',') : 
      ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

// Rate limiting for uploads
const uploadLimiter = rateLimit({
  windowMs: parseInt(process.env.UPLOAD_RATE_WINDOW) || 900000, // 15 minutes
  max: parseInt(process.env.UPLOAD_RATE_LIMIT) || 10,
  message: {
    success: false,
    message: 'Too many upload requests, please try again later'
  }
});

// Apply auth middleware to all routes
router.use(authMiddleware);

// Upload routes
router.post('/upload', 
  uploadLimiter,
  upload.array('files', 10),
  validateFile,
  validateUpload,
  uploadFiles
);

// List files with filtering and pagination
router.get('/',
  validateQuery,
  getFiles
);

// Get single file metadata
router.get('/:id',
  getFileById
);

// Download file
router.get('/:id/download',
  downloadFile
);

// Update file metadata
router.patch('/:id',
  validateUpdate,
  updateFileMetadata
);

// Replace file content
router.put('/:id/replace',
  uploadLimiter,
  upload.single('file'),
  validateFile,
  replaceFileContent
);

// Soft delete file
router.delete('/:id',
  deleteFile
);

// Permanent delete file (admin only)
router.delete('/:id/permanent',
  deleteFile
);

// Get file transaction history
router.get('/:id/transactions',
  getFileTransactions
);

module.exports = router;