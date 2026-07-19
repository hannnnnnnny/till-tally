import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDemoFetch } from './demoFetch';
import { type DemoRoute } from './router';

describe('demo fetch wrapper', () => {
  const routes: DemoRoute[] = [
    {
      handler: ({ body, searchParams }) => ({
        json: { echoedBody: body, from: searchParams.get('from') },
        status: 200,
      }),
      method: 'POST',
      template: '/api/analytics/plan',
    },
    { handler: () => ({ json: null, status: 204 }), method: 'DELETE', template: '/api/demo' },
  ];

  const noLatency = () => 0;

  it('serves matched /api requests from demo handlers', async () => {
    const demoFetch = createDemoFetch(routes, {
      latencyMs: noLatency,
      realFetch: () => {
        throw new Error('real fetch must not be called for /api routes');
      },
    });

    const response = await demoFetch('/api/analytics/plan?from=2026-07-01', {
      body: JSON.stringify({ question: 'Show daily revenue this month' }),
      method: 'POST',
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      echoedBody: { question: 'Show daily revenue this month' },
      from: '2026-07-01',
    });
  });

  it('passes non-API URLs through to the real fetch', async () => {
    let passedThrough = false;
    const demoFetch = createDemoFetch(routes, {
      latencyMs: noLatency,
      realFetch: () => {
        passedThrough = true;
        return Promise.resolve(new Response('asset'));
      },
    });

    await demoFetch('/favicon.svg');
    assert.equal(passedThrough, true);
  });

  it('returns the standard 404 envelope for unknown API routes', async () => {
    const demoFetch = createDemoFetch(routes, {
      latencyMs: noLatency,
      realFetch: () => Promise.resolve(new Response('unused')),
    });

    const response = await demoFetch('/api/not-a-route');
    const body = (await response.json()) as { error: { code: string } };

    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'DEMO_ROUTE_MISSING');
  });

  it('supports empty 204 responses', async () => {
    const demoFetch = createDemoFetch(routes, {
      latencyMs: noLatency,
      realFetch: () => Promise.resolve(new Response('unused')),
    });

    const response = await demoFetch('/api/demo', { method: 'DELETE' });
    assert.equal(response.status, 204);
  });
});
