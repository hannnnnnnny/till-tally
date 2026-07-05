import { type WeeklyReport } from './types';

export type WeeklyReportTone = 'neutral' | 'success' | 'warning';

export type WeeklyReportMetricCard = {
  label: string;
  value: string;
  helper: string;
  tone: WeeklyReportTone;
};

export type WeeklyReportInsight = {
  title: string;
  description: string;
  tone: WeeklyReportTone;
};

const compactDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const compactDateWithYearFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});

const countFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function buildWeeklyReportMetricCards(report: WeeklyReport): WeeklyReportMetricCard[] {
  return [
    {
      helper:
        report.salesChangePercent === null
          ? 'No previous week comparison'
          : 'Compared with previous week',
      label: 'Sales Change',
      tone: getSalesChangeTone(report.salesChangePercent),
      value: formatSalesChange(report.salesChangePercent),
    },
    {
      helper: report.topCategory ? 'Highest revenue category' : 'No category sales this week',
      label: 'Top Category',
      tone: report.topCategory ? 'success' : 'neutral',
      value: report.topCategory ?? 'No sales yet',
    },
    {
      helper: report.lowStockCount > 0 ? 'Needs replenishment' : 'Stock levels stable',
      label: 'Low Stock',
      tone: report.lowStockCount > 0 ? 'warning' : 'success',
      value: countFormatter.format(report.lowStockCount),
    },
    {
      helper: report.slowMoverCount > 0 ? 'Consider markdowns' : 'No stale stock flagged',
      label: 'Slow Movers',
      tone: report.slowMoverCount > 0 ? 'warning' : 'success',
      value: countFormatter.format(report.slowMoverCount),
    },
  ];
}

export function buildWeeklyReportWarnings(report: WeeklyReport): WeeklyReportInsight[] {
  const warnings: WeeklyReportInsight[] = [];

  if (report.salesChangePercent !== null && report.salesChangePercent < 0) {
    warnings.push({
      description: 'Review channel mix, stock availability, and recent campaigns before next week.',
      title: `Sales decreased by ${formatPercent(Math.abs(report.salesChangePercent))}`,
      tone: 'warning',
    });
  }

  if (report.lowStockCount > 0) {
    warnings.push({
      description: 'Prioritise products that are still selling and are close to stocking out.',
      title: `${countFormatter.format(report.lowStockCount)} ${pluralize(
        'product',
        report.lowStockCount,
      )} ${report.lowStockCount === 1 ? 'is' : 'are'} low in stock`,
      tone: 'warning',
    });
  }

  if (report.slowMoverCount > 0) {
    warnings.push({
      description:
        'Use discounts, bundles, or merchandising changes to release cash from slow stock.',
      title: `${countFormatter.format(report.slowMoverCount)} ${pluralize(
        'product',
        report.slowMoverCount,
      )} ${report.slowMoverCount === 1 ? 'is a slow mover' : 'are slow movers'}`,
      tone: 'warning',
    });
  }

  return warnings;
}

export function buildWeeklyReportSuggestedActions(report: WeeklyReport): WeeklyReportInsight[] {
  const actions: WeeklyReportInsight[] = [];

  if (report.salesChangePercent !== null && report.salesChangePercent < 0) {
    actions.push({
      description:
        'Compare the losing channels and products against the previous week before changing spend.',
      title: 'Investigate the sales drop',
      tone: 'warning',
    });
  }

  if (report.lowStockCount > 0) {
    actions.push({
      description:
        'Check supplier lead times and reorder items that also appear in top-product rankings.',
      title: 'Restock low inventory',
      tone: 'warning',
    });
  }

  if (report.slowMoverCount > 0) {
    actions.push({
      description: 'Create a markdown or bundle plan for products that have not moved in 60 days.',
      title: 'Review slow movers',
      tone: 'warning',
    });
  }

  if (report.topCategory) {
    actions.push({
      description:
        'Feature the winning category in merchandising, ads, and replenishment decisions.',
      title: `Lean into ${report.topCategory}`,
      tone: 'success',
    });
  }

  if (actions.length === 0) {
    actions.push({
      description: 'No urgent inventory or sales risks were detected for this week.',
      title: 'Keep monitoring the weekly trend',
      tone: 'success',
    });
  }

  return actions;
}

export function formatWeeklyReportRange(report: WeeklyReport): string {
  const weekStart = parseDateOnly(report.weekStart);
  const weekEnd = parseDateOnly(report.weekEnd);

  return `${compactDateFormatter.format(weekStart)} - ${compactDateWithYearFormatter.format(weekEnd)}`;
}

export function formatWeeklyReportGeneratedAt(value: string): string {
  const generatedAt = new Date(value);

  if (Number.isNaN(generatedAt.getTime())) {
    return 'Generated recently';
  }

  return `Generated ${compactDateWithYearFormatter.format(generatedAt)}`;
}

export function getWeeklyReportToneClass(tone: WeeklyReportTone): string {
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function getSalesChangeTone(value: number | null): WeeklyReportTone {
  if (value === null || value === 0) {
    return 'neutral';
  }

  return value > 0 ? 'success' : 'warning';
}

function formatSalesChange(value: number | null): string {
  if (value === null) {
    return 'No comparison';
  }

  if (value > 0) {
    return `+${formatPercent(value)}`;
  }

  if (value < 0) {
    return `-${formatPercent(Math.abs(value))}`;
  }

  return '0.0%';
}

function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}
