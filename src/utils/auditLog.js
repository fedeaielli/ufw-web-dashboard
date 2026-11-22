/**
 * Audit logging for sensitive operations
 */

import logger from './logger.js';
import { getClientInfo } from './clientInfo.js';

/**
 * Log an audit event
 * @param {string} action - Action performed
 * @param {Object} req - Express request object
 * @param {Object} details - Additional details
 * @param {boolean} success - Whether the action succeeded
 */
export const logAudit = (action, req, details = {}, success = true) => {
    const { ip, userAgent } = getClientInfo(req);
    
    const logEntry = {
        action,
        ip,
        userAgent,
        success,
        ...details
    };
    
    logger.audit(action, success, logEntry);
    
    return logEntry;
};
