const express = require('express');
const router = express.Router();
const publicController = require('../controller/public');
const { query, body } = require('express-validator');
// const { errorHandlerMiddleware } = require('../middleware/errorHandler'); // to handle validation errors (implement this)
const { authMiddleware } = require('../middleware/auth'); // optional auth if needed

// ========================================
// 🔧 VALIDATION SCHEMAS
// ========================================
const googlePlacesValidation = {
  autocomplete: [query('input').isString().notEmpty().withMessage('Input query is required and must be a string')],
  placeDetails: [query('place_id').isString().notEmpty().withMessage('place_id parameter is required')],
  nearbySearch: [
    query('location')
      .matches(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/)
      .withMessage('location must be "lat,lng" format'),
    query('radius').isInt({ min: 1 }).withMessage('radius must be a positive integer'),
    query('type').optional().isString(),
  ],
  textSearch: [
    query('query').isString().notEmpty().withMessage('query parameter is required'),
    query('location')
      .optional()
      .matches(/-?\d+(\.\d+)?,-?\d+(\.\d+)?/)
      .withMessage('location must be "lat,lng"'),
    query('radius').optional().isInt({ min: 1 }),
  ],
  findPlaceFromText: [query('input').isString().notEmpty().withMessage('input parameter is required'), query('inputtype').optional().isIn(['textquery', 'phonenumber'])],
  placePhoto: [query('photoreference').isString().notEmpty().withMessage('photoreference parameter is required'), query('maxwidth').optional().isInt({ min: 1 }), query('maxheight').optional().isInt({ min: 1 })],
};

// ========================================
// 🗺 GOOGLE PLACES API ROUTES
// ========================================

// Autocomplete
router.get('/place/autocomplete', googlePlacesValidation.autocomplete, publicController.getGooglePlaces);

// Place Details
router.get('/place/details', googlePlacesValidation.placeDetails, publicController.getPlaceDetails);

// Nearby Search
router.get('/place/nearby-search', googlePlacesValidation.nearbySearch, publicController.getNearbyPlaces);

// Text Search
router.get('/place/text-search', googlePlacesValidation.textSearch, publicController.getTextSearch);

// Find Place From Text
router.get('/place/find-place-from-text', googlePlacesValidation.findPlaceFromText, publicController.findPlaceFromText);

// Place Photo (redirect)
router.get('/place/photo', googlePlacesValidation.placePhoto, publicController.getPlacePhoto);


router.get('/health', publicController.getHealth);
router.get('/info', publicController.getServerInfo);
router.get('/memory', publicController.getMemoryUsage);
router.get('/cpu', publicController.getCpuMetrics);
router.get('/disk', publicController.getDiskUsage);        // 🔥 NEW
router.get('/network', publicController.getNetworkStats);  // 🔥 NEW
router.get('/analytics', publicController.getDashboard);   // 🔥 NEW

module.exports = { publicRoutes: router };
