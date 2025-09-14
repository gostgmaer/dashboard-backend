const User = require("../models/User");
const Role = require("../models/Role");

const authorize = (resource, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId).populate("role");

      if (!user) {
        return res.status(401).json({ message: "Unauthorized: User not found" });
      }

      // ✅ Superadmin bypass
      if (user.role.name.toLowerCase() === "superadmin") {
        return next();
      }

      // ✅ Check user-specific permissions first
      const userPermission = user.permissions.find(p => p.resource === resource);
      if (userPermission && userPermission.actions.includes(action)) {
        return next();
      }

      // ✅ If not found, check role permissions
      const role = await Role.findOne({ name: user.role.name });
      if (role) {
        const rolePermission = role.permissions.find(p => p.resource === resource);
        if (rolePermission && rolePermission.actions.includes(action)) {
          return next();
        }
      }

      return res.status(403).json({ message: "Forbidden: You don't have permission" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  };
};

module.exports = authorize