const express = require('express');
const settingRoute = express.Router();
const settingsCtrl = require('../controller/setting');
const { authMiddleware } = require('../middleware/auth');
const { ensureTenant } = require('../utils/tenantHelper');

// GET /api/settings/tenants - List all unique tenants (siteKeys)
settingRoute.get('/tenants',
  authMiddleware,
  settingsCtrl.listTenants
);

// GET /api/settings/public - Get public (safe) settings resolved by tenant header/param (Unauthenticated)
settingRoute.get('/public',
  settingsCtrl.getPublicSettings
);

// GET /api/settings/private - Get private settings resolved by tenant header (Authenticated)
settingRoute.get('/private',
  authMiddleware,
  settingsCtrl.getPrivateSettings
);

// GET /api/settings/dynamic-schema - Get dynamic schema resolved by tenant header (Authenticated)
settingRoute.get('/dynamic-schema',
  authMiddleware,
  settingsCtrl.getDynamicSchema
);

// PATCH /api/settings/update-field - Update setting field dynamically for resolved tenant (Authenticated)
settingRoute.patch('/update-field',
  authMiddleware,
  ensureTenant,
  settingsCtrl.updateField
);

// ===== Parameter-based route fallbacks for backward compatibility =====

// GET /api/settings/:siteKey/dynamic-schema - Get dynamic schema with path param
settingRoute.get('/:siteKey/dynamic-schema',
  authMiddleware,
  settingsCtrl.getDynamicSchema
);

// PATCH /api/settings/:siteKey/update-field - Update setting field dynamically with path param
settingRoute.patch('/:siteKey/update-field',
  authMiddleware,
  settingsCtrl.updateField
);

// GET /api/settings/:siteKey/public - Get public settings with path param
settingRoute.get('/:siteKey/public',
  settingsCtrl.getPublicSettings
);

// GET /api/settings/:siteKey - Get settings for a specific site/app
settingRoute.get('/:siteKey',
  settingsCtrl.getSettingsBySite
);

// PUT /api/settings/:siteKey - Update settings for a specific site/app
settingRoute.put('/:siteKey',
  authMiddleware,
  settingsCtrl.updateSettingsBySite
);

// DELETE /api/settings/:siteKey - Delete settings for a specific site/app
settingRoute.delete('/:siteKey',
  authMiddleware,
  settingsCtrl.deleteSettingsBySite
);

module.exports = settingRoute;