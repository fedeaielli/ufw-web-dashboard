import { exec } from 'child_process';
import { 
    sanitizePort, 
    sanitizeProtocol, 
    sanitizeRuleType, 
    sanitizeSource,
    sanitizeRuleId 
} from '../utils/validation.js';
import logger from '../utils/logger.js';

/**
 * Execute shell command
 * @param {string} cmd
 * @returns {Promise<string>}
 */
const runCommand = (cmd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                logger.error('Command execution failed', { cmd, error: error.message });
                return reject(new Error(stderr || error.message));
            }
            logger.debug('Command executed successfully', { cmd });
            resolve(stdout);
        });
    });
};

/**
 * Get UFW status and rules
 * @returns {Promise<{status: string, rules: Array, error?: string}>}
 */
export const getStatus = async () => {
    try {
        const raw = await runCommand('ufw status numbered');
        const lines = raw.split('\n');
        
        let status = 'inactive';
        if (lines[0]?.includes('Status: active')) status = 'active';

        const rules = [];
        const regex = /^\[\s*(\d+)\]\s+(.*?)\s+(ALLOW IN|DENY IN|REJECT IN|ALLOW OUT|DENY OUT)\s+(.*)$/;

        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                rules.push({
                    id: match[1],
                    to: match[2].trim(),
                    action: match[3].trim(),
                    from: match[4].trim()
                });
            }
        }

        return { status, rules };
    } catch (e) {
        const errorMsg = e.toString().toLowerCase();
        
        // Check if UFW is not installed
        if (errorMsg.includes('command not found') || errorMsg.includes('not found')) {
            return { status: 'not_installed', error: 'UFW is not installed', rules: [] };
        }
        
        // Check if permission denied
        if (errorMsg.includes('permission denied') || errorMsg.includes('not permitted')) {
            return { status: 'permission_denied', error: 'Permission denied. Run with sudo.', rules: [] };
        }
        
        return { status: 'error', error: e.toString(), rules: [] };
    }
};

/**
 * Add a UFW rule
 * @param {Object} params
 * @param {string} params.port
 * @param {string} params.type - 'allow' or 'deny'
 * @param {string} [params.protocol] - 'tcp', 'udp', or 'both'
 * @param {string} [params.source] - Source IP
 * @returns {Promise<void>}
 */
export const addRule = async ({ port, type, protocol, source }) => {
    // Validate and sanitize all inputs
    const safePort = sanitizePort(port);
    const safeType = sanitizeRuleType(type);
    const safeSource = sanitizeSource(source);
    
    let cmd = `ufw ${safeType}`;
    
    if (safeSource) {
        cmd += ` from ${safeSource}`;
    }
    
    cmd += ` to any port ${safePort}`;
    
    if (protocol && protocol !== 'both') {
        const safeProtocol = sanitizeProtocol(protocol);
        cmd += ` proto ${safeProtocol}`;
    }

    await runCommand(cmd);
};

/**
 * Delete a UFW rule by ID
 * @param {string} id
 * @returns {Promise<void>}
 */
export const deleteRule = async (id) => {
    const safeId = sanitizeRuleId(id);
    await runCommand(`yes | ufw delete ${safeId}`);
};

/**
 * Enable UFW
 * @returns {Promise<void>}
 */
export const enable = async () => {
    await runCommand('yes | ufw enable');
};

/**
 * Disable UFW
 * @returns {Promise<void>}
 */
export const disable = async () => {
    await runCommand('ufw disable');
};
