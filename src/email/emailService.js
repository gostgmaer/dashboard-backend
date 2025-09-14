const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

// Metrics store for monitoring
let metrics = {
  connectionAttempts: 0,
  connectionSuccesses: 0,
  connectionFailures: 0,
  emailsSent: 0,
  emailsFailed: 0,
};

// Validate required environment variables
const validateEnvVariables = (options = {}) => {
  const requiredVars = ['EMAIL_USER', 'EMAIL_HOST', 'EMAIL_PORT'];
  if (options.service && !options.host && !options.port) {
    return; // Service-based providers (e.g., 'sendgrid') may not need host/port
  }
  const missingVars = requiredVars.filter((varName) => !process.env[varName] && !options[varName.toLowerCase()]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// Create transporter with dynamic provider support
const createTransporter = (options = {}) => {
  validateEnvVariables(options);

  const config = {
    // Use service if specified (e.g., 'gmail', 'sendgrid'), otherwise custom SMTP
    ...(options.service || process.env.EMAIL_SERVICE ? { service: options.service || process.env.EMAIL_SERVICE } : {}),
    host: options.host || process.env.EMAIL_HOST,
    port: parseInt(options.port || process.env.EMAIL_PORT) || 587,
    secure: options.secure || process.env.EMAIL_SECURE === 'true' || false,
    auth: {
      user: options.user || process.env.EMAIL_USER,
      pass: options.pass || process.env.EMAIL_PASS,
    },
    // Connection pooling
    pool: process.env.EMAIL_POOL === 'true' || true,
    maxConnections: parseInt(process.env.EMAIL_MAX_CONNECTIONS) || 5,
    maxMessages: parseInt(process.env.EMAIL_MAX_MESSAGES) || 100,
    // Rate limiting
    rateLimit: parseInt(process.env.EMAIL_RATE_LIMIT) || 100,
    rateDelta: parseInt(process.env.EMAIL_RATE_DELTA) || 60000,
    // Timeout settings
    connectionTimeout: parseInt(process.env.EMAIL_CONNECTION_TIMEOUT) || 10000,
    greetingTimeout: parseInt(process.env.EMAIL_GREETING_TIMEOUT) || 10000,
    // TLS settings
    tls: {
      rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
      minVersion: process.env.EMAIL_TLS_MIN_VERSION || 'TLSv1.2',
    },
    logger: process.env.EMAIL_DEBUG === 'true' ? console : false,
    debug: process.env.EMAIL_DEBUG === 'true' || false,
  };

  // OAuth2 support for providers that support it
  if (process.env.OAUTH2_CLIENT_ID && process.env.OAUTH2_CLIENT_SECRET && process.env.OAUTH2_REFRESH_TOKEN) {
    config.auth = {
      type: 'OAuth2',
      user: options.user || process.env.EMAIL_USER,
      clientId: process.env.OAUTH2_CLIENT_ID,
      clientSecret: process.env.OAUTH2_CLIENT_SECRET,
      refreshToken: process.env.OAUTH2_REFRESH_TOKEN,
      accessToken: async () => {
        try {
          const oauth2Client = new OAuth2Client(
            process.env.OAUTH2_CLIENT_ID,
            process.env.OAUTH2_CLIENT_SECRET,
            process.env.OAUTH2_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
          );
          oauth2Client.setCredentials({
            refresh_token: process.env.OAUTH2_REFRESH_TOKEN,
          });
          const { token } = await oauth2Client.getAccessToken();
          return token;
        } catch (error) {
          throw new Error(`Failed to obtain OAuth2 access token: ${error.message}`);
        }
      },
    };
  }

  return nodemailer.createTransport(config);
};

// Create fallback transporter
const createFallbackTransporter = () => {
  if (!process.env.FALLBACK_EMAIL_HOST && !process.env.FALLBACK_EMAIL_SERVICE) return null;
  return createTransporter({
    service: process.env.FALLBACK_EMAIL_SERVICE,
    host: process.env.FALLBACK_EMAIL_HOST,
    port: process.env.FALLBACK_EMAIL_PORT,
    secure: process.env.FALLBACK_EMAIL_SECURE === 'true',
    user: process.env.FALLBACK_EMAIL_USER,
    pass: process.env.FALLBACK_EMAIL_PASS,
  });
};

// Verify email connection with exponential backoff
const verifyEmailConnection = async (retries = parseInt(process.env.EMAIL_VERIFY_RETRIES) || 3, baseDelay = parseInt(process.env.EMAIL_VERIFY_DELAY) || 2000) => {
  let attempts = 0;
  metrics.connectionAttempts++;

  while (attempts < retries) {
    try {
      const transporter = createTransporter();
      await transporter.verify();
      console.log('✅ Email service is ready');
      metrics.connectionSuccesses++;
      return { success: true, message: 'Email service connection verified', metrics };
    } catch (error) {
      attempts++;
      metrics.connectionFailures++;
      console.error(`❌ Email service error (attempt ${attempts}/${retries}):`, error.message);
      if (attempts === retries) {
        // Try fallback transporter if configured
        const fallbackTransporter = createFallbackTransporter();
        if (fallbackTransporter) {
          try {
            await fallbackTransporter.verify();
            console.log('✅ Fallback email service is ready');
            metrics.connectionSuccesses++;
            return { success: true, message: 'Fallback email service connection verified', metrics };
          } catch (fallbackError) {
            console.error('❌ Fallback email service error:', fallbackError.message);
            return {
              success: false,
              error: `Failed to verify email service after ${retries} attempts and fallback: ${error.message}`,
              metrics,
            };
          }
        }
        return {
          success: false,
          error: `Failed to verify email service after ${retries} attempts: ${error.message}`,
          metrics,
        };
      }
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempts - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Function to send email
const sendEmail = async (EmailTemplate, data) => {
  try {
    // Validate data
    if (!data.email) {
      throw new Error('Recipient email is required in data');
    }

    // Generate email content from template
    const templateResult = EmailTemplate(data);
    const { subject, html, attachments = [] } = templateResult;

    // Email options with custom headers
    const mailOptions = {
      from: data.sender || `"Your App Name" <${process.env.EMAIL_USER}>`,
      to: data.email,
      subject,
      html,
      attachments,
      headers: {
        'X-Email-Service': process.env.EMAIL_SERVICE || 'CustomSMTP',
        'X-Message-ID': `msg-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        ...(data.customHeaders || {}),
      },
    };

    // Send email with primary transporter
    let transporter = createTransporter();
    let info;
    try {
      info = await transporter.sendMail(mailOptions);
      metrics.emailsSent++;
      console.log('Email sent: %s', info.messageId);
      return { success: true, messageId: info.messageId, metrics };
    } catch (error) {
      console.error('Primary transporter failed:', error.message);
      // Try fallback transporter if configured
      const fallbackTransporter = createFallbackTransporter();
      if (fallbackTransporter) {
        try {
          info = await fallbackTransporter.sendMail(mailOptions);
          metrics.emailsSent++;
          console.log('Email sent via fallback: %s', info.messageId);
          return { success: true, messageId: info.messageId, metrics, usedFallback: true };
        } catch (fallbackError) {
          metrics.emailsFailed++;
          console.error('Fallback transporter failed:', fallbackError.message);
          return { success: false, error: `Failed to send email with primary and fallback transporters: ${fallbackError.message}`, metrics };
        }
      }
      metrics.emailsFailed++;
      throw error;
    }
  } catch (error) {
    metrics.emailsFailed++;
    console.error('Error sending email:', error);
    return { success: false, error: error.message, metrics };
  }
};

// Get metrics for monitoring
const getMetrics = () => metrics;

module.exports = { createTransporter, verifyEmailConnection, sendEmail, getMetrics };