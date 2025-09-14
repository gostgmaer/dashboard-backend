const express = require("express");
var session = require("express-session");
const dashboardRoute = express.Router();

const {
  profile,
  updateUser,
  getusers,
  deleteUser,
} = require("../controller/categories/categories");

dashboardRoute.route("/admin/dashboard").get();
dashboardRoute.route("/admin/reports").get();
