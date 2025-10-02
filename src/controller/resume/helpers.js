
// utils/helpers.js
const crypto = require('crypto');
const slugify = require('slugify');
const validator = require('validator');

// Generate a unique slug from text
const generateSlug = (text, options = {}) => {
  if (!text) return null;

  const defaultOptions = {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  };

  return slugify(text, { ...defaultOptions, ...options });
};

// Generate a secure random token
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Sanitize user input data
const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;

  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Escape HTML and trim whitespace
      sanitized[key] = validator.escape(value.trim());
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? validator.escape(item.trim()) : sanitizeData(item)
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

// Deep merge objects
const deepMerge = (target, source) => {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
};

// Format file size in human readable format
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Validate email format
const isValidEmail = (email) => {
  return validator.isEmail(email);
};

// Validate URL format
const isValidUrl = (url) => {
  return validator.isURL(url, {
    protocols: ['http', 'https'],
    require_protocol: true
  });
};

// Generate a random filename
const generateFileName = (originalName, extension = null) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const ext = extension || originalName.split('.').pop();
  const baseName = originalName.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');

  return `${baseName}-${timestamp}-${randomString}.${ext}`;
};

// Parse and validate pagination parameters
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

// Parse sort parameters
const parseSort = (query) => {
  const { sortBy = 'createdAt', sortOrder = 'desc' } = query;
  const order = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

  return { [sortBy]: order };
};

// Remove sensitive fields from object
const removeSensitiveFields = (obj, fieldsToRemove = []) => {
  const defaultSensitiveFields = [
    'password', 
    'passwordHash', 
    'resetToken', 
    'refreshToken',
    'shareToken'
  ];

  const allFieldsToRemove = [...defaultSensitiveFields, ...fieldsToRemove];
  const cleaned = { ...obj };

  allFieldsToRemove.forEach(field => {
    delete cleaned[field];
  });

  return cleaned;
};

// Validate required fields
const validateRequiredFields = (data, requiredFields) => {
  const missing = [];

  requiredFields.forEach(field => {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      missing.push(field);
    }
  });

  return missing;
};

// Convert string to boolean
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
};

// Generate initials from name
const generateInitials = (firstName, lastName) => {
  const first = firstName ? firstName.charAt(0).toUpperCase() : '';
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return first + last;
};

// Debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Retry async function with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (i === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Calculate reading time
const calculateReadingTime = (text) => {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);

  return minutes;
};

// Truncate text with ellipsis
const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substr(0, maxLength).trim() + '...';
};

// Group array by key
const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key];
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
};

// Remove duplicates from array
const uniqueArray = (array, key = null) => {
  if (!key) {
    return [...new Set(array)];
  }

  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

// Check if object is empty
const isEmpty = (obj) => {
  return Object.keys(obj).length === 0;
};

// Get nested object property safely
const getNestedProperty = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Set nested object property safely
const setNestedProperty = (obj, path, value) => {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    current[key] = current[key] || {};
    return current[key];
  }, obj);

  target[lastKey] = value;
  return obj;
};

module.exports = {
  generateSlug,
  generateToken,
  sanitizeData,
  deepMerge,
  formatFileSize,
  isValidEmail,
  isValidUrl,
  generateFileName,
  parsePagination,
  parseSort,
  removeSensitiveFields,
  validateRequiredFields,
  parseBoolean,
  generateInitials,
  debounce,
  retryWithBackoff,
  calculateReadingTime,
  truncateText,
  groupBy,
  uniqueArray,
  isEmpty,
  getNestedProperty,
  setNestedProperty
};
