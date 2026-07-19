import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('mobile shell safe-area spacing', () => {
  it('keeps scrollable content clear of the fixed mobile navigation', () => {
    const appShellSource = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');

    assert.match(appShellSource, /pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\]/);
    assert.match(appShellSource, /lg:pb-8/);
  });

  it('pads the fixed mobile navigation for device safe areas', () => {
    const appShellSource = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');

    assert.match(appShellSource, /pb-\[calc\(0\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  });

  it('keeps the mobile navigation in a single five-item row', () => {
    const appShellSource = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8');

    assert.match(appShellSource, /grid-cols-5/);
    assert.doesNotMatch(appShellSource, /sm:grid-cols-7/);
  });
});
