import { createError } from '../utils/errorHandler.js';

/**
 * Authorization middleware factory to check user permissions
 * Supports both single permission and multiple permissions with OR logic
 * @param {...string} requiredPermissions - One or more permission keys to check
 * @returns {Function} Express middleware function
 */
export const checkPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return next(createError(401, 'Authentication required'));
      }

      const { role, permissions } = req.user;
      if (!role) {
        return next(createError(403, 'Access denied: User role not found'));
      }

      // ✅ 1. SUPER ADMIN: Access to everything
      if (role?.name === 'super_admin' || role?.key === 'super_admin') {
        return next();
      }

      // ✅ 2. ADMIN: Access everything except settings route
      if (role?.name === 'admin' || role?.key === 'admin') {
        if (req.originalUrl.includes('/settings')) {
          console.warn(`Admin access blocked for settings route: ${req.originalUrl}`);
          return next(createError(403, 'Access denied: Admin cannot access settings routes'));
        }
        return next();
      }
      // Check if user has role and permissions
      if (!req.user.role || !req.user.permissions) {
        return next(createError(403, 'Access denied: User role or permissions not found'));
      }

      // If no permissions required, allow access
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return next();
      }

      // Get user's permission keys
      const userPermissionKeys = req.user.permissions.map((permission) => permission.key);

      // Check if user has any of the required permissions (OR logic)
      const hasPermission = requiredPermissions.some((permissionKey) => userPermissionKeys.includes(permissionKey));

      if (!hasPermission) {
        // Log failed authorization attempt for security monitoring
        console.warn(`Access denied for user ${req.user.username} (${req.user._id}). Required permissions: [${requiredPermissions.join(', ')}]. User permissions: [${userPermissionKeys.join(', ')}]`);

        return next(createError(403, 'Access denied: Insufficient permissions'));
      }

      // Add matched permissions to request for potential use in route handlers
      req.matchedPermissions = requiredPermissions.filter((permissionKey) => userPermissionKeys.includes(permissionKey));

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      next(createError(500, 'Permission check failed'));
    }
  };
};

/**
 * Authorization middleware to require ALL specified permissions (AND logic)
 * @param {...string} requiredPermissions - All permission keys that must be present
 * @returns {Function} Express middleware function
 */
export const requireAllPermissions = (...requiredPermissions) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(createError(401, 'Authentication required'));
      }

      if (!req.user.role || !req.user.permissions) {
        return next(createError(403, 'Access denied: User role or permissions not found'));
      }

      if (!requiredPermissions || requiredPermissions.length === 0) {
        return next();
      }

      const userPermissionKeys = req.user.permissions.map((permission) => permission.key);

      // Check if user has ALL required permissions (AND logic)
      const hasAllPermissions = requiredPermissions.every((permissionKey) => userPermissionKeys.includes(permissionKey));

      if (!hasAllPermissions) {
        const missingPermissions = requiredPermissions.filter((permissionKey) => !userPermissionKeys.includes(permissionKey));

        console.warn(`Access denied for user ${req.user.username} (${req.user._id}). Missing permissions: [${missingPermissions.join(', ')}]`);

        return next(createError(403, `Access denied: Missing required permissions: ${missingPermissions.join(', ')}`));
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      next(createError(500, 'Permission check failed'));
    }
  };
};

/**
 * Authorization middleware to check role-based access
 * @param {...string} allowedRoles - Role names that are allowed access
 * @returns {Function} Express middleware function
 */
export const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return next(createError(401, 'Authentication required'));
      }

      if (!req.user.role) {
        return next(createError(403, 'Access denied: User role not found'));
      }

      if (!allowedRoles || allowedRoles.length === 0) {
        return next();
      }

      const userRoleName = req.user.role.name;

      if (!allowedRoles.includes(userRoleName)) {
        console.warn(`Role-based access denied for user ${req.user.username} (${req.user._id}). Required roles: [${allowedRoles.join(', ')}]. User role: ${userRoleName}`);

        return next(createError(403, `Access denied: Role '${userRoleName}' not authorized`));
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      next(createError(500, 'Role check failed'));
    }
  };
};

/**
 * Authorization middleware for resource ownership
 * Checks if the authenticated user owns the requested resource
 * @param {string} resourceIdParam - The parameter name in req.params that contains the resource ID
 * @param {string} ownerField - The field name in the resource that contains the owner ID (default: 'userId')
 * @param {Function} getResourceFn - Function to fetch the resource, receives (resourceId) and returns resource object
 * @returns {Function} Express middleware function
 */
export const checkResourceOwnership = (resourceIdParam, ownerField = 'userId', getResourceFn) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(createError(401, 'Authentication required'));
      }

      const resourceId = req.params[resourceIdParam];

      if (!resourceId) {
        return next(createError(400, `Resource ID parameter '${resourceIdParam}' not found`));
      }

      const resource = await getResourceFn(resourceId);

      if (!resource) {
        return next(createError(404, 'Resource not found'));
      }

      const ownerId = resource[ownerField];

      if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
        console.warn(`Ownership check failed for user ${req.user.username} (${req.user._id}) accessing resource ${resourceId}`);
        return next(createError(403, 'Access denied: You can only access your own resources'));
      }

      // Attach resource to request for potential use in route handler
      req.resource = resource;

      next();
    } catch (error) {
      console.error('Resource ownership check error:', error);
      next(createError(500, 'Ownership check failed'));
    }
  };
};

/**
 * Middleware to check if user has admin permissions
 * Convenience wrapper around checkRole for admin access
 */
export const requireAdmin = checkRole('Admin', 'Super Admin');

/**
 * Middleware to check if user is active
 */
export const requireActiveUser = (req, res, next) => {
  if (!req.user) {
    return next(createError(401, 'Authentication required'));
  }

  if (!req.user.isActive) {
    return next(createError(403, 'Access denied: Account inactive'));
  }

  next();
};
