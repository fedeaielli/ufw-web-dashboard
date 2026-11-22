import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

import config from '../../src/config.js';
import { verifyCredentials } from '../../src/middleware/auth.js';
import {
    createSession,
    getSession,
    destroySession,
    parseCookies,
    requireAuth
} from '../../src/middleware/session.js';

const fakeReq = (cookie = '') => ({ headers: { cookie }, secure: false, socket: {} });
const fakeRes = () => ({
    headers: {},
    setHeader(name, value) { this.headers[name] = value; }
});
const sidFrom = (res) => /sid=([a-f0-9]{64})/.exec(res.headers['Set-Cookie'])?.[1] || null;

describe('parseCookies', () => {
    it('parses a cookie header', () => {
        assert.deepEqual(parseCookies('a=1; sid=abc'), { a: '1', sid: 'abc' });
        assert.deepEqual(parseCookies(''), {});
    });
});

describe('sessions', () => {
    const originalTtl = config.auth.sessionTtl;

    after(() => { config.auth.sessionTtl = originalTtl; });

    it('creates a session with a hardened cookie', () => {
        const res = fakeRes();
        createSession(fakeReq(), res);

        const cookie = res.headers['Set-Cookie'];
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Strict/);
        assert.match(cookie, /Path=\//);
        assert.match(cookie, /Max-Age=43200/);
        assert.ok(sidFrom(res));
    });

    it('resolves a valid session and rejects unknown ids', () => {
        const res = fakeRes();
        createSession(fakeReq(), res);

        assert.ok(getSession(fakeReq(`sid=${sidFrom(res)}`)));
        assert.equal(getSession(fakeReq('sid=deadbeef')), null);
        assert.equal(getSession(fakeReq()), null);
    });

    it('destroys the session and clears the cookie', () => {
        const res = fakeRes();
        createSession(fakeReq(), res);
        const cookie = `sid=${sidFrom(res)}`;

        const clearRes = fakeRes();
        destroySession(fakeReq(cookie), clearRes);

        assert.match(clearRes.headers['Set-Cookie'], /Max-Age=0/);
        assert.equal(getSession(fakeReq(cookie)), null);
    });

    it('expires idle sessions', async () => {
        config.auth.sessionTtl = 1;

        const res = fakeRes();
        createSession(fakeReq(), res);
        const cookie = `sid=${sidFrom(res)}`;

        await new Promise((resolve) => setTimeout(resolve, 5));
        assert.equal(getSession(fakeReq(cookie)), null);
    });

    it('marks authenticated responses as no-store', () => {
        config.auth.sessionTtl = originalTtl;

        const res = fakeRes();
        createSession(fakeReq(), res);
        const cookie = `sid=${sidFrom(res)}`;

        let called = false;
        requireAuth(fakeReq(cookie), res, () => { called = true; });

        assert.equal(called, true);
        assert.equal(res.headers['Cache-Control'], 'no-store');
    });
});

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
