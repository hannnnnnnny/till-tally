import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { createRateLimiter } from '../http/rateLimit';
import { createReportsRouter, type ReportsRouterDependencies } from './reportsRouterFactory';
import { WeeklyReportQueryError, type WeeklyReportResponse } from './weeklyReportService';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

describe('reports routes', () => {
  it('returns 503 when the weekly reports table has not been migrated yet', async () => {
    const app = createTestApp({
      getWeeklyReport: async () => {
        throw {
          code: 'P2021',
          meta: {
            table: 'public.weekly_reports',
          },
        };
      },
    });

    const response = await request(app).get('/api/reports/weekly').expect(503);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'REPORTS_SCHEMA_NOT_READY');
    assert.match(body.error.message, /prisma migrations/i);
  });

  it('returns an existing weekly report for the active business', async () => {
    let capturedRequest:
      | {
          businessId: string;
          weekStart: unknown;
        }
      | null = null;
    const app = createTestApp({
      getWeeklyReport: async (businessId, query) => {
        capturedRequest = {
          businessId,
          weekStart: query.weekStart,
        };

        return createWeeklyReport();
      },
    });

    const response = await request(app).get('/api/reports/weekly?weekStart=2026-06-18').expect(200);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      weekStart: '2026-06-18',
    });
    assert.deepEqual(response.body, createWeeklyReport());
  });

  it('returns 404 when no weekly report exists', async () => {
    const app = createTestApp({
      getWeeklyReport: async () => null,
    });

    const response = await request(app).get('/api/reports/weekly').expect(404);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(body.error.message, 'Weekly report not found');
  });

  it('generates a weekly report for the active business', async () => {
    let capturedRequest:
      | {
          businessId: string;
          weekStart: unknown;
        }
      | null = null;
    const app = createTestApp({
      generateWeeklyReport: async (businessId, input) => {
        capturedRequest = {
          businessId,
          weekStart: input.weekStart,
        };

        return createWeeklyReport();
      },
    });

    const response = await request(app)
      .post('/api/reports/weekly/generate')
      .send({ weekStart: '2026-06-18' })
      .expect(201);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      weekStart: '2026-06-18',
    });
    assert.deepEqual(response.body, createWeeklyReport());
  });

  it('returns 403 when business context is missing', async () => {
    const app = createTestApp({
      requireBusinessAccess: (_req, _res, next) => next(),
    });

    const response = await request(app).get('/api/reports/weekly').expect(403);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'NO_BUSINESS_ACCESS');
    assert.equal(body.error.message, 'Missing business context');
  });

  it('returns 400 for invalid weekly report query params', async () => {
    const app = createTestApp({
      getWeeklyReport: async () => {
        throw new WeeklyReportQueryError('weekStart must use YYYY-MM-DD');
      },
    });

    const response = await request(app).get('/api/reports/weekly?weekStart=not-a-date').expect(400);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'BAD_REPORT_QUERY');
    assert.equal(body.error.message, 'weekStart must use YYYY-MM-DD');
  });

  it('returns 400 for invalid weekly report generate bodies', async () => {
    const app = createTestApp({
      generateWeeklyReport: async () => {
        throw new WeeklyReportQueryError('weekStart must be a string');
      },
    });

    const response = await request(app)
      .post('/api/reports/weekly/generate')
      .send({ weekStart: 42 })
      .expect(400);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'BAD_REPORT_QUERY');
    assert.equal(body.error.message, 'weekStart must be a string');
  });

  it('rate limits weekly report requests before running report services', async () => {
    let serviceCalls = 0;
    const app = createTestApp({
      getWeeklyReport: async () => {
        serviceCalls += 1;
        return createWeeklyReport();
      },
      reportRateLimit: createRateLimiter({
        code: 'REPORT_RATE_LIMITED',
        max: 1,
        message: 'Too many report requests. Please try again later.',
        windowMs: 60_000,
      }),
    });

    await request(app).get('/api/reports/weekly').expect(200);
    const response = await request(app).get('/api/reports/weekly').expect(429);

    assert.equal(serviceCalls, 1);
    assert.deepEqual(response.body, {
      error: {
        code: 'REPORT_RATE_LIMITED',
        message: 'Too many report requests. Please try again later.',
      },
    });
  });
});

function createTestApp(overrides: Partial<ReportsRouterDependencies>): express.Express {
  const app = express();

  app.use(express.json());
  app.use('/api/reports', createReportsRouter({ ...createDefaultDependencies(), ...overrides }));

  return app;
}

function createDefaultDependencies(): ReportsRouterDependencies {
  return {
    requireAuth: createAuthMiddleware(),
    requireBusinessAccess: createBusinessAccessMiddleware(),
    generateWeeklyReport: async () => createWeeklyReport(),
    getWeeklyReport: async () => createWeeklyReport(),
  };
}

function createAuthMiddleware(): RequestHandler {
  return (req, _res, next) => {
    req.userId = 'user-1';
    next();
  };
}

function createBusinessAccessMiddleware(): RequestHandler {
  return (req, _res, next) => {
    req.businessId = 'business-1';
    next();
  };
}

function createWeeklyReport(): WeeklyReportResponse {
  return {
    id: 'report-1',
    businessId: 'business-1',
    weekStart: '2026-06-15',
    weekEnd: '2026-06-21',
    summary: 'This week, total sales increased by 20% compared with last week.',
    salesChangePercent: 20,
    topCategory: "Women's Fashion",
    lowStockCount: 3,
    slowMoverCount: 2,
    createdAt: '2026-06-22T00:00:00.000Z',
  };
}
