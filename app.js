/**
 * Express app setup
 * Initializes middleware, routes, error handling, etc.
 */
const path = require('path');
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
const discountRoute = require('./src/routes/discount');
const couponRouter = require('./src/routes/couponRoutes');
const contactsRoute = require('./src/routes/contact');
const { categoryRoute } = require('./src/routes/categoriesRoute');
const { cartRoutes } = require('./src/routes/cartRoutes');
const BrandRoute = require('./src/routes/brandRouters');
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
const { notificationRoute } = require('./src/routes/notificationRoutes');
// Import routes
const resumeRoutes = require('./src/controller/resume/Resume_Routes');
const templateRoutes = require('./src/controller/resume/Template_Routes');
const fileRoutes = require('./src/routes/fileRoutes');
const LoggerService = require('./src/services/logger');
const { componentsRoutes } = require('./src/routes/component');
const DeviceDetector = require('./src/services/deviceDetector');
const { userActivityroute } = require('./src/routes/activity');
const { publicRoutes } = require('./src/routes/public');
const { InquiryRoutes } = require('./src/routes/inquiry');
const { masterRoute } = require('./src/routes/masterRoute');
// Import routes
// const productRoutes = require('./features/products/product.routes');
// Import other feature routes similarly...

const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // HTTP request logging
app.use(express.json()); // Parse JSON body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded body
app.use(cookieParser()); // Cookie parsing

function checkRoute(name, route) {
  if (!route || typeof route !== 'function') {
    console.error(`❌ Route "${name}" is NOT a valid router. Got:`, route);
  } else {
    // console.log(`✅ Route "${name}" loaded successfully.`);
  }
  return route;
}

app.use((req, res, next) => {
  res.setHeader('Accept-CH', 'Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Arch, Sec-CH-UA-Bitness');
  res.setHeader('Critical-CH', 'Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Arch, Sec-CH-UA-Bitness');
  req.deviceInfo = DeviceDetector.detectDevice(req);
  next();
});

verifyEmailConnection().then((result) => console.log(result));
notificationService.socketService = socketService;

app.use(LoggerService.expressRequestLogger());

// Assuming your uploads folder is ./uploads relative to your project root
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/notifications', checkRoute('notificationRoute', notificationRoute));
app.use('/api/products', checkRoute('ProductRoute', ProductRoute));
app.use('/api/users', checkRoute('UserRoute', UserRoute));
app.use('/api/wishlists', checkRoute('WishlistRoute', WishlistRoute));
app.use('/api/categories', checkRoute('categoryRoute', categoryRoute));
app.use('/api/setting', checkRoute('settingRoute', settingRoute));
app.use('/api/reviews', checkRoute('reviewRoute', reviewRoute));
app.use('/api/order', checkRoute('orderRoutes', orderRoutes));
app.use('/api/permission', checkRoute('permissionRoute', permissionRoute));
app.use('/api/roles', checkRoute('RoleRoutes', roleRoute));
app.use('/api/carts', checkRoute('cartRoutes', cartRoutes));
app.use('/api/brands', checkRoute('BrandRoute', BrandRoute));
app.use('/api/auth', checkRoute('authRoute', authRoute));
app.use('/api/attributes', checkRoute('attributeRouter', attributeRouter));
app.use('/api/attachments', checkRoute('attachmentRoutes', attachmentRoutes));
app.use('/api/addresses', checkRoute('addressRoute', addressRoute));
app.use('/api/discounts', checkRoute('discountRoute', discountRoute));
app.use('/api/coupons', checkRoute('couponRouter', couponRouter));
app.use('/api/contacts', checkRoute('contactsRoute', contactsRoute));
app.use('/api/logs', checkRoute('Activity Logs', logRoutes));
app.use('/api/activity-logs', checkRoute('Activity Logs', userActivityroute));
app.use('/api/files', checkRoute('Attachment Files', fileRoutes));
app.use('/api/components', checkRoute('components', componentsRoutes));
app.use('/api/resumes', checkRoute('Attachment Files', resumeRoutes));
app.use('/api/templates', checkRoute('components', templateRoutes));
app.use('/api/contacts', checkRoute('contacts', contactsRoute));
app.use('/api', checkRoute('Public', publicRoutes));
app.use('/api/inquiry', checkRoute('Inquiry', InquiryRoutes));
app.use('/api/masters', checkRoute('Master', masterRoute));
// API Routes
// app.use('/api/resumes', resumeRoutes);
// app.use('/api/templates', templateRoutes);

// Mount other feature routes here...
app.get('/', (req, res) => {
  res.send('APP is working!', JSON.stringify(req));
});

app.get('/api', (req, res) => {
  res.send('api is working!', JSON.stringify(req));
});
// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
    next();
});

module.exports = app;
