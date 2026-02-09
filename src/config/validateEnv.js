/**
 * Environment Variable Validation
 * Validates required environment variables on startup
 */

const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'SESSION_SECRET',
    'JWT_SECRET',
];

const optionalEnvVars = {
    'REDIS_URL': 'Redis caching will be disabled',
    'SMTP_HOST': 'Email functionality may be limited',
    'SMTP_USER': 'Email functionality may be limited',
};

/**
 * Validate environment variables
 * Throws error if required variables are missing
 * Warns about missing optional variables
 */
const validateEnv = () => {
    const missing = [];
    const warnings = [];

    // Check required variables
    for (const varName of requiredEnvVars) {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    }

    // Check optional variables
    for (const [varName, warning] of Object.entries(optionalEnvVars)) {
        if (!process.env[varName]) {
            warnings.push(`⚠️ ${varName} not set - ${warning}`);
        }
    }

    // Report warnings
    if (warnings.length > 0) {
        console.warn('\n⚠️ Optional environment variables missing:');
        warnings.forEach(w => console.warn(w));
        console.warn('');
    }

    // Throw error if required variables are missing
    if (missing.length > 0) {
        const error = new Error(
            `Missing required environment variables:\n${missing.map(v => ` - ${v}`).join('\n')}\n\nPlease check your .env file.`
        );
        error.name = 'EnvironmentValidationError';
        throw error;
    }

    // Validate formats
    const portNum = parseInt(process.env.PORT, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        throw new Error('PORT must be a valid number between 1 and 65535');
    }

    if (!process.env.MONGODB_URI.startsWith('mongodb')) {
        throw new Error('MONGODB_URI must start with "mongodb://" or "mongodb+srv://"');
    }

    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
        console.warn('⚠️ SESSION_SECRET should be at least 32 characters for security');
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.warn('⚠️ JWT_SECRET should be at least 32 characters for security');
    }

    console.log('✅ Environment variables validated');
};

module.exports = validateEnv;
