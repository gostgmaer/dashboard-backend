const Inquiry = require('../models/Inquiry');
const { sendEmail } = require('../email');
const { logActivity } = require('../services/activityLogService');
const { NEW_INQUIRY_CLIENT, NEW_INQUIRY_ADMIN } = require('../email/contactInquiry');
const { sendSuccess, sendCreated, sendPaginated, HTTP_STATUS } = require('../utils/responseHelper');
const AppError = require('../utils/appError');
const { catchAsync } = require('../middleware/errorHandler');

// ================================
// CONTACT INQUIRY CONTROLLERS
// ===============================

class InquiryController {
	// CREATE - Submit new inquiry
	static createInquiry = catchAsync(async (req, res) => {
		// support both old nested shape and the current flat schema
		const inquiryData = { name: req.body.name || req.body.client?.name, email: req.body.email || req.body.client?.email, phone: req.body.phone || req.body.client?.phone, company: req.body.company || req.body.client?.companyName, website: req.body.website || req.body.client?.websiteUrl, projectType: req.body.projectType || req.body.projectDetails?.servicesInterested?.[0], budget: req.body.budget || req.body.projectDetails?.budgetRange, timeline: req.body.timeline || req.body.projectDetails?.timelinePreference, description: req.body.description || req.body.message?.body, requirements: req.body.requirements || req.body.preferences?.requirements, attachments: req.body.attachments, preferredContactMethod: req.body.preferredContactMethod || req.body.preferences?.preferredContactMethod, source: req.body.source, referrer: req.body.referrer, ipAddress: req.ip, userAgent: req.headers['user-agent'] };

		const inquiry = new Inquiry(inquiryData);
		await inquiry.save();
		const d = inquiry.toAPIResponse();

		// reconstruct nested payload for existing email templates
		const emailPayload = { inquiry: d, client: d.client, projectDetails: d.projectDetails, message: d.message, preferences: d.preferences, admin: d.admin };

		await sendEmail(NEW_INQUIRY_CLIENT, emailPayload);
		await sendEmail(NEW_INQUIRY_ADMIN, { ...emailPayload, email: 'kishor81160@gmail.com' });

		return sendCreated(res, { data: inquiry.toAPIResponse(), message: 'Inquiry submitted successfully' });
	});

	// GET ALL - Dashboard listing with filters
	static getAllInquiries = catchAsync(async (req, res) => {
		const { page = 1, limit = 20, status, priority, search, service, assignedTo, sort = 'createdAt', order = 'desc' } = req.query;

		const query = { isDeleted: false };
		const options = { page: parseInt(page), limit: parseInt(limit), sort: { [sort]: order === 'desc' ? -1 : 1 } };

		// Build dynamic query
		if (status) query.status = status;
		if (priority) query.priority = priority;
		if (assignedTo) query.assignedTo = assignedTo;
		if (service) query.projectType = service;

		if (search) {
			query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }, { company: { $regex: search, $options: 'i' } }];
		}

		const inquiries = await Inquiry.paginate(query, options);

		return sendPaginated(res, { success: true, status: 200, data: { result: inquiries.docs.map((doc) => doc.toAPIResponse()), pagination: { page: inquiries.page, totalPages: inquiries.pages, total: inquiries.total, hasNext: inquiries.hasNext, hasPrev: inquiries.hasPrev, limit: inquiries.limit }, filters: { applied: 0, search: null } }, message: 'Inquiries retrieved successfully' });
	});

	// GET BY ID - Single inquiry details
	static getInquiryById = catchAsync(async (req, res) => {
		const inquiry = await Inquiry.findById(req.params.id);
		if (!inquiry) {
			throw AppError.notFound('Inquiry not found');
		}

		return sendSuccess(res, { data: inquiry.toObject({ virtuals: true }), message: 'Inquiry retrieved successfully' });
	});

	// UPDATE - Update inquiry status, notes, assignment
	static updateInquiry = catchAsync(async (req, res) => {
		const updates = {};

		if (req.body.status) updates.status = req.body.status;
		if (req.body.priority !== undefined) updates.priority = req.body.priority;
		if (req.body.internalNotes !== undefined) updates.internalNotes = req.body.internalNotes;
		if (req.body.assignedTo !== undefined) updates.assignedTo = req.body.assignedTo;

		const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });

		if (!inquiry) {
			throw AppError.notFound('Inquiry not found');
		}

		// Log activity
		await logActivity({ userId: req.user.id, action: 'UPDATE_INQUIRY', resourceId: req.params.id, details: updates });

		return sendSuccess(res, { data: inquiry.toAPIResponse(), message: 'Inquiry updated successfully' });
	});

	// BULK UPDATE - Update multiple inquiries
	static bulkUpdateInquiries = catchAsync(async (req, res) => {
		const { ids, status, priority, assignedTo } = req.body;

		if (!Array.isArray(ids) || ids.length === 0) {
			throw AppError.badRequest('Inquiry IDs array is required');
		}

		const updates = {};
		if (status !== undefined) updates.status = status;
		if (priority !== undefined) updates.priority = priority;
		if (assignedTo !== undefined) updates.assignedTo = assignedTo;

		const result = await Inquiry.bulkUpdateStatus(ids, updates);

		return sendSuccess(res, { data: result, message: `${result.modifiedCount} inquiries updated successfully` });
	});

	// SEARCH - Advanced search
	static searchInquiries = catchAsync(async (req, res) => {
		const result = await Inquiry.searchInquiries(req.query);

		return sendSuccess(res, { data: result.map((doc) => doc.toAPIResponse()), message: 'Search completed successfully', meta: { total: result.length } });
	});

	// DASHBOARD STATS - Analytics overview
	static getDashboardStats = catchAsync(async (req, res) => {
		const stats = await Inquiry.getDashboardStats();

		// Additional stats
		const highPriorityCount = await Inquiry.countDocuments({ priority: 'high', status: { $in: ['new', 'contacted'] } });

		return sendSuccess(res, { data: { stats, highPriorityCount, totalInquiries: await Inquiry.estimatedDocumentCount() }, message: 'Dashboard stats retrieved successfully' });
	});

	// HIGH PRIORITY - Get urgent inquiries
	static getHighPriority = catchAsync(async (req, res) => {
		const days = parseInt(req.query.days) || 7;
		const inquiries = await Inquiry.getHighPriority(days);

		return sendSuccess(res, { data: inquiries.map((doc) => doc.toAPIResponse()), message: 'High priority inquiries retrieved successfully', meta: { urgentCount: inquiries.length } });
	});

	// CONTACT CLIENT - Send response to client
	static contactClient = catchAsync(async (req, res) => {
		const inquiry = await Inquiry.findById(req.params.id);
		if (!inquiry) {
			throw AppError.notFound('Inquiry not found');
		}

		const { method = 'email', message } = req.body;

		let sent = false;
		if (method === 'email' && inquiry.email) {
			await sendEmail({ to: inquiry.email, subject: `Re: ${inquiry.description || ''}`, body: message });
			sent = true;
		}

		// Update status
		inquiry.status = 'Contacted';
		await inquiry.save();

		return sendSuccess(res, { data: { sent, inquiry: inquiry.toAPIResponse() }, message: `Client contacted via ${method}` });
	});

	// DELETE - Soft delete (archive)
	static archiveInquiry = catchAsync(async (req, res) => {
		const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, { status: 'closed', priority: 'low', deletedAt: new Date(), isDeleted: true }, { new: true });

		if (!inquiry) {
			throw AppError.notFound('Inquiry not found');
		}

		return sendSuccess(res, { message: 'Inquiry archived successfully' });
	});
}

module.exports = InquiryController;
