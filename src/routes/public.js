const express = require("express");
const publicRoute = express.Router();

const {
    gethomeDetails,getSingleProductDetails,getProductsSearch,publicCategoriesDetails,getPublicBrands,getAllTage
} = require("../controller/public/home");

publicRoute.route("/public/home/data").get(gethomeDetails);

publicRoute.route("/public/product/details").get(getSingleProductDetails);
publicRoute.route("/public/product/search").get(getProductsSearch);
publicRoute.route("/public/categories").get(publicCategoriesDetails);
publicRoute.route("/public/brands").get(getPublicBrands);
publicRoute.route("/public/tags").get(getAllTage);

module.exports = publicRoute;