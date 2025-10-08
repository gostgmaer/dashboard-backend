const S3Adapter = require("./S3Adapter");
const GCSAdapter = require("./GCSAdapter");
const AzureAdapter = require("./AzureAdapter");
const R2Adapter = require("./R2Adapter");


class AdapterFactory {
  static createAdapter(provider = null) {
    const storageProvider = provider || process.env.STORAGE_PROVIDER;

    if (!storageProvider) {
      throw new Error("STORAGE_PROVIDER environment variable is required");
    }

    switch (storageProvider.toLowerCase()) {
      case "s3":
        if (
          !process.env.S3_ACCESS_KEY_ID ||
          !process.env.S3_SECRET_ACCESS_KEY ||
          !process.env.S3_BUCKET
        ) {
          throw new Error("Missing required S3 environment variables");
        }
        //logger.info("Initializing S3 storage adapter");
        return new S3Adapter();

      case "gcs":
        if (!process.env.GCS_BUCKET) {
          throw new Error("Missing required GCS environment variables");
        }
        //logger.info("Initializing Google Cloud Storage adapter");
        return new GCSAdapter();

      case "azure":
        if (
          !process.env.AZURE_CONNECTION_STRING ||
          !process.env.AZURE_CONTAINER
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
