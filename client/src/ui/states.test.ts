import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSkeletonItems, getStatePanelRole, getStateToneClasses } from './states';

describe('global UI state helpers', () => {
  it('maps state tones to accessible roles', () => {
    assert.equal(getStatePanelRole('loading'), 'status');
    assert.equal(getStatePanelRole('empty'), 'status');
    assert.equal(getStatePanelRole('error'), 'alert');
    assert.equal(getStatePanelRole('success'), 'status');
  });

  it('returns tone classes for loading, empty, error, and success states', () => {
    assert.match(getStateToneClasses('loading').panel, /border-slate-200/);
    assert.match(getStateToneClasses('empty').panel, /border-dashed/);
    assert.match(getStateToneClasses('error').panel, /border-red-200/);
    assert.match(getStateToneClasses('success').panel, /border-emerald-200/);
  });

  it('creates stable skeleton item keys for repeated placeholders', () => {
    assert.deepEqual(createSkeletonItems(4), [0, 1, 2, 3]);
    assert.deepEqual(createSkeletonItems(0), []);
    assert.deepEqual(createSkeletonItems(-2), []);
  });
});
