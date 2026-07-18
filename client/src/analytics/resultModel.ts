import {
  type AnalyticsChartType,
  type AnalyticsDimensionId,
  type AnalyticsExecutionResult,
  type AnalyticsFilter,
  type AnalyticsMetricId,
  type AnalyticsPlan,
  type AnalyticsTimezone,
} from './types';
import { getAnalyticsFieldLabel, getDimensionLabel, isTemporalDimension } from './plan';

export type VisualizationOption = {
  type: AnalyticsChartType;
  label: string;
  compatible: boolean;
  reason: string | null;
};

export type AnalyticsChartDatum = {
  category: string;
} & Partial<Record<AnalyticsMetricId, number | null>>;

const PART_OF_WHOLE_METRICS = new Set<AnalyticsMetricId>([
  'revenue',
  'grossProfit',
  'orders',
  'unitsSold',
  'currentStock',
  'lowStockProducts',
  'stockoutRiskProducts',
  'reorderSoonProducts',
  'slowMoverProducts',
  'deadStockProducts',
  'discountCandidateProducts',
  'overstockedProducts',
]);

const FILTER_FIELD_LABELS: Record<string, string> = {
  channel: 'Channel',
  productId: 'Product',
  category: 'Category',
  status: 'Status',
  sku: 'SKU',
  vendor: 'Vendor',
  currentStock: 'Current stock',
};

const VIEW_LABELS: Record<AnalyticsChartType, string> = {
  line: 'Line chart',
  bar: 'Bar chart',
  donut: 'Donut chart',
  table: 'Data table',
};

const exactNumberFormatter = new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactCurrencyFormatter = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const compactNumberFormatter = new Intl.NumberFormat('en-NZ', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const dayMonthFormatter = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const dayMonthYearFormatter = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthYearFormatter = new Intl.DateTimeFormat('en-NZ', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const executionTimeFormatters: Record<AnalyticsTimezone, Intl.DateTimeFormat> = {
  'Pacific/Auckland': new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Pacific/Auckland',
    timeZoneName: 'short',
  }),
  UTC: new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }),
};

const ANALYTICS_SERIES_COLORS = ['#2563eb', '#059669', '#d97706'];

export function getVisualizationOptions(result: AnalyticsExecutionResult): VisualizationOption[] {
  const [dimension] = result.plan.dimensions;
  const hasOneDimension = result.plan.dimensions.length === 1 && dimension !== undefined;
  const isTemporal = dimension !== undefined && isTemporalDimension(dimension);
  const hasDimensionColumn =
    dimension !== undefined &&
    result.table.columns.some(({ key, kind }) => kind === 'dimension' && key === dimension);
  const seriesMetrics = new Set(result.chart.series.map(({ key }) => key));
  const hasMetricColumns = result.plan.metrics.some(
    (metric) =>
      seriesMetrics.has(metric) &&
      result.table.columns.some(({ key, kind }) => kind === 'metric' && key === metric),
  );
  const hasNumericData = result.table.rows.some((row) =>
    result.plan.metrics.some(
      (metric) => typeof row[metric] === 'number' && Number.isFinite(row[metric]),
    ),
  );
  const hasChartData = hasDimensionColumn && hasMetricColumns && hasNumericData;
  const barHasReadableRowCount = result.table.rows.length <= 20;
  const donutHasReadableRowCount = result.table.rows.length <= 12;
  const hasDonutMetric = getDonutCompatibleMetrics(result).length > 0;

  return [
    createOption(
      'line',
      hasOneDimension && isTemporal && hasChartData,
      hasOneDimension && isTemporal
        ? 'Line charts need a dimension column, series metadata, and numeric values.'
        : 'Line charts need one day, week, or month grouping.',
    ),
    createOption(
      'bar',
      hasOneDimension && hasChartData && barHasReadableRowCount,
      !hasOneDimension
        ? 'Bar charts need exactly one grouping.'
        : !hasChartData
          ? 'Bar charts need a dimension column, series metadata, and numeric values.'
          : 'Bar charts are limited to 20 rows or fewer. Use the data table for dense results.',
    ),
    createOption(
      'donut',
      hasOneDimension && !isTemporal && donutHasReadableRowCount && hasChartData && hasDonutMetric,
      !hasOneDimension || isTemporal
        ? 'Donut charts need one category grouping.'
        : !donutHasReadableRowCount
          ? 'Donut charts are limited to 12 rows or fewer. Use a bar chart or table for this result.'
          : 'Donut charts need a summable metric with complete, non-negative values and a positive total.',
    ),
    createOption('table', true, null),
  ];
}

export function getDonutCompatibleMetrics(result: AnalyticsExecutionResult): AnalyticsMetricId[] {
  const metricColumns = new Set(
    result.table.columns.filter(({ kind }) => kind === 'metric').map(({ key }) => key),
  );

  return result.chart.series
    .map(({ key }) => key)
    .filter((metric) => {
      if (
        !PART_OF_WHOLE_METRICS.has(metric) ||
        !metricColumns.has(metric) ||
        result.table.rows.length === 0
      ) {
        return false;
      }

      const values = result.table.rows.map((row) => row[metric]);
      return (
        values.every(
          (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0,
        ) && values.some((value) => typeof value === 'number' && value > 0)
      );
    });
}

export function buildAnalyticsSeriesColors(
  series: AnalyticsExecutionResult['chart']['series'],
): Partial<Record<AnalyticsMetricId, string>> {
  return Object.fromEntries(
    series.map(({ key }, index) => [
      key,
      ANALYTICS_SERIES_COLORS[index % ANALYTICS_SERIES_COLORS.length],
    ]),
  );
}

export function getInitialVisualization(result: AnalyticsExecutionResult): AnalyticsChartType {
  const requested = getVisualizationOptions(result).find(({ type }) => type === result.chart.type);
  return requested?.compatible ? result.chart.type : 'table';
}

export function buildAnalyticsChartData(result: AnalyticsExecutionResult): AnalyticsChartDatum[] {
  return result.table.rows.map((row) => {
    const datum: AnalyticsChartDatum = {
      category: createCategoryLabel(result.plan.dimensions, row),
    };

    for (const metric of result.plan.metrics) {
      const value = row[metric];
      datum[metric] = typeof value === 'number' ? value : null;
    }

    return datum;
  });
}

export function formatAnalyticsValue(
  value: string | number | null | undefined,
  unit: string | null,
): string {
  if (value === null || value === undefined) {
    return 'Unavailable';
  }

  if (typeof value !== 'number') {
    return value;
  }

  if (unit === 'NZD') {
    return currencyFormatter.format(value);
  }

  if (unit === 'percent') {
    return `${value.toFixed(1)}%`;
  }

  if (unit === 'orders' || unit === 'units' || unit === 'products' || unit === 'count') {
    return integerFormatter.format(value);
  }

  return exactNumberFormatter.format(value);
}

export function formatCompactAnalyticsValue(value: number, unit: string): string {
  if (unit === 'NZD') {
    return compactCurrencyFormatter.format(value);
  }

  if (unit === 'percent') {
    return `${exactNumberFormatter.format(value)}%`;
  }

  return compactNumberFormatter.format(value);
}

export function formatAnalyticsDateRange(dateRange: AnalyticsPlan['dateRange']): string {
  const from = parseDateOnly(dateRange.from);
  const to = parseDateOnly(dateRange.to);
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear();
  const fromLabel = formatDate(from, !sameYear);
  const toLabel = formatDate(to, true);
  return `${fromLabel} to ${toLabel}`;
}

export function formatAnalyticsExecutionTime(value: string, timezone: AnalyticsTimezone): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return executionTimeFormatters[timezone].format(parsed);
}

export function describeAnalyticsGrouping(dimensions: AnalyticsDimensionId[]): string {
  if (dimensions.length === 0) {
    return 'Overall total';
  }

  return dimensions.map(getDimensionLabel).join(' then ');
}

export function describeAnalyticsFilters(filters: AnalyticsFilter[]): string {
  if (filters.length === 0) {
    return 'No filters';
  }

  return filters.map(describeFilter).join('; ');
}

export function describeAnalyticsSort(sort: AnalyticsPlan['sort']): string {
  if (sort.length === 0) {
    return 'Default order';
  }

  return sort
    .map(({ field, direction }) => {
      const label = getAnalyticsFieldLabel(field);

      if (isDimensionField(field)) {
        if (isTemporalDimension(field)) {
          return `${label}, ${direction === 'desc' ? 'newest first' : 'earliest first'}`;
        }

        return `${label}, ${direction === 'desc' ? 'Z to A' : 'A to Z'}`;
      }

      return `${label}, ${direction === 'desc' ? 'highest first' : 'lowest first'}`;
    })
    .join('; ');
}

export function getDefaultVisibleSeries(
  series: AnalyticsExecutionResult['chart']['series'],
): AnalyticsMetricId[] {
  const units = new Set<string>();
  const visible: AnalyticsMetricId[] = [];

  for (const item of series) {
    if (units.has(item.unit) || units.size < 2) {
      units.add(item.unit);
      visible.push(item.key);
    }
  }

  return visible;
}

export function canShowMetricSeries(
  visible: AnalyticsMetricId[],
  metric: AnalyticsMetricId,
  series: AnalyticsExecutionResult['chart']['series'],
): boolean {
  if (visible.includes(metric)) {
    return true;
  }

  const target = series.find(({ key }) => key === metric);
  if (!target) {
    return false;
  }

  const visibleUnits = new Set(
    series.filter(({ key }) => visible.includes(key)).map(({ unit }) => unit),
  );
  return visibleUnits.has(target.unit) || visibleUnits.size < 2;
}

export function toggleMetricSeries(
  visible: AnalyticsMetricId[],
  metric: AnalyticsMetricId,
): AnalyticsMetricId[] {
  if (!visible.includes(metric)) {
    return [...visible, metric];
  }

  return visible.length === 1 ? visible : visible.filter((item) => item !== metric);
}

function createOption(
  type: AnalyticsChartType,
  compatible: boolean,
  reason: string | null,
): VisualizationOption {
  return {
    type,
    label: VIEW_LABELS[type],
    compatible,
    reason: compatible ? null : reason,
  };
}

function createCategoryLabel(
  dimensions: AnalyticsDimensionId[],
  row: Record<string, string | number | null>,
): string {
  if (dimensions.length === 0) {
    return 'Total';
  }

  return dimensions
    .map((dimension) => formatAnalyticsDimensionValue(row[dimension], dimension))
    .join(' / ');
}

export function formatAnalyticsDimensionValue(
  value: string | number | null | undefined,
  dimension: AnalyticsDimensionId,
): string {
  if (value === null || value === undefined || value === '') {
    return 'Unspecified';
  }

  if (typeof value === 'string' && isTemporalDimension(dimension)) {
    if (dimension === 'month' && /^\d{4}-\d{2}$/.test(value)) {
      return monthYearFormatter.format(new Date(`${value}-01T00:00:00.000Z`));
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return formatDate(parseDateOnly(value), dimension !== 'day');
    }
  }

  return humanizeValue(String(value));
}

function describeFilter(filter: AnalyticsFilter): string {
  const label = FILTER_FIELD_LABELS[filter.field] ?? humanizeIdentifier(filter.field);
  const values = (Array.isArray(filter.value) ? filter.value : [filter.value]).map((value) =>
    humanizeValue(String(value)),
  );
  const joinedValues = joinWithOr(values);

  switch (filter.operator) {
    case 'eq':
    case 'in':
      return `${label} is ${joinedValues}`;
    case 'notIn':
      return `${label} is not ${joinedValues}`;
    case 'contains':
      return `${label} contains ${joinedValues}`;
    case 'gte':
      return `${label} is at least ${joinedValues}`;
    case 'lte':
      return `${label} is at most ${joinedValues}`;
    default:
      return `${label} ${humanizeIdentifier(filter.operator)} ${joinedValues}`;
  }
}

function humanizeValue(value: string): string {
  if (/^[A-Z0-9_]+$/.test(value)) {
    return value
      .toLocaleLowerCase()
      .split('_')
      .map((part, index) => (index === 0 ? capitalize(part) : part))
      .join(' ');
  }

  return value;
}

function humanizeIdentifier(value: string): string {
  return capitalize(
    value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replaceAll('_', ' ')
      .toLowerCase(),
  );
}

function joinWithOr(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? 'Unspecified';
  }

  return `${values.slice(0, -1).join(', ')} or ${values.at(-1)}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDate(value: Date, includeYear: boolean): string {
  return (includeYear ? dayMonthYearFormatter : dayMonthFormatter).format(value);
}

function isDimensionField(
  field: AnalyticsMetricId | AnalyticsDimensionId,
): field is AnalyticsDimensionId {
  return (
    field === 'day' ||
    field === 'week' ||
    field === 'month' ||
    field === 'channel' ||
    field === 'product' ||
    field === 'category' ||
    field === 'status'
  );
}
