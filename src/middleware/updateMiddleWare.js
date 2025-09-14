const { decodeToken } = require("../utils/helper");
const User = require("../models/user");

async function updateMiddleWare(req, res, next) {
  // Check if the user has a Bearer token in the Authorization header
  const token = req.headers.authorization;

  if (token && token.startsWith("Bearer ")) {
    const tokenValue = token.split(" ")[1];
    try {
      const decoded = await decodeToken(tokenValue);

      const userData = await User.findOne(
        { _id: decoded.user_id },
        "email"
      );
      
      const newBody = {
        updated_user_id: userData.id,
        updated_by: userData.id
      };

      req.body = { ...newBody, ...req.body };
    } catch (error) {
      console.error(error);
      // Handle invalid or expired tokens, but don't block the request
    }
  }

  // Continue to the next middleware/route
  next();
}

module.exports = updateMiddleWare;
