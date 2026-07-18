import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalyticsResultPanel } from './AnalyticsResultPanel';
import { createAnalyticsResult } from './analyticsTestFixtures';

describe('AnalyticsResultPanel', () => {
  it('shows report context, safe view controls, and series controls', () => {
    const markup = renderToStaticMarkup(
      createElement(AnalyticsResultPanel, { result: createAnalyticsResult() }),
    );

    assert.match(markup, /Revenue and margin by channel/);
    assert.match(markup, /1 Jul to 19 Jul 2026/);
    assert.match(markup, /Channel is Shopify or In store/);
    assert.match(markup, /Revenue, highest first/);
    assert.match(markup, /2 rows/);
    assert.match(markup, /Bar chart/);
    assert.match(markup, /Data table/);
    assert.match(markup, /Revenue series/);
    assert.match(markup, /Gross margin series/);
    assert.match(markup, /aria-label="Line chart"[^>]*aria-disabled="true"/);
    assert.doesNotMatch(markup, /aria-label="Line chart"[^>]*disabled=""/);
    assert.doesNotMatch(markup, /dangerouslySetInnerHTML/);
  });

  it('escapes response content instead of executing markup', () => {
    const result = createAnalyticsResult();
    result.table.rows[0] = {
      channel: '<img src=x onerror=alert(1)>',
      revenue: 42_800,
      grossMarginPct: 44.2,
    };

    const markup = renderToStaticMarkup(createElement(AnalyticsResultPanel, { result }));

    assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.doesNotMatch(markup, /<img src="x"/);
  });

  it('renders a useful empty state while keeping the table option available', () => {
    const result = createAnalyticsResult({ rowCount: 0 });
    const markup = renderToStaticMarkup(createElement(AnalyticsResultPanel, { result }));

    assert.match(markup, /No matching data/);
    assert.match(markup, /wider date range/);
    assert.match(markup, /Data table/);
  });

  it('offers only summable metrics in the donut selector', () => {
    const result = createAnalyticsResult({ chart: 'donut' });
    result.plan.metrics.push('grossProfit');
    result.table.columns.push({
      key: 'grossProfit',
      label: 'Gross profit',
      kind: 'metric',
      unit: 'NZD',
    });
    result.table.rows.forEach((row, index) => {
      row.grossProfit = 18_000 - index * 1_000;
    });
    result.chart.series.push({
      key: 'grossProfit',
      label: 'Gross profit',
      unit: 'NZD',
      data: [],
    });
    const markup = renderToStaticMarkup(createElement(AnalyticsResultPanel, { result }));
    const selector = markup.match(/<select[\s\S]*?<\/select>/)?.[0] ?? '';

    assert.match(selector, /Revenue/);
    assert.match(selector, /Gross profit/);
    assert.doesNotMatch(selector, /Gross margin/);
  });

  it('makes the visible exact-value table keyboard scrollable', () => {
    const result = createAnalyticsResult({ chart: 'table' });
    const markup = renderToStaticMarkup(createElement(AnalyticsResultPanel, { result }));

    assert.match(
      markup,
      /role="region" aria-label="Exact values for Revenue and margin by channel" tabindex="0"/,
    );
  });

  it('explains when the requested chart must fall back to the table', () => {
    const result = createAnalyticsResult({ chart: 'donut', rowCount: 13 });
    const markup = renderToStaticMarkup(createElement(AnalyticsResultPanel, { result }));

    assert.match(markup, /Donut chart is unavailable/);
    assert.match(markup, /12 rows or fewer/);
    assert.match(markup, /Showing the data table instead/);
  });
});
