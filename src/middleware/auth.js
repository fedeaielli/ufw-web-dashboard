import { timingSafeEqual } from 'crypto';
import config from '../config.js';

/**
 * Timing-safe string comparison
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
const timingSafeCompare = (a, b) => {
    if (!a || !b) return false;

    // Ensure both strings have the same length to prevent timing attacks
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    // If lengths differ, compare against a dummy buffer to maintain constant time
    if (bufA.length !== bufB.length) {
        const dummy = Buffer.alloc(bufA.length);
        timingSafeEqual(bufA, dummy);
        return false;
    }

    return timingSafeEqual(bufA, bufB);
};

/**
 * Verify a username/password pair against the configured credentials.
 * Both comparisons always run so a wrong username and a wrong password take the same time.
 * @param {string} username
 * @param {string} password
 * @returns {boolean}
 */
export const verifyCredentials = (username, password) => {
    const userOk = timingSafeCompare(username, config.auth.user);
    const passOk = timingSafeCompare(password, config.auth.pass);
    return userOk && passOk;
};
