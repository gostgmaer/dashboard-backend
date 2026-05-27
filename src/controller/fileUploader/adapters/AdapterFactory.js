const S3Adapter = require('./S3Adapter');
const GCSAdapter = require('./GCSAdapter');
const AzureAdapter = require('./AzureAdapter');
const R2Adapter = require('./R2Adapter');
const LocalAdapter = require('./LocalAdapter');
const { storage } = require('../../../config/setting');

class AdapterFactory {
  /**
   * Create and return the appropriate storage adapter.
   *
   * @param {string|null} provider - Override the configured storage type.
   * @returns {StorageAdapter}
   */
  static createAdapter(provider = null) {
    // Read from Proxy-backed config (real-time from DB settings)
    const storageProvider = (provider || storage.type || 'local').toLowerCase();

    switch (storageProvider) {
      case 'local':
        return new LocalAdapter();

      case 's3':
        if (!storage.s3.accessKey || !storage.s3.secretKey || !storage.s3.bucket) {
          console.warn('⚠️  AdapterFactory: S3 credentials incomplete — check DB settings (storage.s3.*)');
        }
        return new S3Adapter();

      case 'gcs':
        if (!storage.gcs.bucket) {
          console.warn('⚠️  AdapterFactory: GCS bucket missing — check DB settings (storage.gcs.bucket)');
        }
        return new GCSAdapter();

      case 'azure':
        if (!storage.azure.connectionString || !storage.azure.container) {
          console.warn('⚠️  AdapterFactory: Azure credentials incomplete — check DB settings (storage.azure.*)');
        }
        return new AzureAdapter();

      case 'r2':
        return new R2Adapter();

      default:
        console.warn(
          `⚠️  AdapterFactory: Unknown storage provider "${storageProvider}", falling back to local.`
        );
        return new LocalAdapter();
    }
  }
}

module.exports = AdapterFactory;
