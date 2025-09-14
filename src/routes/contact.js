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
const userMiddleWare = require("../middleware/userAccess");
const updateMiddleWare = require("../middleware/updateMiddleWare");

contactsRoute.route("/contact").post(create);
contactsRoute.route("/contact").get(userMiddleWare,getData);
contactsRoute.route("/contact/:id").get(userMiddleWare,getSingleRecord);
contactsRoute.route("/contact/:id").patch(updateMiddleWare,userMiddleWare,update);
contactsRoute.route("/contact/:id").put(updateMiddleWare,userMiddleWare,update);
contactsRoute.route("/contact/:id").delete(updateMiddleWare,userMiddleWare,remove);
contactsRoute.route("/contact/bulk").delete(updateMiddleWare,userMiddleWare,removeMany);
contactsRoute.route("/contact/remove/:id").delete(userMiddleWare,delData);
contactsRoute.route("/contact/remove/bulk").delete(userMiddleWare,delMany);
module.exports = contactsRoute;

