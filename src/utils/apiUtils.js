
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

module.exports = {
  APIError,
  formatResponse,
};
