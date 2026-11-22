#!/usr/bin/env node

/**
 * Firewall Manager - UFW Web Interface
 * Entry point
 */

import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import config from './src/config.js';
import logger from './src/utils/logger.js';
import { rateLimiter } from './src/middleware/rateLimit.js';
import { requireAuth } from './src/middleware/session.js';
import { csrfToken, csrfProtect } from './src/middleware/csrf.js';
import { securityHeaders } from './src/middleware/security.js';
import { validateCredentials, displaySecurityWarnings } from './src/utils/startup.js';
import { errorHandler } from './src/utils/errorHandler.js';
import { setupGracefulShutdown } from './src/utils/gracefulShutdown.js';
import authRouter, { logout } from './src/routes/auth.js';
import rulesRouter from './src/routes/rules.js';
import logsRouter from './src/routes/logs.js';
import healthRouter from './src/routes/health.js';
import { getClientIp } from './src/utils/clientInfo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Validate credentials before starting
if (!validateCredentials()) {
    process.exit(1);
}

const app = express();
app.set('trust proxy', 'loopback');

// Security middleware (applied to all routes)
app.use(securityHeaders);

// Static assets are public: the login page needs them before a session exists
app.use(express.static(join(__dirname, 'web/dist')));
app.use('/static', express.static(join(__dirname, 'src/public')));

// Rate limiting (static assets above are exempt)
app.use(rateLimiter());

// Health check endpoint (no auth required, but rate limited)
app.use('/health', healthRouter);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Login page and form (public)
app.use(authRouter);

// Everything below requires a session
app.use(requireAuth);

// CSRF protection
app.use(csrfToken);
app.use(csrfProtect);

app.post('/logout', logout);

// API routes
app.use('/api/rules', rulesRouter);
app.use('/api/logs', logsRouter);

// Utility endpoints
app.get('/api/whoami', (req, res) => {
    res.json({ ip: getClientIp(req) });
});

app.get('/api/csrf-token', (req, res) => {
    res.json({ token: req.csrfToken });
});

// Frontend
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'web/dist/index.html'));
});

// Error handler
app.use(errorHandler);

const server = app.listen(config.port, config.host, () => {
    logger.info(`🛡️  Firewall Manager started successfully`);
    logger.info(`URL: http://${config.host}:${config.port}`);
    displaySecurityWarnings();
});

// Setup graceful shutdown
setupGracefulShutdown(server, [
    // Add cleanup tasks here if needed
    async () => {
        logger.info('Closing database connections...');
        // Example: await db.close();
    }
]);
