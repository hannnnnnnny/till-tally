import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../http/rateLimit';
import { createAuthRouter } from './routes';

describe('auth routes', () => {
  it('rate limits repeated auth attempts before processing credentials', async () => {
    const app = express();

    app.use(express.json());
    app.use(
      '/api/auth',
      createAuthRouter({
        authRateLimit: createRateLimiter({
          code: 'AUTH_RATE_LIMITED',
          max: 1,
          message: 'Too many authentication attempts. Please try again later.',
          windowMs: 60_000,
        }),
      }),
    );

    await request(app).post('/api/auth/login').send({}).expect(400);
    const response = await request(app).post('/api/auth/login').send({}).expect(429);

    assert.deepEqual(response.body, {
      error: {
        code: 'AUTH_RATE_LIMITED',
        message: 'Too many authentication attempts. Please try again later.',
      },
    });
  });
});
