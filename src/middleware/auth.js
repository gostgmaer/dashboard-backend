const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { jwtSecret } = require('../config/setting');
const { createError } = require('./errorHandler');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError(401, 'Access denied. No token provided'));
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '') || req.cookies?.token;

    if (!token) {
      return next(createError(401, 'Access denied. Invalid token format'));
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return next(createError(401, 'Access denied. Token expired'));
      } else if (jwtError.name === 'JsonWebTokenError') {
        return next(createError(401, 'Access denied. Invalid token'));
      } else {
        return next(createError(401, 'Access denied. Token verification failed'));
      }
    }

    // Find user with role and permissions populated
    const user = await User.findByIdWithPermissions(decoded.userId);

    if (!user) {
      return next(createError(401, 'Access denied. User not found'));
    }

    if (!user.isActive) {
      return next(createError(401, 'Access denied. Account inactive'));
    }

    // Attach user data to request object
    req.user = user ;
    req.body.created_by = user._id;
    req.body.updated_by = user._id;
    res.locals.user = user;

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    next(createError(500, 'Internal server error during authentication'));
  }
};

/**
 * Optional middleware - same as verifyToken but doesn't fail if no token
 * Useful for routes that have different behavior for authenticated vs non-authenticated users
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);

    if (!token) {
      return next(); // Continue without authentication
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findByIdWithPermissions(decoded.userId);

      if (user && user.isActive) {
        req.user = {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          lastLogin: user.lastLogin,
        };
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
