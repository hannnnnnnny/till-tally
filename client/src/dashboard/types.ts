export type DashboardSummary = {
  range: {
    from: string;
    to: string;
  };
  kpis: {
    totalSales: number;
    grossProfit: number;
    grossMarginPct: number;
    orders: number;
    averageOrderValue: number;
    unitsSold: number;
    lowStockItems: number;
    slowMovers: number;
  };
};

export type SalesTrendInterval = 'day' | 'week';

export type SalesTrendPoint = {
  date: string;
  sales: number;
  orders: number;
  grossProfit: number;
};

export type SalesTrendResult = {
  interval: SalesTrendInterval;
  points: SalesTrendPoint[];
};

export type DashboardSalesChannel =
  | 'SHOPIFY'
  | 'TRADE_ME'
  | 'IN_STORE'
  | 'SOCIAL'
  | 'MANUAL'
  | 'OTHER';

export type ChannelBreakdownItem = {
  channel: DashboardSalesChannel;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  grossMarginPct: number;
  unitsSold: number;
};

export type ChannelBreakdownResult = {
  channels: ChannelBreakdownItem[];
};

export type DashboardKpiTone = 'neutral' | 'success' | 'warning';

export type DashboardKpiCard = {
  label: string;
  value: string;
  helper: string;
  tone: DashboardKpiTone;
};

export type SalesTrendChartPoint = SalesTrendPoint & {
  label: string;
};

export type ChannelChartDatum = ChannelBreakdownItem & {
  color: string;
  label: string;
  share: number;
  value: number;
};
