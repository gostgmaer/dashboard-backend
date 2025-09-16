require('dotenv').config();


const validateEnvVariables = () => {
  const requiredVars = ['EMAIL_USER', 'EMAIL_HOST', 'EMAIL_PORT'];
  if (process.env.EMAIL_SERVICE) {
    return; // Service-based providers may not need host/port
  }
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required email configuration: ${missingVars.join(', ')}`);
  }
};
//app config
const dbUrl = process.env.MONGO_URL;
const jwtSecret = process.env.JWT_SECRET;
const refressSecret = process.env.JWT_REFRESH_SECRET;
const serverPort = process.env.PORT;
const collectionName = process.env.COLLECTION;
const appUrl = process.env.APPURL;


// # Nodemailer configuration


const emailName = process.env.EMAIL_NAME;
const enviroment = process.env.NODE_ENV;

// # Mailchimp API key and list ID
const mailchimpKey = process.env.MAILCHIMP_API_KEY;
const mailchimpList = process.env.MAILCHIMP_LIST_ID;

// # Client Application Name
const applicaionName = process.env.APPLICATION_NAME;

// #client urls

const host = process.env.LOGINHOST;
const loginPath = process.env.CLIENTLOGINPAGE;
const frontendUrl = process.env.FRONTEND_URL;
const resetPath = process.env.CLIENTRESETPASSURL;
const confirmPath = process.env.CLIENTCONFIRMURL;

//Payment config

const paypalClient = process.env.PAYPAL_CLIENT_ID;
const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;
const paypalMode = process.env.PAYPAL_MODE;
const stripePublic = process.env.STRIPE_PUBLIC_KEY;
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const razorPayPublic = process.env.ROZORPAY_PUBLIC_KEY;
const razorPaySecret = process.env.ROZORPAY_SECRET_KEY;



 // Email configuration (optimized for Brevo SMTP)
   const mailService = process.env.EMAIL_SERVICE; // Empty for Brevo
   const mailUserName = process.env.EMAIL_USER; // Brevo account email
   const mailPassword = process.env.EMAIL_PASS; // Brevo SMTP key
   const emailHost = process.env.EMAIL_HOST; // smtp-relay.brevo.com
   const emailPort = parseInt(process.env.EMAIL_PORT_LOCAL) || 587;
   const emailSecure = process.env.EMAIL_SECURE === 'true' || false;
   const oauth2ClientId = process.env.OAUTH2_CLIENT_ID; // Only for Gmail fallback
   const oauth2ClientSecret = process.env.OAUTH2_CLIENT_SECRET;
   const oauth2RefreshToken = process.env.OAUTH2_REFRESH_TOKEN;
   const oauth2RedirectUri = process.env.OAUTH2_REDIRECT_URI || 'https://developers.google.com/oauthplayground';

   // Fallback email configuration
   const fallbackMailService = process.env.FALLBACK_EMAIL_SERVICE;
   const fallbackEmailHost = process.env.FALLBACK_EMAIL_HOST;
   const fallbackEmailPort = parseInt(process.env.FALLBACK_EMAIL_PORT) || 587;
   const fallbackEmailSecure = process.env.FALLBACK_EMAIL_SECURE === 'true' || false;
   const fallbackEmailUser = process.env.FALLBACK_EMAIL_USER;
   const fallbackEmailPassword = process.env.FALLBACK_EMAIL_PASS;

   // Advanced email settings
   const emailPool = process.env.EMAIL_POOL === 'true' || true;
   const emailMaxConnections = parseInt(process.env.EMAIL_MAX_CONNECTIONS) || 5;
   const emailMaxMessages = parseInt(process.env.EMAIL_MAX_MESSAGES) || 100;
   const emailRateLimit = parseInt(process.env.EMAIL_RATE_LIMIT) || 100;
   const emailRateDelta = parseInt(process.env.EMAIL_RATE_DELTA) || 60000;
   const emailConnectionTimeout = parseInt(process.env.EMAIL_CONNECTION_TIMEOUT) || 10000;
   const emailGreetingTimeout = parseInt(process.env.EMAIL_GREETING_TIMEOUT) || 10000;
   const emailTlsRejectUnauthorized = process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false';
   const emailTlsMinVersion = process.env.EMAIL_TLS_MIN_VERSION || 'TLSv1.2';
   const emailDebug = process.env.EMAIL_DEBUG === 'true' || false;
   const emailVerifyRetries = parseInt(process.env.EMAIL_VERIFY_RETRIES) || 3;
   const emailVerifyDelay = parseInt(process.env.EMAIL_VERIFY_DELAY) || 2000;
// Validate environment variables on load
validateEnvVariables();



//string of char

const charactersString = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+='


module.exports = {
  dbUrl,
  jwtSecret,
  serverPort,
  collectionName,
  mailService,
  mailUserName,
  mailPassword,
  emailHost,
  emailPort,
  emailSecure,
  oauth2ClientId,
  oauth2ClientSecret,
  oauth2RefreshToken,
  oauth2RedirectUri,
  fallbackMailService,
  fallbackEmailHost,
  fallbackEmailPort,
  fallbackEmailSecure,
  fallbackEmailUser,
  fallbackEmailPassword,
  emailPool,
  emailMaxConnections,
  emailMaxMessages,
  emailRateLimit,
  emailRateDelta,
  emailConnectionTimeout,
  emailGreetingTimeout,
  emailTlsRejectUnauthorized,
  emailTlsMinVersion,
  emailDebug,
  emailVerifyRetries,
  emailVerifyDelay,
  emailName,
  mailchimpKey,
  mailchimpList,
  applicaionName,paypalMode,
  host,
  loginPath,frontendUrl,
  resetPath,
  confirmPath,enviroment,
  refressSecret,
  paypalClient,appUrl,
  paypalSecret,
  stripePublic,
  stripeSecret,razorPayPublic,razorPaySecret,charactersString
};
