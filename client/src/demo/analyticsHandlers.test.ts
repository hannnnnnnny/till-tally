import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAnalyticsRoutes,
  findClosestPreset,
  normalizeQuestion,
  type DemoAnalyticsFixture,
} from './analyticsHandlers';
import { createMemoryStorage } from './demoStorage';
import { createSavedReportStore, type SavedReport } from './savedReports';
import { matchDemoRoute, type DemoRequest, type DemoResponse } from './router';

const fixture: DemoAnalyticsFixture = {
  clarification: { source: 'local', status: 'clarification' },
  presets: [
    {
      execution: 'revenue-by-day-result',
      plan: {
        plan: { chart: { type: 'line' }, dimensions: ['day'], metrics: ['revenue'] },
        status: 'ready',
      },
      preview: 'revenue-by-day-preview',
      question: 'Show daily revenue this month',
    },
    {
      execution: 'margin-by-channel-result',
      plan: {
        plan: { chart: { type: 'bar' }, dimensions: ['channel'], metrics: ['grossMarginPct'] },
        status: 'ready',
      },
      preview: 'margin-by-channel-preview',
      question: 'Gross margin by channel this month',
    },
  ],
};

const seedReport: SavedReport = {
  compatibilityMessage: null,
  compatible: true,
  createdAt: '2026-07-18T00:00:00.000Z',
  currentVersion: 1,
  id: 'seeded-1',
  latestVersion: {
    createdAt: '2026-07-18T00:00:00.000Z',
    plan: { metrics: ['revenue'] },
    schemaVersion: 1,
    source: 'local',
    version: 1,
  },
  name: 'Daily revenue pulse',
  versions: [{ createdAt: '2026-07-18T00:00:00.000Z', schemaVersion: 1, source: 'local', version: 1 }],
};

function createCaller(routes: ReturnType<typeof createAnalyticsRoutes>) {
  return (
    method: string,
    path: string,
    body?: unknown,
  ): DemoResponse | Promise<DemoResponse> => {
    const match = matchDemoRoute(routes, method, path);
    assert.ok(match, `expected route for ${method} ${path}`);

    const request: DemoRequest = {
      body,
      method,
      params: match.params,
      searchParams: new URLSearchParams(),
    };

    return match.handler(request);
  };
}

describe('demo analytics handlers', () => {
  it('normalizes questions for matching', () => {
    assert.equal(normalizeQuestion('  Show DAILY revenue, this month!  '), 'show daily revenue this month');
  });

  it('serves preset plans and falls back to clarification', async () => {
    const store = createSavedReportStore(createMemoryStorage(), [seedReport]);
    const call = createCaller(createAnalyticsRoutes(fixture, store));

    const preset = await call('POST', '/api/analytics/plan', {
      question: 'show daily revenue this month?',
    });
    assert.deepEqual(preset.json, fixture.presets[0].plan);

    const clarification = await call('POST', '/api/analytics/plan', {
      question: 'what should I stock for winter',
    });
    assert.deepEqual(clarification.json, fixture.clarification);
  });

  it('matches executions by metric and dimension overlap', () => {
    const closest = findClosestPreset(fixture.presets, {
      chart: { type: 'bar' },
      dimensions: ['channel'],
      metrics: ['grossMarginPct'],
    });
    assert.equal(closest.execution, 'margin-by-channel-result');

    const chartOnly = findClosestPreset(fixture.presets, {
      chart: { type: 'bar' },
      dimensions: ['category'],
      metrics: ['orders'],
    });
    assert.equal(chartOnly.execution, 'margin-by-channel-result');

    const noOverlap = findClosestPreset(fixture.presets, {
      chart: { type: 'area' },
      dimensions: ['category'],
      metrics: ['orders'],
    });
    assert.equal(noOverlap.execution, 'revenue-by-day-result');
  });

  it('supports the full saved-report lifecycle backed by storage', async () => {
    const storage = createMemoryStorage();
    const store = createSavedReportStore(storage, [seedReport], () => '2026-07-19T00:00:00.000Z');
    const call = createCaller(createAnalyticsRoutes(fixture, store));

    const created = (await call('POST', '/api/analytics/saved-reports', {
      name: 'Channel margin',
      plan: { metrics: ['grossMarginPct'] },
      source: 'local',
    })) as { json: SavedReport; status: number };
    assert.equal(created.status, 201);

    const renamed = await call('PATCH', `/api/analytics/saved-reports/${created.json.id}`, {
      name: 'Margin watch',
    });
    assert.equal((renamed.json as SavedReport).name, 'Margin watch');

    const versioned = await call(
      'POST',
      `/api/analytics/saved-reports/${created.json.id}/versions`,
      { plan: { metrics: ['revenue'] }, source: 'local' },
    );
    assert.equal((versioned.json as SavedReport).currentVersion, 2);

    const removed = await call('DELETE', `/api/analytics/saved-reports/${created.json.id}`);
    assert.equal(removed.status, 204);

    const list = (await call('GET', '/api/analytics/saved-reports')) as {
      json: { reports: SavedReport[] };
    };
    assert.deepEqual(
      list.json.reports.map((report) => report.id),
      ['seeded-1'],
    );
  });
});
