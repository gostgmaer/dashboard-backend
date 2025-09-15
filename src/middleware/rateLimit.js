const rateLimit = (options = {}) => {
  const {
    maxAttempts = 5,
    windowMs = 15 * 60 * 1000, // 15 minutes
    action = 'general',
    skipSuccessfulRequests = false,
    keyGenerator = (req) => req.ip
  } = options;

  return async (req, res, next) => {
    try {
      const identifier = keyGenerator(req);
      
      const rateLimitResult = await User.checkRateLimit(
        identifier,
        action,
        maxAttempts,
        windowMs
      );

      // Add rate limit info to response headers
      res.set({
        'X-RateLimit-Limit': maxAttempts,
        'X-RateLimit-Remaining': Math.max(0, maxAttempts - rateLimitResult.attempts),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString()
      });

      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests',
          retryAfter: rateLimitResult.blockExpires,
          rateLimitInfo: {
            attempts: rateLimitResult.attempts,
            maxAttempts,
            resetTime: rateLimitResult.resetTime
          }
        });
      }

      // Store rate limit info for potential success handling
      req.rateLimitInfo = rateLimitResult;
      
      next();
    } catch (error) {
      // Don't fail the request due to rate limiting errors
      console.error('Rate limiting error:', error);
      next();
    }
  };
};

/**
 * Login-specific rate limiting
 */
const loginRateLimit = rateLimit({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  action: 'login',
  keyGenerator: (req) => {
    // Rate limit by IP and email combination
    const email = req.body.email || req.body.identifier;
    return `${req.ip}:${email}`;
  }
});

/**
 * Password reset rate limiting
 */
const passwordResetRateLimit = rateLimit({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  action: 'password_reset',
  keyGenerator: (req) => req.body.email
});

/**
 * OTP generation rate limiting
 */
const otpRateLimit = rateLimit({
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
  action: 'otp_generation',
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user ? req.user._id.toString() : req.ip;
  }
});

/**
 * Registration rate limiting
 */
const registrationRateLimit = rateLimit({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  action: 'registration',
  keyGenerator: (req) => req.ip
});

module.exports = {
  rateLimit,
  loginRateLimit,
  passwordResetRateLimit,
  otpRateLimit,
  registrationRateLimit
};