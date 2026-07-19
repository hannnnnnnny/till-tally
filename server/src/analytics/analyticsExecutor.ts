import {
  ANALYTICS_DIMENSION_CATALOG,
  ANALYTICS_METRIC_CATALOG,
  parseAnalyticsPlan,
  type AnalyticsFilter,
  type AnalyticsMetricId,
  type AnalyticsPlan,
} from '@till-tally/analytics-contracts';

const DEFAULT_EXECUTION_TIMEOUT_MS = 5_000;
const SALES_METRICS = new Set<AnalyticsMetricId>([
  'revenue',
  'grossProfit',
  'grossMarginPct',
  'orders',
  'averageOrderValue',
  'unitsSold',
]);
const INVENTORY_METRICS = new Set<AnalyticsMetricId>([
  'currentStock',
  'lowStockProducts',
  'stockoutRiskProducts',
  'reorderSoonProducts',
  'slowMoverProducts',
  'deadStockProducts',
  'discountCandidateProducts',
  'overstockedProducts',
]);
const ALLOWED_CHANNELS = new Set(['SHOPIFY', 'TRADE_ME', 'IN_STORE', 'SOCIAL', 'MANUAL', 'OTHER']);
const PRODUCT_STATUSES = [
  'STOCKOUT_RISK',
  'REORDER_SOON',
  'LOW_STOCK',
  'DEAD_STOCK',
  'SLOW_MOVER',
  'DISCOUNT_CANDIDATE',
  'OVERSTOCKED',
  'HEALTHY',
] as const;
const ALLOWED_PRODUCT_STATUSES = new Set<string>(PRODUCT_STATUSES);
const RISK_METRIC_STATUS: Partial<Record<AnalyticsMetricId, string>> = {
  lowStockProducts: 'LOW_STOCK',
  stockoutRiskProducts: 'STOCKOUT_RISK',
  reorderSoonProducts: 'REORDER_SOON',
  slowMoverProducts: 'SLOW_MOVER',
  deadStockProducts: 'DEAD_STOCK',
  discountCandidateProducts: 'DISCOUNT_CANDIDATE',
  overstockedProducts: 'OVERSTOCKED',
};

type NumericSource = number | string | { toString(): string };
type AnalyticsValue = string | number | null;
type AnalyticsRow = Record<string, AnalyticsValue>;

export type AnalyticsSourceProduct = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  vendor: string | null;
  currentStock: number;
  lastSoldAt: Date | null;
  recentUnitsSold: number;
};

export type AnalyticsSourceOrder = {
  id: string;
  orderDate: Date;
  channel: string;
  items: Array<{
    quantity: number;
    totalPrice: NumericSource;
    costPrice: NumericSource;
    product: Omit<AnalyticsSourceProduct, 'recentUnitsSold'> | null;
  }>;
};

export type AnalyticsSourceDataset = {
  orders: AnalyticsSourceOrder[];
  products: AnalyticsSourceProduct[];
};

export type CompiledAnalyticsQuery = {
  businessId: string;
  from: Date;
  to: Date;
  timezone: AnalyticsPlan['dateRange']['timezone'];
  filters: AnalyticsFilter[];
  needsOrders: boolean;
  needsProducts: boolean;
};

export type AnalyticsDataSource = {
  load(query: CompiledAnalyticsQuery): Promise<AnalyticsSourceDataset>;
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
  table: {
    columns: AnalyticsColumn[];
  };
  chart: {
    type: AnalyticsPlan['chart']['type'];
    categoryKey: string | null;
  };
};

export type AnalyticsExecutionResult = Omit<AnalyticsPlanPreview, 'table' | 'chart'> & {
  table: AnalyticsPlanPreview['table'] & {
    rows: AnalyticsRow[];
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

export class AnalyticsPlanSemanticError extends Error {
  constructor(
    message: string,
    readonly path: Array<string | number>,
  ) {
    super(message);
    this.name = 'AnalyticsPlanSemanticError';
  }
}

export class AnalyticsExecutionTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Analytics execution exceeded ${timeoutMs}ms`);
    this.name = 'AnalyticsExecutionTimeoutError';
  }
}

type Bucket = {
  dimensions: Record<string, string>;
  revenue: number;
  grossProfit: number;
  unitsSold: number;
  orderIds: Set<string>;
  stockByProduct: Map<string, number>;
  riskProducts: Map<string, Set<string>>;
};

export function previewAnalyticsPlan(input: unknown): AnalyticsPlanPreview {
  const plan = prepareAnalyticsPlan(input);
  const datasets = getRequiredDatasets(plan);

  return {
    plan,
    title: createPlanTitle(plan),
    datasets,
    table: {
      columns: createColumns(plan),
    },
    chart: {
      type: plan.chart.type,
      categoryKey: plan.dimensions.length === 1 ? plan.dimensions[0] : null,
    },
  };
}

export async function executeAnalyticsPlan(
  businessId: string,
  input: unknown,
  dataSource: AnalyticsDataSource,
  options: { timeoutMs?: number; now?: () => Date } = {},
): Promise<AnalyticsExecutionResult> {
  if (!businessId) {
    throw new Error('Business id is required');
  }

  const startedAt = Date.now();
  const preview = previewAnalyticsPlan(input);
  const query = compileAnalyticsQuery(businessId, preview.plan);
  const timeoutMs = options.timeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;
  const dataset = await withTimeout(dataSource.load(query), timeoutMs);
  const allRows = aggregateAnalyticsRows(preview.plan, dataset);
  const sortedRows = sortAnalyticsRows(allRows, preview.plan);
  const rows = sortedRows.slice(0, preview.plan.limit);
  const now = options.now?.() ?? new Date();

  return {
    ...preview,
    table: {
      ...preview.table,
      rows,
    },
    chart: {
      ...preview.chart,
      series: createChartSeries(preview.plan, rows),
    },
    meta: {
      rowCount: rows.length,
      totalRows: sortedRows.length,
      truncated: sortedRows.length > rows.length,
      durationMs: Math.max(0, Date.now() - startedAt),
      executedAt: now.toISOString(),
    },
  };
}

export function compileAnalyticsQuery(
  businessId: string,
  plan: AnalyticsPlan,
): CompiledAnalyticsQuery {
  const datasets = getRequiredDatasets(plan);

  return {
    businessId,
    from: parseDate(plan.dateRange.from),
    to: parseDate(plan.dateRange.to),
    timezone: plan.dateRange.timezone,
    filters: plan.filters,
    needsOrders: datasets.includes('orders'),
    needsProducts: datasets.includes('products'),
  };
}

function prepareAnalyticsPlan(input: unknown): AnalyticsPlan {
  const plan = parseAnalyticsPlan(input);

  for (const [index, filter] of plan.filters.entries()) {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];

    if (filter.field === 'channel') {
      const invalidValue = values.find(
        (value) => typeof value !== 'string' || !ALLOWED_CHANNELS.has(value),
      );
      if (invalidValue !== undefined) {
        throw new AnalyticsPlanSemanticError(
          `Unsupported channel value "${String(invalidValue)}"`,
          ['filters', index, 'value'],
        );
      }
    }

    if (filter.field === 'status') {
      const invalidValue = values.find(
        (value) => typeof value !== 'string' || !ALLOWED_PRODUCT_STATUSES.has(value),
      );
      if (invalidValue !== undefined) {
        throw new AnalyticsPlanSemanticError(`Unsupported status value "${String(invalidValue)}"`, [
          'filters',
          index,
          'value',
        ]);
      }
    }
  }

  return plan;
}

function getRequiredDatasets(plan: AnalyticsPlan): Array<'orders' | 'products'> {
  const datasets: Array<'orders' | 'products'> = [];

  if (plan.metrics.some((metric) => SALES_METRICS.has(metric))) {
    datasets.push('orders');
  }

  if (
    plan.metrics.some((metric) => INVENTORY_METRICS.has(metric)) ||
    plan.dimensions.includes('status') ||
    plan.filters.some((filter) => filter.field === 'status')
  ) {
    datasets.push('products');
  }

  return datasets;
}

function createColumns(plan: AnalyticsPlan): AnalyticsColumn[] {
  return [
    ...plan.dimensions.map((dimension) => ({
      key: dimension,
      label: ANALYTICS_DIMENSION_CATALOG[dimension].label,
      kind: 'dimension' as const,
      unit: null,
    })),
    ...plan.metrics.map((metric) => ({
      key: metric,
      label: ANALYTICS_METRIC_CATALOG[metric].label,
      kind: 'metric' as const,
      unit: ANALYTICS_METRIC_CATALOG[metric].unit,
    })),
  ];
}

function createPlanTitle(plan: AnalyticsPlan): string {
  const metrics = formatList(plan.metrics.map((metric) => ANALYTICS_METRIC_CATALOG[metric].label));
  const dimensions = formatList(
    plan.dimensions.map((dimension) => ANALYTICS_DIMENSION_CATALOG[dimension].label),
  );

  return dimensions ? `${metrics} by ${dimensions}` : metrics;
}

function formatList(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? '';
  }

  if (values.length === 2) {
    return values.join(' and ');
  }

  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function aggregateAnalyticsRows(
  plan: AnalyticsPlan,
  dataset: AnalyticsSourceDataset,
): AnalyticsRow[] {
  const buckets = new Map<string, Bucket>();
  const statusByProductId = new Map(
    dataset.products.map((product) => [
      product.id,
      classifyProduct(product, parseDate(plan.dateRange.to)),
    ]),
  );

  if (plan.metrics.some((metric) => SALES_METRICS.has(metric))) {
    addSalesBuckets(plan, dataset.orders, statusByProductId, buckets);
  }

  if (plan.metrics.some((metric) => INVENTORY_METRICS.has(metric))) {
    addInventoryBuckets(plan, dataset.products, statusByProductId, buckets);
  }

  if (buckets.size === 0 && plan.dimensions.length === 0) {
    getOrCreateBucket(buckets, {});
  }

  return Array.from(buckets.values()).map((bucket) => createRow(plan, bucket));
}

function addSalesBuckets(
  plan: AnalyticsPlan,
  orders: AnalyticsSourceOrder[],
  statusByProductId: Map<string, string[]>,
  buckets: Map<string, Bucket>,
): void {
  for (const order of orders) {
    if (!matchesChannelFilters(order.channel, plan.filters)) {
      continue;
    }

    for (const item of order.items) {
      const statuses = item.product
        ? (statusByProductId.get(item.product.id) ?? ['HEALTHY'])
        : ['HEALTHY'];

      if (!matchesProductFilters(item.product, statuses, plan.filters)) {
        continue;
      }

      const dimensions = createSalesDimensions(plan, order, item.product, statuses);
      const bucket = getOrCreateBucket(buckets, dimensions);
      bucket.revenue += toNumber(item.totalPrice);
      bucket.grossProfit += toNumber(item.totalPrice) - item.quantity * toNumber(item.costPrice);
      bucket.unitsSold += item.quantity;
      bucket.orderIds.add(order.id);
    }
  }
}

function addInventoryBuckets(
  plan: AnalyticsPlan,
  products: AnalyticsSourceProduct[],
  statusByProductId: Map<string, string[]>,
  buckets: Map<string, Bucket>,
): void {
  for (const product of products) {
    const statuses = statusByProductId.get(product.id) ?? ['HEALTHY'];
    if (!matchesProductFilters(product, statuses, plan.filters)) {
      continue;
    }

    const dimensions = createInventoryDimensions(plan, product, statuses);
    const bucket = getOrCreateBucket(buckets, dimensions);
    bucket.stockByProduct.set(product.id, product.currentStock);

    for (const status of statuses) {
      const statusProducts = bucket.riskProducts.get(status) ?? new Set<string>();
      statusProducts.add(product.id);
      bucket.riskProducts.set(status, statusProducts);
    }
  }
}

function createSalesDimensions(
  plan: AnalyticsPlan,
  order: AnalyticsSourceOrder,
  product: AnalyticsSourceOrder['items'][number]['product'],
  statuses: string[],
): Record<string, string> {
  return Object.fromEntries(
    plan.dimensions.map((dimension) => {
      switch (dimension) {
        case 'day':
          return [dimension, formatDate(order.orderDate)];
        case 'week':
          return [dimension, formatDate(startOfUtcWeek(order.orderDate))];
        case 'month':
          return [dimension, formatDate(order.orderDate).slice(0, 7)];
        case 'channel':
          return [dimension, order.channel];
        case 'product':
          return [dimension, product?.name ?? 'Unmatched product'];
        case 'category':
          return [dimension, product?.category ?? 'Uncategorised'];
        case 'status':
          return [dimension, statuses[0] ?? 'HEALTHY'];
      }
    }),
  );
}

function createInventoryDimensions(
  plan: AnalyticsPlan,
  product: AnalyticsSourceProduct,
  statuses: string[],
): Record<string, string> {
  return Object.fromEntries(
    plan.dimensions.map((dimension) => {
      switch (dimension) {
        case 'product':
          return [dimension, product.name];
        case 'category':
          return [dimension, product.category ?? 'Uncategorised'];
        case 'status':
          return [dimension, statuses[0] ?? 'HEALTHY'];
        default:
          throw new AnalyticsPlanSemanticError(`${dimension} cannot group inventory metrics`, [
            'dimensions',
          ]);
      }
    }),
  );
}

function getOrCreateBucket(
  buckets: Map<string, Bucket>,
  dimensions: Record<string, string>,
): Bucket {
  const key = JSON.stringify(dimensions);
  const existing = buckets.get(key);
  if (existing) {
    return existing;
  }

  const bucket: Bucket = {
    dimensions,
    revenue: 0,
    grossProfit: 0,
    unitsSold: 0,
    orderIds: new Set(),
    stockByProduct: new Map(),
    riskProducts: new Map(),
  };
  buckets.set(key, bucket);
  return bucket;
}

function createRow(plan: AnalyticsPlan, bucket: Bucket): AnalyticsRow {
  const row: AnalyticsRow = { ...bucket.dimensions };

  for (const metric of plan.metrics) {
    row[metric] = calculateMetric(metric, bucket);
  }

  return row;
}

function calculateMetric(metric: AnalyticsMetricId, bucket: Bucket): number {
  switch (metric) {
    case 'revenue':
      return roundTo(bucket.revenue, 2);
    case 'grossProfit':
      return roundTo(bucket.grossProfit, 2);
    case 'grossMarginPct':
      return roundTo(bucket.revenue > 0 ? (bucket.grossProfit / bucket.revenue) * 100 : 0, 2);
    case 'orders':
      return bucket.orderIds.size;
    case 'averageOrderValue':
      return roundTo(bucket.orderIds.size > 0 ? bucket.revenue / bucket.orderIds.size : 0, 2);
    case 'unitsSold':
      return bucket.unitsSold;
    case 'currentStock':
      return Array.from(bucket.stockByProduct.values()).reduce((total, stock) => total + stock, 0);
    default: {
      const status = RISK_METRIC_STATUS[metric];
      return status ? (bucket.riskProducts.get(status)?.size ?? 0) : 0;
    }
  }
}

function sortAnalyticsRows(rows: AnalyticsRow[], plan: AnalyticsPlan): AnalyticsRow[] {
  const sorts = plan.sort.length
    ? plan.sort
    : plan.dimensions.map((field) => ({ field, direction: 'asc' as const }));

  return [...rows].sort((left, right) => {
    for (const sort of sorts) {
      const comparison = compareValues(left[sort.field], right[sort.field]);
      if (comparison !== 0) {
        return sort.direction === 'asc' ? comparison : -comparison;
      }
    }

    return JSON.stringify(left).localeCompare(JSON.stringify(right));
  });
}

function compareValues(
  left: AnalyticsValue | undefined,
  right: AnalyticsValue | undefined,
): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left ?? '').localeCompare(String(right ?? ''));
}

function createChartSeries(
  plan: AnalyticsPlan,
  rows: AnalyticsRow[],
): AnalyticsExecutionResult['chart']['series'] {
  return plan.metrics.map((metric) => ({
    key: metric,
    label: ANALYTICS_METRIC_CATALOG[metric].label,
    unit: ANALYTICS_METRIC_CATALOG[metric].unit,
    data: rows.map((row) => ({
      category: createRowCategory(plan, row),
      value: typeof row[metric] === 'number' ? row[metric] : 0,
    })),
  }));
}

function createRowCategory(plan: AnalyticsPlan, row: AnalyticsRow): string {
  if (plan.dimensions.length === 0) {
    return 'Total';
  }

  return plan.dimensions.map((dimension) => String(row[dimension] ?? '')).join(' / ');
}

function matchesChannelFilters(channel: string, filters: AnalyticsFilter[]): boolean {
  return filters
    .filter((filter) => filter.field === 'channel')
    .every((filter) => matchesTextValue(channel, filter));
}

function matchesProductFilters(
  product: AnalyticsSourceOrder['items'][number]['product'] | AnalyticsSourceProduct,
  statuses: string[],
  filters: AnalyticsFilter[],
): boolean {
  return filters
    .filter((filter) => filter.field !== 'channel')
    .every((filter) => {
      if (filter.field === 'status') {
        return statuses.some((status) => matchesTextValue(status, filter));
      }

      if (!product) {
        return false;
      }

      switch (filter.field) {
        case 'productId':
          return matchesTextValue(product.id, filter);
        case 'category':
          return matchesTextValue(product.category, filter);
        case 'sku':
          return matchesTextValue(product.sku, filter);
        case 'vendor':
          return matchesTextValue(product.vendor, filter);
        case 'currentStock':
          return matchesNumberValue(product.currentStock, filter);
        default:
          return true;
      }
    });
}

function matchesTextValue(value: string | null, filter: AnalyticsFilter): boolean {
  const normalizedValue = (value ?? '').toLocaleLowerCase();
  const filterValues = (Array.isArray(filter.value) ? filter.value : [filter.value]).map((item) =>
    String(item).toLocaleLowerCase(),
  );

  switch (filter.operator) {
    case 'eq':
      return normalizedValue === filterValues[0];
    case 'in':
      return filterValues.includes(normalizedValue);
    case 'notIn':
      return !filterValues.includes(normalizedValue);
    case 'contains':
      return normalizedValue.includes(filterValues[0] ?? '');
    default:
      return false;
  }
}

function matchesNumberValue(value: number, filter: AnalyticsFilter): boolean {
  const expected = Number(filter.value);
  switch (filter.operator) {
    case 'eq':
      return value === expected;
    case 'gte':
      return value >= expected;
    case 'lte':
      return value <= expected;
    default:
      return false;
  }
}

function classifyProduct(product: AnalyticsSourceProduct, to: Date): string[] {
  const statuses: string[] = [];
  const lowStock = product.currentStock <= 5;
  const daysSinceLastSale = product.lastSoldAt ? daysBetween(product.lastSoldAt, to) : null;
  const deadStock =
    product.currentStock > 0 && (daysSinceLastSale === null || daysSinceLastSale >= 90);
  const slowMover =
    product.currentStock > 0 && !deadStock && daysSinceLastSale !== null && daysSinceLastSale >= 60;
  const stockoutRisk = lowStock && product.recentUnitsSold > 10;
  const dailySalesRate = product.recentUnitsSold / 30;
  const daysOfStock = dailySalesRate > 0 ? Math.ceil(product.currentStock / dailySalesRate) : null;
  const overstocked =
    product.currentStock > 5 &&
    daysOfStock !== null &&
    daysOfStock >= 90 &&
    !slowMover &&
    !deadStock;

  if (stockoutRisk) statuses.push('STOCKOUT_RISK', 'REORDER_SOON');
  if (lowStock) statuses.push('LOW_STOCK');
  if (deadStock) statuses.push('DEAD_STOCK', 'DISCOUNT_CANDIDATE');
  else if (slowMover) statuses.push('SLOW_MOVER', 'DISCOUNT_CANDIDATE');
  if (overstocked) statuses.push('OVERSTOCKED');

  return statuses.length ? statuses : ['HEALTHY'];
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new AnalyticsExecutionTimeoutError(timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function startOfUtcWeek(date: Date): Date {
  const result = new Date(date);
  const daysSinceMonday = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - daysSinceMonday);
  return result;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toNumber(value: NumericSource): number {
  return Number(value.toString());
}

function roundTo(value: number, decimalPlaces: number): number {
  const scale = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
