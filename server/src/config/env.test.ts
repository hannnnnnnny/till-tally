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

  it('defaults to the deterministic local analytics planner', () => {
    const result = loadEnv({
      JWT_ACCESS_SECRET: strongAccessSecret,
      JWT_REFRESH_SECRET: strongRefreshSecret,
    });

    assert.equal(result.analyticsPlannerProvider, 'local');
    assert.equal(result.analyticsPlannerTimeoutMs, 8_000);
    assert.equal(result.analyticsPlannerMaxRetries, 1);
  });

  it('loads a bounded optional Ollama planner configuration', () => {
    const result = loadEnv({
      JWT_ACCESS_SECRET: strongAccessSecret,
      JWT_REFRESH_SECRET: strongRefreshSecret,
      ANALYTICS_PLANNER_PROVIDER: 'ollama',
      ANALYTICS_PLANNER_TIMEOUT_MS: '12000',
      ANALYTICS_PLANNER_MAX_RETRIES: '2',
      OLLAMA_BASE_URL: 'http://ollama.internal:11434',
      OLLAMA_MODEL: 'qwen3:4b',
    });

    assert.equal(result.analyticsPlannerProvider, 'ollama');
    assert.equal(result.analyticsPlannerTimeoutMs, 12_000);
    assert.equal(result.analyticsPlannerMaxRetries, 2);
    assert.equal(result.ollamaBaseUrl, 'http://ollama.internal:11434');
    assert.equal(result.ollamaModel, 'qwen3:4b');
  });

  it('rejects unsupported analytics planner configuration', () => {
    assert.throws(
      () =>
        loadEnv({
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
          ANALYTICS_PLANNER_PROVIDER: 'remote-magic',
        }),
      /ANALYTICS_PLANNER_PROVIDER must be one of: local, ollama/,
    );

    assert.throws(
      () =>
        loadEnv({
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
          ANALYTICS_PLANNER_TIMEOUT_MS: '60000',
        }),
      /ANALYTICS_PLANNER_TIMEOUT_MS must be an integer between 100 and 30000/,
    );
  });

  it('requires a safe HTTP endpoint when Ollama is enabled', () => {
    assert.throws(
      () =>
        loadEnv({
          JWT_ACCESS_SECRET: strongAccessSecret,
          JWT_REFRESH_SECRET: strongRefreshSecret,
          ANALYTICS_PLANNER_PROVIDER: 'ollama',
          OLLAMA_BASE_URL: 'file:///tmp/model',
        }),
      /OLLAMA_BASE_URL must be an HTTP or HTTPS URL/,
    );
  });
});
