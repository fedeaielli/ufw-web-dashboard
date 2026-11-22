import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

import config from '../../src/config.js';
import { verifyCredentials } from '../../src/middleware/auth.js';
import { createSession } from '../../src/middleware/session.js';
import { csrfToken, csrfProtect } from '../../src/middleware/csrf.js';

const fakeReq = (cookie = '', method = 'GET', headers = {}, body = {}) => ({
    headers: { cookie, ...headers },
    method,
    body,
    path: '/api/rules'
});

const fakeRes = () => ({
    headers: {},
    locals: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

const sidFrom = (res) => /sid=([a-f0-9]{64})/.exec(res.headers['Set-Cookie'])?.[1] || null;

const newSession = () => {
    const res = fakeRes();
    createSession(fakeReq(), res);
    return `sid=${sidFrom(res)}`;
};

const issueToken = (cookie) => {
    const res = fakeRes();
    let called = false;
    csrfToken(fakeReq(cookie), res, () => { called = true; });
    assert.equal(called, true);
    return res.locals.csrfToken;
};

const submit = (cookie, token, method = 'POST') => {
    const res = fakeRes();
    let called = false;
    const headers = token ? { 'x-csrf-token': token } : {};
    csrfProtect(fakeReq(cookie, method, headers), res, () => { called = true; });
    return { called, res };
};

describe('verifyCredentials', () => {
    const original = { user: config.auth.user, pass: config.auth.pass };

    after(() => {
        config.auth.user = original.user;
        config.auth.pass = original.pass;
    });

    it('accepts only the configured pair', () => {
        config.auth.user = 'admin';
        config.auth.pass = 'correct-horse-battery';

        assert.equal(verifyCredentials('admin', 'correct-horse-battery'), true);
        assert.equal(verifyCredentials('admin', 'wrong'), false);
        assert.equal(verifyCredentials('someone', 'correct-horse-battery'), false);
        assert.equal(verifyCredentials('', ''), false);
    });
});

describe('CSRF protection', () => {
    const originalExpiry = config.csrf.tokenExpiry;

    after(() => { config.csrf.tokenExpiry = originalExpiry; });

    it('accepts a token issued for the same session', () => {
        const cookie = newSession();
        const token = issueToken(cookie);

        const { called, res } = submit(cookie, token);

        assert.equal(called, true);
        assert.equal(res.statusCode, undefined);
    });

    it('rejects a token issued for another session', () => {
        const token = issueToken(newSession());

        const { called, res } = submit(newSession(), token);

        assert.equal(called, false);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error, 'CSRF token mismatch');
    });

    it('rejects a missing token', () => {
        const { called, res } = submit(newSession(), null);

        assert.equal(called, false);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error, 'CSRF token missing');
    });

    it('skips safe methods', () => {
        const { called } = submit(newSession(), null, 'GET');

        assert.equal(called, true);
    });

    it('rejects an expired token', async () => {
        const cookie = newSession();
        const token = issueToken(cookie);

        config.csrf.tokenExpiry = 1;
        await new Promise((resolve) => setTimeout(resolve, 5));

        const { called, res } = submit(cookie, token);

        assert.equal(called, false);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error, 'CSRF token expired');
    });

    it('rejects a reused token', () => {
        config.csrf.tokenExpiry = originalExpiry;

        const cookie = newSession();
        const token = issueToken(cookie);

        assert.equal(submit(cookie, token).called, true);
        assert.equal(submit(cookie, token).called, false);
    });
});
