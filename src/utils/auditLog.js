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

/**
 * Audit middleware wrapper for route handlers
 * @param {string} action - Action name
 * @returns {Function} Middleware function
 */
export const auditAction = (action) => {
    return (req, res, next) => {
        // Store original json method
        const originalJson = res.json.bind(res);
        
        // Override json method to log after response
        res.json = function(data) {
            const success = res.statusCode >= 200 && res.statusCode < 300;
            logAudit(action, req, { 
                method: req.method,
                path: req.path,
                statusCode: res.statusCode
            }, success);
            
            return originalJson(data);
        };
        
        next();
    };
};
