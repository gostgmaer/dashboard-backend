const Review = require('../../models/reviews');
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
// CREATE
const createReview = async (req, res) => {
  try {
    const userId = req.user?._id || req.body.user;
    const review = await Review.create({
      user: userId,
      product: req.body.product,
      rating: req.body.rating,
      title: req.body.title,
      review: req.body.review,
      images: req.body.images,
      created_by: userId
    });
    res.status(201).json(review.toResponse());
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }
    res.status(400).json({ message: err.message });
  }
};

// READ
const getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'name email')
      .populate('product', 'title slug');
    if (!review) return res.status(404).json({ message: 'Review not found' });
    res.json(review.toResponse());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getReviewsByProduct = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await Review.getReviewsByProduct(req.params.productId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getReviewsByUser = async (req, res) => {
  try {
    const reviews = await Review.getReviewsByUser(req.params.userId);
    res.json(reviews.map(r => r.toResponse()));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getReportedReviews = async (req, res) => {
  try {
    const reviews = await Review.getReportedReviews();
    res.json(reviews.map(r => r.toResponse()));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// UPDATE
const updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    await review.editReview({
      title: req.body.title,
      review: req.body.review,
      rating: req.body.rating,
      images: req.body.images,
      updatedBy: req.user?._id || req.body.updated_by
    });

    res.json(review.toResponse());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE
const deleteReview = async (req, res) => {
  try {
    const deleted = await Review.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Review not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteReviewsByProduct = async (req, res) => {
  try {
    const result = await Review.deleteByProduct(req.params.productId);
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteReviewsByUser = async (req, res) => {
  try {
    const result = await Review.deleteByUser(req.params.userId);
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// HELPER ACTIONS
const markReviewHelpful = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    const votes = await review.markHelpful();
    res.json({ helpfulVotes: votes });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const reportReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    await review.reportReview();
    res.json({ reported: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const unreportReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    await review.unreportReview();
    res.json({ reported: false });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const clearReviewImages = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    await review.clearImages();
    res.json(review.toResponse());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// STATS & SEARCH
const getAverageRating = async (req, res) => {
  try {
    const stats = await Review.calculateAverageRating(req.params.productId);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getRatingBreakdown = async (req, res) => {
  try {
    const breakdown = await Review.getRatingBreakdown(req.params.productId);
    res.json(breakdown);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getTopRatedReviews = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const reviews = await Review.getTopRatedReviews(req.params.productId, parseInt(limit));
    res.json(reviews.map(r => r.toResponse()));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getMostHelpfulReviews = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const reviews = await Review.getMostHelpfulReviews(req.params.productId, parseInt(limit));
    res.json(reviews.map(r => r.toResponse()));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const searchReviews = async (req, res) => {
  try {
    const { keyword } = req.query;
    const reviews = await Review.searchReviews(keyword);
    res.json(reviews.map(r => r.toResponse()));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const getTopHelpfulReviews = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const reviews = await Review.find({})
      .sort({ helpfulVotes: -1 })
      .limit(limit)
      .populate('product', 'title')
      .populate('user', 'name');
    res.json(reviews.map(r => r.toResponse()));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const getMostActiveReviewers = async (req, res) => {
  try {
    const data = await Review.aggregate([
      { $group: { _id: '$user', reviewCount: { $sum: 1 } } },
      { $sort: { reviewCount: -1 } },
      { $limit: parseInt(req.query.limit) || 10 },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $project: { _id: 0, userId: '$user._id', name: '$user.name', reviewCount: 1 } }
    ]);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const getReviewsByDateRange = async (req, res) => {
  try {
    const { start, end } = req.query;
    const reviews = await Review.find({
      createdAt: { $gte: new Date(start), $lte: new Date(end) }
    }).populate('product', 'title');
    res.json(reviews.map(r => r.toResponse()));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const getReviewsByRating = async (req, res) => {
  try {
    const { rating } = req.params;
    const reviews = await Review.find({ rating: parseInt(rating) })
      .populate('user', 'name')
      .populate('product', 'title');
    res.json(reviews.map(r => r.toResponse()));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const bulkApproveReviews = async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await Review.updateMany(
      { _id: { $in: ids } },
      { $set: { reported: false } }
    );
    res.json({ updated: result.modifiedCount });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const bulkDeleteReviews = async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await Review.deleteMany({ _id: { $in: ids } });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const replyToReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    review.reply = {
      message: req.body.message,
      repliedBy: req.user._id,
      repliedAt: new Date()
    };
    await review.save();

    res.json({ success: true, reply: review.reply });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
module.exports = {
  createReview,
  getReviewById,
  getReviewsByProduct,
  getReviewsByUser,
  getReportedReviews,
  updateReview,
  deleteReview,
  deleteReviewsByProduct,
  deleteReviewsByUser,
  markReviewHelpful,
  reportReview,
  unreportReview,
  clearReviewImages,
  getAverageRating,
  getRatingBreakdown,
  getTopRatedReviews,
  getMostHelpfulReviews,
  searchReviews,
   bulkApproveReviews,
  bulkDeleteReviews,
  replyToReview,
  getReviewsByRating,
  getReviewsByDateRange,
  getMostActiveReviewers,
  getTopHelpfulReviews

};