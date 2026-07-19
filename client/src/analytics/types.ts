export type AnalyticsMetricId =
  | 'revenue'
  | 'grossProfit'
  | 'grossMarginPct'
  | 'orders'
  | 'averageOrderValue'
  | 'unitsSold'
  | 'currentStock'
  | 'lowStockProducts'
  | 'stockoutRiskProducts'
  | 'reorderSoonProducts'
  | 'slowMoverProducts'
  | 'deadStockProducts'
  | 'discountCandidateProducts'
  | 'overstockedProducts';

export type AnalyticsDimensionId =
  | 'day'
  | 'week'
  | 'month'
  | 'channel'
  | 'product'
  | 'category'
  | 'status';

export type AnalyticsChartType = 'line' | 'bar' | 'donut' | 'table';
export type AnalyticsTimezone = 'UTC' | 'Pacific/Auckland';

export type AnalyticsFilter = {
  field: string;
  operator: string;
  value: string | number | string[];
};

export type AnalyticsPlan = {
  schemaVersion: 1;
  metrics: AnalyticsMetricId[];
  dimensions: AnalyticsDimensionId[];
  dateRange: {
    from: string;
    to: string;
    timezone: AnalyticsTimezone;
  };
  filters: AnalyticsFilter[];
  sort: Array<{
    field: AnalyticsMetricId | AnalyticsDimensionId;
    direction: 'asc' | 'desc';
  }>;
  limit: number;
  chart: { type: AnalyticsChartType };
};

export type AnalyticsPlanningResult =
  | {
      status: 'ready';
      source: 'local' | 'provider';
      message: string;
      plan: AnalyticsPlan;
    }
  | {
      status: 'clarification' | 'unsupported';
      source: 'local' | 'provider';
      message: string;
      examples: string[];
    };

export type AnalyticsColumn = {
  key: string;
  label: string;
  kind: 'dimension' | 'metric';
  unit: string | null;
};

export type AnalyticsPlanPreview = {
  plan: AnalyticsPlan;
  title: string;
  datasets: Array<'orders' | 'products'>;
  table: { columns: AnalyticsColumn[] };
  chart: { type: AnalyticsChartType; categoryKey: string | null };
};

export type AnalyticsExecutionResult = Omit<AnalyticsPlanPreview, 'table' | 'chart'> & {
  table: AnalyticsPlanPreview['table'] & {
    rows: Array<Record<string, string | number | null>>;
  };
  chart: AnalyticsPlanPreview['chart'] & {
    series: Array<{
      key: AnalyticsMetricId;
      label: string;
      unit: string;
      data: Array<{ category: string; value: number }>;
    }>;
  };
  meta: {
    rowCount: number;
    totalRows: number;
    truncated: boolean;
    durationMs: number;
    executedAt: string;
  };
};

export type AnalyticsPlannerRequest = {
  question: string;
  timezone: AnalyticsTimezone;
  currentPlan?: AnalyticsPlan;
};

export type SavedAnalyticsReport = {
  id: string;
  name: string;
  currentVersion: number;
  compatible: boolean;
  compatibilityMessage: string | null;
  latestVersion: {
    version: number;
    schemaVersion: number;
    source: 'local' | 'provider';
    plan: AnalyticsPlan | null;
    createdAt: string;
  } | null;
  versions: Array<{
    version: number;
    schemaVersion: number;
    source: 'local' | 'provider';
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};
