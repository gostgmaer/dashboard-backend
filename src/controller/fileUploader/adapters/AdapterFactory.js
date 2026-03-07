const S3Adapter = require("./S3Adapter");
const GCSAdapter = require("./GCSAdapter");
const AzureAdapter = require("./AzureAdapter");
const R2Adapter = require("./R2Adapter");
const { storage } = require('../../../config/setting');


class AdapterFactory {
  static createAdapter(provider = null) {
    const storageProvider = provider || storage.type;

    if (!storageProvider) {
      throw new Error("STORAGE_PROVIDER environment variable is required");
    }

    switch (storageProvider.toLowerCase()) {
      case "s3":
        if (
          !storage.s3.accessKey ||
          !storage.s3.secretKey ||
          !storage.s3.bucket
        ) {
          throw new Error("Missing required S3 environment variables");
        }
        //logger.info("Initializing S3 storage adapter");
        return new S3Adapter();

      case "gcs":
        if (!storage.gcs.bucket) {
          throw new Error("Missing required GCS environment variables");
        }
        //logger.info("Initializing Google Cloud Storage adapter");
        return new GCSAdapter();

      case "azure":
        if (
          !storage.azure.connectionString ||
          !storage.azure.container
        ) {
          throw new Error("Missing required Azure environment variables");
        }
        //logger.info("Initializing Azure Blob Storage adapter");
        return new AzureAdapter();

      case "r2":
        //logger.info("Initializing Cloudflare R2 adapter");
        const r2 = new R2Adapter();
        return r2;

      default:
        throw new Error(
          `Unsupported storage provider: ${storageProvider}. Supported providers: s3, gcs, azure, r2`
        );
    }
  }
}

module.exports = AdapterFactory;
