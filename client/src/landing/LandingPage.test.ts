import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const landingSource = readFileSync(new URL('./LandingPage.tsx', import.meta.url), 'utf8');

describe('landing hero dashboard alignment', () => {
  it('anchors the full preview inside the desktop viewport', () => {
    assert.match(landingSource, /data-testid="hero-dashboard-backdrop"/);
    assert.match(landingSource, /right-6/);
    assert.match(landingSource, /max-w-\[1180px\]/);
    assert.match(landingSource, /w-\[70vw\]/);
    assert.match(landingSource, /lg:top-8/);
    assert.ok(landingSource.includes('origin-top-right'));
    assert.ok(landingSource.includes('[@media(max-height:850px)]:scale-[0.88]'));
    assert.doesNotMatch(landingSource, /left-1\/2 top-10/);
    assert.doesNotMatch(landingSource, /-translate-x-\[12%\]/);
    assert.doesNotMatch(landingSource, /w-\[calc\(100vw-3rem\)\]/);
  });
});
