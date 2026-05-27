const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { email } = require('../config/setting');

/**
 * Email service — uses the real-time Proxy-backed `email` config section.
 *
 * All settings (host, user, password, service, OAuth2, fallback, etc.) are
 * read from the in-memory DB settings cache on every transporter creation.
 * This means updating email settings in the admin dashboard takes effect
 * immediately without a server restart.
 */

// ── Metrics ──────────────────────────────────────────────────────────────────

const metrics = {
  connectionAttempts: 0,
  connectionSuccesses: 0,
  connectionFailures: 0,
  emailsSent: 0,
  emailsFailed: 0,
};

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate that required email config is present.
 * Skip host/port validation when a named service (e.g. 'gmail') is set.
 * This runs at transporter creation time (not at module load), so the DB
 * cache is guaranteed to be warm.
 */
const validateEmailConfig = (options = {}) => {
  const effectiveService = options.service || email.service;
  if (effectiveService) return; // Named service handles its own routing

  const effectiveHost = options.host || email.host;
  const effectiveUser = options.user || email.user;

  const missing = [];
  if (!effectiveUser) missing.push('email.user');
  if (!effectiveHost) missing.push('email.host');

  if (missing.length > 0) {
    throw new Error(`Missing required email configuration: ${missing.join(', ')}`);
  }
};

// ── Transporter Builder ───────────────────────────────────────────────────────

/**
 * Build a nodemailer transporter config from DB-backed settings.
 * All values resolve from the Proxy on each call — live updates.
 *
 * @param {Object} options — Per-call overrides (service, host, user, pass, etc.)
 */
const buildTransporterConfig = async (options = {}) => {
  const host    = options.host    || email.host    || '';
  const port    = Number.parseInt(String(options.port || email.port || 587), 10);
  const secure  = options.secure  !== undefined ? options.secure : (port === 465 || email.secure);
  const user    = options.user    || email.user    || '';
  const pass    = options.pass    || email.password || '';
  const service = options.service || email.service  || null;

  const config = {
    ...(service ? { service } : { host, port, secure }),
    auth: { user, pass },
    pool: email.pool !== false,
    maxConnections: email.maxConnections || 5,
    maxMessages:    email.maxMessages    || 100,
    rateLimit:      email.rateLimit      || 100,
    rateDelta:      email.rateDelta      || 60000,
    connectionTimeout: email.connectionTimeout || 10000,
    greetingTimeout:   email.greetingTimeout   || 10000,
    tls: {
      rejectUnauthorized: email.tlsRejectUnauthorized !== false,
      minVersion: email.tlsMinVersion || 'TLSv1.2',
    },
    logger: email.debug ? console : false,
    debug: email.debug || false,
  };

  // ── OAuth2 (Gmail only) ─────────────────────────────────────────────────────
  const isGmail  = service === 'gmail';
  const clientId = email.oauth2ClientId;
  const clientSecret = email.oauth2ClientSecret;
  const refreshToken = email.oauth2RefreshToken;
  const redirectUri  = email.oauth2RedirectUri  || 'https://developers.google.com/oauthplayground';

  if (isGmail && clientId && clientSecret && refreshToken) {
    config.auth = {
      type: 'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken,
      accessToken: async () => {
        try {
          const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
          oauth2Client.setCredentials({ refresh_token: refreshToken });
          const { token } = await oauth2Client.getAccessToken();
          return token;
        } catch (err) {
          throw new Error(`Failed to obtain OAuth2 access token: ${err.message}`);
        }
      },
    };
  }

  return config;
};

// ── Transporter Factory ───────────────────────────────────────────────────────

const createTransporter = async (options = {}) => {
  validateEmailConfig(options);
  const config = await buildTransporterConfig(options);
  return nodemailer.createTransport(config);
};

const createFallbackTransporter = async () => {
  const fb = email.fallback || {};
  if (!fb.host && !fb.service) return null;
  return createTransporter({
    service: fb.service,
    host:    fb.host,
    port:    fb.port,
    secure:  fb.secure,
    user:    fb.user,
    pass:    fb.password,
  });
};

// ── Connection Verification ───────────────────────────────────────────────────

/**
 * Verify the email service connection with retry + exponential backoff.
 * If the primary fails all retries, attempts the fallback transporter.
 */
const verifyEmailConnection = async (
  retries   = email.verifyRetries  || 3,
  baseDelay = email.verifyDelay    || 2000,
) => {
  let attempts = 0;
  metrics.connectionAttempts++;

  while (attempts < retries) {
    try {
      const transporter = await createTransporter();
      await transporter.verify();
      metrics.connectionSuccesses++;
      return '✅ Email service connection verified';
    } catch (error) {
      attempts++;
      metrics.connectionFailures++;
      console.error(`❌ Email service error (attempt ${attempts}/${retries}): ${error.message}`);

      if (attempts === retries) {
        // Try fallback
        const fallbackTransporter = await createFallbackTransporter();
        if (fallbackTransporter) {
          try {
            await fallbackTransporter.verify();
            console.log('✅ Fallback email service is ready');
            metrics.connectionSuccesses++;
            return { success: true, message: 'Fallback email service connection verified', metrics };
          } catch (fallbackError) {
            console.error(`❌ Fallback email service error: ${fallbackError.message}`);
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

// ── Send Email ────────────────────────────────────────────────────────────────

/**
 * Send an email using a template function.
 *
 * @param {Function} EmailTemplate — Called with `data`, returns { subject, html, attachments? }
 * @param {Object}   data          — Template data; must include `data.email` (recipient)
 */
const sendEmail = async (EmailTemplate, data) => {
  try {
    if (!data.email) {
      throw new Error('Recipient email is required in data');
    }

    const { subject, html, attachments = [] } = EmailTemplate(data);
    const sender = email.sender || email.user;

    const displayName = email.name || email.senderName;
    const mailOptions = {
      from: displayName ? `"${displayName}" <${sender}>` : sender,
      to:   data.email,
      subject,
      html,
      attachments,
      headers: {
        'X-Email-Service': email.service || 'CustomSMTP',
        'X-Message-ID': `msg-${Date.now()}-${Math.random().toString(36).substring(2)}`,
        ...(data.customHeaders || {}),
      },
    };

    let transporter;
    try {
      transporter = await createTransporter();
    } catch (configError) {
      console.error(`Email config error: ${configError.message}`);
      return { success: false, error: configError.message, metrics };
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      metrics.emailsSent++;
      console.log(`Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId, metrics };
    } catch (sendError) {
      console.error(`Primary transporter failed: ${sendError.message}`);

      const fallbackTransporter = await createFallbackTransporter();
      if (fallbackTransporter) {
        try {
          const info = await fallbackTransporter.sendMail(mailOptions);
          metrics.emailsSent++;
          console.log(`Email sent via fallback: ${info.messageId}`);
          return { success: true, messageId: info.messageId, metrics, usedFallback: true };
        } catch (fallbackError) {
          metrics.emailsFailed++;
          console.error(`Fallback transporter failed: ${fallbackError.message}`);
          return {
            success: false,
            error: `Failed with primary and fallback: ${fallbackError.message}`,
            metrics,
          };
        }
      }

      metrics.emailsFailed++;
      throw sendError;
    }
  } catch (error) {
    metrics.emailsFailed++;
    console.error(`Error sending email: ${error.message}`);
    return { success: false, error: error.message, metrics };
  }
};

// ── Exports ───────────────────────────────────────────────────────────────────

const getMetrics = () => metrics;

module.exports = { createTransporter, verifyEmailConnection, sendEmail, getMetrics };
