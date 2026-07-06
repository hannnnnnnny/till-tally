import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from './rateLimit';

describe('HTTP rate limiting', () => {
  it('returns a consistent JSON 429 response after the configured limit is reached', async () => {
    const app = express();

    app.use(
      createRateLimiter({
        code: 'TEST_RATE_LIMITED',
        max: 1,
        message: 'Too many test requests',
        windowMs: 60_000,
      }),
    );
    app.get('/limited', (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).get('/limited').expect(200);
    const response = await request(app).get('/limited').expect(429);

    assert.deepEqual(response.body, {
      error: {
        code: 'TEST_RATE_LIMITED',
        message: 'Too many test requests',
      },
    });
  });
});
