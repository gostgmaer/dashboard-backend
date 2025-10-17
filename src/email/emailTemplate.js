const { host, resetPath, confirmPath, loginPath } = require('../config/setting');
const { formatRelativeDuration } = require('../utils/helper');
const { appUrl, applicaionName, frontendUrl } = require('./');

/**
 * Otp email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const otpEmailTemplate = ({ username, otp, expiryMinutes }) => {
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
      
      <h2 style="color:#333;">Hello ${username || 'User'},</h2>
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
        This code will expire in <strong>${formatRelativeDuration(expiryMinutes)}</strong>.  
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
const emailVerificationTemplate = ({ id, username, emailVerificationTokens }) => {
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
const paymentSuccessTemplate = ({ username, amount, invoiceLink }) => {
  return {
    subject: `Payment Successful`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Payment Received ✅</h2>
    <p>Hi ${username || 'User'},</p>
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
const orderDeliveredTemplate = ({ username, orderId }) => {
  return {
    subject: `Order Delivered`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Delivered 🎉</h2>
    <p>Hi ${username || 'User'}, your order <strong>#${orderId}</strong> has been successfully delivered.</p>
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
const passwordExpiryReminderTemplate = ({ username, resetLink }) => {
  return {
    subject: `Password Expiry Reminder`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Password Expiring Soon ⏳</h2>
    <p>Hi ${username || 'User'}, your password will expire soon.</p>
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
const accountDeactivationWarningTemplate = ({ username, reactivateLink }) => {
  return {
    subject: `Account Deactivation Warning`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Account Deactivation Warning ⚠️</h2>
    <p>Hi ${username || 'User'}, your account will be deactivated due to inactivity.</p>
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
const accountReactivatedTemplate = ({ username }) => {
  return {
    subject: `Account Reactivated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Welcome Back 🎉</h2>
    <p>Hi ${username || 'User'}, your account has been successfully reactivated.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Roleupdated email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const ROLE_ASSIGNED = ({ username, rolename }) => {
  return {
    subject: `Role Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Permissions Updated 🔑</h2>
    <p>Hi ${username || 'User'}, your role has been updated.</p>
    <p><strong>New Role:</strong> ${rolename}</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Newdevicelogin email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const newDeviceLoginTemplate = ({ username, location, device }) => {
  return {
    subject: `New Device Login Detected`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>New Device Login Detected 👀</h2>
    <p>Hi ${username || 'User'}, a login was detected from:</p>
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
const subscriptionRenewalReminderTemplate = ({ username, plan, renewalDate }) => {
  return {
    subject: `Subscription Renewal Reminder`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Subscription Renewal Reminder 🔔</h2>
    <p>Hi ${username || 'User'}, your <strong>${plan}</strong> plan will renew on <strong>${renewalDate}</strong>.</p>
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
const subscriptionCancelledTemplate = ({ username, plan }) => {
  return {
    subject: `Subscription Cancelled`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Subscription Cancelled ❌</h2>
    <p>Hi ${username || 'User'}, your <strong>${plan}</strong> subscription has been cancelled.</p>
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
const giftCardReceivedTemplate = ({ username, sender, amount, redeemCode }) => {
  return {
    subject: `Gift Card Received`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>You’ve Received a Gift 🎁</h2>
    <p>Hi ${username || 'User'}, ${sender} sent you a gift card worth <strong>$${amount}</strong>.</p>
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
const reviewRequestTemplate = ({ username, product, reviewLink }) => {
  return {
    subject: `Review Request`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>We’d Love Your Feedback ⭐</h2>
    <p>Hi ${username || 'User'}, thank you for purchasing <strong>${product}</strong>.</p>
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
const cartAbandonmentTemplate = ({ username, items, checkoutLink }) => {
  return {
    subject: `Items Left in Cart`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Don’t Forget Your Cart 🛒</h2>
    <p>Hi ${username || 'User'}, you left these items in your cart:</p>
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
const loyaltyPointsEarnedTemplate = ({ username, points }) => {
  return {
    subject: `Loyalty Points Earned`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>You’ve Earned Points 🎉</h2>
    <p>Hi ${username || 'User'}, you’ve earned <strong>${points}</strong> loyalty points on your recent purchase.</p>
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
const dataExportRequestTemplate = ({ username, requestDate }) => {
  return {
    subject: `Data Export Request`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Data Export Request 📂</h2>
    <p>Hi ${username || 'User'}, we’ve received your request to export your data on <strong>${requestDate}</strong>.</p>
    <p>We will notify you once your data is ready for download.</p>
  </div>`,
    attachments: [], // Include any attachments if provided
  };
};

/**
 * Policyupdate email template.
 * @param {Object} data - Data object containing required parameters.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */
const policyUpdateTemplate = ({ username, policyLink }) => {
  return {
    subject: `Policy Update`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Policy Update 📜</h2>
    <p>Hi ${username || 'User'}, we’ve updated our Terms of Service and Privacy Policy.</p>
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
const trialExpiringTemplate = ({ username, expiryDate, upgradeLink }) => {
  return {
    subject: `Trial Expiring Soon`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Trial is Ending Soon ⏳</h2>
    <p>Hi ${username || 'User'}, your free trial ends on <strong>${expiryDate}</strong>.</p>
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
const trialExpiredTemplate = ({ username, upgradeLink }) => {
  return {
    subject: `Trial Expired`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Trial Has Ended ⚠️</h2>
    <p>Hi ${username || 'User'}, your trial has expired.</p>
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
const invoiceGeneratedTemplate = ({ username, invoiceNumber, amount, invoiceLink }) => {
  return {
    subject: `Invoice Generated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Invoice Generated 🧾</h2>
    <p>Hi ${username || 'User'}, your invoice <strong>#${invoiceNumber}</strong> for <strong>$${amount}</strong> is now available.</p>
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
const paymentRefundedTemplate = ({ username, amount, refundDate }) => {
  return {
    subject: `Payment Refunded`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Refund Processed 💸</h2>
    <p>Hi ${username || 'User'}, your refund of <strong>$${amount}</strong> has been processed on <strong>${refundDate}</strong>.</p>
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
const maintenanceNoticeTemplate = ({ username, startTime, endTime }) => {
  return {
    subject: `Scheduled Maintenance Notice`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Scheduled Maintenance 🛠️</h2>
    <p>Hi ${username || 'User'}, our services will be unavailable due to maintenance:</p>
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
const newFeatureAnnouncementTemplate = ({ username, featureName, featureLink }) => {
  return {
    subject: `New Feature Announcement`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>New Feature Unlocked 🚀</h2>
    <p>Hi ${username || 'User'}, we’ve just released <strong>${featureName}</strong>!</p>
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
const birthdayGreetingTemplate = ({ username, discountCode }) => {
  return {
    subject: `Happy Birthday!`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Happy Birthday 🎂</h2>
    <p>Hi ${username || 'User'}, we wish you a wonderful birthday!</p>
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
const twoFactorSetupTemplate = ({ username, setupLink }) => {
  return {
    subject: `Set Up Two-Factor Authentication`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${username || 'User'},</h2>
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
const twoFactorCodeTemplate = ({ username, code }) => {
  return {
    subject: `Your Two-Factor Authentication Code`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${username || 'User'},</h2>
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
const backupCodesTemplate = ({ username, codes }) => {
  return {
    subject: `Your Backup Login Codes`,
    html: ` <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${username || 'User'},</h2>
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
const newDeviceApprovalTemplate = ({ username, device, approveLink, denyLink }) => {
  return {
    subject: `New Device Login Approval`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${username || 'User'},</h2>
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
const accountRecoveryTemplate = ({ username, recoveryLink }) => {
  return {
    subject: `Account Recovery Request`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${username || 'User'},</h2>
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
const accountReactivationTemplate = ({ username, reactivateLink }) => {
  return {
    subject: `Reactivate Your Account`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Welcome back ${username || 'User'} 🎉</h2>
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
const accountSuspendedTemplate = ({ username, reason, supportLink }) => {
  return {
    subject: `Account Suspended`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${username || 'User'},</h2>
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
const consentRequiredTemplate = ({ username, consentLink }) => {
  return {
    subject: `Consent Required`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${username || 'User'},</h2>
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
const securitySettingsUpdatedTemplate = ({ username, setting }) => {
  return {
    subject: `Security Settings Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${username || 'User'},</h2>
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
const failedLoginAttemptsTemplate = ({ username, attempts, lockLink }) => {
  return {
    subject: `Failed Login Attempts Detected`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${username || 'User'},</h2>
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
const logoutAllDevicesTemplate = ({ username }) => {
  return {
    subject: `Logged Out From All Devices`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${username || 'User'},</h2>
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
const trustedDeviceAddedTemplate = ({ username, device, location }) => {
  return {
    subject: `New Trusted Device Added`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${username || 'User'},</h2>
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
const phoneVerificationTemplate = ({ username, phone, verificationCode, expiryMinutes }) => {
  return {
    subject: `Verify Your Phone Number`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Please verify your phone number: <strong>${phone}</strong>.</p>
      <p>Your verification code is:</p>
      <h1 style="color:#1a73e8;">${verificationCode}</h1>
      <p>This code will expire in <strong>${expiryMinutes} minutes</strong>.</p>
      <p>Please do not share this code with anyone.</p>
      <p>If you did not request this, please ignore this email or contact our support team.</p>
    </div>`,
    attachments: [],
  };
};

const emailPhoneVerificationReminderTemplate = ({ username }) => {
  return {
    subject: `Reminder: Verify Your Email & Phone`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>This is a friendly reminder to complete your email and phone verification to access all features.</p>
    </div>`,
    attachments: [],
  };
};

const phoneNumberChangeRequestTemplate = ({ username, newPhone, confirmationCode, expiryMinutes }) => {
  return {
    subject: `Confirm Phone Number Change`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Please confirm your new phone number: <strong>${newPhone}</strong>.</p>
      <p>Use the confirmation code below:</p>
      <h1 style="color:#1a73e8;">${confirmationCode}</h1>
      <p>This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
      <p>If you did not request this change, please contact support immediately.</p>
    </div>`,
    attachments: [],
  };
};

const phoneNumberChangeConfirmationTemplate = ({ username, updatedPhone }) => {
  return {
    subject: `Phone Number Updated Successfully`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your phone number has been updated to <strong>${updatedPhone}</strong>.</p>
      <p>If you did not authorize this change, please contact support immediately.</p>
    </div>`,
    attachments: [],
  };
};

const dataExportReadyTemplate = ({ username, downloadLink }) => {
  return {
    subject: `Your Data Export is Ready`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your data export request has been processed.</p>
      <p>You can download your data using the link below:</p>
      <a href="${downloadLink}" style="padding:12px 24px; background:#1a73e8; color:#fff; border-radius:6px; text-decoration:none;">Download Data</a>
    </div>`,
    attachments: [],
  };
};

const privacyPolicyUpdateTemplate = ({ username, policyLink }) => {
  return {
    subject: `Privacy Policy Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>We have updated our privacy policy. Please review the changes here:</p>
      <a href="${policyLink}" style="padding:12px 24px; background:#1a73e8; color:#fff; border-radius:6px; text-decoration:none;">View Privacy Policy</a>
    </div>`,
    attachments: [],
  };
};

const termsOfServiceUpdateTemplate = ({ username, termsLink }) => {
  return {
    subject: `Terms of Service Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Our Terms of Service have been updated. Please review the updated terms here:</p>
      <a href="${termsLink}" style="padding:12px 24px; background:#1a73e8; color:#fff; border-radius:6px; text-decoration:none;">View Terms of Service</a>
    </div>`,
    attachments: [],
  };
};

const loginAttemptLimitExceededTemplate = ({ username }) => {
  return {
    subject: `Account Locked Due to Failed Logins`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
      <p>Please try again later or reset your password.</p>
    </div>`,
    attachments: [],
  };
};

const twoFactorEnabledDisabledNotificationTemplate = ({ username, status }) => {
  return {
    subject: `Two-Factor Authentication Status Changed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your two-factor authentication (2FA) has been <strong>${status}</strong> for your account.</p>
    </div>`,
    attachments: [],
  };
};

const accountVerificationReminderTemplate = ({ username }) => {
  return {
    subject: `Reminder: Verify Your Account`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Please complete your account verification to enjoy full access.</p>
    </div>`,
    attachments: [],
  };
};

const accountSecurityAuditCompletedTemplate = ({ username }) => {
  return {
    subject: `Account Security Audit Completed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>A recent security audit has been completed on your account.</p>
      <p>Please log in to review the recommendations and keep your account secure.</p>
    </div>`,
    attachments: [],
  };
};

const backupEmailAddedRemovedTemplate = ({ username, action }) => {
  return {
    subject: `Backup Email Address Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>A backup email address has been <strong>${action}</strong> your account.</p>
    </div>`,
    attachments: [],
  };
};

const trustedDeviceManagementUpdateTemplate = ({ username }) => {
  return {
    subject: `Trusted Device List Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Your list of trusted devices has been updated.</p>
      <p>Please review your devices for account security.</p>
    </div>`,
    attachments: [],
  };
};

const multiFactorAuthenticationSetupReminderTemplate = ({ username }) => {
  return {
    subject: `Reminder: Set Up Multi-Factor Authentication`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Enhance your account security by setting up multi-factor authentication (MFA).</p>
    </div>`,
    attachments: [],
  };
};

const secondaryPhoneVerificationTemplate = ({ username, verificationCode, expiryMinutes }) => {
  return {
    subject: `Verify Secondary Phone Number`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Please verify your secondary phone number using the code below:</p>
      <h1 style="color:#1a73e8;">${verificationCode}</h1>
      <p>This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
    </div>`,
    attachments: [],
  };
};

const identityVerificationRequestTemplate = ({ username }) => {
  return {
    subject: `Identity Verification Required`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Please submit additional identity verification documents to proceed with high-value transactions.</p>
    </div>`,
    attachments: [],
  };
};

const identityVerificationResultTemplate = ({ username, result }) => {
  return {
    subject: `Identity Verification Result`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your identity verification has been <strong>${result}</strong>.</p>
    </div>`,
    attachments: [],
  };
};

const accountAccessRevokedTemplate = ({ username }) => {
  return {
    subject: `Temporary Account Access Revoked`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your account access has been temporarily revoked.</p>
      <p>Please follow instructions provided to reinstate access.</p>
    </div>`,
    attachments: [],
  };
};

const passwordStrengthWarningTemplate = ({ username }) => {
  return {
    subject: `Password Strength Warning`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your password is weak. Please update it to enhance your account security.</p>
    </div>`,
    attachments: [],
  };
};

const accountMergeConfirmationTemplate = ({ username }) => {
  return {
    subject: `Accounts Merged Successfully`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your accounts have been merged successfully.</p>
    </div>`,
    attachments: [],
  };
};

const socialLoginConnectionTemplate = ({ username, action }) => {
  return {
    subject: `Social Login Connection Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>A social login has been <strong>${action}</strong> your account.</p>
    </div>`,
    attachments: [],
  };
};

const wishlistReminderTemplate = ({ username, wishlistItems }) => {
  return {
    subject: `Reminder: Items in Your Wishlist`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>You have items waiting in your wishlist:</p>
      <ul>
        ${wishlistItems.map((item) => `<li>${item.name} - ${item.price}</li>`).join('')}
      </ul>
      <p>Come back and check them out!</p>
    </div>`,
    attachments: [],
  };
};

const wishlistBackInStockTemplate = ({ username, itemName }) => {
  return {
    subject: `Good News! Wishlist Item Back in Stock`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>The item <strong>${itemName}</strong> from your wishlist is back in stock.</p>
      <p>Check it out before it's gone again!</p>
    </div>`,
    attachments: [],
  };
};

const wishlistPriceDropAlertTemplate = ({ username, itemName, newPrice }) => {
  return {
    subject: `Price Drop Alert on Wishlist Item`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>The price for <strong>${itemName}</strong> in your wishlist has dropped to <strong>${newPrice}</strong>.</p>
      <p>Don't miss this opportunity!</p>
    </div>`,
    attachments: [],
  };
};

const savedForLaterReminderTemplate = ({ username, savedItems }) => {
  return {
    subject: `Reminder: Items Saved For Later`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>You have items saved for later in your account:</p>
      <ul>
        ${savedItems.map((item) => `<li>${item.name} - ${item.price}</li>`).join('')}
      </ul>
      <p>Visit your account to complete your purchase.</p>
    </div>`,
    attachments: [],
  };
};

const cartItemPriceChangedTemplate = ({ username, itemName, oldPrice, newPrice }) => {
  return {
    subject: `Price Changed on Cart Item`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>The price of <strong>${itemName}</strong> in your cart has changed from <strong>${oldPrice}</strong> to <strong>${newPrice}</strong>.</p>
      <p>Review your cart to complete your purchase.</p>
    </div>`,
    attachments: [],
  };
};

const wishlistItemDiscontinuedTemplate = ({ username, itemName }) => {
  return {
    subject: `Wishlist Item Discontinued`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Unfortunately, the item <strong>${itemName}</strong> in your wishlist has been discontinued.</p>
      <p>We apologize for the inconvenience.</p>
    </div>`,
    attachments: [],
  };
};

const cartExpiryNotificationTemplate = ({ username }) => {
  return {
    subject: `Cart Expiry Warning`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your shopping cart will expire soon.</p>
      <p>Complete your purchase to avoid losing your items.</p>
    </div>`,
    attachments: [],
  };
};
const orderProcessingTemplate = ({ username, orderId }) => {
  return {
    subject: `Your Order is Being Processed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>We are currently processing your order <strong>#${orderId}</strong>.</p>
      <p>You will be notified as soon as it ships.</p>
    </div>`,
    attachments: [],
  };
};

const orderPackedTemplate = ({ username, orderId }) => {
  return {
    subject: `Your Order is Packed and Ready to Ship`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your order <strong>#${orderId}</strong> has been packed and is ready for shipment.</p>
      <p>Thank you for shopping with us!</p>
    </div>`,
    attachments: [],
  };
};

const orderOutForDeliveryTemplate = ({ username, orderId }) => {
  return {
    subject: `Your Order is Out for Delivery`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your order <strong>#${orderId}</strong> is out for delivery.</p>
      <p>It should arrive soon. Please be prepared to receive it.</p>
    </div>`,
    attachments: [],
  };
};

const partialOrderShippedTemplate = ({ username, orderId }) => {
  return {
    subject: `Partial Shipment Notification`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Part of your order <strong>#${orderId}</strong> has been shipped.</p>
      <p>You will receive information on remaining items shortly.</p>
    </div>`,
    attachments: [],
  };
};

const orderSplitShipmentTemplate = ({ username, orderId }) => {
  return {
    subject: `Order Split into Multiple Shipments`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your order <strong>#${orderId}</strong> has been split into multiple shipments.</p>
      <p>Tracking details for each shipment will be sent separately.</p>
    </div>`,
    attachments: [],
  };
};

const deliveryDelayedNotificationTemplate = ({ username, orderId }) => {
  return {
    subject: `Delivery Delayed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>We regret to inform you that the delivery of your order <strong>#${orderId}</strong> has been delayed.</p>
      <p>We apologize for the inconvenience and are working to get it to you as soon as possible.</p>
    </div>`,
    attachments: [],
  };
};

const orderCanceledByCustomerTemplate = ({ username, orderId }) => {
  return {
    subject: `Order Canceled by You`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your order <strong>#${orderId}</strong> has been canceled as per your request.</p>
      <p>If this was a mistake, please contact support to reactivate.</p>
    </div>`,
    attachments: [],
  };
};

const orderCanceledByStoreTemplate = ({ username, orderId, reason }) => {
  return {
    subject: `Order Canceled by Store`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your order <strong>#${orderId}</strong> has been canceled by the store.</p>
      <p>Reason: ${reason}</p>
      <p>Please contact support if you have questions.</p>
    </div>`,
    attachments: [],
  };
};

const preOrderConfirmationTemplate = ({ username, productName, releaseDate }) => {
  return {
    subject: `Pre-Order Confirmation`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your pre-order for <strong>${productName}</strong> has been confirmed.</p>
      <p>Expected release date: ${releaseDate}</p>
    </div>`,
    attachments: [],
  };
};

const preOrderShippedTemplate = ({ username, productName }) => {
  return {
    subject: `Pre-Order Shipped`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your pre-ordered item <strong>${productName}</strong> has been shipped.</p>
    </div>`,
    attachments: [],
  };
};

const digitalDownloadReadyTemplate = ({ username, downloadLink }) => {
  return {
    subject: `Digital Download Ready`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your digital purchase is ready. You can download it using the button below:</p>
      <a href="${downloadLink}" style="padding:12px 24px; background:#1a73e8; color:#fff; border-radius:6px; text-decoration:none;">Download Now</a>
    </div>`,
    attachments: [],
  };
};

const customOrderConfirmedTemplate = ({ username }) => {
  return {
    subject: `Custom Order Confirmed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your custom order has been confirmed with the provided details.</p>
    </div>`,
    attachments: [],
  };
};

const orderModificationRequestReceivedTemplate = ({ username, orderId }) => {
  return {
    subject: `Order Modification Request Received`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>We have received your request to modify order <strong>#${orderId}</strong>.</p>
      <p>We will notify you of the approval or rejection shortly.</p>
    </div>`,
    attachments: [],
  };
};

const orderModificationResultTemplate = ({ username, orderId, status }) => {
  return {
    subject: `Order Modification Update`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your modification request for order <strong>#${orderId}</strong> has been <strong>${status}</strong>.</p>
    </div>`,
    attachments: [],
  };
};
const returnRequestReceivedTemplate = ({ username, orderId }) => {
  return {
    subject: `Return Request Received`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>We have received your return request for order <strong>#${orderId}</strong>.</p>
      <p>Our team will review it and contact you with further instructions.</p>
    </div>`,
    attachments: [],
  };
};

const returnApprovedTemplate = ({ username, orderId, instructions }) => {
  return {
    subject: `Return Approved`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your return request for order <strong>#${orderId}</strong> has been approved.</p>
      <p>Return instructions: ${instructions}</p>
    </div>`,
    attachments: [],
  };
};

const returnRejectedTemplate = ({ username, orderId, reason }) => {
  return {
    subject: `Return Request Denied`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your return request for order <strong>#${orderId}</strong> was denied.</p>
      <p>Reason: ${reason}</p>
    </div>`,
    attachments: [],
  };
};

const refundProcessedTemplate = ({ username, orderId }) => {
  return {
    subject: `Refund Processed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>A refund for order <strong>#${orderId}</strong> has been processed.</p>
      <p>You should see the refund reflected in your account soon.</p>
    </div>`,
    attachments: [],
  };
};

const exchangeApprovedTemplate = ({ username, orderId, nextSteps }) => {
  return {
    subject: `Exchange Approved`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your exchange request for order <strong>#${orderId}</strong> has been approved.</p>
      <p>Next steps: ${nextSteps}</p>
    </div>`,
    attachments: [],
  };
};

const exchangeRejectedTemplate = ({ username, orderId, reason }) => {
  return {
    subject: `Exchange Request Denied`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your exchange request for order <strong>#${orderId}</strong> was denied.</p>
      <p>Reason: ${reason}</p>
    </div>`,
    attachments: [],
  };
};

const returnShipmentReceivedTemplate = ({ username, orderId }) => {
  return {
    subject: `Return Shipment Received`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>We have received your return shipment for order <strong>#${orderId}</strong>.</p>
      <p>We will begin processing your return shortly.</p>
    </div>`,
    attachments: [],
  };
};

const partialRefundProcessedTemplate = ({ username, orderId, details }) => {
  return {
    subject: `Partial Refund Processed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>A partial refund for order <strong>#${orderId}</strong> has been processed.</p>
      <p>Details: ${details}</p>
    </div>`,
    attachments: [],
  };
};
const paymentSuccessfulTemplate = ({ username, orderId, amount }) => {
  return {
    subject: `Payment Successful - Order #${orderId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your payment for order <strong>#${orderId}</strong> of amount <strong>$${amount}</strong> was successful.</p>
      <p>Thank you for your purchase!</p>
    </div>`,
    attachments: [],
  };
};

const paymentMethodExpiringSoonTemplate = ({ username, expiryDate }) => {
  return {
    subject: `Payment Method Expiring Soon`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your payment method will expire on <strong>${expiryDate}</strong>.</p>
      <p>Please update your payment details to avoid interruption.</p>
    </div>`,
    attachments: [],
  };
};

const subscriptionStartedTemplate = ({ username, subscriptionName, startDate }) => {
  return {
    subject: `Subscription Started - ${subscriptionName}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Your subscription for <strong>${subscriptionName}</strong> has started as of ${startDate}.</p>
      <p>Thank you for subscribing!</p>
    </div>`,
    attachments: [],
  };
};

const subscriptionRenewedSuccessfullyTemplate = ({ username, subscriptionName }) => {
  return {
    subject: `Subscription Renewed Successfully - ${subscriptionName}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Your subscription for <strong>${subscriptionName}</strong> has been successfully renewed.</p>
      <p>Thank you for being with us!</p>
    </div>`,
    attachments: [],
  };
};

const subscriptionFailedRetryNeededTemplate = ({ username, subscriptionName }) => {
  return {
    subject: `Subscription Payment Failed - Retry Needed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>The payment for your subscription <strong>${subscriptionName}</strong> has failed.</p>
      <p>Please retry the payment to continue enjoying our services.</p>
    </div>`,
    attachments: [],
  };
};

const subscriptionCanceledTemplate = ({ username, subscriptionName }) => {
  return {
    subject: `Subscription Canceled - ${subscriptionName}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Your subscription for <strong>${subscriptionName}</strong> has been canceled.</p>
      <p>We're sorry to see you go. Contact support if you change your mind.</p>
    </div>`,
    attachments: [],
  };
};

const creditNoteIssuedTemplate = ({ username, creditNoteNumber, amount, issueDate }) => {
  return {
    subject: `Credit Note Issued - ${creditNoteNumber}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>A credit note <strong>#${creditNoteNumber}</strong> for amount <strong>$${amount}</strong> has been issued on ${issueDate}.</p>
      <p>You can apply this credit on your future purchases.</p>
    </div>`,
    attachments: [],
  };
};

const giftCardPurchasedTemplate = ({ username, giftCardCode, amount }) => {
  return {
    subject: `Gift Card Purchased`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Thank you for purchasing a gift card worth <strong>$${amount}</strong>.</p>
      <p>Your gift card code is <strong>${giftCardCode}</strong>.</p>
    </div>`,
    attachments: [],
  };
};

const giftCardRedeemedTemplate = ({ username, giftCardCode, amount }) => {
  return {
    subject: `Gift Card Redeemed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>You have used gift card <strong>${giftCardCode}</strong> worth <strong>$${amount}</strong> on your recent purchase.</p>
    </div>`,
    attachments: [],
  };
};

const storeCreditAddedTemplate = ({ username, amount }) => {
  return {
    subject: `Store Credit Added`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your account has been credited with store credit amounting to <strong>$${amount}</strong>.</p>
      <p>You can use this credit on your future orders.</p>
    </div>`,
    attachments: [],
  };
};

const storeCreditUsedTemplate = ({ username, amount }) => {
  return {
    subject: `Store Credit Used`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Store credit of amount <strong>$${amount}</strong> has been used on your recent purchase.</p>
    </div>`,
    attachments: [],
  };
};

const emiPaymentReminderTemplate = ({ username, dueDate }) => {
  return {
    subject: `EMI Payment Reminder`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>This is a reminder that your upcoming EMI payment is due on <strong>${dueDate}</strong>.</p>
      <p>Please ensure timely payment to avoid penalties.</p>
    </div>`,
    attachments: [],
  };
};

const paymentDisputeNotificationTemplate = ({ username, orderId }) => {
  return {
    subject: `Payment Dispute Notification`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>A payment dispute has been raised for your order <strong>#${orderId}</strong>.</p>
      <p>We are investigating and will update you shortly.</p>
    </div>`,
    attachments: [],
  };
};

const paymentDisputeResolvedTemplate = ({ username, orderId }) => {
  return {
    subject: `Payment Dispute Resolved`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>The payment dispute for order <strong>#${orderId}</strong> has been resolved.</p>
      <p>Thank you for your patience.</p>
    </div>`,
    attachments: [],
  };
};

const paymentMethodUpdatedTemplate = ({ username }) => {
  return {
    subject: `Payment Method Updated`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your payment details have been successfully updated.</p>
    </div>`,
    attachments: [],
  };
};

const subscriptionPauseConfirmationTemplate = ({ username, subscriptionName }) => {
  return {
    subject: `Subscription Pause Confirmation - ${subscriptionName}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your subscription for <strong>${subscriptionName}</strong> has been paused as per your request.</p>
      <p>We look forward to welcoming you back anytime.</p>
    </div>`,
    attachments: [],
  };
};

const onboardingSeriesTemplate = ({ username }) => {
  return {
    subject: `Welcome to Our Platform!`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Welcome, ${username || 'User'}!</h2>
      <p>We're excited to have you. Here's how to get started and make the most of our platform.</p>
    </div>`,
    attachments: [],
  };
};

const customerMilestoneTemplate = ({ username, period }) => {
  return {
    subject: `Congratulations on Your Milestone!`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Thank you for being with us for ${period}. Here's a reward to celebrate your loyalty.</p>
    </div>`,
    attachments: [],
  };
};

const loyaltyPointsRedeemedTemplate = ({ username, points }) => {
  return {
    subject: `Loyalty Points Redeemed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>You have successfully redeemed loyalty points worth <strong>${points}</strong>.</p>
    </div>`,
    attachments: [],
  };
};

const loyaltyPointsExpiryReminderTemplate = ({ username }) => {
  return {
    subject: `Loyalty Points Expiring Soon`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your loyalty points will expire soon. Use them before they’re gone!</p>
    </div>`,
    attachments: [],
  };
};

const referralInvitationTemplate = ({ username }) => {
  return {
    subject: `Invite Friends, Earn Rewards`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Invite your friends to join and earn rewards when they make their first purchase.</p>
    </div>`,
    attachments: [],
  };
};

const referralBonusEarnedTemplate = ({ username, bonus }) => {
  return {
    subject: `Referral Bonus Earned`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>You have earned a referral bonus of <strong>${bonus}</strong>.</p>
    </div>`,
    attachments: [],
  };
};

const referralBonusUsedTemplate = ({ username, bonus }) => {
  return {
    subject: `Referral Bonus Used`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>You have used a referral bonus of <strong>${bonus}</strong> in your purchase.</p>
    </div>`,
    attachments: [],
  };
};

const seasonalSaleAnnouncementTemplate = ({ username }) => {
  return {
    subject: `Seasonal Sale Now On!`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Don’t miss our major seasonal sale with great discounts.</p>
    </div>`,
    attachments: [],
  };
};

const flashSaleTemplate = ({ username }) => {
  return {
    subject: `Flash Sale - Limited Time Offer!`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Hurry! Don’t miss out on our limited-time flash sale.</p>
    </div>`,
    attachments: [],
  };
};

const earlyAccessToSaleTemplate = ({ username }) => {
  return {
    subject: `Early Access to Sale for VIPs`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Exclusive early access to our sale event for VIP customers.</p>
    </div>`,
    attachments: [],
  };
};

const sneakPeekTemplate = ({ username }) => {
  return {
    subject: `Coming Soon...`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hey ${username || 'User'},</h2>
      <p>Stay tuned for exciting new product launches.</p>
    </div>`,
    attachments: [],
  };
};

const exclusiveEventTemplate = ({ username }) => {
  return {
    subject: `Exclusive Event Invitation`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>You are invited to an exclusive event. Don’t miss out!</p>
    </div>`,
    attachments: [],
  };
};

const surveyRequestTemplate = ({ username }) => {
  return {
    subject: `We Value Your Feedback`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Please take a moment to complete our customer satisfaction survey.</p>
    </div>`,
    attachments: [],
  };
};

const holidayGreetingsTemplate = ({ username }) => {
  return {
    subject: `Happy Holidays!`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Season's Greetings, ${username || 'User'}!</h2>
      <p>Warm wishes from all of us. Enjoy the season!</p>
    </div>`,
    attachments: [],
  };
};

const csrStoriesTemplate = ({ username }) => {
  return {
    subject: `Our Social Impact`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>Learn about our brand’s social responsibility initiatives and how we make a difference.</p>
    </div>`,
    attachments: [],
  };
};

const appDownloadInvitationTemplate = ({ username }) => {
  return {
    subject: `Get the Most Out of Our App`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Download our mobile app for the best experience and exclusive features.</p>
    </div>`,
    attachments: [],
  };
};

const abandonedBrowseReminderTemplate = ({ username, items }) => {
  return {
    subject: `Remember These Items?`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>You recently viewed some items. Come back to check them out:</p>
      <ul>${items.map((i) => `<li>${i.name}</li>`).join('')}</ul>
    </div>`,
    attachments: [],
  };
};

const loyaltyTierChangeTemplate = ({ username, change }) => {
  return {
    subject: `Your Loyalty Tier Has Changed`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your loyalty program tier has been <strong>${change}</strong>. Learn more about your new benefits.</p>
    </div>`,
    attachments: [],
  };
};

const otpForLoginTemplate = ({ username, otp, expiryMinutes }) => {
  return {
    subject: `Your One-Time Password (OTP)`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your One-Time Password (OTP) is:</p>
      <h1 style="color:#1a73e8;">${otp}</h1>
      <p>This code will expire in <strong>${expiryMinutes} minutes</strong>.</p>
      <p>Please do not share this code with anyone.</p>
    </div>`,
    attachments: [],
  };
};

const failedLoginAttemptWarningTemplate = ({ username, attempts }) => {
  return {
    subject: `Warning: Multiple Failed Login Attempts`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>We detected ${attempts} unsuccessful login attempts on your account.</p>
      <p>If this wasn’t you, please secure your account immediately.</p>
    </div>`,
    attachments: [],
  };
};

const systemMaintenanceNotificationTemplate = ({ username, startTime, endTime }) => {
  return {
    subject: `Upcoming System Maintenance Notification`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>We will be performing scheduled system maintenance from <strong>${startTime}</strong> to <strong>${endTime}</strong>.</p>
      <p>During this time, some services may be temporarily unavailable.</p>
      <p>Thank you for your patience.</p>
    </div>`,
    attachments: [],
  };
};

const scheduledDowntimeNotificationTemplate = ({ username, downtimeStart, downtimeEnd }) => {
  return {
    subject: `Scheduled Platform Downtime`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Our platform will be down for scheduled maintenance starting at <strong>${downtimeStart}</strong> and ending at <strong>${downtimeEnd}</strong>.</p>
      <p>We apologize for any inconvenience this may cause.</p>
    </div>`,
    attachments: [],
  };
};

const fraudulentTransactionAlertTemplate = ({ username, transactionId, amount }) => {
  return {
    subject: `Alert: Suspected Fraudulent Transaction`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hi ${username || 'User'},</h2>
      <p>We detected a suspicious transaction <strong>#${transactionId}</strong> of amount <strong>$${amount}</strong> on your account.</p>
      <p>Please review your recent transactions and contact support if you did not authorize this.</p>
    </div>`,
    attachments: [],
  };
};

const sessionTimeoutNotificationTemplate = ({ username }) => {
  return {
    subject: `Session Timeout Notification`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Your session has expired for security reasons.</p>
      <p>Please log in again to continue.</p>
    </div>`,
    attachments: [],
  };
};
const fraudulentActivityDetectedAdminTemplate = ({ adminName, userName, userId, activityDetails }) => {
  return {
    subject: `Fraudulent Activity Detected on User Account`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>Potential fraudulent activity has been detected on user <strong>${userName} (ID: ${userId})</strong>’s account.</p>
      <p>Activity Details:</p>
      <pre style="background:#f4f4f4; padding:10px; border-radius:6px;">${activityDetails}</pre>
      <p>Please investigate and take necessary actions to secure the account.</p>
    </div>`,
    attachments: [],
  };
};

const accountSecurityCheckReminderTemplate = ({ username }) => {
  return {
    subject: `Reminder: Review Your Account Security Settings`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${username || 'User'},</h2>
      <p>Keeping your account secure is our priority.</p>
      <p>This is a reminder to review your security settings and update your password, security questions, and two-factor authentication if you haven't done so recently.</p>
      <p>Click the link below to review your security settings:</p>
      <a href="#" style="padding:12px 24px; background:#1a73e8; color:#fff; border-radius:6px; text-decoration:none;">Review Security Settings</a>
      <p>Thank you for helping us keep your account safe.</p>
    </div>`,
    attachments: [],
  };
};

const newOrderPlacedAdminTemplate = ({ adminName, orderId, customerName, total }) => {
  return {
    subject: `New Order Placed - #${orderId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>A new order <strong>#${orderId}</strong> has been placed by ${customerName}.</p>
      <p>Order total: <strong>$${total}</strong>.</p>
      <p>Please process the order promptly.</p>
    </div>`,
    attachments: [],
  };
};

const highValueOrderAlertAdminTemplate = ({ adminName, orderId, amount }) => {
  return {
    subject: `High-Value Order Alert - #${orderId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>An order <strong>#${orderId}</strong> exceeding the high-value threshold has been placed.</p>
      <p>Amount: <strong>$${amount}</strong>. Please review immediately.</p>
    </div>`,
    attachments: [],
  };
};

const lowStockAlertAdminTemplate = ({ adminName, productId, productName, currentStock }) => {
  return {
    subject: `Low Stock Alert - Product #${productId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>Inventory levels for product <strong>${productName}</strong> (#${productId}) are low.</p>
      <p>Current stock: ${currentStock}. Please restock soon.</p>
    </div>`,
    attachments: [],
  };
};

const outOfStockNotificationAdminTemplate = ({ adminName, productId, productName }) => {
  return {
    subject: `Out of Stock Notification - Product #${productId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>The product <strong>${productName}</strong> (#${productId}) is out of stock.</p>
      <p>Immediate replenishment is recommended.</p>
    </div>`,
    attachments: [],
  };
};

const productDisabledAdminTemplate = ({ adminName, productId, productName }) => {
  return {
    subject: `Product Disabled - Product #${productId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>The product <strong>${productName}</strong> (#${productId}) has been disabled and removed from sale.</p>
    </div>`,
    attachments: [],
  };
};

const USER_CREATED = ({ userId, email, admin, username }) => {
  return {
    subject: `New User Registered - ${username}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${admin || 'Admin'},</h2>
      <p>A new user <strong>${username}</strong> (ID: ${userId}) has just registered.</p>
      <p>Please verify and onboard as necessary.</p>
    </div>`,
    attachments: [],
  };
};

const newReviewSubmittedAdminTemplate = ({ adminName, productName, reviewId }) => {
  return {
    subject: `New Review Submitted for ${productName}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>A new product review (ID: ${reviewId}) for <strong>${productName}</strong> has been submitted.</p>
      <p>Please review and moderate it.</p>
    </div>`,
    attachments: [],
  };
};

const paymentDisputeAlertAdminTemplate = ({ adminName, orderId }) => {
  return {
    subject: `Payment Dispute Alert - Order #${orderId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>A payment dispute has been raised for order <strong>#${orderId}</strong>.</p>
      <p>Please review and resolve the dispute.</p>
    </div>`,
    attachments: [],
  };
};

const returnRequestNotificationAdminTemplate = ({ adminName, orderId }) => {
  return {
    subject: `Return Request Notification - Order #${orderId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>A new return request has been submitted for order <strong>#${orderId}</strong>.</p>
      <p>Please initiate the return process.</p>
    </div>`,
    attachments: [],
  };
};

const refundProcessedNotificationAdminTemplate = ({ adminName, orderId }) => {
  return {
    subject: `Refund Processed Notification - Order #${orderId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>A refund has been processed for order <strong>#${orderId}</strong>.</p>
      <p>Please update records accordingly.</p>
    </div>`,
    attachments: [],
  };
};

const dailySalesReportAdminTemplate = ({ adminName, reportDate, totalSales }) => {
  return {
    subject: `Daily Sales Report - ${reportDate}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>Here is the daily sales report for <strong>${reportDate}</strong>.</p>
      <p>Total sales: <strong>$${totalSales}</strong>.</p>
    </div>`,
    attachments: [],
  };
};

const weeklyMonthlySalesReportAdminTemplate = ({ adminName, period, totalSales }) => {
  return {
    subject: `Weekly/Monthly Sales Report - ${period}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>Here is the sales report for the period: <strong>${period}</strong>.</p>
      <p>Total sales: <strong>$${totalSales}</strong>.</p>
    </div>`,
    attachments: [],
  };
};

const systemErrorFailedJobAlertAdminTemplate = ({ adminName, errorDetails }) => {
  return {
    subject: `System Error / Failed Job Alert`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>A system error or job failure has been detected.</p>
      <p>Error Details:</p>
      <pre style="background:#f4f4f4; padding:10px; border-radius:6px;">${errorDetails}</pre>
      <p>Please investigate promptly.</p>
    </div>`,
    attachments: [],
  };
};

const customerSupportTicketCreatedAdminTemplate = ({ adminName, ticketId, customerName }) => {
  return {
    subject: `Customer Support Ticket Created - Ticket #${ticketId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>A new customer support ticket (#${ticketId}) has been created by ${customerName}.</p>
      <p>Please respond as soon as possible.</p>
    </div>`,
    attachments: [],
  };
};

const inventoryRestockNotificationAdminTemplate = ({ adminName, productName, productId }) => {
  return {
    subject: `Inventory Restock Notification - Product #${productId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>The inventory for product <strong>${productName}</strong> (#${productId}) has been restocked.</p>
      <p>You can update listings or promotions accordingly.</p>
    </div>`,
    attachments: [],
  };
};

const bulkOrderRequestAdminTemplate = ({ adminName, requestId, requesterName }) => {
  return {
    subject: `Bulk Order Request - Request #${requestId}`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>A bulk or custom order request (Request ID: ${requestId}) has been received from ${requesterName}.</p>
      <p>Please review and respond accordingly.</p>
    </div>`,
    attachments: [],
  };
};

const customerDataDeletionRequestAdminTemplate = ({ adminName, userName, userId }) => {
  return {
    subject: `Customer Data Deletion Request`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>A request to delete customer data from user <strong>${userName} (ID:${userId})</strong> has been submitted under privacy regulations.</p>
      <p>Please follow up accordingly.</p>
    </div>`,
    attachments: [],
  };
};

const suspiciousAccountActivityAlertAdminTemplate = ({ adminName, userName, userId, details }) => {
  return {
    subject: `Suspicious Account Activity Alert`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>Unusual activity detected on user <strong>${userName} (ID:${userId})</strong> account.</p>
      <pre style="background:#f4f4f4; padding:10px; border-radius:6px;">${details}</pre>
      <p>Please investigate.</p>
    </div>`,
    attachments: [],
  };
};

const multipleFailedLoginAttemptsAdminTemplate = ({ adminName, userName, userId, attempts }) => {
  return {
    subject: `Multiple Failed Login Attempts Alert`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>There have been ${attempts} failed login attempts on user <strong>${userName} (ID:${userId})</strong>’s account.</p>
      <p>Please take appropriate action.</p>
    </div>`,
    attachments: [],
  };
};

const accountSuspensionReinstatementNotificationAdminTemplate = ({ adminName, userName, userId, action }) => {
  return {
    subject: `Account Suspension/Reinstatement Notification`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>The account of user <strong>${userName} (ID:${userId})</strong> has been ${action}.</p>
      <p>Please verify or take necessary measures.</p>
    </div>`,
    attachments: [],
  };
};

const userProfileUpdateAlertAdminTemplate = ({ adminName, userName, userId, changes }) => {
  return {
    subject: `User Profile Update Alert`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>User <strong>${userName} (ID:${userId})</strong> has updated their profile with the following changes:</p>
      <pre style="background:#f4f4f4; padding:10px; border-radius:6px;">${changes}</pre>
      <p>Please review as appropriate.</p>
    </div>`,
    attachments: [],
  };
};

const twoFactorStatusChangeAlertAdminTemplate = ({ adminName, userName, userId, status }) => {
  return {
    subject: `Two-Factor Authentication Status Change Alert`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>User <strong>${userName} (ID:${userId})</strong> has ${status} two-factor authentication.</p>
      <p>Ensure security policies are up to date.</p>
    </div>`,
    attachments: [],
  };
};

const accountDeletionRequestDeniedAdminTemplate = ({ adminName, userName, userId, reason }) => {
  return {
    subject: `Account Deletion Request Denied`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>The account deletion request for user <strong>${userName} (ID:${userId})</strong> has been denied.</p>
      <p>Reason: ${reason}</p>
    </div>`,
    attachments: [],
  };
};

const unusualAccountLoginPatternAdminTemplate = ({ adminName, userName, userId, details }) => {
  return {
    subject: `Unusual Account Login Pattern Alert`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>Unusual login patterns detected for user <strong>${userName} (ID:${userId})</strong>.</p>
      <pre style="background:#f4f4f4; padding:10px; border-radius:6px;">${details}</pre>
    </div>`,
    attachments: [],
  };
};

const phoneVerificationStatusUpdateAdminTemplate = ({ adminName, userName, userId, status }) => {
  return {
    subject: `Phone Verification Status Update`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>User <strong>${userName} (ID:${userId})</strong> phone verification status updated: ${status}.</p>
    </div>`,
    attachments: [],
  };
};

const emailVerificationFailureAlertAdminTemplate = ({ adminName, userName, userId, attempts }) => {
  return {
    subject: `Email Verification Failure Alert`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>User <strong>${userName} (ID:${userId})</strong> has failed email verification ${attempts} times.</p>
      <p>Please review and take action.</p>
    </div>`,
    attachments: [],
  };
};

const secondaryPhoneVerificationStatusUpdateAdminTemplate = ({ adminName, userName, userId, status }) => {
  return {
    subject: `Secondary Phone Verification Status Update`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>User <strong>${userName} (ID:${userId})</strong> secondary phone verification status updated: ${status}.</p>
    </div>`,
    attachments: [],
  };
};

const identityVerificationRequestReceivedAdminTemplate = ({ adminName, userName, userId }) => {
  return {
    subject: `Identity Verification Request Received`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>User <strong>${userName} (ID:${userId})</strong> has submitted identity verification documents for review.</p>
    </div>`,
    attachments: [],
  };
};

const identityVerificationOutcomeNotificationAdminTemplate = ({ adminName, userName, userId, result }) => {
  return {
    subject: `Identity Verification Outcome Notification`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>The identity verification for user <strong>${userName} (ID:${userId})</strong> has been ${result}.</p>
    </div>`,
    attachments: [],
  };
};

const accountAccessRevocationAdminTemplate = ({ adminName, userName, userId }) => {
  return {
    subject: `Account Access Revocation (Admin)`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>User account <strong>${userName} (ID:${userId})</strong> access has been temporarily revoked.</p>
    </div>`,
    attachments: [],
  };
};

const socialLoginConnectionAlertAdminTemplate = ({ adminName, userName, userId, action }) => {
  return {
    subject: `Social Login Connection Alert`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>User <strong>${userName} (ID:${userId})</strong> social login has been ${action}.</p>
    </div>`,
    attachments: [],
  };
};

const accountMergeRequestReceivedAdminTemplate = ({ adminName, userName, userId }) => {
  return {
    subject: `Account Merge Request Received`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>User <strong>${userName} (ID:${userId})</strong> has requested to merge duplicate accounts.</p>
    </div>`,
    attachments: [],
  };
};

const highRiskAccountActivityAlertAdminTemplate = ({ adminName, userName, userId, details }) => {
  return {
    subject: `High-Risk Account Activity Alert`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>High-risk activities were detected on user <strong>${userName} (ID:${userId})</strong>’s account.</p>
      <pre style="background:#f4f4f4; padding:10px; border-radius:6px;">${details}</pre>
      <p>Please address these concerns immediately.</p>
    </div>`,
    attachments: [],
  };
};

const accountRecoveryRequestReceivedAdminTemplate = ({ adminName, userName, userId }) => {
  return {
    subject: `Account Recovery Request Received`,
    html: `<div style="font-family: Arial, sans-serif; padding:20px;">
      <h2>Hello ${adminName || 'Admin'},</h2>
      <p>User <strong>${userName} (ID:${userId})</strong> has requested account recovery.</p>
      <p>Please review and process this request.</p>
    </div>`,
    attachments: [],
  };
};

// (Due to space, can provide full code for additional categories if needed)

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
  ROLE_ASSIGNED,
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
  phoneVerificationTemplate,
  emailPhoneVerificationReminderTemplate,
  phoneNumberChangeRequestTemplate,
  phoneNumberChangeConfirmationTemplate,
  identityVerificationRequestTemplate,
  identityVerificationResultTemplate,
  accountAccessRevokedTemplate,
  passwordStrengthWarningTemplate,
  accountMergeConfirmationTemplate,
  socialLoginConnectionTemplate,
  wishlistReminderTemplate,
  wishlistBackInStockTemplate,
  wishlistPriceDropAlertTemplate,
  savedForLaterReminderTemplate,
  cartItemPriceChangedTemplate,
  wishlistItemDiscontinuedTemplate,
  cartExpiryNotificationTemplate,
  orderProcessingTemplate,
  orderPackedTemplate,
  orderOutForDeliveryTemplate,
  partialOrderShippedTemplate,
  orderSplitShipmentTemplate,
  deliveryDelayedNotificationTemplate,
  orderCanceledByCustomerTemplate,
  orderCanceledByStoreTemplate,
  preOrderConfirmationTemplate,
  preOrderShippedTemplate,
  digitalDownloadReadyTemplate,
  customOrderConfirmedTemplate,
  orderModificationRequestReceivedTemplate,
  orderModificationResultTemplate,
  returnRequestReceivedTemplate,
  returnApprovedTemplate,
  returnRejectedTemplate,
  refundProcessedTemplate,
  exchangeApprovedTemplate,
  exchangeRejectedTemplate,
  returnShipmentReceivedTemplate,
  partialRefundProcessedTemplate,
  creditNoteIssuedTemplate,
  storeCreditAddedTemplate,
  storeCreditUsedTemplate,
  emiPaymentReminderTemplate,
  paymentDisputeNotificationTemplate,
  paymentDisputeResolvedTemplate,
  paymentMethodUpdatedTemplate,
  subscriptionPauseConfirmationTemplate,
  onboardingSeriesTemplate,
  customerMilestoneTemplate,
  loyaltyPointsRedeemedTemplate,
  loyaltyPointsExpiryReminderTemplate,
  referralInvitationTemplate,
  referralBonusEarnedTemplate,
  referralBonusUsedTemplate,
  seasonalSaleAnnouncementTemplate,
  flashSaleTemplate,
  earlyAccessToSaleTemplate,
  sneakPeekTemplate,
  exclusiveEventTemplate,
  surveyRequestTemplate,
  holidayGreetingsTemplate,
  csrStoriesTemplate,
  appDownloadInvitationTemplate,
  abandonedBrowseReminderTemplate,
  loyaltyTierChangeTemplate,
  fraudulentActivityDetectedAdminTemplate,
  accountSecurityCheckReminderTemplate,
  otpForLoginTemplate,
  failedLoginAttemptWarningTemplate,
  systemMaintenanceNotificationTemplate,
  scheduledDowntimeNotificationTemplate,
  fraudulentTransactionAlertTemplate,
  sessionTimeoutNotificationTemplate,
  newOrderPlacedAdminTemplate,
  highValueOrderAlertAdminTemplate,
  lowStockAlertAdminTemplate,
  outOfStockNotificationAdminTemplate,
  productDisabledAdminTemplate,
  // newUserRegisteredAdminTemplate,
  newReviewSubmittedAdminTemplate,
  paymentDisputeAlertAdminTemplate,
  returnRequestNotificationAdminTemplate,
  refundProcessedNotificationAdminTemplate,
  dailySalesReportAdminTemplate,
  weeklyMonthlySalesReportAdminTemplate,
  systemErrorFailedJobAlertAdminTemplate,
  customerSupportTicketCreatedAdminTemplate,
  inventoryRestockNotificationAdminTemplate,
  fraudulentActivityDetectedAdminTemplate,
  bulkOrderRequestAdminTemplate,
  customerDataDeletionRequestAdminTemplate,
  suspiciousAccountActivityAlertAdminTemplate,
  multipleFailedLoginAttemptsAdminTemplate,
  USER_CREATED,
  accountSuspensionReinstatementNotificationAdminTemplate,
  userProfileUpdateAlertAdminTemplate,
  twoFactorStatusChangeAlertAdminTemplate,
  accountDeletionRequestDeniedAdminTemplate,
  unusualAccountLoginPatternAdminTemplate,
  phoneVerificationStatusUpdateAdminTemplate,
  emailVerificationFailureAlertAdminTemplate,
  secondaryPhoneVerificationStatusUpdateAdminTemplate,
  identityVerificationRequestReceivedAdminTemplate,
  identityVerificationOutcomeNotificationAdminTemplate,
  accountAccessRevocationAdminTemplate,
  socialLoginConnectionAlertAdminTemplate,
  accountMergeRequestReceivedAdminTemplate,
  highRiskAccountActivityAlertAdminTemplate,
  accountRecoveryRequestReceivedAdminTemplate,
};
