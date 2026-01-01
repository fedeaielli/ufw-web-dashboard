/**
 * Centralized error handling utilities
 */

import config from '../config.js';
import logger from './logger.js';

/**
 * Create error response based on environment
 * @param {Error} error
 * @param {string} userMessage - User-friendly message
 * @returns {Object} Error response object
 */
export const createErrorResponse = (error, userMessage = 'An error occurred') => {
    const isDevelopment = config.env === 'development';
    
    const response = {
        error: userMessage
    };
    
    // In development, include more details
    if (isDevelopment && error) {
        response.details = error.message;
        if (error.stack) {
            response.stack = error.stack.split('\n').slice(0, 5); // First 5 lines
        }
    }
    
    return response;
};

/**
 * Express error handler middleware
 * @param {Error} err
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
export const errorHandler = (err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        path: req.path,
        method: req.method,
        stack: err.stack
    });
    
    const statusCode = err.statusCode || 500;
    const response = createErrorResponse(err, 'Internal server error');
    
    res.status(statusCode).json(response);
};

/**
 * Async route handler wrapper to catch errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
