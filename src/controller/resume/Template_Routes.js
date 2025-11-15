// routes/templates.js
const express = require('express');
const router = express.Router();
const templateController = require('./templateController');

const { validateTemplate } = require('./validation');
const { uploadTemplate } = require('./upload');
const { authMiddleware } = require('../../middleware/auth');

// Public template routes (no auth required)
router.get('/', templateController.getPublicTemplates);
router.get('/search', templateController.searchTemplates);
router.get('/categories', templateController.getTemplateCategories);
router.get('/:id', templateController.getTemplate);
router.get('/:id/preview', templateController.getTemplatePreview);
router.get('/:id/thumbnail', templateController.getTemplateThumbnail);

// Protected template routes (require authentication)
// router.use(authMiddleware);

// Admin-only template management
router.post(
  '/',
  uploadTemplate.fields([
    { name: 'htmlTemplate', maxCount: 1 },
    { name: 'cssStyles', maxCount: 1 },
    { name: 'jsScripts', maxCount: 1 },
    { name: 'previewImage', maxCount: 1 },
    { name: 'thumbnailImage', maxCount: 1 },
  ]),
  validateTemplate,
  templateController.createTemplate
);

router.put(
  '/:id',
  uploadTemplate.fields([
    { name: 'htmlTemplate', maxCount: 1 },
    { name: 'cssStyles', maxCount: 1 },
    { name: 'jsScripts', maxCount: 1 },
    { name: 'previewImage', maxCount: 1 },
    { name: 'thumbnailImage', maxCount: 1 },
  ]),
  validateTemplate,
  templateController.updateTemplate
);

router.delete('/:id', templateController.deleteTemplate);
router.patch('/:id/status', templateController.updateTemplateStatus);

// User template interactions
router.post('/:id/rate', templateController.rateTemplate);
router.get('/:id/validate/:resumeId', templateController.validateResumeWithTemplate);

module.exports = router;
