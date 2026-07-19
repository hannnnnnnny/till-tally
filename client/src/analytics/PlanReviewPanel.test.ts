import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanReviewPanel } from './PlanReviewPanel';
import { type AnalyticsPlan } from './types';

const plan: AnalyticsPlan = {
  schemaVersion: 1,
  metrics: ['revenue', 'grossMarginPct'],
  dimensions: ['channel'],
  dateRange: {
    from: '2026-06-01',
    to: '2026-06-30',
    timezone: 'Pacific/Auckland',
  },
  filters: [{ field: 'channel', operator: 'eq', value: 'Shopify' }],
  sort: [{ field: 'revenue', direction: 'desc' }],
  limit: 25,
  chart: { type: 'bar' },
};

describe('PlanReviewPanel', () => {
  it('clearly identifies an AI-assisted draft and exposes bounded controls', () => {
    const markup = renderToStaticMarkup(
      createElement(PlanReviewPanel, {
        plan,
        source: 'provider',
        message: 'Revenue and margin grouped by channel.',
        errors: [],
        disabled: false,
        onChange: () => undefined,
        onRun: () => undefined,
      }),
    );

    assert.match(markup, /AI-assisted draft/);
    assert.match(markup, /Review before running/);
    assert.match(markup, /Metric 1/);
    assert.match(markup, /Gross margin/);
    assert.match(markup, /Group by/);
    assert.match(markup, /Auckland time/);
    assert.match(markup, /Channel equals Shopify/);
    assert.match(markup, /Run analysis/);
    assert.doesNotMatch(markup, /SQL|JavaScript/);
  });

  it('renders validation feedback and disables execution', () => {
    const markup = renderToStaticMarkup(
      createElement(PlanReviewPanel, {
        plan,
        source: 'local',
        message: 'Built from your question.',
        errors: ['Line charts require one time grouping.'],
        disabled: true,
        onChange: () => undefined,
        onRun: () => undefined,
      }),
    );

    assert.match(markup, /Built-in interpretation/);
    assert.match(markup, /Line charts require one time grouping/);
    assert.match(markup, /disabled=""/);
  });

  it('keeps the first metric editable when a draft has no metric', () => {
    const markup = renderToStaticMarkup(
      createElement(PlanReviewPanel, {
        plan: { ...plan, metrics: [] },
        source: 'local',
        message: 'Choose a metric to continue.',
        errors: ['Select at least one metric.'],
        disabled: false,
        onChange: () => undefined,
        onRun: () => undefined,
      }),
    );

    const firstMetric = markup.match(/<select[^>]*required=""[^>]*>/)?.[0];
    assert.ok(firstMetric);
    assert.doesNotMatch(firstMetric, /\sdisabled=""/);
  });
});
