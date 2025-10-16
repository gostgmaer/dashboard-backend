// routes/resumes.js
const express = require('express');
const router = express.Router();
const resumeController = require('./resumeController');
const templateController = require('./templateController');
const exportController = require('./exportController');
const { authMiddleware } = require('../../middleware/auth');

// authMidd
const { validateResume, validateResumeSection, validateTemplate } = require('./validation');
const { uploadResume } = require('./upload');
// const { logUserActivity } = require('../middleware/userActivity');

// Apply authentication middleware to all resume routes
router.use(authMiddleware);
// router.use(logUserActivity);

// 🔹 Resume CRUD Operations
router.post('/', resumeController.createResume);
router.get('/', resumeController.getResumes);
router.get('/search', resumeController.searchResumes);
router.get('/stats', resumeController.getResumeStats);
router.get('/:id', resumeController.getResume);
router.put('/:id', resumeController.updateResume);
router.delete('/:id', resumeController.deleteResume);

// 🔹 Resume Sections Management
router.patch('/:id/sections', validateResumeSection, resumeController.updateSection);
router.delete('/:id/sections/:sectionType/:sectionId', resumeController.deleteSection);

// 🔹 Resume Export Routes (with template support)
router.get('/:id/export/pdf', exportController.exportToPDF);
router.get('/:id/export/docx', exportController.exportToDocx);
router.get('/:id/export/html', exportController.exportToHTML);
router.get('/:id/export/json', exportController.exportToJSON);
router.get('/:id/export/txt', exportController.exportToTXT);

// 🔹 Resume Template Management
router.patch('/:id/template/:templateId', resumeController.applyTemplate);

// 🔹 Resume Utilities
router.post('/:id/duplicate', resumeController.duplicateResume);
router.post('/import', uploadResume.single('resume'), resumeController.importResume);
router.post('/:id/download-zip', exportController.downloadAllFormats);

// 🔹 Versioning & History
router.get('/:id/versions', resumeController.getVersions);
router.post('/:id/rollback/:version', resumeController.rollbackVersion);
router.post('/:id/create-version', resumeController.createVersion);

// 🔹 Sharing & Visibility
router.patch('/:id/visibility', resumeController.updateVisibility);
router.get('/:id/share/:token', resumeController.getSharedResume);
router.post('/:id/generate-share-link', resumeController.generateShareLink);

module.exports = router;
