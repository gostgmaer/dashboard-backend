const express = require('express');
const contactsRoute = express.Router();
const { create, getData, getSingleRecord, remove, removeMany, update, delData, delMany } = require('../controller/contacts/controller');
const updateMiddleWare = require('../middleware/updateMiddleWare');

contactsRoute.route('/').post(create);
contactsRoute.route('/').get(getData);
contactsRoute.route('/:id').get(getSingleRecord);
contactsRoute.route('/:id').patch(updateMiddleWare, update);
contactsRoute.route('/:id').put(updateMiddleWare, update);
contactsRoute.route('/:id').delete(updateMiddleWare, remove);
contactsRoute.route('/bulk').delete(updateMiddleWare, removeMany);
contactsRoute.route('/remove/:id').delete(delData);
contactsRoute.route('/remove/bulk').delete(delMany);
module.exports = contactsRoute;
