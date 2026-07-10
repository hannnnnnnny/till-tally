import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import { createHealthRouter, type HealthCheckDatabase } from './routes';

describe('health routes', () => {
  it('returns a lightweight liveness check', async () => {
    const app = createTestApp(createHealthyDatabase());

    const response = await request(app).get('/api/health').expect(200);

    assert.deepEqual(response.body, {
      status: 'ok',
      service: 'till-tally-api',
    });
  });

  it('returns ready when the database check succeeds', async () => {
    const app = createTestApp(createHealthyDatabase());

    const response = await request(app).get('/api/health/ready').expect(200);

    assert.deepEqual(response.body, {
      status: 'ready',
      service: 'till-tally-api',
      checks: {
        database: 'ok',
      },
    });
  });

  it('returns not ready without leaking database errors when the database check fails', async () => {
    const app = createTestApp({
      $queryRaw: async () => {
        throw new Error('postgres password leaked');
      },
    });

    const response = await request(app).get('/api/health/ready').expect(503);

    assert.deepEqual(response.body, {
      status: 'not_ready',
      service: 'till-tally-api',
      checks: {
        database: 'unavailable',
      },
    });
  });
});

function createTestApp(database: HealthCheckDatabase): express.Express {
  const app = express();

  app.use('/api/health', createHealthRouter({ database }));

  return app;
}

function createHealthyDatabase(): HealthCheckDatabase {
  return {
    $queryRaw: async () => [{ connected: 1 }],
  };
}
