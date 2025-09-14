const express = require("express");
const {
  getAllLogs,
  getSingleLogs,
  updateLogs,
  deleteLogs,
} = require("../controller/logsentry/log");
const logRoute = express.Router();



  logRoute.route("/logs").get(getAllLogs);
  logRoute.route("/logs/:id").get(getSingleLogs);
  logRoute.route("/logs/:id").patch(updateLogs);
  logRoute.route("/logs/:id").put(updateLogs);
  logRoute.route("/logs/:id").delete(deleteLogs);



module.exports = logRoute;