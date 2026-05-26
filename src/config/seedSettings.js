/**
 * seedSettings.js
 * Seeding script to populate default settings for active tenants on first run
 */
const Setting = require('../models/Setting');

const seedSettings = async () => {
  try {
    const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
    
    // Seed default settings for main active tenant
    const existingTenant = await Setting.findOne({ siteKey: activeTenantKey });
    if (!existingTenant) {
      console.log(`🌱 Seeding default settings for tenant: ${activeTenantKey}`);
      await Setting.create({
        siteKey: activeTenantKey,
        siteName: process.env.BRAND_NAME || 'My Store',
        name: process.env.APPLICATION_NAME || 'Store Application',
        isLive: true,
        maintenanceMode: false,
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
        branding: {
          logo: '',
          favicon: '',
          themeColor: '#4f46e5',
        },
        currency: process.env.CURRENCY || 'USD',
        currencySymbol: '$',
        taxRate: 0,
        smtpHost: process.env.EMAIL_HOST || '',
        smtpPort: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587,
        smtpUser: process.env.EMAIL_USER || '',
        smtpPassword: process.env.EMAIL_PASS || '',
        stripeEnabled: process.env.STRIPE_ENABLED === 'true' || true,
        stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        paypalEnabled: process.env.PAYPAL_ENABLED === 'true' || true,
        paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
        paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
        paypalMode: process.env.PAYPAL_MODE || 'sandbox',
        paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID || '',
        razorpayEnabled: process.env.RAZORPAY_ENABLED === 'true' || true,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
        razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
        razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
        otpEnabled: process.env.ENABLE_OTP_VERIFICATION === 'true' || false,
        otpDefaultMethod: process.env.DEFAULT_OTP_METHOD || 'email',
        otpExpiryMinutes: process.env.OTP_EXPIRY_MINUTES ? parseInt(process.env.OTP_EXPIRY_MINUTES, 10) : 5,
        otpMaxAttempts: process.env.OTP_MAX_ATTEMPTS ? parseInt(process.env.OTP_MAX_ATTEMPTS, 10) : 3,
        otpLength: process.env.SMS_OTP_LENGTH ? parseInt(process.env.SMS_OTP_LENGTH, 10) : 6,
      });
      console.log('✅ Settings seed successful');
    } else {
      // Tenant exists, but check if we need to update/merge newly introduced fields
      let needsUpdate = false;
      const updateData = {};
      
      const checkAndAdd = (fieldPath, envValue, defaultValue) => {
        const parts = fieldPath.split('.');
        let val = existingTenant;
        for (const p of parts) {
          val = val ? val[p] : undefined;
        }
        if (val === undefined) {
          updateData[fieldPath] = envValue !== undefined ? envValue : defaultValue;
          needsUpdate = true;
        }
      };

      // SMTP Email Defaults (fallback to standard Brevo info from our original .env if env vars are undefined/commented)
      checkAndAdd('smtpHost', process.env.EMAIL_HOST, '');
      checkAndAdd('smtpPort', process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587, 587);
      checkAndAdd('smtpUser', process.env.EMAIL_USER, '');
      checkAndAdd('smtpPassword', process.env.EMAIL_PASS, '');

      // Stripe Defaults
      checkAndAdd('stripeEnabled', process.env.STRIPE_ENABLED === 'true', true);
      checkAndAdd('stripePublicKey', process.env.STRIPE_PUBLISHABLE_KEY, '');
      checkAndAdd('stripeSecretKey', process.env.STRIPE_SECRET_KEY, '');
      checkAndAdd('stripeWebhookSecret', process.env.STRIPE_WEBHOOK_SECRET, '');

      // PayPal Defaults
      checkAndAdd('paypalEnabled', process.env.PAYPAL_ENABLED === 'true', true);
      checkAndAdd('paypalClientId', process.env.PAYPAL_CLIENT_ID, '');
      checkAndAdd('paypalClientSecret', process.env.PAYPAL_CLIENT_SECRET, '');
      checkAndAdd('paypalMode', process.env.PAYPAL_MODE, 'sandbox');
      checkAndAdd('paypalWebhookId', process.env.PAYPAL_WEBHOOK_ID, '');

      // Razorpay Defaults
      checkAndAdd('razorpayEnabled', process.env.RAZORPAY_ENABLED === 'true', true);
      checkAndAdd('razorpayKeyId', process.env.RAZORPAY_KEY_ID, '');
      checkAndAdd('razorpayKeySecret', process.env.RAZORPAY_KEY_SECRET, '');
      checkAndAdd('razorpayWebhookSecret', process.env.RAZORPAY_WEBHOOK_SECRET, '');

      // OTP Defaults
      checkAndAdd('otpEnabled', process.env.ENABLE_OTP_VERIFICATION === 'true', false);
      checkAndAdd('otpDefaultMethod', process.env.DEFAULT_OTP_METHOD, 'email');
      checkAndAdd('otpExpiryMinutes', process.env.OTP_EXPIRY_MINUTES ? parseInt(process.env.OTP_EXPIRY_MINUTES, 10) : 5, 5);
      checkAndAdd('otpMaxAttempts', process.env.OTP_MAX_ATTEMPTS ? parseInt(process.env.OTP_MAX_ATTEMPTS, 10) : 3, 3);
      checkAndAdd('otpLength', process.env.SMS_OTP_LENGTH ? parseInt(process.env.SMS_OTP_LENGTH, 10) : 6, 6);

      if (needsUpdate) {
        console.log(`🌱 Updating/Merging new settings fields for existing tenant: ${activeTenantKey}`);
        await Setting.findOneAndUpdate({ siteKey: activeTenantKey }, { $set: updateData }, { new: true });
      } else {
        console.log(`ℹ️ Settings for tenant: ${activeTenantKey} are fully up-to-date`);
      }
    }

    // Seed fallback legacy 'sitekey' tenant for backward compatibility if missing
    const existingLegacy = await Setting.findOne({ siteKey: 'sitekey' });
    if (!existingLegacy && activeTenantKey !== 'sitekey') {
      console.log('🌱 Seeding legacy backup tenant: sitekey');
      await Setting.create({
        siteKey: 'sitekey',
        siteName: 'Backup Store',
        isLive: true,
        contactInfo: { email: '' }
      });
    }

  } catch (error) {
    console.error('❌ Failed to seed settings:', error.message);
  }
};

module.exports = seedSettings;
