const express = require("express");
const contactsRoute = express.Router();
const {
  create,
  getData,
  getSingleRecord,
  remove,
  removeMany,
  update,delData,delMany
} = require("../controller/contacts/controller");
const updateMiddleWare = require("../middleware/updateMiddleWare");

contactsRoute.route("/contact").post(create);
contactsRoute.route("/contact").get(getData);
contactsRoute.route("/contact/:id").get(getSingleRecord);
contactsRoute.route("/contact/:id").patch(updateMiddleWare,update);
contactsRoute.route("/contact/:id").put(updateMiddleWare,update);
contactsRoute.route("/contact/:id").delete(updateMiddleWare,remove);
contactsRoute.route("/contact/bulk").delete(updateMiddleWare,removeMany);
contactsRoute.route("/contact/remove/:id").delete(delData);
contactsRoute.route("/contact/remove/bulk").delete(delMany);
module.exports = contactsRoute;

