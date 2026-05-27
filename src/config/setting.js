require('dotenv').config();

/**
 * Centralized Configuration Module
 * =================================
 * All environment variables should be imported from this file.
 * DO NOT use process.env directly in other files.
 *
 * ARCHITECTURE:
 * - Static sections (app, database, jwt, session) — plain objects from process.env.
 *   These are needed BEFORE the database connects.
 * - Dynamic sections (email, payment, storage, client, security, services, otp,
 *   business, features, notifications) — JavaScript Proxies that read from the
 *   in-memory DB settings cache on every property access, falling back to process.env.
 *   This means settings updated via the admin dashboard take effect immediately
 *   without a server restart.
 *
 * REAL-TIME BEHAVIOR:
 *   const { email } = require('./config/setting');
 *   email.host  // → resolves from DB cache → env fallback → default
 *               //   Re-evaluated on EVERY access (real-time).
 *
 *   const { emailHost } = require('./config/setting');
 *   emailHost   // → evaluated ONCE at destructure-time via getter.
 *               //   NOT real-time. Use section objects for live values.
 */

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  return value === 'true' || value === '1' || value === true;
};

const parseInt = (value, defaultValue) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

// ============================================================================
// LIVE PROXY INFRASTRUCTURE
// ============================================================================

let _settingModel = null;

/**
 * Lazily require the Setting model and return the cached settings object.
 * Returns null if the model isn't loaded yet or cache hasn't been warmed.
 */
function getCachedSettings() {
  if (!_settingModel) {
    try {
      _settingModel = require('../models/Setting');
    } catch {
      return null;
    }
  }
  return _settingModel.getCachedSettings();
}

/**
 * Resolve a dot-notation path on a nested object.
 * e.g. resolvePath({ a: { b: 1 } }, 'a.b') => 1
 */
function resolvePath(obj, pathStr) {
  if (!obj || !pathStr) return undefined;
  return pathStr.split('.').reduce(
    (cur, key) => (cur && typeof cur === 'object') ? cur[key] : undefined,
    obj
  );
}

/**
 * Create a live Proxy that reads from DB settings cache first,
 * falling back to the provided env-based defaults.
 *
 * @param {string} sectionPath — dot-notation path in the inflated settings cache
 * @param {object} envDefaults — fallback defaults built from process.env
 * @returns {Proxy} — a transparent Proxy that resolves properties on each access
 */
function createLiveProxy(sectionPath, envDefaults) {
  function resolveSection() {
    const cached = getCachedSettings();
    return cached ? resolvePath(cached, sectionPath) : null;
  }

  function resolveProperty(section, target, prop) {
    // 1. Check DB cache first
    if (section && typeof section === 'object' && prop in section) {
      const val = section[prop];
      // Nested objects get their own sub-proxy for deep real-time access
      if (val !== null && val !== undefined && typeof val === 'object'
          && !Array.isArray(val) && !(val instanceof Date)) {
        return createLiveProxy(`${sectionPath}.${prop}`, target[prop] || {});
      }
      return val;
    }
    // 2. Fallback to env-based default
    const envVal = target[prop];
    if (envVal !== null && envVal !== undefined && typeof envVal === 'object'
        && !Array.isArray(envVal) && !(envVal instanceof Date)) {
      return createLiveProxy(`${sectionPath}.${prop}`, envVal);
    }
    return envVal;
  }

  return new Proxy(envDefaults, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
      // Allow JSON.stringify / util.inspect to work
      if (prop === 'toJSON') {
        return () => {
          const section = resolveSection();
          return { ...target, ...(section && typeof section === 'object' ? section : {}) };
        };
      }
      const section = resolveSection();
      return resolveProperty(section, target, prop);
    },
    has(target, prop) {
      if (typeof prop === 'symbol') return Reflect.has(target, prop);
      const section = resolveSection();
      return (section && typeof section === 'object' && prop in section) || prop in target;
    },
    ownKeys(target) {
      const section = resolveSection();
      const keys = new Set(Object.keys(target));
      if (section && typeof section === 'object') {
        Object.keys(section).forEach(k => keys.add(k));
      }
      return [...keys];
    },
    getOwnPropertyDescriptor(target, prop) {
      const section = resolveSection();
      if ((section && typeof section === 'object' && prop in section) || prop in target) {
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: resolveProperty(section, target, prop),
        };
      }
      return undefined;
    },
  });
}

// ============================================================================
// STATIC SECTIONS (needed before DB connects — plain objects)
// ============================================================================

const app = {
  name: process.env.APPLICATION_NAME || 'Dashboard Application',
  port: parseInt(process.env.PORT, 3500),
  environment: process.env.NODE_ENV || 'development',
  url: process.env.APPURL || process.env.APP_URL || 'http://localhost:3500',
  siteUrl: process.env.SITE_URL || 'http://localhost:3000',
  baseApiUrl: process.env.BASE_API_URL || '',
  authServiceUrl: process.env.AUTH_SERVICE_URL || process.env.APPURL || process.env.APP_URL || 'http://localhost:3500',
};

const rawDbTls = process.env.DB_TLS ?? process.env.DB_SSL;
const rawDbTlsAllowInvalidCerts = process.env.DB_TLS_ALLOW_INVALID_CERTS;
const rawDbSslValidate = process.env.DB_SSL_VALIDATE;

const database = {
  url: process.env.DATABASE_URL || process.env.MONGODB_URI,
  collection: process.env.COLLECTION || 'main',
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE, 20),
  minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE, 2),
  maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME, 30000),
  serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT, 5000),
  socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT, 45000),
  connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT, 10000),
  heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT, 10000),
  tls: rawDbTls !== undefined ? parseBoolean(rawDbTls, false) : undefined,
  enforceTls: parseBoolean(process.env.DB_ENFORCE_TLS, true),
  tlsMinVersion: process.env.DB_TLS_MIN_VERSION || 'TLSv1.2',
  tlsAllowInvalidCerts:
    rawDbTlsAllowInvalidCerts !== undefined ? parseBoolean(rawDbTlsAllowInvalidCerts, false)
    : rawDbSslValidate !== undefined ? !parseBoolean(rawDbSslValidate, true)
    : undefined,
};

const jwt = {
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  idSecret: process.env.JWT_ID_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  idExpiry: process.env.JWT_ID_EXPIRY || '30d',
  algorithm: process.env.JWT_ALGORITHM || 'HS256',
  issuer: process.env.JWT_ISSUER || 'your-app-name',
  audience: process.env.JWT_AUDIENCE || 'your-app-users',
};

const session = {
  secret: process.env.SESSION_SECRET,
};

// ============================================================================
// DYNAMIC SECTIONS (live from DB settings cache, env fallback)
// ============================================================================

const security = createLiveProxy('security', {
  requireDeviceVerification: parseBoolean(process.env.REQUIRE_DEVICE_VERIFICATION, false),
  enableSuspiciousLoginDetection: parseBoolean(process.env.ENABLE_SUSPICIOUS_LOGIN_DETECTION, false),
  enableIpWhitelist: parseBoolean(process.env.ENABLE_IP_WHITELIST, false),
  allowedIPs: process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) : [],
  allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : [],
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 5),
  lockoutTimeMinutes: parseInt(process.env.LOCKOUT_TIME_MINUTES, 30),
  sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES, 120),
  maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS, 3),
});

const client = createLiveProxy('client', {
  url: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000',
  loginPage: process.env.CLIENT_LOGIN_PAGE || '/login',
  resetPasswordUrl: process.env.CLIENT_RESET_PASSWORD_URL || '/reset-password',
  emailVerifyUrl: process.env.CLIENT_EMAIL_VERIFY_URL || '/verify-email',
});

const email = createLiveProxy('email', {
  // Basic settings
  name: process.env.EMAIL_NAME || 'No Reply',
  sender: process.env.FROM_EMAIL || process.env.SMTP_FROM_EMAIL,
  senderName: process.env.SMTP_FROM_NAME || 'Your App',
  service: process.env.EMAIL_SERVICE || process.env.SERVICE,
  host: process.env.EMAIL_HOST || process.env.HOST,
  port: parseInt(process.env.EMAIL_PORT || process.env.EMAIL_PORT_LOCAL, 587),
  secure: parseBoolean(process.env.EMAIL_SECURE, false),
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,

  // OAuth2 settings (for Gmail)
  oauth2ClientId: process.env.OAUTH2_CLIENT_ID,
  oauth2ClientSecret: process.env.OAUTH2_CLIENT_SECRET,
  oauth2RefreshToken: process.env.OAUTH2_REFRESH_TOKEN,
  oauth2RedirectUri: process.env.OAUTH2_REDIRECT_URI || 'https://developers.google.com/oauthplayground',

  // Fallback email configuration
  fallback: {
    service: process.env.FALLBACK_EMAIL_SERVICE,
    host: process.env.FALLBACK_EMAIL_HOST,
    port: parseInt(process.env.FALLBACK_EMAIL_PORT, 587),
    secure: parseBoolean(process.env.FALLBACK_EMAIL_SECURE, false),
    user: process.env.FALLBACK_EMAIL_USER,
    password: process.env.FALLBACK_EMAIL_PASS,
  },

  // Advanced email settings
  pool: parseBoolean(process.env.EMAIL_POOL, true),
  maxConnections: parseInt(process.env.EMAIL_MAX_CONNECTIONS, 5),
  maxMessages: parseInt(process.env.EMAIL_MAX_MESSAGES, 100),
  rateLimit: parseInt(process.env.EMAIL_RATE_LIMIT, 100),
  rateDelta: parseInt(process.env.EMAIL_RATE_DELTA, 60000),
  connectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT, 10000),
  greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT, 10000),

  // TLS settings
  tlsRejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
  tlsMinVersion: process.env.EMAIL_TLS_MIN_VERSION || 'TLSv1.2',

  // Debug settings
  debug: parseBoolean(process.env.EMAIL_DEBUG, false),
  verifyRetries: parseInt(process.env.EMAIL_VERIFY_RETRIES, 3),
  verifyDelay: parseInt(process.env.EMAIL_VERIFY_DELAY, 2000),
});

const payment = createLiveProxy('payment', {
  encryptionKey: process.env.PAYMENT_ENCRYPTION_KEY,

  paypal: {
    enabled: parseBoolean(process.env.PAYPAL_ENABLED, false),
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    mode: process.env.PAYPAL_MODE || 'sandbox',
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
  },

  stripe: {
    enabled: parseBoolean(process.env.STRIPE_ENABLED, false),
    publicKey: process.env.STRIPE_PUBLIC_KEY || process.env.STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  razorpay: {
    enabled: parseBoolean(process.env.RAZORPAY_ENABLED, false),
    publicKey: process.env.ROZORPAY_PUBLIC_KEY || process.env.RAZORPAY_KEY_ID,
    secretKey: process.env.ROZORPAY_SECRET_KEY || process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },
});

const storage = createLiveProxy('storage', {
  type: process.env.STORAGE_TYPE || 'local',
  localPath: process.env.LOCAL_STORAGE_PATH || 'uploads',
  tempUploadDir: process.env.TEMP_UPLOAD_DIR || 'uploads/temp',
  permanentUploadDir: process.env.PERMANENT_UPLOAD_DIR || 'uploads/permanent',
  allowedFileTypes: process.env.ALLOWED_FILE_TYPES ? process.env.ALLOWED_FILE_TYPES.split(',') : [],

  // File upload settings
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10485760), // 10MB default
  allowedMimeTypes: process.env.ALLOWED_MIME_TYPES ? process.env.ALLOWED_MIME_TYPES.split(',') : ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  uploadRateWindow: parseInt(process.env.UPLOAD_RATE_WINDOW, 900000),
  uploadRateLimit: parseInt(process.env.UPLOAD_RATE_LIMIT, 10),

  // Virus scanning
  virusScan: {
    enabled: parseBoolean(process.env.VIRUS_SCAN_ENABLED, false),
    apiKey: process.env.VIRUS_SCAN_API_KEY || '',
  },

  // AWS S3
  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
  },

  // Google Cloud Storage
  gcs: {
    bucket: process.env.GCS_BUCKET || '',
    projectId: process.env.GCS_PROJECT_ID || '',
    clientEmail: process.env.GCS_CLIENT_EMAIL || '',
    privateKey: process.env.GCS_PRIVATE_KEY ? process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
    keyFile: process.env.GCS_KEY_FILE || '',
  },

  // Azure Blob Storage
  azure: {
    container: process.env.AZURE_CONTAINER || '',
    account: process.env.AZURE_ACCOUNT || '',
    accessKey: process.env.AZURE_ACCESS_KEY || '',
    connectionString: process.env.AZURE_CONNECTION_STRING || '',
  },

  // Cloudflare R2 (S3-compatible)
  r2: {
    endpoint: process.env.R2_ENDPOINT || '',
    accessKey: process.env.R2_ACCESS_KEY || '',
    secretKey: process.env.R2_SECRET || '',
    bucket: process.env.R2_BUCKET || '',
    publicDomain: process.env.R2_PUBLIC_DOMAIN || '',
  },

  // Signed URL settings
  signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY, 3600),
});

const services = createLiveProxy('services', {
  // Mailchimp
  mailchimp: {
    apiKey: process.env.MAILCHIMP_API_KEY,
    listId: process.env.MAILCHIMP_LIST_ID,
  },

  // Twilio (SMS)
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // Redis Cache
  redis: {
    enabled: parseBoolean(process.env.REDIS_ENABLED, false),
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD,
  },

  // Apple Sign In
  apple: {
    clientId: process.env.APPLE_CLIENT_ID,
  },

  // Twitter/X API
  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
  },

  // Google Services
  google: {
    placesApiKey: process.env.GOOGLE_PLACES_API_KEY,
    clientId: process.env.GOOGLE_CLIENT_ID,
  },

  // Facebook Services
  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
  },

  // GitHub OAuth
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
  },

  // Store URL for email templates
  storeUrl: process.env.STORE_URL || process.env.SITE_URL || 'http://localhost:3000',
});

const otp = createLiveProxy('otp', {
  enabled: parseBoolean(process.env.ENABLE_OTP_VERIFICATION, false),
  defaultMethod: process.env.DEFAULT_OTP_METHOD || process.env.DEFAULT_OTP_TYPE || 'email',
  expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 5),
  maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 3),
  priorityOrder: process.env.OTP_PRIORITY_ORDER ? process.env.OTP_PRIORITY_ORDER.split(',') : ['email', 'sms'],

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 5),
  },

  // TOTP settings
  totp: {
    secretLength: parseInt(process.env.TOTP_SECRET_LENGTH, 32),
    window: parseInt(process.env.TOTP_WINDOW, 1),
    step: parseInt(process.env.TOTP_STEP, 30),
    appName: process.env.TOTP_APP_NAME || 'YourApp',
    issuer: process.env.TOTP_ISSUER || 'YourCompany',
  },

  // Email OTP
  emailOtp: {
    length: parseInt(process.env.EMAIL_OTP_LENGTH, 6),
    template: process.env.EMAIL_OTP_TEMPLATE || 'otp_verification',
    sender: process.env.EMAIL_SENDER || 'noreply@yourapp.com',
  },

  // SMS OTP
  smsOtp: {
    length: parseInt(process.env.SMS_OTP_LENGTH, 6),
    provider: process.env.SMS_PROVIDER || 'twilio',
  },
});

const notifications = createLiveProxy('notifications', {
  webhookUrl: process.env.NOTIFICATION_WEBHOOK_URL,
});

const features = createLiveProxy('features', {
  socketingEnabled: parseBoolean(process.env.SOCKETING_ENABLED, false),
});

const business = createLiveProxy('business', {
  companyName: process.env.COMPANY_NAME || 'Your Store',
  brandName: process.env.BRAND_NAME || 'Your Store',
  currency: process.env.CURRENCY || 'USD',
});

// ============================================================================
// STATIC UTILITIES (no DB backing needed)
// ============================================================================

const utils = {
  charactersString: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=',
};

// ============================================================================
// VALIDATION (only critical env vars that must exist)
// ============================================================================

const validateEnvVariables = () => {
  const criticalVars = {
    'DATABASE_URL': database.url,
    'JWT_SECRET': jwt.secret,
    'JWT_REFRESH_SECRET': jwt.refreshSecret,
  };

  const missing = Object.entries(criticalVars)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key);

  if (missing.length > 0) {
    console.warn(`⚠️  Warning: Missing critical environment variables: ${missing.join(', ')}`);
  }
};

// Run validation
validateEnvVariables();

// ============================================================================
// EXPORTS
// ============================================================================

const configExports = {
  // Static sections
  app,
  database,
  jwt,
  session,
  // Dynamic sections (Proxies — real-time from DB)
  security,
  client,
  email,
  payment,
  storage,
  services,
  otp,
  notifications,
  features,
  business,
  // Utilities
  utils,
};

// Legacy flat exports — backward compatibility via getters.
// NOTE: These are evaluated once when destructured. For real-time values,
// use the section objects directly (e.g. email.host instead of emailHost).
Object.defineProperties(configExports, {
  // App (static — these don't change at runtime)
  dbUrl: { get: () => database.url, enumerable: true },
  jwtSecret: { get: () => jwt.secret, enumerable: true },
  refressSecret: { get: () => jwt.refreshSecret, enumerable: true },
  serverPort: { get: () => app.port, enumerable: true },
  collectionName: { get: () => database.collection, enumerable: true },
  enviroment: { get: () => app.environment, enumerable: true },
  applicaionName: { get: () => app.name, enumerable: true },
  appUrl: { get: () => app.url, enumerable: true },

  // Client URLs (dynamic — resolved from DB via Proxy)
  host: { get: () => client.url, enumerable: true },
  frontendUrl: { get: () => client.url, enumerable: true },
  loginPath: { get: () => client.loginPage, enumerable: true },
  resetPath: { get: () => client.resetPasswordUrl, enumerable: true },
  confirmPath: { get: () => client.emailVerifyUrl, enumerable: true },

  // Email settings (dynamic — resolved from DB via Proxy)
  mailService: { get: () => email.service, enumerable: true },
  mailUserName: { get: () => email.user, enumerable: true },
  mailPassword: { get: () => email.password, enumerable: true },
  mailSender: { get: () => email.sender, enumerable: true },
  emailName: { get: () => email.name, enumerable: true },
  emailHost: { get: () => email.host, enumerable: true },
  emailPort: { get: () => email.port, enumerable: true },
  emailSecure: { get: () => email.secure, enumerable: true },
  oauth2ClientId: { get: () => email.oauth2ClientId, enumerable: true },
  oauth2ClientSecret: { get: () => email.oauth2ClientSecret, enumerable: true },
  oauth2RefreshToken: { get: () => email.oauth2RefreshToken, enumerable: true },
  oauth2RedirectUri: { get: () => email.oauth2RedirectUri, enumerable: true },
  fallbackMailService: { get: () => email.fallback.service, enumerable: true },
  fallbackEmailHost: { get: () => email.fallback.host, enumerable: true },
  fallbackEmailPort: { get: () => email.fallback.port, enumerable: true },
  fallbackEmailSecure: { get: () => email.fallback.secure, enumerable: true },
  fallbackEmailUser: { get: () => email.fallback.user, enumerable: true },
  fallbackEmailPassword: { get: () => email.fallback.password, enumerable: true },
  emailPool: { get: () => email.pool, enumerable: true },
  emailMaxConnections: { get: () => email.maxConnections, enumerable: true },
  emailMaxMessages: { get: () => email.maxMessages, enumerable: true },
  emailRateLimit: { get: () => email.rateLimit, enumerable: true },
  emailRateDelta: { get: () => email.rateDelta, enumerable: true },
  emailConnectionTimeout: { get: () => email.connectionTimeout, enumerable: true },
  emailGreetingTimeout: { get: () => email.greetingTimeout, enumerable: true },
  emailTlsRejectUnauthorized: { get: () => email.tlsRejectUnauthorized, enumerable: true },
  emailTlsMinVersion: { get: () => email.tlsMinVersion, enumerable: true },
  emailDebug: { get: () => email.debug, enumerable: true },
  emailVerifyRetries: { get: () => email.verifyRetries, enumerable: true },
  emailVerifyDelay: { get: () => email.verifyDelay, enumerable: true },

  // Payment settings (dynamic)
  paypalClient: { get: () => payment.paypal.clientId, enumerable: true },
  paypalSecret: { get: () => payment.paypal.clientSecret, enumerable: true },
  paypalMode: { get: () => payment.paypal.mode, enumerable: true },
  stripePublic: { get: () => payment.stripe.publicKey, enumerable: true },
  stripeSecret: { get: () => payment.stripe.secretKey, enumerable: true },
  razorPayPublic: { get: () => payment.razorpay.publicKey, enumerable: true },
  razorPaySecret: { get: () => payment.razorpay.secretKey, enumerable: true },

  // Storage settings (dynamic)
  storageType: { get: () => storage.type, enumerable: true },
  s3Bucket: { get: () => storage.s3.bucket, enumerable: true },
  s3Region: { get: () => storage.s3.region, enumerable: true },
  s3AccessKey: { get: () => storage.s3.accessKey, enumerable: true },
  s3SecretKey: { get: () => storage.s3.secretKey, enumerable: true },
  gcsBucket: { get: () => storage.gcs.bucket, enumerable: true },
  gcsProjectId: { get: () => storage.gcs.projectId, enumerable: true },
  gcsClientEmail: { get: () => storage.gcs.clientEmail, enumerable: true },
  gcsPrivateKey: { get: () => storage.gcs.privateKey, enumerable: true },
  gcsKeyFile: { get: () => storage.gcs.keyFile, enumerable: true },
  azureContainer: { get: () => storage.azure.container, enumerable: true },
  azureAccount: { get: () => storage.azure.account, enumerable: true },
  azureAccessKey: { get: () => storage.azure.accessKey, enumerable: true },
  azurestorage_conn_string: { get: () => storage.azure.connectionString, enumerable: true },
  allowedFileTypes: { get: () => storage.allowedFileTypes, enumerable: true },
  virusScanEnabled: { get: () => storage.virusScan.enabled, enumerable: true },
  virusScanApiKey: { get: () => storage.virusScan.apiKey, enumerable: true },
  tempUploadDir: { get: () => storage.tempUploadDir, enumerable: true },
  permanentUploadDir: { get: () => storage.permanentUploadDir, enumerable: true },
  bucketName: { get: () => storage.s3.bucket, enumerable: true },
  localStoragePath: { get: () => storage.localPath, enumerable: true },

  // Services (dynamic)
  mailchimpKey: { get: () => services.mailchimp.apiKey, enumerable: true },
  mailchimpList: { get: () => services.mailchimp.listId, enumerable: true },

  // Features (dynamic)
  isSocketingEnabled: { get: () => features.socketingEnabled, enumerable: true },

  // Utils (static)
  charactersString: { get: () => utils.charactersString, enumerable: true },
});

module.exports = configExports;
