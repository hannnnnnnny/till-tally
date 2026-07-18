import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { executeAnalyticsPlan, planAnalyticsQuestion, previewAnalyticsPlan } from './api';
import { type AnalyticsPlan } from './types';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('analytics workspace API', () => {
  it('plans a bounded question with business headers and cancellation', async () => {
    const controller = new AbortController();
    let captured: { input?: RequestInfo | URL; init?: RequestInit } = {};
    globalThis.fetch = async (input, init) => {
      captured = { input, init };
      return jsonResponse({
        status: 'clarification',
        source: 'local',
        message: 'Which metric?',
        examples: ['Revenue by channel'],
      });
    };

    const response = await planAnalyticsQuestion(
      { Authorization: 'Bearer token', 'X-Business-Id': 'business-1' },
      { question: 'Compare performance this month', timezone: 'Pacific/Auckland' },
      { signal: controller.signal },
    );

    assert.equal(captured.input, '/api/analytics/plan');
    assert.equal(captured.init?.method, 'POST');
    assert.equal(captured.init?.signal, controller.signal);
    assert.equal(new Headers(captured.init?.headers).get('Content-Type'), 'application/json');
    assert.equal(new Headers(captured.init?.headers).get('X-Business-Id'), 'business-1');
    assert.deepEqual(JSON.parse(String(captured.init?.body)), {
      question: 'Compare performance this month',
      timezone: 'Pacific/Auckland',
    });
    assert.equal(response.status, 'clarification');
  });

  it('previews and executes the exact reviewed plan', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ path: String(input), body: JSON.parse(String(init?.body)) });
      return jsonResponse(
        String(input).endsWith('/preview')
          ? {
              title: 'Revenue by day',
              plan: validPlan,
              datasets: ['orders'],
              table: { columns: [] },
              chart: { type: 'line', categoryKey: 'day' },
            }
          : {
              title: 'Revenue by day',
              plan: validPlan,
              datasets: ['orders'],
              table: { columns: [], rows: [] },
              chart: { type: 'line', categoryKey: 'day', series: [] },
              meta: {
                rowCount: 0,
                totalRows: 0,
                truncated: false,
                durationMs: 1,
                executedAt: '2026-07-19T00:00:00.000Z',
              },
            },
      );
    };

    await previewAnalyticsPlan({}, validPlan);
    await executeAnalyticsPlan({}, validPlan);

    assert.deepEqual(calls, [
      { path: '/api/analytics/preview', body: validPlan },
      { path: '/api/analytics/execute', body: validPlan },
    ]);
  });

  it('surfaces safe structured API errors without response internals', async () => {
    globalThis.fetch = async () =>
      jsonResponse(
        { error: { code: 'INVALID_ANALYTICS_REQUEST', message: 'Question is too short' } },
        400,
      );

    await assert.rejects(
      () => planAnalyticsQuestion({}, { question: 'x', timezone: 'Pacific/Auckland' }),
      /Question is too short/,
    );
  });
});

const validPlan: AnalyticsPlan = {
  schemaVersion: 1,
  metrics: ['revenue'],
  dimensions: ['day'],
  dateRange: { from: '2026-07-01', to: '2026-07-19', timezone: 'Pacific/Auckland' },
  filters: [],
  sort: [{ field: 'day', direction: 'asc' }],
  limit: 31,
  chart: { type: 'line' },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
