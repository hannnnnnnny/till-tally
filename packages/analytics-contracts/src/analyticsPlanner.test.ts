import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA,
  parseAnalyticsPlannerOutput,
  parseAnalyticsPlannerRequest,
} from './analyticsPlanner';

const validPlan = {
  schemaVersion: 1,
  metrics: ['revenue'],
  dimensions: ['day'],
  dateRange: { from: '2026-07-01', to: '2026-07-19', timezone: 'Pacific/Auckland' },
  filters: [],
  sort: [{ field: 'day', direction: 'asc' }],
  limit: 31,
  chart: { type: 'line' },
};

describe('analytics planner contracts', () => {
  it('normalizes bounded planner requests', () => {
    const request = parseAnalyticsPlannerRequest({
      question: '  Show daily revenue this month  ',
      timezone: 'Pacific/Auckland',
      today: '2026-07-19',
    });

    assert.deepEqual(request, {
      question: 'Show daily revenue this month',
      timezone: 'Pacific/Auckland',
      today: '2026-07-19',
    });
    assert.throws(() =>
      parseAnalyticsPlannerRequest({ question: 'x'.repeat(501), timezone: 'UTC' }),
    );
    assert.throws(() =>
      parseAnalyticsPlannerRequest({ question: 'Show revenue', today: '2026-02-30' }),
    );
  });

  it('accepts ready, clarification, and unsupported provider outputs', () => {
    assert.equal(
      parseAnalyticsPlannerOutput({
        status: 'ready',
        plan: validPlan,
        message: 'Daily revenue for the current month.',
      }).status,
      'ready',
    );
    assert.equal(
      parseAnalyticsPlannerOutput({
        status: 'clarification',
        message: 'Which date range should I use?',
        examples: ['Revenue this month'],
      }).status,
      'clarification',
    );
    assert.equal(
      parseAnalyticsPlannerOutput({
        status: 'unsupported',
        message: 'Customer forecasting is not available yet.',
        examples: ['Top products by revenue'],
      }).status,
      'unsupported',
    );
  });

  it('rejects unsafe or invalid provider output', () => {
    assert.throws(() =>
      parseAnalyticsPlannerOutput({
        status: 'ready',
        plan: { ...validPlan, rawSql: 'select * from orders' },
        message: 'Run a raw query.',
      }),
    );
    assert.throws(() =>
      parseAnalyticsPlannerOutput({
        status: 'clarification',
        message: 'Need more details.',
        examples: [],
        javascript: 'fetch("/secrets")',
      }),
    );
  });

  it('exports a strict JSON Schema for structured model output', () => {
    assert.equal(ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA.type, 'object');
    assert.equal(ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA.additionalProperties, false);
    assert.ok(Array.isArray(ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA.oneOf));
    assert.equal(ANALYTICS_PLANNER_OUTPUT_JSON_SCHEMA.oneOf.length, 3);
  });
});
