const { ReasonPhrases, StatusCodes } = require('http-status-codes');
const { FilterOptions } = require('../../utils/helper');
const Wishlist = require('../../models/wishlist'); // Assuming you have a Wishlist model

const createWishlist = async (req, res) => {
  // const { product } = req.body;
  const body = { ...req.body, ...req.params };
  try {
    const data = await Wishlist.findOne({ product: req.body.product });
    if (!data) {
      const wishlist = new Wishlist(body);
      await wishlist.save();
    }

    const currWishlist = await Wishlist.find({ user: req.params.user }, 'product').populate('product', 'slug title price retailPrice images image');
    const length = await Wishlist.countDocuments({ user: req.params.user });

    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      total: length,
      result: currWishlist,
      message: 'Wishlist Added successfully!',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: 'Internal Server Error',
      message: error.message,
    });
  }
};

const addProduct = async (req, res) => {
  try {
    const wishlist = await Wishlist.findById(req.params.id);
    if (!wishlist) {
      return res.status(404).json({
        message: 'Wishlist not found',
        statusCode: StatusCodes.NOT_FOUND,
        status: ReasonPhrases.NOT_FOUND,
      });
    }
    // Add product to the wishlist
    wishlist.products.push(req.body.product); // Assuming product field contains a product ID
    await wishlist.save();

    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      message: 'Add Successful!',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: 'Internal Server Error',
      message: error.message,
    });
  }
};

const removeProduct = async (req, res) => {
  try {
    const data = await Wishlist.findOne({ product: req.params.id });
    if (!data) {
      return res.status(404).json({
        statusCode: 404,
        status: 'Not Found',
        message: 'Wishlist not found',
      });
    }
    await Wishlist.findByIdAndDelete(data.id);

    const currWishlist = await Wishlist.find({ user: req.params.user }, 'product').populate('product', 'slug title price retailPrice images image');
    const length = await Wishlist.countDocuments({ user: req.params.user });

    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      total: length,
      result: currWishlist,
      message: 'Wishlist Remove successfully!',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: 'Internal Server Error',
      message: error.message,
    });
  }
};

const getWishlist = async (req, res) => {
  try {
    const wishlists = await Wishlist.find({ user: req.params.user }, 'product').populate('product', 'slug title price retailPrice images image');
    const length = await Wishlist.countDocuments({ user: req.params.user });
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      message: 'Wishlists retrieved successfully!',
      result: wishlists,
      total: length,
    });
  } catch (error) {
    res.status(200).json({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      status: ReasonPhrases.INTERNAL_SERVER_ERROR,
      message: error.message,
    });
  }
};
const get = async (req, res) => {
  try {
    // const { sort, page, limit, filter } = req.query;

    const filterquery = FilterOptions(req.query, Wishlist);

    const response = await Wishlist.find(filterquery.query, '-__v', filterquery.options).populate('products');
    const length = await Wishlist.countDocuments(filterquery.query);

    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      message: 'Wishlists retrieved successfully',
      result: response,
      total: length,
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: 'Internal Server Error',
      message: error.message,
    });
  }
};

const getSingle = async (req, res) => {
  try {
    const Wishlist = await Wishlist.findById(req.params.id);
    if (!Wishlist) {
      return res.status(404).json({
        statusCode: 404,
        status: 'Not Found',
        message: 'Wishlist not found',
      });
    }
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      result: Wishlist,
      message: 'Wishlist retrieved successfully',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: 'Internal Server Error',
      message: error.message,
    });
  }
};
const update = async (req, res) => {
  try {
    const wishlist = await Wishlist.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('products');
    if (!wishlist) {
      return res.status(404).json({
        statusCode: 404,
        status: 'Not Found',
        message: 'Wishlist not found',
      });
    }
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      result: wishlist,
      message: 'Wishlist updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: 'Internal Server Error',
      message: error.message,
    });
  }
};
const remove = async (req, res) => {
  try {
    const Wishlist = await Wishlist.findByIdAndDelete(req.params.id);
    if (!Wishlist) {
      return res.status(404).json({
        statusCode: 404,
        status: 'Not Found',
        message: 'Wishlist not found',
      });
    }
    res.status(200).json({
      statusCode: 200,
      status: 'OK',
      message: 'Wishlist deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: 'Internal Server Error',
      message: error.message,
    });
  }
};

module.exports = {
  get,
  getSingle,
  update,
  remove,
  getWishlist,
  removeProduct,
  addProduct,
  createWishlist,
};
