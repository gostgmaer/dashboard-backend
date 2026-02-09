const FileService = require('../../services/FileService');
const { v4: uuidv4 } = require('uuid');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

// Create a single instance of FileService
const fileService = new FileService();

// Upload files handler
const uploadFiles = catchAsync(async (req, res) => {
  const requestId = uuidv4();

  if (!req.files || req.files.length === 0) {
    throw AppError.badRequest('No files provided');
  }

  const uploadedFiles = [];
  const metadata = {
    description: req.body.description || '',
    tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [],
    custom: req.body.custom ? JSON.parse(req.body.custom) : {},
  };

  for (const file of req.files) {
    const uploadedFile = await fileService.uploadFile(file, req.user.id, requestId, metadata);

    uploadedFiles.push({
      id: uploadedFile._id,
      originalName: uploadedFile.originalName,
      size: uploadedFile.size,
      mimeType: uploadedFile.mimeType,
      url: uploadedFile.publicUrl,
      metadata: uploadedFile.metadata,
    });
  }

  return sendSuccess(res, { data: uploadedFiles, message: 'Files uploaded successfully' });
});

// Get files handler
const getFiles = catchAsync(async (req, res) => {
  const filters = {
    uploader: req.query.uploader,
    mimeType: req.query.mimeType,
    tags: req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) : undefined,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    search: req.query.search,
  };

  const pagination = {
    page: parseInt(req.query.page) || 1,
    limit: Math.min(parseInt(req.query.limit) || 20, 100),
  };

  const sorting = {
    sortBy: req.query.sort ? req.query.sort.replace('-', '') : 'createdAt',
    sortOrder: req.query.sort && req.query.sort.startsWith('-') ? -1 : 1,
  };

  Object.keys(filters).forEach((key) => {
    if (filters[key] === undefined || filters[key] === '') {
      delete filters[key];
    }
  });

  const result = await fileService.getFiles(filters, pagination, sorting);

  return sendSuccess(res, { data: result, message: 'Files retrieved successfully' });
});

// Get file by ID handler
const getFileById = catchAsync(async (req, res) => {
  const file = await fileService.getFileById(req.params.id);

  if (!file) {
    throw AppError.notFound('File not found');
  }

  return sendSuccess(res, { data: file, message: 'File retrieved successfully' });
});

// Download file handler
const downloadFile = catchAsync(async (req, res) => {
  const { id } = req.params;
  const inline = req.query.inline === '1';
  const useSignedUrl = req.query.signed === '1';

  if (useSignedUrl) {
    const { file, signedUrl } = await fileService.getSignedDownloadUrl(id);
    return res.redirect(signedUrl);
  }

  const { file, stream } = await fileService.getDownloadStream(id);

  res.set({
    'Content-Type': file.mimeType,
    'Content-Length': file.size,
    'Content-Disposition': inline ? `inline; filename="${file.originalName}"` : `attachment; filename="${file.originalName}"`,
  });

  stream.pipe(res);

  stream.on('error', (error) => {
    if (!res.headersSent) {
      throw AppError.internal('Download failed');
    }
  });
});

// Update file metadata handler
const updateFileMetadata = catchAsync(async (req, res) => {
  const requestId = uuidv4();
  const { id } = req.params;
  const updates = req.body;

  const updatedFile = await fileService.updateFileMetadata(id, req.user.id, updates, requestId);

  return sendSuccess(res, { data: { file: updatedFile, requestId }, message: 'File metadata updated successfully' });
});

// Replace file content handler
const replaceFileContent = catchAsync(async (req, res) => {
  const requestId = uuidv4();
  const { id } = req.params;

  if (!req.file) {
    throw AppError.badRequest('No file provided');
  }

  const updatedFile = await fileService.replaceFileContent(id, req.user.id, req.file, requestId);

  return sendSuccess(res, { data: { file: updatedFile, requestId }, message: 'File content replaced successfully' });
});

// Delete file handler
const deleteFile = catchAsync(async (req, res) => {
  const requestId = uuidv4();
  const { id } = req.params;
  const permanent = req.path.includes('/permanent');

  const result = await fileService.deleteFile(id, req.user.id, requestId, permanent);

  return sendSuccess(res, { data: permanent ? { requestId } : { file: result, requestId }, message: permanent ? 'File permanently deleted' : 'File deleted successfully' });
});

// Get file transactions handler
const getFileTransactions = catchAsync(async (req, res) => {
  const { id } = req.params;
  const transactions = await fileService.getFileTransactions(id, req.user.id);

  return sendSuccess(res, { data: transactions, message: 'File transactions retrieved successfully' });
});

module.exports = {
  uploadFiles,
  getFiles,
  getFileById,
  downloadFile,
  updateFileMetadata,
  replaceFileContent,
  deleteFile,
  getFileTransactions,
};
