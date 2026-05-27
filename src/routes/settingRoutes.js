const express = require('express');
const settingRoute = express.Router();
const settingsCtrl = require('../controller/setting');
const { authMiddleware } = require('../middleware/auth');
const { ensureTenant } = require('../utils/tenantHelper');
const authorize = require('../middleware/authorize');

// GET /api/settings/tenants - List all unique tenants (siteKeys)
settingRoute.get('/tenants',
  authMiddleware,
  authorize('settings', 'view'),
  settingsCtrl.listTenants
);

// GET /api/settings/public - Get public (safe) settings resolved by tenant header/param (Unauthenticated)
settingRoute.get('/public',
  settingsCtrl.getPublicSettings
);

// GET /api/settings/private - Get private settings resolved by tenant header (Authenticated)
settingRoute.get('/private',
  authMiddleware,
  authorize('settings', 'view'),
  settingsCtrl.getPrivateSettings
);

// GET /api/settings/dynamic-schema - Get dynamic schema resolved by tenant header (Authenticated)
settingRoute.get('/dynamic-schema',
  authMiddleware,
  authorize('settings', 'view'),
  settingsCtrl.getDynamicSchema
);

// PATCH /api/settings/update-field - Update setting field dynamically for resolved tenant (Authenticated)
settingRoute.patch('/update-field',
  authMiddleware,
  authorize('settings', 'write'),
  ensureTenant,
  settingsCtrl.updateField
);

// ===== Parameter-based route fallbacks for backward compatibility =====

// GET /api/settings/:siteKey/dynamic-schema - Get dynamic schema with path param
settingRoute.get('/:siteKey/dynamic-schema',
  authMiddleware,
  authorize('settings', 'view'),
  settingsCtrl.getDynamicSchema
);

// PATCH /api/settings/:siteKey/update-field - Update setting field dynamically with path param
settingRoute.patch('/:siteKey/update-field',
  authMiddleware,
  authorize('settings', 'write'),
  settingsCtrl.updateField
);

// GET /api/settings/:siteKey/public - Get public settings with path param
settingRoute.get('/:siteKey/public',
  settingsCtrl.getPublicSettings
);

// GET /api/settings/:siteKey - Get settings for a specific site/app (Authenticated)
settingRoute.get('/:siteKey',
  authMiddleware,
  authorize('settings', 'view'),
  settingsCtrl.getSettingsBySite
);

// PUT /api/settings/:siteKey - Update settings for a specific site/app
settingRoute.put('/:siteKey',
  authMiddleware,
  authorize('settings', 'write'),
  settingsCtrl.updateSettingsBySite
);

// DELETE /api/settings/:siteKey - Delete settings for a specific site/app
settingRoute.delete('/:siteKey',
  authMiddleware,
  authorize('settings', 'write'),
  settingsCtrl.deleteSettingsBySite
);

module.exports = settingRoute;