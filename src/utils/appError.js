// utils/appError.js - Custom AppError Class
class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Used to differentiate operational errors from programming errors
    this.details = details; // Validation errors, extra info
    
    // Ensure stack trace in development
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
