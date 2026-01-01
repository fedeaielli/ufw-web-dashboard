/**
 * Startup validation and security checks
 */

import config from '../config.js';
import logger from './logger.js';

/**
 * Validate password strength
 * @param {string} password
 * @returns {Object} { valid: boolean, issues: string[] }
 */
const validatePasswordStrength = (password) => {
    const issues = [];
    
    if (!password) {
        return { valid: false, issues: ['Password is not set'] };
    }
    
    if (password.length < config.security.minPasswordLength) {
        issues.push(`Password is too short (minimum ${config.security.minPasswordLength} characters recommended)`);
    }
    
    if (!/[a-z]/.test(password)) {
        issues.push('Password should contain lowercase letters');
    }
    
    if (!/[A-Z]/.test(password)) {
        issues.push('Password should contain uppercase letters');
    }
    
    if (!/[0-9]/.test(password)) {
        issues.push('Password should contain numbers');
    }
    
    if (!/[^a-zA-Z0-9]/.test(password)) {
        issues.push('Password should contain special characters');
    }
    
    // Check for common weak passwords
    const weakPasswords = [
        'password', 'admin', 'root', '123456', 'qwerty', 
        'firewall', 'manager', 'changeme', 'default'
    ];
    
    if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
        issues.push('Password contains common weak patterns');
    }
    
    return {
        valid: issues.length === 0,
        issues
    };
};

/**
 * Validate credentials on startup
 * @returns {boolean} Whether credentials are valid
 */
export const validateCredentials = () => {
    logger.info('Validating credentials...');
    
    let hasErrors = false;
    
    // Check if credentials are set
    if (!config.auth.user) {
        logger.error('CRITICAL: F_USER environment variable is not set!');
        logger.error('Set it in your .env file or environment variables.');
        hasErrors = true;
    } else if (config.auth.user.length < config.security.minUsernameLength) {
        logger.warn(`Username is very short (less than ${config.security.minUsernameLength} characters)`);
    }
    
    if (!config.auth.pass) {
        logger.error('CRITICAL: F_PASS environment variable is not set!');
        logger.error('Set it in your .env file or environment variables.');
        hasErrors = true;
    } else {
        // Validate password strength
        const { valid, issues } = validatePasswordStrength(config.auth.pass);
        
        if (!valid) {
            logger.warn('Password does not meet security recommendations:');
            issues.forEach(issue => {
                logger.warn(`  - ${issue}`);
            });
            logger.warn('Consider using a stronger password for production.');
        } else {
            logger.info('Password meets security requirements');
        }
    }
    
    if (hasErrors) {
        logger.error('CRITICAL ERRORS FOUND: Application cannot start without credentials!');
        return false;
    }
    
    return true;
};

/**
 * Display security warnings
 */
export const displaySecurityWarnings = () => {
    logger.info('Configuration:', { 
        host: config.host, 
        port: config.port,
        env: config.env
    });
    
    if (config.host === '0.0.0.0') {
        logger.warn('Server is listening on 0.0.0.0 (all interfaces)');
        logger.warn('This exposes the application to all network interfaces.');
        logger.warn('For security, consider:');
        logger.warn('  - Using HOST=127.0.0.1 for local access only');
        logger.warn('  - Using a reverse proxy (nginx, caddy) with HTTPS');
        logger.warn('  - Configuring firewall rules to restrict access');
    }
    
    logger.warn('IMPORTANT: ALWAYS use HTTPS in production (reverse proxy recommended)');
};
