
// utils/documentGenerator.js
const puppeteer = require('puppeteer');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', function(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long' 
  });
});

Handlebars.registerHelper('formatDateRange', function(startDate, endDate, isCurrent) {
  const start = startDate ? new Date(startDate).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short' 
  }) : '';

  if (isCurrent) {
    return `${start} - Present`;
  }

  const end = endDate ? new Date(endDate).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short' 
  }) : '';

  return end ? `${start} - ${end}` : start;
});

Handlebars.registerHelper('join', function(array, separator) {
  if (!Array.isArray(array)) return '';
  return array.join(separator || ', ');
});

Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

Handlebars.registerHelper('or', function() {
  const args = Array.prototype.slice.call(arguments, 0, -1);
  return args.some(arg => !!arg);
});

// Generate PDF from resume data
async function generatePDF(resume, template, options = {}) {
  let browser;

  try {
    // Generate HTML first
    const htmlContent = await generateHTML(resume, template, options);

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    // Set content and wait for fonts to load
    await page.setContent(htmlContent, { 
      waitUntil: ['networkidle0', 'domcontentloaded'] 
    });

    // Configure PDF options
    const pdfOptions = {
      format: options.format || 'A4',
      margin: options.margin || {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true,
      preferCSSPageSize: true,
      ...options
    };

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);

    return pdfBuffer;

  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Generate DOCX from resume data
async function generateDocx(resume, template, options = {}) {
  try {
    let templatePath;
    let templateContent;

    if (template && template.files && template.files.htmlTemplate) {
      // Use custom template - convert HTML to DOCX format
      templatePath = path.join(process.cwd(), 'uploads', 'templates', 'files', template.files.htmlTemplate);

      try {
        const htmlContent = await fs.readFile(templatePath, 'utf8');
        // Convert HTML template to DOCX-compatible format
        templateContent = convertHtmlToDocxTemplate(htmlContent);
      } catch (error) {
        console.warn('Could not read custom template, using default');
        templateContent = await getDefaultDocxTemplate();
      }
    } else {
      // Use default DOCX template
      templateContent = await getDefaultDocxTemplate();
    }

    // Prepare template data
    const templateData = prepareTemplateData(resume);

    // Load template into PizZip
    const zip = new PizZip(templateContent);

    // Create Docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '{',
        end: '}'
      }
    });

    // Render template with data
    doc.render(templateData);

    // Generate DOCX buffer
    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    return buffer;

  } catch (error) {
    console.error('DOCX generation error:', error);
    throw new Error(`Failed to generate DOCX: ${error.message}`);
  }
}

// Generate HTML from resume data
async function generateHTML(resume, template, options = {}) {
  try {
    let htmlTemplate;
    let cssStyles = '';

    if (template && template.files) {
      // Use custom template
      try {
        if (template.files.htmlTemplate) {
          const templatePath = path.join(process.cwd(), 'uploads', 'templates', 'files', template.files.htmlTemplate);
          htmlTemplate = await fs.readFile(templatePath, 'utf8');
        }

        if (template.files.cssStyles) {
          const cssPath = path.join(process.cwd(), 'uploads', 'templates', 'files', template.files.cssStyles);
          cssStyles = await fs.readFile(cssPath, 'utf8');
        } else if (template.style) {
          cssStyles = generateCSSFromStyle(template.style);
        }
      } catch (error) {
        console.warn('Could not read custom template files, using default');
        htmlTemplate = getDefaultHtmlTemplate();
        cssStyles = getDefaultCssStyles();
      }
    } else {
      // Use default template
      htmlTemplate = getDefaultHtmlTemplate();
      cssStyles = getDefaultCssStyles();
    }

    // Compile Handlebars template
    const compiledTemplate = Handlebars.compile(htmlTemplate);

    // Prepare template data
    const templateData = prepareTemplateData(resume);

    // Render HTML
    const renderedHtml = compiledTemplate(templateData);

    // Combine with CSS
    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${resume.title || 'Resume'}</title>
    <style>
        ${cssStyles}

        /* Additional responsive styles */
        @media print {
            body { font-size: 12pt; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
        }

        @media screen and (max-width: 768px) {
            .container { padding: 10px; }
            .two-column { flex-direction: column; }
        }
    </style>
</head>
<body>
    ${renderedHtml}
</body>
</html>`;

    return fullHtml;

  } catch (error) {
    console.error('HTML generation error:', error);
    throw new Error(`Failed to generate HTML: ${error.message}`);
  }
}

// Generate plain text from resume data
function generateTXT(resume) {
  try {
    let txtContent = '';

    // Header
    if (resume.personalInfo) {
      const { firstName, lastName, email, phone, address } = resume.personalInfo;
      txtContent += `${firstName || ''} ${lastName || ''}\n`;
      if (email) txtContent += `Email: ${email}\n`;
      if (phone) txtContent += `Phone: ${phone}\n`;
      if (address) {
        const addressStr = [
          address.street,
          address.city,
          address.state,
          address.zipCode,
          address.country
        ].filter(Boolean).join(', ');
        if (addressStr) txtContent += `Address: ${addressStr}\n`;
      }
      txtContent += '\n';
    }

    // Summary
    if (resume.summary) {
      txtContent += 'PROFESSIONAL SUMMARY\n';
      txtContent += '='.repeat(50) + '\n';
      txtContent += `${resume.summary}\n\n`;
    }

    // Experience
    if (resume.experience && resume.experience.length > 0) {
      txtContent += 'WORK EXPERIENCE\n';
      txtContent += '='.repeat(50) + '\n';

      resume.experience.forEach(exp => {
        txtContent += `${exp.position} at ${exp.company}\n`;
        if (exp.location) txtContent += `Location: ${exp.location}\n`;

        const startDate = exp.startDate ? new Date(exp.startDate).toLocaleDateString() : '';
        const endDate = exp.isCurrent ? 'Present' : 
                       (exp.endDate ? new Date(exp.endDate).toLocaleDateString() : '');
        if (startDate) txtContent += `Duration: ${startDate} - ${endDate}\n`;

        if (exp.description) txtContent += `\n${exp.description}\n`;

        if (exp.achievements && exp.achievements.length > 0) {
          txtContent += '\nKey Achievements:\n';
          exp.achievements.forEach(achievement => {
            txtContent += `• ${achievement}\n`;
          });
        }

        if (exp.technologies && exp.technologies.length > 0) {
          txtContent += `\nTechnologies: ${exp.technologies.join(', ')}\n`;
        }

        txtContent += '\n' + '-'.repeat(40) + '\n\n';
      });
    }

    // Education
    if (resume.education && resume.education.length > 0) {
      txtContent += 'EDUCATION\n';
      txtContent += '='.repeat(50) + '\n';

      resume.education.forEach(edu => {
        txtContent += `${edu.degree}`;
        if (edu.fieldOfStudy) txtContent += ` in ${edu.fieldOfStudy}`;
        txtContent += `\n${edu.institution}`;
        if (edu.location) txtContent += `, ${edu.location}`;
        txtContent += '\n';

        const startDate = edu.startDate ? new Date(edu.startDate).getFullYear() : '';
        const endDate = edu.endDate ? new Date(edu.endDate).getFullYear() : '';
        if (startDate) txtContent += `${startDate} - ${endDate}\n`;

        if (edu.gpa) txtContent += `GPA: ${edu.gpa}\n`;

        if (edu.honors && edu.honors.length > 0) {
          txtContent += `Honors: ${edu.honors.join(', ')}\n`;
        }

        txtContent += '\n';
      });
    }

    // Skills
    if (resume.skills && resume.skills.length > 0) {
      txtContent += 'SKILLS\n';
      txtContent += '='.repeat(50) + '\n';

      resume.skills.forEach(skillCategory => {
        txtContent += `${skillCategory.category}:\n`;
        skillCategory.skills.forEach(skill => {
          txtContent += `• ${skill.name}`;
          if (skill.level) txtContent += ` (${skill.level})`;
          txtContent += '\n';
        });
        txtContent += '\n';
      });
    }

    // Projects
    if (resume.projects && resume.projects.length > 0) {
      txtContent += 'PROJECTS\n';
      txtContent += '='.repeat(50) + '\n';

      resume.projects.forEach(project => {
        txtContent += `${project.name}\n`;
        if (project.description) txtContent += `${project.description}\n`;
        if (project.technologies && project.technologies.length > 0) {
          txtContent += `Technologies: ${project.technologies.join(', ')}\n`;
        }
        if (project.url) txtContent += `URL: ${project.url}\n`;
        txtContent += '\n';
      });
    }

    // Certifications
    if (resume.certifications && resume.certifications.length > 0) {
      txtContent += 'CERTIFICATIONS\n';
      txtContent += '='.repeat(50) + '\n';

      resume.certifications.forEach(cert => {
        txtContent += `${cert.name}\n`;
        txtContent += `Issued by: ${cert.issuer}\n`;
        if (cert.issueDate) {
          txtContent += `Date: ${new Date(cert.issueDate).toLocaleDateString()}\n`;
        }
        if (cert.credentialUrl) txtContent += `URL: ${cert.credentialUrl}\n`;
        txtContent += '\n';
      });
    }

    // Languages
    if (resume.languages && resume.languages.length > 0) {
      txtContent += 'LANGUAGES\n';
      txtContent += '='.repeat(50) + '\n';

      resume.languages.forEach(lang => {
        txtContent += `${lang.language}: ${lang.proficiency}\n`;
      });
      txtContent += '\n';
    }

    return txtContent;

  } catch (error) {
    console.error('TXT generation error:', error);
    throw new Error(`Failed to generate TXT: ${error.message}`);
  }
}

// Helper functions
function prepareTemplateData(resume) {
  const data = resume.toObject ? resume.toObject() : resume;

  // Add computed fields
  data.fullName = data.personalInfo ? 
    `${data.personalInfo.firstName || ''} ${data.personalInfo.lastName || ''}`.trim() : '';

  data.hasExperience = data.experience && data.experience.length > 0;
  data.hasEducation = data.education && data.education.length > 0;
  data.hasSkills = data.skills && data.skills.length > 0;
  data.hasProjects = data.projects && data.projects.length > 0;
  data.hasCertifications = data.certifications && data.certifications.length > 0;
  data.hasLanguages = data.languages && data.languages.length > 0;

  // Format dates
  if (data.experience) {
    data.experience.forEach(exp => {
      exp.formattedStartDate = exp.startDate ? new Date(exp.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '';
      exp.formattedEndDate = exp.isCurrent ? 'Present' : 
                            (exp.endDate ? new Date(exp.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '');
      exp.dateRange = `${exp.formattedStartDate} - ${exp.formattedEndDate}`;
    });
  }

  if (data.education) {
    data.education.forEach(edu => {
      edu.formattedStartDate = edu.startDate ? new Date(edu.startDate).getFullYear() : '';
      edu.formattedEndDate = edu.endDate ? new Date(edu.endDate).getFullYear() : '';
      edu.dateRange = `${edu.formattedStartDate} - ${edu.formattedEndDate}`;
    });
  }

  return data;
}

function getDefaultHtmlTemplate() {
  return `
<div class="resume-container">
  <header class="resume-header">
    {{#if personalInfo}}
    <h1 class="name">{{personalInfo.firstName}} {{personalInfo.lastName}}</h1>
    <div class="contact-info">
      {{#if personalInfo.email}}<span class="email">{{personalInfo.email}}</span>{{/if}}
      {{#if personalInfo.phone}}<span class="phone">{{personalInfo.phone}}</span>{{/if}}
      {{#if personalInfo.website}}<span class="website"><a href="{{personalInfo.website}}">{{personalInfo.website}}</a></span>{{/if}}
      {{#if personalInfo.linkedin}}<span class="linkedin"><a href="{{personalInfo.linkedin}}">LinkedIn</a></span>{{/if}}
    </div>
    {{/if}}
  </header>

  {{#if summary}}
  <section class="summary">
    <h2>Professional Summary</h2>
    <p>{{summary}}</p>
  </section>
  {{/if}}

  {{#if hasExperience}}
  <section class="experience">
    <h2>Work Experience</h2>
    {{#each experience}}
    <div class="job">
      <div class="job-header">
        <h3 class="position">{{position}}</h3>
        <span class="company">{{company}}</span>
        <span class="date-range">{{dateRange}}</span>
      </div>
      {{#if description}}<p class="description">{{description}}</p>{{/if}}
      {{#if achievements}}
      <ul class="achievements">
        {{#each achievements}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
      {{/if}}
      {{#if technologies}}
      <div class="technologies">
        <strong>Technologies:</strong> {{join technologies ", "}}
      </div>
      {{/if}}
    </div>
    {{/each}}
  </section>
  {{/if}}

  {{#if hasEducation}}
  <section class="education">
    <h2>Education</h2>
    {{#each education}}
    <div class="degree">
      <div class="degree-header">
        <h3 class="degree-name">{{degree}}</h3>
        <span class="institution">{{institution}}</span>
        <span class="date-range">{{dateRange}}</span>
      </div>
      {{#if fieldOfStudy}}<p class="field-of-study">{{fieldOfStudy}}</p>{{/if}}
      {{#if gpa}}<p class="gpa">GPA: {{gpa}}</p>{{/if}}
    </div>
    {{/each}}
  </section>
  {{/if}}

  {{#if hasSkills}}
  <section class="skills">
    <h2>Skills</h2>
    {{#each skills}}
    <div class="skill-category">
      <h3 class="category-name">{{category}}</h3>
      <div class="skill-list">
        {{#each skills}}
        <span class="skill">{{name}}{{#if level}} ({{level}}){{/if}}</span>
        {{/each}}
      </div>
    </div>
    {{/each}}
  </section>
  {{/if}}
</div>`;
}

function getDefaultCssStyles() {
  return `
body { 
  font-family: 'Arial', sans-serif; 
  line-height: 1.6; 
  color: #333; 
  max-width: 800px; 
  margin: 0 auto; 
  padding: 20px; 
}

.resume-container { background: white; }

.resume-header { 
  text-align: center; 
  border-bottom: 2px solid #0066cc; 
  padding-bottom: 20px; 
  margin-bottom: 30px; 
}

.name { 
  font-size: 2.5em; 
  margin-bottom: 10px; 
  color: #0066cc; 
}

.contact-info { 
  display: flex; 
  justify-content: center; 
  gap: 20px; 
  flex-wrap: wrap; 
}

.contact-info span { 
  font-size: 0.9em; 
  color: #666; 
}

.contact-info a { 
  color: #0066cc; 
  text-decoration: none; 
}

section { 
  margin-bottom: 30px; 
}

h2 { 
  color: #0066cc; 
  border-bottom: 1px solid #eee; 
  padding-bottom: 5px; 
  margin-bottom: 20px; 
}

.job, .degree { 
  margin-bottom: 25px; 
}

.job-header, .degree-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 10px; 
}

.position, .degree-name { 
  font-size: 1.2em; 
  font-weight: bold; 
  color: #333; 
}

.company, .institution { 
  color: #666; 
  font-style: italic; 
}

.date-range { 
  color: #888; 
  font-size: 0.9em; 
}

.achievements { 
  margin: 10px 0; 
  padding-left: 20px; 
}

.achievements li { 
  margin-bottom: 5px; 
}

.skill-category { 
  margin-bottom: 20px; 
}

.category-name { 
  font-size: 1.1em; 
  margin-bottom: 10px; 
  color: #0066cc; 
}

.skill-list { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 10px; 
}

.skill { 
  background: #f0f0f0; 
  padding: 5px 10px; 
  border-radius: 15px; 
  font-size: 0.9em; 
}
`;
}

async function getDefaultDocxTemplate() {
  // This would typically load a default DOCX template file
  // For now, we'll create a basic template programmatically
  const templatePath = path.join(__dirname, '../templates/default-resume.docx');

  try {
    return await fs.readFile(templatePath);
  } catch (error) {
    // If default template doesn't exist, create a minimal one
    throw new Error('Default DOCX template not found. Please provide a custom template.');
  }
}

function convertHtmlToDocxTemplate(htmlContent) {
  // Convert HTML template to DOCX-compatible format
  // This would require additional processing to convert HTML to DOCX template format
  // For now, return the HTML as-is (this would need proper implementation)
  return htmlContent;
}

function generateCSSFromStyle(styleConfig) {
  // Generate CSS from template style configuration
  let css = '';

  if (styleConfig.fonts) {
    css += `
body { 
  font-family: '${styleConfig.fonts.primary}', sans-serif; 
}
h1, h2, h3 { 
  font-family: '${styleConfig.fonts.heading}', sans-serif; 
}
`;
  }

  if (styleConfig.colors) {
    css += `
:root {
  --primary-color: ${styleConfig.colors.primary};
  --secondary-color: ${styleConfig.colors.secondary};
  --accent-color: ${styleConfig.colors.accent};
  --background-color: ${styleConfig.colors.background};
  --text-color: ${styleConfig.colors.text};
}
body { 
  color: var(--text-color); 
  background-color: var(--background-color); 
}
h1, h2, h3 { 
  color: var(--primary-color); 
}
a { 
  color: var(--accent-color); 
}
`;
  }

  if (styleConfig.customCSS) {
    css += styleConfig.customCSS;
  }

  return css;
}

module.exports = {
  generatePDF,
  generateDocx,
  generateHTML,
  generateTXT
};
