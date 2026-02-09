const fs = require('fs');
const path = require('path');

const { apiCall } = require('../../lib/axiosCall');
const publicServices = require('../../services/publicservice');
const { sendSuccess, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

class publicController {
  static getGooglePlaces = catchAsync(async (req, res) => {
    const input = req.query.input;
    const country = (req.query.country || 'in').toLowerCase();
    const location = req.query.location;
    const radius = req.query.radius || 50000;
    const language = req.query.language || 'en';

    if (!input || typeof input !== 'string' || !input.trim()) {
      throw AppError.badRequest('Missing or invalid input parameter');
    }

    const params = {
      input,
      components: `country:${country}`,
      key: process.env.GOOGLE_PLACES_API_KEY,
      language,
    };

    if (location) {
      params.location = location;
      params.radius = radius;
    }

    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const options = {
      method: 'GET',
      params: { input, key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);
    if (result.error) {
      throw AppError.internal(result.message || 'Google Places API error');
    }

    const filteredPredictions = (result.data.predictions || []).map(({ description, place_id, types }) => ({
      description,
      place_id,
      types,
    }));

    return sendSuccess(res, { data: filteredPredictions, message: 'Google Place API successful' });
  });

  static getPlaceDetails = catchAsync(async (req, res) => {
    const place_id = req.query.place_id;

    if (!place_id || typeof place_id !== 'string' || !place_id.trim()) {
      throw AppError.badRequest('Missing or invalid place_id parameter');
    }

    const url = 'https://maps.googleapis.com/maps/api/place/details/json';
    const options = {
      method: 'GET',
      params: { place_id, key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);
    if (result.error) {
      throw AppError.internal(result.message || 'Google Place Details API error');
    }

    return sendSuccess(res, { data: result.data.result, message: 'Google Place Details API successful' });
  });

  static getNearbyPlaces = catchAsync(async (req, res) => {
    const { location, radius, type } = req.query;
    if (!location || !radius) {
      throw AppError.badRequest('Missing location or radius parameter');
    }

    const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
    const options = {
      method: 'GET',
      params: { location, radius, type, key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);
    if (result.error) {
      throw AppError.internal(result.message || 'Nearby Search API error');
    }

    return sendSuccess(res, { data: result.data.results || [], message: 'Nearby Places API successful' });
  });

  static getTextSearch = catchAsync(async (req, res) => {
    const { query, location, radius } = req.query;
    if (!query) {
      throw AppError.badRequest('Missing query parameter');
    }

    const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const options = {
      method: 'GET',
      params: { query, location, radius, key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);
    if (result.error) {
      throw AppError.internal(result.message || 'Text Search API error');
    }

    return sendSuccess(res, { data: result.data.results || [], message: 'Text Search API successful' });
  });

  static findPlaceFromText = catchAsync(async (req, res) => {
    const { input, inputtype = 'textquery' } = req.query;
    if (!input) {
      throw AppError.badRequest('Missing input parameter');
    }

    const url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
    const options = {
      method: 'GET',
      params: {
        input,
        inputtype,
        fields: 'place_id,name,formatted_address,geometry',
        key: process.env.GOOGLE_PLACES_API_KEY,
      },
    };

    const result = await apiCall(url, options);
    if (result.error) {
      throw AppError.internal(result.message || 'Find Place From Text API error');
    }

    return sendSuccess(res, { data: result.data.candidates || [], message: 'Find Place From Text API successful' });
  });

  static getPlacePhoto = catchAsync(async (req, res) => {
    const { photoreference, maxwidth = 400, maxheight } = req.query;
    if (!photoreference) {
      throw AppError.badRequest('Missing photoreference parameter');
    }

    const url = 'https://maps.googleapis.com/maps/api/place/photo';
    const params = new URLSearchParams({
      photoreference,
      maxwidth,
      key: process.env.GOOGLE_PLACES_API_KEY,
    });

    if (maxheight) {
      params.append('maxheight', maxheight);
    }

    return res.redirect(`${url}?${params.toString()}`);
  });

  static getQueryAutocomplete = catchAsync(async (req, res) => {
    const input = req.query.input;
    if (!input || typeof input !== 'string' || !input.trim()) {
      throw AppError.badRequest('Missing or invalid input parameter');
    }

    const url = 'https://maps.googleapis.com/maps/api/place/queryautocomplete/json';
    const options = {
      method: 'GET',
      params: { input, key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);
    if (result.error) {
      throw AppError.internal(result.message || 'Query Autocomplete API error');
    }

    return sendSuccess(res, { data: result.data.predictions || [], message: 'Query Autocomplete API successful' });
  });

  static addPlace = catchAsync(async (req, res) => {
    const placeData = req.body;
    if (!placeData || typeof placeData !== 'object') {
      throw AppError.badRequest('Missing or invalid place data');
    }

    const url = 'https://maps.googleapis.com/maps/api/place/add/json';
    const options = {
      method: 'POST',
      data: placeData,
      params: { key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);
    if (result.error) {
      throw AppError.internal(result.message || 'Add Place API error');
    }

    return sendSuccess(res, { data: result.data, message: 'Place added successfully' });
  });

  static deletePlace = catchAsync(async (req, res) => {
    const { place_id } = req.body;
    if (!place_id) {
      throw AppError.badRequest('Missing place_id parameter');
    }

    const url = 'https://maps.googleapis.com/maps/api/place/delete/json';
    const options = {
      method: 'POST',
      data: { place_id },
      params: { key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);
    if (result.error) {
      throw AppError.internal(result.message || 'Delete Place API error');
    }

    return sendSuccess(res, { data: result.data, message: 'Place deleted successfully' });
  });

  static getMemoryUsage = catchAsync(async (req, res) => {
    const memoryData = await publicServices.getMemoryUsage();
    return sendSuccess(res, { data: memoryData, message: 'Memory usage retrieved successfully' });
  });

  static getCpuMetrics = catchAsync(async (req, res) => {
    const cpuData = await publicServices.getCpuMetrics();
    return sendSuccess(res, { data: cpuData, message: 'CPU metrics retrieved successfully' });
  });

  static getServerInfo = catchAsync(async (req, res) => {
    const serverInfo = await publicServices.getServerInfo();
    return sendSuccess(res, { data: serverInfo, message: 'Server info retrieved successfully' });
  });

  static getHealth = catchAsync(async (req, res) => {
    const health = await publicServices.getHealthStatus();
    return sendSuccess(res, { data: health, message: health.status === 'healthy' ? 'System healthy' : 'System unhealthy' }, health.status === 'healthy' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE);
  });

  static getPostmanCollections = catchAsync(async (req, res) => {
    const postmanDir = path.join(process.cwd(), 'uploads', 'postman');

    if (!fs.existsSync(postmanDir)) {
      throw AppError.notFound('Postman folder not found');
    }

    const files = fs.readdirSync(postmanDir);
    const collections = files
      .filter((file) => file.endsWith('.postman_collection.json'))
      .map((file) => ({
        name: file.replace('.postman_collection.json', ''),
        filename: file,
        url: `${req.protocol}://${req.get('host')}/upload/postman/${file}`,
      }));

    return sendSuccess(res, { data: { total: collections.length, collections }, message: 'Postman collections retrieved successfully' });
  });

  static getDashboard = catchAsync(async (req, res) => {
    const [memory, cpu, server] = await Promise.all([publicServices.getMemoryUsage(), publicServices.getCpuMetrics(), publicServices.getServerInfo()]);

    return sendSuccess(res, {
      data: { ...server, memory: memory.process, cpu: cpu.loadAverage, status: 'healthy' },
      message: 'Dashboard retrieved successfully',
    });
  });

  static getDiskUsage = catchAsync(async (req, res) => {
    const diskData = await publicServices.getDiskUsage();
    return sendSuccess(res, { data: diskData, message: 'Disk usage retrieved successfully' });
  });

  static getNetworkStats = catchAsync(async (req, res) => {
    const networkData = await publicServices.getNetworkStats();
    return sendSuccess(res, { data: networkData, message: 'Network stats retrieved successfully' });
  });

  static getApiStatus = catchAsync(async (req, res) => {
    const data = await publicServices.getApiStatus();
    return sendSuccess(res, { data, message: 'API is healthy and running' });
  });
}

module.exports = publicController;
