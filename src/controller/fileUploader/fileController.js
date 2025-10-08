const { v4: uuidv4 } = require('uuid');
const FileService = require('../../services/FileService');
// const logger = require('../utils/logger');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
// Create a single instance of FileService
const fileService = new FileService();

// Upload files handler
const uploadFiles = async (req, res, next) => {
  const requestId = uuidv4();
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    const uploadedFiles = [];
    const metadata = {
      description: req.body.description || '',
      tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [],
      custom: req.body.custom ? JSON.parse(req.body.custom) : {}
    };

    for (const file of req.files) {
      const uploadedFile = await fileService.uploadFile(
        file,
        req.user.id,
        requestId,
        metadata
      );
      
      uploadedFiles.push({
        id: uploadedFile._id,
        originalName: uploadedFile.originalName,
        size: uploadedFile.size,
        mimeType: uploadedFile.mimeType,
        url: uploadedFile.publicUrl,
        metadata: uploadedFile.metadata
      });
    }

     return standardResponse(res, true,uploadedFiles, 'Files uploaded successfully');
    
  
  } catch (error) {

    next(error);
  }
};

// Get files handler
const getFiles = async (req, res, next) => {
  try {
    const filters = {
      uploader: req.query.uploader,
      mimeType: req.query.mimeType,
      tags: req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) : undefined,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      search: req.query.search
    };

    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 20, 100)
    };

    const sorting = {
      sortBy: req.query.sort ? req.query.sort.replace('-', '') : 'createdAt',
      sortOrder: req.query.sort && req.query.sort.startsWith('-') ? -1 : 1
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });

    const result = await fileService.getFiles(filters, pagination, sorting);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {

    next(error);
  }
};

// Get file by ID handler
const getFileById = async (req, res, next) => {
  try {
    const file = await fileService.getFileById(req.params.id);
    
    res.json({
      success: true,
      file
    });
  } catch (error) {

    next(error);
  }
};

// Download file handler
const downloadFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const inline = req.query.inline === '1';
    const useSignedUrl = req.query.signed === '1';

    if (useSignedUrl) {
      const { file, signedUrl } = await fileService.getSignedDownloadUrl(id);
      return res.redirect(signedUrl);
    }

    const { file, stream } = await fileService.getDownloadStream(id);
    
    // Set headers
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': file.size,
      'Content-Disposition': inline ? 
        `inline; filename="${file.originalName}"` : 
        `attachment; filename="${file.originalName}"`
    });

    // Pipe stream to response
    stream.pipe(res);
    
    stream.on('error', (error) => {
  
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Download failed' });
      }
    });

  } catch (error) {
 
    next(error);
  }
};

// Update file metadata handler
const updateFileMetadata = async (req, res, next) => {
  const requestId = uuidv4();
  
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedFile = await fileService.updateFileMetadata(
      id,
      req.user.id,
      updates,
      requestId
    );

    res.json({
      success: true,
      message: 'File metadata updated successfully',
      file: updatedFile,
      requestId
    });
  } catch (error) {

    next(error);
  }
};

// Replace file content handler
const replaceFileContent = async (req, res, next) => {
  const requestId = uuidv4();
  
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const updatedFile = await fileService.replaceFileContent(
      id,
      req.user.id,
      req.file,
      requestId
    );

    res.json({
      success: true,
      message: 'File content replaced successfully',
      file: updatedFile,
      requestId
    });
  } catch (error) {

    next(error);
  }
};

// Delete file handler
const deleteFile = async (req, res, next) => {
  const requestId = uuidv4();
  
  try {
    const { id } = req.params;
    const permanent = req.path.includes('/permanent');

    const result = await fileService.deleteFile(
      id,
      req.user.id,
      requestId,
      permanent
    );

    res.json({
      success: true,
      message: permanent ? 'File permanently deleted' : 'File deleted successfully',
      ...(permanent ? {} : { file: result }),
      requestId
    });
  } catch (error) {

    next(error);
  }
};

// Get file transactions handler
const getFileTransactions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const transactions = await fileService.getFileTransactions(id, req.user.id);

    res.json({
      success: true,
      transactions
    });
  } catch (error) {

    next(error);
  }
};

module.exports = {
  uploadFiles,
  getFiles,
  getFileById,
  downloadFile,
  updateFileMetadata,
  replaceFileContent,
  deleteFile,
  getFileTransactions
};