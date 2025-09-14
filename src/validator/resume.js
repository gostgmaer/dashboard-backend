const { check, validationResult } = require("express-validator");
const { StatusCodes, ReasonPhrases } = require("http-status-codes");

const validateCreateContact = [
  check("firstName").notEmpty().withMessage("First Name is required"),
  check("lastName").notEmpty().withMessage("Last Name is required"),
  check("email").isEmail().withMessage("Valid Email required"),
];

const isRequestValidated = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.array().length > 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: errors.array()[0].msg,
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
    });
  }
  next();
};

module.exports = {
  validateCreateContact,
  isRequestValidated,
};
