
// controllers/exportController.js
const Resume = require('./model');
const Template = require('./Template');
const { AppError, catchAsync } = require('./errorHandler');
const { sendResponse } = require('./response');
const { 
  generatePDF, 
  generateDocx, 
  generateHTML, 
  generateTXT 
} = require('./documentGenerator');
const mongoose = require('mongoose');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

// Export resume as PDF
exports.exportToPDF = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { templateId, filename, options = {} } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  // Get resume (allow public access for shared resumes)
  let resume;
  if (req.user) {
    resume = await Resume.findOne({
      _id: id,
      $or: [
        { userId: req.user._id },
        { visibility: 'public' },
        { visibility: 'link-only' }
      ]
    }).populate('templateId');
  } else {
    resume = await Resume.findOne({
      _id: id,
      $or: [
        { visibility: 'public' },
        { visibility: 'link-only' }
      ]
    }).populate('templateId');
  }

  if (!resume) {
    return next(new AppError('Resume not found or not accessible', 404));
  }

  // Get template if specified
  let template = resume.templateId;
  if (templateId && templateId !== resume.templateId?.toString()) {
    template = await Template.findOne({
      _id: templateId,
      status: 'active',
      $or: [{ isPublic: true }, { createdBy: req.user?._id }]
    });

    if (!template) {
      return next(new AppError('Template not found or not accessible', 404));
    }
  }

  try {
    const pdfOptions = {
      format: options.format || 'A4',
      margin: {
        top: options.marginTop || '20mm',
        right: options.marginRight || '20mm',
        bottom: options.marginBottom || '20mm',
        left: options.marginLeft || '20mm'
      },
      printBackground: true,
      ...options
    };

    const pdfBuffer = await generatePDF(resume, template, pdfOptions);

    // Increment download count
    if (req.user && resume.userId.toString() === req.user._id.toString()) {
      resume.downloadCount += 1;
      await resume.save();
    }

    const fileName = filename || `${resume.title || 'resume'}-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    return next(new AppError('Failed to generate PDF: ' + error.message, 500));
  }
});

// Export resume as DOCX
exports.exportToDocx = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { templateId, filename, options = {} } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  // Get resume (allow public access for shared resumes)
  let resume;
  if (req.user) {
    resume = await Resume.findOne({
      _id: id,
      $or: [
        { userId: req.user._id },
        { visibility: 'public' },
        { visibility: 'link-only' }
      ]
    }).populate('templateId');
  } else {
    resume = await Resume.findOne({
      _id: id,
      $or: [
        { visibility: 'public' },
        { visibility: 'link-only' }
      ]
    }).populate('templateId');
  }

  if (!resume) {
    return next(new AppError('Resume not found or not accessible', 404));
  }

  // Get template if specified
  let template = resume.templateId;
  if (templateId && templateId !== resume.templateId?.toString()) {
    template = await Template.findOne({
      _id: templateId,
      status: 'active',
      $or: [{ isPublic: true }, { createdBy: req.user?._id }]
    });

    if (!template) {
      return next(new AppError('Template not found or not accessible', 404));
    }
  }

  try {
    const docxBuffer = await generateDocx(resume, template, options);

    // Increment download count
    if (req.user && resume.userId.toString() === req.user._id.toString()) {
      resume.downloadCount += 1;
      await resume.save();
    }

    const fileName = filename || `${resume.title || 'resume'}-${Date.now()}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', docxBuffer.length);

    res.send(docxBuffer);
  } catch (error) {
    return next(new AppError('Failed to generate DOCX: ' + error.message, 500));
  }
});

// Export resume as HTML
exports.exportToHTML = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { templateId, download = false, options = {} } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  // Get resume (allow public access for shared resumes)
  let resume;
  if (req.user) {
    resume = await Resume.findOne({
      _id: id,
      $or: [
        { userId: req.user._id },
        { visibility: 'public' },
        { visibility: 'link-only' }
      ]
    }).populate('templateId');
  } else {
    resume = await Resume.findOne({
      _id: id,
      $or: [
        { visibility: 'public' },
        { visibility: 'link-only' }
      ]
    }).populate('templateId');
  }

  if (!resume) {
    return next(new AppError('Resume not found or not accessible', 404));
  }

  // Get template if specified
  let template = resume.templateId;
  if (templateId && templateId !== resume.templateId?.toString()) {
    template = await Template.findOne({
      _id: templateId,
      status: 'active',
      $or: [{ isPublic: true }, { createdBy: req.user?._id }]
    });

    if (!template) {
      return next(new AppError('Template not found or not accessible', 404));
    }
  }

  try {
    const htmlContent = await generateHTML(resume, template, options);

    // Increment download count if downloading
    if (download === 'true' && req.user && resume.userId.toString() === req.user._id.toString()) {
      resume.downloadCount += 1;
      await resume.save();
    }

    if (download === 'true') {
      const fileName = `${resume.title || 'resume'}-${Date.now()}.html`;
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }

    res.send(htmlContent);
  } catch (error) {
    return next(new AppError('Failed to generate HTML: ' + error.message, 500));
  }
});

// Export resume as JSON
exports.exportToJSON = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { format = 'our', filename } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  // Get resume
  let resume;
  if (req.user) {
    resume = await Resume.findOne({
      _id: id,
      $or: [
        { userId: req.user._id },
        { visibility: 'public' },
        { visibility: 'link-only' }
      ]
    }).populate('templateId', 'name');
  } else {
    resume = await Resume.findOne({
      _id: id,
      $or: [
        { visibility: 'public' },
        { visibility: 'link-only' }
      ]
    }).populate('templateId', 'name');
  }

  if (!resume) {
    return next(new AppError('Resume not found or not accessible', 404));
  }

  let exportData;

  if (format === 'jsonresume') {
    // Export in JSON Resume format (jsonresume.org)
    exportData = convertToJsonResumeFormat(resume);
  } else {
    // Export in our own format
    exportData = resume.toObject();

    // Remove sensitive fields for non-owners
    if (!req.user || resume.userId.toString() !== req.user._id.toString()) {
      delete exportData.userId;
      delete exportData.versions;
      delete exportData.shareToken;
      delete exportData.importSource;
    }
  }

  // Increment download count
  if (req.user && resume.userId.toString() === req.user._id.toString()) {
    resume.downloadCount += 1;
    await resume.save();
  }

  const fileName = filename || `${resume.title || 'resume'}-${Date.now()}.json`;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  res.json(exportData);
});

// Export resume as plain text
exports.exportToTXT = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { filename } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  // Get resume
  let resume;
  if (req.user) {
    resume = await Resume.findOne({
      _id: id,
      $or: [
        { userId: req.user._id },
        { visibility: 'public' },
        { visibility: 'link-only' }
      ]
    });
  } else {
    resume = await Resume.findOne({
      _id: id,
      $or: [
        { visibility: 'public' },
        { visibility: 'link-only' }
      ]
    });
  }

  if (!resume) {
    return next(new AppError('Resume not found or not accessible', 404));
  }

  try {
    const txtContent = generateTXT(resume);

    // Increment download count
    if (req.user && resume.userId.toString() === req.user._id.toString()) {
      resume.downloadCount += 1;
      await resume.save();
    }

    const fileName = filename || `${resume.title || 'resume'}-${Date.now()}.txt`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    res.send(txtContent);
  } catch (error) {
    return next(new AppError('Failed to generate TXT: ' + error.message, 500));
  }
});

// Download resume in all formats as ZIP
exports.downloadAllFormats = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { templateId } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError('Invalid resume ID', 400));
  }

  const resume = await Resume.findOne({
    _id: id,
    userId: req.user._id
  }).populate('templateId');

  if (!resume) {
    return next(new AppError('Resume not found', 404));
  }

  // Get template if specified
  let template = resume.templateId;
  if (templateId && templateId !== resume.templateId?.toString()) {
    template = await Template.findOne({
      _id: templateId,
      status: 'active',
      $or: [{ isPublic: true }, { createdBy: req.user._id }]
    });

    if (!template) {
      return next(new AppError('Template not found or not accessible', 404));
    }
  }

  try {
    const baseName = resume.title || 'resume';
    const timestamp = Date.now();

    // Generate all formats
    const [pdfBuffer, docxBuffer, htmlContent, txtContent] = await Promise.all([
      generatePDF(resume, template),
      generateDocx(resume, template),
      generateHTML(resume, template),
      generateTXT(resume)
    ]);

    // Create JSON export
    const jsonContent = JSON.stringify(resume.toObject(), null, 2);

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}-all-formats-${timestamp}.zip"`);

    archive.pipe(res);

    // Add files to archive
    archive.append(pdfBuffer, { name: `${baseName}.pdf` });
    archive.append(docxBuffer, { name: `${baseName}.docx` });
    archive.append(htmlContent, { name: `${baseName}.html` });
    archive.append(txtContent, { name: `${baseName}.txt` });
    archive.append(jsonContent, { name: `${baseName}.json` });

    // Finalize archive
    await archive.finalize();

    // Increment download count
    resume.downloadCount += 5; // Count each format
    await resume.save();

  } catch (error) {
    return next(new AppError('Failed to create archive: ' + error.message, 500));
  }
});

// Helper function to convert to JSON Resume format
function convertToJsonResumeFormat(resume) {
  const fullName = resume.personalInfo ? 
    `${resume.personalInfo.firstName} ${resume.personalInfo.lastName}`.trim() : '';

  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: fullName,
      label: resume.personalInfo?.position || '',
      image: '',
      email: resume.personalInfo?.email || '',
      phone: resume.personalInfo?.phone || '',
      url: resume.personalInfo?.website || '',
      summary: resume.summary || '',
      location: {
        address: resume.personalInfo?.address?.street || '',
        postalCode: resume.personalInfo?.address?.zipCode || '',
        city: resume.personalInfo?.address?.city || '',
        countryCode: resume.personalInfo?.address?.country || '',
        region: resume.personalInfo?.address?.state || ''
      },
      profiles: [
        ...(resume.personalInfo?.linkedin ? [{
          network: 'LinkedIn',
          username: '',
          url: resume.personalInfo.linkedin
        }] : []),
        ...(resume.personalInfo?.github ? [{
          network: 'GitHub',
          username: '',
          url: resume.personalInfo.github
        }] : [])
      ]
    },
    work: resume.experience?.map(exp => ({
      name: exp.company,
      position: exp.position,
      url: '',
      startDate: exp.startDate ? exp.startDate.toISOString().split('T')[0] : '',
      endDate: exp.endDate ? exp.endDate.toISOString().split('T')[0] : '',
      summary: exp.description || '',
      highlights: exp.achievements || []
    })) || [],
    volunteer: resume.volunteer?.map(vol => ({
      organization: vol.organization,
      position: vol.position,
      url: '',
      startDate: vol.startDate ? vol.startDate.toISOString().split('T')[0] : '',
      endDate: vol.endDate ? vol.endDate.toISOString().split('T')[0] : '',
      summary: vol.description || '',
      highlights: vol.achievements || []
    })) || [],
    education: resume.education?.map(edu => ({
      institution: edu.institution,
      url: '',
      area: edu.fieldOfStudy || '',
      studyType: edu.degree,
      startDate: edu.startDate ? edu.startDate.toISOString().split('T')[0] : '',
      endDate: edu.endDate ? edu.endDate.toISOString().split('T')[0] : '',
      score: edu.gpa || '',
      courses: edu.coursework || []
    })) || [],
    awards: resume.awards?.map(award => ({
      title: award.title,
      date: award.date ? award.date.toISOString().split('T')[0] : '',
      awarder: award.issuer,
      summary: award.description || ''
    })) || [],
    certificates: resume.certifications?.map(cert => ({
      name: cert.name,
      date: cert.issueDate ? cert.issueDate.toISOString().split('T')[0] : '',
      issuer: cert.issuer,
      url: cert.credentialUrl || ''
    })) || [],
    publications: [],
    skills: resume.skills?.reduce((acc, skillCategory) => {
      skillCategory.skills.forEach(skill => {
        acc.push({
          name: skill.name,
          level: skill.level,
          keywords: [skillCategory.category]
        });
      });
      return acc;
    }, []) || [],
    languages: resume.languages?.map(lang => ({
      language: lang.language,
      fluency: lang.proficiency
    })) || [],
    interests: [],
    references: [],
    projects: resume.projects?.map(project => ({
      name: project.name,
      description: project.description,
      highlights: project.highlights || [],
      keywords: project.technologies || [],
      startDate: project.startDate ? project.startDate.toISOString().split('T')[0] : '',
      endDate: project.endDate ? project.endDate.toISOString().split('T')[0] : '',
      url: project.url || '',
      roles: [project.role || ''],
      entity: '',
      type: 'application'
    })) || []
  };
}

module.exports = exports;
