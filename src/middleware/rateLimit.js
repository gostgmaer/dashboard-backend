const RateLimiterMemory = require('memory-rate-limiter'); // Simple in-memory rate limiter

// In-memory store for rate limiting data
const rateLimitStore = new Map();

// Main rate limiter function with enhanced flexibility
const rateLimit = (options = {}) => {
  const defaults = {
    maxAttempts: 100, // Default for general requests
    windowMs: 15 * 60 * 1000, // 15 minutes
    action: 'general',
    skipSuccessfulRequests: false,
    keyGenerator: (req) => `${req.ip}:${req.method}:${req.path}`, // Default: IP + method + path
    errorMessage: 'Too many requests, please try again later',
    statusCode: 429,
    dynamicWindow: false, // Enable dynamic window adjustment
    skip: (req) => false // Function to skip rate limiting
  };

  const config = { ...defaults, ...options };

  // Initialize in-memory rate limiter
  const rateLimiter = new RateLimiterMemory({
    points: config.maxAttempts,
    duration: Math.floor(config.windowMs / 1000) // Convert to seconds
  });

  return async (req, res, next) => {
    try {
      // Skip rate limiting if specified
      if (config.skip(req)) {
        return next();
      }

      const identifier = config.keyGenerator(req);

      // Dynamic window adjustment (if enabled)
      let adjustedWindow = config.windowMs;
      if (config.dynamicWindow) {
        const currentAttempts = rateLimitStore.get(identifier)?.attempts || 0;
        adjustedWindow = currentAttempts > config.maxAttempts * 0.8 ? config.windowMs * 1.5 : config.windowMs;
        rateLimiter.duration = Math.floor(adjustedWindow / 1000);
      }

      // Check rate limit (use original User.checkRateLimit if available, else in-memory)
      let rateLimitResult;
      if (typeof User?.checkRateLimit === 'function') {
        rateLimitResult = await User.checkRateLimit(
          identifier,
          config.action,
          config.maxAttempts,
          adjustedWindow
        );
      } else {
        rateLimitResult = await rateLimiter.consume(identifier);
        rateLimitResult = {
          allowed: rateLimitResult.remainingPoints > 0,
          attempts: config.maxAttempts - rateLimitResult.remainingPoints,
          resetTime: new Date(Date.now() + adjustedWindow),
          blockExpires: rateLimitResult.msBeforeNext
        };
      }

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxAttempts,
        'X-RateLimit-Remaining': Math.max(0, config.maxAttempts - rateLimitResult.attempts),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString()
      });

      // Check if request is allowed
      if (!rateLimitResult.allowed) {
        return res.status(config.statusCode).json({
          success: false,
          message: config.errorMessage,
          retryAfter: rateLimitResult.blockExpires,
          rateLimitInfo: {
            attempts: rateLimitResult.attempts,
            maxAttempts: config.maxAttempts,
            resetTime: rateLimitResult.resetTime
          }
        });
      }

      // Store rate limit info
      req.rateLimitInfo = rateLimitResult;
      rateLimitStore.set(identifier, {
        attempts: rateLimitResult.attempts,
        resetTime: rateLimitResult.resetTime
      });

      next();
    } catch (error) {
      console.error(`Rate limiting error [${config.action}]:`, error);
      next();
    }
  };
};

// Login-specific rate limiting (unchanged)
const loginRateLimit = rateLimit({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  action: 'login',
  keyGenerator: (req) => {
    const email = req.body.email || req.body.identifier;
    return `${req.ip}:${email}`;
  },
  errorMessage: 'Too many login attempts'
});

// Password reset rate limiting (unchanged)
const passwordResetRateLimit = rateLimit({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  action: 'password_reset',
  keyGenerator: (req) => req.body.email,
  errorMessage: 'Too many password reset attempts'
});

// OTP generation rate limiting (unchanged)
const otpRateLimit = rateLimit({
  maxAttempts: 5,
  windowMs: 60 * 60 * 1000,
  action: 'otp_generation',
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  },
  errorMessage: 'Too many OTP generation attempts'
});

// Registration rate limiting (unchanged)
const registrationRateLimit = rateLimit({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  action: 'registration',
  keyGenerator: (req) => req.ip,
  errorMessage: 'Too many registration attempts'
});

// Global rate limiter for any request
const globalRateLimit = rateLimit({
  maxAttempts: 100,
  windowMs: 15 * 60 * 1000,
  action: 'global',
  keyGenerator: (req) => `${req.ip}:${req.method}:${req.path}`,
  errorMessage: 'Global rate limit exceeded',
  dynamicWindow: true,
  skip: (req) => {
    // Example: Skip rate limiting for specific routes or methods
    return req.method === 'OPTIONS' || req.path.startsWith('/health');
  }
});

// Export all rate limiters
module.exports = {
  rateLimit, // Updated universal rate limiter
  loginRateLimit,
  passwordResetRateLimit,
  otpRateLimit,
  registrationRateLimit,
  globalRateLimit, // New global rate limiter for any request
  createCustom: (options) => rateLimit(options) // Helper to create custom rate limiters
};