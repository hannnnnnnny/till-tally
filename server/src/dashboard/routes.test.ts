import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { createDashboardRouter, type DashboardRouterDependencies } from './dashboardRouterFactory';
import { type SalesTrendResult } from './salesTrendService';
import { DashboardDateRangeError, type DashboardSummary } from './summaryService';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

describe('dashboard routes', () => {
  it('returns dashboard summary KPIs for the active business', async () => {
    let capturedRequest:
      | {
          businessId: string;
          from: unknown;
          to: unknown;
        }
      | null = null;

    const app = createTestApp({
      getDashboardSummary: async (businessId, query) => {
        capturedRequest = {
          businessId,
          from: query.from,
          to: query.to,
        };

        return createDashboardSummary();
      },
    });

    const response = await request(app)
      .get('/api/dashboard/summary?from=2026-06-01&to=2026-06-30')
      .expect(200);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      from: '2026-06-01',
      to: '2026-06-30',
    });
    assert.deepEqual(response.body, createDashboardSummary());
  });

  it('returns 403 when business context is missing', async () => {
    const app = createTestApp({
      requireBusinessAccess: (_req, _res, next) => next(),
    });

    const response = await request(app).get('/api/dashboard/summary').expect(403);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'NO_BUSINESS_ACCESS');
    assert.equal(body.error.message, 'Missing business context');
  });

  it('returns 400 for invalid date ranges', async () => {
    const app = createTestApp({
      getDashboardSummary: async () => {
        throw new DashboardDateRangeError('from must be before or equal to to');
      },
    });

    const response = await request(app).get('/api/dashboard/summary').expect(400);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'BAD_DATE_RANGE');
    assert.equal(body.error.message, 'from must be before or equal to to');
  });

  it('returns sales trend points for the active business', async () => {
    let capturedRequest:
      | {
          businessId: string;
          from: unknown;
          to: unknown;
          interval: unknown;
        }
      | null = null;

    const app = createTestApp({
      getDashboardSalesTrend: async (businessId, query) => {
        capturedRequest = {
          businessId,
          from: query.from,
          to: query.to,
          interval: query.interval,
        };

        return createSalesTrendResult();
      },
    });

    const response = await request(app)
      .get('/api/dashboard/sales-trend?from=2026-06-01&to=2026-06-30&interval=week')
      .expect(200);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      from: '2026-06-01',
      to: '2026-06-30',
      interval: 'week',
    });
    assert.deepEqual(response.body, createSalesTrendResult());
  });

  it('returns 400 for invalid sales trend query params', async () => {
    const app = createTestApp({
      getDashboardSalesTrend: async () => {
        throw new DashboardDateRangeError('interval must be day or week');
      },
    });

    const response = await request(app)
      .get('/api/dashboard/sales-trend?interval=month')
      .expect(400);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'BAD_DATE_RANGE');
    assert.equal(body.error.message, 'interval must be day or week');
  });
});

function createTestApp(overrides: Partial<DashboardRouterDependencies>): express.Express {
  const app = express();

  app.use(express.json());
  app.use('/api/dashboard', createDashboardRouter({ ...createDefaultDependencies(), ...overrides }));

  return app;
}

function createDefaultDependencies(): DashboardRouterDependencies {
  return {
    requireAuth: createAuthMiddleware(),
    requireBusinessAccess: createBusinessAccessMiddleware(),
    getDashboardSalesTrend: async () => createSalesTrendResult(),
    getDashboardSummary: async () => createDashboardSummary(),
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

function createDashboardSummary(): DashboardSummary {
  return {
    range: {
      from: '2026-06-01',
      to: '2026-06-30',
    },
    kpis: {
      totalSales: 150,
      grossProfit: 65,
      grossMarginPct: 43.33,
      orders: 2,
      averageOrderValue: 75,
      unitsSold: 3,
      lowStockItems: 2,
      slowMovers: 2,
    },
  };
}

function createSalesTrendResult(): SalesTrendResult {
  return {
    interval: 'week',
    points: [
      {
        date: '2026-06-01',
        sales: 100,
        orders: 1,
        grossProfit: 40,
      },
      {
        date: '2026-06-08',
        sales: 50,
        orders: 1,
        grossProfit: 25,
      },
    ],
  };
}
