class StorageAdapter {
  constructor() {
    if (this.constructor === StorageAdapter) {
      throw new Error('StorageAdapter is an abstract class');
    }
  }

  /**
   * Upload a buffer to storage
   * @param {Buffer} buffer - File buffer
   * @param {string} destinationPath - Storage path/key
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Upload result
   */
  async uploadBuffer(buffer, destinationPath, options = {}) {
    throw new Error('uploadBuffer method must be implemented');
  }

  /**
   * Upload a stream to storage
   * @param {Stream} stream - File stream
   * @param {string} destinationPath - Storage path/key
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Upload result
   */
  async uploadStream(stream, destinationPath, options = {}) {
    throw new Error('uploadStream method must be implemented');
  }

  /**
   * Get download stream from storage
   * @param {string} destinationPath - Storage path/key
   * @returns {Promise<Stream>} Download stream
   */
  async getDownloadStream(destinationPath) {
    throw new Error('getDownloadStream method must be implemented');
  }

  /**
   * Generate signed URL for file access
   * @param {string} destinationPath - Storage path/key
   * @param {Object} options - URL options (expiry, etc.)
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(destinationPath, options = {}) {
    throw new Error('getSignedUrl method must be implemented');
  }

  /**
   * Delete file from storage
   * @param {string} destinationPath - Storage path/key
   * @returns {Promise<Object>} Delete result
   */
  async delete(destinationPath) {
    throw new Error('delete method must be implemented');
  }

  /**
   * Copy file within storage
   * @param {string} sourcePath - Source path/key
   * @param {string} destPath - Destination path/key
   * @returns {Promise<Object>} Copy result
   */
  async copy(sourcePath, destPath) {
    throw new Error('copy method must be implemented');
  }

  /**
   * Get file metadata from storage
   * @param {string} destinationPath - Storage path/key
   * @returns {Promise<Object>} File metadata
   */
  async getMetadata(destinationPath) {
    throw new Error('getMetadata method must be implemented');
  }
}

module.exports = StorageAdapter;