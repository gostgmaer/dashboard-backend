require("dotenv").config();

const dbUrl = process.env.MONGO_URL;
const jwtSecret = process.env.JWT_SECRET;
const refressSecret = process.env.JWT_REFRESH_SECRET;
const serverPort = process.env.PORT;
const collectionName = process.env.COLLECTION;
const appUrl = process.env.APPURL;


// # Nodemailer configuration

const mailService = process.env.EMAIL_SERVICE;
const mailUserName = process.env.EMAIL_USERNAME;
const mailPassword = process.env.EMAIL_PASSWORD;
const emailName = process.env.EMAIL_NAME;
const enviroment = process.env.NODE_ENV;

// # Mailchimp API key and list ID
const mailchimpKey = process.env.MAILCHIMP_API_KEY;
const mailchimpList = process.env.MAILCHIMP_LIST_ID;

// # Client Application Name
const applicaionName = process.env.APPLICATION_NAME;

// #client urls

const host = process.env.LOGINHOST;
const loginPath = process.env.CLIENTLOGINPAGE;
const resetPath = process.env.CLIENTRESETPASSURL;
const confirmPath = process.env.CLIENTCONFIRMURL;

//Payment config

const paypalClient = process.env.PAYPAL_CLIENT_ID;
const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;
const paypalMode = process.env.PAYPAL_MODE;
const stripePublic = process.env.STRIPE_PUBLIC_KEY;
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const razorPayPublic = process.env.ROZORPAY_PUBLIC_KEY;
const razorPaySecret = process.env.ROZORPAY_SECRET_KEY;






//string of char

const charactersString = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+='


module.exports = {
  dbUrl,
  jwtSecret,
  serverPort,
  collectionName,
  mailService,
  mailPassword,
  mailUserName,
  emailName,
  mailchimpKey,
  mailchimpList,
  applicaionName,paypalMode,
  host,
  loginPath,
  resetPath,
  confirmPath,enviroment,
  refressSecret,
  paypalClient,appUrl,
  paypalSecret,
  stripePublic,
  stripeSecret,razorPayPublic,razorPaySecret,charactersString
};
