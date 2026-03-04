/**
 * Redis Cache Configuration
 * Production-ready Redis client with error handling and reconnection logic
 */

const redis = require('redis');

let cacheClient = null;
let isConnected = false;

/**
 * Initialize Redis client with proper configuration
 */
const initializeCache = async () => {
    try {
        // Skip Redis if not enabled
        if (!process.env.REDIS_ENABLED || process.env.REDIS_ENABLED === 'false') {
            console.warn('⚠️ Redis disabled (REDIS_ENABLED not set). Caching disabled.');
            return null;
        }

        // Skip Redis if not configured
        if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
            console.warn('⚠️ Redis not configured. Caching disabled.');
            return null;
        }

        const redisConfig = {
            url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        console.error('❌ Redis: Max reconnection attempts reached');
                        return new Error('Max reconnection attempts reached');
                    }
                    const delay = Math.min(retries * 50, 3000);
                    console.log(`⏳ Redis: Reconnecting in ${delay}ms (attempt ${retries})`);
                    return delay;
                },
                connectTimeout: 10000,
            },
        };

        // Add password if provided
        if (process.env.REDIS_PASSWORD) {
            redisConfig.password = process.env.REDIS_PASSWORD;
        }

        cacheClient = redis.createClient(redisConfig);

        // Event handlers
        cacheClient.on('error', (err) => {
            isConnected = false;
            console.error('🚨 Redis error:', err.message);
        });

        cacheClient.on('connect', () => {
            console.log('🔌 Redis: Connecting...');
        });

        cacheClient.on('ready', () => {
            isConnected = true;
            console.log('✅ Redis: Connected and ready');
        });

        cacheClient.on('reconnecting', () => {
            console.log('🔄 Redis: Reconnecting...');
        });

        cacheClient.on('end', () => {
            isConnected = false;
            console.log('⚠️ Redis: Connection closed');
        });

        await cacheClient.connect();
        return cacheClient;
    } catch (error) {
        console.error('❌ Redis initialization failed:', error.message);
        console.warn('⚠️ Running without cache');
        return null;
    }
};

/**
 * Get cache client (returns null if not connected)
 */
const getCache = () => {
    return isConnected ? cacheClient : null;
};

/**
 * Check if cache is available
 */
const isCacheAvailable = () => {
    return isConnected && cacheClient !== null;
};

/**
 * Gracefully close cache connection
 */
const closeCache = async () => {
    if (cacheClient) {
        try {
            await cacheClient.quit();
            console.log('✅ Redis: Connection closed gracefully');
        } catch (error) {
            console.error('❌ Redis: Error closing connection:', error.message);
        }
    }
};

/**
 * Cache middleware - caches GET requests
 */
const cacheMiddleware = (duration = 300) => {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET' || !isCacheAvailable()) {
            return next();
        }

        const key = `cache:${req.originalUrl || req.url}`;

        try {
            const cachedResponse = await cacheClient.get(key);

            if (cachedResponse) {
                res.set('X-Cache', 'HIT');
                return res.json(JSON.parse(cachedResponse));
            }

            // Store original res.json
            const originalJson = res.json.bind(res);

            // Override res.json to cache the response
            res.json = function (data) {
                res.set('X-Cache', 'MISS');

                // Cache the response asynchronously
                cacheClient.setEx(key, duration, JSON.stringify(data))
                    .catch(err => console.error('Cache set error:', err));

                return originalJson(data);
            };

            next();
        } catch (error) {
            console.error('Cache middleware error:', error);
            next();
        }
    };
};

module.exports = {
    initializeCache,
    getCache,
    isCacheAvailable,
    closeCache,
    cacheMiddleware,
    // Legacy exports for backward compatibility
    cacheClient: () => getCache(),
};