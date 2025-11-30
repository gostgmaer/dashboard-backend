const express = require('express');
const router = express.Router();
const ContactInquiryController = require('../controller/inquiry');
const { authMiddleware } = require('../middleware/auth');

// Public: Submit inquiry
router.post('/submit', ContactInquiryController.createInquiry);

// Admin routes
router.get('/', authMiddleware, ContactInquiryController.getAllInquiries);
router.get('/search', authMiddleware, ContactInquiryController.searchInquiries);
router.get('/stats', authMiddleware, ContactInquiryController.getDashboardStats);
router.get('/high-priority', authMiddleware, ContactInquiryController.getHighPriority);
router.get('/:id', authMiddleware, ContactInquiryController.getInquiryById);

// Admin actions
router.put('/:id', authMiddleware, ContactInquiryController.updateInquiry);
router.put('/bulk-update', authMiddleware, ContactInquiryController.bulkUpdateInquiries);
router.post('/:id/contact', authMiddleware, ContactInquiryController.contactClient);
router.delete('/:id', authMiddleware, ContactInquiryController.archiveInquiry);

module.exports = { InquiryRoutes: router };
