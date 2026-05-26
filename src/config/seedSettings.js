/**
 * seedSettings.js
 * ================
 * Idempotent seeding script. Runs on every application start.
 *
 * KEY DESIGN:
 * - Settings use dot-notation keys that mirror the config section structure
 *   in src/config/setting.js  (e.g. "email.host", "payment.stripe.publicKey").
 * - The Setting model's inflateSettings() reconstructs the nested object so
 *   the Proxy-backed config sections resolve correctly.
 * - On first run, migrates values from old flat keys (e.g. "smtpHost") to
 *   new section-prefixed keys (e.g. "email.host") and removes the old keys.
 */
const Setting = require('../models/Setting');

// ============================================================================
// Migration map: old flat key → new section-prefixed key
// ============================================================================

const KEY_MIGRATIONS = [
  // Email
  { old: 'smtpHost', new: 'email.host' },
  { old: 'smtpPort', new: 'email.port' },
  { old: 'smtpUser', new: 'email.user' },
  { old: 'smtpPassword', new: 'email.password' },
  // Payment – Stripe
  { old: 'stripeEnabled', new: 'payment.stripe.enabled' },
  { old: 'stripePublicKey', new: 'payment.stripe.publicKey' },
  { old: 'stripeSecretKey', new: 'payment.stripe.secretKey' },
  { old: 'stripeWebhookSecret', new: 'payment.stripe.webhookSecret' },
  // Payment – PayPal
  { old: 'paypalEnabled', new: 'payment.paypal.enabled' },
  { old: 'paypalClientId', new: 'payment.paypal.clientId' },
  { old: 'paypalClientSecret', new: 'payment.paypal.clientSecret' },
  { old: 'paypalMode', new: 'payment.paypal.mode' },
  { old: 'paypalWebhookId', new: 'payment.paypal.webhookId' },
  // Payment – Razorpay
  { old: 'razorpayEnabled', new: 'payment.razorpay.enabled' },
  { old: 'razorpayKeyId', new: 'payment.razorpay.publicKey' },
  { old: 'razorpayKeySecret', new: 'payment.razorpay.secretKey' },
  { old: 'razorpayWebhookSecret', new: 'payment.razorpay.webhookSecret' },
  // OTP
  { old: 'otpEnabled', new: 'otp.enabled' },
  { old: 'otpDefaultMethod', new: 'otp.defaultMethod' },
  { old: 'otpExpiryMinutes', new: 'otp.expiryMinutes' },
  { old: 'otpMaxAttempts', new: 'otp.maxAttempts' },
  { old: 'otpLength', new: 'otp.smsOtp.length' },
];

// ============================================================================
// Default settings object (section-prefixed, mirrors config/setting.js)
// ============================================================================

function buildDefaultSettings() {
  return {
    // ---------- Basic / Top-level ----------
    siteName: process.env.BRAND_NAME || 'My Store',
    name: process.env.APPLICATION_NAME || 'Application',
    isLive: true,
    maintenanceMode: false,

    // ---------- Contact Info ----------
    contactInfo: {
      email: process.env.FROM_EMAIL || 'support@yourapp.com',
      phone: '+1 555-0199',
      address: {
        street: '100 Tech Parkway',
        city: 'Atlanta',
        state: 'GA',
        zipCode: '30308',
        country: 'USA',
      },
    },

    // ---------- Branding ----------
    branding: {
      logo: '',
      favicon: '',
      themeColor: '#4f46e5',
    },

    // ---------- Currency & Tax ----------
    currency: process.env.CURRENCY || 'USD',
    currencySymbol: '$',
    taxRate: 0,

    // ---------- Client URLs ----------
    client: {
      url: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000',
      loginPage: process.env.CLIENT_LOGIN_PAGE || '/login',
      resetPasswordUrl: process.env.CLIENT_RESET_PASSWORD_URL || '/reset-password',
      emailVerifyUrl: process.env.CLIENT_EMAIL_VERIFY_URL || '/verify-email',
    },

    // ---------- Security / CORS ----------
    security: {
      allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
        : ['http://localhost:3000', 'http://localhost:3001'],
      allowedIPs: process.env.ALLOWED_IPS
        ? process.env.ALLOWED_IPS.split(',').map(s => s.trim())
        : [],
      requireDeviceVerification: process.env.REQUIRE_DEVICE_VERIFICATION === 'true',
      enableSuspiciousLoginDetection: process.env.ENABLE_SUSPICIOUS_LOGIN_DETECTION === 'true',
      enableIpWhitelist: process.env.ENABLE_IP_WHITELIST === 'true',
    },

    // ---------- Email / SMTP ----------
    email: {
      name: process.env.EMAIL_NAME || 'No Reply',
      sender: process.env.FROM_EMAIL || '',
      senderName: process.env.SMTP_FROM_NAME || 'Your App',
      service: process.env.EMAIL_SERVICE || '',
      host: process.env.EMAIL_HOST || '',
      port: process.env.EMAIL_PORT ? Number.parseInt(process.env.EMAIL_PORT, 10) : 587,
      secure: process.env.EMAIL_SECURE === 'true',
      user: process.env.EMAIL_USER || '',
      password: process.env.EMAIL_PASS || '',
      oauth2ClientId: process.env.OAUTH2_CLIENT_ID || '',
      oauth2ClientSecret: process.env.OAUTH2_CLIENT_SECRET || '',
      oauth2RefreshToken: process.env.OAUTH2_REFRESH_TOKEN || '',
      oauth2RedirectUri: process.env.OAUTH2_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
      fallback: {
        service: process.env.FALLBACK_EMAIL_SERVICE || '',
        host: process.env.FALLBACK_EMAIL_HOST || '',
        port: process.env.FALLBACK_EMAIL_PORT ? Number.parseInt(process.env.FALLBACK_EMAIL_PORT, 10) : 587,
        secure: process.env.FALLBACK_EMAIL_SECURE === 'true',
        user: process.env.FALLBACK_EMAIL_USER || '',
        password: process.env.FALLBACK_EMAIL_PASS || '',
      },
      pool: process.env.EMAIL_POOL !== 'false',
      maxConnections: process.env.EMAIL_MAX_CONNECTIONS ? Number.parseInt(process.env.EMAIL_MAX_CONNECTIONS, 10) : 5,
      maxMessages: process.env.EMAIL_MAX_MESSAGES ? Number.parseInt(process.env.EMAIL_MAX_MESSAGES, 10) : 100,
      connectionTimeout: process.env.EMAIL_CONNECTION_TIMEOUT ? Number.parseInt(process.env.EMAIL_CONNECTION_TIMEOUT, 10) : 10000,
      greetingTimeout: process.env.EMAIL_GREETING_TIMEOUT ? Number.parseInt(process.env.EMAIL_GREETING_TIMEOUT, 10) : 10000,
      tlsRejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
      tlsMinVersion: process.env.EMAIL_TLS_MIN_VERSION || 'TLSv1.2',
      debug: process.env.EMAIL_DEBUG === 'true',
    },

    // ---------- Payment Gateways ----------
    payment: {
      encryptionKey: process.env.PAYMENT_ENCRYPTION_KEY || '',
      stripe: {
        enabled: process.env.STRIPE_ENABLED === 'true',
        publicKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      },
      paypal: {
        enabled: process.env.PAYPAL_ENABLED === 'true',
        clientId: process.env.PAYPAL_CLIENT_ID || '',
        clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
        mode: process.env.PAYPAL_MODE || 'sandbox',
        webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
      },
      razorpay: {
        enabled: process.env.RAZORPAY_ENABLED === 'true',
        publicKey: process.env.RAZORPAY_KEY_ID || '',
        secretKey: process.env.RAZORPAY_KEY_SECRET || '',
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
      },
    },

    // ---------- Storage ----------
    storage: {
      type: process.env.STORAGE_TYPE || 'local',
      localPath: process.env.LOCAL_STORAGE_PATH || 'uploads',
      tempUploadDir: process.env.TEMP_UPLOAD_DIR || 'uploads/temp',
      permanentUploadDir: process.env.PERMANENT_UPLOAD_DIR || 'uploads/permanent',
      maxFileSize: process.env.MAX_FILE_SIZE ? Number.parseInt(process.env.MAX_FILE_SIZE, 10) : 10485760,
      signedUrlExpiry: process.env.SIGNED_URL_EXPIRY ? Number.parseInt(process.env.SIGNED_URL_EXPIRY, 10) : 3600,
      s3: {
        bucket: process.env.S3_BUCKET || '',
        region: process.env.S3_REGION || 'us-east-1',
        accessKey: process.env.S3_ACCESS_KEY || '',
        secretKey: process.env.S3_SECRET_KEY || '',
      },
      gcs: {
        bucket: process.env.GCS_BUCKET || '',
        projectId: process.env.GCS_PROJECT_ID || '',
        clientEmail: process.env.GCS_CLIENT_EMAIL || '',
        privateKey: process.env.GCS_PRIVATE_KEY || '',
        keyFile: process.env.GCS_KEY_FILE || '',
      },
      azure: {
        container: process.env.AZURE_CONTAINER || '',
        account: process.env.AZURE_ACCOUNT || '',
        accessKey: process.env.AZURE_ACCESS_KEY || '',
        connectionString: process.env.AZURE_CONNECTION_STRING || '',
      },
      r2: {
        endpoint: process.env.R2_ENDPOINT || '',
        accessKey: process.env.R2_ACCESS_KEY || '',
        secretKey: process.env.R2_SECRET || '',
        bucket: process.env.R2_BUCKET || '',
        publicDomain: process.env.R2_PUBLIC_DOMAIN || '',
      },
    },

    // ---------- Third-Party Services ----------
    services: {
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: process.env.TWILIO_AUTH_TOKEN || '',
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
      },
      mailchimp: {
        apiKey: process.env.MAILCHIMP_API_KEY || '',
        listId: process.env.MAILCHIMP_LIST_ID || '',
      },
      google: {
        placesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
        clientId: process.env.GOOGLE_CLIENT_ID || '',
      },
      facebook: {
        appId: process.env.FACEBOOK_APP_ID || '',
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID || '',
      },
      apple: {
        clientId: process.env.APPLE_CLIENT_ID || '',
      },
      twitter: {
        apiKey: process.env.TWITTER_API_KEY || '',
        apiSecret: process.env.TWITTER_API_SECRET || '',
      },
      storeUrl: process.env.STORE_URL || process.env.SITE_URL || 'http://localhost:3000',
    },

    // ---------- OTP & Two-Factor ----------
    otp: {
      enabled: process.env.ENABLE_OTP_VERIFICATION === 'true',
      defaultMethod: process.env.DEFAULT_OTP_METHOD || 'email',
      expiryMinutes: process.env.OTP_EXPIRY_MINUTES ? Number.parseInt(process.env.OTP_EXPIRY_MINUTES, 10) : 5,
      maxAttempts: process.env.OTP_MAX_ATTEMPTS ? Number.parseInt(process.env.OTP_MAX_ATTEMPTS, 10) : 3,
      totp: {
        secretLength: process.env.TOTP_SECRET_LENGTH ? Number.parseInt(process.env.TOTP_SECRET_LENGTH, 10) : 32,
        window: process.env.TOTP_WINDOW ? Number.parseInt(process.env.TOTP_WINDOW, 10) : 1,
        step: process.env.TOTP_STEP ? Number.parseInt(process.env.TOTP_STEP, 10) : 30,
        appName: process.env.TOTP_APP_NAME || 'YourApp',
        issuer: process.env.TOTP_ISSUER || 'YourCompany',
      },
      emailOtp: {
        length: process.env.EMAIL_OTP_LENGTH ? Number.parseInt(process.env.EMAIL_OTP_LENGTH, 10) : 6,
        template: process.env.EMAIL_OTP_TEMPLATE || 'otp_verification',
        sender: process.env.EMAIL_SENDER || 'noreply@yourapp.com',
      },
      smsOtp: {
        length: process.env.SMS_OTP_LENGTH ? Number.parseInt(process.env.SMS_OTP_LENGTH, 10) : 6,
        provider: process.env.SMS_PROVIDER || 'twilio',
      },
    },

    // ---------- Business ----------
    business: {
      companyName: process.env.COMPANY_NAME || 'Your Store',
      brandName: process.env.BRAND_NAME || 'Your Store',
      currency: process.env.CURRENCY || 'USD',
    },

    // ---------- Features ----------
    features: {
      socketingEnabled: process.env.SOCKETING_ENABLED === 'true',
    },

    // ---------- Notifications ----------
    notifications: {
      webhookUrl: process.env.NOTIFICATION_WEBHOOK_URL || '',
    },
  };
}

// ============================================================================
// Main seed function
// ============================================================================

const seedSettings = async () => {
  try {
    const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';

    // Clean up any legacy settings documents (those without a 'key' field)
    await Setting.deleteMany({ key: { $exists: false } });

    // Drop legacy unique index on siteKey to allow multiple documents per tenant
    try {
      await Setting.collection.dropIndex('siteKey_1');
      console.log('✅ Dropped legacy unique siteKey_1 index');
    } catch {
      // Index might not exist, ignore
    }

    console.log(`🌱 Checking settings seeding for tenant: ${activeTenantKey}`);

    // ── Step 1: Migrate old flat keys to new section-prefixed keys ──
    let migratedCount = 0;
    for (const m of KEY_MIGRATIONS) {
      const oldDoc = await Setting.findOne({ siteKey: activeTenantKey, key: m.old });
      if (oldDoc) {
        const newExists = await Setting.findOne({ siteKey: activeTenantKey, key: m.new });
        if (!newExists) {
          await Setting.create({ siteKey: activeTenantKey, key: m.new, value: oldDoc.value });
          migratedCount++;
        }
        // Remove old key after successful migration
        await Setting.deleteOne({ siteKey: activeTenantKey, key: m.old });
      }
    }
    if (migratedCount > 0) {
      console.log(`🔄 Migrated ${migratedCount} settings from old keys to section-prefixed keys`);
    }

    // ── Step 2: Seed default settings (skip keys that already exist) ──
    const defaultSettingsObj = buildDefaultSettings();
    const flatDefaults = Setting.flattenObject(defaultSettingsObj);

    let activeNewCount = 0;
    for (const [key, value] of Object.entries(flatDefaults)) {
      const exists = await Setting.findOne({ siteKey: activeTenantKey, key });
      if (!exists) {
        await Setting.create({ siteKey: activeTenantKey, key, value });
        activeNewCount++;
      }
    }

    if (activeNewCount > 0) {
      console.log(`✅ Seeded ${activeNewCount} new default settings for tenant: ${activeTenantKey}`);
    } else {
      console.log(`ℹ️  Settings for tenant: ${activeTenantKey} are fully up-to-date`);
    }

    // ── Step 3: Seed minimal fallback for legacy 'sitekey' tenant ──
    if (activeTenantKey !== 'sitekey') {
      const legacyDefaults = {
        siteName: 'Backup Store',
        isLive: true,
        contactInfo: { email: '' },
      };
      const flatLegacy = Setting.flattenObject(legacyDefaults);

      let legacyNewCount = 0;
      for (const [key, value] of Object.entries(flatLegacy)) {
        const exists = await Setting.findOne({ siteKey: 'sitekey', key });
        if (!exists) {
          await Setting.create({ siteKey: 'sitekey', key, value });
          legacyNewCount++;
        }
      }
      if (legacyNewCount > 0) {
        console.log(`✅ Seeded ${legacyNewCount} default legacy settings for tenant: sitekey`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to seed settings:', error.message);
  }
};

module.exports = seedSettings;
