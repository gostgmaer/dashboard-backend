
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const StorageAdapter = require("./StorageAdapter");

class R2Adapter extends StorageAdapter {
  constructor() {
    super();

    // Validate required environment variables
    const requiredVars = [
      "R2_ENDPOINT",
      "R2_ACCESS_KEY",
      "R2_SECRET",
      "R2_BUCKET",
    ];

    const missing = requiredVars.filter((v) => !process.env[v]);
    if (missing.length) {
      throw new Error(
        `Missing required R2 environment variables: ${missing.join(", ")}`
      );
    }

    // Ensure endpoint includes https://
    const endpoint = process.env.R2_ENDPOINT.startsWith("http")
      ? process.env.R2_ENDPOINT
      : `https://${process.env.R2_ENDPOINT}`;

    this.s3Client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET,
      },
      forcePathStyle: true,
    });

    this.bucket = process.env.R2_BUCKET;
  }

  // --- Utility function to ensure metadata values are strings ---
  sanitizeMetadata(metadata = {}) {
    const safeMeta = {};
    for (const [key, value] of Object.entries(metadata)) {
      safeMeta[key] =
        value === undefined || value === null
          ? ""
          : typeof value === "string"
          ? value
          : String(value);
    }
    return safeMeta;
  }

  // --- Upload buffer ---
  async uploadBuffer(buffer, destinationPath, options = {}) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath,
        Body: buffer,
        ContentType: options.contentType || "application/octet-stream",
        Metadata: this.sanitizeMetadata(options.metadata),
        ACL: "public-read",
      });

      const result = await this.s3Client.send(command);
      //logger.info(`✅ File uploaded to R2: ${destinationPath}`);
  const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${this.bucket}/${destinationPath}`;

      return {
        success: true,
        path: destinationPath,
        etag: result.ETag,
        location: publicUrl ,
      };
    } catch (error) {
      //logger.error("❌ R2 upload error:", error);
      throw new Error(`R2 upload failed: ${error.message}`);
    }
  }

  // --- Upload stream ---
  async uploadStream(stream, destinationPath, options = {}) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath,
        Body: stream,
        ContentType: options.contentType || "application/octet-stream",
        Metadata: this.sanitizeMetadata(options.metadata),
      });

      const result = await this.s3Client.send(command);
      //logger.info(`✅ Stream uploaded to R2: ${destinationPath}`);

      return {
        success: true,
        path: destinationPath,
        etag: result.ETag,
        location: `${process.env.R2_ENDPOINT}/${this.bucket}/${destinationPath}`,
      };
    } catch (error) {
      //logger.error("❌ R2 stream upload error:", error);
      throw new Error(`R2 stream upload failed: ${error.message}`);
    }
  }

  // --- Download stream ---
  async getDownloadStream(destinationPath) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath,
      });

      const result = await this.s3Client.send(command);
      return result.Body;
    } catch (error) {
      //logger.error("❌ R2 download stream error:", error);
      throw new Error(`R2 download failed: ${error.message}`);
    }
  }

  // --- Signed URL ---
  async getSignedUrl(destinationPath, options = {}) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath,
      });

      const expiry =
        options.expiry || parseInt(process.env.SIGNED_URL_EXPIRY) || 3600;
      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiry,
      });

      return signedUrl;
    } catch (error) {
      //logger.error("❌ R2 signed URL error:", error);
      throw new Error(`R2 signed URL generation failed: ${error.message}`);
    }
  }

  // --- Delete object ---
  async delete(destinationPath) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath,
      });

      const result = await this.s3Client.send(command);
      //logger.info(`🗑️ File deleted from R2: ${destinationPath}`);

      return {
        success: true,
        path: destinationPath,
        deleteMarker: result.DeleteMarker,
      };
    } catch (error) {
      //logger.error("❌ R2 delete error:", error);
      throw new Error(`R2 delete failed: ${error.message}`);
    }
  }

  // --- Copy object ---
  async copy(sourcePath, destPath) {
    try {
      const command = new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourcePath}`,
        Key: destPath,
      });

      const result = await this.s3Client.send(command);
      //logger.info(`📄 File copied in R2: ${sourcePath} -> ${destPath}`);

      return {
        success: true,
        sourcePath,
        destPath,
        etag: result.CopyObjectResult?.ETag,
      };
    } catch (error) {
      //logger.error("❌ R2 copy error:", error);
      throw new Error(`R2 copy failed: ${error.message}`);
    }
  }

  // --- Metadata info ---
  async getMetadata(destinationPath) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: destinationPath,
      });

      const result = await this.s3Client.send(command);

      return {
        size: result.ContentLength,
        contentType: result.ContentType,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata,
      };
    } catch (error) {
      //logger.error("❌ R2 metadata error:", error);
      throw new Error(`R2 metadata retrieval failed: ${error.message}`);
    }
  }
}

module.exports = R2Adapter;
