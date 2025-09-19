const Notification = require('../models/notification');
const { Types } = require('mongoose');

module.exports = (io) => {
  const nsp = io.of('/notifications');

  nsp.on('connection', (socket) => {
    // Join user room
    socket.on('join', ({ userId, roles }) => {
      if (userId) socket.join(`user_${userId}`);
      if (Array.isArray(roles)) {
        roles.forEach(r => socket.join(`role_${r}`));
      }
    });

    // Get inbox for user
    socket.on('get_notifications', async (opts) => {
      try {
        const { userId, page, limit } = opts;
        const notifications = await Notification.findForUser(userId, { page, limit });
        socket.emit('notifications_list', notifications.map(n => n.getSummaryForUser(userId)));
      } catch (e) {
        socket.emit('error', e.message);
      }
    });

    // Get unread count
    socket.on('get_unread_count', async (userId) => {
      try {
        const count = await Notification.getUnreadCount(userId);
        socket.emit('unread_count', count);
      } catch (e) {
        socket.emit('error', e.message);
      }
    });

    // Mark as read
    socket.on('mark_as_read', async ({ notificationId, userId }) => {
      try {
        const notification = await Notification.findById(notificationId);
        await notification.markAsRead(userId, {
          deviceType: opts.deviceType,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent']
        });
        socket.emit('notification_read', { notificationId });
        const count = await Notification.getUnreadCount(userId);
        socket.emit('unread_count', count);
      } catch (e) {
        socket.emit('error', e.message);
      }
    });

    // Track click
    socket.on('track_click', async (data) => {
      try {
        const { notificationId, userId, actionIndex } = data;
        const n = await Notification.findById(notificationId);
        await n.trackClick(userId, actionIndex, { source: 'socket' });
        socket.emit('click_tracked', { notificationId });
      } catch (e) {
        socket.emit('error', e.message);
      }
    });

    // Track conversion
    socket.on('track_conversion', async (data) => {
      try {
        const { notificationId, userId } = data;
        const n = await Notification.findById(notificationId);
        await n.trackConversion(userId);
        socket.emit('conversion_tracked', { notificationId });
      } catch (e) {
        socket.emit('error', e.message);
      }
    });

    // Add recipients
    socket.on('add_recipients', async ({ notificationId, newRecipients }) => {
      try {
        const n = await Notification.findById(notificationId);
        await n.addRecipients(newRecipients.map(r => ({ userId: Types.ObjectId(r.userId), userRole: r.userRole })));
        socket.emit('recipients_added', { notificationId });
      } catch (e) {
        socket.emit('error', e.message);
      }
    });

    // Disconnect
    socket.on('disconnect', () => { /* cleanup if needed */ });
  });

  return nsp;
};
