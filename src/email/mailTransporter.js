// emailService.js
const {
  mailService,
  mailPassword,
  mailUserName,
} = require("../config/setting");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Create and export the Nodemailer transporter

// let Mailconfig = {
//   service: mailService,
//   auth: {
//     user: mailUserName,
//     pass: mailPassword
//   },
// };


let Mailconfig = {
  host: mailService, // e.g., smtp.gmail.com
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: mailUserName,
    pass: mailPassword
  }
};
console.log(mailService, mailUserName);
const transporter = nodemailer.createTransport(Mailconfig);

module.exports = transporter;
