import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    parseRuleTarget,
    mergeRules,
    familyLabel,
    groupCounts,
    filterRecent,
    portName
} from '../../src/public/logic.js';

describe('parseRuleTarget', () => {
    it('parses port-only rules', () => {
        assert.deepEqual(parseRuleTarget('80'), { port: '80', proto: 'any', v6: false });
    });

    it('parses protocol and IPv6 markers', () => {
        assert.deepEqual(parseRuleTarget('443/tcp (v6)'), { port: '443', proto: 'tcp', v6: true });
        assert.deepEqual(parseRuleTarget('53/udp'), { port: '53', proto: 'udp', v6: false });
    });
});

describe('mergeRules', () => {
    it('merges the IPv4 and IPv6 entries of the same rule', () => {
        const merged = mergeRules([
            { id: '1', to: '22/tcp', action: 'ALLOW IN', from: 'Anywhere' },
            { id: '2', to: '22/tcp (v6)', action: 'ALLOW IN', from: 'Anywhere' },
            { id: '3', to: '80', action: 'ALLOW IN', from: 'Anywhere' }
        ]);

        assert.equal(merged.length, 2);
        assert.deepEqual(merged[0].ids, ['1', '2']);
        assert.equal(familyLabel(merged[0]), 'v4 + v6');
        assert.equal(familyLabel(merged[1]), 'v4');
    });

    it('keeps different protocols and sources apart', () => {
        const merged = mergeRules([
            { id: '1', to: '53/tcp', action: 'ALLOW IN', from: 'Anywhere' },
            { id: '2', to: '53/udp', action: 'ALLOW IN', from: 'Anywhere' },
            { id: '3', to: '53/udp', action: 'ALLOW IN', from: '10.0.0.1' }
        ]);

        assert.equal(merged.length, 3);
    });

    it('sorts numerically by port', () => {
        const merged = mergeRules([
            { id: '1', to: '443', action: 'ALLOW IN', from: 'Anywhere' },
            { id: '2', to: '22', action: 'ALLOW IN', from: 'Anywhere' }
        ]);

        assert.deepEqual(merged.map((group) => group.port), ['22', '443']);
    });
});

describe('groupCounts', () => {
    it('returns the highest counts first, limited', () => {
        assert.deepEqual(groupCounts({ '22': 3, '80': 10, '443': 1 }, 2), [
            { key: '80', count: 10 },
            { key: '22', count: 3 }
        ]);
    });
});

describe('filterRecent', () => {
    const entries = [
        { src: '1.1.1.1', port: '22' },
        { src: '2.2.2.2', port: '80' }
    ];

    it('returns everything without a filter', () => {
        assert.equal(filterRecent(entries, null).length, 2);
    });

    it('filters by source IP', () => {
        assert.deepEqual(filterRecent(entries, '2.2.2.2'), [entries[1]]);
    });
});

describe('portName', () => {
    it('maps known ports and returns empty for unknown ones', () => {
        assert.equal(portName('22'), 'SSH');
        assert.equal(portName(443), 'HTTPS');
        assert.equal(portName('12345'), '');
    });
});
