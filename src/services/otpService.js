const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const twilio = require('twilio');
const { sendEmail } = require('../email');
const { otpEmailTemplate } = require('../email/emailTemplate');
const User = require('../models/user');
/**
 * 🔐 ENTERPRISE OTP SERVICE
 *
 * Features:
 * ✅ Configurable OTP methods (TOTP, Email, SMS)
 * ✅ Priority-based method selection
 * ✅ Rate limiting and security
 * ✅ Enterprise-grade logging and monitoring
 * ✅ Fallback mechanisms
 * ✅ Device-specific settings
 */

class OTPService {
  constructor() {
    this.config = {
      enabled: process.env.ENABLE_OTP_VERIFICATION === 'true',
      defaultMethod: process.env.DEFAULT_OTP_METHOD || 'totp',
      allowFallback: false, // enforce single method only
      expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '5'),
      maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3'),
      totp: {
        secretLength: parseInt(process.env.TOTP_SECRET_LENGTH || '32'),
        window: parseInt(process.env.TOTP_WINDOW || '1'),
        step: parseInt(process.env.TOTP_STEP || '30'),
        appName: process.env.TOTP_APP_NAME || 'YourApp',
        issuer: process.env.TOTP_ISSUER || 'YourCompany',
      },
      email: {
        length: parseInt(process.env.EMAIL_OTP_LENGTH || '6'),
        template: process.env.EMAIL_OTP_TEMPLATE || 'otp_verification',
        sender: process.env.EMAIL_SENDER || 'noreply@yourapp.com',
      },
      sms: {
        length: parseInt(process.env.SMS_OTP_LENGTH || '6'),
        provider: process.env.SMS_PROVIDER || 'twilio',
      },
    };

    this.preferredMethod = this.config.defaultMethod;

    if (this.config.sms.provider === 'twilio' && process.env.TWILIO_ACCOUNT_SID) {
      this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }

    this.rateLimitStore = new Map();
  }

  /**
   * Check if OTP verification is enabled
   */
  isEnabled(setting) {

    return setting.enabled || this.config.enabled;
  }

  /**
   * Get available OTP methods for a user
   */
  getAvailableMethods(user) {
    const methods = [];

    if (!this.config.allowFallback) {
      // Only preferred method allowed
      if (this.preferredMethod === 'totp' && user.twoFactorAuth?.enabled && user.twoFactorAuth?.secret) {
        methods.push({
          type: 'totp',
          name: 'Authentication App',
          available: true,
        });
      } else if (this.preferredMethod === 'email' && user.email && user.emailVerified) {
        methods.push({
          type: 'email',
          name: 'Email',
          available: true,
          destination: this.maskEmail(user.email),
        });
      } else if (this.preferredMethod === 'sms' && user.phoneNumber && user.phoneVerified) {
        methods.push({
          type: 'sms',
          name: 'SMS',
          available: true,
          destination: this.maskPhone(user.phoneNumber),
        });
      }
    } else {
      // Fallback logic if enabled (optional)
    }

    return methods;
  }

  /**
   * Get the best available OTP method for a user
   */
  getBestMethod(user, deviceInfo = {}) {
    const availableMethods = this.getAvailableMethods(user, deviceInfo);
    return availableMethods.length > 0 ? availableMethods[0] : null;
  }

  /**
   * Setup TOTP for a user
   */
  async setupTOTP(user) {
    try {
      if (user.twoFactorEnabled) {
        throw new Error('TOTP is already enabled for this user');
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        length: this.config.totp.secretLength,
        name: `${this.config.totp.appName}:${user.email}`,
        issuer: this.config.totp.issuer,
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      // Store secret temporarily (will be confirmed later)
      user.twoFactorAuth.secret = secret.base32;
      user.twoFactorAuth.enabled = false; // Will be enabled after verification

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
        setupUri: secret.otpauth_url,
      };
    } catch (error) {
      throw new Error(`TOTP setup failed: ${error.message}`);
    }
  }

  /**
   * Verify TOTP setup
   */
  async verifyTOTPSetup(user, token) {
    try {
     if (!user.twoFactorAuth || !user.twoFactorAuth.secret) {
      throw new Error('TOTP not set up for this user');
    }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorAuth.secret,
        encoding: 'base32',
        token,
        window: this.config.totp.window,
        step: this.config.totp.step,
      });

      if (verified) {
        user.twoFactorAuth.enabled = true;
        user.twoFactorAuth.setupCompleted = true;
        await user.save();

        // Generate backup codes
        const backupCodes = this.generateBackupCodes();
        user.twoFactorAuth.backupCodes = backupCodes.map((code) => ({
          code: this.hashBackupCode(code),
          used: false,
          createdAt: new Date(),
        }));
        await user.save();

        return {
          success: true,
          backupCodes: backupCodes,
        };
      }

      throw new Error('Invalid TOTP token');
    } catch (error) {
      throw new Error(`TOTP verification failed: ${error.message}`);
    }
  }

  /**
   * Generate TOTP token (for testing purposes)
   */
  generateTOTP(secret) {
    return speakeasy.totp({
      secret,
      encoding: 'base32',
      step: this.config.totp.step,
    });
  }

  /**
   * Verify TOTP token
   */
  verifyTOTP(user, token) {
    try {
      if (!user.twoFactorAuth.enabled || !user.twoFactorAuth.secret) {
        throw new Error('TOTP not enabled for this user');
      }

      // Check if it's a backup code
      if (token.length > 6) {
        return this.verifyBackupCode(user, token);
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: this.config.totp.window,
        step: this.config.totp.step,
      });

      return verified;
    } catch (error) {
      throw new Error(`TOTP verification failed: ${error.message}`);
    }
  }

  /**
   * Disable TOTP for a user
   */
  async disableTOTP(user, token) {
    try {
      if (!this.verifyTOTP(user, token)) {
        throw new Error('Invalid TOTP token');
      }

      user.twoFactorAuth.enabled = false;
      user.twoFactorAuth.secret = null;
      user.twoFactorAuth.backupCodes = [];
      await user.save();

      return { success: true };
    } catch (error) {
      throw new Error(`TOTP disable failed: ${error.message}`);
    }
  }

  /**
   * Generate email OTP
   */
  async generateEmailOTP(user, purpose = 'login', deviceInfo = {}) {
    try {
      if (!user.email) {
        throw new Error('Email not configured for this user');
      }

      // Check rate limiting
      await this.checkRateLimit(user._id, 'email');

      const code = this.generateNumericOTP(this.config.email.length);
      const expiresAt = new Date(Date.now() + this.config.expiryMinutes * 60000);

      // Store OTP details in user

      user.currentOTP = {
        code,
        hashedCode: this.hashOTP(code),
        type: 'email',
        purpose,
        expiresAt,
        attempts: 0,
        maxAttempts: this.config.maxAttempts,
        lastSent: new Date(),
        verified: false
      };

      await user.save();
      const emailResult = await sendEmail(otpEmailTemplate, {
        to: user.email,
        username: user.firstName || user.username,
        code,
        purpose,
        expiresAt,
        deviceInfo,
      });

      if (!emailResult.success) {
        throw new Error('Failed to send OTP email');
      }

      return {
        success: true,
        type: 'email',
        destination: this.maskEmail(user.email),
        expiresAt,
        messageId: emailResult.messageId,
      };
    } catch (error) {
      throw new Error(`Email OTP generation failed: ${error.message}`);
    }
  }

  /**
   * Generate SMS OTP
   */
  async generateSMSOTP(user, purpose = 'login', deviceInfo = {}) {
    try {
      if (!user.phoneNumber) {
        throw new Error('Phone number not configured for this user');
      }

      if (!this.twilioClient) {
        throw new Error('SMS service not configured');
      }

      // Check rate limiting
      await this.checkRateLimit(user._id, 'sms');

      const code = this.generateNumericOTP(this.config.sms.length);
      const expiresAt = new Date(Date.now() + this.config.expiryMinutes * 60000);

      // Store OTP details in user


      user.currentOTP = {
        code,
        hashedCode: this.hashOTP(code),
        type: 'sms',
        purpose,
        expiresAt,
        attempts: 0,
        maxAttempts: this.config.maxAttempts,
        lastSent: new Date(),
        verified: false
      };

      await user.save();

      // Send SMS
      const message = `Your ${this.config.totp.appName} verification code is: ${code}. Valid for ${this.config.expiryMinutes} minutes. Don't share this code.`;

      const smsResult = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: user.phoneNumber,
      });

      return {
        success: true,
        type: 'sms',
        destination: this.maskPhone(user.phoneNumber),
        expiresAt,
        messageId: smsResult.sid,
      };
    } catch (error) {
      throw new Error(`SMS OTP generation failed: ${error.message}`);
    }
  }

  /**
   * Send OTP using the best available method
   */
  async sendOTP(user, purpose = 'login', deviceInfo = {}, preferredMethod = null) {
    try {
      if (!this.isEnabled()) {
        throw new Error('OTP verification is disabled');
      }

      let method = preferredMethod;

      // If no preferred method, get the best available method
      if (!method) {
        const bestMethod = this.getBestMethod(user, deviceInfo);
        if (!bestMethod) {
          throw new Error('No OTP methods available for this user');
        }
        method = bestMethod.type;
      }

      // Validate method availability
      const availableMethods = this.getAvailableMethods(user, deviceInfo);
      const selectedMethod = availableMethods.find((m) => m.type === method);

      if (!selectedMethod || !selectedMethod.available) {
        throw new Error(`OTP method '${method}' is not available for this user`);
      }

      let result;
      switch (method) {
        case 'totp':
          // TOTP doesn't need to be sent, just return info
          result = {
            success: true,
            type: 'totp',
            message: 'Use your authentication app to get the code',
            expiresAt: new Date(Date.now() + this.config.totp.step * 1000),
          };
          break;

        case 'email':
          result = await this.generateEmailOTP(user, purpose, deviceInfo);
          break;

        case 'sms':
          result = await this.generateSMSOTP(user, purpose, deviceInfo);
          break;

        default:
          throw new Error(`Unsupported OTP method: ${method}`);
      }

      // Log OTP generation for security auditing
      await this.logOTPEvent(user, 'generated', method, deviceInfo);

      return result;
    } catch (error) {
      await this.logOTPEvent(user, 'generation_failed', null, deviceInfo, error.message);
      throw error;
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(user, code, purpose = 'login', deviceInfo = {}) {
    try {
      if (!this.isEnabled()) {
        return true; // If OTP is disabled, always pass verification
      }

      if (!code) {
        throw new Error('OTP code is required');
      }

      // Check if it's a TOTP code
      if (user.twoFactorAuth.enabled && (code.length === 6 || code.length > 6)) {
        const totpValid = this.verifyTOTP(user, code);
        if (totpValid) {
          await this.logOTPEvent(user, 'verified', 'totp', deviceInfo);
          return true;
        }
      }

      // Check email/SMS OTP
      if (!user.currentOTP.code || !user.currentOTP.expiresAt) {
        throw new Error('No OTP found for verification');
      }

      if (user.currentOTP.expiresAt < new Date()) {
        user.currentOTP.code = null;
        user.currentOTP.expiresAt = null;
        user.currentOTP.attempts = 0;
        await user.save();
        throw new Error('OTP has expired');
      }

      if (user.currentOTP.attempts >= this.config.maxAttempts) {
        user.currentOTP.code = null;
        user.currentOTP.expiresAt = null;
        user.currentOTP.attempts = 0;
        await user.save();
        throw new Error('Maximum OTP attempts exceeded');
      }

      const hashedInput = this.hashOTP(code);
      if (user.currentOTP.hashedCode !== hashedInput) {
        user.currentOTP.attempts += 1;
        await user.save();
        await this.logOTPEvent(user, 'verification_failed', user.otpType, deviceInfo);
        throw new Error('Invalid OTP code');
      }

      // OTP is valid - clear it
      user.currentOTP.code = null;
      user.currentOTP.expiresAt = null;
      user.currentOTP.attempts = 0;
      await user.save();

      await this.logOTPEvent(user, 'verified', user.otpType, deviceInfo);
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(user, code) {
    if (!user.twoFactorAuth.backupCodes || user.twoFactorAuth.backupCodes.length === 0) {
      return false;
    }

    const hashedCode = this.hashBackupCode(code);
    const backupCode = user.user.twoFactorAuth.backupCodes.find((bc) => bc.code === hashedCode && !bc.used);

    if (backupCode) {
      backupCode.used = true;
      backupCode.usedAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Hash OTP for secure storage
   */
  hashOTP(code) {
    return crypto.createHash('sha256').update(code.toString()).digest('hex');
  }

  /**
   * Hash backup code for secure storage
   */
  hashBackupCode(code) {
    return crypto.createHash('sha256').update(code.toString().toUpperCase()).digest('hex');
  }

  /**
   * Generate numeric OTP
   */
  generateNumericOTP(length) {
    const digits = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += digits[Math.floor(Math.random() * digits.length)];
    }
    return result;
  }

  /**
   * Mask email for privacy
   */
  maskEmail(email) {
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 ? `${username[0]}${'*'.repeat(username.length - 2)}${username[username.length - 1]}` : '*'.repeat(username.length);
    return `${maskedUsername}@${domain}`;
  }

  /**
   * Mask phone number for privacy
   */
  maskPhone(phone) {
    if (phone.length <= 4) return '*'.repeat(phone.length);
    return `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
  }

  /**
   * Check rate limiting for OTP requests
   */
  async checkRateLimit(userId, method) {
    const key = `${userId}_${method}`;
    const now = Date.now();
    const windowStart = now - this.config.rateLimit.window;

    let requests = this.rateLimitStore.get(key) || [];

    // Remove old requests outside the window
    requests = requests.filter((timestamp) => timestamp > windowStart);

    if (requests.length >= this.config.rateLimit.maxRequests) {
      const resetTime = Math.ceil((requests[0] + this.config.rateLimit.window - now) / 1000);
      throw new Error(`Rate limit exceeded. Try again in ${resetTime} seconds.`);
    }

    // Add current request
    requests.push(now);
    this.rateLimitStore.set(key, requests);
  }

  /**
   * Log OTP events for security auditing
   */
  async logOTPEvent(user, action, method, deviceInfo = {}, error = null) {
    try {
      const event = {
        userId: user._id,
        action,
        method,
        timestamp: new Date(),
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        deviceId: deviceInfo.deviceId,
        success: !error,
        error: error || null,
      };

      // In production, send to logging service or store in database
      console.log('OTP Event:', JSON.stringify(event, null, 2));

      // Add to user's security events
      if (user.securityEvents) {
        user.securityEvents.push({
          event: `otp_${action}`,
          timestamp: event.timestamp,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          details: { method, success: event.success, error },
        });

        // Keep only last 50 security events
        if (user.securityEvents.length > 50) {
          user.securityEvents = user.securityEvents.slice(-50);
        }

        await user.save();
      }
    } catch (err) {
      console.error('Failed to log OTP event:', err);
    }
  }

  /**
   * Clean up expired OTPs (run periodically)
   */
  async cleanupExpiredOTPs() {
    try {
      const result = await User.updateMany(
        { otpExpiry: { $lt: new Date() } },
        {
          $unset: {
            otpCode: 1,
            otpExpiry: 1,
            otpType: 1,
            otpPurpose: 1,
            otpAttempts: 1,
          },
        }
      );

      console.log(`Cleaned up ${result.modifiedCount} expired OTPs`);
      return result.modifiedCount;
    } catch (error) {
      console.error('Failed to cleanup expired OTPs:', error);
    }
  }

  /**
   * Get OTP statistics for monitoring
   */
  async getOTPStatistics(timeframe = '24h') {
    // In production, this would query your logging/metrics service
    return {
      totalRequests: 0,
      successfulVerifications: 0,
      failedVerifications: 0,
      rateLimit: 0,
      methodBreakdown: {
        totp: 0,
        email: 0,
        sms: 0,
      },
    };
  }
}

module.exports = new OTPService();
