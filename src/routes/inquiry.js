const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const InquiryController = require('../controller/inquiry');
const { authMiddleware } = require('../middleware/auth');

const supportUploadDirectory = path.join(__dirname, '..', '..', 'uploads', 'support-tickets');
fs.mkdirSync(supportUploadDirectory, { recursive: true });

const supportTicketUpload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, callback) => callback(null, supportUploadDirectory),
		filename: (_req, file, callback) => {
			callback(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
		},
	}),
	limits: {
		fileSize: 5 * 1024 * 1024,
		files: 5,
	},
	fileFilter: (_req, file, callback) => {
		const allowedMimeTypes = [
			'image/jpeg',
			'image/png',
			'image/webp',
			'application/pdf',
			'application/msword',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'text/plain',
		];

		if (allowedMimeTypes.includes(file.mimetype)) {
			callback(null, true);
			return;
		}

		callback(new Error('Unsupported attachment type'));
	},
});

// Public: Submit inquiry
router.post('/submit', supportTicketUpload.array('files', 5), InquiryController.createInquiry);
router.post('/track', InquiryController.trackInquiry);

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
router.post('/send-proposal', authMiddleware, InquiryController.sendProposal);
router.delete('/:id', authMiddleware, InquiryController.archiveInquiry);

module.exports = { InquiryRoutes: router };
