const { BlobServiceClient } = require('@azure/storage-blob');
const StorageAdapter = require('./StorageAdapter');

class AzureAdapter extends StorageAdapter {
  constructor() {
    super();
    this.blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_CONNECTION_STRING);
    this.containerName = process.env.AZURE_CONTAINER;
    this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
  }

  async uploadBuffer(buffer, destinationPath, options = {}) {
    try {
      const blobClient = this.containerClient.getBlockBlobClient(destinationPath);
      
      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: options.contentType || 'application/octet-stream'
        },
        // metadata: options.metadata || {}
      };

      const result = await blobClient.upload(buffer, buffer.length, uploadOptions);
      //logger.info(`File uploaded to Azure: ${destinationPath}`);
      
      return {
        success: true,
        path: destinationPath,
        etag: result.etag,
        location: blobClient.url
      };
    } catch (error) {
      //logger.error('Azure upload error:', error);
      throw new Error(`Azure upload failed: ${error.message}`);
    }
  }

  async uploadStream(stream, destinationPath, options = {}) {
    try {
      const blobClient = this.containerClient.getBlockBlobClient(destinationPath);
      
      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: options.contentType || 'application/octet-stream'
        },
        metadata: options.metadata || {}
      };

      const result = await blobClient.uploadStream(stream, undefined, undefined, uploadOptions);
      //logger.info(`Stream uploaded to Azure: ${destinationPath}`);
      
      return {
        success: true,
        path: destinationPath,
        etag: result.etag,
        location: blobClient.url
      };
    } catch (error) {
      //logger.error('Azure stream upload error:', error);
      throw new Error(`Azure stream upload failed: ${error.message}`);
    }
  }

  async getDownloadStream(destinationPath) {
    try {
      const blobClient = this.containerClient.getBlobClient(destinationPath);
      const response = await blobClient.download();
      
      return response.readableStreamBody;
    } catch (error) {
      //logger.error('Azure download stream error:', error);
      throw new Error(`Azure download failed: ${error.message}`);
    }
  }

  async getSignedUrl(destinationPath, options = {}) {
    try {
      const blobClient = this.containerClient.getBlobClient(destinationPath);
      const expiry = options.expiry || parseInt(process.env.SIGNED_URL_EXPIRY) || 3600;
      
      const expiresOn = new Date();
      expiresOn.setSeconds(expiresOn.getSeconds() + expiry);
      
      const signedUrl = await blobClient.generateSasUrl({
        permissions: 'r',
        expiresOn
      });
      
      return signedUrl;
    } catch (error) {
      //logger.error('Azure signed URL error:', error);
      throw new Error(`Azure signed URL generation failed: ${error.message}`);
    }
  }

  async delete(destinationPath) {
    try {
      const blobClient = this.containerClient.getBlobClient(destinationPath);
      const result = await blobClient.delete();
      
      //logger.info(`File deleted from Azure: ${destinationPath}`);
      return {
        success: true,
        path: destinationPath,
        deleteMarker: result.requestId
      };
    } catch (error) {
      //logger.error('Azure delete error:', error);
      throw new Error(`Azure delete failed: ${error.message}`);
    }
  }

  async copy(sourcePath, destPath) {
    try {
      const sourceBlobClient = this.containerClient.getBlobClient(sourcePath);
      const destBlobClient = this.containerClient.getBlobClient(destPath);
      
      const copyResponse = await destBlobClient.startCopyFromURL(sourceBlobClient.url);
      
      // Wait for copy to complete
      let copyStatus = copyResponse.copyStatus;
      while (copyStatus === 'pending') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const properties = await destBlobClient.getProperties();
        copyStatus = properties.copyStatus;
      }
      
      if (copyStatus !== 'success') {
        throw new Error(`Copy operation failed with status: ${copyStatus}`);
      }
      
      //logger.info(`File copied in Azure: ${sourcePath} -> ${destPath}`);
      return {
        success: true,
        sourcePath,
        destPath,
        copyId: copyResponse.copyId
      };
    } catch (error) {
      //logger.error('Azure copy error:', error);
      throw new Error(`Azure copy failed: ${error.message}`);
    }
  }

  async getMetadata(destinationPath) {
    try {
      const blobClient = this.containerClient.getBlobClient(destinationPath);
      const properties = await blobClient.getProperties();
      
      return {
        size: properties.contentLength,
        contentType: properties.contentType,
        lastModified: properties.lastModified,
        etag: properties.etag,
        metadata: properties.metadata
      };
    } catch (error) {
      //logger.error('Azure metadata error:', error);
      throw new Error(`Azure metadata retrieval failed: ${error.message}`);
    }
  }
}

module.exports = AzureAdapter;