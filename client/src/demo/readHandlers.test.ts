import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStorage } from './demoStorage';
import { createReadRoutes, type DemoReadFixtures } from './readHandlers';
import { matchDemoRoute, type DemoRequest, type DemoResponse } from './router';

const fixtures: DemoReadFixtures = {
  dashboard: {
    ranges: {
      '30': {
        current: {
          channelBreakdown: 'channels-30-current',
          range: { from: '2026-06-20', to: '2026-07-19' },
          salesTrend: 'trend-30-current',
          summary: 'summary-30-current',
        },
        previous: {
          channelBreakdown: 'channels-30-previous',
          range: { from: '2026-05-21', to: '2026-06-19' },
          salesTrend: 'trend-30-previous',
          summary: 'summary-30-previous',
        },
      },
      '7': {
        current: {
          channelBreakdown: 'channels-7-current',
          range: { from: '2026-07-13', to: '2026-07-19' },
          salesTrend: 'trend-7-current',
          summary: 'summary-7-current',
        },
        previous: {
          channelBreakdown: 'channels-7-previous',
          range: { from: '2026-07-06', to: '2026-07-12' },
          salesTrend: 'trend-7-previous',
          summary: 'summary-7-previous',
        },
      },
    },
  },
  imports: { data: [{ id: 'job-1' }], meta: {} },
  inventory: { summary: 'inventory' },
  products: {
    data: [
      {
        category: 'Apparel',
        grossMarginPct: 60,
        labels: ['Best Seller'],
        name: 'Hoodie',
        revenue: 100,
        sku: 'HD-1',
        unitsSold: 5,
        vendor: 'North',
      },
      {
        category: 'Accessories',
        grossMarginPct: 40,
        labels: ['Low Stock'],
        name: 'Tote',
        revenue: 250,
        sku: 'TT-1',
        unitsSold: 2,
        vendor: 'South',
      },
    ],
    meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
  },
  reports: { notFound: { error: { code: 'NOT_FOUND' } }, report: { id: 'weekly-1' } },
};

function createCaller(routes: ReturnType<typeof createReadRoutes>) {
  return (method: string, path: string, query = ''): DemoResponse | Promise<DemoResponse> => {
    const match = matchDemoRoute(routes, method, path);
    assert.ok(match, `expected route for ${method} ${path}`);

    const request: DemoRequest = {
      body: undefined,
      method,
      params: match.params,
      searchParams: new URLSearchParams(query),
    };

    return match.handler(request);
  };
}

describe('demo read-model handlers', () => {
  const today = () => '2026-07-25';

  it('selects dashboard fixtures by span and current/previous role', async () => {
    const call = createCaller(
      createReadRoutes(fixtures, { storage: createMemoryStorage(), today }),
    );

    const current = await call('GET', '/api/dashboard/summary', 'from=2026-06-26&to=2026-07-25');
    assert.equal(current.json, 'summary-30-current');

    const previous = await call('GET', '/api/dashboard/summary', 'from=2026-05-27&to=2026-06-25');
    assert.equal(previous.json, 'summary-30-previous');

    const sevenDay = await call('GET', '/api/dashboard/sales-trend', 'from=2026-07-19&to=2026-07-25');
    assert.equal(sevenDay.json, 'trend-7-current');

    const unknownSpan = await call('GET', '/api/dashboard/summary', 'from=2026-07-11&to=2026-07-25');
    assert.equal(unknownSpan.json, 'summary-30-current');
  });

  it('filters, sorts, and paginates recorded products', async () => {
    const call = createCaller(
      createReadRoutes(fixtures, { storage: createMemoryStorage(), today }),
    );

    const lowStock = (await call(
      'GET',
      '/api/products/performance',
      'sort=revenue&order=desc&page=1&pageSize=20&status=low+stock',
    )) as { json: { data: Array<{ sku: string }>; meta: { total: number } } };
    assert.deepEqual(
      lowStock.json.data.map((row) => row.sku),
      ['TT-1'],
    );

    const paged = (await call(
      'GET',
      '/api/products/performance',
      'sort=revenue&order=desc&page=2&pageSize=1',
    )) as { json: { data: Array<{ sku: string }>; meta: { totalPages: number } } };
    assert.deepEqual(
      paged.json.data.map((row) => row.sku),
      ['HD-1'],
    );
    assert.equal(paged.json.meta.totalPages, 2);
  });

  it('keeps the weekly report absent until generated, then persists it', async () => {
    const storage = createMemoryStorage();
    const call = createCaller(createReadRoutes(fixtures, { storage, today }));

    assert.equal((await call('GET', '/api/reports/weekly')).status, 404);
    assert.equal((await call('POST', '/api/reports/weekly/generate')).status, 200);
    assert.equal((await call('GET', '/api/reports/weekly')).status, 200);
  });

  it('rejects CSV import submissions as read-only', async () => {
    const call = createCaller(
      createReadRoutes(fixtures, { storage: createMemoryStorage(), today }),
    );

    const response = await call('POST', '/api/import/orders');
    assert.equal(response.status, 403);
  });
});
