const Review = require('../../models/reviews');
const { sendSuccess, sendCreated, HTTP_STATUS } = require('../../utils/responseHelper');
const AppError = require('../../utils/appError');
const { catchAsync } = require('../../middleware/errorHandler');

// CREATE
const createReview = catchAsync(async (req, res) => {
  const userId = req.user?._id || req.body.user;
  const review = await Review.create({
    user: userId,
    product: req.body.product,
    rating: req.body.rating,
    title: req.body.title,
    review: req.body.review,
    images: req.body.images,
    created_by: userId,
  });
  return sendCreated(res, { data: review.toResponse(), message: 'Review created' });
});

// READ
const getReviewById = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.id).populate('user', 'name email').populate('product', 'title slug');
  if (!review) {
    throw AppError.notFound('Review not found');
  }
  return sendSuccess(res, { data: review.toResponse(), message: 'Review retrieved' });
});

const getReviewsByProduct = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await Review.getReviewsByProduct(req.params.productId, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return sendSuccess(res, { data: result, message: 'Reviews retrieved' });
});

const getReviewsByUser = catchAsync(async (req, res) => {
  const reviews = await Review.getReviewsByUser(req.params.userId);
  return sendSuccess(res, { data: reviews.map((r) => r.toResponse()), message: 'User reviews retrieved' });
});

const getReportedReviews = catchAsync(async (req, res) => {
  const reviews = await Review.getReportedReviews();
  return sendSuccess(res, { data: reviews.map((r) => r.toResponse()), message: 'Reported reviews retrieved' });
});

// UPDATE
const updateReview = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw AppError.notFound('Review not found');
  }

  await review.editReview({
    title: req.body.title,
    review: req.body.review,
    rating: req.body.rating,
    images: req.body.images,
    updated_by: req.user?._id || req.body.updated_by,
  });

  return sendSuccess(res, { data: review.toResponse(), message: 'Review updated' });
});

// DELETE
const deleteReview = catchAsync(async (req, res) => {
  const deleted = await Review.findByIdAndDelete(req.params.id);
  if (!deleted) {
    throw AppError.notFound('Review not found');
  }
  return sendSuccess(res, { message: 'Review deleted' });
});

const deleteReviewsByProduct = catchAsync(async (req, res) => {
  const result = await Review.deleteByProduct(req.params.productId);
  return sendSuccess(res, { data: { deletedCount: result.deletedCount }, message: 'Product reviews deleted' });
});

const deleteReviewsByUser = catchAsync(async (req, res) => {
  const result = await Review.deleteByUser(req.params.userId);
  return sendSuccess(res, { data: { deletedCount: result.deletedCount }, message: 'User reviews deleted' });
});

// HELPER ACTIONS
const markReviewHelpful = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw AppError.notFound('Review not found');
  }
  const votes = await review.markHelpful();
  return sendSuccess(res, { data: { helpfulVotes: votes }, message: 'Review marked helpful' });
});

const reportReview = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw AppError.notFound('Review not found');
  }
  await review.reportReview();
  return sendSuccess(res, { data: { reported: true }, message: 'Review reported' });
});

const unreportReview = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw AppError.notFound('Review not found');
  }
  await review.unreportReview();
  return sendSuccess(res, { data: { reported: false }, message: 'Review unreported' });
});

const clearReviewImages = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw AppError.notFound('Review not found');
  }
  await review.clearImages();
  return sendSuccess(res, { data: review.toResponse(), message: 'Review images cleared' });
});

// STATS & SEARCH
const getAverageRating = catchAsync(async (req, res) => {
  const stats = await Review.calculateAverageRating(req.params.productId);
  return sendSuccess(res, { data: stats, message: 'Average rating retrieved' });
});

const getRatingBreakdown = catchAsync(async (req, res) => {
  const breakdown = await Review.getRatingBreakdown(req.params.productId);
  return sendSuccess(res, { data: breakdown, message: 'Rating breakdown retrieved' });
});

const getTopRatedReviews = catchAsync(async (req, res) => {
  const { limit = 5 } = req.query;
  const reviews = await Review.getTopRatedReviews(req.params.productId, parseInt(limit));
  return sendSuccess(res, { data: reviews.map((r) => r.toResponse()), message: 'Top rated reviews retrieved' });
});

const getMostHelpfulReviews = catchAsync(async (req, res) => {
  const { limit = 5 } = req.query;
  const reviews = await Review.getMostHelpfulReviews(req.params.productId, parseInt(limit));
  return sendSuccess(res, { data: reviews.map((r) => r.toResponse()), message: 'Most helpful reviews retrieved' });
});

const searchReviews = catchAsync(async (req, res) => {
  const { keyword } = req.query;
  const reviews = await Review.searchReviews(keyword);
  return sendSuccess(res, { data: reviews.map((r) => r.toResponse()), message: 'Search results' });
});

const getTopHelpfulReviews = catchAsync(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const reviews = await Review.find({}).sort({ helpfulVotes: -1 }).limit(limit).populate('product', 'title').populate('user', 'name');
  return sendSuccess(res, { data: reviews.map((r) => r.toResponse()), message: 'Top helpful reviews retrieved' });
});

const getMostActiveReviewers = catchAsync(async (req, res) => {
  const data = await Review.aggregate([
    { $group: { _id: '$user', reviewCount: { $sum: 1 } } },
    { $sort: { reviewCount: -1 } },
    { $limit: parseInt(req.query.limit) || 10 },
    { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { _id: 0, userId: '$user._id', name: '$user.name', reviewCount: 1 } },
  ]);
  return sendSuccess(res, { data, message: 'Most active reviewers retrieved' });
});

const getReviewsByDateRange = catchAsync(async (req, res) => {
  const { start, end } = req.query;
  const reviews = await Review.find({
    createdAt: { $gte: new Date(start), $lte: new Date(end) },
  }).populate('product', 'title');
  return sendSuccess(res, { data: reviews.map((r) => r.toResponse()), message: 'Reviews by date range retrieved' });
});

const getReviewsByRating = catchAsync(async (req, res) => {
  const { rating } = req.params;
  const reviews = await Review.find({ rating: parseInt(rating) })
    .populate('user', 'name')
    .populate('product', 'title');
  return sendSuccess(res, { data: reviews.map((r) => r.toResponse()), message: 'Reviews by rating retrieved' });
});

const bulkApproveReviews = catchAsync(async (req, res) => {
  const { ids } = req.body;
  const result = await Review.updateMany({ _id: { $in: ids } }, { $set: { reported: false } });
  return sendSuccess(res, { data: { updated: result.modifiedCount }, message: 'Reviews bulk approved' });
});

const bulkDeleteReviews = catchAsync(async (req, res) => {
  const { ids } = req.body;
  const result = await Review.deleteMany({ _id: { $in: ids } });
  return sendSuccess(res, { data: { deleted: result.deletedCount }, message: 'Reviews bulk deleted' });
});

const replyToReview = catchAsync(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    throw AppError.notFound('Review not found');
  }

  review.reply = {
    message: req.body.message,
    repliedBy: req.user._id,
    repliedAt: new Date(),
  };
  await review.save();

  return sendSuccess(res, { data: { reply: review.reply }, message: 'Reply added' });
});

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
  getTopHelpfulReviews,
};