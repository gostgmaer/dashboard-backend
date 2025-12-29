const { standardResponse, errorResponse } = require('../../utils/apiUtils');

const { apiCall } = require('../../lib/axiosCall');
const publicServices = require('../../services/publicservice');

class publicController {
  static async getGooglePlaces(req, res) {
    const input = req.query.input;

    const country = (req.query.country || 'in').toLowerCase();
    const location = req.query.location; // ex: '28.7041,77.1025'
    const radius = req.query.radius || 50000; // optional radius for location biasing
    const language = req.query.language || 'en';

    if (!input || typeof input !== 'string' || !input.trim()) {
      return errorResponse(res, 'Missing or invalid input parameter', 400);
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
    const filteredPredictions = (result.data.predictions || []).map(({ description, place_id, types }) => ({
      description,
      place_id,
      types,
    }));
    if (result.error) {
      return errorResponse(res, result.message || 'Google Places API error', 502, result);
    }

    return standardResponse(res, true, filteredPredictions || [], 'Google Place API successful!', 200);
  }

  static async getPlaceDetails(req, res) {
    const place_id = req.query.place_id;

    if (!place_id || typeof place_id !== 'string' || !place_id.trim()) {
      return errorResponse(res, 'Missing or invalid place_id parameter', 400);
    }

    const url = 'https://maps.googleapis.com/maps/api/place/details/json';
    const options = {
      method: 'GET',
      params: {
        place_id,
        key: process.env.GOOGLE_PLACES_API_KEY,
        // fields: 'address_components,formatted_address,geometry,name,place_id,types,photos,rating,user_ratings_total,website,url',
      },
    };

    const result = await apiCall(url, options);

    if (result.error) {
      return errorResponse(res, result.message || 'Google Place Details API error', 502, result);
    }

    return standardResponse(res, true, result.data.result, 'Google Place Details API successful!', 200);
  }

  static async getNearbyPlaces(req, res) {
    const { location, radius, type } = req.query;
    if (!location || !radius) {
      return errorResponse(res, 'Missing location or radius parameter', 400);
    }

    const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
    const options = {
      method: 'GET',
      params: { location, radius, type, key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);

    if (result.error) {
      return errorResponse(res, result.message || 'Nearby Search API error', 502, result);
    }

    return standardResponse(res, true, result.data.results || [], 'Nearby Places API successful!', 200);
  }

  static async getTextSearch(req, res) {
    const { query, location, radius } = req.query;
    if (!query) {
      return errorResponse(res, 'Missing query parameter', 400);
    }

    const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const options = {
      method: 'GET',
      params: { query, location, radius, key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);

    if (result.error) {
      return errorResponse(res, result.message || 'Text Search API error', 502, result);
    }

    return standardResponse(res, true, result.data.results || [], 'Text Search API successful!', 200);
  }

  static async findPlaceFromText(req, res) {
    const { input, inputtype = 'textquery' } = req.query;
    if (!input) {
      return errorResponse(res, 'Missing input parameter', 400);
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
      return errorResponse(res, result.message || 'Find Place From Text API error', 502, result);
    }

    return standardResponse(res, true, result.data.candidates || [], 'Find Place From Text API successful!', 200);
  }

  static async getPlacePhoto(req, res) {
    const { photoreference, maxwidth = 400, maxheight } = req.query;
    if (!photoreference) {
      return errorResponse(res, 'Missing photoreference parameter', 400);
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

    // Redirect client to the photo URL (recommended)
    return res.redirect(`${url}?${params.toString()}`);
  }
  static async getQueryAutocomplete(req, res) {
    const input = req.query.input;
    if (!input || typeof input !== 'string' || !input.trim()) {
      return errorResponse(res, 'Missing or invalid input parameter', 400);
    }

    const url = 'https://maps.googleapis.com/maps/api/place/queryautocomplete/json';
    const options = {
      method: 'GET',
      params: { input, key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);

    if (result.error) {
      return errorResponse(res, result.message || 'Query Autocomplete API error', 502, result);
    }

    return standardResponse(res, true, result.data.predictions || [], 'Query Autocomplete API successful!', 200);
  }
  static async addPlace(req, res) {
    const placeData = req.body;
    if (!placeData || typeof placeData !== 'object') {
      return errorResponse(res, 'Missing or invalid place data', 400);
    }

    const url = 'https://maps.googleapis.com/maps/api/place/add/json';
    const options = {
      method: 'POST',
      data: placeData,
      params: { key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);

    if (result.error) {
      return errorResponse(res, result.message || 'Add Place API error', 502, result);
    }

    return standardResponse(res, true, result.data, 'Place added successfully!', 200);
  }
  static async deletePlace(req, res) {
    const { place_id } = req.body;
    if (!place_id) {
      return errorResponse(res, 'Missing place_id parameter', 400);
    }

    const url = 'https://maps.googleapis.com/maps/api/place/delete/json';
    const options = {
      method: 'POST',
      data: { place_id },
      params: { key: process.env.GOOGLE_PLACES_API_KEY },
    };

    const result = await apiCall(url, options);

    if (result.error) {
      return errorResponse(res, result.message || 'Delete Place API error', 502, result);
    }

    return standardResponse(res, true, result.data, 'Place deleted successfully!', 200);
  }
  static async getMemoryUsage(req, res) {
    try {
      const memoryData = await publicServices.getMemoryUsage();
      res.status(200).json(memoryData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve memory usage', details: error.message });
    }
  }

  static async getCpuMetrics(req, res) {
    try {
      const cpuData = await publicServices.getCpuMetrics();
      res.status(200).json(cpuData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve CPU metrics', details: error.message });
    }
  }

  static async getServerInfo(req, res) {
    try {
      const serverInfo = await publicServices.getServerInfo();
      res.status(200).json(serverInfo);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve server info', details: error.message });
    }
  }

  static async getHealth(req, res) {
    try {
      const health = await publicServices.getHealthStatus();
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error) {
      res.status(500).json({ error: 'Health check failed', details: error.message });
    }
  }

  static async getDashboard(req, res) {
    try {
      const [memory, cpu, server] = await Promise.all([publicServices.getMemoryUsage(), publicServices.getCpuMetrics(), publicServices.getServerInfo()]);

      res.status(200).json({
        ...server,
        memory: memory.process,
        cpu: cpu.loadAverage,
        status: 'healthy',
      });
    } catch (error) {
      res.status(500).json({ error: 'Dashboard generation failed', details: error.message });
    }
  }

  static async getDiskUsage(req, res) {
  try {
    const diskData = await publicServices.getDiskUsage();
    return standardResponse(res, true, diskData, 'Disk usage retrieved successfully!', 200);
  } catch (error) {
    return errorResponse(res, 'Failed to retrieve disk usage', 500);
  }
}

static async getNetworkStats(req, res) {
  try {
    const networkData = await publicServices.getNetworkStats();
    return standardResponse(res, true, networkData, 'Network stats retrieved successfully!', 200);
  } catch (error) {
    return errorResponse(res, 'Failed to retrieve network stats', 500);
  }
}
}

module.exports = publicController;
