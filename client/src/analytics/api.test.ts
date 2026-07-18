import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  createSavedAnalyticsReport,
  deleteSavedAnalyticsReport,
  executeAnalyticsPlan,
  listSavedAnalyticsReports,
  planAnalyticsQuestion,
  previewAnalyticsPlan,
  renameSavedAnalyticsReport,
} from './api';
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

  it('calls the scoped saved report lifecycle endpoints', async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({
        path: String(input),
        method: String(init?.method),
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
      });
      return String(init?.method) === 'DELETE'
        ? new Response(null, { status: 204 })
        : jsonResponse(String(init?.method) === 'GET' ? { reports: [] } : savedReportResponse());
    };

    await listSavedAnalyticsReports({ 'X-Business-Id': 'business-1' });
    await createSavedAnalyticsReport({}, { name: 'Revenue', plan: validPlan, source: 'local' });
    await renameSavedAnalyticsReport({}, 'report/1', 'Revenue pulse');
    await deleteSavedAnalyticsReport({}, 'report/1');

    assert.deepEqual(calls, [
      { path: '/api/analytics/saved-reports', method: 'GET' },
      {
        path: '/api/analytics/saved-reports',
        method: 'POST',
        body: { name: 'Revenue', plan: validPlan, source: 'local' },
      },
      {
        path: '/api/analytics/saved-reports/report%2F1',
        method: 'PATCH',
        body: { name: 'Revenue pulse' },
      },
      { path: '/api/analytics/saved-reports/report%2F1', method: 'DELETE' },
    ]);
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

function savedReportResponse() {
  return {
    id: 'report-1',
    name: 'Revenue',
    currentVersion: 1,
    compatible: true,
    compatibilityMessage: null,
    latestVersion: {
      version: 1,
      schemaVersion: 1,
      source: 'local',
      plan: validPlan,
      createdAt: '2026-07-19T00:00:00.000Z',
    },
    versions: [],
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
  };
}
