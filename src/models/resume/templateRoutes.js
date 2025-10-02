
const express = require('express');
const Template = require('../models/Template');
const { optionalAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   GET /api/templates
// @desc    Get all templates with optional filtering
// @access  Public (with optional auth for personalization)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, premium, search, limit = 50, page = 1 } = req.query;

    const query = { isActive: true };

    // Apply filters
    if (category) {
      query.category = category;
    }

    if (premium === 'true') {
      query.isPremium = true;
    } else if (premium === 'false') {
      query.isPremium = false;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const templates = await Template.find(query)
      .select('-metadata -supportedSections')
      .sort({ 'rating.average': -1, usageCount: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalTemplates = await Template.countDocuments(query);
    const totalPages = Math.ceil(totalTemplates / parseInt(limit));

    // Group by category for better frontend handling
    const categorizedTemplates = templates.reduce((acc, template) => {
      const cat = template.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(template);
      return acc;
    }, {});

    res.json({
      success: true,
      message: 'Templates fetched successfully',
      data: {
        templates,
        categorizedTemplates,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTemplates,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching templates',
      data: null
    });
  }
});

// @route   GET /api/templates/:id
// @desc    Get single template by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);

    if (!template || !template.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        data: null
      });
    }

    res.json({
      success: true,
      message: 'Template fetched successfully',
      data: { template }
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching template',
      data: null
    });
  }
});

// @route   GET /api/templates/slug/:slug
// @desc    Get template by slug
// @access  Public
router.get('/slug/:slug', async (req, res) => {
  try {
    const template = await Template.findOne({ 
      slug: req.params.slug, 
      isActive: true 
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        data: null
      });
    }

    res.json({
      success: true,
      message: 'Template fetched successfully',
      data: { template }
    });
  } catch (error) {
    console.error('Get template by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching template',
      data: null
    });
  }
});

// @route   GET /api/templates/categories/list
// @desc    Get all available categories
// @access  Public
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Template.distinct('category', { isActive: true });

    // Get category stats
    const categoryStats = await Template.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating.average' },
          totalUsage: { $sum: '$usageCount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      message: 'Template categories fetched successfully',
      data: {
        categories,
        categoryStats
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching categories',
      data: null
    });
  }
});

// @route   GET /api/templates/featured/list
// @desc    Get featured templates (highly rated and popular)
// @access  Public
router.get('/featured/list', async (req, res) => {
  try {
    const featuredTemplates = await Template.find({ isActive: true })
      .select('-metadata -supportedSections')
      .sort({ 'rating.average': -1, usageCount: -1 })
      .limit(12);

    res.json({
      success: true,
      message: 'Featured templates fetched successfully',
      data: {
        templates: featuredTemplates
      }
    });
  } catch (error) {
    console.error('Get featured templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching featured templates',
      data: null
    });
  }
});

// @route   POST /api/templates/:id/rate
// @desc    Rate a template (requires auth)
// @access  Private
router.post('/:id/rate', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to rate templates',
        data: null
      });
    }

    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
        data: null
      });
    }

    const template = await Template.findById(req.params.id);
    if (!template || !template.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        data: null
      });
    }

    // Update template rating
    await template.updateRating(rating);

    res.json({
      success: true,
      message: 'Template rated successfully',
      data: {
        averageRating: template.rating.average,
        totalRatings: template.rating.count
      }
    });
  } catch (error) {
    console.error('Rate template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rating template',
      data: null
    });
  }
});

module.exports = router;
