/**
 * JWT Configuration
 *
 * Centralizes JWT settings for signing and verifying tokens.
 */

require('dotenv').config();

module.exports = {
  // Secret used to sign JWTs
  secret: process.env.JWT_SECRET || 'your-default-jwt-secret',

  // Token expiration (e.g., '1h', '7d')
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',

  // Issuer identifier
  issuer: process.env.JWT_ISSUER || 'your-app-name',

  // Audience identifier
  audience: process.env.JWT_AUDIENCE || 'your-app-users',
};
