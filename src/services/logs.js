import { exec } from 'child_process';
import config from '../config.js';
import { sanitizeLogLines } from '../utils/validation.js';
import logger from '../utils/logger.js';

/**
 * LRU-like cache implementation
 */
class LogCache {
    constructor(maxSize = 10, ttl = 5000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    set(key, data) {
        // If cache is full, remove oldest entry
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clear() {
        this.cache.clear();
    }
}

const cache = new LogCache(config.logs.maxCacheSize, config.logs.cacheTtl);

/**
 * Split chronological timestamps into evenly sized buckets for the area chart.
 * Buckets by index instead of parsing syslog dates (which carry no year).
 * @param {string[]} times
 * @param {number} [bins]
 * @returns {Array<{t: string, count: number}>}
 */
export const timeSeries = (times = [], bins = 24) => {
    if (!times.length) return [];

    const size = Math.ceil(times.length / bins);
    const series = [];

    for (let index = 0; index < times.length; index += size) {
        const bucket = times.slice(index, index + size);
        series.push({ t: bucket[0], count: bucket.length });
    }

    return series;
};

/**
 * True only for a public IPv4 address. Private, loopback, link-local, CGNAT,
 * multicast and every IPv6 source count as internal.
 * @param {string} ip
 * @returns {boolean}
 */
export const isExternal = (ip) => {
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip || '')) return false;

    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a >= 224) return false;

    return true;
};

/**
 * Parse UFW logs and aggregate blocked connections
 * @param {number} lines - Number of log lines to parse
 * @returns {Promise<{byPort: Object, byProto: Object, byIp: Object, ipPorts: Object, recent: Array, series: Array, total: number}>}
 */
export const getBlockedStats = async (lines = config.logs.maxLines) => {
    const safeLines = sanitizeLogLines(lines, config.logs.maxLines);
    
    // Check cache
    const cacheKey = `logs_${safeLines}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        logger.debug('Cache hit for log stats', { lines: safeLines });
        return cached;
    }
    
    return new Promise((resolve) => {
        // Increase maxBuffer for large log files (default is 1MB)
        const maxBuffer = 10 * 1024 * 1024; // 10MB
        exec(`tail -${safeLines} /var/log/ufw.log 2>/dev/null | grep "UFW BLOCK"`, { maxBuffer }, (error, stdout) => {
            if (error || !stdout) {
                const emptyResult = { byPort: {}, byProto: {}, byIp: {}, ipPorts: {}, recent: [], series: [], total: 0 };
                return resolve(emptyResult);
            }

            const byPort = {};
            const byProto = {};
            const byIp = {};
            const ipPorts = {}; // Track which ports each IP targeted
            const recent = [];
            const times = [];
            
            const logLines = stdout.trim().split('\n');
            
            // Pre-compile regex patterns for better performance
            const dptRegex = /DPT=(\d+)/;
            const srcRegex = /SRC=([0-9a-fA-F.:]+)/;
            const timeRegex = /^(\w+\s+\d+\s+[\d:]+)/;
            const protoRegex = /PROTO=(\w+)/;
            
            for (const line of logLines) {
                const dptMatch = line.match(dptRegex);
                const srcMatch = line.match(srcRegex);
                const timeMatch = line.match(timeRegex);
                
                const port = dptMatch ? dptMatch[1] : null;
                const ip = srcMatch ? srcMatch[1] : null;
                const protoMatch = line.match(protoRegex);
                const external = isExternal(ip);

                if (timeMatch) times.push(timeMatch[1]);

                if (external && port) {
                    byPort[port] = (byPort[port] || 0) + 1;
                    if (protoMatch) {
                        const proto = protoMatch[1].toUpperCase();
                        byProto[proto] = (byProto[proto] || 0) + 1;
                    }
                }
                
                if (external) {
                    byIp[ip] = (byIp[ip] || 0) + 1;
                    
                    // Track ports per IP
                    if (port) {
                        if (!ipPorts[ip]) ipPorts[ip] = {};
                        ipPorts[ip][port] = (ipPorts[ip][port] || 0) + 1;
                    }
                }
                
                // Collect recent entries (only external IPs with ports)
                if (external && port) {
                    if (protoMatch) {
                        recent.push({
                            time: timeMatch ? timeMatch[1] : 'Unknown',
                            src: ip,
                            port: port,
                            proto: protoMatch[1]
                        });
                    }
                }
            }

            // Sort ports by count - optimized without spread operator
            const sortedPorts = {};
            Object.entries(byPort)
                .sort((a, b) => b[1] - a[1])
                .forEach(([k, v]) => { sortedPorts[k] = v; });

            // Sort IPs by count - optimized without spread operator
            const sortedIps = {};
            Object.entries(byIp)
                .sort((a, b) => b[1] - a[1])
                .forEach(([k, v]) => { sortedIps[k] = v; });

            // Sort protocols by count - optimized without spread operator
            const sortedProtos = {};
            Object.entries(byProto)
                .sort((a, b) => b[1] - a[1])
                .forEach(([k, v]) => { sortedProtos[k] = v; });

            const result = {
                byPort: sortedPorts,
                byProto: sortedProtos,
                byIp: sortedIps,
                ipPorts: ipPorts,
                recent: recent.slice(-15).reverse(), // Last 15, most recent first
                series: timeSeries(times), // Blocked attempts over the analyzed log range
                oldestTime: recent.length > 0 ? recent[0].time : null, // First log entry (oldest)
                total: logLines.length
            };
            
            // Update cache
            const cacheKey = `logs_${safeLines}`;
            cache.set(cacheKey, result);
            logger.debug('Cached log stats', { lines: safeLines });
            
            resolve(result);
        });
    });
};
