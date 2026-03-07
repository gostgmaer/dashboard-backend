const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { email } = require('../config/setting');

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
  if (options.service && !options.host && !options.port) {
    return; // Service-based providers (e.g., 'sendgrid') may not need host/port
  }
  const requiredVars = [
    { name: 'EMAIL_USER', value: email.user },
    { name: 'EMAIL_HOST', value: email.host },
    { name: 'EMAIL_PORT', value: email.port }
  ];
  const missingVars = requiredVars.filter((v) => !v.value && !options[v.name.toLowerCase().replace('email_', '')]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required email configuration: ${missingVars.map(v => v.name).join(', ')}`);
  }
};

// Create transporter with dynamic provider support
const createTransporter = (options = {}) => {
  validateEnvVariables(options);

  const config = {
    // Use service if specified (e.g., 'gmail', 'sendgrid'), otherwise custom SMTP
    ...(options.service || email.service ? { service: options.service || email.service } : {}),
    host: options.host || email.host,
    port: parseInt(options.port || email.port) || 587,
    secure: options.secure !== undefined ? options.secure : email.secure,
    auth: {
      user: options.user || email.user,
      pass: options.pass || email.password,
    },
    // Connection pooling
    pool: email.pool,
    maxConnections: email.maxConnections || 5,
    maxMessages: email.maxMessages || 100,
    // Rate limiting
    rateLimit: email.rateLimit || 100,
    rateDelta: email.rateDelta || 60000,
    // Timeout settings
    connectionTimeout: email.connectionTimeout || 10000,
    greetingTimeout: email.greetingTimeout || 10000,
    // TLS settings
    tls: {
      rejectUnauthorized: email.tlsRejectUnauthorized,
      minVersion: email.tlsMinVersion || 'TLSv1.2',
    },
    logger: email.debug ? console : false,
    debug: email.debug || false,
  };

  // OAuth2 support for providers that support it
  if (email.oauth2ClientId && email.oauth2ClientSecret && email.oauth2RefreshToken) {
    config.auth = {
      type: 'OAuth2',
      user: options.user || email.user,
      clientId: email.oauth2ClientId,
      clientSecret: email.oauth2ClientSecret,
      refreshToken: email.oauth2RefreshToken,
      accessToken: async () => {
        try {
          const oauth2Client = new OAuth2Client(
            email.oauth2ClientId,
            email.oauth2ClientSecret,
            email.oauth2RedirectUri || 'https://developers.google.com/oauthplayground'
          );
          oauth2Client.setCredentials({
            refresh_token: email.oauth2RefreshToken,
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
  if (!email.fallback.host && !email.fallback.service) return null;
  return createTransporter({
    service: email.fallback.service,
    host: email.fallback.host,
    port: email.fallback.port,
    secure: email.fallback.secure,
    user: email.fallback.user,
    pass: email.fallback.password,
  });
};

// Verify email connection with exponential backoff
const verifyEmailConnection = async (retries = email.verifyRetries || 3, baseDelay = email.verifyDelay || 2000) => {
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
      from: data.sender || `"${email.senderName}" <${email.user}>`,
      to: data.email,
      subject,
      html,
      attachments,
      headers: {
        'X-Email-Service': email.service || 'CustomSMTP',
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