import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANALYTICS_EVALUATION_CASES,
  runDeterministicAnalyticsEvaluation,
  type AnalyticsEvaluationCase,
} from './analyticsEvaluation';

describe('deterministic analytics evaluation', () => {
  it('passes representative planning and numeric retail fixtures without a live model', async () => {
    const report = await runDeterministicAnalyticsEvaluation();

    assert.ok(ANALYTICS_EVALUATION_CASES.length >= 4);
    assert.equal(report.score, 1);
    assert.equal(report.passed, report.total);
    assert.deepEqual(report.failures, []);
    assert.ok(report.cases.every((result) => result.planPassed && result.executionPassed));
  });

  it('returns case-level diagnostics when an expected plan property drifts', async () => {
    const brokenCase: AnalyticsEvaluationCase = {
      ...ANALYTICS_EVALUATION_CASES[0],
      id: 'intentional-plan-drift',
      expectedPlan: {
        ...ANALYTICS_EVALUATION_CASES[0].expectedPlan,
        metrics: ['orders'],
      },
    };

    const report = await runDeterministicAnalyticsEvaluation([brokenCase]);

    assert.equal(report.score, 0);
    assert.equal(report.failures.length, 1);
    assert.equal(report.failures[0]?.id, 'intentional-plan-drift');
    assert.match(report.failures[0]?.diagnostics.join(' ') ?? '', /metrics/);
  });
});
