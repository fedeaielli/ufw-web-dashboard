import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    parseRuleTarget,
    mergeRules,
    familyLabel,
    groupCounts,
    filterRecent,
    portName,
    protocolLabel,
    donutSlices,
    protocolStats,
    serviceCategories,
    distinctServices,
    countsForIp
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
            { id: '2', to: '22/tcp (v6)', action: 'ALLOW IN', from: 'Anywhere (v6)' },
            { id: '3', to: '80', action: 'ALLOW IN', from: 'Anywhere' }
        ]);

        assert.equal(merged.length, 2);
        assert.deepEqual(merged[0].ids, ['1', '2']);
        assert.equal(merged[0].from, 'Anywhere');
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

describe('protocolLabel', () => {
    it('labels protocol-less rules as both protocols', () => {
        assert.equal(protocolLabel('any'), 'TCP + UDP');
        assert.equal(protocolLabel(''), 'TCP + UDP');
        assert.equal(protocolLabel('tcp'), 'TCP');
        assert.equal(protocolLabel('udp'), 'UDP');
    });
});

describe('donutSlices', () => {
    it('adds an Other slice for ports outside the top N', () => {
        const { total, slices } = donutSlices({ '22': 6, '80': 3, '443': 1 }, 2);

        assert.equal(total, 10);
        assert.deepEqual(slices.map((slice) => [slice.key, slice.count]), [
            ['22', 6],
            ['80', 3],
            ['Other', 1]
        ]);
        assert.equal(slices[2].percent, 10);
    });

    it('returns no slices for empty data', () => {
        assert.deepEqual(donutSlices({}), { total: 0, slices: [] });
    });
});

describe('protocolStats', () => {
    it('normalizes names and computes percentages', () => {
        assert.deepEqual(protocolStats({ tcp: 8, udp: 2 }), [
            { name: 'TCP', count: 8, percent: 80 },
            { name: 'UDP', count: 2, percent: 20 }
        ]);
    });
});

describe('serviceCategories', () => {
    it('groups known ports and leaves the rest in Other', () => {
        const categories = serviceCategories({ '22': 2, '80': 3, '443': 1, '9999': 4 });
        const byName = Object.fromEntries(categories.map((item) => [item.name, item]));

        assert.equal(byName.Web.count, 4);
        assert.equal(byName['Remote access'].count, 2);
        assert.equal(byName.Other.count, 4);
        assert.equal(byName.Other.percent, 40);
    });
});

describe('distinctServices', () => {
    it('counts known service names only once', () => {
        assert.equal(distinctServices([{ port: '22' }, { port: '22' }, { port: '443' }, { port: '12345' }]), 2);
    });
});

describe('countsForIp', () => {
    const logs = { byPort: { '80': 3 }, ipPorts: { '1.2.3.4': { '22': 5 } } };

    it('uses the selected IP targets when available', () => {
        assert.deepEqual(countsForIp(logs, '1.2.3.4'), { '22': 5 });
    });

    it('falls back to all ports', () => {
        assert.deepEqual(countsForIp(logs, null), { '80': 3 });
        assert.deepEqual(countsForIp(logs, '9.9.9.9'), { '80': 3 });
    });
});
