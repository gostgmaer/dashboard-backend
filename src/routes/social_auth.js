const express = require('express');
const socialLogin = express.Router();
// const socialController = require('../controllers/social-account-controllers');
// const { authenticateToken } = require('../middleware/auth');
// const { rateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validation');
const { body } = require('express-validator');
const socialAccountControllers = require('../controller/social-account-controllers');
const { authMiddleware } = require('../middleware/auth');

// Rate limiting configurations
// const socialLinkLimiter = rateLin({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 10, // limit each IP to 10 requests per windowMs
//   message: 'Too many social account operations from this IP',
// });

// const socialLoginLimiter = rateLimiter({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 20, // more lenient for login attempts
//   message: 'Too many social login attempts from this IP',
// });

// Validation schemas
const linkAccountValidation = [body('provider').isIn(['google', 'facebook', 'twitter', 'github']).withMessage('Invalid provider'), body('accessToken').optional().isString().withMessage('Access token must be a string'), body('code').optional().isString().withMessage('Code must be a string'), body('email').optional().isEmail().withMessage('Invalid email format')];

const unlinkAccountValidation = [body('provider').isIn(['google', 'facebook', 'twitter', 'github']).withMessage('Invalid provider'), body('providerId').optional().isString().withMessage('Provider ID must be a string')];

const updateEmailValidation = [body('provider').isIn(['google', 'facebook', 'twitter', 'github']).withMessage('Invalid provider'), body('providerId').isString().withMessage('Provider ID is required'), body('newEmail').isEmail().withMessage('Valid email is required')];

// Routes

/**
 * @route   POST /api/auth/social/link
 * @desc    Link a social account to existing authenticated user
 * @access  Private (requires authentication)
 */
socialLogin.post('/link', authMiddleware, socialAccountControllers.linkSocialAccount.bind(socialAccountControllers));

/**
 * @route   POST /api/auth/social/unlink
 * @desc    Unlink a social account from authenticated user
 * @access  Private (requires authentication)
 */
socialLogin.post('/unlink', authMiddleware, socialAccountControllers.unlinkSocialAccount);

/**
 * @route   GET /api/auth/social/accounts
 * @desc    Get all linked social accounts for authenticated user
 * @access  Private (requires authentication)
 */
socialLogin.get('/accounts', authMiddleware, socialAccountControllers.getSocialAccounts);

/**
 * @route   POST /api/auth/social/login
 * @desc    Authenticate or create user via social provider
 * @access  Public
 */
socialLogin.post(
  '/login',
  socialAccountControllers.socialLogin
);

/**
 * @route   POST /api/auth/social/verify
 * @desc    Verify a linked social account
 * @access  Private (requires authentication)
 */
socialLogin.post('/verify', authMiddleware, socialAccountControllers.verifySocialAccount);

/**
 * @route   PUT /api/auth/social/update-email
 * @desc    Update email for a linked social account
 * @access  Private (requires authentication)
 */
socialLogin.put('/update-email', authMiddleware, socialAccountControllers.updateSocialAccountEmail);

module.exports = socialLogin;
