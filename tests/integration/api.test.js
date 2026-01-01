import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';

/**
 * Integration tests for API endpoints
 * Note: These tests require the server to be running
 * Run with: NODE_ENV=test npm test
 */

const BASE_URL = 'http://127.0.0.1:3300';
const AUTH = Buffer.from('admin:testpass123').toString('base64');

// Helper to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            headers: {
                'Authorization': `Basic ${AUTH}`,
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = body ? JSON.parse(body) : {};
                    resolve({ status: res.statusCode, headers: res.headers, body: json });
                } catch {
                    resolve({ status: res.statusCode, headers: res.headers, body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

describe('API Integration Tests', { skip: true }, () => {
    describe('Health Endpoint', () => {
        it('should return health status without auth', async () => {
            const res = await makeRequest('GET', '/health', null, { 'Authorization': '' });
            assert.equal(res.status, 200);
            assert.ok(res.body.status);
            assert.ok(res.body.uptime);
        });
    });

    describe('CSRF Token', () => {
        it('should return CSRF token', async () => {
            const res = await makeRequest('GET', '/api/csrf-token');
            assert.equal(res.status, 200);
            assert.ok(res.body.token);
        });
    });

    describe('Whoami Endpoint', () => {
        it('should return client IP', async () => {
            const res = await makeRequest('GET', '/api/whoami');
            assert.equal(res.status, 200);
            assert.ok(res.body.ip);
        });
    });

    describe('Rules Endpoint', () => {
        it('should list UFW rules', async () => {
            const res = await makeRequest('GET', '/api/rules');
            assert.equal(res.status, 200);
            assert.ok(res.body.status);
            assert.ok(Array.isArray(res.body.rules));
        });
    });

    describe('Logs Endpoint', () => {
        it('should return log stats', async () => {
            const res = await makeRequest('GET', '/api/logs');
            assert.equal(res.status, 200);
            assert.ok(res.body.byPort !== undefined);
            assert.ok(res.body.byIp !== undefined);
        });

        it('should accept lines parameter', async () => {
            const res = await makeRequest('GET', '/api/logs?lines=500');
            assert.equal(res.status, 200);
        });
    });

    describe('Authentication', () => {
        it('should reject requests without auth', async () => {
            const res = await makeRequest('GET', '/api/rules', null, { 'Authorization': '' });
            assert.equal(res.status, 401);
        });

        it('should reject requests with invalid auth', async () => {
            const badAuth = Buffer.from('wrong:credentials').toString('base64');
            const res = await makeRequest('GET', '/api/rules', null, { 'Authorization': `Basic ${badAuth}` });
            assert.equal(res.status, 401);
        });
    });
});
