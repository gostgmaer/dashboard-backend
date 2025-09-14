const express = require("express");
const authRoute = express.Router();

const {
  signUp,
  signIn,
  resetPassword,
  singout,
  varifySession,
  changedPassword,
  forgetPassword,SocialsignUp,
  accountConfirm, getProfile, getRefreshToken,checkAuth,chechUser,
  customsignIn,updateProfile
} = require("../controller/authentication/auth");
const UpdatebyMiddleWare = require("../middleware/updatedBy");
const userMiddleWare = require("../middleware/userAccess");

const {
  validateSignUpRequest,
  isRequestValidated,
  validateSignIpRequest,
  validateForgetPassword,
  validateResetpassword,
  validateChangePassword
} = require("../validator/auth");



authRoute.route("/user/auth/register").post(validateSignUpRequest, isRequestValidated, signUp);
authRoute.route("/user/auth/social-register").post(SocialsignUp);
authRoute.route("/user/auth/confirm-account/:token").post(accountConfirm);
authRoute.
  route("/user/auth/login").post(validateSignIpRequest, isRequestValidated, signIn);
  authRoute.
  route("/user/auth/custom/login").post(customsignIn);
  authRoute.
  route("/user/auth/checkAuth").post(isRequestValidated, checkAuth);

  authRoute.
  route("/user/auth/checkUser").post(isRequestValidated, chechUser);
  
authRoute.route("/user/auth/verify/session").post(varifySession);
authRoute.route("/user/auth/session/refresh/token").post(getRefreshToken);
authRoute.route("/user/auth/reset-password/:token").post(validateResetpassword, isRequestValidated, resetPassword);
authRoute.route("/user/auth/forget-password").post(validateForgetPassword, isRequestValidated, forgetPassword);
authRoute.route("/user/auth/change-password").post(userMiddleWare, UpdatebyMiddleWare, validateChangePassword, isRequestValidated, changedPassword);
authRoute.route("/user/auth/profile").get(userMiddleWare, getProfile);
authRoute.route("/user/auth/profile/update").patch(userMiddleWare,UpdatebyMiddleWare, updateProfile);
authRoute.route("/user/auth/logout").post(userMiddleWare, singout);

module.exports = authRoute;
