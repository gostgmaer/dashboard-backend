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



authRoute.route("/auth/register").post(validateSignUpRequest, isRequestValidated, signUp);
authRoute.route("/auth/social-register").post(SocialsignUp);
authRoute.route("/auth/confirm-account/:token").post(accountConfirm);
authRoute.
  route("/auth/login").post(validateSignIpRequest, isRequestValidated, signIn);
  authRoute.
  route("/auth/custom/login").post(customsignIn);
  authRoute.
  route("/auth/checkAuth").post(isRequestValidated, checkAuth);

  authRoute.
  route("/auth/checkUser").post(isRequestValidated, chechUser);
  
authRoute.route("/auth/verify/session").post(varifySession);
authRoute.route("/auth/session/refresh/token").post(getRefreshToken);
authRoute.route("/auth/reset-password/:token").post(validateResetpassword, isRequestValidated, resetPassword);
authRoute.route("/auth/forget-password").post(validateForgetPassword, isRequestValidated, forgetPassword);
authRoute.route("/auth/change-password").post(userMiddleWare, UpdatebyMiddleWare, validateChangePassword, isRequestValidated, changedPassword);
authRoute.route("/auth/profile").get(userMiddleWare, getProfile);
authRoute.route("/auth/profile/update").patch(userMiddleWare,UpdatebyMiddleWare, updateProfile);
authRoute.route("/auth/logout").post(userMiddleWare, singout);

module.exports = authRoute;
