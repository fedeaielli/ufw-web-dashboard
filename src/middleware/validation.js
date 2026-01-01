/**
 * Validation middleware for routes
 */

import { 
    isValidPort, 
    isValidProtocol, 
    isValidRuleType, 
    isValidSource 
} from '../utils/validation.js';

/**
 * Validate request body fields
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
export const validateBody = (schema) => {
    return (req, res, next) => {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];

            // Check required
            if (rules.required && !value) {
                errors.push(`${field} is required`);
                continue;
            }

            // Skip validation if field is optional and not provided
            if (!rules.required && !value) {
                continue;
            }

            // Custom validation function
            if (rules.validate && !rules.validate(value)) {
                errors.push(rules.message || `${field} is invalid`);
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors 
            });
        }

        next();
    };
};

/**
 * Validate request params
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
export const validateParams = (schema) => {
    return (req, res, next) => {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = req.params[field];

            if (rules.required && !value) {
                errors.push(`${field} parameter is required`);
                continue;
            }

            if (rules.validate && !rules.validate(value)) {
                errors.push(rules.message || `${field} parameter is invalid`);
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ 
                error: 'Validation failed', 
                details: errors 
            });
        }

        next();
    };
};

/**
 * Validation schemas for common use cases
 */
export const schemas = {
    addRule: {
        port: {
            required: true,
            validate: isValidPort,
            message: 'Port must be a number between 1 and 65535'
        },
        type: {
            required: true,
            validate: isValidRuleType,
            message: 'Type must be "allow" or "deny"'
        },
        protocol: {
            required: false,
            validate: isValidProtocol,
            message: 'Protocol must be "tcp", "udp", or "both"'
        },
        source: {
            required: false,
            validate: isValidSource,
            message: 'Source must be a valid IP address or CIDR notation'
        }
    },
    deleteRule: {
        id: {
            required: true,
            validate: (id) => /^\d+$/.test(id) && parseInt(id, 10) > 0,
            message: 'Rule ID must be a positive integer'
        }
    }
};
