/**
 * Rate limiting middleware
 */

import config from '../config.js';
import logger from '../utils/logger.js';
import { getClientIp } from '../utils/clientInfo.js';

const requestCounts = new Map();
const failedAuthAttempts = new Map();

/**
 * Clean up old entries periodically
 */
setInterval(() => {
    const now = Date.now();
    const cleanupThreshold = 60 * 60 * 1000; // 1 hour
    
    for (const [key, data] of requestCounts.entries()) {
        if (now - data.firstRequest > cleanupThreshold) {
            requestCounts.delete(key);
        }
    }
    
    for (const [key, data] of failedAuthAttempts.entries()) {
        if (now - data.firstAttempt > cleanupThreshold) {
            failedAuthAttempts.delete(key);
        }
    }
}, config.rateLimit.cleanupInterval);

/**
 * General rate limiter
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Express middleware
 */
export const rateLimiter = (maxRequests = config.rateLimit.maxRequests, windowMs = config.rateLimit.windowMs) => {
    return (req, res, next) => {
        const clientId = getClientIp(req);
        const now = Date.now();
        
        if (!requestCounts.has(clientId)) {
            requestCounts.set(clientId, {
                count: 1,
                firstRequest: now
            });
            return next();
        }
        
        const data = requestCounts.get(clientId);
        
        // Reset if window expired
        if (now - data.firstRequest > windowMs) {
            data.count = 1;
            data.firstRequest = now;
            return next();
        }
        
        // Increment counter
        data.count++;
        
        // Check if limit exceeded
        if (data.count > maxRequests) {
            const retryAfter = Math.ceil((windowMs - (now - data.firstRequest)) / 1000);
            logger.security('Rate limit exceeded', { ip: clientId, path: req.path });
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({ 
                error: 'Too many requests, please try again later.',
                retryAfter 
            });
        }
        
        next();
    };
};

/**
 * Track failed authentication attempts
 * @param {Object} req
 */
export const trackFailedAuth = (req) => {
    const clientId = getClientIp(req);
    const now = Date.now();
    
    if (!failedAuthAttempts.has(clientId)) {
        failedAuthAttempts.set(clientId, {
            count: 1,
            firstAttempt: now
        });
        return;
    }
    
    const data = failedAuthAttempts.get(clientId);
    
    // Reset if block duration passed
    if (now - data.firstAttempt > config.auth.blockDuration) {
        data.count = 1;
        data.firstAttempt = now;
    } else {
        data.count++;
    }
};

/**
 * Check if IP is blocked due to failed auth attempts
 * @param {Object} req
 * @returns {boolean}
 */
export const isAuthBlocked = (req) => {
    const clientId = getClientIp(req);
    const data = failedAuthAttempts.get(clientId);
    
    if (!data) return false;
    
    const now = Date.now();
    
    // Block after max failed attempts
    if (data.count >= config.auth.maxFailedAttempts && (now - data.firstAttempt) < config.auth.blockDuration) {
        return true;
    }
    
    return false;
};

/**
 * Reset failed auth attempts for a client (on successful auth)
 * @param {Object} req
 */
export const resetFailedAuth = (req) => {
    const clientId = getClientIp(req);
    failedAuthAttempts.delete(clientId);
};
