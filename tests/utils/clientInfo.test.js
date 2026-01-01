import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp, getClientFingerprint, getClientInfo } from '../../src/utils/clientInfo.js';

describe('Client Info Utils', () => {
    describe('getClientIp', () => {
        it('should extract IP from x-forwarded-for', () => {
            const req = {
                headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
                socket: {}
            };
            assert.equal(getClientIp(req), '1.2.3.4');
        });

        it('should extract IP from x-real-ip', () => {
            const req = {
                headers: { 'x-real-ip': '9.8.7.6' },
                socket: {}
            };
            assert.equal(getClientIp(req), '9.8.7.6');
        });

        it('should extract IP from socket.remoteAddress', () => {
            const req = {
                headers: {},
                socket: { remoteAddress: '::ffff:127.0.0.1' }
            };
            assert.equal(getClientIp(req), '127.0.0.1');
        });

        it('should return unknown if no IP found', () => {
            const req = {
                headers: {},
                socket: {}
            };
            assert.equal(getClientIp(req), 'unknown');
        });
    });

    describe('getClientFingerprint', () => {
        it('should generate consistent fingerprint', () => {
            const req = {
                headers: { 'user-agent': 'TestAgent' },
                socket: { remoteAddress: '127.0.0.1' }
            };
            const fp1 = getClientFingerprint(req);
            const fp2 = getClientFingerprint(req);
            assert.equal(fp1, fp2);
            assert.equal(fp1.length, 64); // SHA-256 hex length
        });

        it('should generate different fingerprints for different clients', () => {
            const req1 = {
                headers: { 'user-agent': 'Agent1' },
                socket: { remoteAddress: '127.0.0.1' }
            };
            const req2 = {
                headers: { 'user-agent': 'Agent2' },
                socket: { remoteAddress: '127.0.0.1' }
            };
            const fp1 = getClientFingerprint(req1);
            const fp2 = getClientFingerprint(req2);
            assert.notEqual(fp1, fp2);
        });
    });

    describe('getClientInfo', () => {
        it('should return complete client info', () => {
            const req = {
                headers: { 'user-agent': 'TestAgent' },
                socket: { remoteAddress: '127.0.0.1' }
            };
            const info = getClientInfo(req);
            assert.equal(info.ip, '127.0.0.1');
            assert.equal(info.userAgent, 'TestAgent');
        });
    });
});
