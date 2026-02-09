/**
 * Global Error Handler Middleware
 * Unified error handling for Express application
 */

const AppError = require('../utils/appError');
const { sendError, HTTP_STATUS, ERROR_CODES } = require('../utils/responseHelper');

/**
 * Async error wrapper - wraps async route handlers to catch errors
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Handle MongoDB validation errors
 */
const handleMongoValidationError = (err) => {
  const errors = Object.values(err.errors).map((error) => ({
    field: error.path,
    message: error.message,
  }));
  const error = AppError.validation('Validation failed', errors);
  return error;
};

/**
 * Handle MongoDB duplicate key error
 */
const handleMongoDuplicateError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  return AppError.conflict(`Duplicate value for '${field}': ${value}`);
};

/**
 * Handle MongoDB CastError
 */
const handleMongoCastError = (err) => {
  return AppError.badRequest(`Invalid ${err.path}: ${err.value}`);
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => {
  const error = new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid token. Please log in again.', ERROR_CODES.INVALID_TOKEN);
  return error;
};

/**
 * Handle JWT expiry errors
 */
const handleJWTExpiredError = () => {
  const error = new AppError(HTTP_STATUS.UNAUTHORIZED, 'Your token has expired. Please log in again.', ERROR_CODES.TOKEN_EXPIRED);
  return error;
};

/**
 * 404 Not Found middleware
 */
const notFound = (req, res, next) => {
  next(AppError.notFound(`Route ${req.originalUrl} not found`));
};

/**
 * Global error handler middleware
 */
const globalErrorHandler = (err, req, res, _next) => {
  // Default values
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  error.code = err.code || ERROR_CODES.INTERNAL_ERROR;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = handleMongoValidationError(err);
  }
  if (err.code === 11000) {
    error = handleMongoDuplicateError(err);
  }
  if (err.name === 'CastError') {
    error = handleMongoCastError(err);
  }
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Log error
  console.error('🔥 Error:', {
    message: error.message,
    statusCode: error.statusCode,
    code: error.code,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user: req.user ? { id: req.user.id } : null,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });

  // Send response
  return sendError(res, {
    message: error.isOperational ? error.message : 'Something went wrong. Please try again later.',
    statusCode: error.statusCode,
    code: error.code,
    details: process.env.NODE_ENV === 'development' ? err.stack : null,
    errors: error.validationErrors || null,
  });
};

module.exports = {
  catchAsync,
  notFound,
  globalErrorHandler,
};
