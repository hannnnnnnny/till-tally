import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAuthRoutes, createDemoSessionStore } from './authHandlers';
import { createMemoryStorage } from './demoStorage';
import { matchDemoRoute, type DemoRequest } from './router';

const fixture = {
  businesses: { data: [{ id: 'b1', name: 'Demo', role: 'OWNER' }] },
  login: { accessToken: 'demo-access-token', expiresIn: 900, user: { email: 'demo@x' } },
  me: { user: { email: 'demo@x' } },
};

const credentials = { email: 'demo@x', password: 'pw' };

function call(routes: ReturnType<typeof createAuthRoutes>, method: string, path: string, body?: unknown) {
  const match = matchDemoRoute(routes, method, path);
  assert.ok(match, `expected a demo route for ${method} ${path}`);

  const request: DemoRequest = {
    body,
    method,
    params: match.params,
    searchParams: new URLSearchParams(),
  };

  return match.handler(request);
}

describe('demo auth handlers', () => {
  it('starts a session on valid demo credentials and rejects others', async () => {
    const session = createDemoSessionStore(createMemoryStorage());
    const routes = createAuthRoutes(fixture, credentials, session);

    const bad = await call(routes, 'POST', '/api/auth/login', { email: 'x@y', password: 'nope' });
    assert.equal(bad.status, 401);
    assert.equal(session.isActive(), false);

    const good = await call(routes, 'POST', '/api/auth/login', {
      email: ' Demo@X ',
      password: 'pw',
    });
    assert.equal(good.status, 200);
    assert.equal(session.isActive(), true);
  });

  it('honours the session for refresh and me, and logout clears it', async () => {
    const session = createDemoSessionStore(createMemoryStorage());
    const routes = createAuthRoutes(fixture, credentials, session);

    assert.equal((await call(routes, 'POST', '/api/auth/refresh')).status, 401);
    assert.equal((await call(routes, 'GET', '/api/auth/me')).status, 401);

    session.start();
    assert.equal((await call(routes, 'POST', '/api/auth/refresh')).status, 200);
    assert.equal((await call(routes, 'GET', '/api/auth/me')).status, 200);

    assert.equal((await call(routes, 'POST', '/api/auth/logout')).status, 204);
    assert.equal(session.isActive(), false);
  });

  it('keeps registration and business creation read-only', async () => {
    const session = createDemoSessionStore(createMemoryStorage());
    const routes = createAuthRoutes(fixture, credentials, session);

    const register = await call(routes, 'POST', '/api/auth/register', {});
    const createBusiness = await call(routes, 'POST', '/api/businesses', {});

    for (const response of [register, createBusiness]) {
      assert.equal(response.status, 403);
      assert.equal(
        (response.json as { error: { code: string } }).error.code,
        'DEMO_READ_ONLY',
      );
    }
  });
});
