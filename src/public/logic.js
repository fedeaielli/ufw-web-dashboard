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
        // ufw prints "Anywhere (v6)" as the source of IPv6 rules
        const from = rule.from.replace('(v6)', '').trim();
        const key = [port, proto, rule.action, from].join('|');

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                port,
                proto,
                action: rule.action,
                from,
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

/**
 * Human label for a rule protocol. ufw prints "any" when no proto is set.
 * @param {string} proto
 * @returns {string}
 */
export const protocolLabel = (proto = 'any') =>
    proto === 'any' || !proto ? 'TCP + UDP' : proto.toUpperCase();

/**
 * Top targeted ports for the donut: top N plus an "Other" slice.
 * @param {Object} byPort
 * @param {number} [limit]
 * @returns {{total: number, slices: Array<{key: string, count: number, percent: number}>}}
 */
export const donutSlices = (byPort = {}, limit = 5) => {
    const total = Object.values(byPort).reduce((sum, count) => sum + count, 0);
    if (total === 0) return { total: 0, slices: [] };

    const top = groupCounts(byPort, limit);
    const shown = top.reduce((sum, entry) => sum + entry.count, 0);
    const slices = top.map((entry) => ({
        ...entry,
        percent: (entry.count / total) * 100
    }));

    if (total - shown > 0) {
        slices.push({
            key: 'Other',
            count: total - shown,
            percent: ((total - shown) / total) * 100
        });
    }

    return { total, slices };
};

/**
 * Blocked attempts per protocol, highest first, with percentages.
 * @param {Object} byProto
 * @returns {Array<{name: string, count: number, percent: number}>}
 */
export const protocolStats = (byProto = {}) => {
    const entries = Object.entries(byProto)
        .map(([name, count]) => ({ name: name.toUpperCase(), count }))
        .sort((a, b) => b.count - a.count);
    const total = entries.reduce((sum, entry) => sum + entry.count, 0);

    return entries.map((entry) => ({
        ...entry,
        percent: total ? Math.round((entry.count / total) * 100) : 0
    }));
};

const CATEGORIES = [
    { name: 'Web', ports: [80, 443, 3000, 8000, 8080, 8443] },
    { name: 'Remote access', ports: [22, 23, 3389, 5900] },
    { name: 'Mail', ports: [25, 110, 143, 465, 587, 993, 995] },
    { name: 'Database', ports: [1433, 1521, 3306, 5432, 6379, 27017] },
    { name: 'File sharing', ports: [20, 21, 139, 445, 2049] }
];

/**
 * Group targeted ports into service categories, highest first.
 * @param {Object} byPort
 * @returns {Array<{name: string, count: number, percent: number}>}
 */
export const serviceCategories = (byPort = {}) => {
    const total = Object.values(byPort).reduce((sum, count) => sum + count, 0);
    if (total === 0) return [];

    const counts = new Map(CATEGORIES.map((category) => [category.name, 0]));
    let other = 0;

    for (const [port, count] of Object.entries(byPort)) {
        const category = CATEGORIES.find((item) => item.ports.includes(Number(port)));
        if (category) counts.set(category.name, counts.get(category.name) + count);
        else other += count;
    }

    if (other > 0) counts.set('Other', other);

    return [...counts.entries()]
        .filter(([, count]) => count > 0)
        .map(([name, count]) => ({ name, count, percent: Math.round((count / total) * 100) }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Number of distinct known services among merged rules.
 * @param {Array<Object>} groups
 * @returns {number}
 */
export const distinctServices = (groups = []) =>
    new Set(groups.map((group) => portName(group.port)).filter(Boolean)).size;

/**
 * Port counts to show in Activity: the filtered IP's own targets, or all.
 * @param {{byPort: Object, ipPorts: Object}} logs
 * @param {string|null} ip
 * @returns {Object}
 */
export const countsForIp = (logs = {}, ip = null) =>
    (ip && logs.ipPorts && logs.ipPorts[ip]) || logs.byPort || {};

