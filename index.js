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
import { basicAuth } from './src/middleware/auth.js';
import { rateLimiter } from './src/middleware/rateLimit.js';
import { csrfToken, csrfProtect } from './src/middleware/csrf.js';
import { securityHeaders, httpsWarning } from './src/middleware/security.js';
import { validateCredentials, displaySecurityWarnings } from './src/utils/startup.js';
import { errorHandler } from './src/utils/errorHandler.js';
import { setupGracefulShutdown } from './src/utils/gracefulShutdown.js';
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

// Health check endpoint (no auth required)
app.use('/health', healthRouter);

// Security middleware (applied to all routes)
app.use(securityHeaders);
app.use(httpsWarning);
app.use(rateLimiter());

// Body parser
app.use(express.json());

// Authentication
app.use(basicAuth);

// CSRF protection
app.use(csrfToken);
app.use(csrfProtect);

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
    res.sendFile(join(__dirname, 'src/views/index.html'));
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
