const { host } = require('../config/setting');

// emails/contactInquiry.js
const appUrl = process.env.APP_URL || 'https://yourapp.com';

// ================================
// HTML BUILDER FUNCTION (INLINE)
// ================================
const buildEmailHTML = ({ preheader = '', title = '', headerBg = '#059669', headerText = '', bodyHTML = '', ctaButton = null, footerNote = null }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; color: #1f2937; line-height: 1.5; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .header { background-color: ${headerBg}; color: white; padding: 24px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 24px 20px; }
    .content p { margin: 0 0 16px 0; color: #4b5563; }
    .content p:last-child { margin-bottom: 0; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { display: inline-block; background-color: ${ctaButton?.color || '#059669'}; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; }
    .footer { padding: 16px 20px; background-color: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    @media (max-width: 600px) { .container { margin: 10px; border-radius: 6px; } .header, .content, .footer { padding: 20px 16px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${headerText}</h1>
    </div>
    <div class="content">
      ${bodyHTML}
      ${ctaButton ? `<div class="cta"><a href="${ctaButton.url}" target="_blank">${ctaButton.text}</a></div>` : ''}
    </div>
    <div class="footer">
      ${footerNote || ''}
    </div>
  </div>
</body>
</html>`.trim();
};

// ================================
// EMAIL TEMPLATES
// ================================

// 1. NEW INQUIRY - ADMIN NOTIFICATION
const NEW_INQUIRY_ADMIN = ({ inquiry, adminUrl }) => {
  const client = inquiry.client;
  const project = inquiry.projectDetails;

  return {
    subject: `New Inquiry: ${client.name} (${client.email})`,
    html: buildEmailHTML({
      preheader: `New inquiry received from ${client.name}`,
      title: 'New Inquiry Received',
      headerBg: '#059669',
      headerText: '📩 New Inquiry',
      bodyHTML: `
        <p>Hello Admin,</p>
        <p>A new inquiry has been submitted:</p>
        <p style="margin:0 0 16px 0;">
          <strong>Client:</strong> ${client.name}<br>
          <strong>Email:</strong> ${client.email}<br>
          ${client.phone ? `<strong>Phone:</strong> ${client.phone}<br>` : ''}
          ${client.companyName ? `<strong>Company:</strong> ${client.companyName}<br>` : ''}
          ${client.websiteUrl ? `<strong>Website:</strong> <a href="${client.websiteUrl}" style="color:#059669;">${client.websiteUrl}</a><br>` : ''}
        </p>
        <p>
          <strong>Services:</strong> ${project.servicesInterested?.join(', ') || 'Not specified'}<br>
          <strong>Budget:</strong> ${project.budgetRange}<br>
          <strong>Timeline:</strong> ${project.timelinePreference}<br>
          <strong>Priority:</strong> ${inquiry.admin?.priority || 'Medium'}
        </p>
        <p><strong>Message:</strong><br>${inquiry.message.body}</p>
        <p>This is a ${inquiry.admin?.priority === 'High' ? 'HIGH-PRIORITY' : 'standard'} lead. Please review promptly.</p>
      `,
      ctaButton: {
        url: `${adminUrl || appUrl}/admin/inquiries/${inquiry._id}`,
        text: 'View Inquiry',
        color: '#059669',
      },
      footerNote: `Inquiry ID: ${inquiry._id} | ${appUrl}`,
    }),
    attachments: [],
  };
};

// 2. NEW INQUIRY - CLIENT AUTO-REPLY
const NEW_INQUIRY_CLIENT = ({ inquiry, supportEmail }) => {
  const client = inquiry.client;
  return {
    subject: `Thanks for your inquiry, ${client.name}!`,
    html: buildEmailHTML({
      preheader: `We've received your inquiry and will respond soon`,
      title: 'Thank You for Your Inquiry',
      headerBg: '#3b82f6',
      headerText: '📬 Thank You!',
      bodyHTML: `
        <p>Hi ${client.name},</p>
        <p>Thank you for reaching out! We've received your inquiry and a team member will review it within 24-48 hours.</p>
        <p><strong>Your inquiry details:</strong></p>
        <ul style="color:#4b5563;margin:8px 0;padding-left:20px;">
          <li>Services: ${inquiry.projectDetails.servicesInterested?.join(', ') || 'Not specified'}</li>
          <li>Budget: ${inquiry.projectDetails.budgetRange}</li>
          <li>Timeline: ${inquiry.projectDetails.timelinePreference}</li>
        </ul>
        <p>We'll contact you via your preferred method: ${inquiry.preferences?.preferredContactMethod || 'Email'}.</p>
        <p>If you have additional files or details, just reply to this email.</p>
      `,
      ctaButton: {
        url: `${host}/contact`,
        text: 'View Our Services',
        color: '#3b82f6',
      },
      footerNote: `Sent from ${host} | Support: ${supportEmail || 'support@easydev.in'}`,
    }),
    attachments: [],
  };
};

// 3. STATUS UPDATED - CLIENT
const INQUIRY_STATUS_UPDATED = ({ inquiry, supportEmail }) => {
  const statusMessages = {
    New: 'received and under review',
    Contacted: 'reached out and discussing next steps',
    'Proposal Sent': 'proposal sent for your review',
    Negotiating: 'actively negotiating project details',
    Closed: 'closed - thank you for considering us',
    Lost: 'closed - unable to proceed at this time',
  };

  return {
    subject: `Your inquiry status updated: ${inquiry.status}`,
    html: buildEmailHTML({
      preheader: `Your inquiry is now ${inquiry.status.toLowerCase()}`,
      title: `Inquiry Status: ${inquiry.status}`,
      headerBg: inquiry.status === 'Closed' || inquiry.status === 'Lost' ? '#ef4444' : '#059669',
      headerText: `📋 ${inquiry.status}`,
      bodyHTML: `
        <p>Hi ${inquiry.client.name},</p>
        <p>Your inquiry has been updated to <strong>${inquiry.status}</strong>.</p>
        <p>${statusMessages[inquiry.status] || 'Status updated.'}</p>
        ${inquiry.admin?.internalNotes ? `<p><strong>Notes:</strong> ${inquiry.admin.internalNotes}</p>` : ''}
        <p>Questions? Reply to this email or contact us directly.</p>
      `,
      ctaButton: {
        url: `${appUrl}/contact`,
        text: inquiry.status === 'Closed' ? 'Contact Us' : 'View Details',
        color: inquiry.status === 'Closed' || inquiry.status === 'Lost' ? '#ef4444' : '#059669',
      },
      footerNote: `Inquiry ID: ${inquiry._id} | ${appUrl}`,
    }),
    attachments: [],
  };
};

module.exports = {
  buildEmailHTML, // Export if needed elsewhere
  NEW_INQUIRY_ADMIN,
  NEW_INQUIRY_CLIENT,
  INQUIRY_STATUS_UPDATED,
};
