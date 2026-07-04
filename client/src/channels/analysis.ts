import {
  type ChannelBreakdownItem,
  type ChannelBreakdownResult,
  type DashboardSalesChannel,
} from '../dashboard/types';

export type ChannelMetricCard = {
  label: string;
  value: string;
  helper: string;
};

export type ChannelTableRow = ChannelBreakdownItem & {
  color: string;
  label: string;
  revenueShare: number;
};

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

const currencyFormatter = new Intl.NumberFormat('en-NZ', {
  currency: 'NZD',
  style: 'currency',
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

export function buildChannelMetricCards(result: ChannelBreakdownResult): ChannelMetricCard[] {
  const rows = buildChannelTableRows(result);
  const totals = calculateChannelTotals(rows);

  return [
    {
      label: 'Revenue',
      value: formatChannelCurrency(totals.revenue),
      helper: buildLeaderHelper(rows, 'revenue', formatChannelCurrency),
    },
    {
      label: 'Orders',
      value: formatChannelNumber(totals.orders),
      helper: buildLeaderHelper(rows, 'orders', (value) => `${formatChannelNumber(value)} orders`),
    },
    {
      label: 'Average Order Value',
      value: formatChannelCurrency(totals.averageOrderValue),
      helper: buildLeaderHelper(rows, 'averageOrderValue', formatChannelCurrency),
    },
    {
      label: 'Gross Margin',
      value: formatChannelPercent(totals.grossMarginPct),
      helper: buildLeaderHelper(rows, 'grossMarginPct', formatChannelPercent),
    },
    {
      label: 'Units Sold',
      value: formatChannelNumber(totals.unitsSold),
      helper: buildLeaderHelper(
        rows,
        'unitsSold',
        (value) => `${formatChannelNumber(value)} units`,
      ),
    },
  ];
}

export function buildChannelTableRows(result: ChannelBreakdownResult): ChannelTableRow[] {
  const totalRevenue = result.channels.reduce((sum, channel) => sum + channel.revenue, 0);

  return result.channels.map((channel) => ({
    ...channel,
    color: getChannelColor(channel.channel),
    label: getChannelLabel(channel.channel),
    revenueShare: totalRevenue > 0 ? roundTo((channel.revenue / totalRevenue) * 100, 1) : 0,
  }));
}

export function getChannelLabel(channel: DashboardSalesChannel): string {
  return CHANNEL_LABELS[channel];
}

export function getChannelColor(channel: DashboardSalesChannel): string {
  return CHANNEL_COLORS[channel];
}

export function formatChannelCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatChannelNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatChannelPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

function calculateChannelTotals(rows: ChannelTableRow[]) {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const orders = rows.reduce((sum, row) => sum + row.orders, 0);
  const unitsSold = rows.reduce((sum, row) => sum + row.unitsSold, 0);
  const grossMarginPct =
    revenue > 0
      ? rows.reduce((sum, row) => sum + row.revenue * row.grossMarginPct, 0) / revenue
      : 0;

  return {
    averageOrderValue: orders > 0 ? revenue / orders : 0,
    grossMarginPct,
    orders,
    revenue,
    unitsSold,
  };
}

function buildLeaderHelper(
  rows: ChannelTableRow[],
  metric: keyof Pick<
    ChannelTableRow,
    'averageOrderValue' | 'grossMarginPct' | 'orders' | 'revenue' | 'unitsSold'
  >,
  formatter: (value: number) => string,
): string {
  const leader = rows.reduce<ChannelTableRow | null>((currentLeader, row) => {
    if (!currentLeader || row[metric] > currentLeader[metric]) {
      return row;
    }

    return currentLeader;
  }, null);

  if (!leader) {
    return 'No channel data yet';
  }

  return `${leader.label} leads with ${formatter(leader[metric])}`;
}

function roundTo(value: number, decimalPlaces: number): number {
  const scale = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
