// services/emailService.js
const nodemailer = require('nodemailer');
const t = require('../email/emailTemplate.js'); // Import JS module with all templates

const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const User = require('../models/user');
const { emailHost, emailPort, emailSecure, mailUserName, mailPassword } = require('../config/setting');
const { sendEmail } = require('../email/index.js');
class EmailService {
  constructor() {
    this.transporter = null;
    // this.initialize();
    // this.templates = new Map();
    // this.loadTemplates();
  }

  // Initialize email transporter
  // initialize() {
  //   try {
  //     // Configure based on your email provider
  //     this.transporter = nodemailer.createTransport({
  //       host: emailHost || 'smtp.gmail.com',
  //       port: emailPort || 587,
  //       secure: emailSecure === 'true', // true for 465, false for other ports
  //       auth: {
  //         user: mailUserName,
  //         pass: mailPassword,
  //       },
  //       tls: {
  //         rejectUnauthorized: false,
  //       },
  //     });

  //     // Verify connection
  //     this.transporter.verify((error, success) => {
  //       if (error) {
  //         console.error('Email service connection error:', error);
  //       } else {
  //         //console.log('Email service connected successfully');
  //       }
  //     });
  //   } catch (error) {
  //     console.error('Failed to initialize email service:', error);
  //   }
  // }

  // Load email templates
  // loadTemplates() {
  //   try {
  //     const templatesDir = path.join(__dirname, '../email/emailTemplate.js');

  //     //console.log(templatesDir);

  //     // Create templates directory if it doesn't exist
  //     if (!fs.existsSync(templatesDir)) {
  //       fs.mkdirSync(templatesDir, { recursive: true });
  //       this.createDefaultTemplates(templatesDir);
  //     }

  //     const templateFiles = fs.readdirSync(templatesDir);

  //     templateFiles.forEach((file) => {
  //       if (file.endsWith('.hbs') || file.endsWith('.html')) {
  //         const templateName = path.basename(file, path.extname(file));
  //         const templatePath = path.join(templatesDir, file);
  //         const templateContent = fs.readFileSync(templatePath, 'utf8');
  //         this.templates.set(templateName, handlebars.compile(templateContent));
  //       }
  //     });

  //     //console.log(`Loaded ${this.templates.size} email templates`);
  //   } catch (error) {
  //     console.error('Error loading email templates:', error);
  //   }
  // }

  // Create default email templates
  //   createDefaultTemplates(templatesDir) {
  //     const templates = {
  //       notification: `
  // <!DOCTYPE html>
  // <html>
  // <head>
  //     <meta charset="utf-8">
  //     <meta name="viewport" content="width=device-width, initial-scale=1.0">
  //     <title>{{title}}</title>
  //     <style>
  //         body {
  //             font-family: Arial, sans-serif;
  //             line-height: 1.6;
  //             color: #333;
  //             max-width: 600px;
  //             margin: 0 auto;
  //             padding: 20px;
  //         }
  //         .header {
  //             background-color: #f8f9fa;
  //             padding: 20px;
  //             text-align: center;
  //             border-radius: 8px 8px 0 0;
  //         }
  //         .content {
  //             background-color: #ffffff;
  //             padding: 30px;
  //             border-left: 1px solid #e9ecef;
  //             border-right: 1px solid #e9ecef;
  //         }
  //         .footer {
  //             background-color: #f8f9fa;
  //             padding: 20px;
  //             text-align: center;
  //             font-size: 12px;
  //             color: #6c757d;
  //             border-radius: 0 0 8px 8px;
  //             border-top: 1px solid #e9ecef;
  //         }
  //         .button {
  //             display: inline-block;
  //             padding: 12px 24px;
  //             background-color: #007bff;
  //             color: white;
  //             text-decoration: none;
  //             border-radius: 5px;
  //             margin: 15px 0;
  //         }
  //         .priority-high {
  //             border-left: 4px solid #dc3545;
  //         }
  //         .priority-urgent {
  //             border-left: 4px solid #fd7e14;
  //         }
  //     </style>
  // </head>
  // <body>
  //     <div class="email-container">
  //         <div class="header">
  //             <h1>{{appName}}</h1>
  //         </div>

  //         <div class="content {{#if priorityClass}}{{priorityClass}}{{/if}}">
  //             <h2>{{title}}</h2>
  //             <p>{{message}}</p>

  //             {{#if actionUrl}}
  //             <div style="text-align: center; margin: 25px 0;">
  //                 <a href="{{actionUrl}}" class="button">View Details</a>
  //             </div>
  //             {{/if}}

  //             {{#if additionalInfo}}
  //             <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
  //                 <strong>Additional Information:</strong>
  //                 <ul>
  //                 {{#each additionalInfo}}
  //                     <li>{{this}}</li>
  //                 {{/each}}
  //                 </ul>
  //             </div>
  //             {{/if}}
  //         </div>

  //         <div class="footer">
  //             <p>This email was sent from {{appName}}. If you no longer wish to receive these notifications, you can update your preferences in your account settings.</p>
  //             <p>&copy; {{year}} {{appName}}. All rights reserved.</p>
  //         </div>
  //     </div>
  // </body>
  // </html>`,

  //       welcome: `
  // <!DOCTYPE html>
  // <html>
  // <head>
  //     <meta charset="utf-8">
  //     <meta name="viewport" content="width=device-width, initial-scale=1.0">
  //     <title>Welcome to {{appName}}</title>
  //     <style>
  //         body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  //         .welcome-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0; }
  //         .content { background-color: #ffffff; padding: 30px; border: 1px solid #e9ecef; }
  //         .button { display: inline-block; padding: 15px 30px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  //         .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; border-radius: 0 0 8px 8px; }
  //     </style>
  // </head>
  // <body>
  //     <div class="welcome-header">
  //         <h1>Welcome to {{appName}}! 🎉</h1>
  //         <p>Your account has been successfully created</p>
  //     </div>

  //     <div class="content">
  //         <p>Hi {{username}},</p>
  //         <p>Thank you for joining {{appName}}! We're excited to have you as part of our community.</p>

  //         <p>Here are some things you can do to get started:</p>
  //         <ul>
  //             <li>Complete your profile setup</li>
  //             <li>Explore our features</li>
  //             <li>Connect with other users</li>
  //         </ul>

  //         <div style="text-align: center;">
  //             <a href="{{dashboardUrl}}" class="button">Get Started</a>
  //         </div>

  //         <p>If you have any questions, feel free to reach out to our support team.</p>
  //         <p>Best regards,<br>The {{appName}} Team</p>
  //     </div>

  //     <div class="footer">
  //         <p>&copy; {{year}} {{appName}}. All rights reserved.</p>
  //     </div>
  // </body>
  // </html>`,

  //       'order-confirmation': `
  // <!DOCTYPE html>
  // <html>
  // <head>
  //     <meta charset="utf-8">
  //     <title>Order Confirmation - {{orderNumber}}</title>
  //     <style>
  //         body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  //         .order-header { background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
  //         .content { background-color: #ffffff; padding: 30px; border: 1px solid #e9ecef; }
  //         .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
  //         .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  //         .items-table th, .items-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
  //         .items-table th { background-color: #f8f9fa; }
  //         .total { font-size: 18px; font-weight: bold; color: #28a745; }
  //     </style>
  // </head>
  // <body>
  //     <div class="order-header">
  //         <h1>Order Confirmed! ✅</h1>
  //         <p>Order #{{orderNumber}}</p>
  //     </div>

  //     <div class="content">
  //         <p>Hi {{customerName}},</p>
  //         <p>Thank you for your order! We've received it and are processing it now.</p>

  //         <div class="order-details">
  //             <h3>Order Details</h3>
  //             <p><strong>Order Number:</strong> {{orderNumber}}</p>
  //             <p><strong>Order Date:</strong> {{orderDate}}</p>
  //             <p><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>
  //         </div>

  //         {{#if items}}
  //         <table class="items-table">
  //             <thead>
  //                 <tr>
  //                     <th>Item</th>
  //                     <th>Quantity</th>
  //                     <th>Price</th>
  //                     <th>Total</th>
  //                 </tr>
  //             </thead>
  //             <tbody>
  //                 {{#each items}}
  //                 <tr>
  //                     <td>{{name}}</td>
  //                     <td>{{quantity}}</td>
  //                     <td>${{ price }}</td>
  //                     <td>${{ total }}</td>
  //                 </tr>
  //                 {{/each}}
  //             </tbody>
  //         </table>
  //         {{/if}}

  //         <div style="text-align: right; margin-top: 20px;">
  //             <p class="total">Total: ${{ totalAmount }}</p>
  //         </div>

  //         <p>We'll send you another email when your order ships with tracking information.</p>

  //         <div style="text-align: center; margin: 25px 0;">
  //             <a href="{{trackingUrl}}" class="button">Track Your Order</a>
  //         </div>
  //     </div>
  // </body>
  // </html>`,
  //     };

  //     // Write templates to files
  //     Object.entries(templates).forEach(([name, content]) => {
  //       const filePath = path.join(templatesDir, `${name}.hbs`);
  //       fs.writeFileSync(filePath, content);
  //     });

  //     //console.log('Created default email templates');
  //   }

  // Send notification email
  async sendNotification(notification, template) {
    try {
      const recipient = await User.findById(notification.recipient).select('email username firstName lastName');

      if (!recipient || !recipient.email) {
        console.warn('Recipient email not found:', notification.recipient);
        return false;
      }

      // Prepare template data
      const templateData = {
        title: notification.title,
        message: notification.message,
        username: recipient.username || recipient.firstName || 'User',
        email: recipient.email,
        additionalInfo: notification.data,
        appName: process.env.APP_NAME || 'Easy Dev',
        year: new Date().getFullYear(),
        actionUrl: notification.metadata?.actionUrl ? `${process.env.CLIENT_URL}${notification.metadata.actionUrl}` : null,
        priorityClass: notification.priority === 'HIGH' ? 'priority-high' : notification.priority === 'URGENT' ? 'priority-urgent' : '',
      };
      const m = await sendEmail(t[notification.type], templateData);
      //console.log('Email sent successfully:', m.messageId);

      return {
        success: true,
        messageId: m.messageId,
        recipient: recipient.email,
      };
    } catch (error) {
      console.error('Error sending notification email:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Send custom email
  async sendCustomEmail(options) {
    try {
      const { to, subject, template, templateData = {}, attachments = [] } = options;

      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      // Get compiled template
      const compiledTemplate = this.templates.get(template);
      if (!compiledTemplate) {
        throw new Error(`Template '${template}' not found`);
      }

      // Prepare template data with defaults
      const data = {
        appName: process.env.APP_NAME || 'Your App',
        year: new Date().getFullYear(),
        ...templateData,
      };

      const htmlContent = compiledTemplate(data);

      const mailOptions = {
        from: {
          name: process.env.SMTP_FROM_NAME || 'Your App',
          address: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
        },
        to,
        subject,
        html: htmlContent,
        text: this.htmlToText(htmlContent),
        attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error('Error sending custom email:', error);
      throw error;
    }
  }

  // Send bulk emails
  async sendBulkEmails(emails) {
    try {
      const results = [];

      // Process emails in batches to avoid overwhelming the SMTP server
      const batchSize = 10;
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        const batchPromises = batch.map((email) => this.sendCustomEmail(email));
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Add delay between batches
        if (i + batchSize < emails.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return results;
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      throw error;
    }
  }

  // Convert HTML to plain text
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .trim();
  }

  // // Test email configuration
  // async testConnection() {
  //   try {
  //     if (!this.transporter) {
  //       return { success: false, message: 'Email transporter not initialized' };
  //     }

  //     const result = await this.transporter.verify();
  //     return {
  //       success: true,
  //       message: 'Email service connection successful',
  //     };
  //   } catch (error) {
  //     return {
  //       success: false,
  //       message: error.message,
  //     };
  //   }
  // }

  // // Send test email
  // async sendTestEmail(toEmail) {
  //   try {
  //     const testOptions = {
  //       to: toEmail,
  //       subject: 'Test Email from Your App',
  //       template: 'notification',
  //       templateData: {
  //         title: 'Test Email',
  //         message: 'This is a test email to verify your email configuration is working properly.',
  //         username: 'Test User',
  //       },
  //     };

  //     return await this.sendCustomEmail(testOptions);
  //   } catch (error) {
  //     console.error('Error sending test email:', error);
  //     throw error;
  //   }
  // }
}

module.exports = new EmailService();
