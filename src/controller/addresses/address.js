const Address = require('../../models/address');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
// Helper function to format responses
const sendResponse = (res, status, success, data, error = null) => {
  res.status(status).json({ success, data, error });
};

// Create a new address
exports.createAddress = async (req, res) => {
  try {
    const addressData = {
      ...req.body,
      user: req.user.id
    };
    const address = new Address(addressData);
    await address.save();
    sendResponse(res, 201, true, address);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Get address by ID
exports.getAddressById = async (req, res) => {
  try {
    const address = await Address.findById(req.params.id);
    if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    sendResponse(res, 200, true, address);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};
// Get address by USer ID
exports.getAddressUserId = async (req, res) => {
  try {
    const userId = req.user.id;

    const addresses = await Address.find({
      user: userId,
      status: { $ne: 'deleted' },
      isDeleted: false,
    });

    if (!addresses || addresses.length === 0) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }

    // Since _id is unique, there will be only one address


    return sendResponse(res, 200, true, addresses);
  } catch (error) {
    return sendResponse(res, 500, false, null, error.message);
  }
};

// Update address (full update)
exports.updateAddress = async (req, res) => {
  try {
    const address = await Address.findById(req.params.id);
    if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    Object.assign(address, req.body, { updated_by: req.user.id });
    await address.save();
    sendResponse(res, 200, true, address);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Partial update address
exports.partialUpdateAddress = async (req, res) => {
  try {
    const address = await Address.findById(req.params.id);
    if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    const updatedAddress = await address.partialUpdate(req.body, req.user.id);
    sendResponse(res, 200, true, updatedAddress);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Set address as default
exports.setAddressAsDefault = async (req, res) => {
  try {
    const address = await Address.findById(req.params.id);
    if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    const updatedAddress = await address.setAsDefault(req.user.id);
    sendResponse(res, 200, true, updatedAddress);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Soft delete address
exports.softDeleteAddress = async (req, res) => {
  try {
    const address = await Address.findById(req.params.id);
    if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    const deletedAddress = await address.softDelete(req.user.id);
    sendResponse(res, 200, true, deletedAddress);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Archive address
exports.archiveAddress = async (req, res) => {
  try {
    const address = await Address.findById(req.params.id);
    if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    const archivedAddress = await address.archive(req.user.id);
    sendResponse(res, 200, true, archivedAddress);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Restore address
exports.restoreAddress = async (req, res) => {
  try {
    const address = await Address.findById(req.params.id);
    if (!address || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    const restoredAddress = await address.restore(req.user.id);
    sendResponse(res, 200, true, restoredAddress);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Clone address
exports.cloneAddress = async (req, res) => {
  try {
    const address = await Address.findById(req.params.id);
    if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    const clonedAddress = await address.cloneAddress(req.user.id);
    sendResponse(res, 201, true, clonedAddress);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Compare addresses
exports.compareAddresses = async (req, res) => {
  try {
    const { addressId1, addressId2 } = req.params;
    const address1 = await Address.findById(addressId1);
    const address2 = await Address.findById(addressId2);
    if (
      !address1 ||
      !address2 ||
      address1.status === 'deleted' ||
      address2.status === 'deleted' ||
      address1.user.toString() !== req.user.id ||
      address2.user.toString() !== req.user.id
    ) {
      return sendResponse(res, 404, false, null, 'One or both addresses not found');
    }
    const comparison = await address1.compareAddress(address2);
    sendResponse(res, 200, true, comparison);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Get default address
exports.getDefaultAddress = async (req, res) => {
  try {
    const address = await Address.getDefaultAddress(req.user.id);
    if (!address) {
      return sendResponse(res, 404, false, null, 'No default address found');
    }
    sendResponse(res, 200, true, address);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Get all user addresses
exports.getUserAddresses = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const addresses = await Address.getUserAddresses(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
    sendResponse(res, 200, true, addresses);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Remove all user addresses
exports.removeUserAddresses = async (req, res) => {
  try {
    await Address.removeUserAddresses(req.user.id, req.user.id);
    sendResponse(res, 200, true, { message: 'All addresses soft deleted' });
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Find nearby addresses
exports.findNearbyAddresses = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 10000 } = req.query;
    const addresses = await Address.findNearbyAddresses(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(maxDistance)
    );
    sendResponse(res, 200, true, addresses);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Update address status
exports.updateAddressStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const address = await Address.updateAddressStatus(req.params.id, status, req.user.id);
    if (!address || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    sendResponse(res, 200, true, address);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Bulk update address status
exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    await Address.bulkUpdateStatus(req.user.id, status, req.user.id);
    sendResponse(res, 200, true, { message: 'Address statuses updated' });
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Get address history
exports.getAddressHistory = async (req, res) => {
  try {
    const address = await Address.findById(req.params.id);
    if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    const history = await Address.getAddressHistory(req.params.id);
    sendResponse(res, 200, true, history);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Search addresses
exports.searchAddresses = async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;
    const addresses = await Address.searchAddresses(req.user.id, query, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
    sendResponse(res, 200, true, addresses);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Batch create addresses
exports.batchCreateAddresses = async (req, res) => {
  try {
    const { addresses } = req.body;
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return sendResponse(res, 400, false, null, 'Addresses array is required');
    }
    const createdAddresses = await Address.batchCreateAddresses(addresses, req.user.id, req.user.id);
    sendResponse(res, 201, true, createdAddresses);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Find duplicate addresses
exports.findDuplicateAddresses = async (req, res) => {
  try {
    const duplicates = await Address.findDuplicateAddresses(req.user.id);
    sendResponse(res, 200, true, duplicates);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Get address count by status
exports.getAddressCountByStatus = async (req, res) => {
  try {
    const counts = await Address.getAddressCountByStatus(req.user.id);
    sendResponse(res, 200, true, counts);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Add tag to address
exports.addTagToAddress = async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) {
      return sendResponse(res, 400, false, null, 'Tag is required');
    }
    const address = await Address.findById(req.params.id);
    if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    const updatedAddress = await address.addTag(tag, req.user.id);
    sendResponse(res, 200, true, updatedAddress);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Remove tag from address
exports.removeTagFromAddress = async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) {
      return sendResponse(res, 400, false, null, 'Tag is required');
    }
    const address = await Address.findById(req.params.id);
    if (!address || address.status === 'deleted' || address.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Address not found');
    }
    const updatedAddress = await address.removeTag(tag, req.user.id);
    sendResponse(res, 200, true, updatedAddress);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Merge addresses
exports.mergeAddresses = async (req, res) => {
  try {
    const { sourceAddressId } = req.body;
    if (!sourceAddressId) {
      return sendResponse(res, 400, false, null, 'Source address ID is required');
    }
    const targetAddress = await Address.findById(req.params.id);
    if (!targetAddress || targetAddress.status === 'deleted' || targetAddress.user.toString() !== req.user.id) {
      return sendResponse(res, 404, false, null, 'Target address not found');
    }
    const mergedAddress = await targetAddress.mergeAddress(sourceAddressId, req.user.id);
    sendResponse(res, 200, true, mergedAddress);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Add tag to multiple addresses
exports.addTagToMultiple = async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag) {
      return sendResponse(res, 400, false, null, 'Tag is required');
    }
    await Address.addTagToMultiple(req.user.id, tag, req.user.id);
    sendResponse(res, 200, true, { message: `Tag '${tag}' added to addresses` });
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Export user addresses
exports.exportUserAddresses = async (req, res) => {
  try {
    const addresses = await Address.exportUserAddresses(req.user.id);
    sendResponse(res, 200, true, addresses);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};

// Get addresses by tag
exports.getAddressesByTag = async (req, res) => {
  try {
    const { tag, page = 1, limit = 10 } = req.query;
    if (!tag) {
      return sendResponse(res, 400, false, null, 'Tag is required');
    }
    const addresses = await Address.getAddressesByTag(req.user.id, tag, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
    sendResponse(res, 200, true, addresses);
  } catch (error) {
    sendResponse(res, 500, false, null, error.message);
  }
};