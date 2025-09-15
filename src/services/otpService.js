
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { emailPort ,emailHost} = require('../config/setting');

class OTPService {
  constructor() {
    // Email transporter
    this.emailTransporter = nodemailer.createTransporter({
      host: emailHost,
      port: emailPort || 587,
      secure: false,
      auth: {
        user: mailUserName,
        pass: mailPassword
      }
    });

    // SMS client (Twilio)
    if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.smsClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    }
  }

  /**
   * Send OTP via email
   */
  async sendEmailOTP(email, code, purpose = 'login') {
    try {
      const subject = this.getEmailSubject(purpose);
      const html = this.getEmailTemplate(code, purpose);

      await this.emailTransporter.sendMail({
        from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
        to: email,
        subject,
        html
      });

      return { success: true, message: 'OTP sent via email' };
    } catch (error) {
      console.error('Email OTP error:', error);
      throw new Error('Failed to send email OTP');
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendSMSOTP(phoneNumber, code, purpose = 'login') {
    try {
      if (!this.smsClient) {
        throw new Error('SMS service not configured');
      }

      const message = this.getSMSTemplate(code, purpose);

      await this.smsClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      return { success: true, message: 'OTP sent via SMS' };
    } catch (error) {
      console.error('SMS OTP error:', error);
      throw new Error('Failed to send SMS OTP');
    }
  }

  /**
   * Send OTP via voice call
   */
  async sendVoiceOTP(phoneNumber, code) {
    try {
      if (!this.smsClient) {
        throw new Error('Voice service not configured');
      }

      const message = `Your verification code is: ${code.split('').join(', ')}. I repeat: ${code.split('').join(', ')}`;

      await this.smsClient.calls.create({
        twiml: `<Response><Say>${message}</Say></Response>`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      return { success: true, message: 'OTP sent via voice call' };
    } catch (error) {
      console.error('Voice OTP error:', error);
      throw new Error('Failed to send voice OTP');
    }
  }

  /**
   * Get email subject based on purpose
   */
  getEmailSubject(purpose) {
    const subjects = {
      login: 'Your Login Verification Code',
      password_reset: 'Your Password Reset Code',
      email_verification: 'Verify Your Email Address',
      mfa: 'Your Multi-Factor Authentication Code',
      transaction: 'Transaction Verification Code'
    };

    return subjects[purpose] || 'Your Verification Code';
  }

  /**
   * Get email template
   */
  getEmailTemplate(code, purpose) {
    const appName = process.env.APP_NAME || 'Your App';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
          .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .otp-code { 
            font-size: 32px; 
            font-weight: bold; 
            color: #007bff; 
            text-align: center; 
            letter-spacing: 5px;
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer { background-color: #f8f9fa; padding: 15px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${appName}</h1>
          </div>
          <div class="content">
            <h2>Verification Code</h2>
            <p>Your verification code for ${purpose.replace('_', ' ')} is:</p>
            <div class="otp-code">${code}</div>
            <p>This code will expire in ${this.getExpiryMinutes(purpose)} minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get SMS template
   */
  getSMSTemplate(code, purpose) {
    const appName = process.env.APP_NAME || 'Your App';
    return `${appName}: Your verification code is ${code}. Valid for ${this.getExpiryMinutes(purpose)} minutes. Don't share this code.`;
  }

  /**
   * Get expiry minutes based on purpose
   */
  getExpiryMinutes(purpose) {
    const expiries = {
      login: 5,
      password_reset: 10,
      email_verification: 30,
      mfa: 5,
      transaction: 5
    };

    return expiries[purpose] || 10;
  }
}

module.exports = new OTPService();