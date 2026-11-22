import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const USER = 'admin';
const PASS = 'Str0ng!Passw0rd#2026';

const FAKE_UFW = [
    '#!/bin/sh',
    'STATE="$FAKE_UFW_STATE"',
    'case "$1" in',
    '  status)',
    '    echo "Status: active"',
    '    echo "     To                         Action      From"',
    '    echo "--                         ------      ----"',
    '    n=1',
    '    while IFS= read -r line; do',
    '      echo "[ $n] $line"',
    '      n=$((n+1))',
    '    done < "$STATE"',
    '    ;;',
    '  allow|deny)',
    '    echo "$5/tcp ALLOW IN Anywhere" >> "$STATE"',
    '    ;;',
    '  delete)',
    '    sed -i "${2}d" "$STATE"',
    '    ;;',
    'esac',
    ''
].join('\n');

const freePort = () => new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        server.close(() => resolve(port));
    });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('API integration', () => {
    let child;
    let dir;
    let base;
    let stderr = '';

    const waitForHealth = async () => {
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
            try {
                const res = await fetch(`${base}/health`);
                if (res.ok) return;
            } catch {
                // server not listening yet
            }
            await sleep(50);
        }
        throw new Error(`server did not become healthy\n${stderr}`);
    };

    const login = async () => {
        const res = await fetch(`${base}/login`, {
            method: 'POST',
            redirect: 'manual',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ username: USER, password: PASS })
        });
        assert.equal(res.status, 303);
        const cookie = /sid=[a-f0-9]{64}/.exec(res.headers.get('set-cookie'))?.[0];
        assert.ok(cookie, 'session cookie set');
        return cookie;
    };

    const csrfToken = async (cookie) => {
        const res = await fetch(`${base}/api/csrf-token`, { headers: { cookie } });
        assert.equal(res.status, 200);
        return (await res.json()).token;
    };

    before(async () => {
        dir = await mkdtemp(join(tmpdir(), 'ufw-web-test-'));
        const bin = join(dir, 'bin');
        await mkdir(bin);
        await writeFile(join(dir, 'rules'), '');
        await writeFile(join(bin, 'ufw'), FAKE_UFW);
        await chmod(join(bin, 'ufw'), 0o755);

        const port = await freePort();
        base = `http://127.0.0.1:${port}`;

        child = spawn(process.execPath, ['index.js'], {
            cwd: ROOT,
            env: {
                ...process.env,
                F_USER: USER,
                F_PASS: PASS,
                PORT: String(port),
                HOST: '127.0.0.1',
                NODE_ENV: 'test',
                FAKE_UFW_STATE: join(dir, 'rules'),
                PATH: `${bin}:${process.env.PATH}`
            },
            stdio: ['ignore', 'ignore', 'pipe']
        });
        child.stderr.on('data', (chunk) => { stderr += chunk; });

        await waitForHealth();
    });

    after(async () => {
        if (child && child.exitCode === null) {
            child.kill();
            await new Promise((resolve) => {
                child.once('exit', resolve);
                setTimeout(resolve, 2000).unref();
            });
        }
        if (dir) await rm(dir, { recursive: true, force: true });
    });

    it('logs in with a cookie and adds then removes a rule', async () => {
        const cookie = await login();

        const add = await fetch(`${base}/api/rules`, {
            method: 'POST',
            headers: {
                cookie,
                'content-type': 'application/json',
                'x-csrf-token': await csrfToken(cookie)
            },
            body: JSON.stringify({ port: '8080', protocol: 'tcp', type: 'allow' })
        });
        assert.equal(add.status, 200);
        assert.deepEqual(await add.json(), { success: true });

        const listed = await fetch(`${base}/api/rules`, { headers: { cookie } });
        assert.equal(listed.headers.get('cache-control'), 'no-store');
        const rules = await listed.json();
        assert.equal(rules.status, 'active');
        assert.equal(rules.rules.length, 1);
        assert.equal(rules.rules[0].to, '8080/tcp');

        const remove = await fetch(`${base}/api/rules/1`, {
            method: 'DELETE',
            headers: { cookie, 'x-csrf-token': await csrfToken(cookie) }
        });
        assert.equal(remove.status, 200);

        const empty = await (await fetch(`${base}/api/rules`, { headers: { cookie } })).json();
        assert.equal(empty.rules.length, 0);
    });

    it('rejects API requests without a session', async () => {
        const res = await fetch(`${base}/api/rules`);
        assert.equal(res.status, 401);
    });

    it('rejects a mutation without a CSRF token', async () => {
        const cookie = await login();
        const res = await fetch(`${base}/api/rules`, {
            method: 'POST',
            headers: { cookie, 'content-type': 'application/json' },
            body: JSON.stringify({ port: '9090', protocol: 'tcp', type: 'allow' })
        });
        assert.equal(res.status, 403);
    });
});
