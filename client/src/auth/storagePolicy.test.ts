import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('auth storage policy', () => {
  it('does not persist access tokens in Web Storage', () => {
    const authContextSource = readFileSync(new URL('./AuthContext.tsx', import.meta.url), 'utf8');

    assert.equal(authContextSource.includes('localStorage'), false);
    assert.equal(authContextSource.includes('sessionStorage'), false);
    assert.equal(authContextSource.includes('till-tally.access-token'), false);
  });
});
