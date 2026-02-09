/**
 * Express application setup
 * Initializes middleware, routes, logging, and error handling
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const compressionMiddleware = require('./src/middleware/compression.middleware');
const session = require('express-session');
const { sanitizeInput, sanitizeMongoQuery } = require('./src/middleware/sanitization');
/* =========================
   Core Services & Middleware
========================= */
const LoggerService = require('./src/services/logger');
const DeviceDetector = require('./src/services/deviceDetector');
const socketService = require('./src/services/socketService');
const notificationService = require('./src/services/NotificationService');
const { verifyEmailConnection } = require('./src/email');
const { initializeCache, closeCache } = require('./src/config/cache');
const { notFound, globalErrorHandler } = require('./src/middleware/errorHandler');
const { sendSuccess, HTTP_STATUS } = require('./src/utils/responseHelper');

/* =========================
   Routes
========================= */
const { ProductRoute } = require('./src/routes/consolidatedProductRoutes');
const { UserRoute } = require('./src/routes/userRoutes');
const { WishlistRoute } = require('./src/routes/wishlistRoutes');
const { categoryRoute } = require('./src/routes/categoriesRoute');
const { cartRoutes } = require('./src/routes/cartRoutes');
const { orderRoutes } = require('./src/routes/orderRoutes');
const { permissionRoute } = require('./src/routes/permissionRoute');
const { roleRoute } = require('./src/routes/roleRoute');
const { attributeRouter } = require('./src/routes/attributeRoutes');
const { attachmentRoutes } = require('./src/routes/attachmentsRoutes');
const { logRoutes } = require('./src/routes/logRoutes');
const { userActivityroute } = require('./src/routes/activity');
const { notificationRoute } = require('./src/routes/notificationRoutes');
const { componentsRoutes } = require('./src/routes/component');
const { InquiryRoutes } = require('./src/routes/inquiry');
const { masterRoute } = require('./src/routes/masterRoute');

const BrandRoute = require('./src/routes/brandRouters');
const settingRoute = require('./src/routes/settingRoutes');
const reviewRoute = require('./src/routes/reviewRoutes');
const discountRoute = require('./src/routes/discount');
const couponRouter = require('./src/routes/couponRoutes');
const contactsRoute = require('./src/routes/contact');
const addressRoute = require('./src/routes/address');
const authRoute = require('./src/routes/authRoute');
const fileRoutes = require('./src/routes/fileRoutes');
const templateRoutes = require('./src/controller/resume/Template_Routes');
const { publicRoutes } = require('./src/routes/public');

/* =========================
   App Initialization
========================= */
const app = express();

/* =========================
   Global Middleware
========================= */

// Security headers
app.use(helmet({
   contentSecurityPolicy: {
      directives: {
         defaultSrc: ["'self'"],
         styleSrc: ["'self'", "'unsafe-inline'"],
         scriptSrc: ["'self'"],
         imgSrc: ["'self'", 'data:', 'https:'],
      },
   },
   hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
   },
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
   ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
   : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
   origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
         callback(null, true);
      } else {
         callback(new Error('Not allowed by CORS'));
      }
   },
   credentials: true,
   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression
app.use(compressionMiddleware);
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Input sanitization (after body parsing, before routes)
app.use(sanitizeInput);
app.use(sanitizeMongoQuery);

app.use(LoggerService.expressRequestLogger());

/* =========================
   Session Configuration
========================= */
app.use(
   session({
      name: 'sid',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         sameSite: 'strict',
         maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
   })
);

/* =========================
   Client Hints + Device Info
========================= */
app.use((req, res, next) => {
   res.setHeader('Accept-CH', 'Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Arch, Sec-CH-UA-Bitness');
   res.setHeader('Critical-CH', 'Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version, Sec-CH-UA-Arch, Sec-CH-UA-Bitness');

   req.deviceInfo = DeviceDetector.detectDevice(req);
   next();
});

/* =========================
   Startup Tasks
========================= */
// Initialize services
verifyEmailConnection().then(console.log);
initializeCache().then(() => console.log('Cache initialization complete'));
notificationService.socketService = socketService;

// Graceful shutdown
process.on('SIGTERM', async () => {
   console.log('⏳ SIGTERM received, closing connections...');
   await closeCache();
});

/* =========================
   Static Files
========================= */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =========================
   Helper
========================= */
const safeRoute = (name, route) => {
   if (!route || typeof route !== 'function') {
      console.error(`❌ Route "${name}" is not a valid router`);
      return (_req, res) => res.status(500).json({ success: false, message: 'Route misconfigured' });
   }
   return route;
};

/* =========================
   API Routes
========================= */
app.use('/api/notifications', safeRoute('Notifications', notificationRoute));
app.use('/api/products', safeRoute('Products', ProductRoute));
app.use('/api/users', safeRoute('Users', UserRoute));
app.use('/api/wishlists', safeRoute('Wishlists', WishlistRoute));
app.use('/api/categories', safeRoute('Categories', categoryRoute));
app.use('/api/settings', safeRoute('Settings', settingRoute));
app.use('/api/reviews', safeRoute('Reviews', reviewRoute));
app.use('/api/orders', safeRoute('Orders', orderRoutes));
app.use('/api/permissions', safeRoute('Permissions', permissionRoute));
app.use('/api/roles', safeRoute('Roles', roleRoute));
app.use('/api/cart', safeRoute('Carts', cartRoutes));
app.use('/api/brands', safeRoute('Brands', BrandRoute));
app.use('/api/auth', safeRoute('Auth', authRoute));
app.use('/api/attributes', safeRoute('Attributes', attributeRouter));
app.use('/api/attachments', safeRoute('Attachments', attachmentRoutes));
app.use('/api/addresses', safeRoute('Addresses', addressRoute));
app.use('/api/discounts', safeRoute('Discounts', discountRoute));
app.use('/api/coupons', safeRoute('Coupons', couponRouter));
app.use('/api/contacts', safeRoute('Contacts', contactsRoute));
app.use('/api/logs', safeRoute('Logs', logRoutes));
app.use('/api/activity-logs', safeRoute('ActivityLogs', userActivityroute));
app.use('/api/files', safeRoute('Files', fileRoutes));
app.use('/api/components', safeRoute('Components', componentsRoutes));
app.use('/api/templates', safeRoute('Templates', templateRoutes));
app.use('/api/inquiry', safeRoute('Inquiry', InquiryRoutes));
app.use('/api/masters', safeRoute('Masters', masterRoute));
app.use('/api', safeRoute('Public', publicRoutes));

/* =========================
   Root Health Check
========================= */
app.get('/', (_req, res) => {
   sendSuccess(res, {
      message: '🚀 Application is running successfully',
      statusCode: HTTP_STATUS.OK,
      data: {
         environment: process.env.NODE_ENV || 'development',
         timestamp: new Date().toISOString(),
      },
   });
});

/* =========================
   404 Handler
========================= */
app.use(notFound);

/* =========================
   Global Error Handler
========================= */
app.use(globalErrorHandler);

module.exports = app;
