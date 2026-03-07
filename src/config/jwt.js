/**
 * JWT Configuration
 *
 * Centralizes JWT settings for signing and verifying tokens.
 */

const { jwt } = require('./setting');

module.exports = {
  // Secret used to sign JWTs
  secret: jwt.secret,

  // Token expiration (e.g., '1h', '7d')
  expiresIn: jwt.expiresIn,

  // Issuer identifier
  issuer: jwt.issuer,

  // Audience identifier
  audience: jwt.audience,
};
