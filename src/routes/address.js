const express = require('express');
const addressRoute = express.Router();
const addressController = require('../controller/addresses/address');
// const authMiddleware = require('./auth.middleware'); // Assumed middleware for authentication

// Create a new address
addressRoute.post('/address',  addressController.createAddress);

// Get address by ID
addressRoute.get('/address/:id',  addressController.getAddressById);

// Update address (full update)
addressRoute.put('/address/:id',  addressController.updateAddress);

// Partial update address
addressRoute.patch('/address/:id',  addressController.partialUpdateAddress);

// Set address as default
addressRoute.patch('/address/:id/set-default',  addressController.setAddressAsDefault);

// Soft delete address
addressRoute.delete('/address/:id',  addressController.softDeleteAddress);

// Archive address
addressRoute.patch('/address/:id/archive',  addressController.archiveAddress);

// Restore address
addressRoute.patch('/address/:id/restore',  addressController.restoreAddress);

// Clone address
addressRoute.post('/address/:id/clone',  addressController.cloneAddress);

// Compare two addresses
addressRoute.get('/address/:addressId1/compare/:addressId2',  addressController.compareAddresses);

// Get default address
addressRoute.get('/address/default',  addressController.getDefaultAddress);

// Get all user addresses
addressRoute.get('/address',  addressController.getUserAddresses);

// Remove all user addresses
addressRoute.delete('/address',  addressController.removeUserAddresses);

// Find nearby addresses
addressRoute.get('/address/nearby',  addressController.findNearbyAddresses);

// Update address status
addressRoute.patch('/address/:id/status',  addressController.updateAddressStatus);

// Bulk update address status
addressRoute.patch('/address/bulk/status',  addressController.bulkUpdateStatus);

// Get address history
addressRoute.get('/address/:id/history',  addressController.getAddressHistory);

// Search addresses
addressRoute.get('/address/search',  addressController.searchAddresses);

// Batch create addresses
addressRoute.post('/address/batch',  addressController.batchCreateAddresses);

// Find duplicate addresses
addressRoute.get('/address/duplicates',  addressController.findDuplicateAddresses);

// Get address count by status
addressRoute.get('/address/status/count',  addressController.getAddressCountByStatus);

// Add tag to address
addressRoute.patch('/address/:id/add-tag',  addressController.addTagToAddress);

// Remove tag from address
addressRoute.patch('/address/:id/remove-tag',  addressController.removeTagFromAddress);

// Merge addresses
addressRoute.patch('/address/:id/merge',  addressController.mergeAddresses);

// Add tag to multiple addresses
addressRoute.patch('/address/bulk/add-tag',  addressController.addTagToMultiple);

// Export user addresses
addressRoute.get('/address/export',  addressController.exportUserAddresses);

// Get addresses by tag
addressRoute.get('/address/by-tag',  addressController.getAddressesByTag);

module.exports = addressRoute;