const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const dashboardRoute = express.Router();

const requireAdmin = (req, res, next) => {
	const roleName = req.user?.role?.name || req.user?.role || '';
	if (!['admin', 'super_admin', 'superadmin'].includes(String(roleName).toLowerCase())) {
		return res.status(403).json({
			success: false,
			message: 'Forbidden: admin access required',
		});
	}
	return next();
};

const notImplemented = (feature) => (_req, res) => {
	res.status(501).json({
		success: false,
		message: `${feature} is not implemented yet`,
	});
};

dashboardRoute.get('/admin/dashboard', authMiddleware, requireAdmin, notImplemented('Admin dashboard API'));
dashboardRoute.get('/admin/reports', authMiddleware, requireAdmin, notImplemented('Admin reports API'));

module.exports = dashboardRoute;
