import { type InventoryInsights } from '../inventory/types';
import { type ProductPerformanceResult } from '../products/types';
import { type ChannelBreakdownResult, type DashboardSummary } from './types';

export type DashboardRangeDays = 7 | 30 | 90;

export type DashboardDateRange = {
  from: string;
  to: string;
};

export type DashboardHeadlineMetric = {
  changePct: number | null;
  emphasis: 'hero' | 'supporting';
  label: string;
  value: string;
};

export type DashboardDecisionSignal = {
  detail: string;
  label: string;
  route: '/channels' | '/inventory' | '/products';
  tone: 'neutral' | 'positive' | 'warning';
  value: string;
};

type DecisionSignalInput = {
  channels: ChannelBreakdownResult;
  inventory: InventoryInsights;
  products: ProductPerformanceResult;
  summary: DashboardSummary;
};

const currencyFormatter = new Intl.NumberFormat('en-NZ', {
  currency: 'NZD',
  style: 'currency',
});

const countFormatter = new Intl.NumberFormat('en-NZ', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-NZ', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function buildHeadlineMetrics(
  current: DashboardSummary,
  previous: DashboardSummary,
): DashboardHeadlineMetric[] {
  return [
    {
      changePct: calculatePercentChange(current.kpis.totalSales, previous.kpis.totalSales),
      emphasis: 'hero',
      label: 'Revenue',
      value: currencyFormatter.format(current.kpis.totalSales),
    },
    {
      changePct: roundToOneDecimal(current.kpis.grossMarginPct - previous.kpis.grossMarginPct),
      emphasis: 'supporting',
      label: 'Gross margin',
      value: `${percentFormatter.format(current.kpis.grossMarginPct)}%`,
    },
    {
      changePct: calculatePercentChange(current.kpis.orders, previous.kpis.orders),
      emphasis: 'supporting',
      label: 'Orders',
      value: countFormatter.format(current.kpis.orders),
    },
  ];
}

export function buildDashboardDecisionSignals({
  channels,
  inventory,
  products,
  summary,
}: DecisionSignalInput): DashboardDecisionSignal[] {
  const rankedProduct = products.data[0];
  const topProduct = rankedProduct && rankedProduct.revenue > 0 ? rankedProduct : undefined;
  const rankedChannel = [...channels.channels].sort(
    (left, right) => right.revenue - left.revenue,
  )[0];
  const leadingChannel = rankedChannel && rankedChannel.revenue > 0 ? rankedChannel : undefined;
  const totalChannelRevenue = channels.channels.reduce(
    (total, channel) => total + channel.revenue,
    0,
  );
  const lowStockCount = inventory.summary.lowStock;

  return [
    {
      detail:
        lowStockCount > 0
          ? `${inventory.summary.stockoutRisk} products are at immediate stockout risk.`
          : 'No products are currently below the low-stock threshold.',
      label: 'Restock attention',
      route: '/inventory',
      tone: lowStockCount > 0 ? 'warning' : 'positive',
      value:
        lowStockCount > 0
          ? `${countFormatter.format(lowStockCount)} low-stock items`
          : 'Stock levels healthy',
    },
    {
      detail: topProduct
        ? `${currencyFormatter.format(topProduct.revenue)} revenue · ${topProduct.unitsSold} units sold`
        : 'Import product and order data to identify a leading product.',
      label: 'Top product',
      route: '/products',
      tone: topProduct ? 'positive' : 'neutral',
      value: topProduct?.name ?? 'No product sales yet',
    },
    {
      detail: leadingChannel
        ? `${countFormatter.format(leadingChannel.orders)} orders at ${currencyFormatter.format(leadingChannel.averageOrderValue)} AOV.`
        : 'Import sales data to compare channel performance.',
      label: 'Leading channel',
      route: '/channels',
      tone: 'neutral',
      value: leadingChannel
        ? `${formatChannelLabel(leadingChannel.channel)} · ${formatRevenueShare(
            leadingChannel.revenue,
            totalChannelRevenue || summary.kpis.totalSales,
          )} of revenue`
        : 'No channel sales yet',
    },
  ];
}

export function getDashboardRangeQuery(
  days: DashboardRangeDays,
  now = new Date(),
): { current: DashboardDateRange; previous: DashboardDateRange } {
  const currentTo = startOfLocalDay(now);
  const currentFrom = addLocalDays(currentTo, -(days - 1));
  const previousTo = addLocalDays(currentFrom, -1);
  const previousFrom = addLocalDays(previousTo, -(days - 1));

  return {
    current: { from: formatDateOnly(currentFrom), to: formatDateOnly(currentTo) },
    previous: { from: formatDateOnly(previousFrom), to: formatDateOnly(previousTo) },
  };
}

function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return roundToOneDecimal(((current - previous) / Math.abs(previous)) * 100);
}

function formatChannelLabel(channel: string): string {
  return channel
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatRevenueShare(value: number, total: number): string {
  if (total <= 0) {
    return '0%';
  }

  return `${Math.round((value / total) * 100)}%`;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addLocalDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
