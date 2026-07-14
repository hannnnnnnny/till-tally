import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import request from 'supertest';
import { asyncHandler } from './asyncHandler';
import { errorHandler, notFoundHandler } from './errorMiddleware';

describe('HTTP error middleware', () => {
  it('returns JSON for missing routes', async () => {
    const app = createTestApp();

    const response = await request(app).get('/missing').expect(404);

    assert.deepEqual(response.body, {
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  it('returns JSON for unexpected async route errors without leaking internals', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    const app = createTestApp((testApp) => {
      testApp.get(
        '/boom',
        asyncHandler(async () => {
          throw new Error('database password leaked in stack');
        }),
      );
    });

    let response: request.Response;

    try {
      response = await request(app).get('/boom').expect(500);
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }

    assert.deepEqual(response.body, {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
      },
    });
  });
});

function createTestApp(configureRoutes?: (app: express.Express) => void): express.Express {
  const app = express();

  configureRoutes?.(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
