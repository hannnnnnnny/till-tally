import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAnalyticsChartData,
  buildAnalyticsSeriesColors,
  canShowMetricSeries,
  describeAnalyticsFilters,
  describeAnalyticsSort,
  formatAnalyticsDateRange,
  formatAnalyticsDimensionValue,
  formatAnalyticsExecutionTime,
  formatAnalyticsValue,
  getDefaultVisibleSeries,
  getDonutCompatibleMetrics,
  getInitialVisualization,
  getVisualizationOptions,
  toggleMetricSeries,
} from './resultModel';
import { createAnalyticsResult } from './analyticsTestFixtures';

describe('analytics result model', () => {
  it('allows temporal results to switch safely between line, bar, and table', () => {
    const result = createAnalyticsResult({ dimension: 'day', chart: 'line' });
    const options = getVisualizationOptions(result);

    assert.deepEqual(
      options.map(({ type, compatible }) => ({ type, compatible })),
      [
        { type: 'line', compatible: true },
        { type: 'bar', compatible: true },
        { type: 'donut', compatible: false },
        { type: 'table', compatible: true },
      ],
    );
    assert.equal(getInitialVisualization(result), 'line');
  });

  it('supports category donuts using only summable metrics', () => {
    const result = createAnalyticsResult({ dimension: 'channel', chart: 'donut' });
    const options = getVisualizationOptions(result);

    assert.equal(options.find(({ type }) => type === 'donut')?.compatible, true);
    assert.deepEqual(getDonutCompatibleMetrics(result), ['revenue']);
    assert.equal(getInitialVisualization(result), 'donut');
  });

  it('blocks unreadable donut and ungrouped chart combinations with reasons', () => {
    const dense = createAnalyticsResult({ dimension: 'channel', rowCount: 13 });
    const denseDonut = getVisualizationOptions(dense).find(({ type }) => type === 'donut');
    assert.equal(denseDonut?.compatible, false);
    assert.match(denseDonut?.reason ?? '', /12 rows or fewer/);

    const denseBar = createAnalyticsResult({ dimension: 'channel', rowCount: 21 });
    const bar = getVisualizationOptions(denseBar).find(({ type }) => type === 'bar');
    assert.equal(bar?.compatible, false);
    assert.match(bar?.reason ?? '', /20 rows or fewer/);

    const ungrouped = createAnalyticsResult({ dimension: null, chart: 'bar' });
    assert.deepEqual(
      getVisualizationOptions(ungrouped)
        .filter(({ compatible }) => compatible)
        .map(({ type }) => type),
      ['table'],
    );
    assert.equal(getInitialVisualization(ungrouped), 'table');
  });

  it('blocks charts when the result shape or numeric data is incomplete', () => {
    const missingSeries = createAnalyticsResult();
    missingSeries.chart.series = [];
    assert.deepEqual(
      getVisualizationOptions(missingSeries)
        .filter(({ compatible }) => compatible)
        .map(({ type }) => type),
      ['table'],
    );

    const missingDimension = createAnalyticsResult();
    missingDimension.table.columns = missingDimension.table.columns.filter(
      ({ kind }) => kind !== 'dimension',
    );
    assert.deepEqual(
      getVisualizationOptions(missingDimension)
        .filter(({ compatible }) => compatible)
        .map(({ type }) => type),
      ['table'],
    );

    const emptyMetrics = createAnalyticsResult();
    emptyMetrics.table.rows = emptyMetrics.table.rows.map((row) => ({
      ...row,
      revenue: null,
      grossMarginPct: null,
    }));
    assert.deepEqual(
      getVisualizationOptions(emptyMetrics)
        .filter(({ compatible }) => compatible)
        .map(({ type }) => type),
      ['table'],
    );
  });

  it('only offers complete non-negative metrics for donut charts', () => {
    const result = createAnalyticsResult({ chart: 'donut' });

    assert.deepEqual(getDonutCompatibleMetrics(result), ['revenue']);

    result.table.rows[1].revenue = null;
    assert.deepEqual(getDonutCompatibleMetrics(result), []);
    assert.equal(
      getVisualizationOptions(result).find(({ type }) => type === 'donut')?.compatible,
      false,
    );
  });

  it('projects rows into chart data while preserving missing metric values', () => {
    const result = createAnalyticsResult({ dimension: 'channel' });
    result.table.rows[1] = { channel: 'In store', revenue: 24_100, grossMarginPct: null };

    assert.deepEqual(buildAnalyticsChartData(result), [
      { category: 'Shopify', revenue: 42_800, grossMarginPct: 44.2 },
      { category: 'In store', revenue: 24_100, grossMarginPct: null },
    ]);
  });

  it('formats units, missing values, dates, filters, and sort order for people', () => {
    const result = createAnalyticsResult({ dimension: 'channel' });

    assert.equal(formatAnalyticsValue(42_800, 'NZD'), '$42,800.00');
    assert.equal(formatAnalyticsValue(44.24, 'percent'), '44.2%');
    assert.equal(formatAnalyticsValue(1284, 'count'), '1,284');
    assert.equal(formatAnalyticsValue(null, 'NZD'), 'Unavailable');
    assert.equal(formatAnalyticsDimensionValue('2026-07-01', 'day'), '1 Jul');
    assert.equal(formatAnalyticsDimensionValue('2026-07', 'month'), 'Jul 2026');
    assert.equal(formatAnalyticsDateRange(result.plan.dateRange), '1 Jul to 19 Jul 2026');
    assert.equal(describeAnalyticsFilters(result.plan.filters), 'Channel is Shopify or In store');
    assert.equal(describeAnalyticsSort(result.plan.sort), 'Revenue, highest first');
    assert.equal(
      describeAnalyticsSort([{ field: 'day', direction: 'asc' }]),
      'Day, earliest first',
    );
    assert.equal(
      describeAnalyticsSort([{ field: 'channel', direction: 'desc' }]),
      'Channel, Z to A',
    );
    assert.match(
      formatAnalyticsExecutionTime('2026-07-19T00:30:00.000Z', 'UTC'),
      /19 Jul 2026, 12:30 am UTC/,
    );
  });

  it('keeps at least one metric series visible', () => {
    assert.deepEqual(toggleMetricSeries(['revenue', 'grossMarginPct'], 'grossMarginPct'), [
      'revenue',
    ]);
    assert.deepEqual(toggleMetricSeries(['revenue'], 'revenue'), ['revenue']);
    assert.deepEqual(toggleMetricSeries(['revenue'], 'grossMarginPct'), [
      'revenue',
      'grossMarginPct',
    ]);
  });

  it('limits visible chart series to two unit groups', () => {
    const series = createAnalyticsResult().chart.series;
    series.push({
      key: 'orders',
      label: 'Orders',
      unit: 'orders',
      data: [],
    });

    assert.deepEqual(getDefaultVisibleSeries(series), ['revenue', 'grossMarginPct']);
    assert.equal(canShowMetricSeries(['revenue', 'grossMarginPct'], 'orders', series), false);
    assert.equal(canShowMetricSeries(['revenue'], 'orders', series), true);
  });

  it('keeps series colors stable when earlier series are hidden', () => {
    const series = createAnalyticsResult().chart.series;
    const colors = buildAnalyticsSeriesColors(series);

    assert.equal(colors.revenue, '#2563eb');
    assert.equal(colors.grossMarginPct, '#059669');
  });
});
