/**
 * Compression Middleware
 * Compresses HTTP responses using gzip to reduce bandwidth and improve load times
 */

const compression = require('compression');

/**
 * Configure compression middleware
 * - Compresses responses larger than 1KB
 * - Skips already compressed content types
 * - Uses gzip level 6 for balanced speed/compression
 */
const compressionMiddleware = compression({
    // Only compress responses larger than 1KB
    threshold: 1024,

    // Compression level (0-9, where 6 is default balanced)
    level: 6,

    // Filter function to decide what to compress
    filter: (req, res) => {
        // Don't compress if client doesn't accept encoding
        if (req.headers['x-no-compression']) {
            return false;
        }

        // Skip already compressed content types
        const contentType = res.getHeader('Content-Type');
        if (!contentType) {
            return true;
        }

        const skipTypes = [
            'image/', // Images are usually already compressed
            'video/', // Videos are already compressed
            'audio/', // Audio files are already compressed
            'application/zip',
            'application/gzip',
            'application/x-gzip',
        ];

        if (skipTypes.some(type => contentType.toLowerCase().includes(type))) {
            return false;
        }

        // Use compression default filter
        return compression.filter(req, res);
    },

    // Memory level (1-9, where 8 is default)
    memLevel: 8,
});

module.exports = compressionMiddleware;
