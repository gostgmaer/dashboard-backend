const session = require("express-session");
const mongoSessionStore = require("connect-mongodb-session")(session);


const sessionStore = new mongoSessionStore({
    uri: "mongodb+srv://kishor811:c11yrbZf6MOdj8Ue@test.yrbiejx.mongodb.net/?retryWrites=true&w=majority",
    collection: "sessions",
  });


  module.exports = sessionStore;