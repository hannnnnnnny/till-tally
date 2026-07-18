export const validAnalyticsPlanFixtures = [
  {
    schemaVersion: 1,
    metrics: ['revenue', 'grossProfit'],
    dimensions: ['day'],
    dateRange: {
      from: '2026-06-01',
      to: '2026-06-30',
      timezone: 'Pacific/Auckland',
    },
    filters: [],
    sort: [{ field: 'day', direction: 'asc' }],
    limit: 31,
    chart: { type: 'line' },
  },
  {
    schemaVersion: 1,
    metrics: ['revenue', 'orders'],
    dimensions: ['channel'],
    dateRange: { from: '2026-01-01', to: '2026-06-30', timezone: 'UTC' },
    filters: [{ field: 'channel', operator: 'in', value: ['SHOPIFY', 'IN_STORE'] }],
    sort: [{ field: 'revenue', direction: 'desc' }],
    limit: 10,
    chart: { type: 'donut' },
  },
  {
    schemaVersion: 1,
    metrics: ['currentStock'],
    dimensions: ['product'],
    dateRange: {
      from: '2026-07-01',
      to: '2026-07-19',
      timezone: 'Pacific/Auckland',
    },
    filters: [{ field: 'currentStock', operator: 'lte', value: 10 }],
    sort: [{ field: 'currentStock', direction: 'asc' }],
    limit: 25,
    chart: { type: 'bar' },
  },
] as const;

export const invalidAnalyticsPlanFixtures = [
  {
    name: 'unknown root field',
    plan: { ...validAnalyticsPlanFixtures[0], rawSql: 'select * from orders' },
  },
  {
    name: 'excessive limit',
    plan: { ...validAnalyticsPlanFixtures[0], limit: 1_000 },
  },
  {
    name: 'unbounded date range',
    plan: {
      ...validAnalyticsPlanFixtures[0],
      dateRange: { from: '2025-01-01', to: '2026-06-30', timezone: 'UTC' },
    },
  },
  {
    name: 'incompatible inventory time series',
    plan: {
      ...validAnalyticsPlanFixtures[0],
      metrics: ['currentStock'],
      dimensions: ['day'],
    },
  },
  {
    name: 'unsupported filter operator',
    plan: {
      ...validAnalyticsPlanFixtures[2],
      filters: [{ field: 'currentStock', operator: 'contains', value: '10' }],
    },
  },
  {
    name: 'sort field outside the selected result',
    plan: {
      ...validAnalyticsPlanFixtures[1],
      sort: [{ field: 'grossProfit', direction: 'desc' }],
    },
  },
  {
    name: 'incompatible line chart',
    plan: { ...validAnalyticsPlanFixtures[1], chart: { type: 'line' } },
  },
] as const;
