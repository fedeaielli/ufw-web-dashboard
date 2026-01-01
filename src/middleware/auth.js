import auth from 'basic-auth';
import { timingSafeEqual } from 'crypto';
import config from '../config.js';
import { isAuthBlocked, trackFailedAuth, resetFailedAuth } from './rateLimit.js';
import logger from '../utils/logger.js';
import { getClientIp } from '../utils/clientInfo.js';

/**
 * Timing-safe string comparison
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
const timingSafeCompare = (a, b) => {
    if (!a || !b) return false;
    
    // Ensure both strings have the same length to prevent timing attacks
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    
    // If lengths differ, compare against a dummy buffer to maintain constant time
    if (bufA.length !== bufB.length) {
        const dummy = Buffer.alloc(bufA.length);
        timingSafeEqual(bufA, dummy);
        return false;
    }
    
    return timingSafeEqual(bufA, bufB);
};

/**
 * HTTP Basic Authentication middleware with timing-safe comparison
 */
export const basicAuth = (req, res, next) => {
    // Check if IP is blocked due to failed attempts
    if (isAuthBlocked(req)) {
        const clientIp = getClientIp(req);
        logger.security('Authentication blocked due to too many failed attempts', { ip: clientIp });
        res.set('WWW-Authenticate', 'Basic realm="Firewall Manager"');
        return res.status(429).json({ 
            error: 'Too many failed authentication attempts. Please try again later.' 
        });
    }
    
    const user = auth(req);
    const validUser = user && 
        timingSafeCompare(user.name, config.auth.user) && 
        timingSafeCompare(user.pass, config.auth.pass);
    
    if (!validUser) {
        const clientIp = getClientIp(req);
        logger.security('Failed authentication attempt', { ip: clientIp });
        trackFailedAuth(req);
        res.set('WWW-Authenticate', 'Basic realm="Firewall Manager"');
        return res.status(401).send('Access denied.');
    }
    
    // Reset failed attempts on successful auth
    resetFailedAuth(req);
    logger.debug('Successful authentication', { ip: getClientIp(req) });
    next();
};
