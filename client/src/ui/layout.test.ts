import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getActionClassName, getPanelClassName } from './layout';

describe('layout design tokens', () => {
  it('keeps surface hierarchy visually distinct', () => {
    const plain = getPanelClassName('plain');
    const raised = getPanelClassName('raised');
    const muted = getPanelClassName('muted');

    assert.doesNotMatch(plain, /border/);
    assert.match(raised, /border-slate-200/);
    assert.match(raised, /shadow/);
    assert.match(muted, /bg-slate-50/);
    assert.notEqual(raised, muted);
  });

  it('gives primary, secondary, and quiet actions different emphasis', () => {
    const primary = getActionClassName('primary');
    const secondary = getActionClassName('secondary');
    const quiet = getActionClassName('quiet');

    assert.match(primary, /bg-slate-950/);
    assert.match(secondary, /border-slate-300/);
    assert.doesNotMatch(quiet, /border-slate-300/);
    assert.notEqual(primary, secondary);
    assert.notEqual(secondary, quiet);
  });

  it('uses stable dimensions and tabular figures for data controls', () => {
    for (const variant of ['primary', 'secondary', 'quiet'] as const) {
      assert.match(getActionClassName(variant), /min-h-10/);
      assert.match(getActionClassName(variant), /focus-visible:ring-2/);
    }

    assert.match(getPanelClassName('metric'), /tabular-nums/);
  });
});
