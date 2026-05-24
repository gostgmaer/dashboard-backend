require('dotenv').config();

/**
 * Centralized Configuration Module
 * All environment variables should be imported from this file
 * DO NOT use process.env directly in other files
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
// APPLICATION SETTINGS
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

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

const rawDbTls = process.env.DB_TLS ?? process.env.DB_SSL;
const rawDbTlsAllowInvalidCerts = process.env.DB_TLS_ALLOW_INVALID_CERTS;
const rawDbSslValidate = process.env.DB_SSL_VALIDATE;

const database = {
	url: process.env.DATABASE_URL || process.env.MONGODB_URI,
	collection: process.env.COLLECTION || 'main',
	// Connection pool settings
	maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE, 20),
	minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE, 2),
	maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME, 30000),
	// Timeout settings
	serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT, 5000),
	socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT, 45000),
	connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT, 10000),
	heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT, 10000),
	// TLS settings
	// Keep undefined when no explicit env value is set so URI query params are not overridden.
	tls: rawDbTls !== undefined ? parseBoolean(rawDbTls, false) : undefined,
	enforceTls: parseBoolean(process.env.DB_ENFORCE_TLS, true),
	tlsMinVersion: process.env.DB_TLS_MIN_VERSION || 'TLSv1.2',
	tlsAllowInvalidCerts:
		rawDbTlsAllowInvalidCerts !== undefined ? parseBoolean(rawDbTlsAllowInvalidCerts, false)
		: rawDbSslValidate !== undefined ? !parseBoolean(rawDbSslValidate, true)
		: undefined,
};

// ============================================================================
// JWT & AUTHENTICATION
// ============================================================================

const jwt = {
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  idExpiry: process.env.JWT_ID_EXPIRY || '30d',
  algorithm: process.env.JWT_ALGORITHM || 'HS256',
  issuer: process.env.JWT_ISSUER || 'your-app-name',
  audience: process.env.JWT_AUDIENCE || 'your-app-users',
};

const session = {
  secret: process.env.SESSION_SECRET,
};

const security = {
  requireDeviceVerification: parseBoolean(process.env.REQUIRE_DEVICE_VERIFICATION, false),
  enableSuspiciousLoginDetection: parseBoolean(process.env.ENABLE_SUSPICIOUS_LOGIN_DETECTION, false),
  enableIpWhitelist: parseBoolean(process.env.ENABLE_IP_WHITELIST, false),
  allowedIPs: process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim()) : [],
  allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : [],
};

// ============================================================================
// FRONTEND/CLIENT URLS
// ============================================================================

const client = {
  url: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000',
  loginPage: process.env.CLIENT_LOGIN_PAGE || '/login',
  resetPasswordUrl: process.env.CLIENT_RESET_PASSWORD_URL || '/reset-password',
  emailVerifyUrl: process.env.CLIENT_EMAIL_VERIFY_URL || '/verify-email',
};

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================

const email = {
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
};

// ============================================================================
// PAYMENT GATEWAYS
// ============================================================================

const payment = {
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
};

// ============================================================================
// FILE STORAGE
// ============================================================================

const storage = {
  type: process.env.STORAGE_TYPE || 'local',
  localPath: process.env.LOCAL_STORAGE_PATH || 'uploads',
  tempUploadDir: process.env.TEMP_UPLOAD_DIR || 'uploads/temp',
  permanentUploadDir: process.env.PERMANENT_UPLOAD_DIR || 'uploads/permanent',
  allowedFileTypes: process.env.ALLOWED_FILE_TYPES ? process.env.ALLOWED_FILE_TYPES.split(',') : [],
  
  // File upload settings
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10485760), // 10MB default
  allowedMimeTypes: process.env.ALLOWED_MIME_TYPES ? process.env.ALLOWED_MIME_TYPES.split(',') : ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  uploadRateWindow: parseInt(process.env.UPLOAD_RATE_WINDOW, 900000), // 15 minutes
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
  
  // Firebase Storage
  firebase: {
    bucket: process.env.FIREBASE_BUCKET || process.env.BUCKET_NAME || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
    keyFile: process.env.FIREBASE_KEY_FILE || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    
    // Emulator settings
    emulator: {
      enabled: parseBoolean(process.env.USE_FIREBASE_EMULATOR, false),
      host: process.env.FIREBASE_EMULATOR_HOST || 'localhost:9199',
      protocol: process.env.FIREBASE_EMULATOR_PROTOCOL || 'http',
      auth: parseBoolean(process.env.FIREBASE_EMULATOR_AUTH, false),
      storage: parseBoolean(process.env.FIREBASE_EMULATOR_STORAGE, false),
    },
  },
  
  // Cloudflare R2 (S3-compatible)
  r2: {
    endpoint: process.env.R2_ENDPOINT || '',
    accessKey: process.env.R2_ACCESS_KEY || '',
    secretKey: process.env.R2_SECRET || '',
    bucket: process.env.R2_BUCKET || '',
    publicDomain: process.env.R2_PUBLIC_DOMAIN || '',
  },
  
  // Signed URL settings (for all storage providers)
  signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY, 3600), // 1 hour default
};

// ============================================================================
// THIRD-PARTY SERVICES
// ============================================================================

const services = {
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
  
  // Social Media
  facebook: {
    catalogId: process.env.FB_CATALOG_ID,
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
};

// ============================================================================
// OTP & TWO-FACTOR AUTHENTICATION
// ============================================================================

const otp = {
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
};

// ============================================================================
// NOTIFICATIONS & WEBHOOKS
// ============================================================================

const notifications = {
  webhookUrl: process.env.NOTIFICATION_WEBHOOK_URL,
};

// ============================================================================
// FEATURES & TOGGLES
// ============================================================================

const features = {
  socketingEnabled: parseBoolean(process.env.SOCKETING_ENABLED, false),
};

// ============================================================================
// BUSINESS SETTINGS
// ============================================================================

const business = {
  companyName: process.env.COMPANY_NAME || 'Your Store',
  brandName: process.env.BRAND_NAME || 'Your Store',
  currency: process.env.CURRENCY || 'USD',
};

// ============================================================================
// UTILITIES
// ============================================================================

const utils = {
  charactersString: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=',
};

// ============================================================================
// VALIDATION
// ============================================================================

const validateEnvVariables = () => {
  // Check critical variables
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

  // Email validation (only if not using service-based providers)
  if (!email.service) {
    const emailVars = ['EMAIL_USER', 'EMAIL_HOST', 'EMAIL_PORT'];
    const missingEmail = emailVars.filter(varName => !process.env[varName]);
    if (missingEmail.length > 0 && app.environment !== 'development') {
      console.warn(`⚠️  Warning: Missing email configuration: ${missingEmail.join(', ')}`);
    }
  }
};

// Run validation
validateEnvVariables();

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main configuration objects
  app,
  database,
  jwt,
  session,
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
  utils,
  
  // Legacy exports (for backward compatibility - will be deprecated)
  dbUrl: database.url,
  jwtSecret: jwt.secret,
  refressSecret: jwt.refreshSecret,
  serverPort: app.port,
  collectionName: database.collection,
  enviroment: app.environment,
  applicaionName: app.name,
  appUrl: app.url,
  
  // Client URLs
  host: client.url,
  frontendUrl: client.url,
  loginPath: client.loginPage,
  resetPath: client.resetPasswordUrl,
  confirmPath: client.emailVerifyUrl,
  
  // Email settings (legacy)
  mailService: email.service,
  mailUserName: email.user,
  mailPassword: email.password,
  mailSender: email.sender,
  emailName: email.name,
  emailHost: email.host,
  emailPort: email.port,
  emailSecure: email.secure,
  oauth2ClientId: email.oauth2ClientId,
  oauth2ClientSecret: email.oauth2ClientSecret,
  oauth2RefreshToken: email.oauth2RefreshToken,
  oauth2RedirectUri: email.oauth2RedirectUri,
  fallbackMailService: email.fallback.service,
  fallbackEmailHost: email.fallback.host,
  fallbackEmailPort: email.fallback.port,
  fallbackEmailSecure: email.fallback.secure,
  fallbackEmailUser: email.fallback.user,
  fallbackEmailPassword: email.fallback.password,
  emailPool: email.pool,
  emailMaxConnections: email.maxConnections,
  emailMaxMessages: email.maxMessages,
  emailRateLimit: email.rateLimit,
  emailRateDelta: email.rateDelta,
  emailConnectionTimeout: email.connectionTimeout,
  emailGreetingTimeout: email.greetingTimeout,
  emailTlsRejectUnauthorized: email.tlsRejectUnauthorized,
  emailTlsMinVersion: email.tlsMinVersion,
  emailDebug: email.debug,
  emailVerifyRetries: email.verifyRetries,
  emailVerifyDelay: email.verifyDelay,
  
  // Payment settings (legacy)
  paypalClient: payment.paypal.clientId,
  paypalSecret: payment.paypal.clientSecret,
  paypalMode: payment.paypal.mode,
  stripePublic: payment.stripe.publicKey,
  stripeSecret: payment.stripe.secretKey,
  razorPayPublic: payment.razorpay.publicKey,
  razorPaySecret: payment.razorpay.secretKey,
  
  // Storage settings (legacy)
  storageType: storage.type,
  s3Bucket: storage.s3.bucket,
  s3Region: storage.s3.region,
  s3AccessKey: storage.s3.accessKey,
  s3SecretKey: storage.s3.secretKey,
  gcsBucket: storage.gcs.bucket,
  gcsProjectId: storage.gcs.projectId,
  gcsClientEmail: storage.gcs.clientEmail,
  gcsPrivateKey: storage.gcs.privateKey,
  gcsKeyFile: storage.gcs.keyFile,
  azureContainer: storage.azure.container,
  azureAccount: storage.azure.account,
  azureAccessKey: storage.azure.accessKey,
  azurestorage_conn_string: storage.azure.connectionString,
  allowedFileTypes: storage.allowedFileTypes,
  virusScanEnabled: storage.virusScan.enabled,
  virusScanApiKey: storage.virusScan.apiKey,
  tempUploadDir: storage.tempUploadDir,
  permanentUploadDir: storage.permanentUploadDir,
  firebaseBucket: storage.firebase.bucket,
  firebaseProjectId: storage.firebase.projectId,
  firebaseClientEmail: storage.firebase.clientEmail,
  firebasePrivateKey: storage.firebase.privateKey,
  firebaseKeyFile: storage.firebase.keyFile,
  useFirebaseEmulator: storage.firebase.emulator.enabled,
  firebaseEmulatorHost: storage.firebase.emulator.host,
  firebaseEmulatorProtocol: storage.firebase.emulator.protocol,
  firebaseEmulatorAuth: storage.firebase.emulator.auth,
  firebaseEmulatorStorage: storage.firebase.emulator.storage,
  bucketName: storage.firebase.bucket,
  localStoragePath: storage.localPath,
  firebaseAuthDomain: storage.firebase.authDomain,
  firebaseMessagingSenderId: storage.firebase.messagingSenderId,
  firebaseAppId: storage.firebase.appId,
  
  // Services (legacy)
  mailchimpKey: services.mailchimp.apiKey,
  mailchimpList: services.mailchimp.listId,
  
  // Features
  isSocketingEnabled: features.socketingEnabled,
  
  // Utils
  charactersString: utils.charactersString,
};
