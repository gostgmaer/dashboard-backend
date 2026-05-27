const fs = require('fs');
const path = require('path');
const StorageAdapter = require('./StorageAdapter');
const { storage } = require('../../../config/setting');

/**
 * LocalAdapter — stores files on the local filesystem.
 * Useful for development and self-hosted setups.
 */
class LocalAdapter extends StorageAdapter {
  constructor() {
    super();
    // Resolve base directory relative to the project root
    this.baseDir = path.resolve(process.cwd(), storage.localPath || 'uploads');
    this._ensureDir(this.baseDir);
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Upload a buffer to the local filesystem.
   */
  async uploadBuffer(buffer, destinationPath, options = {}) {
    const filePath = path.join(this.baseDir, destinationPath);
    this._ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, buffer);

    const relativePath = destinationPath.replace(/\\/g, '/');
    const location = `/uploads/${relativePath}`;

    return {
      location,
      key: destinationPath,
      provider: 'local',
    };
  }

  /**
   * Upload a readable stream to the local filesystem.
   */
  async uploadStream(stream, destinationPath, options = {}) {
    const filePath = path.join(this.baseDir, destinationPath);
    this._ensureDir(path.dirname(filePath));

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      stream.pipe(writeStream);
      writeStream.on('finish', () => {
        const location = `/uploads/${destinationPath.replace(/\\/g, '/')}`;
        resolve({ location, key: destinationPath, provider: 'local' });
      });
      writeStream.on('error', reject);
    });
  }

  /**
   * Return a readable stream for a stored file.
   */
  async getDownloadStream(destinationPath) {
    const filePath = path.join(this.baseDir, destinationPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${destinationPath}`);
    }
    return fs.createReadStream(filePath);
  }

  /**
   * Generate a "signed URL" — for local storage this is just the static path.
   */
  async getSignedUrl(destinationPath, options = {}) {
    return `/uploads/${destinationPath.replace(/\\/g, '/')}`;
  }

  /**
   * Delete a file from the local filesystem.
   */
  async delete(destinationPath) {
    const filePath = path.join(this.baseDir, destinationPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { deleted: true, key: destinationPath };
  }

  /**
   * Copy a file within the local filesystem.
   */
  async copy(sourcePath, destPath) {
    const src = path.join(this.baseDir, sourcePath);
    const dest = path.join(this.baseDir, destPath);
    this._ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    return { key: destPath, provider: 'local' };
  }

  /**
   * Get metadata for a stored file.
   */
  async getMetadata(destinationPath) {
    const filePath = path.join(this.baseDir, destinationPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${destinationPath}`);
    }
    const stat = fs.statSync(filePath);
    return {
      size: stat.size,
      lastModified: stat.mtime,
      key: destinationPath,
    };
  }
}

module.exports = LocalAdapter;
