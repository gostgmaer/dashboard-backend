const { appUrl, applicaionName } = require("../config/setting");


/**
 * Welcome email template for new users.
 * @param {Object} data - Data object containing username, email, and optional attachments.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const welcomeEmailTemplate = (data) => {
  const { username, email, attachments = [] } = data.user;
  return {
    subject: `Welcome to Our App, ${username}!`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Our App</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            background-color: #007bff;
            color: #ffffff;
            padding: 10px 20px;
            text-align: center;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
          }
          .content {
            padding: 20px;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            margin: 20px 0;
            background-color: #007bff;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
          }
          .button:hover {
            background-color: #0056b3;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #777;
            padding: 10px;
            border-top: 1px solid #eee;
          }
          @media only screen and (max-width: 600px) {
            .container {
              margin: 10px;
              padding: 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome, ${username}!</h1>
          </div>
          <div class="content">
            <p>Thank you for joining our application! We're thrilled to have you on board.</p>
            <p>Your registered email is: <strong>${email}</strong></p>
            <p>Start exploring our features by clicking the button below:</p>
            <a href="${appUrl}" class="button">Get Started</a>
            <p>If you have any questions, feel free to reach out to our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${applicaionName}. All rights reserved.</p>
            <p>Contact us at support@yourapp.com</p>
          </div>
        </div>
      </body>
      </html>
    `,
    attachments, // Include any attachments provided in data
  };
};

module.exports = { welcomeEmailTemplate };