export type InventoryRiskLabel =
  | 'Low Stock'
  | 'Stockout Risk'
  | 'Reorder Soon'
  | 'Slow Mover'
  | 'Dead Stock'
  | 'Discount Candidate'
  | 'Overstocked';

export type InventoryRiskGroupKey =
  | 'reorderSoon'
  | 'lowStock'
  | 'stockoutRisk'
  | 'slowMovers'
  | 'deadStock'
  | 'discountCandidates'
  | 'overstocked';

export type InventoryRiskItem = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  vendor: string | null;
  currentStock: number;
  lastSoldAt: string | null;
  unitsSoldLast30: number;
  dailySalesRate: number;
  daysOfStockLeft: number | null;
  labels: InventoryRiskLabel[];
  recommendation: string;
};

export type InventoryInsights = {
  generatedAt: string;
  salesWindow: {
    from: string;
    to: string;
    days: number;
  };
  summary: Record<InventoryRiskGroupKey, number>;
} & Record<InventoryRiskGroupKey, InventoryRiskItem[]>;

export type InventoryInsightsQuery = {
  to?: string | null;
  lowStockThreshold?: number | null;
  slowMoverDays?: number | null;
  deadStockDays?: number | null;
  overstockDays?: number | null;
};
