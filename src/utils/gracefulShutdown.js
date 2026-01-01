/**
 * Graceful shutdown handler
 */

import logger from './logger.js';

/**
 * Setup graceful shutdown handlers
 * @param {Object} server - HTTP server instance
 * @param {Array} cleanupTasks - Array of cleanup functions to run on shutdown
 */
export const setupGracefulShutdown = (server, cleanupTasks = []) => {
    let isShuttingDown = false;

    const shutdown = async (signal) => {
        if (isShuttingDown) {
            logger.warn('Shutdown already in progress, forcing exit...');
            process.exit(1);
        }

        isShuttingDown = true;
        logger.info(`Received ${signal}, starting graceful shutdown...`);

        // Stop accepting new connections
        server.close(() => {
            logger.info('HTTP server closed');
        });

        // Set timeout for forced shutdown
        const forceTimeout = setTimeout(() => {
            logger.error('Graceful shutdown timeout, forcing exit');
            process.exit(1);
        }, 30000); // 30 seconds

        try {
            // Run cleanup tasks
            logger.info(`Running ${cleanupTasks.length} cleanup task(s)...`);
            for (const task of cleanupTasks) {
                try {
                    await task();
                } catch (error) {
                    logger.error('Cleanup task failed', { error: error.message });
                }
            }

            clearTimeout(forceTimeout);
            logger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error('Error during shutdown', { error: error.message });
            clearTimeout(forceTimeout);
            process.exit(1);
        }
    };

    // Handle termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception', { 
            error: error.message, 
            stack: error.stack 
        });
        shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled promise rejection', { 
            reason: reason?.toString(), 
            promise: promise?.toString() 
        });
        shutdown('unhandledRejection');
    });

    logger.info('Graceful shutdown handlers registered');
};
