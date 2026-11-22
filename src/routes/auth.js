import { Router } from 'express';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { verifyCredentials } from '../middleware/auth.js';
import { createSession, destroySession, getSession } from '../middleware/session.js';
import { isAuthBlocked, trackFailedAuth, resetFailedAuth } from '../middleware/rateLimit.js';
import { getClientIp } from '../utils/clientInfo.js';
import logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const spaIndex = join(__dirname, '../../web/dist/index.html');

/** The React app handles sign-in; the server only owns the session and its checks. */
const sendLoginPage = (res) => {
    if (existsSync(spaIndex)) return res.sendFile(spaIndex);
    return res.type('html').send('<!doctype html><title>Firewall Manager</title><p>Frontend not built. Run npm run build:web.</p>');
};

const loginError = (req, res, status, error) =>
    req.accepts('json') && !req.accepts('html')
        ? res.status(status).json({ error })
        : res.status(status).type('text').send(error);

/**
 * Reject cross-site form posts. SameSite=Strict already covers the session;
 * this covers login CSRF, where no session exists yet.
 */
const sameOrigin = (req) => {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
        return new URL(origin).host === req.headers.host;
    } catch {
        return false;
    }
};

const router = Router();

router.get('/login', (req, res) => {
    if (getSession(req)) return res.redirect('/');
    sendLoginPage(res);
});

router.post('/login', (req, res) => {
    if (!sameOrigin(req)) return loginError(req, res, 403, 'Invalid request origin.');

    if (isAuthBlocked(req)) {
        logger.security('Authentication blocked due to too many failed attempts', { ip: getClientIp(req) });
        return loginError(req, res, 429, 'Too many failed attempts. Please try again later.');
    }

    const { username = '', password = '' } = req.body || {};

    if (!verifyCredentials(username, password)) {
        logger.security('Failed authentication attempt', { ip: getClientIp(req) });
        trackFailedAuth(req);
        return loginError(req, res, 401, 'Invalid username or password.');
    }

    resetFailedAuth(req);
    destroySession(req, res); // drop any previous session id before issuing a new one
    createSession(req, res);
    logger.debug('Successful authentication', { ip: getClientIp(req) });
    res.redirect(303, '/');
});

/**
 * Destroy the current session. Mounted after CSRF protection in index.js.
 */
export const logout = (req, res) => {
    destroySession(req, res);
    res.redirect(303, '/login');
};

export default router;
