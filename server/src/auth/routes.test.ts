import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { createRateLimiter } from '../http/rateLimit';
import { createAuthRouter } from './routes';

describe('auth routes', () => {
  const passThroughRateLimit: RequestHandler = (_req, _res, next) => {
    next();
  };

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

  it('revokes the presented refresh token on logout', async () => {
    const revokedTokens: string[] = [];
    const app = express();

    app.use(express.json());
    app.use(
      '/api/auth',
      createAuthRouter({
        authRateLimit: passThroughRateLimit,
        refreshTokenStore: {
          async storeRefreshToken() {},
          async rotateRefreshToken() {
            return true;
          },
          async revokeRefreshToken(refreshToken) {
            revokedTokens.push(refreshToken);
          },
        },
      }),
    );

    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', 'refreshToken=token-from-cookie')
      .expect(204);

    assert.deepEqual(revokedTokens, ['token-from-cookie']);
  });
});
