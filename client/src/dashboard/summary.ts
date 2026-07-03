import { type DashboardKpiCard, type DashboardSummary } from './types';

const currencyFormatter = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
});

const countFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const compactDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const compactDateWithYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function buildDashboardKpiCards(summary: DashboardSummary): DashboardKpiCard[] {
  const { kpis } = summary;

  return [
    {
      label: 'Total Sales',
      value: formatCurrency(kpis.totalSales),
      helper: 'Revenue in range',
      tone: 'neutral',
    },
    {
      label: 'Gross Profit',
      value: formatCurrency(kpis.grossProfit),
      helper: 'Sales minus cost',
      tone: 'success',
    },
    {
      label: 'Gross Margin',
      value: `${percentFormatter.format(kpis.grossMarginPct)}%`,
      helper: 'Profit as sales %',
      tone: 'success',
    },
    {
      label: 'Orders',
      value: countFormatter.format(kpis.orders),
      helper: 'Completed orders',
      tone: 'neutral',
    },
    {
      label: 'Average Order Value',
      value: formatCurrency(kpis.averageOrderValue),
      helper: 'Sales per order',
      tone: 'neutral',
    },
    {
      label: 'Low Stock Items',
      value: countFormatter.format(kpis.lowStockItems),
      helper: 'Needs restock',
      tone: 'warning',
    },
    {
      label: 'Slow Movers',
      value: countFormatter.format(kpis.slowMovers),
      helper: 'Inventory attention',
      tone: 'warning',
    },
  ];
}

export function formatDashboardRange(summary: DashboardSummary): string {
  const from = parseDateOnly(summary.range.from);
  const to = parseDateOnly(summary.range.to);

  return `${compactDateFormatter.format(from)} - ${compactDateWithYearFormatter.format(to)}`;
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
