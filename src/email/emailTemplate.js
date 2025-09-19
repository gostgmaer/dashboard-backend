const { host, resetPath, confirmPath, loginPath } = require('../config/setting');
const { appUrl, applicaionName, frontendUrl } = require('./');

/**
 * Otp email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const otpEmailTemplate = ({ name, otp, expiryMinutes }) => {
  return {
    subject: `Your One-Time Password (OTP)`,
    html: `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Your OTP Code</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color:#f6f9fc; padding:20px;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      
      <h2 style="color:#333;">Hello ${name || 'User'},</h2>
      <p style="font-size:16px; color:#555;">
        You requested a One-Time Password (OTP) for your account.
      </p>

      <div style="margin:20px 0; text-align:center;">
        <p style="font-size:18px; margin-bottom:10px;">Your OTP code is:</p>
        <div style="font-size:28px; font-weight:bold; color:#2c3e50; padding:15px 30px; border:2px dashed #2c3e50; display:inline-block; border-radius:6px; letter-spacing:4px;">
          ${otp}
        </div>
      </div>

      <p style="font-size:16px; color:#555;">
        This code will expire in <strong>${expiryMinutes} minutes</strong>.  
        Please do not share this code with anyone.
      </p>

      <p style="margin-top:30px; font-size:14px; color:#777;">
        If you did not request this, please ignore this email or contact our support team.
      </p>

      <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">
      <p style="font-size:12px; color:#aaa; text-align:center;">
        &copy; ${new Date().getFullYear()} Your Company. All rights reserved.
      </p>
    </div>
  </body>
  </html>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Welcome email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const welcomeEmailTemplate = (data) => {
  return {
    subject: `Welcome to Our App!`,
    html: `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Welcome</title>
    </head>
    <body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f4f4f4;">
      <table role="presentation" style="width:100%;border-collapse:collapse;background:#f4f4f4;padding:20px 0;">
        <tr>
          <td align="center">
            <table role="presentation" style="width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.1);">
              <tr>
                <td style="background:#4f46e5;padding:20px;text-align:center;color:#ffffff;font-size:24px;font-weight:bold;">
                  Welcome to Our Community 🎉
                </td>
              </tr>
              <tr>
                <td style="padding:30px;font-size:16px;color:#333;">
                  <p>Hi <strong>${data.username}</strong>,</p>
                  <p>We’re excited to have you on board! Thank you for joining us.</p>
                  <p>Here’s what you can do next:</p>
                  <ul style="padding-left:20px;">
                    <li>Explore your dashboard</li>
                    <li>Update your profile</li>
                    <li>Check out our latest features</li>
                  </ul>
                  <p style="margin:20px 0;">
                    <a href="https://yourwebsite.com/login" style="background:#4f46e5;color:#fff;padding:12px 20px;text-decoration:none;border-radius:5px;display:inline-block;">Get Started</a>
                  </p>
                  <p>If you have any questions, just reply to this email—we’re always happy to help.</p>
                  <p>Cheers,<br>The Team</p>
                </td>
              </tr>
              <tr>
                <td style="background:#f4f4f4;padding:15px;text-align:center;color:#777;font-size:12px;">
                  © ${new Date().getFullYear()} Your Company. All rights reserved.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Emailverification email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const emailVerificationTemplate = ({ id,username, emailVerificationToken }) => {
  return {
    subject: `Please Verify Your Email`,
    html: `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Email Verification</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color:#f6f9fc; padding:20px;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      
      <h2 style="color:#2c3e50;">Hello ${username || 'User'},</h2>
      
      <p style="font-size:16px; color:#555;">
        Thank you for signing up! To complete your registration, please verify your email address by clicking the button below:
      </p>

      <div style="margin:30px 0; text-align:center;">
        <a href="${host}/${confirmPath}/${emailVerificationToken}" 
           style="background:#2c3e50; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-size:16px;">
          Verify Email
        </a>
      </div>

      <p style="font-size:14px; color:#777;">
        Or copy and paste this link into your browser:  
        <br/>
        <a href="${host}/${confirmPath}/${emailVerificationToken}" style="color:#2c3e50;">${host}/${confirmPath}/${emailVerificationToken}</a>
      </p>

      <p style="margin-top:30px; font-size:14px; color:#777;">
        If you didn’t create an account, you can safely ignore this email.
      </p>

      <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">
      <p style="font-size:12px; color:#aaa; text-align:center;">
        &copy; ${new Date().getFullYear()} Your Company. All rights reserved.
      </p>
    </div>
  </body>
  </html>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Emailverificationsuccess email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const emailVerificationSuccessTemplate = ({ username }) => {
  return {
    subject: `Email Successfully Verified`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Hi ${username || 'User'},</h2>
    <p>Your email has been successfully verified. 🎉</p>
    <p>You can now enjoy full access to your account.</p>
    <p style="color:#777; font-size:12px;">Thank you for joining us!</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Passwordresetrequest email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const passwordResetRequestTemplate = ({ resetToken, username }) => {
  return {
    subject: `Reset Your Password`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Hello ${username || 'User'},</h2>
    <p>We received a request to reset your password.</p>
    <p>Click the button below to reset it:</p>
    <a href="${host}/${resetPath}?resetToken=${resetToken}" style="display:inline-block; padding:12px 24px; background:#2c3e50; color:#fff; text-decoration:none; border-radius:6px;">Reset Password</a>
    <p style="margin-top:20px; font-size:14px; color:#555;">If you didn’t request this, please ignore this email.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Passwordresetsuccess email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const passwordResetSuccessTemplate = ({ username }) => {
  return {
    subject: `Password Reset Successful`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Hi ${username || 'User'},</h2>
    <p>Your password has been successfully reset ✅.</p>
    <p>If this wasn’t you, please contact our support team immediately.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Passwordchangedsuccess email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const passwordChangedSuccessTemplate = ({ username }) => {
  return {
    subject: `Password Changed Successfully`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Hello ${username || 'User'},</h2>
    <p>Your password was changed successfully 🔒.</p>
    <p>If this change wasn’t made by you, <strong>reset your password immediately</strong> and contact support.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Accountlocked email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const accountLockedTemplate = ({ username, unlockLink }) => {
  return {
    subject: `Account Temporarily Locked`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#e74c3c;">Hi ${username || 'User'},</h2>
    <p>Your account has been temporarily locked due to multiple failed login attempts 🔐.</p>
    <p>Click below to unlock your account:</p>
    <a href="${unlockLink}" style="display:inline-block; padding:12px 24px; background:#e74c3c; color:#fff; text-decoration:none; border-radius:6px;">Unlock Account</a>
    <p style="font-size:14px; color:#777;">If this wasn’t you, we recommend changing your password immediately.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Suspiciouslogin email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const suspiciousLoginTemplate = ({ username, location, device, resetLink }) => {
  return {
    subject: `Suspicious Login Detected`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#f39c12;">Hello ${username || 'User'},</h2>
    <p>We detected a login to your account from a new device/location:</p>
    <ul>
      <li><strong>Location:</strong> ${location || 'Unknown'}</li>
      <li><strong>Device:</strong> ${device || 'Unknown'}</li>
    </ul>
    <p>If this was you, you can safely ignore this message.</p>
    <p>If not, <a href="${resetLink}" style="color:#e74c3c;">reset your password immediately</a>.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Accountdeleted email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const accountDeletedTemplate = ({ username }) => {
  return {
    subject: `Account Deleted`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Goodbye ${username || 'User'},</h2>
    <p>Your account has been successfully deleted 🗑️.</p>
    <p>If you didn’t request this, please contact support immediately.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Subscriptionupdated email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const subscriptionUpdatedTemplate = ({ username, plan }) => {
  return {
    subject: `Subscription Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Hi ${username || 'User'},</h2>
    <p>Your subscription has been updated successfully ✅.</p>
    <p><strong>New Plan:</strong> ${plan || 'N/A'}</p>
    <p>Enjoy your updated features!</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Twofactorcode email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */

/**
 * Paymentfailed email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const paymentFailedTemplate = ({ username, amount, retryLink }) => {
  return {
    subject: `Payment Failed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${username || 'User'},</h2>
    <p>We couldn’t process your recent payment of <strong>$${amount}</strong> 💳.</p>
    <p>Please update your payment method and try again:</p>
    <a href="${retryLink}" style="display:inline-block; padding:12px 24px; background:#e74c3c; color:#fff; border-radius:6px; text-decoration:none;">Update Payment</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Paymentsuccess email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const paymentSuccessTemplate = ({ name, amount, invoiceLink }) => {
  return {
    subject: `Payment Successful`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Payment Received ✅</h2>
    <p>Hi ${name || 'User'},</p>
    <p>We’ve successfully received your payment of <strong>$${amount}</strong>.</p>
    <p>You can download your invoice here:</p>
    <a href="${invoiceLink}" style="display:inline-block; padding:12px 24px; background:#2c3e50; color:#fff; border-radius:6px; text-decoration:none;">View Invoice</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Orderconfirmation email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const orderConfirmationTemplate = ({ username, orderId, items, total }) => {
  return {
    subject: `Order Confirmation`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Order Confirmed 🛒</h2>
    <p>Hi ${username || 'User'}, your order <strong>#${orderId}</strong> has been placed successfully.</p>
    <ul>${itemsList}</ul>
    <p><strong>Total:</strong> $${total}</p>
    <p>We’ll notify you once it ships 🚚.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Ordershipped email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const orderShippedTemplate = ({ username, orderId, trackingLink }) => {
  return {
    subject: `Your Order Has Shipped`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Order is on the way 🚚</h2>
    <p>Hi ${username || 'User'}, your order <strong>#${orderId}</strong> has been shipped.</p>
    <p>You can track it here:</p>
    <a href="${trackingLink}" style="display:inline-block; padding:12px 24px; background:#2c3e50; color:#fff; border-radius:6px; text-decoration:none;">Track Shipment</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Orderdelivered email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const orderDeliveredTemplate = ({ name, orderId }) => {
  return {
    subject: `Order Delivered`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Delivered 🎉</h2>
    <p>Hi ${name || 'User'}, your order <strong>#${orderId}</strong> has been successfully delivered.</p>
    <p>We’d love your feedback! ⭐⭐⭐⭐⭐</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Passwordexpiryreminder email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const passwordExpiryReminderTemplate = ({ name, resetLink }) => {
  return {
    subject: `Password Expiry Reminder`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Password Expiring Soon ⏳</h2>
    <p>Hi ${name || 'User'}, your password will expire soon.</p>
    <p>Please update your password to continue secure access:</p>
    <a href="${resetLink}" style="display:inline-block; padding:12px 24px; background:#2c3e50; color:#fff; border-radius:6px; text-decoration:none;">Update Password</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Newsletter email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const newsletterTemplate = ({ title, content, ctaLink }) => {
  return {
    subject: `Newsletter Update`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>${title}</h2>
    <p>${content}</p>
    <a href="${ctaLink}" style="display:inline-block; padding:12px 24px; background:#27ae60; color:#fff; border-radius:6px; text-decoration:none;">Learn More</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Accountdeactivationwarning email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const accountDeactivationWarningTemplate = ({ name, reactivateLink }) => {
  return {
    subject: `Account Deactivation Warning`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Account Deactivation Warning ⚠️</h2>
    <p>Hi ${name || 'User'}, your account will be deactivated due to inactivity.</p>
    <p>To keep your account active, log in again or click below:</p>
    <a href="${reactivateLink}" style="display:inline-block; padding:12px 24px; background:#f39c12; color:#fff; border-radius:6px; text-decoration:none;">Reactivate Account</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Accountreactivated email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const accountReactivatedTemplate = ({ name }) => {
  return {
    subject: `Account Reactivated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Welcome Back 🎉</h2>
    <p>Hi ${name || 'User'}, your account has been successfully reactivated.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Roleupdated email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const roleUpdatedTemplate = ({ name, role }) => {
  return {
    subject: `Role Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Permissions Updated 🔑</h2>
    <p>Hi ${name || 'User'}, your role has been updated.</p>
    <p><strong>New Role:</strong> ${role}</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Newdevicelogin email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const newDeviceLoginTemplate = ({ name, location, device }) => {
  return {
    subject: `New Device Login Detected`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>New Device Login Detected 👀</h2>
    <p>Hi ${name || 'User'}, a login was detected from:</p>
    <ul>
      <li>Device: ${device}</li>
      <li>Location: ${location}</li>
    </ul>
    <p>If this wasn’t you, please secure your account immediately.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Subscriptionrenewalreminder email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const subscriptionRenewalReminderTemplate = ({ name, plan, renewalDate }) => {
  return {
    subject: `Subscription Renewal Reminder`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Subscription Renewal Reminder 🔔</h2>
    <p>Hi ${name || 'User'}, your <strong>${plan}</strong> plan will renew on <strong>${renewalDate}</strong>.</p>
    <p>No action is needed unless you want to update your subscription.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Subscriptioncancelled email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const subscriptionCancelledTemplate = ({ name, plan }) => {
  return {
    subject: `Subscription Cancelled`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Subscription Cancelled ❌</h2>
    <p>Hi ${name || 'User'}, your <strong>${plan}</strong> subscription has been cancelled.</p>
    <p>You will retain access until the end of your billing period.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Giftcardreceived email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const giftCardReceivedTemplate = ({ name, sender, amount, redeemCode }) => {
  return {
    subject: `Gift Card Received`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>You’ve Received a Gift 🎁</h2>
    <p>Hi ${name || 'User'}, ${sender} sent you a gift card worth <strong>$${amount}</strong>.</p>
    <p>Your redeem code: <strong>${redeemCode}</strong></p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Reviewrequest email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const reviewRequestTemplate = ({ name, product, reviewLink }) => {
  return {
    subject: `Review Request`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>We’d Love Your Feedback ⭐</h2>
    <p>Hi ${name || 'User'}, thank you for purchasing <strong>${product}</strong>.</p>
    <p>Please leave a review to help us improve:</p>
    <a href="${reviewLink}" style="display:inline-block; padding:12px 24px; background:#27ae60; color:#fff; border-radius:6px; text-decoration:none;">Leave Review</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Cartabandonment email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const cartAbandonmentTemplate = ({ name, items, checkoutLink }) => {
  return {
    subject: `Items Left in Cart`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Don’t Forget Your Cart 🛒</h2>
    <p>Hi ${name || 'User'}, you left these items in your cart:</p>
    <ul>${itemsList}</ul>
    <p>Complete your order now:</p>
    <a href="${checkoutLink}" style="display:inline-block; padding:12px 24px; background:#2980b9; color:#fff; border-radius:6px; text-decoration:none;">Checkout Now</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Loyaltypointsearned email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const loyaltyPointsEarnedTemplate = ({ name, points }) => {
  return {
    subject: `Loyalty Points Earned`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>You’ve Earned Points 🎉</h2>
    <p>Hi ${name || 'User'}, you’ve earned <strong>${points}</strong> loyalty points on your recent purchase.</p>
    <p>Keep shopping to earn more rewards!</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Dataexportrequest email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const dataExportRequestTemplate = ({ name, requestDate }) => {
  return {
    subject: `Data Export Request`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Data Export Request 📂</h2>
    <p>Hi ${name || 'User'}, we’ve received your request to export your data on <strong>${requestDate}</strong>.</p>
    <p>We will notify you once your data is ready for download.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Dataexportready email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const dataExportReadyTemplate = ({ name, downloadLink }) => {
  return {
    subject: `Your Data Export is Ready`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Data is Ready ⬇️</h2>
    <p>Hi ${name || 'User'}, your requested data export is now available.</p>
    <p><a href="${downloadLink}" style="padding:12px 24px; background:#2ecc71; color:#fff; border-radius:6px; text-decoration:none;">Download Data</a></p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Policyupdate email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const policyUpdateTemplate = ({ name, policyLink }) => {
  return {
    subject: `Policy Update`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Policy Update 📜</h2>
    <p>Hi ${name || 'User'}, we’ve updated our Terms of Service and Privacy Policy.</p>
    <p>Please review the changes here:</p>
    <a href="${policyLink}" style="color:#2980b9;">Read Policy</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Trialexpiring email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const trialExpiringTemplate = ({ name, expiryDate, upgradeLink }) => {
  return {
    subject: `Trial Expiring Soon`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Trial is Ending Soon ⏳</h2>
    <p>Hi ${name || 'User'}, your free trial ends on <strong>${expiryDate}</strong>.</p>
    <p>Upgrade now to keep enjoying full access:</p>
    <a href="${upgradeLink}" style="padding:12px 24px; background:#27ae60; color:#fff; border-radius:6px; text-decoration:none;">Upgrade Now</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Trialexpired email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const trialExpiredTemplate = ({ name, upgradeLink }) => {
  return {
    subject: `Trial Expired`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Trial Has Ended ⚠️</h2>
    <p>Hi ${name || 'User'}, your trial has expired.</p>
    <p>Upgrade to continue using premium features:</p>
    <a href="${upgradeLink}" style="padding:12px 24px; background:#e67e22; color:#fff; border-radius:6px; text-decoration:none;">Upgrade</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Invoicegenerated email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const invoiceGeneratedTemplate = ({ name, invoiceNumber, amount, invoiceLink }) => {
  return {
    subject: `Invoice Generated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Invoice Generated 🧾</h2>
    <p>Hi ${name || 'User'}, your invoice <strong>#${invoiceNumber}</strong> for <strong>$${amount}</strong> is now available.</p>
    <p><a href="${invoiceLink}" style="padding:12px 24px; background:#34495e; color:#fff; border-radius:6px; text-decoration:none;">View Invoice</a></p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Paymentrefunded email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const paymentRefundedTemplate = ({ name, amount, refundDate }) => {
  return {
    subject: `Payment Refunded`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Refund Processed 💸</h2>
    <p>Hi ${name || 'User'}, your refund of <strong>$${amount}</strong> has been processed on <strong>${refundDate}</strong>.</p>
    <p>The funds may take a few days to reflect in your account.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Maintenancenotice email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const maintenanceNoticeTemplate = ({ name, startTime, endTime }) => {
  return {
    subject: `Scheduled Maintenance Notice`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Scheduled Maintenance 🛠️</h2>
    <p>Hi ${name || 'User'}, our services will be unavailable due to maintenance:</p>
    <p><strong>${startTime}</strong> → <strong>${endTime}</strong></p>
    <p>We appreciate your patience.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Newfeatureannouncement email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const newFeatureAnnouncementTemplate = ({ name, featureName, featureLink }) => {
  return {
    subject: `New Feature Announcement`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>New Feature Unlocked 🚀</h2>
    <p>Hi ${name || 'User'}, we’ve just released <strong>${featureName}</strong>!</p>
    <p>Try it out now:</p>
    <a href="${featureLink}" style="padding:12px 24px; background:#8e44ad; color:#fff; border-radius:6px; text-decoration:none;">Explore Feature</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Birthdaygreeting email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const birthdayGreetingTemplate = ({ name, discountCode }) => {
  return {
    subject: `Happy Birthday!`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Happy Birthday 🎂</h2>
    <p>Hi ${name || 'User'}, we wish you a wonderful birthday!</p>
    <p>Here’s a special discount just for you: <strong>${discountCode}</strong></p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Twofactorsetup email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const twoFactorSetupTemplate = ({ name, setupLink }) => {
  return {
    subject: `Set Up Two-Factor Authentication`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || 'User'},</h2>
    <p>You’ve requested to set up <strong>Two-Factor Authentication (2FA)</strong> on your account.</p>
    <p>Click the link below to complete setup:</p>
    <a href="${setupLink}" style="padding:12px 24px; background:#2c3e50; color:#fff; text-decoration:none; border-radius:6px;">Setup 2FA</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Twofactorcode email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const twoFactorCodeTemplate = ({ name, code }) => {
  return {
    subject: `Your Two-Factor Authentication Code`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || 'User'},</h2>
    <p>Use the following <strong>One-Time Code</strong> to complete your login:</p>
    <h1 style="color:#2c3e50;">${code}</h1>
    <p>This code will expire in 10 minutes.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Backupcodes email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const backupCodesTemplate = ({ name, codes }) => {
  return {
    subject: `Your Backup Login Codes`,
    html: ` <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || 'User'},</h2>
    <p>Here are your <strong>backup login codes</strong> for your account:</p>
    <ul style="font-family: monospace;">
      ${codes.map((c) => `<li>${c}</li>`).join('')}
    </ul>
    <p>Keep them safe! Each code can be used once if you lose access to your 2FA device.</p>
  </div>`,
    attachments: [],
  };
};

/**
 * Newdeviceapproval email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const newDeviceApprovalTemplate = ({ name, device, approveLink, denyLink }) => {
  return {
    subject: `New Device Login Approval`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || 'User'},</h2>
    <p>A new login attempt was detected from:</p>
    <p><strong>Device:</strong> ${device || 'Unknown'}</p>
    <p>Do you recognize this?</p>
    <a href="${approveLink}" style="padding:12px 24px; background:#27ae60; color:#fff; border-radius:6px; text-decoration:none;">Yes, Approve</a>
    <a href="${denyLink}" style="padding:12px 24px; background:#e74c3c; color:#fff; border-radius:6px; text-decoration:none; margin-left:10px;">No, Deny</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Emailchanged email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const emailChangedTemplate = ({ username, oldEmail, newEmail }) => {
  return {
    subject: `Email Address Changed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${username || 'User'},</h2>
    <p>Your account email has been changed.</p>
    <p><strong>Old Email:</strong> ${oldEmail}<br/>
       <strong>New Email:</strong> ${newEmail}</p>
    <p>If this wasn’t you, please reset your password immediately.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Loginalert email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const loginAlertTemplate = ({ username, device, location, time }) => {
  return {
    subject: `Login Alert`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${username || 'User'},</h2>
    <p>Your account was just logged into:</p>
    <ul>
      <li><strong>Device:</strong> ${device || 'Unknown'}</li>
      <li><strong>Location:</strong> ${location || 'Unknown'}</li>
      <li><strong>Time:</strong> ${time || new Date().toISOString()}</li>
    </ul>
    <p>If this wasn’t you, <a href="#">secure your account</a> immediately.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Sessionexpired email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const sessionExpiredTemplate = ({ username }) => {
  return {
    subject: `Session Expired`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${username || 'User'},</h2>
    <p>Your session has expired due to inactivity or security reasons.</p>
    <p>Please log in again to continue:</p>
    <a href="${host}/${loginPath}" style="padding:12px 24px; background:#2c3e50; color:#fff; border-radius:6px; text-decoration:none;">Login Again</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Accountrecovery email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const accountRecoveryTemplate = ({ name, recoveryLink }) => {
  return {
    subject: `Account Recovery Request`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || 'User'},</h2>
    <p>We received a request to recover your account.</p>
    <p>If this was you, click below to recover access:</p>
    <a href="${recoveryLink}" style="padding:12px 24px; background:#2980b9; color:#fff; border-radius:6px; text-decoration:none;">Recover Account</a>
    <p>If not, you can safely ignore this email.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Accountreactivation email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const accountReactivationTemplate = ({ name, reactivateLink }) => {
  return {
    subject: `Reactivate Your Account`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Welcome back ${name || 'User'} 🎉</h2>
    <p>Your account has been deactivated. To reactivate it, click below:</p>
    <a href="${reactivateLink}" style="padding:12px 24px; background:#27ae60; color:#fff; border-radius:6px; text-decoration:none;">Reactivate Account</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Accountsuspended email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const accountSuspendedTemplate = ({ name, reason, supportLink }) => {
  return {
    subject: `Account Suspended`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || 'User'},</h2>
    <p>Your account has been temporarily <strong>suspended</strong>.</p>
    <p><strong>Reason:</strong> ${reason || 'Policy violation or suspicious activity'}.</p>
    <p>Please <a href="${supportLink}">contact support</a> for assistance.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Consentrequired email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const consentRequiredTemplate = ({ name, consentLink }) => {
  return {
    subject: `Consent Required`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || 'User'},</h2>
    <p>We’ve updated our <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>.</p>
    <p>You need to provide consent to continue using your account:</p>
    <a href="${consentLink}" style="padding:12px 24px; background:#2980b9; color:#fff; border-radius:6px; text-decoration:none;">Review & Consent</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Securitysettingsupdated email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const securitySettingsUpdatedTemplate = ({ name, setting }) => {
  return {
    subject: `Security Settings Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || 'User'},</h2>
    <p>Your account security settings have been updated.</p>
    <p><strong>Updated Setting:</strong> ${setting}</p>
    <p>If this wasn’t you, secure your account immediately.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Failedloginattempts email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const failedLoginAttemptsTemplate = ({ name, attempts, lockLink }) => {
  return {
    subject: `Failed Login Attempts Detected`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || 'User'},</h2>
    <p>We noticed <strong>${attempts || 'multiple'}</strong> failed login attempts on your account.</p>
    <p>For your security, you may want to reset your password:</p>
    <a href="${lockLink}" style="padding:12px 24px; background:#e74c3c; color:#fff; border-radius:6px; text-decoration:none;">Secure My Account</a>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Accountverified email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const accountVerifiedTemplate = ({ username }) => {
  return {
    subject: `Account Verified`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Congratulations ${username || 'User'} 🎉</h2>
    <p>Your email has been successfully verified and your account is now fully active.</p>
    <p>You can log in anytime to start using all features.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Logoutalldevices email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const logoutAllDevicesTemplate = ({ name }) => {
  return {
    subject: `Logged Out From All Devices`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || 'User'},</h2>
    <p>You’ve successfully logged out from <strong>all devices</strong>.</p>
    <p>If this wasn’t you, please reset your password immediately.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Trusteddeviceadded email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const trustedDeviceAddedTemplate = ({ name, device, location }) => {
  return {
    subject: `New Trusted Device Added`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || 'User'},</h2>
    <p>A new trusted device has been added to your account.</p>
    <ul>
      <li><strong>Device:</strong> ${device || 'Unknown'}</li>
      <li><strong>Location:</strong> ${location || 'Unknown'}</li>
    </ul>
    <p>If this wasn’t you, remove the device from your security settings.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

module.exports = {
  otpEmailTemplate,
  welcomeEmailTemplate,
  emailVerificationTemplate,
  emailVerificationSuccessTemplate,
  passwordResetRequestTemplate,
  passwordResetSuccessTemplate,
  passwordChangedSuccessTemplate,
  accountLockedTemplate,
  suspiciousLoginTemplate,
  accountDeletedTemplate,
  subscriptionUpdatedTemplate,
  twoFactorCodeTemplate,
  paymentFailedTemplate,
  paymentSuccessTemplate,
  orderConfirmationTemplate,
  orderShippedTemplate,
  orderDeliveredTemplate,
  passwordExpiryReminderTemplate,
  newsletterTemplate,
  accountDeactivationWarningTemplate,
  accountReactivatedTemplate,
  roleUpdatedTemplate,
  newDeviceLoginTemplate,
  subscriptionRenewalReminderTemplate,
  subscriptionCancelledTemplate,
  giftCardReceivedTemplate,
  reviewRequestTemplate,
  cartAbandonmentTemplate,
  loyaltyPointsEarnedTemplate,
  dataExportRequestTemplate,
  dataExportReadyTemplate,
  policyUpdateTemplate,
  trialExpiringTemplate,
  trialExpiredTemplate,
  invoiceGeneratedTemplate,
  paymentRefundedTemplate,
  maintenanceNoticeTemplate,
  newFeatureAnnouncementTemplate,
  birthdayGreetingTemplate,
  twoFactorSetupTemplate,
  backupCodesTemplate,
  newDeviceApprovalTemplate,
  emailChangedTemplate,
  loginAlertTemplate,
  sessionExpiredTemplate,
  accountRecoveryTemplate,
  accountReactivationTemplate,
  accountSuspendedTemplate,
  consentRequiredTemplate,
  securitySettingsUpdatedTemplate,
  failedLoginAttemptsTemplate,
  accountVerifiedTemplate,
  logoutAllDevicesTemplate,
  trustedDeviceAddedTemplate,
};
