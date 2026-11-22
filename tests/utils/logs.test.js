import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isExternal, aggregateLogLines } from '../../src/services/logs.js';

const privateLine = 'Nov 22 18:48:33 debian-fede kernel: [UFW BLOCK] IN=enp2s0 OUT= MAC=aa:bb SRC=192.168.50.78 DST=192.168.50.79 PROTO=UDP SPT=34140 DPT=32903 LEN=482';
const publicLine = 'Nov 22 18:49:00 debian-fede kernel: [UFW BLOCK] IN=enp2s0 OUT= MAC=aa:bb SRC=8.8.8.8 DST=192.168.50.79 PROTO=TCP SPT=1234 DPT=443 LEN=60';

describe('isExternal', () => {
    it('accepts public IPv4 addresses', () => {
        assert.equal(isExternal('8.8.8.8'), true);
        assert.equal(isExternal('1.1.1.1'), true);
        assert.equal(isExternal('203.0.113.9'), true);
    });

    it('rejects RFC1918 private ranges', () => {
        assert.equal(isExternal('10.0.0.1'), false);
        assert.equal(isExternal('172.16.0.1'), false);
        assert.equal(isExternal('172.31.255.255'), false);
        assert.equal(isExternal('192.168.1.1'), false);
        assert.equal(isExternal('172.15.0.1'), true);
        assert.equal(isExternal('172.32.0.1'), true);
    });

    it('rejects loopback, link-local, CGNAT and reserved ranges', () => {
        assert.equal(isExternal('127.0.0.1'), false);
        assert.equal(isExternal('169.254.1.1'), false);
        assert.equal(isExternal('100.64.0.1'), false);
        assert.equal(isExternal('100.128.0.1'), true);
        assert.equal(isExternal('0.0.0.0'), false);
        assert.equal(isExternal('224.0.0.1'), false);
        assert.equal(isExternal('255.255.255.255'), false);
    });

    it('rejects IPv6 and non-addresses', () => {
        assert.equal(isExternal('2001:db8::1'), false);
        assert.equal(isExternal('::ffff:8.8.8.8'), false);
        assert.equal(isExternal(''), false);
        assert.equal(isExternal(undefined), false);
    });
});

describe('aggregateLogLines', () => {
    it('counts targeted ports even when the source is private', () => {
        const result = aggregateLogLines([privateLine]);

        assert.deepEqual(result.byPort, { '32903': 1 });
        assert.deepEqual(result.byProto, { UDP: 1 });
        assert.deepEqual(result.byIp, {});
        assert.equal(result.recent.length, 0);
        assert.equal(result.series.length, 1);
        assert.equal(result.series[0].t, 'Nov 22 18:48:33');
        assert.equal(result.total, 1);
    });

    it('counts public sources in byIp and recent', () => {
        const result = aggregateLogLines([publicLine]);

        assert.deepEqual(result.byPort, { '443': 1 });
        assert.deepEqual(result.byIp, { '8.8.8.8': 1 });
        assert.equal(result.recent.length, 1);
        assert.equal(result.recent[0].src, '8.8.8.8');
    });
});
