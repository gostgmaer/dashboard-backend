# Environment Variables Configuration Guide

## Overview

All environment variables are now centralized in `src/config/setting.js`. **DO NOT** use `process.env` directly in your application code. Instead, import the appropriate configuration objects from the settings module.

## ✅ Correct Usage

```javascript
// ✅ GOOD - Use centralized settings
const { app, database, jwt, email } = require('./src/config/setting');

console.log(app.environment);
console.log(database.url);
console.log(jwt.secret);
```

```javascript
// ❌ BAD - Don't use process.env directly
console.log(process.env.NODE_ENV);
console.log(process.env.DATABASE_URL);
console.log(process.env.JWT_SECRET);
```

## Configuration Objects

### 1. Application Settings (`app`)
```javascript
const { app } = require('./src/config/setting');

// Available properties:
app.name           // Application name
app.port           // Server port
app.environment    // 'development', 'production', etc.
app.url            // Application URL
app.siteUrl        // Site URL
app.baseApiUrl     // Base API URL
```

### 2. Database Configuration (`database`)
```javascript
const { database } = require('./src/config/setting');

// Available properties:
database.url                      // MongoDB connection string
database.collection               // Collection name
database.maxPoolSize              // Connection pool size
database.minPoolSize              // Minimum pool size
database.maxIdleTimeMS            // Max idle time
database.serverSelectionTimeoutMS // Server selection timeout
database.socketTimeoutMS          // Socket timeout
database.connectTimeoutMS         // Connect timeout
database.heartbeatFrequencyMS     // Heartbeat frequency
database.tls                      // TLS enabled (boolean)
database.tlsAllowInvalidCerts     // Allow invalid certs (boolean)
```

### 3. JWT & Authentication (`jwt`, `session`)
```javascript
const { jwt, session } = require('./src/config/setting');

// JWT properties:
jwt.secret          // JWT secret key
jwt.refreshSecret   // Refresh token secret
jwt.expiresIn       // Token expiration
jwt.idExpiry        // ID token expiry
jwt.algorithm       // Signing algorithm
jwt.issuer          // Token issuer
jwt.audience        // Token audience

// Session properties:
session.secret      // Session secret
```

### 4. Security Settings (`security`)
```javascript
const { security } = require('./src/config/setting');

// Available properties:
security.requireDeviceVerification      // Boolean
security.enableSuspiciousLoginDetection // Boolean
security.enableIpWhitelist              // Boolean
security.allowedIPs                     // Array of IPs
security.allowedOrigins                 // Array of origins
```

### 5. Client/Frontend URLs (`client`)
```javascript
const { client } = require('./src/config/setting');

// Available properties:
client.url                // Frontend URL
client.loginPage          // Login page path
client.resetPasswordUrl   // Reset password URL
client.emailVerifyUrl     // Email verification URL
```

### 6. Email Configuration (`email`)
```javascript
const { email } = require('./src/config/setting');

// Basic settings:
email.name            // Email sender name
email.sender          // From email address
email.senderName      // Sender display name
email.service         // Email service provider
email.host            // SMTP host
email.port            // SMTP port
email.secure          // Use TLS (boolean)
email.user            // SMTP username
email.password        // SMTP password

// OAuth2 (for Gmail):
email.oauth2ClientId
email.oauth2ClientSecret
email.oauth2RefreshToken
email.oauth2RedirectUri

// Fallback configuration:
email.fallback.service
email.fallback.host
email.fallback.port
email.fallback.secure
email.fallback.user
email.fallback.password

// Advanced settings:
email.pool
email.maxConnections
email.maxMessages
email.rateLimit
email.rateDelta
email.connectionTimeout
email.greetingTimeout
email.tlsRejectUnauthorized
email.tlsMinVersion
email.debug
email.verifyRetries
email.verifyDelay
```

### 7. Payment Gateways (`payment`)
```javascript
const { payment } = require('./src/config/setting');

// PayPal:
payment.paypal.enabled
payment.paypal.clientId
payment.paypal.clientSecret
payment.paypal.mode          // 'sandbox' or 'live'
payment.paypal.webhookId

// Stripe:
payment.stripe.enabled
payment.stripe.publicKey
payment.stripe.secretKey
payment.stripe.webhookSecret

// Razorpay:
payment.razorpay.enabled
payment.razorpay.publicKey
payment.razorpay.secretKey
payment.razorpay.webhookSecret

// Encryption:
payment.encryptionKey
```

### 8. File Storage (`storage`)
```javascript
const { storage } = require('./src/config/setting');

// General:
storage.type              // 'local', 's3', 'gcs', 'azure'
storage.localPath
storage.tempUploadDir
storage.permanentUploadDir
storage.allowedFileTypes  // Array
storage.maxFileSize
storage.allowedMimeTypes  // Array
storage.uploadRateWindow
storage.uploadRateLimit

// Virus scanning:
storage.virusScan.enabled
storage.virusScan.apiKey

// AWS S3:
storage.s3.bucket
storage.s3.region
storage.s3.accessKey
storage.s3.secretKey

// Google Cloud Storage:
storage.gcs.bucket
storage.gcs.projectId
storage.gcs.clientEmail
storage.gcs.privateKey
storage.gcs.keyFile

// Azure Blob Storage:
storage.azure.container
storage.azure.account
storage.azure.accessKey
storage.azure.connectionString
```

### 9. Third-Party Services (`services`)
```javascript
const { services } = require('./src/config/setting');

// Mailchimp:
services.mailchimp.apiKey
services.mailchimp.listId

// Twilio (SMS):
services.twilio.accountSid
services.twilio.authToken
services.twilio.phoneNumber

// Redis:
services.redis.enabled
services.redis.url
services.redis.host
services.redis.port
services.redis.password

// Social Media:
services.facebook.catalogId

// Store URL:
services.storeUrl
```

### 10. OTP & Two-Factor Authentication (`otp`)
```javascript
const { otp } = require('./src/config/setting');

// General:
otp.enabled
otp.defaultMethod      // 'email', 'sms', 'totp'
otp.expiryMinutes
otp.maxAttempts
otp.priorityOrder      // Array ['email', 'sms']

// Rate limiting:
otp.rateLimit.windowMs
otp.rateLimit.maxRequests

// TOTP:
otp.totp.secretLength
otp.totp.window
otp.totp.step
otp.totp.appName
otp.totp.issuer

// Email OTP:
otp.emailOtp.length
otp.emailOtp.template
otp.emailOtp.sender

// SMS OTP:
otp.smsOtp.length
otp.smsOtp.provider
```

### 11. Business Settings (`business`)
```javascript
const { business } = require('./src/config/setting');

business.companyName
business.brandName
business.currency
```

### 12. Features & Toggles (`features`)
```javascript
const { features } = require('./src/config/setting');

features.socketingEnabled  // Boolean
```

### 13. Notifications (`notifications`)
```javascript
const { notifications } = require('./src/config/setting');

notifications.webhookUrl
```

### 14. Utilities (`utils`)
```javascript
const { utils } = require('./src/config/setting');

utils.charactersString  // String of allowed characters
```

## Required Environment Variables

### Critical Variables (Must be set):
```env
# Database
DATABASE_URL=mongodb://localhost:27017/yourdb
MONGODB_URI=mongodb://localhost:27017/yourdb  # Fallback for DATABASE_URL

# Authentication
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
SESSION_SECRET=your-session-secret-min-32-chars

# Application
NODE_ENV=development
PORT=3500
```

### Recommended Variables:
```env
# Application
APPLICATION_NAME=Dashboard Application
APPURL=http://localhost:3500
SITE_URL=http://localhost:3000
BASE_API_URL=

# Frontend
FRONTEND_URL=http://localhost:3000
CLIENT_LOGIN_PAGE=/login
CLIENT_RESET_PASSWORD_URL=/reset-password
CLIENT_EMAIL_VERIFY_URL=/verify-email

# Email Configuration
EMAIL_SERVICE=
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-password
FROM_EMAIL=noreply@example.com
EMAIL_NAME=No Reply

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Socket.io
SOCKETING_ENABLED=true
```

### Optional Variables:
See [env.sample](./env.sample) for complete list of all available environment variables.

## Migration Guide

If you have existing code using `process.env`, update it as follows:

### Before:
```javascript
const port = process.env.PORT || 3500;
const dbUrl = process.env.DATABASE_URL;
const isDev = process.env.NODE_ENV === 'development';
```

### After:
```javascript
const { app, database } = require('./src/config/setting');

const port = app.port;
const dbUrl = database.url;
const isDev = app.environment === 'development';
```

## Benefits of Centralized Configuration

1. ✅ **Type Safety**: All values are parsed and converted to appropriate types
2. ✅ **Default Values**: Sensible defaults are provided
3. ✅ **Validation**: Environment variables are validated on startup
4. ✅ **Maintainability**: Single source of truth for all configuration
5. ✅ **Documentation**: Self-documenting configuration structure
6. ✅ **Testing**: Easier to mock configuration in tests
7. ✅ **Refactoring**: Change environment variable names without updating all files

## Environment Variable Validation

The application validates critical environment variables on startup via `src/config/validateEnv.js`. 

Missing required variables will cause the application to fail fast with a clear error message.

## Troubleshooting

### Issue: "Cannot read property 'secret' of undefined"
**Solution**: Make sure you're importing the correct object from settings:
```javascript
// Wrong:
const jwt = require('./src/config/setting');

// Correct:
const { jwt } = require('./src/config/setting');
```

### Issue: "Environment variable not found"
**Solution**: 
1. Check that the variable is defined in your `.env` file
2. Ensure `src/config/setting.js` exports the variable
3. Restart your application after adding new variables

### Issue: Need to add a new environment variable
**Steps**:
1. Add the variable to your `.env` file
2. Add it to the appropriate section in `src/config/setting.js`
3. Export it in the module.exports section
4. Import and use it in your code

## Best Practices

1. ✅ Always import specific configuration objects you need
2. ✅ Use destructuring for cleaner imports
3. ✅ Add comments for complex environment variables
4. ✅ Keep related variables grouped together
5. ✅ Use meaningful default values
6. ❌ Never use `process.env` directly in application code
7. ❌ Don't commit `.env` files to version control
8. ❌ Don't hardcode sensitive values

## Legacy Compatibility

For backward compatibility, `setting.js` still exports legacy variable names. However, **new code should use the structured objects** (app, database, jwt, etc.) instead.

### Legacy exports (deprecated):
```javascript
const { dbUrl, jwtSecret, serverPort } = require('./src/config/setting');
```

### New structured approach (recommended):
```javascript
const { database, jwt, app } = require('./src/config/setting');
```

---

**Last Updated**: March 5, 2026
**Maintained by**: Development Team
