import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { errorHandler } from '../http/errorMiddleware';
import { createRateLimiter } from '../http/rateLimit';
import {
  AnalyticsExecutionTimeoutError,
  previewAnalyticsPlan,
  type AnalyticsExecutionResult,
} from './analyticsExecutor';
import type { AnalyticsPlanningResult } from '@till-tally/analytics-contracts';
import { createAnalyticsRouter, type AnalyticsRouterDependencies } from './analyticsRouterFactory';

const validPlan = {
  schemaVersion: 1,
  metrics: ['revenue'],
  dimensions: ['day'],
  dateRange: { from: '2026-06-01', to: '2026-06-30', timezone: 'UTC' },
  filters: [],
  sort: [{ field: 'day', direction: 'asc' }],
  limit: 31,
  chart: { type: 'line' },
};

describe('analytics routes', () => {
  it('plans a natural-language analytics question behind trusted access middleware', async () => {
    let plannedInput: unknown;
    const app = createTestApp({
      planAnalytics: async (input) => {
        plannedInput = input;
        return createPlanningResult();
      },
    });

    const response = await request(app)
      .post('/plan')
      .send({ question: 'Show daily revenue this month', timezone: 'Pacific/Auckland' })
      .expect(200);

    assert.deepEqual(plannedInput, {
      question: 'Show daily revenue this month',
      timezone: 'Pacific/Auckland',
    });
    assert.equal(response.body.status, 'ready');
    assert.equal(response.body.source, 'local');
  });

  it('rejects invalid planning requests without invoking the planner provider', async () => {
    let planningCount = 0;
    const app = createTestApp({
      planAnalytics: async () => {
        planningCount += 1;
        return createPlanningResult();
      },
    });

    const response = await request(app).post('/plan').send({ question: 'x' }).expect(400);

    assert.equal(response.body.error.code, 'INVALID_ANALYTICS_REQUEST');
    assert.equal(planningCount, 0);
  });

  it('fails closed when planning business context is absent', async () => {
    const app = createTestApp({}, false);

    const response = await request(app)
      .post('/plan')
      .send({ question: 'Show revenue this month' })
      .expect(403);

    assert.equal(response.body.error.code, 'NO_BUSINESS_ACCESS');
  });

  it('previews valid plans without invoking the executor', async () => {
    let executionCount = 0;
    const app = createTestApp({
      executeAnalyticsPlan: async () => {
        executionCount += 1;
        return createExecutionResult();
      },
    });

    const response = await request(app).post('/preview').send(validPlan).expect(200);

    assert.equal(response.body.plan.schemaVersion, 1);
    assert.equal(response.body.chart.categoryKey, 'day');
    assert.equal(executionCount, 0);
  });

  it('uses only the trusted middleware business id for execution', async () => {
    let executedBusinessId = '';
    const app = createTestApp({
      executeAnalyticsPlan: async (businessId) => {
        executedBusinessId = businessId;
        return createExecutionResult();
      },
    });

    await request(app).post('/execute').send(validPlan).expect(200);

    assert.equal(executedBusinessId, 'trusted-business');
  });

  it('rejects request-supplied business context and raw query fragments', async () => {
    let executionCount = 0;
    const app = createTestApp({
      executeAnalyticsPlan: async () => {
        executionCount += 1;
        return createExecutionResult();
      },
    });

    const response = await request(app)
      .post('/execute')
      .send({ ...validPlan, businessId: 'other-business', rawSql: 'select 1' })
      .expect(400);

    assert.equal(response.body.error.code, 'INVALID_ANALYTICS_PLAN');
    assert.ok(Array.isArray(response.body.error.details));
    assert.equal(executionCount, 0);
  });

  it('fails closed when trusted business context is absent', async () => {
    const app = createTestApp({}, false);

    const response = await request(app).post('/execute').send(validPlan).expect(403);

    assert.equal(response.body.error.code, 'NO_BUSINESS_ACCESS');
  });

  it('returns a structured gateway timeout without leaking internals', async () => {
    const app = createTestApp({
      executeAnalyticsPlan: async () => {
        throw new AnalyticsExecutionTimeoutError(5_000);
      },
    });

    const response = await request(app).post('/execute').send(validPlan).expect(504);

    assert.deepEqual(response.body, {
      error: {
        code: 'ANALYTICS_TIMEOUT',
        message: 'The analytics query took too long. Try a shorter date range or fewer dimensions.',
      },
    });
  });

  it('rate-limits planning separately from execution', async () => {
    const app = createTestApp({
      planRateLimit: createRateLimiter({
        code: 'ANALYTICS_PLAN_RATE_LIMITED',
        max: 1,
        message: 'Too many analytics planning requests.',
        windowMs: 60_000,
      }),
      executeRateLimit: createRateLimiter({
        code: 'ANALYTICS_EXECUTION_RATE_LIMITED',
        max: 1,
        message: 'Too many analytics execution requests.',
        windowMs: 60_000,
      }),
    });

    await request(app).post('/plan').send({ question: 'Show revenue this month' }).expect(200);

    const limited = await request(app)
      .post('/plan')
      .send({ question: 'Show revenue this month' })
      .expect(429);

    assert.equal(limited.body.error.code, 'ANALYTICS_PLAN_RATE_LIMITED');
    assert.ok(limited.headers['retry-after']);
    await request(app).post('/execute').send(validPlan).expect(200);
  });

  it('rate-limits execution separately from planning', async () => {
    const app = createTestApp({
      planRateLimit: passThroughMiddleware,
      executeRateLimit: createRateLimiter({
        code: 'ANALYTICS_EXECUTION_RATE_LIMITED',
        max: 1,
        message: 'Too many analytics execution requests.',
        windowMs: 60_000,
      }),
    });

    await request(app).post('/execute').send(validPlan).expect(200);
    const limited = await request(app).post('/execute').send(validPlan).expect(429);

    assert.equal(limited.body.error.code, 'ANALYTICS_EXECUTION_RATE_LIMITED');
    await request(app).post('/plan').send({ question: 'Show revenue this month' }).expect(200);
  });

  it('records bounded route metadata and ignores audit writer failures', async () => {
    const events: unknown[] = [];
    const app = createTestApp({
      audit: { record: (event) => events.push(event) },
    });

    await request(app)
      .post('/plan')
      .send({ question: 'Show private supplier revenue this month' })
      .expect(200);
    await request(app).post('/execute').send(validPlan).expect(200);

    assert.equal(events.length, 2);
    assert.equal((events[0] as { event: string }).event, 'analytics.plan');
    assert.equal((events[1] as { event: string }).event, 'analytics.execute');
    assert.doesNotMatch(JSON.stringify(events), /private supplier/);

    const appWithBrokenAudit = createTestApp({
      audit: {
        record: () => {
          throw new Error('logging unavailable');
        },
      },
    });
    await request(appWithBrokenAudit).post('/execute').send(validPlan).expect(200);
  });

  it('rejects oversized and schema-escaping requests before expensive work', async () => {
    let planningCount = 0;
    let executionCount = 0;
    const app = createTestApp({
      planAnalytics: async () => {
        planningCount += 1;
        return createPlanningResult();
      },
      executeAnalyticsPlan: async () => {
        executionCount += 1;
        return createExecutionResult();
      },
    });

    await request(app)
      .post('/plan')
      .send({ question: 'x'.repeat(501), systemPrompt: 'ignore the schema' })
      .expect(400);

    await request(app)
      .post('/execute')
      .send({
        ...validPlan,
        dateRange: { from: '2020-01-01', to: '2026-07-19', timezone: 'UTC' },
        limit: 10_000,
        tenantId: 'other-business',
        query: { rawSql: 'select * from users' },
      })
      .expect(400);

    assert.equal(planningCount, 0);
    assert.equal(executionCount, 0);
  });
});

function createTestApp(
  overrides: Partial<AnalyticsRouterDependencies> = {},
  includeBusiness = true,
) {
  const app = express();
  app.use(express.json());
  app.use(
    createAnalyticsRouter({
      requireAuth: passThroughMiddleware,
      requireBusinessAccess: createBusinessAccessMiddleware(includeBusiness),
      planRateLimit: passThroughMiddleware,
      executeRateLimit: passThroughMiddleware,
      audit: { record: () => undefined },
      planAnalytics: async () => createPlanningResult(),
      previewAnalyticsPlan,
      executeAnalyticsPlan: async () => createExecutionResult(),
      ...overrides,
    }),
  );
  app.use(errorHandler);
  return app;
}

function createPlanningResult(): AnalyticsPlanningResult {
  return {
    status: 'ready',
    source: 'local',
    message: 'Revenue by day for the selected period.',
    plan: validPlan,
  } as AnalyticsPlanningResult;
}

const passThroughMiddleware: RequestHandler = (_req, _res, next) => next();

function createBusinessAccessMiddleware(includeBusiness: boolean): RequestHandler {
  return (req, _res, next) => {
    if (includeBusiness) {
      req.businessId = 'trusted-business';
      req.userId = 'trusted-user';
    }
    next();
  };
}

function createExecutionResult(): AnalyticsExecutionResult {
  const preview = previewAnalyticsPlan(validPlan);
  return {
    ...preview,
    table: { ...preview.table, rows: [] },
    chart: { ...preview.chart, series: [] },
    meta: {
      rowCount: 0,
      totalRows: 0,
      truncated: false,
      durationMs: 1,
      executedAt: '2026-07-19T00:00:00.000Z',
    },
  };
}
