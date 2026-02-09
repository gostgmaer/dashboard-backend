const Address = require('../../models/address');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

// Create a new address
exports.createAddress = catchAsync(async (req, res) => {
  const addressData = {
    ...req.body,
    user: req.user.id,
  };
  const address = new Address(addressData);
  await address.save();
  return sendCreated(res, {
    data: address,
    message: 'Address created successfully',
  });
});

// Get address by ID
exports.getAddressById = catchAsync(async (req, res) => {
  const address = await Address.findById(req.params.id);
  if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  return sendSuccess(res, {
    data: address,
    message: 'Address retrieved successfully',
  });
});

// Get address by User ID
exports.getAddressUserId = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const addresses = await Address.find({
    user: userId,
    status: { $ne: 'deleted' },
    isDeleted: false,
  });

  return sendSuccess(res, {
    data: addresses,
    message: addresses.length ? 'Addresses retrieved successfully' : 'No addresses found',
  });
});

// Update address (full update)
exports.updateAddress = catchAsync(async (req, res) => {
  const address = await Address.findById(req.params.id);
  if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  Object.assign(address, req.body, { updated_by: req.user.id });
  await address.save();
  return sendSuccess(res, {
    data: address,
    message: 'Address updated successfully',
  });
});

// Partial update address
exports.partialUpdateAddress = catchAsync(async (req, res) => {
  const address = await Address.findById(req.params.id);
  if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  const updatedAddress = await address.partialUpdate(req.body, req.user.id);
  return sendSuccess(res, {
    data: updatedAddress,
    message: 'Address updated successfully',
  });
});

// Set address as default
exports.setAddressAsDefault = catchAsync(async (req, res) => {
  const address = await Address.findById(req.params.id);
  if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  const updatedAddress = await address.setAsDefault(req.user.id);
  return sendSuccess(res, {
    data: updatedAddress,
    message: 'Address set as default',
  });
});

// Soft delete address
exports.softDeleteAddress = catchAsync(async (req, res) => {
  const address = await Address.findById(req.params.id);
  if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  const deletedAddress = await address.softDelete(req.user.id);
  return sendSuccess(res, {
    data: deletedAddress,
    message: 'Address deleted successfully',
  });
});

// Archive address
exports.archiveAddress = catchAsync(async (req, res) => {
  const address = await Address.findById(req.params.id);
  if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  const archivedAddress = await address.archive(req.user.id);
  return sendSuccess(res, {
    data: archivedAddress,
    message: 'Address archived successfully',
  });
});

// Restore address
exports.restoreAddress = catchAsync(async (req, res) => {
  const address = await Address.findById(req.params.id);
  if (!address || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  const restoredAddress = await address.restore(req.user.id);
  return sendSuccess(res, {
    data: restoredAddress,
    message: 'Address restored successfully',
  });
});

// Clone address
exports.cloneAddress = catchAsync(async (req, res) => {
  const address = await Address.findById(req.params.id);
  if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  const clonedAddress = await address.cloneAddress(req.user.id);
  return sendCreated(res, {
    data: clonedAddress,
    message: 'Address cloned successfully',
  });
});

// Compare addresses
exports.compareAddresses = catchAsync(async (req, res) => {
  const { addressId1, addressId2 } = req.params;
  const address1 = await Address.findById(addressId1);
  const address2 = await Address.findById(addressId2);
  if (!address1 || !address2 || address1.status === 'deleted' || address2.status === 'deleted' || address1.user.toString() !== req.user.id || address2.user.toString() !== req.user.id) {
    throw AppError.notFound('One or both addresses not found');
  }
  const comparison = await address1.compareAddress(address2);
  return sendSuccess(res, {
    data: comparison,
    message: 'Address comparison completed',
  });
});

// Get default address
exports.getDefaultAddress = catchAsync(async (req, res) => {
  const address = await Address.getDefaultAddress(req.user.id);
  if (!address) {
    throw AppError.notFound('No default address found');
  }
  return sendSuccess(res, {
    data: address,
    message: 'Default address retrieved',
  });
});

// Get all user addresses
exports.getUserAddresses = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const addresses = await Address.getUserAddresses(req.user.id, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return sendSuccess(res, {
    data: addresses,
    message: 'User addresses retrieved',
  });
});

// Remove all user addresses
exports.removeUserAddresses = catchAsync(async (req, res) => {
  await Address.removeUserAddresses(req.user.id, req.user.id);
  return sendSuccess(res, {
    message: 'All addresses soft deleted',
  });
});

// Find nearby addresses
exports.findNearbyAddresses = catchAsync(async (req, res) => {
  const { lat, lng, maxDistance = 10000 } = req.query;
  const addresses = await Address.findNearbyAddresses(parseFloat(lat), parseFloat(lng), parseInt(maxDistance));
  return sendSuccess(res, {
    data: addresses,
    message: 'Nearby addresses retrieved',
  });
});

// Update address status
exports.updateAddressStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  const address = await Address.updateAddressStatus(req.params.id, status, req.user.id);
  if (!address || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  return sendSuccess(res, {
    data: address,
    message: 'Address status updated',
  });
});

// Bulk update address status
exports.bulkUpdateStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  await Address.bulkUpdateStatus(req.user.id, status, req.user.id);
  return sendSuccess(res, {
    message: 'Address statuses updated',
  });
});

// Get address history
exports.getAddressHistory = catchAsync(async (req, res) => {
  const address = await Address.findById(req.params.id);
  if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  const history = await Address.getAddressHistory(req.params.id);
  return sendSuccess(res, {
    data: history,
    message: 'Address history retrieved',
  });
});

// Search addresses
exports.searchAddresses = catchAsync(async (req, res) => {
  const { query, page = 1, limit = 10 } = req.query;
  const addresses = await Address.searchAddresses(req.user.id, query, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return sendSuccess(res, {
    data: addresses,
    message: 'Address search completed',
  });
});

// Batch create addresses
exports.batchCreateAddresses = catchAsync(async (req, res) => {
  const { addresses } = req.body;
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw AppError.badRequest('Addresses array is required');
  }
  const createdAddresses = await Address.batchCreateAddresses(addresses, req.user.id, req.user.id);
  return sendCreated(res, {
    data: createdAddresses,
    message: 'Addresses created successfully',
  });
});

// Find duplicate addresses
exports.findDuplicateAddresses = catchAsync(async (req, res) => {
  const duplicates = await Address.findDuplicateAddresses(req.user.id);
  return sendSuccess(res, {
    data: duplicates,
    message: 'Duplicate addresses found',
  });
});

// Get address count by status
exports.getAddressCountByStatus = catchAsync(async (req, res) => {
  const counts = await Address.getAddressCountByStatus(req.user.id);
  return sendSuccess(res, {
    data: counts,
    message: 'Address count by status retrieved',
  });
});

// Add tag to address
exports.addTagToAddress = catchAsync(async (req, res) => {
  const { tag } = req.body;
  if (!tag) {
    throw AppError.badRequest('Tag is required');
  }
  const address = await Address.findById(req.params.id);
  if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  const updatedAddress = await address.addTag(tag, req.user.id);
  return sendSuccess(res, {
    data: updatedAddress,
    message: 'Tag added to address',
  });
});

// Remove tag from address
exports.removeTagFromAddress = catchAsync(async (req, res) => {
  const { tag } = req.body;
  if (!tag) {
    throw AppError.badRequest('Tag is required');
  }
  const address = await Address.findById(req.params.id);
  if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
    throw AppError.notFound('Address not found');
  }
  const updatedAddress = await address.removeTag(tag, req.user.id);
  return sendSuccess(res, {
    data: updatedAddress,
    message: 'Tag removed from address',
  });
});

// Merge addresses
exports.mergeAddresses = catchAsync(async (req, res) => {
  const { sourceAddressId } = req.body;
  if (!sourceAddressId) {
    throw AppError.badRequest('Source address ID is required');
  }
  const targetAddress = await Address.findById(req.params.id);
  if (!targetAddress || targetAddress.status === 'deleted' || targetAddress.user.toString() !== req.user.id) {
    throw AppError.notFound('Target address not found');
  }
  const mergedAddress = await targetAddress.mergeAddress(sourceAddressId, req.user.id);
  return sendSuccess(res, {
    data: mergedAddress,
    message: 'Addresses merged successfully',
  });
});

// Add tag to multiple addresses
exports.addTagToMultiple = catchAsync(async (req, res) => {
  const { tag } = req.body;
  if (!tag) {
    throw AppError.badRequest('Tag is required');
  }
  await Address.addTagToMultiple(req.user.id, tag, req.user.id);
  return sendSuccess(res, {
    message: `Tag '${tag}' added to addresses`,
  });
});

// Export user addresses
exports.exportUserAddresses = catchAsync(async (req, res) => {
  const addresses = await Address.exportUserAddresses(req.user.id);
  return sendSuccess(res, {
    data: addresses,
    message: 'Addresses exported successfully',
  });
});

// Get addresses by tag
exports.getAddressesByTag = catchAsync(async (req, res) => {
  const { tag, page = 1, limit = 10 } = req.query;
  if (!tag) {
    throw AppError.badRequest('Tag is required');
  }
  const addresses = await Address.getAddressesByTag(req.user.id, tag, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return sendSuccess(res, {
    data: addresses,
    message: 'Addresses by tag retrieved',
  });
});
