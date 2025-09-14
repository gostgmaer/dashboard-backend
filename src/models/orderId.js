const mongoose = require("mongoose");

const orderCounterSchema = new mongoose.Schema({
  prefix: {
    type: String,
    default: "ECO",
    required: true,
  },
  counter: {
    type: Number,
    default: 1234567, // Starting value
  },
});

const OrderCounter = mongoose.model("OrderCounter", orderCounterSchema);

module.exports = OrderCounter;
