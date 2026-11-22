/**
 * Pure helpers for the dashboard. No DOM access, so node:test can import this file.
 */

const SERVICES = {
    20: 'FTP data', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP',
    53: 'DNS', 67: 'DHCP', 68: 'DHCP', 80: 'HTTP', 110: 'POP3', 123: 'NTP',
    143: 'IMAP', 161: 'SNMP', 389: 'LDAP', 443: 'HTTPS', 445: 'SMB',
    465: 'SMTPS', 587: 'SMTP', 631: 'CUPS', 993: 'IMAPS', 995: 'POP3S',
    1194: 'OpenVPN', 3306: 'MySQL', 3389: 'RDP', 5432: 'PostgreSQL',
    6379: 'Redis', 8080: 'HTTP alt', 8443: 'HTTPS alt', 27017: 'MongoDB'
};

/**
 * Service name for a port, or an empty string when unknown.
 * @param {string|number} port
 * @returns {string}
 */
export const portName = (port) => SERVICES[String(port)] || '';

/**
 * Split a UFW rule target like "22/tcp", "443/tcp (v6)" or "80".
 * @param {string} to
 * @returns {{port: string, proto: string, v6: boolean}}
 */
export const parseRuleTarget = (to = '') => {
    const v6 = /\(v6\)/.test(to);
    const clean = to.replace('(v6)', '').trim();
    const slash = clean.indexOf('/');
    return {
        port: slash === -1 ? clean : clean.slice(0, slash),
        proto: slash === -1 ? 'any' : clean.slice(slash + 1),
        v6
    };
};

/**
 * Merge the IPv4 and IPv6 entries of the same rule into one row.
 * @param {Array<{id: string, to: string, action: string, from: string}>} rules
 * @returns {Array<Object>}
 */
export const mergeRules = (rules = []) => {
    const groups = new Map();

    for (const rule of rules) {
        const { port, proto, v6 } = parseRuleTarget(rule.to);
        const key = [port, proto, rule.action, rule.from].join('|');

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                port,
                proto,
                action: rule.action,
                from: rule.from,
                v4: false,
                v6: false,
                ids: []
            });
        }

        const group = groups.get(key);
        group[v6 ? 'v6' : 'v4'] = true;
        group.ids.push(String(rule.id));
    }

    return [...groups.values()].sort((a, b) => {
        const byPort = Number(a.port) - Number(b.port);
        return byPort || a.proto.localeCompare(b.proto);
    });
};

/**
 * "v4", "v6" or "v4 + v6" for a merged rule.
 * @param {{v4: boolean, v6: boolean}} group
 * @returns {string}
 */
export const familyLabel = ({ v4, v6 }) => (v4 && v6 ? 'v4 + v6' : v6 ? 'v6' : 'v4');

/**
 * Top N entries of a {key: count} map, highest first.
 * @param {Object} counts
 * @param {number} [limit]
 * @returns {Array<{key: string, count: number}>}
 */
export const groupCounts = (counts = {}, limit = 5) =>
    Object.entries(counts)
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

/**
 * Filter recent log entries by source IP (all entries when ip is null).
 * @param {Array<Object>} recent
 * @param {string|null} ip
 * @returns {Array<Object>}
 */
export const filterRecent = (recent = [], ip = null) =>
    ip ? recent.filter((entry) => entry.src === ip) : recent;
