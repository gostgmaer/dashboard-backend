const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { jwtSecret } = require('../config/setting');
const { errorResponse } = require('../utils/apiUtils');
const DeviceDetector = require('../services/deviceDetector');

const authMiddleware = async (req, res, next) => {
  try {
    const deviceInfo = DeviceDetector.detectDevice(req);
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(errorResponse(res, 'Access denied. No token provided', 401));
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '') || req.cookies?.token;

    if (!token) {
      return next(errorResponse(res, 'cess denied. Invalid token format', 401));
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return next(errorResponse(res, 'Access denied. Token expired', 401));
      } else if (jwtError.name === 'JsonWebTokenError') {
        return next(errorResponse(res, 'Access denied. Invalid token', 401));
      } else {
        return next(errorResponse(res, 'Access denied. Token verification failed', 401));
      }
    }

    // Find user with role and permissions populated
    const user = await User.findByIdWithPermissions(decoded.userId);

    if (!user) {
      return next(errorResponse(res, 'Access denied. User not found', 401));
    }

    if (!user.isActive) {
      return next(errorResponse(res, 'Access denied. Account inactive', 401));
    }

    // Attach user data to request object
    req.user = user;
    req.userId = user._id;
    if (req.body) {
      req.body.created_by = user._id;
      req.body.updated_by = user._id;
    }

    req.deviceInfo = deviceInfo;
    res.locals.user = user;

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return next(errorResponse(res, 'Internal server error during authentication', 500));
  }
};

/**
 * Optional middleware - same as verifyToken but doesn't fail if no token
 * Useful for routes that have different behavior for authenticated vs non-authenticated users
 */
const optionalAuth = async (req, res, next) => {
  try {
    const deviceInfo = DeviceDetector.detectDevice(req);
    const authHeader = req.headers.authorization;
    req.deviceInfo = deviceInfo;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next(); // Continue without authentication
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      const user = await User.findByIdWithPermissions(decoded.userId);

      if (user && user.isActive) {
     
        req.user = user;
        req.userId = user._id;
        if (req.body) {
          req.body.created_by = user._id;
          req.body.updated_by = user._id;
        }

        req.deviceInfo = deviceInfo;
        res.locals.user = user;
      }
    } catch (jwtError) {
      // Ignore JWT errors in optional auth
    }

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    next(); // Continue even if there's an error
  }
};

module.exports = {
  authMiddleware,
  optionalAuth,
};
