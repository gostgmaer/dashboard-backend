const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Log = require('../models/logs');
const { getLocation } = require('../middleware/loggerMiddleware');

// Map endpoints to table names (moved to model, but referenced here for routes)
const tableEndpointMap = {
    users: ['/users', '/user'],
    products: ['/products', '/product'],
    orders: ['/orders', '/order'],
    // Add more tables as needed, e.g., carts: ['/carts', '/cart']
};

// POST /logs - Create a custom log entry
router.post('/', async (req, res) => {
    try {
        const { action, operation, user_id, user_fullname, user_metadata } = req.body;

        // Validate required fields
        if (!action || !operation) {
            return res.status(400).json({ error: 'Action and operation are required' });
        }
        if (!['create', 'update', 'delete', 'read'].includes(operation)) {
            return res.status(400).json({ error: 'Operation must be create, update, delete, or read' });
        }

        // Extract metadata from request
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgentStr = req.headers['user-agent'];
        const deviceMetadata = require('ua-parser-js')(userAgentStr);
        const location = await getLocation(ipAddress);

        // User metadata (merge provided data with JWT/database)
        let finalUserId = user_id;
        let finalUserFullname = user_fullname || 'Unknown';
        let finalUserMetadata = user_metadata || {};
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'your-secret-key');
                const user = await mongoose.model('User').findOne({ email: decoded.email }).lean();
                if (user) {
                    finalUserId = finalUserId || user._id;
                    finalUserFullname = finalUserFullname !== 'Unknown' ? finalUserFullname : user.fullname || 'Unknown';
                    finalUserMetadata = { ...finalUserMetadata, email: user.email, role: user.role || 'user', fullname: finalUserFullname };
                }
            } catch (err) {
                console.error('JWT decode or user fetch error:', err.message);
            }
        }

        // Validate user_id if provided
        if (finalUserId && !mongoose.Types.ObjectId.isValid(finalUserId)) {
            return res.status(400).json({ error: 'Invalid user_id format' });
        }

        // Create log entry
        const logEntry = new Log({
            user_id: finalUserId,
            user_fullname: finalUserFullname,
            user_metadata: finalUserMetadata,
            action,
            operation,
            method: 'POST',
            endpoint: '/log',
            query_params: req.query,
            request_headers: req.headers,
            request_body: req.body,
            ip_address: ipAddress,
            response_status: 200,
            response_headers: { 'content-type': 'application/json' },
            response_body: { message: 'Log created successfully' },
            user_agent: userAgentStr,
            device_metadata: {
                browser: deviceMetadata.browser.name || 'Unknown',
                os: deviceMetadata.os.name || 'Unknown',
                is_mobile: deviceMetadata.device.type === 'mobile' || deviceMetadata.os.name.includes('Android') || deviceMetadata.os.name.includes('iOS'),
            },
            location,
            process_time_ms: 0,
        });

        await logEntry.save();
        res.status(200).json({ message: 'Log created successfully' });
    } catch (err) {
        console.error('Error creating log:', err);
        res.status(500).json({ error: 'Failed to create log' });
    }
});

// GET /logs - Query logs for "who did what"
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const userId = req.query.user_id;
        const userFullname = req.query.user_fullname;
        const operation = req.query.operation;
        const startDate = req.query.start_date;
        const endDate = req.query.end_date;

        const query = {};
        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: 'Invalid user_id format' });
            }
            query.user_id = userId;
        }
        if (userFullname) query.user_fullname = userFullname;
        if (operation) query.operation = operation;
        if (startDate && endDate) {
            query.timestamp = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const logs = await Log
            .find(query)
            .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        // Add log_message to each log
        const logsWithMessage = logs.map(log => ({
            ...log,
            log_message: new Log(log).toSummary(log.endpoint.split('/')[1], log.endpoint.includes('/') ? log.endpoint.split('/').pop() : null)
        }));

        res.json(logsWithMessage);
    } catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// GET /logs/stats/operations - Get operation statistics
router.get('/stats/operations', async (req, res) => {
    try {
        const stats = await Log.getOperationStats();
        res.json(stats);
    } catch (err) {
        console.error('Error fetching operation stats:', err);
        res.status(500).json({ error: 'Failed to fetch operation stats' });
    }
});

// GET /logs/stats/users - Get user activity statistics
router.get('/stats/users', async (req, res) => {
    try {
        const stats = await Log.getUserActivityStats();
        res.json(stats);
    } catch (err) {
        console.error('Error fetching user activity stats:', err);
        res.status(500).json({ error: 'Failed to fetch user activity stats' });
    }
});

// GET /logs/stats/tables - Get table activity statistics (new route using getTableStats)
router.get('/stats/tables', async (req, res) => {
    try {
        const stats = await Log.getTableStats();
        res.json(stats);
    } catch (err) {
        console.error('Error fetching table stats:', err);
        res.status(500).json({ error: 'Failed to fetch table stats' });
    }
});

// GET /logs/stats/daily - Get daily activity statistics (new route using getDailyActivity)
router.get('/stats/daily', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = await Log.getDailyActivity(days);
        res.json(stats);
    } catch (err) {
        console.error('Error fetching daily stats:', err);
        res.status(500).json({ error: 'Failed to fetch daily stats' });
    }
});

// GET /logs/stats/top-endpoints - Get top endpoints (new route using getTopEndpoints)
router.get('/stats/top-endpoints', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const stats = await Log.getTopEndpoints(limit);
        res.json(stats);
    } catch (err) {
        console.error('Error fetching top endpoints:', err);
        res.status(500).json({ error: 'Failed to fetch top endpoints' });
    }
});

// GET /logs/activity/:table/:record_id? - Get activity logs for a table or specific record
// router.get('/activity/:table/:record_id?', async (req, res) => {
//     try {
//         const { table, record_id } = req.params;
//         const { limit = 10, start_date, end_date } = req.query;

//         // Validate table
//         const validTables = Object.keys(tableEndpointMap);
//         if (!validTables.includes(table)) {
//             return res.status(400).json({ error: `Invalid table. Supported tables: ${validTables.join(', ')}` });
//         }

//         // Use new static method for table logs
//         let logs;
//         if (record_id) {
//             if (!mongoose.Types.ObjectId.isValid(record_id)) {
//                 return res.status(400).json({ error: 'Invalid record_id format' });
//             }
//             logs = await Log.findByUserAndTable(record_id, table, parseInt(limit));
//         } else {
//             logs = await Log.findByTable(table, parseInt(limit));
//         }

//         // Filter by date range if provided
//         if (start_date && end_date) {
//             logs = logs.filter(log => 
//                 new Date(log.timestamp) >= new Date(start_date) && 
//                 new Date(log.timestamp) <= new Date(end_date)
//             );
//         }

//         // Add log_message to each log
//         const logsWithMessage = logs.map(log => ({
//             ...log,
//             log_message: new Log(log).toSummary(table, record_id)
//         }));

//         res.json(logsWithMessage);
//     } catch (err) {
//         console.error('Error fetching activity logs:', err);
//         res.status(500).json({ error: 'Failed to fetch activity logs' });
//     }
// });

// GET /logs/failed - Get failed requests (new route using findFailedRequests)
router.get('/failed', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const logs = await Log.findFailedRequests(limit);

        // Add log_message to each log
        const logsWithMessage = logs.map(log => ({
            ...log,
            log_message: new Log(log).toSummary(log.endpoint.split('/')[1], log.endpoint.includes('/') ? log.endpoint.split('/').pop() : null)
        }));

        res.json(logsWithMessage);
    } catch (err) {
        console.error('Error fetching failed requests:', err);
        res.status(500).json({ error: 'Failed to fetch failed requests' });
    }
});

module.exports = {logRoutes:router};