const { check, validationResult } = require("express-validator");
const { StatusCodes, ReasonPhrases } = require("http-status-codes");

const validateSignUpRequest = [
  check("firstName").notEmpty().withMessage("First Name is required"),
  check("lastName").notEmpty().withMessage("Last Name is required"),
  check("email").isEmail().withMessage("Valid Email required"),
  check("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
];

const validateSignIpRequest = [
  check("email").isEmail().withMessage("Valid Email required"),
  check("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")

    // .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    // .withMessage("Password must include at least one uppercase letter, one lowercase letter, one digit, and one special character"),
  // check("password")
  //   .isLength({ min: 6 })
  //   .withMessage("Password must be at least 6 character long"),
];

const validateForgetPassword = [
  check("email").isEmail().withMessage("Valid Email required"),
];

const validateResetpassword = [
  // check("password")
  //   .isLength({ min: 6 })
  //   .withMessage("Password must be at least 6 character long"),
  check("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    .withMessage("Password must include at least one uppercase letter, one lowercase letter, one digit, and one special character"),
];

const validateChangePassword = [
  check("current_password").notEmpty()
    .withMessage("Current Password is required"),
  check("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
    .withMessage("Password must include at least one uppercase letter, one lowercase letter, one digit, and one special character"),
];

const isRequestValidated = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.array().length > 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: errors.array()[0].msg,
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
    });
  }
  next();
};

module.exports = {
  validateSignUpRequest,
  isRequestValidated,
  validateSignIpRequest,
  validateForgetPassword,
  validateResetpassword,
  validateChangePassword
};
