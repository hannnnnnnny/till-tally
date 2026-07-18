import { type AnalyticsExecutionResult } from './types';

type AnalyticsCsvMetadata = {
  businessName: string;
  reportName: string;
};

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function createAnalyticsCsv(
  result: AnalyticsExecutionResult,
  metadata: AnalyticsCsvMetadata,
): string {
  const lines = [
    ['# Report', metadata.reportName],
    ['# Business', metadata.businessName],
    ['# Generated at', result.meta.executedAt],
    ['# Date range', `${result.plan.dateRange.from} to ${result.plan.dateRange.to}`],
    ['# Timezone', result.plan.dateRange.timezone],
    ['# Metrics', result.plan.metrics.join(' | ')],
    ['# Dimensions', result.plan.dimensions.join(' | ') || 'None'],
    ['# Filters', result.plan.filters.length ? JSON.stringify(result.plan.filters) : 'None'],
    [
      '# Sort',
      result.plan.sort.length
        ? result.plan.sort.map(({ field, direction }) => `${field} ${direction}`).join(' | ')
        : 'None',
    ],
    ['# Displayed rows', result.table.rows.length],
    ['# Total rows', result.meta.totalRows],
    [],
    result.table.columns.map((column) => column.label),
    ...result.table.rows.map((row) => result.table.columns.map((column) => row[column.key] ?? '')),
  ];

  return `${lines.map((line) => line.map(encodeCsvCell).join(',')).join('\r\n')}\r\n`;
}

export function downloadAnalyticsCsv(
  result: AnalyticsExecutionResult,
  metadata: AnalyticsCsvMetadata,
): void {
  const blob = new Blob(['\ufeff', createAnalyticsCsv(result, metadata)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(metadata.reportName)}-${result.plan.dateRange.to}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function encodeCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'tilltally-report';
}
