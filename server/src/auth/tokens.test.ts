import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { signRefreshToken, verifyRefreshToken } from './tokens';

describe('auth tokens', () => {
  it('signs refresh tokens with unique ids so rotation can replace them safely', () => {
    const firstToken = signRefreshToken('user-1');
    const secondToken = signRefreshToken('user-1');

    assert.notEqual(firstToken, secondToken);
    assert.notEqual(verifyRefreshToken(firstToken).jti, verifyRefreshToken(secondToken).jti);
  });
});
