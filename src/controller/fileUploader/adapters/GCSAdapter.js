const { Storage } = require('@google-cloud/storage');
const StorageAdapter = require('./StorageAdapter');

class GCSAdapter extends StorageAdapter {
  constructor() {
    super();
    const storageOptions = {
      projectId: process.env.GCS_PROJECT_ID
    };
    
    if (process.env.GCS_KEYFILE) {
      storageOptions.keyFilename = process.env.GCS_KEYFILE;
    }
    
    this.storage = new Storage(storageOptions);
    this.bucket = this.storage.bucket(process.env.GCS_BUCKET);
  }

  async uploadBuffer(buffer, destinationPath, options = {}) {
    try {
      const file = this.bucket.file(destinationPath);
      
      const stream = file.createWriteStream({
        metadata: {
          contentType: options.contentType || 'application/octet-stream',
          metadata: options.metadata || {}
        }
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          //logger.error('GCS upload error:', error);
          reject(new Error(`GCS upload failed: ${error.message}`));
        });

        stream.on('finish', async () => {
          //logger.info(`File uploaded to GCS: ${destinationPath}`);
          resolve({
            success: true,
            path: destinationPath,
            location: `gs://${process.env.GCS_BUCKET}/${destinationPath}`
          });
        });

        stream.end(buffer);
      });
    } catch (error) {
      //logger.error('GCS upload error:', error);
      throw new Error(`GCS upload failed: ${error.message}`);
    }
  }

  async uploadStream(stream, destinationPath, options = {}) {
    try {
      const file = this.bucket.file(destinationPath);
      
      const writeStream = file.createWriteStream({
        metadata: {
          contentType: options.contentType || 'application/octet-stream',
          metadata: options.metadata || {}
        }
      });

      return new Promise((resolve, reject) => {
        writeStream.on('error', (error) => {
          //logger.error('GCS stream upload error:', error);
          reject(new Error(`GCS stream upload failed: ${error.message}`));
        });

        writeStream.on('finish', async () => {
          //logger.info(`Stream uploaded to GCS: ${destinationPath}`);
          resolve({
            success: true,
            path: destinationPath,
            location: `gs://${process.env.GCS_BUCKET}/${destinationPath}`
          });
        });

        stream.pipe(writeStream);
      });
    } catch (error) {
      //logger.error('GCS stream upload error:', error);
      throw new Error(`GCS stream upload failed: ${error.message}`);
    }
  }

  async getDownloadStream(destinationPath) {
    try {
      const file = this.bucket.file(destinationPath);
      const readStream = file.createReadStream();
      
      return readStream;
    } catch (error) {
      //logger.error('GCS download stream error:', error);
      throw new Error(`GCS download failed: ${error.message}`);
    }
  }

  async getSignedUrl(destinationPath, options = {}) {
    try {
      const file = this.bucket.file(destinationPath);
      const expiry = options.expiry || parseInt(process.env.SIGNED_URL_EXPIRY) || 3600;
      
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + (expiry * 1000)
      });
      
      return signedUrl;
    } catch (error) {
      //logger.error('GCS signed URL error:', error);
      throw new Error(`GCS signed URL generation failed: ${error.message}`);
    }
  }

  async delete(destinationPath) {
    try {
      const file = this.bucket.file(destinationPath);
      await file.delete();
      
      //logger.info(`File deleted from GCS: ${destinationPath}`);
      return {
        success: true,
        path: destinationPath
      };
    } catch (error) {
      //logger.error('GCS delete error:', error);
      throw new Error(`GCS delete failed: ${error.message}`);
    }
  }

  async copy(sourcePath, destPath) {
    try {
      const sourceFile = this.bucket.file(sourcePath);
      const destFile = this.bucket.file(destPath);
      
      await sourceFile.copy(destFile);
      
      //logger.info(`File copied in GCS: ${sourcePath} -> ${destPath}`);
      return {
        success: true,
        sourcePath,
        destPath
      };
    } catch (error) {
      //logger.error('GCS copy error:', error);
      throw new Error(`GCS copy failed: ${error.message}`);
    }
  }

  async getMetadata(destinationPath) {
    try {
      const file = this.bucket.file(destinationPath);
      const [metadata] = await file.getMetadata();
      
      return {
        size: parseInt(metadata.size),
        contentType: metadata.contentType,
        lastModified: new Date(metadata.updated),
        etag: metadata.etag,
        metadata: metadata.metadata || {}
      };
    } catch (error) {
      //logger.error('GCS metadata error:', error);
      throw new Error(`GCS metadata retrieval failed: ${error.message}`);
    }
  }
}

module.exports = GCSAdapter;