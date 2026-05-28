const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const DashboardController = require('../controller/dashboardController');

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

// Dashboard KPI stats
dashboardRoute.get('/admin/dashboard/stats', authMiddleware, requireAdmin, DashboardController.getStats);

// Chart data endpoints
dashboardRoute.get('/admin/dashboard/sales', authMiddleware, requireAdmin, DashboardController.getSalesTrend);
dashboardRoute.get('/admin/dashboard/orders-trend', authMiddleware, requireAdmin, DashboardController.getOrdersTrend);
dashboardRoute.get('/admin/dashboard/customer-growth', authMiddleware, requireAdmin, DashboardController.getCustomerGrowth);
dashboardRoute.get('/admin/dashboard/top-categories', authMiddleware, requireAdmin, DashboardController.getTopCategories);
dashboardRoute.get('/admin/dashboard/revenue-distribution', authMiddleware, requireAdmin, DashboardController.getRevenueDistribution);
dashboardRoute.get('/admin/dashboard/discount-usage', authMiddleware, requireAdmin, DashboardController.getDiscountUsage);
dashboardRoute.get('/admin/dashboard/sales-by-channel', authMiddleware, requireAdmin, DashboardController.getSalesByChannel);
dashboardRoute.get('/admin/dashboard/product-performance', authMiddleware, requireAdmin, DashboardController.getProductPerformance);
dashboardRoute.get('/admin/dashboard/payment-methods', authMiddleware, requireAdmin, DashboardController.getPaymentMethods);

// Table data endpoints
dashboardRoute.get('/admin/dashboard/top-products', authMiddleware, requireAdmin, DashboardController.getTopProducts);
dashboardRoute.get('/admin/dashboard/top-brands', authMiddleware, requireAdmin, DashboardController.getTopBrands);
dashboardRoute.get('/admin/dashboard/recent-orders', authMiddleware, requireAdmin, DashboardController.getRecentOrders);
dashboardRoute.get('/admin/dashboard/discounted-products', authMiddleware, requireAdmin, DashboardController.getDiscountedProducts);
dashboardRoute.get('/admin/dashboard/low-stock', authMiddleware, requireAdmin, DashboardController.getLowStock);
dashboardRoute.get('/admin/dashboard/recently-added', authMiddleware, requireAdmin, DashboardController.getRecentlyAdded);

// Filter options
dashboardRoute.get('/admin/dashboard/filter-options', authMiddleware, requireAdmin, DashboardController.getFilterOptions);

module.exports = dashboardRoute;
