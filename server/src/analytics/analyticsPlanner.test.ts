import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAnalyticsPlanner,
  type AnalyticsPlannerProvider,
  type AnalyticsPlannerProviderRequest,
} from './analyticsPlanner';

const providerPlan = {
  status: 'ready',
  message: 'Gross margin by category for the last 30 days.',
  plan: {
    schemaVersion: 1,
    metrics: ['grossMarginPct'],
    dimensions: ['category'],
    dateRange: { from: '2026-06-20', to: '2026-07-19', timezone: 'Pacific/Auckland' },
    filters: [],
    sort: [{ field: 'grossMarginPct', direction: 'desc' }],
    limit: 20,
    chart: { type: 'bar' },
  },
};

describe('analytics planner', () => {
  it('plans common retail questions deterministically without a provider', async () => {
    const planner = createAnalyticsPlanner({ now: fixedNow });

    const result = await planner.plan({
      question: 'Show the top 5 products by revenue this month',
      timezone: 'Pacific/Auckland',
    });

    assert.equal(result.status, 'ready');
    assert.equal(result.source, 'local');
    if (result.status !== 'ready') return;
    assert.deepEqual(result.plan.metrics, ['revenue']);
    assert.deepEqual(result.plan.dimensions, ['product']);
    assert.deepEqual(result.plan.dateRange, {
      from: '2026-07-01',
      to: '2026-07-19',
      timezone: 'Pacific/Auckland',
    });
    assert.deepEqual(result.plan.sort, [{ field: 'revenue', direction: 'desc' }]);
    assert.equal(result.plan.limit, 5);
    assert.equal(result.plan.chart.type, 'bar');
  });

  it('refines a validated current plan without discarding its existing context', async () => {
    const planner = createAnalyticsPlanner({ now: fixedNow });
    const currentPlan = providerPlan.plan;

    const result = await planner.plan({
      question: 'Show the top 8 as a table instead',
      timezone: 'Pacific/Auckland',
      currentPlan,
    });

    assert.equal(result.status, 'ready');
    if (result.status !== 'ready') return;
    assert.deepEqual(result.plan.metrics, ['grossMarginPct']);
    assert.deepEqual(result.plan.dimensions, ['category']);
    assert.deepEqual(result.plan.dateRange, currentPlan.dateRange);
    assert.equal(result.plan.limit, 8);
    assert.equal(result.plan.chart.type, 'table');
  });

  it('validates provider output and limits prompts to the semantic catalog', async () => {
    let capturedRequest: AnalyticsPlannerProviderRequest | undefined;
    const provider = createProvider(async (request) => {
      capturedRequest = request;
      return JSON.stringify(providerPlan);
    });
    const planner = createAnalyticsPlanner({ provider, now: fixedNow });

    const result = await planner.plan({
      question: 'Build a useful category profitability view',
      timezone: 'Pacific/Auckland',
    });

    assert.equal(result.status, 'ready');
    assert.equal(result.source, 'provider');
    assert.ok(capturedRequest?.systemPrompt.includes('grossMarginPct'));
    assert.ok(capturedRequest?.systemPrompt.includes('category'));
    assert.ok(!capturedRequest?.systemPrompt.includes('merchantRows'));
    assert.ok(!capturedRequest?.userPrompt.includes('businessId'));
  });

  it('passes validated refinement context to providers without executable fields', async () => {
    let capturedRequest: AnalyticsPlannerProviderRequest | undefined;
    const provider = createProvider(async (request) => {
      capturedRequest = request;
      return JSON.stringify(providerPlan);
    });
    const planner = createAnalyticsPlanner({ provider, now: fixedNow });

    await planner.plan({
      question: 'Use a line chart with a different comparison',
      timezone: 'Pacific/Auckland',
      currentPlan: providerPlan.plan,
    });

    assert.match(capturedRequest?.userPrompt ?? '', /"currentPlan"/);
    assert.doesNotMatch(capturedRequest?.userPrompt ?? '', /rawSql|javascript/i);
  });

  it('retries invalid JSON once and returns a safe fallback', async () => {
    let attempts = 0;
    const provider = createProvider(async () => {
      attempts += 1;
      return 'not-json';
    });
    const planner = createAnalyticsPlanner({ provider, now: fixedNow, maxRetries: 1 });

    const result = await planner.plan({ question: 'Build a useful report for this period' });

    assert.equal(attempts, 2);
    assert.equal(result.status, 'clarification');
    assert.equal(result.source, 'local');
  });

  it('rejects provider plans that fail the shared schema', async () => {
    const invalidPlan = {
      ...providerPlan,
      plan: { ...providerPlan.plan, rawSql: 'select * from orders' },
    };
    const provider = createProvider(async () => JSON.stringify(invalidPlan));
    const planner = createAnalyticsPlanner({ provider, now: fixedNow, maxRetries: 0 });

    const result = await planner.plan({ question: 'Build a useful report for this period' });

    assert.equal(result.status, 'clarification');
    assert.equal(result.source, 'local');
  });

  it('rejects tenant selection, unsupported fields, and unbounded provider plans', async () => {
    const adversarialPlans = [
      { ...providerPlan.plan, businessId: 'other-tenant' },
      { ...providerPlan.plan, metrics: ['customerEmail'] },
      {
        ...providerPlan.plan,
        dateRange: {
          from: '2020-01-01',
          to: '2026-07-19',
          timezone: 'Pacific/Auckland',
        },
      },
      { ...providerPlan.plan, limit: 10_000 },
    ];

    for (const plan of adversarialPlans) {
      const planner = createAnalyticsPlanner({
        provider: createProvider(async () => JSON.stringify({ ...providerPlan, plan })),
        now: fixedNow,
        maxRetries: 0,
      });

      const result = await planner.plan({ question: 'Build a useful report for this period' });
      assert.equal(result.status, 'clarification');
      assert.equal(result.source, 'local');
    }
  });

  it('aborts a stalled provider and falls back without throwing', async () => {
    let observedAbort = false;
    const provider = createProvider(
      (request) =>
        new Promise<string>((_resolve, reject) => {
          request.signal.addEventListener('abort', () => {
            observedAbort = true;
            reject(request.signal.reason);
          });
        }),
    );
    const planner = createAnalyticsPlanner({ provider, now: fixedNow, timeoutMs: 5 });

    const result = await planner.plan({ question: 'Build a useful report for this period' });

    assert.equal(observedAbort, true);
    assert.equal(result.status, 'clarification');
    assert.equal(result.source, 'local');
  });

  it('preserves safe provider refusals and skips providers for unsupported requests', async () => {
    let providerCalls = 0;
    const provider = createProvider(async () => {
      providerCalls += 1;
      return JSON.stringify({
        status: 'unsupported',
        message: 'That metric is not in the analytics catalog.',
        examples: ['Revenue by channel'],
      });
    });
    const planner = createAnalyticsPlanner({ provider, now: fixedNow });

    const refusal = await planner.plan({ question: 'Build a cohort retention report' });
    assert.equal(refusal.status, 'unsupported');
    assert.equal(refusal.source, 'provider');

    const unsupported = await planner.plan({ question: 'Predict customer lifetime value' });
    assert.equal(unsupported.status, 'unsupported');
    assert.equal(unsupported.source, 'local');
    assert.equal(providerCalls, 1);
  });
});

function createProvider(
  generate: (request: AnalyticsPlannerProviderRequest) => Promise<string>,
): AnalyticsPlannerProvider {
  return { generate };
}

function fixedNow(): Date {
  return new Date('2026-07-19T05:00:00.000Z');
}
