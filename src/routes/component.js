const express = require('express');
const router = express.Router();
const ComponentController = require('../controller/ComponentController');

// CRUD Routes
router.post('/', ComponentController.createComponent);
router.get('/', ComponentController.getComponents);
router.get('/recent', ComponentController.getRecentlyAdded);
router.get('/brand-stats', ComponentController.brandStats);
router.get('/type/:type', ComponentController.getComponentsByType);
router.get('/top-priced', ComponentController.getTopPriced);
router.get('/lowest-priced', ComponentController.getLowestPriced);
router.get('/:id', ComponentController.getComponentById);
router.put('/:id', ComponentController.updateComponent);
router.patch('/:id', ComponentController.updateComponent);
router.delete('/:id', ComponentController.deleteComponent);

// Bulk Operations
router.post('/bulk/import', ComponentController.bulkImport);
router.post('/bulk/delete', ComponentController.bulkDelete);
router.post('/bulk/update', ComponentController.bulkUpdate);

module.exports = { componentsRoutes: router };
