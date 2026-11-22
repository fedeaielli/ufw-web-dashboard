/**
 * Cookie session middleware
 * Sessions live in memory: a restart logs everyone out.
 */

import { randomBytes } from 'crypto';
import config from '../config.js';
import logger from '../utils/logger.js';
import { getClientIp } from '../utils/clientInfo.js';

const COOKIE_NAME = 'sid';
const sessions = new Map();

// Clean up expired sessions hourly. unref() keeps tests and shutdown from hanging.
setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of sessions.entries()) {
        if (now - session.lastSeen > config.auth.sessionTtl) {
            sessions.delete(sid);
        }
    }
}, 60 * 60 * 1000).unref();

/**
 * Parse a Cookie header without a dependency
 * @param {string} [header]
 * @returns {Object}
 */
export const parseCookies = (header = '') => {
    const cookies = {};
    for (const part of header.split(';')) {
        const index = part.indexOf('=');
        if (index > 0) {
            const name = part.slice(0, index).trim();
            try {
                cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
            } catch {
                // Ignore malformed percent-encoding: treat the cookie as absent.
            }
        }
    }
    return cookies;
};

const setSessionCookie = (req, res, value, maxAgeSeconds) => {
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`
    );
};

/**
 * Create a session and send its cookie
 * @param {Object} req
 * @param {Object} res
 */
export const createSession = (req, res) => {
    const sid = randomBytes(32).toString('hex');
    sessions.set(sid, { created: Date.now(), lastSeen: Date.now() });
    setSessionCookie(req, res, sid, Math.floor(config.auth.sessionTtl / 1000));
    logger.debug('Session created', { ip: getClientIp(req) });
};

/**
 * Destroy the session referenced by the request cookie
 * @param {Object} req
 * @param {Object} res
 */
export const destroySession = (req, res) => {
    const sid = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (sid) sessions.delete(sid);
    setSessionCookie(req, res, '', 0);
};

/**
 * Get the valid session for a request, refreshing its idle expiry
 * @param {Object} req
 * @returns {Object|null}
 */
export const getSession = (req) => {
    const sid = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!sid) return null;

    const session = sessions.get(sid);
    if (!session) return null;

    if (Date.now() - session.lastSeen > config.auth.sessionTtl) {
        sessions.delete(sid);
        return null;
    }

    session.lastSeen = Date.now();
    return session;
};

/**
 * Require a valid session: JSON 401 for the API, redirect to /login for pages
 */
export const requireAuth = (req, res, next) => {
    if (getSession(req)) {
        // Authenticated pages and API data must not survive logout in the browser cache.
        res.setHeader('Cache-Control', 'no-store');
        return next();
    }

    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    res.redirect('/login');
};
