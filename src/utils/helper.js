const jwt = require('jsonwebtoken');
const axios = require('axios'); // You may need to install axios
const { formatDuration, intervalToDuration } = require('date-fns');
const os = require('os');
const { jwtSecret, charactersString } = require('../config/setting');
const Category = require('../models/categories');
const { ReasonPhrases, StatusCodes } = require('http-status-codes');

function decodeToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}
/**
 * Build a global regex/number search query for all string/number fields of a model
 * @param {Object} model - Mongoose model
 * @param {String|Number} searchValue - Value to search for (partial match)
 * @returns {Object} MongoDB $or query or {}
 */
function buildSearchQuery(model, searchValue) {
  if (!searchValue || String(searchValue).trim() === '') {
    return {}; // no search condition
  }

  const schemaPaths = Object.keys(model.schema.paths).filter((key) => {
    const type = model.schema.paths[key].instance;
    return type === 'String' || type === 'Number';
  });

  const isNumeric = !isNaN(searchValue);

  const orConditions = schemaPaths
    .map((key) => {
      const fieldType = model.schema.paths[key].instance;

      if (fieldType === 'Number' && isNumeric) {
        return { [key]: Number(searchValue) }; // exact match for numbers
      }

      if (fieldType === 'String') {
        return { [key]: { $regex: searchValue, $options: 'i' } }; // partial match for strings
      }

      return null;
    })
    .filter(Boolean);

  return orConditions.length ? { $or: orConditions } : {};
}

const FilterOptions = (params, model) => {
  const { sort = 'createdAt:desc', page, limit, filter, type, search, sortBy, sortDesc } = params;
  var query = {};

  if (filter) {
    const filterObj = JSON.parse(filter);
    // const startwith = generateMatchQuery(filterObj["match"])

    // const agGridFilter = filterObj?.["agGrid"] || {};
    if (type === 'ag-grid') {
      // const agGridFilter = filterObj?.["agGrid"] || {};
      query = agGridFilterToMongoQuery(filterObj);
    } else {
      for (const key in filterObj) {
        query[key] = filterObj[key];
      }
    }

    delete filterObj?.['match'];
    delete filterObj?.['startwith'];
  }
  let statusFilter = { status: { $ne: 'archived' } };

  if (query.status != '' && query.status) {
    statusFilter = { ...statusFilter, status: query.status };
  }

  const globalSearch = buildSearchQuery(model, search);

  query = { ...query, ...statusFilter };
  // if (searchValue) {
  //  query.$text = { $search: searchValue };
  // }

  removeEmptyKeys(query);
  var sortOptions = {};
  if (sortBy) {
    sortOptions[sortBy] = String(sortDesc).toLowerCase() === 'true' ? -1 : 1;
  } else {
    const [sortBy, sortOrder] = sort.split(':');
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
  }

  console.log(Number(limit));

  const options = {
    skip: (Number(page || 1) - 1) * Number(limit || 10),
    limit: parseInt(limit || 10),
    sort: sortOptions,
  };
  return {
    options: options,
    query: { ...query, ...globalSearch },
  };
};

const FilterOptionsSearch = (sort = 'updatedAt:desc', page, limit, filter) => {
  var query = {};

  if (filter) {
    const filterObj = JSON.parse(filter);
    const currObj = parseAndExtractValues(filterObj, ['categories', 'salePrice', 'rating', 'brandName', 'discount', 'isAvailable', 'tags']);
    const advFilter = generateQuery(currObj);

    const search = {
      // { title: { $regex: regex } }, // Case-insensitive title match
      // { slug: { $regex: regex } }, // Case-insensitive slug match
      // { brandName: { $regex: regex } }, // Case-insensitive brandName match
    };
    delete filterObj?.['discount'];
    delete filterObj?.['search'];
    for (const key in filterObj) {
      query[key] = filterObj[key];
    }
    let statusFilter = { status: { $ne: 'INACTIVE' } };

    if (query.status != '' && query.status) {
      statusFilter = { ...statusFilter, status: query.status };
    }

    query = { ...query, ...statusFilter, ...advFilter, ...search };
    delete query?.['rating'];
    removeEmptyKeys(query);
  }

  var sortOptions = {};

  if (sort) {
    const [sortKey, sortOrder] = sort.split(':');
    sortOptions[sortKey] = sortOrder === 'desc' ? -1 : 1;
  }

  const options = {
    skip: (page - 1) * limit,
    limit: parseInt(limit),
    sort: sortOptions,
  };
  const extra = {
    rating: query.minValue,
  };

  delete query?.['minValue'];
  return {
    options: options,
    query: query,
    extra: extra,
  };
};

function getAppIdAndEntity(url) {
  const [pathPart] = url.split('?');
  const parts = pathPart.split('/');
  const tableIndex = parts.indexOf('table');
  if (tableIndex !== -1 && tableIndex > 0 && tableIndex < parts.length - 1 && parts[tableIndex - 1] && !parts[tableIndex - 1].includes('/') && parts[tableIndex + 1] && !parts[tableIndex + 1].includes('/')) {
    const appId = parts[tableIndex - 1];
    const entity = parts[tableIndex + 1];
    return {
      app_id: appId,
      entity: entity,
    };
  } else {
    // "table" not found or doesn't have exactly one '/' on each side
    return null;
  }
}

async function getLocationInfo(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    return {
      ip: response.data.query,
      city: response.data.city,
      region: response.data.regionName,
      country: response.data.country,
      zip: response.data.zip,
    };
  } catch (error) {
    console.error('Error getting location info:', error);
    return {
      ip: ip,
    };
  }
}

function removeEmptyKeys(obj) {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (value === null || value === undefined || value === '') {
        delete obj[key];
      }
    }
  }
}

// const generateMatchQuery = (query) => {
//   const dynamicQuery = {};
//   Object.keys(query).forEach((key) => {
//     // Use RegExp only if the property exists in the query
//     if (query[key]) {
//       dynamicQuery[key] = new RegExp(query[key], "i");
//     }
//   });
//   return dynamicQuery;
// };

function generateRandomString(length) {
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charactersString.length);
    result += charactersString.charAt(randomIndex);
  }

  return result;
}

async function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  let IPv4, IPv6;

  // Iterate over network interfaces
  Object.keys(interfaces).forEach((interfaceName) => {
    const interfaceInfo = interfaces[interfaceName];

    // Iterate over addresses for the current interface
    interfaceInfo.forEach((address) => {
      if (address.family === 'IPv4' && !address.internal) {
        // Found a non-internal IPv4 address
        IPv4 = address.address;
      } else if (address.family === 'IPv6' && !address.internal) {
        // Found a non-internal IPv6 address
        IPv6 = address.address;
      }
    });
  });

  return { IPv4, IPv6 };
}

function getPublicIpAddress() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api64.ipify.org', // You can use other services like 'api.ipify.org' or 'api.ident.me'
      path: '/?format=json',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.ip);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

function parseAndExtractValues(filterObj, keys) {
  const filterObjData = {};
  keys.forEach((key) => {
    if (filterObj[key]) {
      filterObjData[key] = Object.values(filterObj[key]);
    }
  });

  return filterObjData;
}

const generateQuery = (filterkeys) => {
  var currObj = {};
  if (filterkeys.salePrice) {
    currObj = {
      ...currObj,
      salePrice: {
        $gte: Number(filterkeys.salePrice[0]),
        $lte: Number(filterkeys.salePrice[1]),
      },
    };
  }
  if (filterkeys.categories) {
    currObj = {
      ...currObj,
      categories: filterkeys.categories,
    };
  }
  if (filterkeys.brandName) {
    currObj = {
      ...currObj,
      brandName: filterkeys.brandName,
    };
  }
  if (filterkeys.tags) {
    currObj = {
      ...currObj,
      tags: filterkeys.tags,
    };
  }
  if (filterkeys.isAvailable) {
    currObj = {
      ...currObj,
      isAvailable: filterkeys.isAvailable,
    };
  }
  // if (filterkeys.rating) {
  //   const numberArray = filterkeys.rating.map(Number);
  //   const minValue = Math.max(...numberArray);

  //   currObj = {
  //     ...currObj, "reviews": { $exists: true, $not: { $size: 0 } }, minValue
  //   }

  // }
  if (filterkeys.discount) {
    const numberArray = filterkeys.discount.map(Number);
    const minValue = Math.min(...numberArray);
    (currObj = {
      ...currObj,
      $expr: {
        $gte: [{ $multiply: [100, { $divide: [{ $subtract: ['$price', '$salePrice'] }, '$price'] }] }, minValue],
      },
    }),
      {
        $expr: {
          $lte: [{ $multiply: [100, { $divide: [{ $subtract: ['$price', '$salePrice'] }, '$price'] }] }, 100],
        },
      };
  }

  return currObj;
};

const showingProductFilter = async (sort = 'updatedAt:desc', page, limit = 24, category, _id, query) => {
  var myquery = {};

  if (query) {
    myquery = { title: { $regex: query, $options: 'i' } };
  } else if (category && _id) {
    myquery = { category: _id };
  } else if (category) {
    const cate = await Category.findOne({ slug: category }, 'slug title');
    myquery = { category: cate?.id };
  }

  let statusFilter = { status: { $ne: 'INACTIVE' } };

  if (myquery.status != '' && myquery.status) {
    statusFilter = { ...statusFilter, status: myquery.status };
  }

  myquery = { ...myquery, ...statusFilter };

  removeEmptyKeys(myquery);
  var sortOptions = {};

  if (sort) {
    const [sortKey, sortOrder] = sort.split(':');
    sortOptions[sortKey] = sortOrder === 'desc' ? -1 : 1;
  }
  const options = {
    skip: (Number(page) - 1) * Number(limit),
    limit: parseInt(limit),
    sort: sortOptions,
  };
  return {
    options: options,
    query: myquery,
  };
};

function calculateDiscount(price, coupon) {
  let discount;

  if (coupon.discountType === 'percentage') {
    // Calculate the discount amount based on the percentage
    discount = (price * coupon.discountValue) / 100;
  } else if (coupon.discountType === 'fixed') {
    // For fixed discounts, ensure the discount does not exceed the price
    discount = Math.min(coupon.discountValue, price);
  } else {
    // If the discount type is not recognized, return default values
    return { discountedAmount: 0, finalAmount: price };
  }

  // Calculate the final amount after applying the discount
  const finalAmount = price - discount;

  // Return both the discounted amount and the final amount
  return {
    discountedAmount: discount.toFixed(2),
    finalAmount: finalAmount.toFixed(2),
  };
}

function fillNullIfEmpty(obj, fields) {
  const filled = {};
  fields.forEach((field) => {
    if (obj[field] === undefined || obj[field] === '' || (Array.isArray(obj[field]) && obj[field].length === 0)) {
      filled[field] = null;
    } else {
      filled[field] = obj[field];
    }
  });
  return filled;
}

function agGridFilterToMongoQuery(filterModel) {
  const query = {};

  for (const [field, filter] of Object.entries(filterModel)) {
    if (!filter || !filter.type) continue;

    switch (filter.type) {
      case 'contains':
        query[field] = { $regex: filter.filter, $options: 'i' };
        break;
      case 'notContains':
        query[field] = { $not: { $regex: filter.filter, $options: 'i' } };
        break;
      case 'equals':
        query[field] = filter.filter;
        break;
      case 'notEqual':
        query[field] = { $ne: filter.filter };
        break;
      case 'startsWith':
        query[field] = { $regex: '^' + filter.filter, $options: 'i' };
        break;
      case 'endsWith':
        query[field] = { $regex: filter.filter + '$', $options: 'i' };
        break;
      case 'inRange':
        // For number/date range filters
        query[field] = {
          $gte: filter.filter,
          $lte: filter.filterTo,
        };
        break;
      case 'lessThan':
        query[field] = { $lt: filter.filter };
        break;
      case 'lessThanOrEqual':
        query[field] = { $lte: filter.filter };
        break;
      case 'greaterThan':
        query[field] = { $gt: filter.filter };
        break;
      case 'greaterThanOrEqual':
        query[field] = { $gte: filter.filter };
        break;
      case 'blank':
        query[field] = { $in: [null, ''] };
        break;
      case 'notBlank':
        query[field] = { $nin: [null, ''] };
        break;
      case 'set':
        // AG Grid "set" filter (array of values)
        if (Array.isArray(filter.values)) {
          query[field] = { $in: filter.values };
        }
        break;
      // Add more cases as needed
      default:
        break;
    }
  }

  return query;
}

const sendResponse = (res, statusCode, results, message) => {
  res.status(statusCode).json({
    statusCode,
    status: ReasonPhrases[StatusCodes[statusCode]] || ReasonPhrases.OK,
    results,
    message,
  });
};

const sendError = (res, statusCode, error) => {
  res.status(statusCode).json({
    statusCode,
    status: ReasonPhrases[statusCode] || ReasonPhrases.INTERNAL_SERVER_ERROR,
    results: null,
    message: error.message,
  });
};

function removeKeysFromObject(obj, keysToRemove) {
  const newObj = { ...obj }; // clone to avoid mutating original
  keysToRemove.forEach((key) => {
    delete newObj[key];
  });
  return newObj;
}



function buildFilters(query) {
  const filters = {};

  // Pick only keys starting with filter_
  const filterKeys = Object.keys(query).filter((key) => key.startsWith("filter_"));

  if (filterKeys.length === 0) {
    return query;
  }

  filterKeys.forEach((key) => {
    if (query[key]) {
      const cleanKey = key.replace("filter_", "");
      filters[cleanKey] = { $regex: query[key], $options: "i" };
    }
  });

  return filters;
}


function formatRelativeDuration(dateInput) {
  // Convert input to Date object
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (isNaN(date)) {
    throw new Error('Invalid date input');
  }

  const now = new Date();
  const msDiff = Math.abs(date.getTime() - now.getTime());

  // Calculate duration components
  const duration = intervalToDuration({ start: 0, end: msDiff });

  // Find largest non-zero unit
  const largestUnit = ['days', 'hours', 'minutes', 'seconds'].find((unit) => duration[unit] > 0);

  if (!largestUnit) {
    return '0 seconds';
  }

  const durationForFormat = { [largestUnit]: duration[largestUnit] };

  return formatDuration(durationForFormat, { format: [largestUnit] });
}
module.exports = {
  decodeToken,
  FilterOptions,
  getLocationInfo,
  removeKeysFromObject,
  removeEmptyKeys,
  FilterOptionsSearch,
  generateRandomString,
  getLocalIpAddress,
  getPublicIpAddress,
  getAppIdAndEntity,
  showingProductFilter,
  calculateDiscount,
  fillNullIfEmpty,
  agGridFilterToMongoQuery,
  sendResponse,
  sendError,
  formatRelativeDuration,buildFilters
};
