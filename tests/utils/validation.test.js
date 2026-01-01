import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    isValidPort,
    isValidProtocol,
    isValidRuleType,
    isValidIPv4,
    isValidCIDR,
    isValidSource,
    sanitizePort,
    sanitizeProtocol,
    sanitizeRuleType,
    sanitizeSource,
    sanitizeRuleId,
    sanitizeLogLines
} from '../../src/utils/validation.js';

describe('Validation Utils', () => {
    describe('isValidPort', () => {
        it('should accept valid ports', () => {
            assert.equal(isValidPort(80), true);
            assert.equal(isValidPort(443), true);
            assert.equal(isValidPort(3000), true);
            assert.equal(isValidPort(65535), true);
        });

        it('should reject invalid ports', () => {
            assert.equal(isValidPort(0), false);
            assert.equal(isValidPort(-1), false);
            assert.equal(isValidPort(65536), false);
            assert.equal(isValidPort('abc'), false);
        });
    });

    describe('isValidProtocol', () => {
        it('should accept valid protocols', () => {
            assert.equal(isValidProtocol('tcp'), true);
            assert.equal(isValidProtocol('udp'), true);
            assert.equal(isValidProtocol('both'), true);
        });

        it('should reject invalid protocols', () => {
            assert.equal(isValidProtocol('http'), false);
            assert.equal(isValidProtocol('TCP'), false);
            assert.equal(isValidProtocol(''), false);
        });
    });

    describe('isValidRuleType', () => {
        it('should accept valid rule types', () => {
            assert.equal(isValidRuleType('allow'), true);
            assert.equal(isValidRuleType('deny'), true);
        });

        it('should reject invalid rule types', () => {
            assert.equal(isValidRuleType('reject'), false);
            assert.equal(isValidRuleType('ALLOW'), false);
        });
    });

    describe('isValidIPv4', () => {
        it('should accept valid IPv4 addresses', () => {
            assert.equal(isValidIPv4('192.168.1.1'), true);
            assert.equal(isValidIPv4('10.0.0.1'), true);
            assert.equal(isValidIPv4('255.255.255.255'), true);
        });

        it('should reject invalid IPv4 addresses', () => {
            assert.equal(isValidIPv4('256.1.1.1'), false);
            assert.equal(isValidIPv4('192.168.1'), false);
            assert.equal(isValidIPv4('abc.def.ghi.jkl'), false);
        });
    });

    describe('isValidCIDR', () => {
        it('should accept valid CIDR notation', () => {
            assert.equal(isValidCIDR('192.168.1.0/24'), true);
            assert.equal(isValidCIDR('10.0.0.0/8'), true);
        });

        it('should reject invalid CIDR notation', () => {
            assert.equal(isValidCIDR('192.168.1.0/33'), false);
            assert.equal(isValidCIDR('192.168.1.0'), false);
        });
    });

    describe('sanitizePort', () => {
        it('should sanitize valid ports', () => {
            assert.equal(sanitizePort('3000'), '3000');
            assert.equal(sanitizePort(443), '443');
        });

        it('should throw on invalid ports', () => {
            assert.throws(() => sanitizePort('abc'), /Invalid port/);
            assert.throws(() => sanitizePort(0), /Invalid port/);
        });
    });

    describe('sanitizeRuleId', () => {
        it('should sanitize valid rule IDs', () => {
            assert.equal(sanitizeRuleId('123'), '123');
            assert.equal(sanitizeRuleId(5), '5');
        });

        it('should throw on invalid rule IDs', () => {
            assert.throws(() => sanitizeRuleId('0'), /Invalid rule ID/);
            assert.throws(() => sanitizeRuleId('abc'), /Invalid rule ID/);
        });
    });

    describe('sanitizeLogLines', () => {
        it('should sanitize valid line counts', () => {
            assert.equal(sanitizeLogLines(100, 1000), 100);
            assert.equal(sanitizeLogLines(5000, 10000), 5000);
        });

        it('should cap at maximum', () => {
            assert.equal(sanitizeLogLines(100000, 10000), 50000);
        });

        it('should use default on invalid input', () => {
            assert.equal(sanitizeLogLines('abc', 1000), 1000);
            assert.equal(sanitizeLogLines(-1, 1000), 1000);
        });
    });
});
