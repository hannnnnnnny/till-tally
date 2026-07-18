import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { errorHandler } from '../http/errorMiddleware';
import { createSavedReportsRouter } from './savedReportsRouterFactory';
import { createSavedReportService, type SavedReportRepository } from './savedReportService';

const validPlan = {
  schemaVersion: 1 as const,
  metrics: ['revenue' as const],
  dimensions: ['day' as const],
  dateRange: { from: '2026-07-01', to: '2026-07-19', timezone: 'Pacific/Auckland' as const },
  filters: [],
  sort: [{ field: 'day' as const, direction: 'asc' as const }],
  limit: 31,
  chart: { type: 'line' as const },
};

describe('saved reports routes', () => {
  it('uses only trusted auth and business context when creating a report', async () => {
    let capturedScope: unknown;
    const service = createSavedReportService({
      ...emptyRepository(),
      async create(scope, name, version) {
        capturedScope = scope;
        return record(name, version);
      },
    });
    const app = createApp(service);

    await request(app)
      .post('/api/analytics/saved-reports')
      .send({
        name: 'Revenue',
        plan: validPlan,
        source: 'local',
        businessId: 'attacker-business',
        userId: 'attacker-user',
      })
      .expect(400);

    await request(app)
      .post('/api/analytics/saved-reports')
      .send({ name: 'Revenue', plan: validPlan, source: 'local' })
      .expect(201);

    assert.deepEqual(capturedScope, {
      businessId: 'trusted-business',
      userId: 'trusted-user',
    });
  });

  it('returns a non-enumerating 404 for reports outside the trusted scope', async () => {
    const service = createSavedReportService(emptyRepository());
    const response = await request(createApp(service))
      .get('/api/analytics/saved-reports/other-report')
      .expect(404);

    assert.deepEqual(response.body, {
      error: {
        code: 'SAVED_REPORT_NOT_FOUND',
        message: 'Saved report not found',
      },
    });
  });

  it('fails closed when trusted user or business context is absent', async () => {
    const service = createSavedReportService(emptyRepository());
    await request(createApp(service, false, true))
      .get('/api/analytics/saved-reports')
      .expect(401);
    await request(createApp(service, true, false))
      .get('/api/analytics/saved-reports')
      .expect(403);
  });
});

function createApp(
  service: ReturnType<typeof createSavedReportService>,
  includeUser = true,
  includeBusiness = true,
) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/analytics/saved-reports',
    createSavedReportsRouter({
      requireAuth: contextMiddleware(includeUser, includeBusiness),
      requireBusinessAccess: (_req, _res, next) => next(),
      service,
    }),
  );
  app.use(errorHandler);
  return app;
}

function contextMiddleware(includeUser: boolean, includeBusiness: boolean): RequestHandler {
  return (req, _res, next) => {
    if (includeUser) req.userId = 'trusted-user';
    if (includeBusiness) req.businessId = 'trusted-business';
    next();
  };
}

function emptyRepository(): SavedReportRepository {
  return {
    list: async () => [],
    find: async () => null,
    create: async (_scope, name, version) => record(name, version),
    rename: async () => null,
    addVersion: async () => null,
    duplicate: async () => null,
    delete: async () => false,
  };
}

function record(name: string, version: Parameters<SavedReportRepository['create']>[2]) {
  const now = new Date('2026-07-19T00:00:00.000Z');
  return {
    id: 'report-1',
    businessId: 'trusted-business',
    ownerUserId: 'trusted-user',
    name,
    currentVersion: 1,
    createdAt: now,
    updatedAt: now,
    versions: [
      {
        version: 1,
        schemaVersion: version.schemaVersion,
        plan: version.plan,
        source: version.source,
        createdByUserId: 'trusted-user',
        createdAt: now,
      },
    ],
  };
}
