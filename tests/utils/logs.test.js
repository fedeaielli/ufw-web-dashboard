import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isExternal } from '../../src/services/logs.js';

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
