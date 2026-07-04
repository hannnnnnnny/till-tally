import {
  type ChannelBreakdownResult,
  type ChannelChartDatum,
  type DashboardSalesChannel,
  type SalesTrendChartPoint,
  type SalesTrendResult,
} from './types';

const CHANNEL_LABELS: Record<DashboardSalesChannel, string> = {
  SHOPIFY: 'Shopify',
  TRADE_ME: 'Trade Me',
  IN_STORE: 'In store',
  SOCIAL: 'Social',
  MANUAL: 'Manual',
  OTHER: 'Other',
};

const CHANNEL_COLORS: Record<DashboardSalesChannel, string> = {
  SHOPIFY: '#2563eb',
  TRADE_ME: '#0f172a',
  IN_STORE: '#059669',
  SOCIAL: '#d97706',
  MANUAL: '#7c3aed',
  OTHER: '#64748b',
};

const compactCurrencyFormatter = new Intl.NumberFormat('en-NZ', {
  currency: 'NZD',
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
  notation: 'compact',
  style: 'currency',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function buildSalesTrendChartData(result: SalesTrendResult): SalesTrendChartPoint[] {
  return result.points.map((point) => ({
    ...point,
    label: formatShortDate(point.date),
  }));
}

export function buildChannelChartData(result: ChannelBreakdownResult): ChannelChartDatum[] {
  const totalRevenue = result.channels.reduce((sum, channel) => sum + channel.revenue, 0);

  if (totalRevenue <= 0) {
    return [];
  }

  return result.channels.map((channel) => ({
    ...channel,
    color: CHANNEL_COLORS[channel.channel],
    label: CHANNEL_LABELS[channel.channel],
    share: roundTo((channel.revenue / totalRevenue) * 100, 1),
    value: channel.revenue,
  }));
}

export function formatCompactCurrency(value: number): string {
  return compactCurrencyFormatter.format(value);
}

function formatShortDate(date: string): string {
  return shortDateFormatter.format(new Date(`${date}T00:00:00.000Z`));
}

function roundTo(value: number, decimalPlaces: number): number {
  const scale = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
