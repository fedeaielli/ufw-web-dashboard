/**
 * CSRF Protection middleware
 */

import { randomBytes } from 'crypto';
import config from '../config.js';
import logger from '../utils/logger.js';
import { getSession } from './session.js';

const tokens = new Map();

// Clean up expired tokens periodically
setInterval(() => {
    const now = Date.now();
    const expiry = config.csrf.tokenExpiry;
    
    for (const [token, data] of tokens.entries()) {
        if (now - data.created > expiry) {
            tokens.delete(token);
        }
    }
}, config.csrf.cleanupInterval).unref();

/**
 * Generate a CSRF token
 * @returns {string}
 */
const generateToken = () => {
    return randomBytes(32).toString('hex');
};

/**
 * Middleware to generate and attach CSRF token
 */
export const csrfToken = (req, res, next) => {
    const token = generateToken();
    // Bind to the session object: IP changes (Wi-Fi to mobile) no longer break it.
    tokens.set(token, {
        session: getSession(req),
        created: Date.now()
    });
    
    // Attach token to response
    req.csrfToken = token;
    res.locals.csrfToken = token;
    
    next();
};

/**
 * Middleware to verify CSRF token
 */
export const csrfProtect = (req, res, next) => {
    // Skip CSRF for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    
    const token = req.headers['x-csrf-token'] || req.body?._csrf;
    
    if (!token) {
        return res.status(403).json({ error: 'CSRF token missing' });
    }
    
    const tokenData = tokens.get(token);
    
    if (!tokenData) {
        logger.security('Invalid CSRF token', { path: req.path });
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    
    if (tokenData.session !== getSession(req)) {
        tokens.delete(token);
        logger.security('CSRF token session mismatch', { path: req.path });
        return res.status(403).json({ error: 'CSRF token mismatch' });
    }
    
    // Check if token is expired
    const now = Date.now();
    if (now - tokenData.created > config.csrf.tokenExpiry) {
        tokens.delete(token);
        logger.security('CSRF token expired', { path: req.path });
        return res.status(403).json({ error: 'CSRF token expired' });
    }
    
    // Token is valid, delete it (one-time use)
    tokens.delete(token);
    
    next();
};
