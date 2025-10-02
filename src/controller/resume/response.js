
// utils/response.js
const sendResponse = (res, statusCode, message, data = null, meta = null) => {
  const response = {
    success: statusCode < 400,
    status: statusCode < 400 ? 'success' : 'error',
    message,
    ...(data && { data }),
    ...(meta && { meta })
  };

  res.status(statusCode).json(response);
};

const sendSuccess = (res, message, data = null, meta = null) => {
  sendResponse(res, 200, message, data, meta);
};

const sendCreated = (res, message, data = null, meta = null) => {
  sendResponse(res, 201, message, data, meta);
};

const sendError = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    status: 'error',
    message,
    ...(errors && { errors })
  };

  res.status(statusCode).json(response);
};

const sendValidationError = (res, errors) => {
  sendError(res, 400, 'Validation failed', errors);
};

const sendNotFound = (res, message = 'Resource not found') => {
  sendError(res, 404, message);
};

const sendUnauthorized = (res, message = 'Unauthorized access') => {
  sendError(res, 401, message);
};

const sendForbidden = (res, message = 'Access forbidden') => {
  sendError(res, 403, message);
};

const sendInternalError = (res, message = 'Internal server error') => {
  sendError(res, 500, message);
};

module.exports = {
  sendResponse,
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendInternalError
};
