const { appUrl, applicaionName } = require("../config/setting");

/**
 * Welcome email template for new users.
 * @param {Object} data - Data object containing username, email, and optional attachments.
 * @returns {Object} Email content with subject, html, and optional attachments.
 */

function otpEmailTemplate({ name, otp, expiryMinutes }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Your OTP Code</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color:#f6f9fc; padding:20px;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      
      <h2 style="color:#333;">Hello ${name || "User"},</h2>
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
  </html>
  `;
}
// utils/emailTemplates.js

function welcomeEmailTemplate(data) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Welcome to Our Platform</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color:#f6f9fc; padding:20px;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      
      <h1 style="color:#2c3e50; text-align:center;">🎉 Welcome, ${data.name || "User"}!</h1>
      
      <p style="font-size:16px; color:#555; text-align:center;">
        We’re excited to have you on board. Thank you for signing up and joining our community!
      </p>

      <div style="margin:30px 0; text-align:center;">
        <a href="https://yourapp.com/login" 
           style="background:#2c3e50; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-size:16px;">
          Get Started
        </a>
      </div>

      <p style="font-size:16px; color:#555;">
        Here’s what you can do next:
      </p>
      <ul style="font-size:15px; color:#555; line-height:1.6;">
        <li>✅ Explore our features</li>
        <li>✅ Set up your profile</li>
        <li>✅ Start using our services</li>
      </ul>

      <p style="margin-top:30px; font-size:14px; color:#777;">
        If you have any questions, just reply to this email—we’re always happy to help.
      </p>

      <hr style="margin:30px 0; border:0; border-top:1px solid #eee;">
      <p style="font-size:12px; color:#aaa; text-align:center;">
        &copy; ${new Date().getFullYear()} Your Company. All rights reserved.
      </p>
    </div>
  </body>
  </html>
  `;
}

// utils/emailTemplates.js

function emailVerificationTemplate({ name, verificationLink }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Email Verification</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color:#f6f9fc; padding:20px;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      
      <h2 style="color:#2c3e50;">Hello ${name || "User"},</h2>
      
      <p style="font-size:16px; color:#555;">
        Thank you for signing up! To complete your registration, please verify your email address by clicking the button below:
      </p>

      <div style="margin:30px 0; text-align:center;">
        <a href="${verificationLink}" 
           style="background:#2c3e50; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-size:16px;">
          Verify Email
        </a>
      </div>

      <p style="font-size:14px; color:#777;">
        Or copy and paste this link into your browser:  
        <br/>
        <a href="${verificationLink}" style="color:#2c3e50;">${verificationLink}</a>
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
  </html>
  `;
}

function emailVerificationSuccessTemplate({ name }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Hi ${name || "User"},</h2>
    <p>Your email has been successfully verified. 🎉</p>
    <p>You can now enjoy full access to your account.</p>
    <p style="color:#777; font-size:12px;">Thank you for joining us!</p>
  </div>
  `;
}

function passwordResetRequestTemplate({ name, resetLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Hello ${name || "User"},</h2>
    <p>We received a request to reset your password.</p>
    <p>Click the button below to reset it:</p>
    <a href="${resetLink}" style="display:inline-block; padding:12px 24px; background:#2c3e50; color:#fff; text-decoration:none; border-radius:6px;">Reset Password</a>
    <p style="margin-top:20px; font-size:14px; color:#555;">If you didn’t request this, please ignore this email.</p>
  </div>
  `;
}

function passwordResetSuccessTemplate({ name }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Hi ${name || "User"},</h2>
    <p>Your password has been successfully reset ✅.</p>
    <p>If this wasn’t you, please contact our support team immediately.</p>
  </div>
  `;
}

function passwordChangedSuccessTemplate({ name }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Hello ${name || "User"},</h2>
    <p>Your password was changed successfully 🔒.</p>
    <p>If this change wasn’t made by you, <strong>reset your password immediately</strong> and contact support.</p>
  </div>
  `;
}

// Account locked (too many failed login attempts)
function accountLockedTemplate({ name, unlockLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#e74c3c;">Hi ${name || "User"},</h2>
    <p>Your account has been temporarily locked due to multiple failed login attempts 🔐.</p>
    <p>Click below to unlock your account:</p>
    <a href="${unlockLink}" style="display:inline-block; padding:12px 24px; background:#e74c3c; color:#fff; text-decoration:none; border-radius:6px;">Unlock Account</a>
    <p style="font-size:14px; color:#777;">If this wasn’t you, we recommend changing your password immediately.</p>
  </div>
  `;
}

// Suspicious login detected
function suspiciousLoginTemplate({ name, location, device, resetLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#f39c12;">Hello ${name || "User"},</h2>
    <p>We detected a login to your account from a new device/location:</p>
    <ul>
      <li><strong>Location:</strong> ${location || "Unknown"}</li>
      <li><strong>Device:</strong> ${device || "Unknown"}</li>
    </ul>
    <p>If this was you, you can safely ignore this message.</p>
    <p>If not, <a href="${resetLink}" style="color:#e74c3c;">reset your password immediately</a>.</p>
  </div>
  `;
}

// Account deletion confirmation
function accountDeletedTemplate({ name }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Goodbye ${name || "User"},</h2>
    <p>Your account has been successfully deleted 🗑️.</p>
    <p>If you didn’t request this, please contact support immediately.</p>
  </div>
  `;
}

// Subscription / plan update
function subscriptionUpdatedTemplate({ name, plan }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2 style="color:#2c3e50;">Hi ${name || "User"},</h2>
    <p>Your subscription has been updated successfully ✅.</p>
    <p><strong>New Plan:</strong> ${plan || "N/A"}</p>
    <p>Enjoy your updated features!</p>
  </div>
  `;
}

// Two-factor authentication (2FA) code
function twoFactorCodeTemplate({ name, code }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || "User"},</h2>
    <p>Your Two-Factor Authentication (2FA) code is:</p>
    <h1 style="letter-spacing:4px; color:#2c3e50;">${code}</h1>
    <p>This code will expire in 10 minutes.</p>
  </div>
  `;
}

// Payment failed
function paymentFailedTemplate({ name, amount, retryLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || "User"},</h2>
    <p>We couldn’t process your recent payment of <strong>$${amount}</strong> 💳.</p>
    <p>Please update your payment method and try again:</p>
    <a href="${retryLink}" style="display:inline-block; padding:12px 24px; background:#e74c3c; color:#fff; border-radius:6px; text-decoration:none;">Update Payment</a>
  </div>
  `;
}

// Payment success / invoice
function paymentSuccessTemplate({ name, amount, invoiceLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Payment Received ✅</h2>
    <p>Hi ${name || "User"},</p>
    <p>We’ve successfully received your payment of <strong>$${amount}</strong>.</p>
    <p>You can download your invoice here:</p>
    <a href="${invoiceLink}" style="display:inline-block; padding:12px 24px; background:#2c3e50; color:#fff; border-radius:6px; text-decoration:none;">View Invoice</a>
  </div>
  `;
}

// Order confirmation
function orderConfirmationTemplate({ name, orderId, items, total }) {
  const itemsList = items.map(i => `<li>${i.name} - $${i.price}</li>`).join("");
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Order Confirmed 🛒</h2>
    <p>Hi ${name || "User"}, your order <strong>#${orderId}</strong> has been placed successfully.</p>
    <ul>${itemsList}</ul>
    <p><strong>Total:</strong> $${total}</p>
    <p>We’ll notify you once it ships 🚚.</p>
  </div>
  `;
}

// Order shipped
function orderShippedTemplate({ name, orderId, trackingLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Order is on the way 🚚</h2>
    <p>Hi ${name || "User"}, your order <strong>#${orderId}</strong> has been shipped.</p>
    <p>You can track it here:</p>
    <a href="${trackingLink}" style="display:inline-block; padding:12px 24px; background:#2c3e50; color:#fff; border-radius:6px; text-decoration:none;">Track Shipment</a>
  </div>
  `;
}

// Order delivered
function orderDeliveredTemplate({ name, orderId }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Delivered 🎉</h2>
    <p>Hi ${name || "User"}, your order <strong>#${orderId}</strong> has been successfully delivered.</p>
    <p>We’d love your feedback! ⭐⭐⭐⭐⭐</p>
  </div>
  `;
}

// Password expiry reminder
function passwordExpiryReminderTemplate({ name, resetLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Password Expiring Soon ⏳</h2>
    <p>Hi ${name || "User"}, your password will expire soon.</p>
    <p>Please update your password to continue secure access:</p>
    <a href="${resetLink}" style="display:inline-block; padding:12px 24px; background:#2c3e50; color:#fff; border-radius:6px; text-decoration:none;">Update Password</a>
  </div>
  `;
}

// Newsletter / marketing
function newsletterTemplate({ title, content, ctaLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>${title}</h2>
    <p>${content}</p>
    <a href="${ctaLink}" style="display:inline-block; padding:12px 24px; background:#27ae60; color:#fff; border-radius:6px; text-decoration:none;">Learn More</a>
  </div>
  `;
}
// Account deactivation warning
function accountDeactivationWarningTemplate({ name, reactivateLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Account Deactivation Warning ⚠️</h2>
    <p>Hi ${name || "User"}, your account will be deactivated due to inactivity.</p>
    <p>To keep your account active, log in again or click below:</p>
    <a href="${reactivateLink}" style="display:inline-block; padding:12px 24px; background:#f39c12; color:#fff; border-radius:6px; text-decoration:none;">Reactivate Account</a>
  </div>
  `;
}

// Account reactivated
function accountReactivatedTemplate({ name }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Welcome Back 🎉</h2>
    <p>Hi ${name || "User"}, your account has been successfully reactivated.</p>
  </div>
  `;
}

// Role/permission updated
function roleUpdatedTemplate({ name, role }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Permissions Updated 🔑</h2>
    <p>Hi ${name || "User"}, your role has been updated.</p>
    <p><strong>New Role:</strong> ${role}</p>
  </div>
  `;
}

// New device login
function newDeviceLoginTemplate({ name, location, device }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>New Device Login Detected 👀</h2>
    <p>Hi ${name || "User"}, a login was detected from:</p>
    <ul>
      <li>Device: ${device}</li>
      <li>Location: ${location}</li>
    </ul>
    <p>If this wasn’t you, please secure your account immediately.</p>
  </div>
  `;
}

// Subscription renewal reminder
function subscriptionRenewalReminderTemplate({ name, plan, renewalDate }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Subscription Renewal Reminder 🔔</h2>
    <p>Hi ${name || "User"}, your <strong>${plan}</strong> plan will renew on <strong>${renewalDate}</strong>.</p>
    <p>No action is needed unless you want to update your subscription.</p>
  </div>
  `;
}

// Subscription cancelled
function subscriptionCancelledTemplate({ name, plan }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Subscription Cancelled ❌</h2>
    <p>Hi ${name || "User"}, your <strong>${plan}</strong> subscription has been cancelled.</p>
    <p>You will retain access until the end of your billing period.</p>
  </div>
  `;
}

// Gift card received
function giftCardReceivedTemplate({ name, sender, amount, redeemCode }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>You’ve Received a Gift 🎁</h2>
    <p>Hi ${name || "User"}, ${sender} sent you a gift card worth <strong>$${amount}</strong>.</p>
    <p>Your redeem code: <strong>${redeemCode}</strong></p>
  </div>
  `;
}

// Review request
function reviewRequestTemplate({ name, product, reviewLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>We’d Love Your Feedback ⭐</h2>
    <p>Hi ${name || "User"}, thank you for purchasing <strong>${product}</strong>.</p>
    <p>Please leave a review to help us improve:</p>
    <a href="${reviewLink}" style="display:inline-block; padding:12px 24px; background:#27ae60; color:#fff; border-radius:6px; text-decoration:none;">Leave Review</a>
  </div>
  `;
}

// Cart abandonment reminder
function cartAbandonmentTemplate({ name, items, checkoutLink }) {
  const itemsList = items.map(i => `<li>${i.name} - $${i.price}</li>`).join("");
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Don’t Forget Your Cart 🛒</h2>
    <p>Hi ${name || "User"}, you left these items in your cart:</p>
    <ul>${itemsList}</ul>
    <p>Complete your order now:</p>
    <a href="${checkoutLink}" style="display:inline-block; padding:12px 24px; background:#2980b9; color:#fff; border-radius:6px; text-decoration:none;">Checkout Now</a>
  </div>
  `;
}

// Loyalty points earned
function loyaltyPointsEarnedTemplate({ name, points }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>You’ve Earned Points 🎉</h2>
    <p>Hi ${name || "User"}, you’ve earned <strong>${points}</strong> loyalty points on your recent purchase.</p>
    <p>Keep shopping to earn more rewards!</p>
  </div>
  `;
}
// Data export / GDPR request started
function dataExportRequestTemplate({ name, requestDate }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Data Export Request 📂</h2>
    <p>Hi ${name || "User"}, we’ve received your request to export your data on <strong>${requestDate}</strong>.</p>
    <p>We will notify you once your data is ready for download.</p>
  </div>
  `;
}

// Data export ready
function dataExportReadyTemplate({ name, downloadLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Data is Ready ⬇️</h2>
    <p>Hi ${name || "User"}, your requested data export is now available.</p>
    <p><a href="${downloadLink}" style="padding:12px 24px; background:#2ecc71; color:#fff; border-radius:6px; text-decoration:none;">Download Data</a></p>
  </div>
  `;
}

// Policy update / Terms of Service
function policyUpdateTemplate({ name, policyLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Policy Update 📜</h2>
    <p>Hi ${name || "User"}, we’ve updated our Terms of Service and Privacy Policy.</p>
    <p>Please review the changes here:</p>
    <a href="${policyLink}" style="color:#2980b9;">Read Policy</a>
  </div>
  `;
}

// Trial expiration warning
function trialExpiringTemplate({ name, expiryDate, upgradeLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Trial is Ending Soon ⏳</h2>
    <p>Hi ${name || "User"}, your free trial ends on <strong>${expiryDate}</strong>.</p>
    <p>Upgrade now to keep enjoying full access:</p>
    <a href="${upgradeLink}" style="padding:12px 24px; background:#27ae60; color:#fff; border-radius:6px; text-decoration:none;">Upgrade Now</a>
  </div>
  `;
}

// Trial expired
function trialExpiredTemplate({ name, upgradeLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Your Trial Has Ended ⚠️</h2>
    <p>Hi ${name || "User"}, your trial has expired.</p>
    <p>Upgrade to continue using premium features:</p>
    <a href="${upgradeLink}" style="padding:12px 24px; background:#e67e22; color:#fff; border-radius:6px; text-decoration:none;">Upgrade</a>
  </div>
  `;
}

// Invoice generated
function invoiceGeneratedTemplate({ name, invoiceNumber, amount, invoiceLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Invoice Generated 🧾</h2>
    <p>Hi ${name || "User"}, your invoice <strong>#${invoiceNumber}</strong> for <strong>$${amount}</strong> is now available.</p>
    <p><a href="${invoiceLink}" style="padding:12px 24px; background:#34495e; color:#fff; border-radius:6px; text-decoration:none;">View Invoice</a></p>
  </div>
  `;
}

// Payment refunded
function paymentRefundedTemplate({ name, amount, refundDate }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Refund Processed 💸</h2>
    <p>Hi ${name || "User"}, your refund of <strong>$${amount}</strong> has been processed on <strong>${refundDate}</strong>.</p>
    <p>The funds may take a few days to reflect in your account.</p>
  </div>
  `;
}

// Maintenance notice
function maintenanceNoticeTemplate({ name, startTime, endTime }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Scheduled Maintenance 🛠️</h2>
    <p>Hi ${name || "User"}, our services will be unavailable due to maintenance:</p>
    <p><strong>${startTime}</strong> → <strong>${endTime}</strong></p>
    <p>We appreciate your patience.</p>
  </div>
  `;
}

// Feature announcement
function newFeatureAnnouncementTemplate({ name, featureName, featureLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>New Feature Unlocked 🚀</h2>
    <p>Hi ${name || "User"}, we’ve just released <strong>${featureName}</strong>!</p>
    <p>Try it out now:</p>
    <a href="${featureLink}" style="padding:12px 24px; background:#8e44ad; color:#fff; border-radius:6px; text-decoration:none;">Explore Feature</a>
  </div>
  `;
}

// Birthday / Anniversary greetings
function birthdayGreetingTemplate({ name, discountCode }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Happy Birthday 🎂</h2>
    <p>Hi ${name || "User"}, we wish you a wonderful birthday!</p>
    <p>Here’s a special discount just for you: <strong>${discountCode}</strong></p>
  </div>
  `;
}
// 2FA / MFA setup
function twoFactorSetupTemplate({ name, setupLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || "User"},</h2>
    <p>You’ve requested to set up <strong>Two-Factor Authentication (2FA)</strong> on your account.</p>
    <p>Click the link below to complete setup:</p>
    <a href="${setupLink}" style="padding:12px 24px; background:#2c3e50; color:#fff; text-decoration:none; border-radius:6px;">Setup 2FA</a>
  </div>
  `;
}

// 2FA / MFA login code
function twoFactorCodeTemplate({ name, code }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || "User"},</h2>
    <p>Use the following <strong>One-Time Code</strong> to complete your login:</p>
    <h1 style="color:#2c3e50;">${code}</h1>
    <p>This code will expire in 10 minutes.</p>
  </div>
  `;
}

// Backup codes issued
function backupCodesTemplate({ name, codes }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || "User"},</h2>
    <p>Here are your <strong>backup login codes</strong> for your account:</p>
    <ul style="font-family: monospace;">
      ${codes.map(c => `<li>${c}</li>`).join("")}
    </ul>
    <p>Keep them safe! Each code can be used once if you lose access to your 2FA device.</p>
  </div>
  `;
}

// Device / browser approval
function newDeviceApprovalTemplate({ name, device, approveLink, denyLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || "User"},</h2>
    <p>A new login attempt was detected from:</p>
    <p><strong>Device:</strong> ${device || "Unknown"}</p>
    <p>Do you recognize this?</p>
    <a href="${approveLink}" style="padding:12px 24px; background:#27ae60; color:#fff; border-radius:6px; text-decoration:none;">Yes, Approve</a>
    <a href="${denyLink}" style="padding:12px 24px; background:#e74c3c; color:#fff; border-radius:6px; text-decoration:none; margin-left:10px;">No, Deny</a>
  </div>
  `;
}

// Email changed confirmation
function emailChangedTemplate({ name, oldEmail, newEmail }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || "User"},</h2>
    <p>Your account email has been changed.</p>
    <p><strong>Old Email:</strong> ${oldEmail}<br/>
       <strong>New Email:</strong> ${newEmail}</p>
    <p>If this wasn’t you, please reset your password immediately.</p>
  </div>
  `;
}

// Login alert (successful login)
function loginAlertTemplate({ name, device, location, time }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || "User"},</h2>
    <p>Your account was just logged into:</p>
    <ul>
      <li><strong>Device:</strong> ${device || "Unknown"}</li>
      <li><strong>Location:</strong> ${location || "Unknown"}</li>
      <li><strong>Time:</strong> ${time || new Date().toISOString()}</li>
    </ul>
    <p>If this wasn’t you, <a href="#">secure your account</a> immediately.</p>
  </div>
  `;
}

// Session expired
function sessionExpiredTemplate({ name, reLoginLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || "User"},</h2>
    <p>Your session has expired due to inactivity or security reasons.</p>
    <p>Please log in again to continue:</p>
    <a href="${reLoginLink}" style="padding:12px 24px; background:#2c3e50; color:#fff; border-radius:6px; text-decoration:none;">Login Again</a>
  </div>
  `;
}

// Account recovery request
function accountRecoveryTemplate({ name, recoveryLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || "User"},</h2>
    <p>We received a request to recover your account.</p>
    <p>If this was you, click below to recover access:</p>
    <a href="${recoveryLink}" style="padding:12px 24px; background:#2980b9; color:#fff; border-radius:6px; text-decoration:none;">Recover Account</a>
    <p>If not, you can safely ignore this email.</p>
  </div>
  `;
}
// Account reactivation (after deactivation)
function accountReactivationTemplate({ name, reactivateLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Welcome back ${name || "User"} 🎉</h2>
    <p>Your account has been deactivated. To reactivate it, click below:</p>
    <a href="${reactivateLink}" style="padding:12px 24px; background:#27ae60; color:#fff; border-radius:6px; text-decoration:none;">Reactivate Account</a>
  </div>
  `;
}

// Account suspension notice (due to policy/security issues)
function accountSuspendedTemplate({ name, reason, supportLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || "User"},</h2>
    <p>Your account has been temporarily <strong>suspended</strong>.</p>
    <p><strong>Reason:</strong> ${reason || "Policy violation or suspicious activity"}.</p>
    <p>Please <a href="${supportLink}">contact support</a> for assistance.</p>
  </div>
  `;
}

// Consent required for new terms / privacy policy
function consentRequiredTemplate({ name, consentLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || "User"},</h2>
    <p>We’ve updated our <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>.</p>
    <p>You need to provide consent to continue using your account:</p>
    <a href="${consentLink}" style="padding:12px 24px; background:#2980b9; color:#fff; border-radius:6px; text-decoration:none;">Review & Consent</a>
  </div>
  `;
}

// Security settings updated (e.g., 2FA toggled, password changed)
function securitySettingsUpdatedTemplate({ name, setting }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || "User"},</h2>
    <p>Your account security settings have been updated.</p>
    <p><strong>Updated Setting:</strong> ${setting}</p>
    <p>If this wasn’t you, secure your account immediately.</p>
  </div>
  `;
}

// Failed login attempts alert
function failedLoginAttemptsTemplate({ name, attempts, lockLink }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || "User"},</h2>
    <p>We noticed <strong>${attempts || "multiple"}</strong> failed login attempts on your account.</p>
    <p>For your security, you may want to reset your password:</p>
    <a href="${lockLink}" style="padding:12px 24px; background:#e74c3c; color:#fff; border-radius:6px; text-decoration:none;">Secure My Account</a>
  </div>
  `;
}

// Account verified successfully (final confirmation)
function accountVerifiedTemplate({ name }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Congratulations ${name || "User"} 🎉</h2>
    <p>Your email has been successfully verified and your account is now fully active.</p>
    <p>You can log in anytime to start using all features.</p>
  </div>
  `;
}

// Logout from all devices
function logoutAllDevicesTemplate({ name }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hi ${name || "User"},</h2>
    <p>You’ve successfully logged out from <strong>all devices</strong>.</p>
    <p>If this wasn’t you, please reset your password immediately.</p>
  </div>
  `;
}

// Trusted device added
function trustedDeviceAddedTemplate({ name, device, location }) {
  return `
  <div style="font-family: Arial, sans-serif; padding:20px;">
    <h2>Hello ${name || "User"},</h2>
    <p>A new trusted device has been added to your account.</p>
    <ul>
      <li><strong>Device:</strong> ${device || "Unknown"}</li>
      <li><strong>Location:</strong> ${location || "Unknown"}</li>
    </ul>
    <p>If this wasn’t you, remove the device from your security settings.</p>
  </div>
  `;
}

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
  twoFactorCodeTemplate,
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
  trustedDeviceAddedTemplate
};
