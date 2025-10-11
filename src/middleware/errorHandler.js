/**
 * Custom Error class for application-specific errors
 */
class AppError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Factory function to create AppError instances
 */
const createError = (statusCode, message, isOperational = true) => new AppError(statusCode, message, isOperational);

/**
 * Global error handling middleware for Express
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error (in production, use proper logging service)
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user ? { id: req.user.id, username: req.user.username } : null,
    timestamp: new Date().toISOString()
  });

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    sendErrorProd(err, res);
  }
};

/**
 * Send detailed error response for development
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: {
      status: err.status,
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode
    }
  });
};

/**
 * Send production-safe error response
 */
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({ success: false, message: err.message });
  } else {
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
  }
};

/**
 * Handle specific MongoDB/Mongoose errors
 */
const handleMongoError = (err) => {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => error.message);
    const message = `Invalid input data: ${errors.join(', ')}`;
    return new AppError(400, message);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `Duplicate value for ${field}: ${value}. Please use another value.`;
    return new AppError(400, message);
  }

  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(400, message);
  }

  return err;
};

/**
 * Handle JWT errors
 */
const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return new AppError(401, 'Invalid token. Please log in again.');
  }

  if (err.name === 'TokenExpiredError') {
    return new AppError(401, 'Your token has expired. Please log in again.');
  }

  return err;
};

/**
 * Async error wrapper to catch errors in route handlers
 */
const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

/**
 * Middleware for handling 404 errors
 */
const notFound = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found on this server`;
  next(createError(404, message));
};

/**
 * Validation error helper
 */
const validationError = (field, message) => {
  return new AppError(400, `Validation failed for ${field}: ${message}`);
};

/**
 * Authorization error helper
 */
const authorizationError = (message = 'Not authorized to access this resource') => {
  return new AppError(403, message);
};

/**
 * Authentication error helper
 */
const authenticationError = (message = 'Authentication required') => {
  return new AppError(401, message);
};

module.exports = {
  AppError,
  createError,
  globalErrorHandler,
  handleMongoError,
  handleJWTError,
  catchAsync,
  notFound,
  validationError,
  authorizationError,
  authenticationError,
};
