const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    user_id: { type: mongoose.Schema.Types.ObjectId, default: null, ref: 'User' },
    user_fullname: { type: String, default: 'Unknown' },
    user_metadata: { type: Object, default: null },
    action: { type: String, required: true },
    operation: { type: String, enum: ['create', 'update', 'delete', 'read'], required: true },
    method: { type: String, required: true },
    endpoint: { type: String, required: true },
    query_params: { type: Object, default: {} },
    request_headers: { type: Object, default: {} },
    request_body: { type: Object, default: null },
    ip_address: { type: String, default: null },
    response_status: { type: Number, default: null },
    response_headers: { type: Object, default: {} },
    response_body: { type: Object, default: null },
    user_agent: { type: String, default: null },
     isDeleted: { type: Boolean, default: true },
    device_metadata: { type: Object, default: {} },
    location: { type: Object, default: {} },
    process_time_ms: { type: Number, default: null },
}, { collection: 'log_entries' });

// Indexes for efficient querying
logSchema.index({ user_id: 1 });
logSchema.index({ user_fullname: 1 });
logSchema.index({ operation: 1 });
logSchema.index({ timestamp: -1 });
logSchema.index({ endpoint: 1 });
logSchema.index({ response_status: 1 });
logSchema.index({ 'user_id': 1, 'endpoint': 1 }); // Compound index for user + table
logSchema.index({ 'timestamp': -1, 'operation': 1 }); // For daily activity

// Static methods for common queries
logSchema.statics = {
    // Existing methods...
    findByUserId: async function (userId, limit = 10) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid user_id format');
        }
        return this.find({ user_id: userId })
            .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    },

    findByUserFullname: async function (fullname, limit = 10) {
        return this.find({ user_fullname: fullname })
            .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    },

    findByOperation: async function (operation, limit = 10) {
        if (!['create', 'update', 'delete', 'read'].includes(operation)) {
            throw new Error('Invalid operation');
        }
        return this.find({ operation })
            .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    },

    findByDateRange: async function (startDate, endDate, limit = 10) {
        return this.find({
            timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
        })
            .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    },

    getOperationStats: async function () {
        return this.aggregate([
            { $group: { _id: '$operation', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
    },

    getUserActivityStats: async function () {
        return this.aggregate([
            { $group: { _id: { user_id: '$user_id', user_fullname: '$user_fullname' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
    },

    // New static methods for detailed logs
    findByTable: async function (table, limit = 10) {
        const endpoints = tableEndpointMap[table] || [];
        if (endpoints.length === 0) {
            throw new Error(`Invalid table: ${table}`);
        }
        return this.find({ endpoint: { $regex: `^(${endpoints.join('|')})` } })
            .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    },

    findByUserAndTable: async function (userId, table, limit = 10) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid user_id format');
        }
        const endpoints = tableEndpointMap[table] || [];
        if (endpoints.length === 0) {
            throw new Error(`Invalid table: ${table}`);
        }
        return this.find({ 
            user_id: userId, 
            endpoint: { $regex: `^(${endpoints.join('|')})` } 
        })
            .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    },

    findFailedRequests: async function (limit = 10) {
        return this.find({ response_status: { $gte: 400 } })
            .select('timestamp user_id user_fullname user_metadata action operation endpoint method response_status')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    },

    getDailyActivity: async function (days = 7) {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
        return this.aggregate([
            {
                $match: { timestamp: { $gte: startDate, $lte: endDate } }
            },
            {
                $group: {
                    _id: {
                        day: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                        operation: '$operation'
                    },
                    count: { $sum: 1 },
                    users: { $addToSet: '$user_fullname' }
                }
            },
            { $sort: { '_id.day': -1 } }
        ]);
    },

    getTopEndpoints: async function (limit = 10) {
        return this.aggregate([
            { $group: { _id: '$endpoint', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: limit }
        ]);
    },

    getTableStats: async function () {
        return this.aggregate([
            {
                $addFields: {
                    table: {
                        $let: {
                            vars: {
                                path: {
                                    $regexFind: {
                                        input: '$endpoint',
                                        regex: '^/([a-zA-Z]+)'
                                    }
                                }
                            },
                            in: { $ifNull: ['$$path.captures.0', 'unknown'] }
                        }
                    }
                }
            },
            { $group: { _id: '$table', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
    }
};

// Instance methods for log manipulation
logSchema.methods = {
    // Existing methods...
    toSummary: function (table, record_id) {
        const tableName = table || this.endpoint.split('/')[1] || 'unknown';
        const recordText = record_id ? ` with ID ${record_id}` : '';
        return `${this.user_fullname} performed ${this.operation} on ${tableName}${recordText}`;
    },

    updateMetadata: async function (newMetadata) {
        this.user_metadata = { ...this.user_metadata, ...newMetadata };
        await this.save();
        return this;
    },

    isFailedRequest: function () {
        return this.response_status >= 400;
    },

    // New instance methods for detailed logs
    getTableFromEndpoint: function () {
        const match = this.endpoint.match(/^\/([a-zA-Z]+)/);
        return match ? match[1] : 'unknown';
    },

    getRecordIdFromEndpoint: function () {
        const match = this.endpoint.match(/\/([a-f0-9]{24})$/);
        return match ? match[1] : null;
    },

    formatFullLog: function () {
        return {
            summary: this.toSummary(),
            details: {
                timestamp: this.timestamp,
                user: this.user_fullname,
                operation: this.operation,
                endpoint: this.endpoint,
                method: this.method,
                status: this.response_status,
                ip: this.ip_address,
                device: this.device_metadata,
                location: this.location,
                process_time: `${this.process_time_ms}ms`
            },
            failed: this.isFailedRequest()
        };
    }
};

const tableEndpointMap = {
    users: ['/users', '/user'],
    products: ['/products', '/product'],
    orders: ['/orders', '/order']
    // Add more tables as needed
};

module.exports = mongoose.model('Log', logSchema);