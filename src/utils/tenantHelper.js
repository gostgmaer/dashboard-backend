/**
 * tenantHelper.js
 * Multi-tenant resolution and verification utilities
 */

const getTenantId = (req) => {
  // Resolve tenant ID in order of priority:
  // 1. x-tenant header
  // 2. x-tennet header
  // 3. route path param :siteKey
  // 4. query parameter siteKey
  // 5. request body siteKey
  const tenantId =
    req.headers['x-tenant'] ||
    req.headers['x-tennet'] ||
    req.params.siteKey ||
    req.query.siteKey ||
    (req.body && req.body.siteKey);

  return tenantId ? tenantId.trim() : null;
};

const ensureTenant = (req, res, next) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Tenant identifier (x-tenant/x-tennet header or siteKey) is required.'
    });
  }
  req.tenantId = tenantId; // Attach for controller use
  next();
};

module.exports = {
  getTenantId,
  ensureTenant
};
