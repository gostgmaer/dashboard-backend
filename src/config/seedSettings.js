/**
 * seedSettings.js
 * Seeding script to populate default settings as key-value pairs for active tenants on first run
 */
const Setting = require('../models/Setting');

const seedSettings = async () => {
  try {
    const activeTenantKey = process.env.NEXT_PUBLIC_SITEKEY || 'my-store-001';
    
    // Clean up any legacy settings documents (those without a 'key' field)
    await Setting.deleteMany({ key: { $exists: false } });
    
    // Drop legacy unique index on siteKey to allow multiple documents per tenant
    try {
      await Setting.collection.dropIndex('siteKey_1');
      console.log('✅ Dropped legacy unique siteKey_1 index');
    } catch (err) {
      // Index might not exist, ignore
    }
    
    // Construct default nested settings object
    const defaultSettingsObj = {
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
    };

    console.log(`🌱 Checking settings seeding for tenant: ${activeTenantKey}`);
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
      console.log(`ℹ️ Settings for tenant: ${activeTenantKey} are fully up-to-date`);
    }

    // Seed fallback legacy 'sitekey' tenant for backward compatibility if missing
    if (activeTenantKey !== 'sitekey') {
      const legacyDefaults = {
        siteName: 'Backup Store',
        isLive: true,
        contactInfo: { email: '' }
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
