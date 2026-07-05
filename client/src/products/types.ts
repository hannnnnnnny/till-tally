export type ProductPerformanceSort = 'revenue' | 'unitsSold' | 'grossMargin';

export type ProductSortOrder = 'asc' | 'desc';

export type ProductLabel =
  | 'Best Seller'
  | 'High Margin'
  | 'Low Stock'
  | 'Reorder Soon'
  | 'Slow Mover'
  | 'Dead Stock'
  | 'Discount Candidate';

export type ProductAbcClass = 'A' | 'B' | 'C';

export type ProductPerformanceItem = {
  id: string;
  rank: number;
  sku: string;
  name: string;
  category: string | null;
  vendor: string | null;
  unitsSold: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossMarginPct: number;
  abcClass: ProductAbcClass;
  revenueContributionPct: number;
  cumulativeRevenuePct: number;
  currentStock: number;
  lastSoldAt: string | null;
  labels: ProductLabel[];
};

export type ProductPerformanceResult = {
  data: ProductPerformanceItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ProductPerformanceQuery = {
  category: string;
  from?: string;
  order: ProductSortOrder;
  page: number;
  pageSize: number;
  search: string;
  sort: ProductPerformanceSort;
  status: string;
  to?: string;
};
