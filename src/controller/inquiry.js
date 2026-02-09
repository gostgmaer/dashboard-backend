const ContactInquiry = require('../models/Inquiry');
const { sendEmail } = require('../email');
const { logActivity } = require('../services/activityLogService');
const { NEW_INQUIRY_CLIENT, NEW_INQUIRY_ADMIN } = require('../email/contactInquiry');
const { sendSuccess, sendCreated, sendPaginated, HTTP_STATUS } = require('../utils/responseHelper');
const AppError = require('../utils/appError');
const { catchAsync } = require('../middleware/errorHandler');

// ================================
// CONTACT INQUIRY CONTROLLERS
// ===============================

class ContactInquiryController {
  // CREATE - Submit new inquiry
  static createInquiry = catchAsync(async (req, res) => {
    const inquiryData = {
      client: req.body.client,
      projectDetails: req.body.projectDetails,
      message: req.body.message,
      preferences: req.body.preferences,
    };
    const inquiry = new ContactInquiry(inquiryData);
    await inquiry.save();
    const d = inquiry.toAPIResponse();
    await sendEmail(NEW_INQUIRY_CLIENT, { ...d.client, ...d.message, ...d.projectDetails, ...d, inquiry: inquiry.toAPIResponse() });
    await sendEmail(NEW_INQUIRY_ADMIN, { ...d.client, ...d.message, ...d.projectDetails, ...d, inquiry: inquiry.toAPIResponse(), email: 'kishor81160@gmail.com' });

    return sendCreated(res, {
      data: inquiry.toAPIResponse(),
      message: 'Inquiry submitted successfully',
    });
  });

  // GET ALL - Dashboard listing with filters
  static getAllInquiries = catchAsync(async (req, res) => {
    const { page = 1, limit = 20, status, priority, search, service, assignedTo, sort = 'createdAt', order = 'desc' } = req.query;

    const query = {};
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sort]: order === 'desc' ? -1 : 1 },
      populate: [],
    };

    // Build dynamic query
    if (status) query.status = status;
    if (priority) query['admin.priority'] = priority;
    if (assignedTo) query['admin.assignedTo'] = assignedTo;
    if (service) query['projectDetails.servicesInterested'] = service;

    if (search) {
      query.$or = [
        { 'client.name': { $regex: search, $options: 'i' } },
        { 'client.email': { $regex: search, $options: 'i' } },
        { 'message.body': { $regex: search, $options: 'i' } },
      ];
    }

    const inquiries = await ContactInquiry.paginate(query, options);

    return sendSuccess(res, {
      data: inquiries.docs.map((doc) => doc.toAPIResponse()),
      message: 'Inquiries retrieved successfully',
      meta: {
        pagination: {
          total: inquiries.total,
          pages: inquiries.pages,
          page: inquiries.page,
          limit: inquiries.limit,
        },
      },
    });
  });

  // GET BY ID - Single inquiry details
  static getInquiryById = catchAsync(async (req, res) => {
    const inquiry = await ContactInquiry.findById(req.params.id);
    if (!inquiry) {
      throw AppError.notFound('Inquiry not found');
    }

    return sendSuccess(res, {
      data: inquiry.toObject({ virtuals: true }),
      message: 'Inquiry retrieved successfully',
    });
  });

  // UPDATE - Update inquiry status, notes, assignment
  static updateInquiry = catchAsync(async (req, res) => {
    const updates = {};

    if (req.body.status) updates.status = req.body.status;
    if (req.body.priority !== undefined) updates['admin.priority'] = req.body.priority;
    if (req.body.internalNotes !== undefined) updates['admin.internalNotes'] = req.body.internalNotes;
    if (req.body.assignedTo !== undefined) updates['admin.assignedTo'] = req.body.assignedTo;

    const inquiry = await ContactInquiry.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });

    if (!inquiry) {
      throw AppError.notFound('Inquiry not found');
    }

    // Log activity
    await logActivity({
      userId: req.user.id,
      action: 'UPDATE_INQUIRY',
      resourceId: req.params.id,
      details: updates,
    });

    return sendSuccess(res, {
      data: inquiry.toAPIResponse(),
      message: 'Inquiry updated successfully',
    });
  });

  // BULK UPDATE - Update multiple inquiries
  static bulkUpdateInquiries = catchAsync(async (req, res) => {
    const { ids, status, priority, assignedTo } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw AppError.badRequest('Inquiry IDs array is required');
    }

    const updates = { status };
    if (priority) updates['admin.priority'] = priority;
    if (assignedTo) updates['admin.assignedTo'] = assignedTo;

    const result = await ContactInquiry.bulkUpdateStatus(ids, updates);

    return sendSuccess(res, {
      data: result,
      message: `${result.modifiedCount} inquiries updated successfully`,
    });
  });

  // SEARCH - Advanced search
  static searchInquiries = catchAsync(async (req, res) => {
    const result = await ContactInquiry.searchInquiries(req.query);

    return sendSuccess(res, {
      data: result.map((doc) => doc.toAPIResponse()),
      message: 'Search completed successfully',
      meta: { total: result.length },
    });
  });

  // DASHBOARD STATS - Analytics overview
  static getDashboardStats = catchAsync(async (req, res) => {
    const stats = await ContactInquiry.getDashboardStats();

    // Additional stats
    const highPriorityCount = await ContactInquiry.countDocuments({
      'admin.priority': 'High',
      status: { $in: ['New', 'Contacted'] },
    });

    return sendSuccess(res, {
      data: {
        stats,
        highPriorityCount,
        totalInquiries: await ContactInquiry.estimatedDocumentCount(),
      },
      message: 'Dashboard stats retrieved successfully',
    });
  });

  // HIGH PRIORITY - Get urgent inquiries
  static getHighPriority = catchAsync(async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const inquiries = await ContactInquiry.getHighPriority(days);

    return sendSuccess(res, {
      data: inquiries.map((doc) => doc.toAPIResponse()),
      message: 'High priority inquiries retrieved successfully',
      meta: { urgentCount: inquiries.length },
    });
  });

  // CONTACT CLIENT - Send response to client
  static contactClient = catchAsync(async (req, res) => {
    const inquiry = await ContactInquiry.findById(req.params.id);
    if (!inquiry) {
      throw AppError.notFound('Inquiry not found');
    }

    const { method = 'email', message } = req.body;

    let sent = false;
    if (method === 'email' && inquiry.client.email) {
      await sendEmail({
        to: inquiry.client.email,
        subject: `Re: ${inquiry.message.subject}`,
        body: message,
      });
      sent = true;
    }

    // Update status
    inquiry.status = 'Contacted';
    await inquiry.save();

    return sendSuccess(res, {
      data: { sent, inquiry: inquiry.toAPIResponse() },
      message: `Client contacted via ${method}`,
    });
  });

  // DELETE - Soft delete (archive)
  static archiveInquiry = catchAsync(async (req, res) => {
    const inquiry = await ContactInquiry.findByIdAndUpdate(
      req.params.id,
      {
        status: 'Closed',
        'admin.priority': 'Low',
        deletedAt: new Date(),
      },
      { new: true }
    );

    if (!inquiry) {
      throw AppError.notFound('Inquiry not found');
    }

    return sendSuccess(res, {
      message: 'Inquiry archived successfully',
    });
  });
}

module.exports = ContactInquiryController;
