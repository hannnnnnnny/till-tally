import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const landingSource = readFileSync(new URL('./LandingPage.tsx', import.meta.url), 'utf8');

describe('landing hero layout', () => {
  it('uses a centered hero without the desktop dashboard backdrop', () => {
    assert.match(landingSource, /min-h-\[68dvh\]/);
    assert.match(landingSource, /max-w-4xl py-20 text-center/);
    assert.match(landingSource, /justify-center gap-3 sm:flex-row/);

    assert.doesNotMatch(landingSource, /data-testid="hero-dashboard-backdrop"/);
    assert.doesNotMatch(landingSource, /data-testid="hero-dashboard-clip"/);
  });
});
