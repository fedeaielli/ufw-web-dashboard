import { Router } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { verifyCredentials } from '../middleware/auth.js';
import { createSession, destroySession, getSession } from '../middleware/session.js';
import { isAuthBlocked, trackFailedAuth, resetFailedAuth } from '../middleware/rateLimit.js';
import { getClientIp } from '../utils/clientInfo.js';
import logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loginPage = readFileSync(join(__dirname, '../views/login.html'), 'utf8');

const renderLogin = (error = '') => loginPage.replace('{{error}}', error);

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
    res.type('html').send(renderLogin());
});

router.post('/login', (req, res) => {
    if (!sameOrigin(req)) return res.status(403).send(renderLogin('Invalid request origin.'));

    if (isAuthBlocked(req)) {
        logger.security('Authentication blocked due to too many failed attempts', { ip: getClientIp(req) });
        return res
            .status(429)
            .send(renderLogin('Too many failed attempts. Please try again later.'));
    }

    const { username = '', password = '' } = req.body || {};

    if (!verifyCredentials(username, password)) {
        logger.security('Failed authentication attempt', { ip: getClientIp(req) });
        trackFailedAuth(req);
        return res.status(401).send(renderLogin('Invalid username or password.'));
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
