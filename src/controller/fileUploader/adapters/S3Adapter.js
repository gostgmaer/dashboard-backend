const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const StorageAdapter = require('./StorageAdapter');

class S3Adapter extends StorageAdapter {
  constructor() {
    super();
    
    const s3Config = {
      region: process.env.S3_REGION,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      }
    };
    
    // For local development with MinIO
    if (process.env.S3_ENDPOINT) {
      s3Config.endpoint = process.env.S3_ENDPOINT;
      s3Config.forcePathStyle = true;
    }
    
    this.s3Client = new S3Client(s3Config);
    this.bucket = process.env.S3_BUCKET;
  }

  async uploadBuffer(buffer, destinationPath, options = {}) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath,
        Body: buffer,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: options.metadata || {}
      });

      const result = await this.s3Client.send(command);
      //logger.info(`File uploaded to S3: ${destinationPath}`);
      
      return {
        success: true,
        path: destinationPath,
        etag: result.ETag,
        location: `https://${this.bucket}.s3.${process.env.S3_REGION}.amazonaws.com/${destinationPath}`
      };
    } catch (error) {
      //logger.error('S3 upload error:', error);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  async uploadStream(stream, destinationPath, options = {}) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath,
        Body: stream,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: options.metadata || {}
      });

      const result = await this.s3Client.send(command);
      //logger.info(`Stream uploaded to S3: ${destinationPath}`);
      
      return {
        success: true,
        path: destinationPath,
        etag: result.ETag,
        location: `https://${this.bucket}.s3.${process.env.S3_REGION}.amazonaws.com/${destinationPath}`
      };
    } catch (error) {
      //logger.error('S3 stream upload error:', error);
      throw new Error(`S3 stream upload failed: ${error.message}`);
    }
  }

  async getDownloadStream(destinationPath) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath
      });

      const result = await this.s3Client.send(command);
      return result.Body;
    } catch (error) {
      //logger.error('S3 download stream error:', error);
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  async getSignedUrl(destinationPath, options = {}) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath
      });

      const expiry = options.expiry || parseInt(process.env.SIGNED_URL_EXPIRY) || 3600;
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiry });
      
      return signedUrl;
    } catch (error) {
      //logger.error('S3 signed URL error:', error);
      throw new Error(`S3 signed URL generation failed: ${error.message}`);
    }
  }

  async delete(destinationPath) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath
      });

      const result = await this.s3Client.send(command);
      //logger.info(`File deleted from S3: ${destinationPath}`);
      
      return {
        success: true,
        path: destinationPath,
        deleteMarker: result.DeleteMarker
      };
    } catch (error) {
      //logger.error('S3 delete error:', error);
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  async copy(sourcePath, destPath) {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourcePath}`,
        Key: destPath
      });

      const result = await this.s3Client.send(command);
      //logger.info(`File copied in S3: ${sourcePath} -> ${destPath}`);
      
      return {
        success: true,
        sourcePath,
        destPath,
        etag: result.CopyObjectResult.ETag
      };
    } catch (error) {
      //logger.error('S3 copy error:', error);
      throw new Error(`S3 copy failed: ${error.message}`);
    }
  }

  async getMetadata(destinationPath) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath
      });

      const result = await this.s3Client.send(command);
      
      return {
        size: result.ContentLength,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata
      };
    } catch (error) {
      //logger.error('S3 metadata error:', error);
      throw new Error(`S3 metadata retrieval failed: ${error.message}`);
    }
  }
}

module.exports = S3Adapter;