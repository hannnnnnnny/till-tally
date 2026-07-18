import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANALYTICS_METRIC_CATALOG,
  ANALYTICS_METRIC_IDS,
  analyticsPlanSchema,
  parseAnalyticsPlan,
} from './index';
import { invalidAnalyticsPlanFixtures, validAnalyticsPlanFixtures } from './test-fixtures';

describe('analytics plan contract', () => {
  it('accepts supported sales and inventory plans', () => {
    for (const fixture of validAnalyticsPlanFixtures) {
      assert.equal(analyticsPlanSchema.safeParse(fixture).success, true);
    }
  });

  it('rejects unsafe, oversized, and incompatible plans', () => {
    for (const fixture of invalidAnalyticsPlanFixtures) {
      const result = analyticsPlanSchema.safeParse(fixture.plan);
      assert.equal(result.success, false, fixture.name);
    }
  });

  it('returns a deeply validated plan without retaining unknown input', () => {
    const parsed = parseAnalyticsPlan(validAnalyticsPlanFixtures[0]);

    assert.equal(parsed.schemaVersion, 1);
    assert.deepEqual(parsed.metrics, ['revenue', 'grossProfit']);
    assert.deepEqual(parsed.dimensions, ['day']);
  });

  it('documents every canonical metric', () => {
    assert.deepEqual(
      Object.keys(ANALYTICS_METRIC_CATALOG).sort(),
      [...ANALYTICS_METRIC_IDS].sort(),
    );

    for (const metric of Object.values(ANALYTICS_METRIC_CATALOG)) {
      assert.ok(metric.source.length > 0);
      assert.ok(metric.aggregation.length > 0);
      assert.ok(metric.unit.length > 0);
      assert.ok(metric.nullBehavior.length > 0);
      assert.ok(metric.compatibleDimensions.length > 0);
    }
  });
});
