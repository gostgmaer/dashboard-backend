const { StatusCodes, ReasonPhrases } = require('http-status-codes');
const User = require('../../models/user'); // Adjust path if needed
const { APIError, formatResponse, standardResponse, errorResponse } = require('../../utils/apiUtils');
// Create a new user
const createUser = async (req, res) => {
  try {
    const user = new User(req.body);
    if (req.body.password) {
      await user.setPassword(req.body.password);
    }
    const saved = await user.save();
    res.status(StatusCodes.CREATED).json({
      statusCode: StatusCodes.CREATED,
      status: ReasonPhrases.CREATED,
      results: { id: saved._id },
      message: 'User created successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Get all users (with pagination and filters)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, ...filters } = req.query;
    const { items, total, page: currentPage, pages } = await User.getPaginatedUsers({ page, limit, filters });
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: items,
      total,
      page: currentPage,
      pages,
      message: 'Users retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Get a single user by ID
const getSingleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: user,
      message: 'User retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Update a user by ID
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    await user.updateProfile(req.body);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: user,
      message: 'User updated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Soft-delete a user by ID
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: 'deleted' }, { new: true });
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Set user password
const setUserPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    await user.setPassword(req.body.password);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: 'Password set successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Validate user password
const validateUserPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const isValid = await user.validatePassword(req.body.password);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: { isValid },
      message: isValid ? 'Password is valid' : 'Password is invalid',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Add product to wishlist
const addToWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const wishList = await user.addToWishlist(req.body.productId);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: wishList,
      message: 'Product added to wishlist successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Remove product from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const wishList = await user.removeFromWishlist(req.body.productId);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: wishList,
      message: 'Product removed from wishlist successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Add product to favorites
const addFavoriteProduct = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const favoriteProducts = await user.addFavoriteProduct(req.body.productId);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: favoriteProducts,
      message: 'Product added to favorites successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Remove product from favorites
const removeFavoriteProduct = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const favoriteProducts = await user.removeFavoriteProduct(req.body.productId);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: favoriteProducts,
      message: 'Product removed from favorites successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Add item to shopping cart
const addToCart = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const { productId, quantity = 1 } = req.body;
    const shoppingCart = await user.addToCart(productId, quantity);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: shoppingCart,
      message: 'Item added to cart successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Remove item from shopping cart
const removeFromCart = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const shoppingCart = await user.removeFromCart(req.body.productId);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: shoppingCart,
      message: 'Item removed from cart successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Clear shopping cart
const clearCart = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const shoppingCart = await user.clearCart();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: shoppingCart,
      message: 'Cart cleared successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Update user preferences
const updatePreferences = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const preferences = await user.updatePreferences(req.body);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: preferences,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Add loyalty points
const addLoyaltyPoints = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const points = await user.addLoyaltyPoints(req.body.points);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: points,
      message: 'Loyalty points added successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Redeem loyalty points
const redeemLoyaltyPoints = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const points = await user.redeemLoyaltyPoints(req.body.points);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: points,
      message: 'Loyalty points redeemed successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Verify user
const verifyUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const isVerified = await user.verifyUser();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: { isVerified },
      message: 'User verified successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Update last login
const updateLastLogin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const lastLogin = await user.updateLastLogin();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: { lastLogin },
      message: 'Last login updated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Find user by email
const findByEmail = async (req, res) => {
  try {
    const user = await User.findByEmail(req.params.email);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: user,
      message: 'User retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Find user by username
const findByUsername = async (req, res) => {
  try {
    const user = await User.findByUsername(req.params.username);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: user,
      message: 'User retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Get all admins
const getAdmins = async (req, res) => {
  try {
    const admins = await User.getAdmins();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: admins,
      total: admins.length,
      message: 'Admins retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Get all customers
const getCustomers = async (req, res) => {
  try {
    const customers = await User.getCustomers();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: customers,
      total: customers.length,
      message: 'Customers retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Search users by keyword
const searchUsers = async (req, res) => {
  try {
    const keyword = req.query.q || '';
    const users = await User.searchUsers(keyword);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: users,
      total: users.length,
      message: 'Users search completed',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Bulk update user role
const bulkUpdateRole = async (req, res) => {
  try {
    const { ids, role } = req.body;
    await User.bulkUpdateRole(ids, role);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: 'User roles updated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Bulk delete users
const bulkDeleteUsers = async (req, res) => {
  try {
    const { ids } = req.body;
    await User.bulkDelete(ids);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: 'Users deleted successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Get user full name
const getFullName = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: { fullName: user.fullName },
      message: 'Full name retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Authenticate user
const authenticateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const isAuthenticated = await user.authenticate(req.body.password);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: { isAuthenticated },
      message: isAuthenticated ? 'Authentication successful' : 'Authentication failed',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Update user status
const updateStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const status = await user.updateStatus(req.body.status);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: status,
      message: 'User status updated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Add payment method
const addPaymentMethod = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const paymentMethods = await user.addPaymentMethod(req.body);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: paymentMethods,
      message: 'Payment method added successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Remove payment method
const removePaymentMethod = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const paymentMethods = await user.removePaymentMethod(req.body.methodId);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: paymentMethods,
      message: 'Payment method removed successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Set default payment method
const setDefaultPaymentMethod = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const paymentMethods = await user.setDefaultPaymentMethod(req.body.methodId);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: paymentMethods,
      message: 'Default payment method set successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Update social media links
const updateSocialMedia = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const socialMedia = await user.updateSocialMedia(req.body);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: socialMedia,
      message: 'Social media links updated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Add interest
const addInterest = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const interests = await user.addInterest(req.body.interest);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: interests,
      message: 'Interest added successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Remove interest
const removeInterest = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const interests = await user.removeInterest(req.body.interest);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: interests,
      message: 'Interest removed successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Get single user statistics
const getUserStatistics = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const stats = await user.getUserStatistics();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: stats,
      message: 'User statistics retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Get single user report
const getUserReport = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const report = await user.getUserReport();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: report,
      message: 'User report retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Dynamic update
const dynamicUpdate = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
        results: null,
        message: 'User not found',
      });
    }
    const result = await user.dynamicUpdate(req.body.field, req.body.value);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: result,
      message: `Field ${req.body.field} updated successfully`,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Bulk update status
const bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    await User.bulkUpdateStatus(ids, status);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: 'User statuses updated successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Get users by status
const getUsersByStatus = async (req, res) => {
  try {
    const users = await User.getUsersByStatus(req.params.status);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: users,
      total: users.length,
      message: `Users with status ${req.params.status} retrieved successfully`,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Get active users
const getActiveUsers = async (req, res) => {
  try {
    const users = await User.getActiveUsers();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: users,
      total: users.length,
      message: 'Active users retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Get verified users
const getVerifiedUsers = async (req, res) => {
  try {
    const users = await User.getVerifiedUsers();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: users,
      total: users.length,
      message: 'Verified users retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Dynamic search
const dynamicSearch = async (req, res) => {
  try {
    const { field, value } = req.query;
    const users = await User.dynamicSearch(field, value);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: users,
      total: users.length,
      message: `Users matching ${field} retrieved successfully`,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Bulk add loyalty points
const bulkAddLoyaltyPoints = async (req, res) => {
  try {
    const { ids, points } = req.body;
    await User.bulkAddLoyaltyPoints(ids, points);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      message: 'Loyalty points added to users successfully',
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      statusCode: StatusCodes.BAD_REQUEST,
      status: ReasonPhrases.BAD_REQUEST,
      results: null,
      message: error.message,
    });
  }
};

// Get users by subscription type
const getUsersBySubscriptionType = async (req, res) => {
  try {
    const users = await User.getUsersBySubscriptionType(req.params.subscriptionType);
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: users,
      total: users.length,
      message: `Users with subscription type ${req.params.subscriptionType} retrieved successfully`,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Get table statistics
const getTableStatistics = async (req, res) => {
  try {
    const stats = await User.getTableStatistics();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: stats,
      message: 'Table statistics retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

// Get table report
const getTableReport = async (req, res) => {
  try {
    const report = await User.getTableReport();
    res.status(StatusCodes.OK).json({
      statusCode: StatusCodes.OK,
      status: ReasonPhrases.OK,
      results: report,
      message: 'Table report retrieved successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      results: null,
      message: error.message,
    });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
  setUserPassword,
  validateUserPassword,
  addToWishlist,
  removeFromWishlist,
  addFavoriteProduct,
  removeFavoriteProduct,
  addToCart,
  removeFromCart,
  clearCart,
  updatePreferences,
  addLoyaltyPoints,
  redeemLoyaltyPoints,
  verifyUser,
  updateLastLogin,
  findByEmail,
  findByUsername,
  getAdmins,
  getCustomers,
  searchUsers,
  bulkUpdateRole,
  bulkDeleteUsers,
  getFullName,
  authenticateUser,
  updateStatus,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  updateSocialMedia,
  addInterest,
  removeInterest,
  getUserStatistics,
  getUserReport,
  dynamicUpdate,
  bulkUpdateStatus,
  getUsersByStatus,
  getActiveUsers,
  getVerifiedUsers,
  dynamicSearch,
  bulkAddLoyaltyPoints,
  getUsersBySubscriptionType,
  getTableStatistics,
  getTableReport,
};