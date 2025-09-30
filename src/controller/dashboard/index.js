import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Coupon from "../models/Coupon.js";
import Wishlist from "../models/Wishlist.js";
import Review from "../models/Review.js";
import ActivityLog from "../models/ActivityLog.js";

/**
 * GET /api/dashboard
 * Returns mega dashboard data including stats, charts, tables, analytics, inventory, activity, and system alerts
 */
export const getDashboardData = async (req, res) => {
  try {
    // ----------------- STATS -----------------
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = totalUsers - activeUsers;

    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
    });

    const usersByRole = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]);

    const usersByDevice = await User.aggregate([
      { $group: { _id: "$deviceType", count: { $sum: 1 } } }
    ]);

    const totalProducts = await Product.countDocuments();
    const totalCategories = (await Product.distinct("categories")).length;
    const totalBrands = (await Product.distinct("brand")).length;

    const totalOrders = await Order.countDocuments();
    const completedOrders = await Order.countDocuments({ status: "completed" });
    const pendingOrders = await Order.countDocuments({ status: "pending" });
    const cancelledOrders = await Order.countDocuments({ status: "cancelled" });

    const revenueAgg = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" }, avgOrderValue: { $avg: "$total" } } }
    ]);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const avgOrderValue = revenueAgg[0]?.avgOrderValue || 0;

    const repeatPurchaseRate = 22.5; // Placeholder, calculate based on orders per user
    const cartAbandonmentRate = 18.7; // Placeholder, calculate if you track abandoned carts

    const totalCoupons = await Coupon.countDocuments();
    const totalWishlistItems = await Wishlist.countDocuments();
    const totalReviews = await Review.countDocuments();
    const refunds = await Order.countDocuments({ status: "refunded" });
    const returns = await Order.countDocuments({ status: "returned" });

    // ----------------- CHARTS -----------------
    const ordersByStatus = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const ordersByShipping = await Order.aggregate([
      { $group: { _id: "$shippingMethod", count: { $sum: 1 } } }
    ]);

    const paymentMethods = await Order.aggregate([
      { $group: { _id: "$paymentMethod", count: { $sum: 1 }, revenue: { $sum: "$total" } } }
    ]);

    const monthlyRevenue = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, revenue: { $sum: "$total" } } },
      { $sort: { _id: 1 } }
    ]);

    const categoryRevenue = await Order.aggregate([
      { $unwind: "$products" },
      { $lookup: { from: "products", localField: "products.product", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      { $group: { _id: "$product.categories", revenue: { $sum: "$products.price" } } }
    ]);

    const brandRevenue = await Order.aggregate([
      { $unwind: "$products" },
      { $lookup: { from: "products", localField: "products.product", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      { $group: { _id: "$product.brand", revenue: { $sum: "$products.price" } } }
    ]);

    const stockDistribution = {
      outOfStock: await Product.countDocuments({ stock: 0 }),
      lowStock: await Product.countDocuments({ stock: { $lte: 10, $gt: 0 } }),
      mediumStock: await Product.countDocuments({ stock: { $gt: 10, $lte: 50 } }),
      highStock: await Product.countDocuments({ stock: { $gt: 50 } })
    };

    const userLocation = await User.aggregate([
      { $group: { _id: "$country", users: { $sum: 1 } } }
    ]);

    const dailyActiveUsers = await User.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$lastLogin" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const newVsReturningUsers = [
      { type: "new", count: newUsersToday },
      { type: "returning", count: activeUsers - newUsersToday }
    ];

    const topRegionsByRevenue = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: "$shippingAddress.region", revenue: { $sum: "$total" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]);

    const revenueForecastNextMonth = [
      { week: "Week1", revenue: 110000 },
      { week: "Week2", revenue: 120000 }
    ]; // Placeholder

    const userEngagementHeatmap = [
      { hour: 9, logins: 120 },
      { hour: 12, logins: 180 }
    ]; // Placeholder

    const salesTrend = [
      { day: "2025-09-25", revenue: 40000 },
      { day: "2025-09-26", revenue: 42000 }
    ]; // Placeholder

    const customerActivityStreaks = [
      { user: "Amit", streak: 10 },
      { user: "Ravi", streak: 7 }
    ]; // Placeholder

    // ----------------- TABLES -----------------
    const topCustomers = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: "$user", totalSpent: { $sum: "$total" } } },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { name: "$user.name", email: "$user.email", totalSpent: 1 } }
    ]);

    const topProducts = await Order.aggregate([
      { $unwind: "$products" },
      { $group: { _id: "$products.product", qty: { $sum: "$products.quantity" }, revenue: { $sum: "$products.price" } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      { $project: { title: "$product.title", qty: 1, revenue: 1 } }
    ]);

    const categoryInventory = await Product.aggregate([
      { $group: { _id: "$categories", totalStock: { $sum: "$stock" }, inventoryValue: { $sum: "$price" } } },
      { $project: { categoryName: "$_id", totalStock: 1, inventoryValue: 1, _id: 0 } }
    ]);

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(10);
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(10);
    const recentCoupons = await Coupon.find().sort({ createdAt: -1 }).limit(10);
    const recentReviews = await Review.find().sort({ createdAt: -1 }).limit(10);
    const lowStockProducts = await Product.find({ stock: { $lte: 10, $gt: 0 } }).limit(10);
    const outOfStockProducts = await Product.find({ stock: 0 }).limit(10);
    const slowMovingProducts = await Product.find().sort({ lastSold: 1 }).limit(10);

    const highReturningCustomerOrders = await Order.find({ status: "completed" }).limit(10); // Placeholder
    const highValueOrders = await Order.find({ total: { $gte: 10000 } }).limit(10);
    const failedPayments = await Order.find({ status: "failed" }).limit(10);
    const topPromotionalOrders = await Order.find({ couponApplied: { $exists: true } }).limit(10);

    // ----------------- INVENTORY OVERVIEW -----------------
    const inventoryOverview = {
      totalInStock: await Product.countDocuments({ stock: { $gt: 0 } }),
      lowStock: stockDistribution.lowStock,
      outOfStock: stockDistribution.outOfStock,
      totalInventoryValue: await Product.aggregate([{ $group: { _id: null, value: { $sum: "$price" } } }]).then(r => r[0]?.value || 0),
      stockDistribution,
      inventoryTurnover: [
        { product: "Smartphone X", turnover: 3.5 } // Placeholder
      ],
      backorderAlerts: [
        { product: "Laptop Pro", qty: 5 } // Placeholder
      ]
    };

    // ----------------- ACTIVITY LOGS -----------------
    const activityLogs = await ActivityLog.find().sort({ createdAt: -1 }).limit(10);

    // ----------------- RESPONSE -----------------
    const response = {
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        newUsersToday,
        usersByRole,
        usersByDevice,
        totalProducts,
        totalCategories,
        totalBrands,
        totalOrders,
        completedOrders,
        pendingOrders,
        cancelledOrders,
        totalRevenue,
        avgOrderValue,
        repeatPurchaseRate,
        cartAbandonmentRate,
        totalCoupons,
        totalWishlistItems,
        totalReviews,
        refunds,
        returns,
        highValueOrders
      },
      charts: {
        ordersByStatus,
        ordersByShipping,
        paymentMethods,
        monthlyRevenue,
        categoryRevenue,
        brandRevenue,
        stockDistribution,
        userLocation,
        dailyActiveUsers,
        newVsReturningUsers,
        topRegionsByRevenue,
        revenueForecastNextMonth,
        userEngagementHeatmap,
        salesTrend,
        customerActivityStreaks
      },
      tables: {
        topCustomers,
        topProducts,
        categoryInventory,
        recentOrders,
        recentUsers,
        recentCoupons,
        recentReviews,
        lowStockProducts,
        outOfStockProducts,
        slowMovingProducts,
        highReturningCustomerOrders,
        highValueOrders,
        failedPayments,
        topPromotionalOrders
      },
      inventoryOverview,
      activityLogs,
      customerInsights: {
        repeatVsNewRatio: 22.5,
        averageOrderFrequency: 3.2,
        customerLifetimeValue: 1450,
        churnedCustomers: 120,
        averageBasketSize: 3.5,
        topRegionsByRevenue,
        topReferringSources: [
          { source: "Facebook Ads", users: 120 },
          { source: "Organic", users: 500 }
        ],
        customerSegmentRevenue: [
          { segment: "VIP", revenue: 500000 },
          { segment: "Regular", revenue: 400000 }
        ]
      },
      couponAnalytics: {
        couponsUsedToday: 5,
        mostUsedCoupons: [{ code: "NEWYEAR50", usageCount: 120 }],
        totalDiscountGiven: 56000,
        couponRevenueImpact: [{ code: "NEWYEAR50", revenue: 250000 }]
      },
      productAnalytics: {
        mostViewedProducts: [{ title: "Smartphone X", views: 1500 }],
        mostWishlistedProducts: [{ title: "Bluetooth Speaker", wishlists: 250 }],
        lowRatingProducts: [{ title: "Old Laptop", rating: 2.5 }],
        mostReturnedProducts: [{ title: "Headphones", returns: 15 }],
        inventoryTurnoverRate: [{ product: "Smartphone X", turnover: 3.5 }],
        slowMovingProducts: [{ product: "Old Laptop", lastSold: "2025-06-15" }],
        highConversionProducts: [{ product: "Smartphone Pro", conversionRate: 0.45 }],
        highViewLowSaleProducts: [{ product: "Bluetooth Speaker", views: 1200, sales: 50 }]
      },
      systemAlerts: {
        lowStockAlerts: [{ product: "Bluetooth Speaker", stock: 6 }],
        pendingOrdersAlerts: [{ orderId: "6510c84e2f19b02c918bc1a5", status: "pending" }],
        failedPayments: [{ orderId: "6510c84e2f19b02c918bc1c0", method: "UPI" }],
        delayedShipments: [{ orderId: "6510c84e2f19b02c918bc1d1", expectedDelivery: "2025-09-30" }],
        criticalSystemAlerts: [{ message: "Database connection latency high", level: "critical" }]
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return res.status(500).json({ message: "Failed to fetch dashboard data", error });
  }
};
