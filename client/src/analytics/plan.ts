import {
  type AnalyticsChartType,
  type AnalyticsDimensionId,
  type AnalyticsMetricId,
  type AnalyticsPlan,
  type AnalyticsTimezone,
} from './types';

type Option<T extends string> = {
  label: string;
  value: T;
};

export const ANALYTICS_METRIC_OPTIONS: Array<Option<AnalyticsMetricId>> = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'grossProfit', label: 'Gross profit' },
  { value: 'grossMarginPct', label: 'Gross margin' },
  { value: 'orders', label: 'Orders' },
  { value: 'averageOrderValue', label: 'Average order value' },
  { value: 'unitsSold', label: 'Units sold' },
  { value: 'currentStock', label: 'Current stock' },
  { value: 'lowStockProducts', label: 'Low-stock products' },
  { value: 'stockoutRiskProducts', label: 'Stockout-risk products' },
  { value: 'reorderSoonProducts', label: 'Reorder-soon products' },
  { value: 'slowMoverProducts', label: 'Slow-moving products' },
  { value: 'deadStockProducts', label: 'Dead-stock products' },
  { value: 'discountCandidateProducts', label: 'Discount candidates' },
  { value: 'overstockedProducts', label: 'Overstocked products' },
];

export const ANALYTICS_DIMENSION_OPTIONS: Array<Option<AnalyticsDimensionId>> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'channel', label: 'Channel' },
  { value: 'product', label: 'Product' },
  { value: 'category', label: 'Category' },
  { value: 'status', label: 'Status' },
];

export const ANALYTICS_CHART_OPTIONS: Array<Option<AnalyticsChartType>> = [
  { value: 'line', label: 'Line chart' },
  { value: 'bar', label: 'Bar chart' },
  { value: 'donut', label: 'Donut chart' },
  { value: 'table', label: 'Table' },
];

export const ANALYTICS_TIMEZONE_OPTIONS: Array<Option<AnalyticsTimezone>> = [
  { value: 'Pacific/Auckland', label: 'Auckland time' },
  { value: 'UTC', label: 'UTC' },
];

const ALL_DIMENSIONS = ANALYTICS_DIMENSION_OPTIONS.map(({ value }) => value);
const INVENTORY_DIMENSIONS: AnalyticsDimensionId[] = ['product', 'category', 'status'];
const INVENTORY_GROUP_DIMENSIONS: AnalyticsDimensionId[] = ['category', 'status'];
const TEMPORAL_DIMENSIONS = new Set<AnalyticsDimensionId>(['day', 'week', 'month']);
const INVENTORY_METRICS = new Set<AnalyticsMetricId>([
  'currentStock',
  'lowStockProducts',
  'stockoutRiskProducts',
  'reorderSoonProducts',
  'slowMoverProducts',
  'deadStockProducts',
  'discountCandidateProducts',
  'overstockedProducts',
]);

const METRIC_DIMENSIONS: Record<AnalyticsMetricId, readonly AnalyticsDimensionId[]> = {
  revenue: ALL_DIMENSIONS,
  grossProfit: ALL_DIMENSIONS,
  grossMarginPct: ALL_DIMENSIONS,
  orders: ALL_DIMENSIONS,
  averageOrderValue: ['day', 'week', 'month', 'channel'],
  unitsSold: ALL_DIMENSIONS,
  currentStock: INVENTORY_DIMENSIONS,
  lowStockProducts: INVENTORY_GROUP_DIMENSIONS,
  stockoutRiskProducts: INVENTORY_GROUP_DIMENSIONS,
  reorderSoonProducts: INVENTORY_GROUP_DIMENSIONS,
  slowMoverProducts: INVENTORY_GROUP_DIMENSIONS,
  deadStockProducts: INVENTORY_GROUP_DIMENSIONS,
  discountCandidateProducts: INVENTORY_GROUP_DIMENSIONS,
  overstockedProducts: INVENTORY_GROUP_DIMENSIONS,
};

export function validateAnalyticsPlan(plan: AnalyticsPlan): string[] {
  const errors: string[] = [];

  if (plan.metrics.length === 0) {
    errors.push('Select at least one metric.');
  } else if (plan.metrics.length > 3) {
    errors.push('Select up to three metrics.');
  }

  if (new Set(plan.metrics).size !== plan.metrics.length) {
    errors.push('Selected metrics must be unique.');
  }

  if (plan.dimensions.length > 2) {
    errors.push('Select up to two groupings.');
  }

  if (new Set(plan.dimensions).size !== plan.dimensions.length) {
    errors.push('Selected groupings must be unique.');
  }

  for (const dimension of plan.dimensions) {
    for (const metric of plan.metrics) {
      if (!METRIC_DIMENSIONS[metric].includes(dimension)) {
        errors.push(`${getDimensionLabel(dimension)} cannot group ${getMetricLabel(metric)}.`);
      }
    }
  }

  validateDateRange(plan, errors);

  if (!Number.isInteger(plan.limit) || plan.limit < 1 || plan.limit > 100) {
    errors.push('Row limit must be a whole number between 1 and 100.');
  }

  for (const sort of plan.sort) {
    if (![...plan.metrics, ...plan.dimensions].includes(sort.field)) {
      errors.push('Sort field must remain in the selected result.');
    }
  }

  if (
    plan.filters.some(({ field }) => field === 'channel') &&
    plan.metrics.some((metric) => INVENTORY_METRICS.has(metric))
  ) {
    errors.push('Channel filters cannot be used with inventory metrics.');
  }

  validateChart(plan, errors);
  return [...new Set(errors)];
}

export function getMetricLabel(metric: AnalyticsMetricId): string {
  return ANALYTICS_METRIC_OPTIONS.find(({ value }) => value === metric)?.label ?? metric;
}

export function getDimensionLabel(dimension: AnalyticsDimensionId): string {
  return ANALYTICS_DIMENSION_OPTIONS.find(({ value }) => value === dimension)?.label ?? dimension;
}

export function getAnalyticsFieldLabel(field: AnalyticsMetricId | AnalyticsDimensionId): string {
  return (
    ANALYTICS_METRIC_OPTIONS.find(({ value }) => value === field)?.label ??
    ANALYTICS_DIMENSION_OPTIONS.find(({ value }) => value === field)?.label ??
    field
  );
}

export function isTemporalDimension(dimension: AnalyticsDimensionId): boolean {
  return TEMPORAL_DIMENSIONS.has(dimension);
}

function validateDateRange(plan: AnalyticsPlan, errors: string[]): void {
  const from = parseDateOnly(plan.dateRange.from);
  const to = parseDateOnly(plan.dateRange.to);

  if (from === null) {
    errors.push('Choose a valid start date.');
  }

  if (to === null) {
    errors.push('Choose a valid end date.');
  }

  if (from === null || to === null) {
    return;
  }

  if (to < from) {
    errors.push('The end date must be on or after the start date.');
    return;
  }

  const inclusiveDays = Math.floor((to - from) / 86_400_000) + 1;
  if (inclusiveDays > 366) {
    errors.push('Date range cannot exceed 366 days.');
  }
}

function validateChart(plan: AnalyticsPlan, errors: string[]): void {
  const [dimension] = plan.dimensions;

  if (
    plan.chart.type === 'line' &&
    (plan.dimensions.length !== 1 || dimension === undefined || !isTemporalDimension(dimension))
  ) {
    errors.push('Line charts require one time grouping.');
  }

  if (plan.chart.type === 'bar' && plan.dimensions.length !== 1) {
    errors.push('Bar charts require one grouping.');
  }

  if (
    plan.chart.type === 'donut' &&
    (plan.dimensions.length !== 1 || dimension === undefined || isTemporalDimension(dimension))
  ) {
    errors.push('Donut charts require one category grouping.');
  }
}

function parseDateOnly(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? parsed.getTime()
    : null;
}
