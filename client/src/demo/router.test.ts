import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEMO_ROUTE_MISSING, matchDemoRoute, type DemoRoute } from './router';

describe('demo route matching', () => {
  const handler = () => ({ json: {}, status: 200 });
  const routes: DemoRoute[] = [
    { handler, method: 'GET', template: '/api/dashboard/summary' },
    { handler, method: 'POST', template: '/api/analytics/plan' },
    { handler, method: 'DELETE', template: '/api/analytics/saved-reports/:reportId' },
  ];

  it('matches exact method and path', () => {
    assert.ok(matchDemoRoute(routes, 'get', '/api/dashboard/summary'));
    assert.equal(matchDemoRoute(routes, 'GET', '/api/analytics/plan'), null);
    assert.ok(matchDemoRoute(routes, 'POST', '/api/analytics/plan'));
  });

  it('extracts and decodes path parameters', () => {
    const match = matchDemoRoute(routes, 'DELETE', '/api/analytics/saved-reports/report%2F1');

    assert.ok(match);
    assert.deepEqual(match.params, { reportId: 'report/1' });
  });

  it('returns null for unknown paths and different segment counts', () => {
    assert.equal(matchDemoRoute(routes, 'GET', '/api/dashboard/summary/extra'), null);
    assert.equal(matchDemoRoute(routes, 'GET', '/api/unknown'), null);
  });

  it('exposes a standard error envelope for missing demo routes', () => {
    assert.equal(DEMO_ROUTE_MISSING.status, 404);
    assert.deepEqual(Object.keys(DEMO_ROUTE_MISSING.json as Record<string, unknown>), ['error']);
  });
});
