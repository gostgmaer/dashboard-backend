// utils/emailBuilder.js
const buildEmailHTML = ({ preheader = '', title = '', headerBg = '#059669', headerText = '', bodyHTML = '', ctaButton = null, footerNote = null }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f9fafb;
      color: #1f2937;
      line-height: 1.5;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: ${headerBg};
      color: white;
      padding: 24px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
    .content {
      padding: 24px 20px;
    }
    .content p {
      margin: 0 0 16px 0;
      color: #4b5563;
    }
    .content p:last-child {
      margin-bottom: 0;
    }
    .cta {
      text-align: center;
      margin: 24px 0;
    }
    .cta a {
      display: inline-block;
      background-color: ${ctaButton?.color || '#059669'};
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-weight: 500;
    }
    .footer {
      padding: 16px 20px;
      background-color: #f3f4f6;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    @media (max-width: 600px) {
      .container {
        margin: 10px;
        border-radius: 6px;
      }
      .header, .content, .footer {
        padding: 20px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${headerText}</h1>
    </div>
    <div class="content">
      ${bodyHTML}
      ${
        ctaButton
          ? `
      <div class="cta">
        <a href="${ctaButton.url}" target="_blank">${ctaButton.text}</a>
      </div>
      `
          : ''
      }
    </div>
    <div class="footer">
      ${footerNote || ''}
    </div>
  </div>
</body>
</html>
  `;
};
