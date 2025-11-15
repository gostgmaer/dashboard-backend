// apiClient.js
const axios = require('axios');

// Create a global axios instance with default config, easily overridden per-call
const instance = axios.create({
  timeout: 10000, // Default timeout
  baseURL: process.env.BASE_API_URL || '', // Optional default base URL
  headers: {
    'Content-Type': 'application/json',
    // Add any global headers here
  },
});

// Interceptor for request/response if you want logging or custom logic
instance.interceptors.response.use(
  (response) => response, // Normal response passthrough
  (error) => Promise.reject(error)
);

/**
 * Universal API call handler with extensibility.
 * @param {string} url - Endpoint URL or relative path.
 * @param {object} options - Axios options (method, params, data, headers, etc).
 * @param {object} [overrideConfig={}] - Optionally override config (custom headers, timeouts, etc).
 * @returns {Promise<object>} - { data, status, headers } or { error, status, message, data }
 */
async function apiCall(url, options = {}, overrideConfig = {}) {
  try {
    const config = { url, ...options, ...overrideConfig };
    const response = await instance.request(config);

    return {
      data: response.data,
      status: response.status,
      headers: response.headers,
    };
  } catch (error) {
    // Controlled error normalization for all scenarios
    if (error.response) {
      return {
        error: true,
        status: error.response.status,
        data: error.response.data,
        message: error.response.statusText || 'API error',
        headers: error.response.headers,
      };
    }
    if (error.request) {
      return {
        error: true,
        status: null,
        data: null,
        message: 'No response from API (network issue or timeout)',
      };
    }
    return {
      error: true,
      status: null,
      data: null,
      message: error.message || 'Unknown client-side error',
    };
  }
}

module.exports = { apiCall, instance };
