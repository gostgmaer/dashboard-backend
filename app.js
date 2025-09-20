/**
 * Express app setup
 * Initializes middleware, routes, error handling, etc.
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const { ProductRoute } = require('./src/routes/consolidatedProductRoutes');
const { UserRoute } = require('./src/routes/userRoutes');
const { WishlistRoute } = require('./src/routes/wishlistRoutes');
const settingRoute = require('./src/routes/settingRoutes');
const reviewRoute = require('./src/routes/reviewRoutes');
const { permissionRoute } = require('./src/routes/permissionRoute');
const { orderRoutes } = require('./src/routes/orderRoutes');
const logRoute = require('./src/routes/logs');
const discountRoute = require('./src/routes/discount');
const couponRouter = require('./src/routes/couponRoutes');
const contactsRoute = require('./src/routes/contact');
const { categoryRoute } = require('./src/routes/categoriesRoute');
const { cartRoutes } = require('./src/routes/cartRoutes');
const BrandRoute = require('./src/routes/brandRouters');
// const authRoute = require('./src/routes/auth');
const { attributeRouter } = require('./src/routes/attributeRoutes');
const { attachmentRoutes } = require('./src/routes/attachmentsRoutes');
const addressRoute = require('./src/routes/address');
const { logRoutes } = require('./src/routes/logRoutes');
const { roleRoute } = require('./src/routes/roleRoute');
const { verifyEmailConnection } = require('./src/email');
const authRoute = require('./src/routes/authRoute');
const socketService = require('./src/services/socketService');
const notificationService = require('./src/services/NotificationService');
const NotificationMiddleware = require('./src/middleware/notificationMiddleware');
const {notificationRoute} = require('./src/routes/notificationRoutes');
// Import routes
// const productRoutes = require('./features/products/product.routes');
// Import other feature routes similarly...

const app = express();

// Middleware
app.use(helmet());                 // Security headers
app.use(cors());                   // Enable CORS
app.use(morgan('dev'));            // HTTP request logging
app.use(express.json());           // Parse JSON body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded body
app.use(cookieParser());           // Cookie parsing

function checkRoute(name, route) {
  if (!route || typeof route !== "function") {
    console.error(`❌ Route "${name}" is NOT a valid router. Got:`, route);
  } else {
    console.log(`✅ Route "${name}" loaded successfully.`);
  }
  return route;
}


verifyEmailConnection().then((result) => console.log(result));

notificationService.socketService = socketService;


// // Mount APIs
// app.use('/api/products', ProductRoute);
// app.use('/api/users', UserRoute);
// app.use('/api/wishlists', WishlistRoute);
// app.use('/api/categories',categoryRoute );
// app.use('/api/settings', settingRoute);
// app.use('/api/reviews',reviewRoute );
// app.use('/api/permissins',permissionRoute );
// app.use('/api/carts',cartRoutes );
// app.use('/api/brands',BrandRoute );
// app.use('/api/user',authRoute );
// app.use('/api/attributes',attributeRouter );
// app.use('/api/attachments',attachmentsRoutes );
// app.use('/api/address',addressRoute );
// app.use('/api/logs',logRoute );
// app.use('/api/discounts',discountRoute );
// app.use('/api/coupons',couponRouter );
// app.use('/api/contacts',contactsRoute );
// app.use('/api/orders',orderRoutes );

app.use('/api/notifications', checkRoute("notificationRoute", notificationRoute));
app.use('/api/products', checkRoute("ProductRoute", ProductRoute));
app.use('/api/users', checkRoute("UserRoute", UserRoute));
app.use('/api/wishlists', checkRoute("WishlistRoute", WishlistRoute));
app.use('/api/categories', checkRoute("categoryRoute", categoryRoute));
app.use('/api/settings', checkRoute("settingRoute", settingRoute));
app.use('/api/reviews', checkRoute("reviewRoute", reviewRoute));
app.use('/api/orders', checkRoute("orderRoutes", orderRoutes));
app.use('/api/permission', checkRoute("permissionRoute", permissionRoute));
app.use('/api/roles', checkRoute("RoleRoutes", roleRoute));
app.use('/api/carts', checkRoute("cartRoutes", cartRoutes));
app.use('/api/brands', checkRoute("BrandRoute", BrandRoute));
app.use('/api/auth', checkRoute("authRoute", authRoute));
app.use('/api/attributes', checkRoute("attributeRouter", attributeRouter));
app.use('/api/attachments', checkRoute("attachmentRoutes", attachmentRoutes));
app.use('/api/addresses', checkRoute("addressRoute", addressRoute));
app.use('/api/logs', checkRoute("logRoute", logRoute));
app.use('/api/discounts', checkRoute("discountRoute", discountRoute));
app.use('/api/coupons', checkRoute("couponRouter", couponRouter));
app.use('/api/contacts', checkRoute("contactsRoute", contactsRoute));
app.use('/api/logs', checkRoute("Activity Logs", logRoutes));



// Mount other feature routes here...
app.get("/", (req, res) => {
  res.send("APP is working!");
});

app.get("/api", (req, res) => {
  res.send("API is working!");
});
// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;
