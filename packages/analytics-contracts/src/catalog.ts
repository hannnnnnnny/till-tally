export const ANALYTICS_METRIC_IDS = [
  'revenue',
  'grossProfit',
  'grossMarginPct',
  'orders',
  'averageOrderValue',
  'unitsSold',
  'currentStock',
  'lowStockProducts',
  'stockoutRiskProducts',
  'reorderSoonProducts',
  'slowMoverProducts',
  'deadStockProducts',
  'discountCandidateProducts',
  'overstockedProducts',
] as const;

export type AnalyticsMetricId = (typeof ANALYTICS_METRIC_IDS)[number];

export const ANALYTICS_DIMENSION_IDS = [
  'day',
  'week',
  'month',
  'channel',
  'product',
  'category',
  'status',
] as const;

export type AnalyticsDimensionId = (typeof ANALYTICS_DIMENSION_IDS)[number];

export const ANALYTICS_FILTER_FIELD_IDS = [
  'channel',
  'productId',
  'category',
  'status',
  'sku',
  'vendor',
  'currentStock',
] as const;

export type AnalyticsFilterFieldId = (typeof ANALYTICS_FILTER_FIELD_IDS)[number];

export const ANALYTICS_TIMEZONES = ['UTC', 'Pacific/Auckland'] as const;

export type AnalyticsTimezone = (typeof ANALYTICS_TIMEZONES)[number];

type AnalyticsMetricCatalogEntry = {
  label: string;
  description: string;
  source: string;
  aggregation: string;
  unit: 'NZD' | 'percent' | 'orders' | 'units' | 'products';
  nullBehavior: string;
  compatibleDimensions: readonly AnalyticsDimensionId[];
};

const salesDimensions = ANALYTICS_DIMENSION_IDS;
const inventoryDimensions = ['product', 'category', 'status'] as const;
const inventoryGroupDimensions = ['category', 'status'] as const;

export const ANALYTICS_METRIC_CATALOG = {
  revenue: {
    label: 'Revenue',
    description: 'Recognised sales revenue for imported order items in the selected period.',
    source: 'OrderItem.lineTotal',
    aggregation: 'SUM(lineTotal)',
    unit: 'NZD',
    nullBehavior: 'Missing line totals are excluded; an empty result returns 0.',
    compatibleDimensions: salesDimensions,
  },
  grossProfit: {
    label: 'Gross profit',
    description: 'Revenue less the product cost captured on each imported order item.',
    source: 'OrderItem.lineTotal - (OrderItem.unitCost * OrderItem.quantity)',
    aggregation: 'SUM(lineTotal - unitCost * quantity)',
    unit: 'NZD',
    nullBehavior: 'Rows without a usable cost are excluded from gross-profit calculations.',
    compatibleDimensions: salesDimensions,
  },
  grossMarginPct: {
    label: 'Gross margin',
    description: 'Gross profit expressed as a percentage of revenue.',
    source: 'Derived from grossProfit and revenue',
    aggregation: 'CASE WHEN SUM(revenue) = 0 THEN 0 ELSE SUM(grossProfit) / SUM(revenue) * 100 END',
    unit: 'percent',
    nullBehavior: 'Returns 0 when revenue is 0; rows without cost remain excluded.',
    compatibleDimensions: salesDimensions,
  },
  orders: {
    label: 'Orders',
    description: 'Distinct imported orders in the selected period.',
    source: 'Order.id',
    aggregation: 'COUNT(DISTINCT orderId)',
    unit: 'orders',
    nullBehavior: 'An empty result returns 0.',
    compatibleDimensions: salesDimensions,
  },
  averageOrderValue: {
    label: 'Average order value',
    description: 'Revenue divided by the distinct order count.',
    source: 'Derived from revenue and orders',
    aggregation:
      'CASE WHEN COUNT(DISTINCT orderId) = 0 THEN 0 ELSE SUM(revenue) / COUNT(DISTINCT orderId) END',
    unit: 'NZD',
    nullBehavior: 'Returns 0 when there are no orders.',
    compatibleDimensions: ['day', 'week', 'month', 'channel'],
  },
  unitsSold: {
    label: 'Units sold',
    description: 'Total item quantity sold in the selected period.',
    source: 'OrderItem.quantity',
    aggregation: 'SUM(quantity)',
    unit: 'units',
    nullBehavior: 'Missing quantities are excluded; an empty result returns 0.',
    compatibleDimensions: salesDimensions,
  },
  currentStock: {
    label: 'Current stock',
    description: 'Latest known on-hand inventory quantity for each product.',
    source: 'InventorySnapshot.quantityOnHand at the latest snapshot timestamp',
    aggregation: 'SUM(latest quantityOnHand per product)',
    unit: 'units',
    nullBehavior: 'Products without a snapshot are excluded.',
    compatibleDimensions: inventoryDimensions,
  },
  lowStockProducts: {
    label: 'Low-stock products',
    description: 'Products whose latest on-hand quantity is at or below their low-stock threshold.',
    source: 'Inventory risk classification LOW_STOCK',
    aggregation: 'COUNT(DISTINCT productId)',
    unit: 'products',
    nullBehavior: 'Products without sufficient inventory evidence are excluded.',
    compatibleDimensions: inventoryGroupDimensions,
  },
  stockoutRiskProducts: {
    label: 'Stockout-risk products',
    description: 'Products forecast to run out within the configured stockout horizon.',
    source: 'Inventory risk classification STOCKOUT_RISK',
    aggregation: 'COUNT(DISTINCT productId)',
    unit: 'products',
    nullBehavior: 'Products without sufficient sales and inventory evidence are excluded.',
    compatibleDimensions: inventoryGroupDimensions,
  },
  reorderSoonProducts: {
    label: 'Reorder-soon products',
    description: 'Products that have reached the configured reorder window.',
    source: 'Inventory risk classification REORDER_SOON',
    aggregation: 'COUNT(DISTINCT productId)',
    unit: 'products',
    nullBehavior: 'Products without sufficient inventory evidence are excluded.',
    compatibleDimensions: inventoryGroupDimensions,
  },
  slowMoverProducts: {
    label: 'Slow-moving products',
    description: 'Products selling below the configured velocity threshold.',
    source: 'Inventory risk classification SLOW_MOVER',
    aggregation: 'COUNT(DISTINCT productId)',
    unit: 'products',
    nullBehavior: 'Products without sufficient sales history are excluded.',
    compatibleDimensions: inventoryGroupDimensions,
  },
  deadStockProducts: {
    label: 'Dead-stock products',
    description: 'Products with stock on hand and no recent sales activity.',
    source: 'Inventory risk classification DEAD_STOCK',
    aggregation: 'COUNT(DISTINCT productId)',
    unit: 'products',
    nullBehavior: 'Products without sufficient sales history are excluded.',
    compatibleDimensions: inventoryGroupDimensions,
  },
  discountCandidateProducts: {
    label: 'Discount candidates',
    description: 'Products whose stock and sales velocity indicate a discount opportunity.',
    source: 'Inventory risk classification DISCOUNT_CANDIDATE',
    aggregation: 'COUNT(DISTINCT productId)',
    unit: 'products',
    nullBehavior: 'Products without sufficient evidence are excluded.',
    compatibleDimensions: inventoryGroupDimensions,
  },
  overstockedProducts: {
    label: 'Overstocked products',
    description: 'Products holding more inventory than the configured demand horizon requires.',
    source: 'Inventory risk classification OVERSTOCKED',
    aggregation: 'COUNT(DISTINCT productId)',
    unit: 'products',
    nullBehavior: 'Products without sufficient sales and inventory evidence are excluded.',
    compatibleDimensions: inventoryGroupDimensions,
  },
} as const satisfies Record<AnalyticsMetricId, AnalyticsMetricCatalogEntry>;

export const ANALYTICS_DIMENSION_CATALOG: Record<
  AnalyticsDimensionId,
  { label: string; source: string; kind: 'temporal' | 'categorical' }
> = {
  day: { label: 'Day', source: 'Order.orderedAt calendar day', kind: 'temporal' },
  week: { label: 'Week', source: 'Order.orderedAt ISO week', kind: 'temporal' },
  month: { label: 'Month', source: 'Order.orderedAt calendar month', kind: 'temporal' },
  channel: { label: 'Channel', source: 'Order.channel', kind: 'categorical' },
  product: { label: 'Product', source: 'Product.id and Product.name', kind: 'categorical' },
  category: { label: 'Category', source: 'Product.category', kind: 'categorical' },
  status: { label: 'Status', source: 'Product status or risk status', kind: 'categorical' },
};

export const ANALYTICS_FILTER_OPERATORS = ['eq', 'in', 'notIn', 'contains', 'gte', 'lte'] as const;

export type AnalyticsFilterOperator = (typeof ANALYTICS_FILTER_OPERATORS)[number];

export const ANALYTICS_FILTER_COMPATIBILITY: Record<
  AnalyticsFilterFieldId,
  readonly AnalyticsFilterOperator[]
> = {
  channel: ['eq', 'in', 'notIn'],
  productId: ['eq', 'in', 'notIn'],
  category: ['eq', 'in', 'notIn', 'contains'],
  status: ['eq', 'in', 'notIn'],
  sku: ['eq', 'in', 'notIn', 'contains'],
  vendor: ['eq', 'in', 'notIn', 'contains'],
  currentStock: ['eq', 'gte', 'lte'],
};

export const TEMPORAL_DIMENSIONS = ['day', 'week', 'month'] as const;

export const ANALYTICS_PLAN_LIMITS = {
  maxMetrics: 3,
  maxDimensions: 2,
  maxFilters: 10,
  maxSorts: 2,
  maxRows: 100,
  maxDateRangeDays: 366,
  maxFilterValues: 20,
} as const;
