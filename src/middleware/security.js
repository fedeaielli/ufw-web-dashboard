/**
 * Security headers and HTTPS detection middleware
 */

import logger from '../utils/logger.js';
import { getClientIp } from '../utils/clientInfo.js';

/**
 * Add security headers to all responses
 */
export const securityHeaders = (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "connect-src 'self'; " +
        "form-action 'self'; " +
        "base-uri 'none'; " +
        "frame-ancestors 'none';"
    );
    
    // Permissions Policy (formerly Feature-Policy)
    res.setHeader(
        'Permissions-Policy',
        'geolocation=(), microphone=(), camera=()'
    );
    
    next();
};

/**
 * Check if request is over HTTPS
 * @param {Object} req
 * @returns {boolean}
 */
export const isHttps = (req) => {
    // Check if behind a proxy
    if (req.headers['x-forwarded-proto']) {
        return req.headers['x-forwarded-proto'] === 'https';
    }
    
    // Direct connection
    return req.protocol === 'https' || req.secure;
};

/**
 * Middleware to warn about non-HTTPS connections
 */
export const httpsWarning = (req, res, next) => {
    if (!isHttps(req)) {
        const clientIp = getClientIp(req);
        logger.security(`Insecure HTTP request from ${clientIp} to ${req.method} ${req.path}`, {
            ip: clientIp,
            path: req.path,
            method: req.method
        });
    }
    
    next();
};

/**
 * Middleware to enforce HTTPS (optional, disabled by default)
 */
export const enforceHttps = (req, res, next) => {
    if (!isHttps(req)) {
        return res.status(403).json({ 
            error: 'HTTPS required',
            message: 'This service requires a secure connection'
        });
    }
    next();
};
