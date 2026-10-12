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
      id: 'intentional-plan-drift',
      question: 'Show daily revenue this month',
      expectedPlan: { metrics: ['orders'], dimensions: ['day'], chartType: 'line' },
    };

    const report = await runDeterministicAnalyticsEvaluation([brokenCase]);

    assert.equal(report.score, 0);
    assert.equal(report.failures.length, 1);
    assert.equal(report.failures[0]?.id, 'intentional-plan-drift');
    assert.match(report.failures[0]?.diagnostics.join(' ') ?? '', /metrics/);
  });

  it('reports a status diagnostic when guidance is expected but a plan is returned', async () => {
    const report = await runDeterministicAnalyticsEvaluation([
      { id: 'expects-guidance', question: 'Revenue by channel', expectedStatus: 'unsupported' },
    ]);

    assert.equal(report.passed, 0);
    assert.match(report.failures[0]?.diagnostics.join(' ') ?? '', /status: expected "unsupported"/);
  });

  it('covers ready, refinement and guidance paths', () => {
    const guidance = ANALYTICS_EVALUATION_CASES.filter((c) => 'expectedStatus' in c);
    const refinements = ANALYTICS_EVALUATION_CASES.filter((c) => 'currentPlan' in c);

    assert.ok(ANALYTICS_EVALUATION_CASES.length >= 15);
    assert.ok(guidance.length >= 3);
    assert.ok(refinements.length >= 3);
  });
});
