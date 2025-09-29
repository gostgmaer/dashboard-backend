const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer', // Reference to the User model
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product', // Reference to the Product model
      required: true,
      index: true, // Faster lookup for product reviews
    },
     isDeleted: { type: Boolean, default: false},
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    title: { type: String, trim: true, maxlength: 100 },
    review: {
      type: String, trim: true, maxlength: 2000,
    },
    images: [
      {
        url: { type: String, required: true },
        name: { type: String },
      },
    ],

    helpfulVotes: {
      type: Number,
      default: 0,
    },
    reported: {
      type: Boolean,
      default: false,
    },

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  },
  { timestamps: true }
);

// ✅ Ensure a user can review a product only once
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// ✅ Instance method - get simplified images
reviewSchema.methods.getSimplifiedImages = function () {
  return this.images.map((image) => ({
    url: image.url,
    name: image.name,
  }));
};

// ✅ Static method - calculate average rating for a product
reviewSchema.statics.calculateAverageRating = async function (productId) {
  const stats = await this.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    return {
      averageRating: Math.round(stats[0].averageRating * 10) / 10, // Round to 1 decimal
      totalReviews: stats[0].totalReviews,
    };
  }

  return { averageRating: 0, totalReviews: 0 };
};

// ✅ Helper - format review response for API
reviewSchema.methods.toResponse = function () {
  return {
    id: this._id,
    user: this.user,
    product: this.product,
    rating: this.rating,
    title: this.title,
    review: this.review,
    images: this.getSimplifiedImages(),
    helpfulVotes: this.helpfulVotes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// ✅ Helper - mark review as helpful
reviewSchema.methods.markHelpful = async function () {
  this.helpfulVotes += 1;
  await this.save();
  return this.helpfulVotes;
};

// ✅ Helper - report a review
reviewSchema.methods.reportReview = async function () {
  this.reported = true;
  await this.save();
  return this.reported;
};
/* =========================
   📌 Instance Methods
   ========================= */

// Edit review content
reviewSchema.methods.editReview = async function ({ title, review, rating, images, updated_by }) {
  if (title) this.title = title;
  if (review) this.review = review;
  if (rating) this.rating = rating;
  if (images) this.images = images;
  if (updated_by) this.updated_by = updated_by;
  await this.save();
  return this;
};

// Remove review images
reviewSchema.methods.clearImages = async function () {
  this.images = [];
  await this.save();
  return this;
};

// Unreport a review (admin action)
reviewSchema.methods.unreportReview = async function () {
  this.reported = false;
  await this.save();
  return this.reported;
};

// Check if review is positive
reviewSchema.methods.isPositive = function () {
  return this.rating >= 4;
};

// Check if review is negative
reviewSchema.methods.isNegative = function () {
  return this.rating <= 2;
};

/* =========================
   📌 Static Methods
   ========================= */

// Get all reviews for a product (with pagination)
reviewSchema.statics.getReviewsByProduct = async function (productId, { page = 1, limit = 10 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    this.find({ product: productId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    this.countDocuments({ product: productId })
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
};

// Get all reviews by a user
reviewSchema.statics.getReviewsByUser = function (userId) {
  return this.find({ user: userId }).populate('product', 'title slug');
};

// Get reported reviews (for moderation)
reviewSchema.statics.getReportedReviews = function () {
  return this.find({ reported: true }).populate('product', 'title').populate('user', 'name email');
};

// Delete all reviews for a product (e.g., when product is deleted)
reviewSchema.statics.deleteByProduct = function (productId) {
  return this.deleteMany({ product: productId });
};

// Delete all reviews by a user (e.g., GDPR request)
reviewSchema.statics.deleteByUser = function (userId) {
  return this.deleteMany({ user: userId });
};

// Get top-rated reviews for a product
reviewSchema.statics.getTopRatedReviews = function (productId, limit = 5) {
  return this.find({ product: productId })
    .sort({ rating: -1, helpfulVotes: -1 })
    .limit(limit);
};

// Get most helpful reviews for a product
reviewSchema.statics.getMostHelpfulReviews = function (productId, limit = 5) {
  return this.find({ product: productId })
    .sort({ helpfulVotes: -1 })
    .limit(limit);
};

// Get review stats grouped by rating
reviewSchema.statics.getRatingBreakdown = async function (productId) {
  const breakdown = await this.aggregate([
    { $match: { product: mongoose.Types.ObjectId(productId) } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);
  return breakdown;
};

// Search reviews by keyword
reviewSchema.statics.searchReviews = function (keyword) {
  return this.find({
    $or: [
      { title: { $regex: keyword, $options: 'i' } },
      { review: { $regex: keyword, $options: 'i' } }
    ]
  });
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
