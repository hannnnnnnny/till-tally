import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANALYTICS_METHODS,
  LANDING_FEATURES,
  LANDING_NAV_ITEMS,
  TECH_STACK_ITEMS,
} from './content';

describe('landing page content', () => {
  it('links to the required landing sections', () => {
    assert.deepEqual(
      LANDING_NAV_ITEMS.map((item) => item.href),
      ['#features', '#preview', '#methods', '#stack', '#demo-login'],
    );
  });

  it('covers core product features and analytics methods', () => {
    assert.ok(LANDING_FEATURES.length >= 4);

    assert.deepEqual(
      ANALYTICS_METHODS.map((method) => method.title),
      ['KPI summary', 'Sales trend', 'Product performance', 'Inventory risk'],
    );
  });

  it('shows the implementation stack used by the project', () => {
    assert.deepEqual(
      TECH_STACK_ITEMS.map((item) => item.name),
      ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Prisma', 'Docker'],
    );
  });
});
