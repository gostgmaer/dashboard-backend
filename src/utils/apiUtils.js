/**
 * API Utilities
 * This file now re-exports standardized response functions from responseHelper.js
 * 
 * @deprecated Import directly from '../utils/responseHelper' instead
 */

// Import standardized response functions
const {
  sendSuccess,
  sendError,
  sendPaginated,
  sendCreated,
  sendNoContent,
  HTTP_STATUS,
  ERROR_CODES,
  standardResponse,
  errorResponse,
} = require('./responseHelper');

/**
 * Custom API Error class
 * Extends Error with statusCode and details
 */
class APIError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Legacy format response helper
 * @deprecated Use sendSuccess from responseHelper instead
 */
const formatResponse = (message, results = null) => {
  return {
    success: true,
    message,
    results,
  };
};

module.exports = {
  // Re-export from responseHelper for backward compatibility
  sendSuccess,
  sendError,
  sendPaginated,
  sendCreated,
  sendNoContent,
  HTTP_STATUS,
  ERROR_CODES,
  standardResponse,
  errorResponse,
  // Local utilities
  APIError,
  formatResponse,
};
