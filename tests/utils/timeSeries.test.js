import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { timeSeries } from '../../src/services/logs.js';

describe('timeSeries', () => {
    it('returns no buckets for empty input', () => {
        assert.deepEqual(timeSeries([]), []);
    });

    it('uses one bucket per entry when there are fewer lines than bins', () => {
        const series = timeSeries(['a', 'b', 'c'], 24);

        assert.equal(series.length, 3);
        assert.deepEqual(series[1], { t: 'b', count: 1 });
    });

    it('keeps every line and stays within the requested bins', () => {
        const times = Array.from({ length: 100 }, (_, index) => `t${index}`);
        const series = timeSeries(times, 10);

        assert.equal(series.length, 10);
        assert.equal(series.reduce((sum, bucket) => sum + bucket.count, 0), 100);
        assert.equal(series[0].t, 't0');
        assert.equal(series[9].t, 't90');
    });
});
