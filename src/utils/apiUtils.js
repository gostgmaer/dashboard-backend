
class APIError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

const formatResponse = (message, results = null) => {
  return {
    success: true,
    message,
    results,
  };
};

// responseUtils.js

function standardResponse(res, success, data, message, statusCode = 200, meta = {}) {
  return res.status(statusCode).json({
    success,
    status: statusCode,
    data,
    message,
    ...meta,
  });
}

function errorResponse(res, message, statusCode = 500, error = null) {
  return res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    error: process.env.NODE_ENV === "development" ? error : undefined,
  });
}




module.exports = {
  standardResponse,errorResponse,
  APIError,
  formatResponse,
};
