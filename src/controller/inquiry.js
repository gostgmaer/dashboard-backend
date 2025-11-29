const ContactInquiry = require('../models/Inquiry');
const { sendEmail } = require('../email');
// const { sendSMS } = require('../services/smsService');
const { logActivity } = require('../services/activityLogService');
const { NEW_INQUIRY_CLIENT, NEW_INQUIRY_ADMIN } = require('../email/contactInquiry');

// ================================
// CONTACT INQUIRY CONTROLLERS
// ===============================

class ContactInquiryController {
  // CREATE - Submit new inquiry
  static async createInquiry(req, res) {
    try {
      const inquiryData = {
        client: {
          name: req.body.client?.name,
          email: req.body.client?.email,
          phone: req.body.client?.phone,
          companyName: req.body.client?.companyName,
          websiteUrl: req.body.client?.websiteUrl,
          socialHandle: req.body.client?.socialHandle,
        },
        projectDetails: req.body.projectDetails,
        message: {
          subject: req.body.message?.subject || 'New Inquiry',
          body: req.body.message?.body,
        },
        preferences: req.body.preferences,
      };

      const inquiry = new ContactInquiry(inquiryData);
      await inquiry.save();

      // Send notification email to admin
      // await sendEmail(NEW_INQUIRY_ADMIN, {
      //   to: process.env.ADMIN_EMAIL,
      //   subject: `New High Priority Inquiry: ${inquiry.client.fullIdentifier}`,
      //   template: 'new-inquiry',
      //   ...inquiry.toAPIResponse(),
      // });
      const d = inquiry.toAPIResponse();
      await sendEmail(NEW_INQUIRY_CLIENT, { ...d.client, ...d.message, ...d.projectDetails, ...d, inquiry: inquiry.toAPIResponse() });

      res.status(201).json({
        success: true,
        message: 'Inquiry submitted successfully',
        data: inquiry.toAPIResponse(),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        errors: error.errors || {},
      });
    }
  }

  // GET ALL - Dashboard listing with filters
  static async getAllInquiries(req, res) {
    try {
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
        query.$or = [{ 'client.name': { $regex: search, $options: 'i' } }, { 'client.email': { $regex: search, $options: 'i' } }, { 'message.body': { $regex: search, $options: 'i' } }];
      }

      const inquiries = await ContactInquiry.paginate(query, options);

      res.json({
        success: true,
        data: inquiries.docs.map((doc) => doc.toAPIResponse()),
        pagination: {
          total: inquiries.total,
          pages: inquiries.pages,
          page: inquiries.page,
          limit: inquiries.limit,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch inquiries',
      });
    }
  }

  // GET BY ID - Single inquiry details
  static async getInquiryById(req, res) {
    try {
      const inquiry = await ContactInquiry.findById(req.params.id);
      if (!inquiry) {
        return res.status(404).json({
          success: false,
          message: 'Inquiry not found',
        });
      }
      res.json({
        success: true,
        data: inquiry.toObject({ virtuals: true }),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch inquiry',
      });
    }
  }

  // UPDATE - Update inquiry status, notes, assignment
  static async updateInquiry(req, res) {
    try {
      const updates = {};

      if (req.body.status) updates.status = req.body.status;
      if (req.body.priority !== undefined) updates['admin.priority'] = req.body.priority;
      if (req.body.internalNotes !== undefined) updates['admin.internalNotes'] = req.body.internalNotes;
      if (req.body.assignedTo !== undefined) updates['admin.assignedTo'] = req.body.assignedTo;

      const inquiry = await ContactInquiry.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });

      if (!inquiry) {
        return res.status(404).json({
          success: false,
          message: 'Inquiry not found',
        });
      }

      // Log activity
      await logActivity({
        userId: req.user.id,
        action: 'UPDATE_INQUIRY',
        resourceId: req.params.id,
        details: updates,
      });

      res.json({
        success: true,
        message: 'Inquiry updated successfully',
        data: inquiry.toAPIResponse(),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        errors: error.errors || {},
      });
    }
  }

  // BULK UPDATE - Update multiple inquiries
  static async bulkUpdateInquiries(req, res) {
    try {
      const { ids, status, priority, assignedTo } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Inquiry IDs array is required',
        });
      }

      const updates = { status };
      if (priority) updates['admin.priority'] = priority;
      if (assignedTo) updates['admin.assignedTo'] = assignedTo;

      const result = await ContactInquiry.bulkUpdateStatus(ids, updates);

      res.json({
        success: true,
        message: `${result.modifiedCount} inquiries updated successfully`,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Bulk update failed',
      });
    }
  }

  // SEARCH - Advanced search
  static async searchInquiries(req, res) {
    try {
      const result = await ContactInquiry.searchInquiries(req.query);

      res.json({
        success: true,
        data: result.map((doc) => doc.toAPIResponse()),
        total: result.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Search failed',
      });
    }
  }

  // DASHBOARD STATS - Analytics overview
  static async getDashboardStats(req, res) {
    try {
      const stats = await ContactInquiry.getDashboardStats();

      // Additional stats
      const highPriorityCount = await ContactInquiry.countDocuments({
        'admin.priority': 'High',
        status: { $in: ['New', 'Contacted'] },
      });

      res.json({
        success: true,
        data: {
          stats,
          highPriorityCount,
          totalInquiries: await ContactInquiry.estimatedDocumentCount(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard stats',
      });
    }
  }

  // HIGH PRIORITY - Get urgent inquiries
  static async getHighPriority(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const inquiries = await ContactInquiry.getHighPriority(days);

      res.json({
        success: true,
        data: inquiries.map((doc) => doc.toAPIResponse()),
        urgentCount: inquiries.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch high priority inquiries',
      });
    }
  }

  // CONTACT CLIENT - Send response to client
  static async contactClient(req, res) {
    try {
      const inquiry = await ContactInquiry.findById(req.params.id);
      if (!inquiry) {
        return res.status(404).json({ success: false, message: 'Inquiry not found' });
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

      //   if (method === 'sms' && inquiry.client.phone) {
      //     await sendSMS(inquiry.client.phone, message);
      //     sent = true;
      //   }

      // Update status
      inquiry.status = 'Contacted';
      await inquiry.save();

      res.json({
        success: true,
        message: `Client contacted via ${method}`,
        data: { sent, inquiry: inquiry.toAPIResponse() },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to contact client',
      });
    }
  }

  // DELETE - Soft delete (archive)
  static async archiveInquiry(req, res) {
    try {
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
        return res.status(404).json({
          success: false,
          message: 'Inquiry not found',
        });
      }

      res.json({
        success: true,
        message: 'Inquiry archived successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to archive inquiry',
      });
    }
  }
}

module.exports = ContactInquiryController;
