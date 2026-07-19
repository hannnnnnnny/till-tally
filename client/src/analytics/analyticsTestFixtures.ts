import { type AnalyticsExecutionResult } from './types';

export function createAnalyticsResult({
  chart = 'bar',
  dimension = 'channel',
  rowCount = 2,
}: {
  chart?: AnalyticsExecutionResult['chart']['type'];
  dimension?: AnalyticsExecutionResult['plan']['dimensions'][number] | null;
  rowCount?: number;
} = {}): AnalyticsExecutionResult {
  const dimensions = dimension ? [dimension] : [];
  const dimensionColumn = dimension
    ? [
        {
          key: dimension,
          label: dimension === 'day' ? 'Day' : 'Channel',
          kind: 'dimension' as const,
          unit: null,
        },
      ]
    : [];
  const rows: Array<Record<string, string | number | null>> = Array.from(
    { length: rowCount },
    (_, index) => ({
      ...(dimension
        ? {
            [dimension]:
              dimension === 'day'
                ? `2026-07-${String(index + 1).padStart(2, '0')}`
                : index === 0
                  ? 'Shopify'
                  : `Channel ${index + 1}`,
          }
        : {}),
      revenue: 42_800 - index * 1_000,
      grossMarginPct: 44.2 - index,
    }),
  );

  return {
    plan: {
      schemaVersion: 1,
      metrics: ['revenue', 'grossMarginPct'],
      dimensions,
      dateRange: {
        from: '2026-07-01',
        to: '2026-07-19',
        timezone: 'Pacific/Auckland',
      },
      filters: [{ field: 'channel', operator: 'in', value: ['SHOPIFY', 'IN_STORE'] }],
      sort: [{ field: 'revenue', direction: 'desc' }],
      limit: 25,
      chart: { type: chart },
    },
    title: 'Revenue and margin by channel',
    datasets: ['orders'],
    table: {
      columns: [
        ...dimensionColumn,
        { key: 'revenue', label: 'Revenue', kind: 'metric', unit: 'NZD' },
        {
          key: 'grossMarginPct',
          label: 'Gross margin',
          kind: 'metric',
          unit: 'percent',
        },
      ],
      rows,
    },
    chart: {
      type: chart,
      categoryKey: dimension,
      series: [
        {
          key: 'revenue',
          label: 'Revenue',
          unit: 'NZD',
          data: rows.map((row) => ({
            category: dimension ? String(row[dimension]) : 'Total',
            value: Number(row.revenue),
          })),
        },
        {
          key: 'grossMarginPct',
          label: 'Gross margin',
          unit: 'percent',
          data: rows.map((row) => ({
            category: dimension ? String(row[dimension]) : 'Total',
            value: Number(row.grossMarginPct),
          })),
        },
      ],
    },
    meta: {
      rowCount,
      totalRows: rowCount,
      truncated: false,
      durationMs: 18,
      executedAt: '2026-07-19T00:30:00.000Z',
    },
  };
}
