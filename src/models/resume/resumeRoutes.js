
const express = require('express');
const Resume = require('../models/Resume');
const Section = require('../models/Section');
const Template = require('../models/Template');
const { 
  validateResumeCreation, 
  validateResumeUpdate,
  validateSectionCreation,
  validateSectionUpdate,
  validateSectionReorder,
  validateTemplateApplication,
  validateMongoId
} = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/resumes
// @desc    Get all resumes for authenticated user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { includePopulated = 'false', draft } = req.query;

    const query = { user: req.user._id };

    // Filter by draft status if specified
    if (draft !== undefined) {
      query.draft = draft === 'true';
    }

    let resumeQuery = Resume.find(query)
      .sort({ isDefault: -1, updatedAt: -1 });

    if (includePopulated === 'true') {
      resumeQuery = resumeQuery
        .populate('template', 'name slug thumbnail')
        .populate({
          path: 'sections',
          options: { sort: { order: 1 } },
          select: 'type title order isVisible'
        });
    }

    const resumes = await resumeQuery;

    res.json({
      success: true,
      message: 'Resumes fetched successfully',
      data: {
        resumes,
        count: resumes.length
      }
    });
  } catch (error) {
    console.error('Get resumes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching resumes',
      data: null
    });
  }
});

// @route   POST /api/resumes
// @desc    Create a new resume
// @access  Private
router.post('/', validateResumeCreation, async (req, res) => {
  try {
    const { title, template } = req.body;

    // Validate template if provided
    if (template) {
      const templateExists = await Template.findById(template);
      if (!templateExists || !templateExists.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template selected',
          data: null
        });
      }
    }

    // Check if this is the user's first resume
    const existingResumes = await Resume.countDocuments({ user: req.user._id });
    const isFirstResume = existingResumes === 0;

    const resume = new Resume({
      user: req.user._id,
      title,
      template,
      isDefault: isFirstResume, // First resume is automatically default
      draft: true
    });

    await resume.save();

    // If template is provided, increment its usage count
    if (template) {
      const templateDoc = await Template.findById(template);
      await templateDoc.incrementUsage();
    }

    // Populate the created resume
    await resume.populate('template', 'name slug thumbnail');

    res.status(201).json({
      success: true,
      message: 'Resume created successfully',
      data: { resume }
    });
  } catch (error) {
    console.error('Create resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating resume',
      data: null
    });
  }
});

// @route   GET /api/resumes/:id
// @desc    Get single resume by ID
// @access  Private
router.get('/:id', validateMongoId(), async (req, res) => {
  try {
    const resume = await Resume.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    })
    .populate('template', 'name slug thumbnail category')
    .populate({
      path: 'sections',
      options: { sort: { order: 1 } }
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found',
        data: null
      });
    }

    res.json({
      success: true,
      message: 'Resume fetched successfully',
      data: { resume }
    });
  } catch (error) {
    console.error('Get resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching resume',
      data: null
    });
  }
});

// @route   PUT /api/resumes/:id
// @desc    Update resume metadata
// @access  Private
router.put('/:id', validateResumeUpdate, async (req, res) => {
  try {
    const { title, template } = req.body;
    const updateData = {};

    if (title) updateData.title = title;

    // Validate template if provided
    if (template) {
      const templateExists = await Template.findById(template);
      if (!templateExists || !templateExists.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template selected',
          data: null
        });
      }
      updateData.template = template;
    }

    const resume = await Resume.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateData,
      { new: true, runValidators: true }
    ).populate('template', 'name slug thumbnail');

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found',
        data: null
      });
    }

    res.json({
      success: true,
      message: 'Resume updated successfully',
      data: { resume }
    });
  } catch (error) {
    console.error('Update resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating resume',
      data: null
    });
  }
});

// @route   PATCH /api/resumes/:id/default
// @desc    Set resume as default
// @access  Private
router.patch('/:id/default', validateMongoId(), async (req, res) => {
  try {
    const resume = await Resume.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found',
        data: null
      });
    }

    // Set this resume as default (pre-save hook will handle unsetting others)
    resume.isDefault = true;
    await resume.save();

    // Update user's default resume reference
    req.user.defaultResume = resume._id;
    await req.user.save();

    res.json({
      success: true,
      message: 'Resume set as default successfully',
      data: { resume }
    });
  } catch (error) {
    console.error('Set default resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error setting default resume',
      data: null
    });
  }
});

// @route   DELETE /api/resumes/:id
// @desc    Delete resume
// @access  Private
router.delete('/:id', validateMongoId(), async (req, res) => {
  try {
    const resume = await Resume.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found',
        data: null
      });
    }

    // Delete all sections associated with this resume
    await Section.deleteMany({ resume: req.params.id });

    // Delete the resume
    await Resume.findByIdAndDelete(req.params.id);

    // If this was the default resume, set another as default
    if (resume.isDefault) {
      const nextResume = await Resume.findOne({ 
        user: req.user._id,
        _id: { $ne: req.params.id }
      });

      if (nextResume) {
        nextResume.isDefault = true;
        await nextResume.save();
        req.user.defaultResume = nextResume._id;
        await req.user.save();
      } else {
        req.user.defaultResume = null;
        await req.user.save();
      }
    }

    res.json({
      success: true,
      message: 'Resume deleted successfully',
      data: null
    });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting resume',
      data: null
    });
  }
});

// @route   POST /api/resumes/:id/duplicate
// @desc    Duplicate a resume
// @access  Private
router.post('/:id/duplicate', validateMongoId(), async (req, res) => {
  try {
    const originalResume = await Resume.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    }).populate('sections');

    if (!originalResume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found',
        data: null
      });
    }

    // Create new resume
    const duplicatedResume = new Resume({
      user: req.user._id,
      title: `${originalResume.title} (Copy)`,
      template: originalResume.template,
      isDefault: false,
      draft: true
    });

    await duplicatedResume.save();

    // Duplicate sections
    const sectionPromises = originalResume.sections.map(async (section) => {
      const newSection = new Section({
        resume: duplicatedResume._id,
        type: section.type,
        data: section.data,
        order: section.order,
        title: section.title,
        isVisible: section.isVisible
      });
      return await newSection.save();
    });

    const duplicatedSections = await Promise.all(sectionPromises);

    // Update resume with section references
    duplicatedResume.sections = duplicatedSections.map(s => s._id);
    await duplicatedResume.save();

    // Populate the response
    await duplicatedResume.populate('template', 'name slug thumbnail');

    res.status(201).json({
      success: true,
      message: 'Resume duplicated successfully',
      data: { resume: duplicatedResume }
    });
  } catch (error) {
    console.error('Duplicate resume error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error duplicating resume',
      data: null
    });
  }
});

// Continue with more routes in the next part...
module.exports = router;
