import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkHealthcheckUrl, type HealthcheckFetch } from './healthcheck';

describe('container healthcheck client', () => {
  it('passes only when the readiness endpoint returns a successful response', async () => {
    const fetcher = createFetch({ ok: true });

    assert.equal(
      await checkHealthcheckUrl('http://127.0.0.1:4000/api/health/ready', fetcher),
      true,
    );
  });

  it('fails when the readiness endpoint returns an unhealthy response', async () => {
    const fetcher = createFetch({ ok: false });

    assert.equal(
      await checkHealthcheckUrl('http://127.0.0.1:4000/api/health/ready', fetcher),
      false,
    );
  });

  it('fails when the readiness endpoint cannot be reached', async () => {
    const fetcher: HealthcheckFetch = async () => {
      throw new Error('connection refused');
    };

    assert.equal(
      await checkHealthcheckUrl('http://127.0.0.1:4000/api/health/ready', fetcher),
      false,
    );
  });
});

function createFetch(response: { ok: boolean }): HealthcheckFetch {
  return async () => response;
}
