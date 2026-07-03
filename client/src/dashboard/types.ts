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

export type DashboardKpiTone = 'neutral' | 'success' | 'warning';

export type DashboardKpiCard = {
  label: string;
  value: string;
  helper: string;
  tone: DashboardKpiTone;
};
