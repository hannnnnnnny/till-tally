import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDashboardSearchParams } from './api';

describe('dashboard API query parameters', () => {
  it('serializes a bounded dashboard date range', () => {
    assert.equal(
      buildDashboardSearchParams({ from: '2026-07-01', to: '2026-07-19' }).toString(),
      'from=2026-07-01&to=2026-07-19',
    );
  });

  it('omits an absent dashboard date range', () => {
    assert.equal(buildDashboardSearchParams().toString(), '');
  });
});
