import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadEnv } from './env';

const strongAccessSecret = 'access-secret-with-at-least-thirty-two-chars';
const strongRefreshSecret = 'refresh-secret-with-at-least-thirty-two-chars';

describe('environment config', () => {
  it('loads valid production JWT configuration', () => {
    const result = loadEnv({
      JWT_ACCESS_SECRET: strongAccessSecret,
      JWT_REFRESH_SECRET: strongRefreshSecret,
      NODE_ENV: 'production',
    });

    assert.equal(result.nodeEnv, 'production');
    assert.equal(result.jwtAccessExpiresIn, '15m');
    assert.equal(result.jwtRefreshExpiresIn, '7d');
  });

  it('rejects placeholder JWT secrets in production', () => {
    assert.throws(
      () =>
        loadEnv({
          JWT_ACCESS_SECRET: 'replace-with-a-long-random-string',
          JWT_REFRESH_SECRET: strongRefreshSecret,
          NODE_ENV: 'production',
        }),
      /JWT_ACCESS_SECRET must be replaced with a production secret/,
    );
  });

  it('rejects short JWT secrets in production', () => {
    assert.throws(
      () =>
        loadEnv({
          JWT_ACCESS_SECRET: 'short-secret',
          JWT_REFRESH_SECRET: strongRefreshSecret,
          NODE_ENV: 'production',
        }),
      /JWT_ACCESS_SECRET must be at least 32 characters/,
    );
  });

  it('rejects matching access and refresh JWT secrets in production', () => {
    assert.throws(
      () =>
        loadEnv({
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongAccessSecret,
          NODE_ENV: 'production',
        }),
      /JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different/,
    );
  });

  it('rejects invalid JWT expiry values', () => {
    assert.throws(
      () =>
        loadEnv({
          JWT_ACCESS_EXPIRES_IN: 'forever',
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
        }),
      /JWT_ACCESS_EXPIRES_IN must be a duration like 15m or 7d/,
    );
  });
});
