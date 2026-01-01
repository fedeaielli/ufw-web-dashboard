import { describe, it, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimiter } from '../../src/middleware/rateLimit.js';

describe('Rate Limit Middleware', () => {
    // Force exit after tests (setInterval in rateLimit keeps process alive)
    after(() => {
        process.exit(0);
    });
    it('should allow first request', () => {
        const limiter = rateLimiter(5, 60000);
        const req = {
            headers: {},
            socket: { remoteAddress: `127.0.0.${Math.random()}` } // Unique IP
        };
        const res = {
            status: mock.fn(() => res),
            json: mock.fn(),
            set: mock.fn()
        };
        const next = mock.fn();
        
        limiter(req, res, next);
        assert.equal(next.mock.calls.length, 1);
        assert.equal(res.status.mock.calls.length, 0);
    });

    it('should block requests over limit', () => {
        const limiter = rateLimiter(2, 60000);
        const uniqueIp = `10.0.0.${Math.floor(Math.random() * 255)}`;
        const req = {
            headers: {},
            socket: { remoteAddress: uniqueIp }
        };
        const res = {
            status: mock.fn(() => res),
            json: mock.fn(),
            set: mock.fn()
        };
        const next = mock.fn();
        
        // First two requests should pass
        limiter(req, res, next);
        limiter(req, res, next);
        assert.equal(next.mock.calls.length, 2);
        
        // Third request should be blocked
        limiter(req, res, next);
        assert.equal(res.status.mock.calls[0].arguments[0], 429);
        assert.equal(next.mock.calls.length, 2);
    });

    it('should track different IPs separately', () => {
        const limiter = rateLimiter(1, 60000);
        
        const req1 = {
            headers: {},
            socket: { remoteAddress: `192.168.1.${Math.floor(Math.random() * 255)}` }
        };
        const req2 = {
            headers: {},
            socket: { remoteAddress: `192.168.2.${Math.floor(Math.random() * 255)}` }
        };
        const res = {
            status: mock.fn(() => res),
            json: mock.fn(),
            set: mock.fn()
        };
        const next = mock.fn();
        
        limiter(req1, res, next);
        limiter(req2, res, next);
        
        assert.equal(next.mock.calls.length, 2);
    });
});
