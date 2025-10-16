const express = require('express');

const dashboardRoute = express.Router();

const { profile, updateUser, getusers, deleteUser } = require('../controller/categories/categories');

dashboardRoute.route('/admin/dashboard').get();
dashboardRoute.route('/admin/reports').get();
