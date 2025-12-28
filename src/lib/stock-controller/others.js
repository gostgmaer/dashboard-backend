require("dotenv").config();

const Product = require("../../models/products");
const Wishlist = require('../../models/wishlist'); // Assuming you have a Wishlist model

// const base = 'https://api-m.sandbox.paypal.com';

// let mongo_connection = mongoose.createConnection(dbUrl, {
//   useFindAndModify: false,
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
//   useCreateIndex: true,
//   keepAlive: 1,
//   poolSize: 100,
//   bufferMaxEntries: 0,
//   connectTimeoutMS: 10000,
//   socketTimeoutMS: 30000,
// });

// decrease product quantity after a order created
const handleProductQuantity = async (cart) => {
  try {
    await cart.forEach(async (p) => {
      if (p?.variants?.length <= 0) {
        const update = await Product.findOneAndUpdate(
          {
            _id: p._id,
          },
          {
            $inc: {
              stock: -p.quantity,
              sales: p.quantity,
            },
          },
          {
            new: true,
          }
        );
        return update
      }
      if (p?.variants?.length > 0) {
        await Product.findOneAndUpdate(
          {
            _id: p._id,
            "variants.productId": p?.variant?.productId || "",
          },
          {
            $inc: {
              stock: -p.quantity,
              "variants.$.quantity": -p.quantity,
              sales: p.quantity,
            },
          },
          {
            new: true,
          }
        );
      }
    });
  } catch (err) {
    console.log("err on handleProductQuantity", err.message);
  }
};

const handleProductAttribute = async (key, value, multi) => {
  try {
    // const products = await Product.find({ 'variants.1': { $exists: true } });
    const products = await Product.find({ isCombination: true });

    // console.log('products', products);

    if (multi) {
      await products.forEach(async (p) => {
        await Product.updateOne(
          { _id: p._id },
          {
            $pull: {
              variants: { [key]: { $in: value } },
            },
          }
        );
      });
    } else {
      await products.forEach(async (p) => {
        // console.log('p', p._id);
        await Product.updateOne(
          { _id: p._id },
          {
            $pull: {
              variants: { [key]: value },
            },
          }
        );
      });
    }
  } catch (err) {
    console.log("err, when delete product variants", err.message);
  }
};


const removeOrderedItemsFromWishlist = async (userId, orderedItems) => {
  try {
    // Delete the wishlist entries where the product is in the orderedItems

    // console.log(orderedItems);
    const productIds = orderedItems.map(item => item.product);
    
    const wishlistItemsToDelete = await Wishlist.find({
      user: userId,
      product: { $in: productIds }
    });

    if (wishlistItemsToDelete.length === 0) {
      return { message: 'No items to remove from wishlist' };
    }

    // Delete the found wishlist entries
    await Wishlist.deleteMany({
      user: userId,
      product: { $in: productIds }
    });

    return {
      message: 'Ordered items removed from wishlist',
      removedItems: wishlistItemsToDelete // Return the removed items
    };
  } catch (error) {
    throw new Error(error.message);
  }
};



// Function to update stock on order creation
const updateStockOnOrderCreate = async (orderItems) => {
  try {
    // Loop through all items in the order
    for (const item of orderItems) {
      const product = await Product.findById(item._id); // Find product by ID

      if (product) {
        // Decrease stock by the quantity ordered
        product.stock -= item.cartQuantity;

        // Ensure stock doesn't go below zero
        if (product.stock < 0) {
          throw new Error(`Insufficient stock for product: ${product.title}`);
        }

        await Product.findOneAndUpdate(
          { _id: product.id },
          { stock: product.stock }, // Increment total_view by 1
          { new: true } // Return the updated document
        )
      }
    }
  } catch (error) {
    console.error('Error updating stock on order create:', error);
    throw error; // Re-throw error to handle in your route/controller
  }
};

// Function to update stock on order cancel
const updateStockOnOrderCancel = async (orderItems) => {
  try {
    // Loop through all items in the canceled order
    for (const item of orderItems) {
      const product = await Product.findById(item.product); // Find product by ID

      if (product) {
        // Increase stock by the quantity that was ordered
        product.stock += item.quantity;
        await Product.findOneAndUpdate(
          { _id: product.id },
          { stock: product.stock }, // Increment total_view by 1
          { new: true } // Return the updated document
        )
      }
    }
  } catch (error) {
    console.error('Error updating stock on order cancel:', error);
    throw error; // Re-throw error to handle in your route/controller
  }
};










module.exports = {
  handleProductQuantity,
  handleProductAttribute, updateStockOnOrderCreate,
  updateStockOnOrderCancel, removeOrderedItemsFromWishlist
};
