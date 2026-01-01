/**
 * Structured logging utility
 */

import config from '../config.js';

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const isDevelopment = config.env === 'development';

/**
 * Format log message with timestamp and level
 * @param {string} level
 * @param {string} message
 * @param {Object} meta
 * @returns {string}
 */
const formatLog = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
};

/**
 * Logger class
 */
class Logger {
    /**
     * Log error message
     * @param {string} message
     * @param {Object} meta
     */
    error(message, meta = {}) {
        console.error(formatLog('ERROR', message, meta));
    }

    /**
     * Log warning message
     * @param {string} message
     * @param {Object} meta
     */
    warn(message, meta = {}) {
        console.warn(formatLog('WARN', message, meta));
    }

    /**
     * Log info message
     * @param {string} message
     * @param {Object} meta
     */
    info(message, meta = {}) {
        console.log(formatLog('INFO', message, meta));
    }

    /**
     * Log debug message (only in development)
     * @param {string} message
     * @param {Object} meta
     */
    debug(message, meta = {}) {
        if (isDevelopment) {
            console.log(formatLog('DEBUG', message, meta));
        }
    }

    /**
     * Log audit event with emoji
     * @param {string} action
     * @param {boolean} success
     * @param {Object} meta
     */
    audit(action, success, meta = {}) {
        const emoji = success ? '✅' : '❌';
        const message = `${emoji} [AUDIT] ${action}`;
        console.log(formatLog('AUDIT', message, meta));
    }

    /**
     * Log security event
     * @param {string} message
     * @param {Object} meta
     */
    security(message, meta = {}) {
        console.warn(formatLog('SECURITY', `⚠️  ${message}`, meta));
    }
}

export default new Logger();
