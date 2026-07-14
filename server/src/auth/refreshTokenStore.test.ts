import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getRefreshTokenExpiresAt,
  hashRefreshToken,
  isRefreshTokenRecordUsable,
} from './refreshTokenStore';

describe('refresh token store helpers', () => {
  it('hashes refresh tokens before persistence', () => {
    const token = 'plain-refresh-token';
    const hash = hashRefreshToken(token);

    assert.notEqual(hash, token);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hashRefreshToken(token), hash);
  });

  it('derives the stored expiry from the verified JWT payload', () => {
    const expiresAt = getRefreshTokenExpiresAt({
      exp: 1_820_000_000,
      jti: 'refresh-token-id',
      sub: 'user-1',
      type: 'refresh',
    });

    assert.equal(expiresAt.toISOString(), '2027-09-03T19:33:20.000Z');
  });

  it('rejects refresh payloads without an exp claim', () => {
    assert.throws(
      () =>
        getRefreshTokenExpiresAt({
          sub: 'user-1',
          jti: 'refresh-token-id',
          type: 'refresh',
        }),
      /Refresh token exp claim is required/,
    );
  });

  it('treats revoked or expired refresh token records as unusable', () => {
    const now = new Date('2026-07-01T00:00:00.000Z');

    assert.equal(
      isRefreshTokenRecordUsable(
        {
          expiresAt: new Date('2026-07-02T00:00:00.000Z'),
          revokedAt: null,
        },
        now,
      ),
      true,
    );
    assert.equal(
      isRefreshTokenRecordUsable(
        {
          expiresAt: new Date('2026-06-30T00:00:00.000Z'),
          revokedAt: null,
        },
        now,
      ),
      false,
    );
    assert.equal(
      isRefreshTokenRecordUsable(
        {
          expiresAt: new Date('2026-07-02T00:00:00.000Z'),
          revokedAt: now,
        },
        now,
      ),
      false,
    );
  });
});
