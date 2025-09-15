
const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Generate secure random token
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate numeric OTP
 */
function generateNumericOTP(digits = 6) {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

/**
 * Hash sensitive data
 */
async function hashData(data, saltRounds = 10) {
  return await bcrypt.hash(data, saltRounds);
}

/**
 * Verify hashed data
 */
async function verifyHash(data, hash) {
  return await bcrypt.compare(data, hash);
}

/**
 * Generate device fingerprint
 */
function generateDeviceFingerprint(req) {
  const components = [
    req.ip || req.connection.remoteAddress,
    req.get('User-Agent') || '',
    req.get('Accept-Language') || '',
    req.get('Accept-Encoding') || '',
    req.get('Accept') || ''
  ];

  const fingerprintString = components.join('|');
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

/**
 * Sanitize user input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remove potentially harmful characters
    .substring(0, 1000); // Limit length
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number
 */
function isValidPhoneNumber(phone, countryCode = 'US') {
  // Simple validation - in production, use a library like libphonenumber
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/\s|-|\(|\)/g, ''));
}

/**
 * Password strength checker
 */
function checkPasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    noCommon: !['password', '123456', 'qwerty', 'admin'].some(common => 
      password.toLowerCase().includes(common)
    )
  };

  const score = Object.values(checks).filter(Boolean).length;
  
  let strength;
  if (score < 3) strength = 'weak';
  else if (score < 5) strength = 'medium';
  else if (score < 6) strength = 'strong';
  else strength = 'very strong';

  return {
    score,
    strength,
    checks,
    isValid: score >= 4 // Require at least 4 criteria
  };
}

/**
 * Detect suspicious activity patterns
 */
function detectSuspiciousActivity(authEvents) {
  const suspicious = [];
  
  // Check for rapid login attempts from different IPs
  const recentLogins = authEvents
    .filter(e => e.action === 'login_attempt' && 
      e.timestamp > new Date(Date.now() - 60 * 60 * 1000)) // Last hour
    .sort((a, b) => b.timestamp - a.timestamp);

  const uniqueIPs = new Set(recentLogins.map(e => e.ipAddress));
  if (uniqueIPs.size > 3 && recentLogins.length > 10) {
    suspicious.push({
      type: 'multiple_ip_login_attempts',
      severity: 'high',
      details: `${recentLogins.length} login attempts from ${uniqueIPs.size} different IPs`
    });
  }

  // Check for login attempts after business hours
  const businessHours = recentLogins.filter(e => {
    const hour = e.timestamp.getHours();
    return hour < 9 || hour > 17; // Outside 9 AM - 5 PM
  });

  if (businessHours.length > 5) {
    suspicious.push({
      type: 'off_hours_activity',
      severity: 'medium',
      details: `${businessHours.length} login attempts outside business hours`
    });
  }

  // Check for geographical anomalies (would need geolocation data)
  const locations = authEvents
    .filter(e => e.location && e.location.country)
    .map(e => e.location.country);
    
  const uniqueCountries = new Set(locations);
  if (uniqueCountries.size > 2) {
    suspicious.push({
      type: 'geographical_anomaly',
      severity: 'medium',
      details: `Login attempts from ${uniqueCountries.size} different countries`
    });
  }

  return suspicious;
}

/**
 * Generate backup codes for MFA
 */
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push({
      code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      isUsed: false,
      createdAt: new Date()
    });
  }
  return codes;
}

/**
 * Mask sensitive data for logging
 */
function maskSensitiveData(data) {
  const masked = { ...data };
  
  // Mask email
  if (masked.email) {
    const [local, domain] = masked.email.split('@');
    masked.email = `${local.substring(0, 2)}***@${domain}`;
  }
  
  // Mask phone number
  if (masked.phoneNumber) {
    masked.phoneNumber = `***${masked.phoneNumber.slice(-4)}`;
  }
  
  // Remove sensitive fields
  delete masked.hash_password;
  delete masked.mfaSecret;
  delete masked.tokens;
  delete masked.resetToken;
  
  return masked;
}

module.exports = {
  generateSecureToken,
  generateNumericOTP,
  hashData,
  verifyHash,
  generateDeviceFingerprint,
  sanitizeInput,
  isValidEmail,
  isValidPhoneNumber,
  checkPasswordStrength,
  detectSuspiciousActivity,
  generateBackupCodes,
  maskSensitiveData
};