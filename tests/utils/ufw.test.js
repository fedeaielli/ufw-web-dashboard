import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseUfwStatus } from '../../src/services/ufw.js';

describe('parseUfwStatus', () => {
    it('parses active rules and ignores malformed lines', () => {
        const raw = [
            'Status: active',
            '',
            '     To                         Action      From',
            '     --                         ------      ----',
            '[ 1] 22/tcp                     ALLOW IN    Anywhere',
            '[ 2] 80/tcp                     DENY IN     192.168.1.5',
            'this is not a rule',
            ''
        ].join('\n');

        const result = parseUfwStatus(raw);

        assert.equal(result.status, 'active');
        assert.equal(result.rules.length, 2);
        assert.deepEqual(result.rules[0], {
            id: '1',
            to: '22/tcp',
            action: 'ALLOW IN',
            from: 'Anywhere'
        });
        assert.deepEqual(result.rules[1], {
            id: '2',
            to: '80/tcp',
            action: 'DENY IN',
            from: '192.168.1.5'
        });
    });

    it('parses an inactive firewall', () => {
        assert.deepEqual(parseUfwStatus('Status: inactive\n'), {
            status: 'inactive',
            rules: []
        });
    });
});
