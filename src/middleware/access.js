const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { jwtSecret } = require('../config/setting');


const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret);
    
    // Find user and check if token is still valid
    const user = await User.findById(decoded.userId).populate('role');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if token exists in user's token array and not revoked
    const tokenData = user.tokens.find(t => t.token === token && !t.isRevoked);
    if (!tokenData) {
      return res.status(401).json({
        success: false,
        message: 'Token invalid or revoked'
      });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account not active'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked'
      });
    }

    // Attach user to request
    req.user = user;
    req.token = token;
    req.tokenData = tokenData;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const decoded = jwt.verify(token, jwtSecret);
      const user = await User.findById(decoded.userId).populate('role');
      
      if (user && user.status === 'active' && !user.isLocked) {
        req.user = user;
        req.token = token;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

/**
 * Role-based authorization
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userRole = req.user.role?.name;
    
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Permission-based authorization
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied'
      });
    }

    next();
  };
};

/**
 * Require email verification
 */
const requireVerification = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required'
    });
  }
  next();
};

/**
 * Require MFA when enabled
 */
const requireMFA = (req, res, next) => {
  // Check if user has MFA enabled and session is not MFA verified
  if (req.user.mfaEnabled && !req.session?.mfaVerified) {
    return res.status(403).json({
      success: false,
      message: 'MFA verification required',
      requiresMFA: true
    });
  }
  next();
};

/**
 * Device fingerprinting middleware
 */
const deviceFingerprint = (req, res, next) => {
  const deviceInfo = {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    acceptLanguage: req.get('Accept-Language'),
    acceptEncoding: req.get('Accept-Encoding'),
    timestamp: Date.now()
  };

  // Generate device fingerprint
  const crypto = require('crypto');
  const fingerprintString = `${deviceInfo.ipAddress}:${deviceInfo.userAgent}:${deviceInfo.acceptLanguage}`;
  deviceInfo.fingerprint = crypto.createHash('sha256').update(fingerprintString).digest('hex');

  req.deviceInfo = deviceInfo;
  next();
};

/**
 * Extract token from request
 */
function extractToken(req) {
  // Check Authorization header
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check query parameter
  if (req.query.token) {
    return req.query.token;
  }

  // Check cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  requirePermission,
  requireVerification,
  requireMFA,
  deviceFingerprint
};