// services/socketService.js
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { jwtSecret } = require('../config/setting');

class SocketService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map(); // userId -> socketId mapping
        this.userRooms = new Map(); // userId -> rooms array
    }

    initialize(server) {
        this.io = socketIo(server, {
            cors: {
                origin: '*', // allow all origins
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        this.setupMiddleware();
        this.setupEventHandlers();
        //console.log('Socket.IO initialized successfully');
        return this.io;
    }

    setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

                if (!token) {
                    return next(new Error('Authentication token required'));
                }
                const decoded = jwt.verify(token, jwtSecret);
                const user = await User.findById(decoded.userId).select('_id username email role');
                if (!user) {
                    return next(new Error('User not found'));
                }
                socket.userId = user._id.toString();
                socket.user = user;
                next();
            } catch (error) {
                console.error('Socket authentication error:', error);
                next(new Error('Invalid authentication token'));
            }
        });
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            //console.log(`User connected: ${socket.user.username} (${socket.userId})`);
            // Store user connection
            this.connectedUsers.set(socket.userId, socket.id);

            // Join user to personal room
            socket.join(`user:${socket.userId}`);

            // Join role-based rooms
            if (socket.user.role) {
                socket.join(`role:${socket.user.role}`);
            }

            // Handle custom room joining
            socket.on('join_room', (roomName) => {
                socket.join(roomName);
                const userRooms = this.userRooms.get(socket.userId) || [];
                userRooms.push(roomName);
                this.userRooms.set(socket.userId, userRooms);
            });

            // Handle notification read status
            socket.on('mark_notification_read', async (notificationId) => {
                try {
                    await this.notificationService.markAsRead(notificationId, socket.userId);
                    socket.emit('notification_read_success', { notificationId });
                } catch (error) {
                    socket.emit('notification_read_error', { error: error.message });
                }
            });

            // Handle typing indicators
            socket.on('typing_start', (data) => {
                socket.to(data.room).emit('user_typing', {
                    userId: socket.userId,
                    username: socket.user.username
                });
            });

            socket.on('typing_stop', (data) => {
                socket.to(data.room).emit('user_stop_typing', {
                    userId: socket.userId
                });
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                //console.log(`User disconnected: ${socket.user.username} (${socket.userId})`);
                this.connectedUsers.delete(socket.userId);
                this.userRooms.delete(socket.userId);
            });
        });
    }

    // Send notification to specific user
    sendToUser(userId, event, data) {
        if (this.io) {
            this.io.to(`user:${userId}`).emit(event, data);
        }
    }

    // Send to multiple users
    sendToUsers(userIds, event, data) {
        if (this.io && Array.isArray(userIds)) {
            userIds.forEach(userId => {
                this.io.to(`user:${userId}`).emit(event, data);
            });
        }
    }

    // Send to role-based room
    sendToRole(role, event, data) {
        if (this.io) {
            this.io.to(`role:${role}`).emit(event, data);
        }
    }

    // Broadcast to all connected users
    broadcast(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }

    // Get online users count
    getOnlineUsersCount() {
        return this.connectedUsers.size;
    }

    // Check if user is online
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }

    // Get connected users list
    getConnectedUsers() {
        return Array.from(this.connectedUsers.keys());
    }
}

module.exports = new SocketService();
