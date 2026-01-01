/**
 * Client information extraction utilities
 * Centralized logic for getting client IP, fingerprint, etc.
 */

import { createHash } from 'crypto';

/**
 * Extract client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
export const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
        || req.headers['x-real-ip'] 
        || req.socket.remoteAddress?.replace('::ffff:', '')
        || 'unknown';
};

/**
 * Get client fingerprint for token binding
 * Combines IP + User-Agent for better security
 * @param {Object} req - Express request object
 * @returns {string} SHA-256 hash of client fingerprint
 */
export const getClientFingerprint = (req) => {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    
    return createHash('sha256')
        .update(ip + userAgent)
        .digest('hex');
};

/**
 * Get complete client information
 * @param {Object} req - Express request object
 * @returns {Object} Client info object
 */
export const getClientInfo = (req) => {
    return {
        ip: getClientIp(req),
        userAgent: req.headers['user-agent'] || 'unknown'
    };
};
