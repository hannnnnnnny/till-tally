import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Role } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { errorHandler } from '../http/errorMiddleware';
import { createRequireBusinessAccess, type FindBusinessMembership } from './middleware';

type Membership = { businessId: string; userId: string; role: Role };

const MEMBERSHIPS: Membership[] = [
  { businessId: 'business-a', userId: 'user-a', role: Role.OWNER },
  { businessId: 'business-b', userId: 'user-b', role: Role.VIEWER },
];

const findInFixture: FindBusinessMembership = async (businessId, userId) => {
  const match = MEMBERSHIPS.find((m) => m.businessId === businessId && m.userId === userId);
  return match ? { role: match.role } : null;
};

function createTestApp(userId: string | null, find: FindBusinessMembership = findInFixture) {
  const app = express();
  const fakeAuth: RequestHandler = (req, _res, next) => {
    if (userId) req.userId = userId;
    next();
  };

  app.get('/scoped', fakeAuth, createRequireBusinessAccess(find), (req, res) => {
    res.json({ businessId: req.businessId, role: req.businessRole });
  });
  app.use(errorHandler);
  return app;
}

describe('requireBusinessAccess', () => {
  it('rejects requests without an authenticated user', async () => {
    const response = await request(createTestApp(null))
      .get('/scoped')
      .set('x-business-id', 'business-a')
      .expect(401);

    assert.equal(response.body.error.code, 'UNAUTHENTICATED');
  });

  it('rejects requests without business context', async () => {
    const response = await request(createTestApp('user-a')).get('/scoped').expect(403);

    assert.equal(response.body.error.message, 'Missing business context');
  });

  it('rejects a member of another business via header', async () => {
    const response = await request(createTestApp('user-b'))
      .get('/scoped')
      .set('x-business-id', 'business-a')
      .expect(403);

    assert.equal(response.body.error.code, 'NO_BUSINESS_ACCESS');
  });

  it('rejects a member of another business via query string', async () => {
    await request(createTestApp('user-b')).get('/scoped?businessId=business-a').expect(403);
  });

  it('prefers the header over the query string so a query cannot widen access', async () => {
    await request(createTestApp('user-b'))
      .get('/scoped?businessId=business-b')
      .set('x-business-id', 'business-a')
      .expect(403);
  });

  it('attaches business id and role for members', async () => {
    const response = await request(createTestApp('user-b'))
      .get('/scoped')
      .set('x-business-id', '  business-b  ')
      .expect(200);

    assert.deepEqual(response.body, { businessId: 'business-b', role: Role.VIEWER });
  });

  it('forwards membership lookup failures to the error handler', async () => {
    const failingFind: FindBusinessMembership = async () => {
      throw new Error('database unavailable');
    };

    await request(createTestApp('user-a', failingFind))
      .get('/scoped')
      .set('x-business-id', 'business-a')
      .expect(500);
  });
});
