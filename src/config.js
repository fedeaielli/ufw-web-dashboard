/**
 * Application configuration from environment variables
 */

const config = {
    // Server
    port: process.env.PORT || 3300,
    host: process.env.HOST || '127.0.0.1',
    env: process.env.NODE_ENV || 'production',
    
    // Authentication
    auth: {
        user: process.env.F_USER,
        pass: process.env.F_PASS,
        maxFailedAttempts: parseInt(process.env.AUTH_MAX_FAILED_ATTEMPTS || '5', 10),
        blockDuration: parseInt(process.env.AUTH_BLOCK_DURATION || '900000', 10) // 15 minutes
    },
    
    // Logs
    logs: {
        maxLines: parseInt(process.env.LOG_MAX_LINES || '10000', 10),
        defaultLines: parseInt(process.env.LOG_DEFAULT_LINES || '1000', 10),
        cacheTtl: parseInt(process.env.LOG_CACHE_TTL || '5000', 10), // 5 seconds
        maxCacheSize: parseInt(process.env.LOG_MAX_CACHE_SIZE || '10', 10)
    },
    
    // Rate Limiting
    rateLimit: {
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        cleanupInterval: parseInt(process.env.RATE_LIMIT_CLEANUP_INTERVAL || '300000', 10) // 5 minutes
    },
    
    // CSRF
    csrf: {
        tokenExpiry: parseInt(process.env.CSRF_TOKEN_EXPIRY || '3600000', 10), // 1 hour
        cleanupInterval: parseInt(process.env.CSRF_CLEANUP_INTERVAL || '1800000', 10) // 30 minutes
    },
    
    // Security
    security: {
        minPasswordLength: parseInt(process.env.MIN_PASSWORD_LENGTH || '12', 10),
        minUsernameLength: parseInt(process.env.MIN_USERNAME_LENGTH || '4', 10)
    }
};

export default config;
