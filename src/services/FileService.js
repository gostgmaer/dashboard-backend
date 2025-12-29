const { v4: uuidv4 } = require('uuid');
const path = require('path');
const mime = require('mime-types');
const File = require('../models/File');
const FileTransaction = require('../models/FileTransaction');
// const AdapterFactory = require('../adapters/AdapterFactory');
// const logger = require('../utils/logger');
const AdapterFactory = require('../controller/fileUploader/adapters/AdapterFactory');

class FileService {
  constructor() {
    this.storageAdapter = AdapterFactory.createAdapter();
  }

 async generateStorageKey(originalName, uploaderId) {
    const timestamp = Date.now();
    const uuid = await generateUUID();;
    const extension = path.extname(originalName);
    const sanitizedName = path.basename(originalName, extension)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50);
    
    return `files/${uploaderId}/${timestamp}-${uuid}-${sanitizedName}${extension}`;
  }

  async logTransaction(fileId, operation, performedBy, requestId, payload = {}) {
    try {
      const transaction = new FileTransaction({
        fileId,
        operation,
        performedBy,
        requestId,
        payload,
        status: 'pending'
      });
      
      await transaction.save();
      return transaction;
    } catch (error) {
      //logger.error('Transaction logging error:', error);
      throw error;
    }
  }

  async updateTransaction(transactionId, status, providerResponse = null, error = null) {
    try {
      const update = { status };
      if (providerResponse) update.providerResponse = providerResponse;
      if (error) update.error = error;
      
      await FileTransaction.findByIdAndUpdate(transactionId, update);
    } catch (error) {
      //logger.error('Transaction update error:', error);
    }
  }

  async uploadFile(fileData, uploaderId, requestId, metadata = {}) {
    const transaction = await this.logTransaction(
      null,
      'upload',
      uploaderId,
      requestId,
      { originalName: fileData.originalname, size: fileData.size, mimeType: fileData.mimetype }
    );

    try {
      const storageKey = this.generateStorageKey(fileData.originalname, uploaderId);
      const extension = path.extname(fileData.originalname).toLowerCase();
      
      // Upload to storage
      const uploadResult = await this.storageAdapter.uploadBuffer(
        fileData.buffer,
        storageKey,
        {
          contentType: fileData.mimetype,
          metadata: metadata
        }
      );

      // Create file record
      const file = new File({
        originalName: fileData.originalname,
        storageKey,
        size: fileData.size,
        mimeType: fileData.mimetype,
        extension,
        uploader: uploaderId,
        publicUrl: uploadResult.location,
        metadata: {
          description: metadata.description || '',
          tags: metadata.tags || [],
          custom: metadata.custom || {}
        }
      });

      await file.save();

      // Update transaction with file ID and success
      await this.updateTransaction(transaction._id, 'success', uploadResult);
      transaction.fileId = file._id;
      await transaction.save();

      //logger.info(`File uploaded successfully: ${file._id}`);
      return file;
    } catch (error) {
      await this.updateTransaction(transaction._id, 'failed', null, error.message);
      //logger.error('File upload error:', error);
      throw error;
    }
  }

  async getFileById(fileId, userId = null) {
    try {
      const query = { _id: fileId, status: 'active' };
      if (userId) query.uploader = userId;

      const file = await File.findOne(query).populate('uploader', 'email name');
      if (!file) {
        throw new Error('File not found');
      }

      return file;
    } catch (error) {
      //logger.error('Get file error:', error);
      throw error;
    }
  }

  async getFiles(filters = {}, pagination = {}, sorting = {}) {
    try {
      const { page = 1, limit = 20 } = pagination;
      const { sortBy = 'createdAt', sortOrder = -1 } = sorting;

      const query = { status: 'active' };
      
      // Apply filters
      if (filters.uploader) query.uploader = filters.uploader;
      if (filters.mimeType) query.mimeType = filters.mimeType;
      if (filters.tags && filters.tags.length > 0) {
        query['metadata.tags'] = { $in: filters.tags };
      }
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }
      if (filters.search) {
        query.$or = [
          { originalName: { $regex: filters.search, $options: 'i' } },
          { 'metadata.description': { $regex: filters.search, $options: 'i' } }
        ];
      }

      const sort = { [sortBy]: sortOrder };
      const skip = (page - 1) * limit;

      const [files, total] = await Promise.all([
        File.find(query)
          .populate('uploader', 'email name')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        File.countDocuments(query)
      ]);

      return {
        files,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      //logger.error('Get files error:', error);
      throw error;
    }
  }

  async getDownloadStream(fileId, userId = null) {
    try {
      const file = await this.getFileById(fileId, userId);
      const stream = await this.storageAdapter.getDownloadStream(file.storageKey);
      return { file, stream };
    } catch (error) {
      //logger.error('Get download stream error:', error);
      throw error;
    }
  }

  async getSignedDownloadUrl(fileId, userId = null, options = {}) {
    try {
      const file = await this.getFileById(fileId, userId);
      const signedUrl = await this.storageAdapter.getSignedUrl(file.storageKey, options);
      return { file, signedUrl };
    } catch (error) {
      //logger.error('Get signed URL error:', error);
      throw error;
    }
  }

  async updateFileMetadata(fileId, userId, updates, requestId) {
    const transaction = await this.logTransaction(
      fileId,
      'update_metadata',
      userId,
      requestId,
      updates
    );

    try {
      const file = await this.getFileById(fileId, userId);
      
      const allowedUpdates = ['originalName', 'metadata'];
      const updateData = {};
      
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          if (key === 'metadata') {
            updateData['metadata.description'] = updates.metadata.description;
            updateData['metadata.tags'] = updates.metadata.tags;
            if (updates.metadata.custom) {
              updateData['metadata.custom'] = updates.metadata.custom;
            }
          } else {
            updateData[key] = updates[key];
          }
        }
      });

      const updatedFile = await File.findByIdAndUpdate(
        fileId,
        updateData,
        { new: true, runValidators: true }
      ).populate('uploader', 'email name');

      await this.updateTransaction(transaction._id, 'success');
      //logger.info(`File metadata updated: ${fileId}`);
      
      return updatedFile;
    } catch (error) {
      await this.updateTransaction(transaction._id, 'failed', null, error.message);
      //logger.error('Update file metadata error:', error);
      throw error;
    }
  }

  async replaceFileContent(fileId, userId, newFileData, requestId) {
    const transaction = await this.logTransaction(
      fileId,
      'replace',
      userId,
      requestId,
      { originalName: newFileData.originalname, size: newFileData.size, mimeType: newFileData.mimetype }
    );

    try {
      const file = await this.getFileById(fileId, userId);
      
      // Generate new storage key for the new version
      const newStorageKey = this.generateStorageKey(newFileData.originalname, userId);
      const newExtension = path.extname(newFileData.originalname).toLowerCase();
      
      // Upload new file version
      const uploadResult = await this.storageAdapter.uploadBuffer(
        newFileData.buffer,
        newStorageKey,
        { contentType: newFileData.mimetype }
      );

      // Create version entry for current file
      const currentVersion = {
        versionId: file.versions.length + 1,
        storageKey: file.storageKey,
        size: file.size,
        mimeType: file.mimeType,
        createdAt: file.updatedAt
      };

      // Update file with new content
      const updatedFile = await File.findByIdAndUpdate(
        fileId,
        {
          $set: {
            originalName: newFileData.originalname,
            storageKey: newStorageKey,
            size: newFileData.size,
            mimeType: newFileData.mimetype,
            extension: newExtension,
            publicUrl: uploadResult.location
          },
          $push: {
            versions: currentVersion
          }
        },
        { new: true, runValidators: true }
      ).populate('uploader', 'email name');

      await this.updateTransaction(transaction._id, 'success', uploadResult);
      //logger.info(`File content replaced: ${fileId}`);
      
      return updatedFile;
    } catch (error) {
      await this.updateTransaction(transaction._id, 'failed', null, error.message);
      //logger.error('Replace file content error:', error);
      throw error;
    }
  }

  async deleteFile(fileId, userId, requestId, permanent = false) {
    const operation = permanent ? 'permanent_delete' : 'delete';
    const transaction = await this.logTransaction(fileId, operation, userId, requestId);

    try {
      const file = await this.getFileById(fileId, userId);

      if (permanent) {
        // Delete from storage
        await this.storageAdapter.delete(file.storageKey);
        
        // Delete all versions from storage
        for (const version of file.versions) {
          try {
            await this.storageAdapter.delete(version.storageKey);
          } catch (error) {
            //logger.warn(`Failed to delete version ${version.versionId}:`, error.message);
          }
        }

        // Delete from database
        await File.findByIdAndDelete(fileId);
        
        await this.updateTransaction(transaction._id, 'success');
        //logger.info(`File permanently deleted: ${fileId}`);
        
        return { message: 'File permanently deleted' };
      } else {
        // Soft delete
        const deletedFile = await File.findByIdAndUpdate(
          fileId,
          { status: 'deleted' },
          { new: true }
        ).populate('uploader', 'email name');

        await this.updateTransaction(transaction._id, 'success');
        //logger.info(`File soft deleted: ${fileId}`);
        
        return deletedFile;
      }
    } catch (error) {
      await this.updateTransaction(transaction._id, 'failed', null, error.message);
      //logger.error('Delete file error:', error);
      throw error;
    }
  }

  async getFileTransactions(fileId, userId = null) {
    try {
      const file = await this.getFileById(fileId, userId);
      
      const transactions = await FileTransaction.find({ fileId })
        .populate('performedBy', 'email name')
        .sort({ createdAt: -1 });

      return transactions;
    } catch (error) {
      //logger.error('Get file transactions error:', error);
      throw error;
    }
  }
}

module.exports = FileService;