/**
 * Input validation and sanitization utilities
 */

/**
 * Validate port number
 * @param {string|number} port
 * @returns {boolean}
 */
export const isValidPort = (port) => {
    const num = parseInt(port, 10);
    return !isNaN(num) && num >= 1 && num <= 65535;
};

/**
 * Validate protocol
 * @param {string} protocol
 * @returns {boolean}
 */
export const isValidProtocol = (protocol) => {
    return ['tcp', 'udp', 'both'].includes(protocol);
};

/**
 * Validate rule type
 * @param {string} type
 * @returns {boolean}
 */
export const isValidRuleType = (type) => {
    return ['allow', 'deny'].includes(type);
};

/**
 * Validate IPv4 address
 * @param {string} ip
 * @returns {boolean}
 */
export const isValidIPv4 = (ip) => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4Regex.test(ip)) return false;
    
    const parts = ip.split('.');
    return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
};

/**
 * Validate CIDR notation
 * @param {string} cidr
 * @returns {boolean}
 */
export const isValidCIDR = (cidr) => {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!cidrRegex.test(cidr)) return false;
    
    const [ip, mask] = cidr.split('/');
    const maskNum = parseInt(mask, 10);
    
    return isValidIPv4(ip) && maskNum >= 0 && maskNum <= 32;
};

/**
 * Validate source IP or CIDR
 * @param {string} source
 * @returns {boolean}
 */
export const isValidSource = (source) => {
    if (!source || source === 'Anywhere' || source.trim() === '') return true;
    return isValidIPv4(source) || isValidCIDR(source);
};

/**
 * Sanitize port for shell command (only allow digits)
 * @param {string|number} port
 * @returns {string}
 */
export const sanitizePort = (port) => {
    const sanitized = String(port).replace(/[^\d]/g, '');
    if (!isValidPort(sanitized)) {
        throw new Error('Invalid port number');
    }
    return sanitized;
};

/**
 * Sanitize protocol for shell command
 * @param {string} protocol
 * @returns {string}
 */
export const sanitizeProtocol = (protocol) => {
    if (!isValidProtocol(protocol)) {
        throw new Error('Invalid protocol');
    }
    return protocol;
};

/**
 * Sanitize rule type for shell command
 * @param {string} type
 * @returns {string}
 */
export const sanitizeRuleType = (type) => {
    if (!isValidRuleType(type)) {
        throw new Error('Invalid rule type');
    }
    return type;
};

/**
 * Sanitize source IP for shell command
 * @param {string} source
 * @returns {string}
 */
export const sanitizeSource = (source) => {
    if (!source || source === 'Anywhere' || source.trim() === '') {
        return null;
    }
    
    if (!isValidSource(source)) {
        throw new Error('Invalid source IP or CIDR');
    }
    
    // Remove any potential shell metacharacters
    return source.replace(/[^0-9.\/]/g, '');
};

/**
 * Sanitize rule ID (only allow digits)
 * @param {string|number} id
 * @returns {string}
 */
export const sanitizeRuleId = (id) => {
    const sanitized = String(id).replace(/[^\d]/g, '');
    if (!sanitized || sanitized === '0') {
        throw new Error('Invalid rule ID');
    }
    return sanitized;
};

/**
 * Validate and sanitize log lines parameter
 * @param {string|number} lines
 * @param {number} defaultValue
 * @returns {number}
 */
export const sanitizeLogLines = (lines, defaultValue = 1000) => {
    const num = parseInt(lines, 10);
    if (isNaN(num) || num < 1) return defaultValue;
    // Allow up to 50000 lines max for safety
    return Math.min(num, 50000);
};
