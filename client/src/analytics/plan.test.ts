import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANALYTICS_DIMENSION_OPTIONS,
  ANALYTICS_METRIC_OPTIONS,
  validateAnalyticsPlan,
} from './plan';
import { type AnalyticsPlan } from './types';

const validPlan: AnalyticsPlan = {
  schemaVersion: 1,
  metrics: ['revenue'],
  dimensions: ['day'],
  dateRange: {
    from: '2026-06-01',
    to: '2026-06-30',
    timezone: 'Pacific/Auckland',
  },
  filters: [],
  sort: [{ field: 'revenue', direction: 'desc' }],
  limit: 30,
  chart: { type: 'line' },
};

describe('analytics plan review', () => {
  it('publishes human-readable metric and dimension choices', () => {
    assert.equal(
      ANALYTICS_METRIC_OPTIONS.find(({ value }) => value === 'grossMarginPct')?.label,
      'Gross margin',
    );
    assert.equal(
      ANALYTICS_DIMENSION_OPTIONS.find(({ value }) => value === 'channel')?.label,
      'Channel',
    );
  });

  it('accepts a bounded plan that can be executed', () => {
    assert.deepEqual(validateAnalyticsPlan(validPlan), []);
  });

  it('rejects missing, duplicate, or excessive metrics', () => {
    assert.match(
      validateAnalyticsPlan({ ...validPlan, metrics: [] }).join(' '),
      /Select at least one metric/,
    );
    assert.match(
      validateAnalyticsPlan({ ...validPlan, metrics: ['revenue', 'revenue'] }).join(' '),
      /must be unique/,
    );
    assert.match(
      validateAnalyticsPlan({
        ...validPlan,
        metrics: ['revenue', 'orders', 'unitsSold', 'grossProfit'],
      }).join(' '),
      /up to three metrics/,
    );
  });

  it('rejects incompatible metric and grouping combinations', () => {
    const errors = validateAnalyticsPlan({
      ...validPlan,
      metrics: ['averageOrderValue'],
      dimensions: ['product'],
      chart: { type: 'bar' },
    });

    assert.match(errors.join(' '), /Product cannot group Average order value/);
  });

  it('rejects invalid dates, oversized ranges, and row limits', () => {
    assert.match(
      validateAnalyticsPlan({
        ...validPlan,
        dateRange: { ...validPlan.dateRange, from: '2026-02-30' },
      }).join(' '),
      /valid start date/,
    );
    assert.match(
      validateAnalyticsPlan({
        ...validPlan,
        dateRange: { ...validPlan.dateRange, from: '2026-07-01', to: '2026-06-01' },
      }).join(' '),
      /end date must be on or after/,
    );
    assert.match(
      validateAnalyticsPlan({
        ...validPlan,
        dateRange: { ...validPlan.dateRange, from: '2025-01-01', to: '2026-06-01' },
      }).join(' '),
      /cannot exceed 366 days/,
    );
    assert.match(
      validateAnalyticsPlan({ ...validPlan, limit: 101 }).join(' '),
      /between 1 and 100/,
    );
  });

  it('keeps chart choices compatible with their grouping', () => {
    assert.match(
      validateAnalyticsPlan({
        ...validPlan,
        dimensions: ['channel'],
        chart: { type: 'line' },
      }).join(' '),
      /Line charts require one time grouping/,
    );
    assert.match(
      validateAnalyticsPlan({
        ...validPlan,
        dimensions: ['day'],
        chart: { type: 'donut' },
      }).join(' '),
      /Donut charts require one category grouping/,
    );
    assert.match(
      validateAnalyticsPlan({ ...validPlan, dimensions: [], chart: { type: 'bar' } }).join(' '),
      /Bar charts require one grouping/,
    );
  });
});
