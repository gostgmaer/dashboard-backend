const express = require('express');
const router = express.Router();
const InquiryController = require('../controller/inquiry');
const { authMiddleware } = require('../middleware/auth');

// Public: Submit inquiry
router.post('/submit', InquiryController.createInquiry);

// Admin routes
router.get('/', authMiddleware, InquiryController.getAllInquiries);
router.get('/search', authMiddleware, InquiryController.searchInquiries);
router.get('/stats', authMiddleware, InquiryController.getDashboardStats);
router.get('/high-priority', authMiddleware, InquiryController.getHighPriority);
router.get('/:id', authMiddleware, InquiryController.getInquiryById);

// Admin actions
router.put('/:id', authMiddleware, InquiryController.updateInquiry);
router.patch('/:id', authMiddleware, InquiryController.updateInquiry);
router.put('/bulk-update', authMiddleware, InquiryController.bulkUpdateInquiries);
router.patch('/bulk-update', authMiddleware, InquiryController.bulkUpdateInquiries);
router.post('/:id/contact', authMiddleware, InquiryController.contactClient);
router.delete('/:id', authMiddleware, InquiryController.archiveInquiry);

module.exports = { InquiryRoutes: router };
