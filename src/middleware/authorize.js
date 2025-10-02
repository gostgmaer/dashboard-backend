// const User = require("../models/user");
// const Role = require("../models/role");

// const authorize = (resource, action) => {
//   return async (req, res, next) => {
//     try {
//       const userId = req.user.id;
//       const user = await User.findById(userId).populate("role");

//       if (!user) {
//         return res.status(401).json({ message: "Unauthorized: User not found" });
//       }

//       // ✅ Superadmin bypass - can access everything
//       if (user.role.name.toLowerCase() === "super_admin") {
//         return next();
//       }

//       // ✅ Settings resource - only super_admin can access
//       if (resource === "settings") {
//         return res.status(403).json({
//           message: "Forbidden: Only super admin can access settings"
//         });
//       }

//       // ✅ FIRST: Check user-specific permissions for "manage" access
//       const userPermission = user.permissions.find(p => p.resource === resource);
//       if (userPermission && userPermission.actions.includes("manage")) {
//         // If user has "manage" permission, allow all actions on this resource
//         return next();
//       }

//       // ✅ SECOND: Check user-specific permissions for exact action
//       if (userPermission && userPermission.actions.includes(action)) {
//         return next();
//       }

//       // ✅ THIRD: Get role and check role permissions for "manage" access
//       const role = await Role.findOne({ name: user.role.name });
//       if (role) {
//         const rolePermission = role.permissions.find(p => p.resource === resource);
//         if (rolePermission && rolePermission.actions.includes("manage")) {
//           // If role has "manage" permission, allow all actions on this resource
//           return next();
//         }

//         // ✅ FOURTH: Check role permissions for exact action
//         if (rolePermission && rolePermission.actions.includes(action)) {
//           return next();
//         }
//       }

//       return res.status(403).json({
//         message: "Forbidden: You don't have permission to perform this action"
//       });
//     } catch (err) {
//       console.error("Authorization error:", err);
//       return res.status(500).json({ message: "Server error" });
//     }
//   };
// };

// module.exports = authorize;

const User = require('../models/user');
const Role = require('../models/role');

const authorize = (resource, action, payloadHandler = null) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId).populate('role');

      if (!user) {
        return res.status(401).json({ message: 'Unauthorized: User not found' });
      }

      // ✅ Superadmin bypass - can access everything
      if (user.role.name.toLowerCase() === 'super_admin') {
        return next();
      }

      // ✅ Settings resource - only super_admin can access
      if (resource === 'settings') {
        return res.status(403).json({
          message: 'Forbidden: Only super admin can access settings',
        });
      }

      // ✅ FIRST: Check user-specific permissions for "manage" access
      const userPermission = user.permissions?.find((p) => p?.resource === resource);
      if (userPermission && userPermission.actions.includes('full')) {
        // If user has "manage" permission, check payload if provided
        if (payloadHandler) {
          const payloadCheck = await payloadHandler(req, user, 'full');
          if (!payloadCheck.allowed) {
            return res.status(403).json({
              message: payloadCheck.message || 'Forbidden: Payload validation failed',
            });
          }
        }
        return next();
      }

      // ✅ SECOND: Check user-specific permissions for exact action
      if (userPermission && userPermission.actions.includes(action)) {
        // Check payload if provided
        if (payloadHandler) {
          const payloadCheck = await payloadHandler(req, user, action);
          if (!payloadCheck.allowed) {
            return res.status(403).json({
              message: payloadCheck.message || 'Forbidden: Payload validation failed',
            });
          }
        }
        return next();
      }

      // ✅ THIRD: Get role and check role permissions for "manage" access
      const role = await Role.findOne({ name: user.role.name }).populate('permissions');
      if (role) {
        const rolePermission = role.permissions.filter((p) => p.name.toLowerCase().includes(`${resource.toLowerCase()}:`));
        if (rolePermission && rolePermission.some((p) => p.action===('full'))) {
          // If role has "manage" permission, check payload if provided
          if (payloadHandler) {
            const payloadCheck = await payloadHandler(req, user, 'full');
            if (!payloadCheck.allowed) {
              return res.status(403).json({
                message: payloadCheck.message || 'Forbidden: Payload validation failed',
              });
            }
          }
          return next();
        }

        // ✅ FOURTH: Check role permissions for exact action
        if (rolePermission && rolePermission.some((p) => p.action===action)) {
          // Check payload if provided
          if (payloadHandler) {
            const payloadCheck = await payloadHandler(req, user, action);
            if (!payloadCheck.allowed) {
              return res.status(403).json({
                message: payloadCheck.message || 'Forbidden: Payload validation failed',
              });
            }
          }
          return next();
        }
      }

      return res.status(403).json({
        message: "Forbidden: You don't have permission to perform this action",
      });
    } catch (err) {
      console.error('Authorization error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  };
};

module.exports = authorize;
