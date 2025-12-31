const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { mailService, mailUserName, mailPassword, emailHost, emailPort, emailSecure, mailSender, oauth2ClientId, oauth2ClientSecret, oauth2RefreshToken, oauth2RedirectUri, fallbackMailService, fallbackEmailHost, fallbackEmailPort, fallbackEmailSecure, fallbackEmailUser, fallbackEmailPassword, emailPool, emailMaxConnections, emailMaxMessages, emailRateLimit, emailRateDelta, emailConnectionTimeout, emailGreetingTimeout, emailTlsRejectUnauthorized, emailTlsMinVersion, emailDebug, emailVerifyRetries, emailVerifyDelay } = require('../config/setting');

// Metrics for monitoring email service performance
const metrics = {
  connectionAttempts: 0,
  connectionSuccesses: 0,
  connectionFailures: 0,
  emailsSent: 0,
  emailsFailed: 0,
};

/**
 * Validates required email configuration variables.
 * Skips host/port validation if a service is specified.
 * @param {Object} options - Optional override for configuration.
 * @throws {Error} If required variables are missing. 
 */
const validateEmailConfig = (options = {}) => {
  const requiredVars = ['mailUserName', 'emailHost', 'emailPort'];
  if (options.service || mailService) return;
  const missingVars = requiredVars.filter((key) => !options[key.toLowerCase()] && !eval(key));
  if (missingVars.length > 0) {
    throw new Error(`Missing required email configuration: ${missingVars.join(', ')}`);
  }
};

/**
 * Creates a Nodemailer transporter configuration.
 * @param {Object} options - Optional override for configuration.
 * @returns {Object} Nodemailer transporter configuration.
 */
const buildTransporterConfig = (options = {}) => {
  const config = {
    ...(options.service || mailService ? { service: options.service || mailService } : {}),
    host: options.host || emailHost,
    port: parseInt(options.port || emailPort) || 587,
    secure: options.secure || emailSecure,
    auth: {
      user: options.user || mailUserName,
      pass: options.pass || mailPassword,
    },
    logger: emailDebug ? console : false,
    debug: emailDebug,
  };

  // Configure OAuth2 ONLY for Gmail
  const isGmail = (options.service || mailService) === 'gmail';
  if (isGmail && oauth2ClientId && oauth2ClientSecret && oauth2RefreshToken) {
    config.auth = {
      type: 'OAuth2',
      user: options.user || mailUserName,
      clientId: oauth2ClientId,
      clientSecret: oauth2ClientSecret,
      refreshToken: oauth2RefreshToken,
      accessToken: async () => {
        try {
          const oauth2Client = new OAuth2Client(oauth2ClientId, oauth2ClientSecret, oauth2RedirectUri);
          oauth2Client.setCredentials({ refresh_token: oauth2RefreshToken });
          const { token } = await oauth2Client.getAccessToken();
          return token;
        } catch (error) {
          throw new Error(`Failed to obtain OAuth2 access token: ${error.message}`);
        }
      },
    };
    delete config.authMethod; // Remove authMethod for OAuth2
  }

  return config;
};

/**
 * Creates a Nodemailer transporter.
 * @param {Object} options - Optional override for configuration.
 * @returns {Object} Nodemailer transporter instance.
 */
const createTransporter = (options = {}) => {
  validateEmailConfig(options);
  const config = buildTransporterConfig(options);
  return nodemailer.createTransport(config);
};

/**
 * Creates a fallback transporter if configured.
 * @returns {Object|null} Fallback transporter instance or null.
 */
const createFallbackTransporter = () => {
  if (!fallbackEmailHost && !fallbackMailService) return null;
  return createTransporter({
    service: fallbackMailService,
    host: fallbackEmailHost,
    port: fallbackEmailPort,
    secure: fallbackEmailSecure,
    user: fallbackEmailUser,
    pass: fallbackEmailPassword,
  });
};

/**
 * Verifies email service connection with retry and fallback support.
 * @param {number} retries - Number of retry attempts.
 * @param {number} baseDelay - Base delay for exponential backoff (ms).
 * @returns {Promise<Object>} Verification result with success status and metrics.
 */
const verifyEmailConnection = async (retries = emailVerifyRetries, baseDelay = emailVerifyDelay) => {
  let attempts = 0;
  metrics.connectionAttempts++;

  while (attempts < retries) {
    try {
      const transporter = createTransporter();
      await transporter.verify();-
      metrics.connectionSuccesses++;
      return '✅ Email service connection verified';
      //  return { success: true, message: 'Email service connection verified', metrics };
    } catch (error) {
      attempts++;
      metrics.connectionFailures++;
      console.error(`❌ Email service error (attempt ${attempts}/${retries}): ${error.message}`);
      if (attempts === retries) {
        const fallbackTransporter = createFallbackTransporter();
        if (fallbackTransporter) {
          try {
            await fallbackTransporter.verify();
            console.log('✅ Fallback email service is ready');
            metrics.connectionSuccesses++;
            return { success: true, message: 'Fallback email service connection verified', metrics };
          } catch (fallbackError) {
            console.error(`❌ Fallback email service error: ${fallbackError.message}`);
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
      const delay = baseDelay * Math.pow(2, attempts - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

/**
 * Sends an email using the provided template and data.
 * @param {Function} EmailTemplate - Template function returning subject, html, and optional attachments.
 * @param {Object} data - Data for the template, including recipient email.
 * @returns {Promise<Object>} Result with success status, message ID, and metrics.
 */
const sendEmail = async (EmailTemplate, data) => {
  try {
    if (!data.email) {
      throw new Error('Recipient email is required in data');
    }

    const { subject, html, attachments = [] } = EmailTemplate(data);
    const mailOptions = {
      from: mailSender || `"Easy Dev" <${mailSender}>`,
      to: data.email,
      subject,
      html,
      attachments,
      headers: {
        'X-Email-Service': mailService || 'CustomSMTP',
        'X-Message-ID': `msg-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        ...(data.customHeaders || {}),
      },
    };

    let transporter = createTransporter();
    let info;
    try {
      info = await transporter.sendMail(mailOptions);
      metrics.emailsSent++;
      console.log(`Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId, metrics };
    } catch (error) {
      console.error(`Primary transporter failed: ${error.message}`);
      const fallbackTransporter = createFallbackTransporter();
      if (fallbackTransporter) {
        try {
          info = await fallbackTransporter.sendMail(mailOptions);
          metrics.emailsSent++;
          console.log(`Email sent via fallback: ${info.messageId}`);
          return { success: true, messageId: info.messageId, metrics, usedFallback: true };
        } catch (fallbackError) {
          metrics.emailsFailed++;
          console.error(`Fallback transporter failed: ${fallbackError.message}`);
          return {
            success: false,
            error: `Failed to send email with primary and fallback transporters: ${fallbackError.message}`,
            metrics,
          };
        }
      }
      metrics.emailsFailed++;
      throw error;
    }
  } catch (error) {
    metrics.emailsFailed++;
    console.error(`Error sending email: ${error.message}`);
    return { success: false, error: error.message, metrics };
  }
};

const getMetrics = () => metrics;

module.exports = { createTransporter, verifyEmailConnection, sendEmail, getMetrics };
