import { type Prisma, type SalesChannel } from '@prisma/client';
import { prisma } from '../db/prisma';

const DEFAULT_DAYS = 30;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const HIGH_MARGIN_THRESHOLD = 50;
const LOW_STOCK_THRESHOLD = 5;
const REORDER_SOON_UNITS_THRESHOLD = 10;
const SLOW_MOVER_DAYS = 60;
const DEAD_STOCK_DAYS = 90;
const ABC_A_CUMULATIVE_REVENUE_THRESHOLD = 80;
const ABC_B_CUMULATIVE_REVENUE_THRESHOLD = 95;
const ALLOWED_QUERY_PARAMS = new Set([
  'businessId',
  'from',
  'to',
  'page',
  'pageSize',
  'sort',
  'order',
  'search',
  'category',
  'status',
]);

type NumericValue = number | string | { toString(): string };
type ProductSort = 'revenue' | 'unitsSold' | 'grossMargin';
type SortOrder = 'asc' | 'desc';
type AbcClass = 'A' | 'B' | 'C';
type ProductLabel =
  | 'Best Seller'
  | 'High Margin'
  | 'Low Stock'
  | 'Reorder Soon'
  | 'Slow Mover'
  | 'Dead Stock'
  | 'Discount Candidate';

export type ProductPerformanceQueryInput = Record<string, unknown>;

export type ProductPerformanceQuery = {
  range: {
    from: Date;
    to: Date;
  };
  page: number;
  pageSize: number;
  sort: ProductSort;
  order: SortOrder;
  search: string | null;
  category: string | null;
  status: string | null;
  now: Date;
};

export type ProductPerformanceSource = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  vendor: string | null;
  currentStock: number;
  lastSoldAt: Date | null;
  orderItems: ProductOrderItemSource[];
  snapshots?: ProductInventorySnapshotSource[];
};

type ProductOrderItemSource = {
  quantity: number;
  totalPrice: NumericValue;
  costPrice: NumericValue;
  order: {
    orderDate: Date;
    orderNumber: string;
    channel: SalesChannel;
  };
};

type ProductInventorySnapshotSource = {
  snapshotDate: Date;
  stockQuantity: number;
};

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
  abcClass: AbcClass;
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

export type ProductRecentSale = {
  orderDate: string;
  orderNumber: string;
  channel: SalesChannel;
  quantity: number;
  revenue: number;
  grossProfit: number;
};

export type ProductStockHistoryPoint = {
  date: string;
  stockQuantity: number;
};

export type ProductDetail = ProductPerformanceItem & {
  recentSales: ProductRecentSale[];
  stockHistory: ProductStockHistoryPoint[];
};

type ProductMetrics = ProductPerformanceItem & {
  recentSales: ProductRecentSale[];
  stockHistory: ProductStockHistoryPoint[];
};

export class ProductPerformanceQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductPerformanceQueryError';
  }
}

export function parseProductPerformanceQuery(
  query: ProductPerformanceQueryInput = {},
  now = new Date(),
): ProductPerformanceQuery {
  assertSupportedQuery(query);

  const to = parseOptionalDate('to', readQueryString(query, 'to')) ?? startOfUtcDay(now);
  const from = parseOptionalDate('from', readQueryString(query, 'from')) ?? addUtcDays(to, -(DEFAULT_DAYS - 1));

  if (from > to) {
    throw new ProductPerformanceQueryError('from must be before or equal to to');
  }

  return {
    range: {
      from,
      to,
    },
    page: parsePositiveInteger(readQueryString(query, 'page'), DEFAULT_PAGE),
    pageSize: Math.min(parsePositiveInteger(readQueryString(query, 'pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    sort: parseSort(readQueryString(query, 'sort')),
    order: parseOrder(readQueryString(query, 'order')),
    search: readQueryString(query, 'search'),
    category: readQueryString(query, 'category'),
    status: readQueryString(query, 'status'),
    now,
  };
}

export function calculateProductPerformance(
  products: ProductPerformanceSource[],
  query: Pick<
    ProductPerformanceQuery,
    'page' | 'pageSize' | 'sort' | 'order' | 'search' | 'category' | 'status' | 'now'
  >,
): ProductPerformanceResult {
  const rankedProducts = rankProducts(products, query.now);
  const filteredProducts = rankedProducts.filter((product) => matchesProductFilters(product, query));
  const sortedProducts = sortProducts(filteredProducts, query.sort, query.order);
  const start = (query.page - 1) * query.pageSize;
  const paginatedProducts = sortedProducts.slice(start, start + query.pageSize);

  return {
    data: paginatedProducts.map(toPerformanceItem),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: filteredProducts.length,
      totalPages: Math.ceil(filteredProducts.length / query.pageSize),
    },
  };
}

export function buildProductDetail(
  product: ProductPerformanceSource,
  now = new Date(),
  products: ProductPerformanceSource[] = [product],
): ProductDetail {
  const rankedProduct =
    rankProducts(products, now).find((candidate) => candidate.id === product.id) ?? rankProducts([product], now)[0];

  return {
    ...toPerformanceItem(rankedProduct),
    recentSales: rankedProduct.recentSales,
    stockHistory: rankedProduct.stockHistory,
  };
}

export async function listProductPerformance(
  businessId: string,
  queryInput: ProductPerformanceQueryInput = {},
): Promise<ProductPerformanceResult> {
  if (!businessId) {
    throw new Error('Business id is required');
  }

  const query = parseProductPerformanceQuery(queryInput);
  const products = await prisma.product.findMany({
    where: createProductWhereInput(businessId, query),
    select: createProductSelect(query),
  });

  return calculateProductPerformance(products, query);
}

export async function getProductDetail(
  businessId: string,
  productId: string,
  queryInput: ProductPerformanceQueryInput = {},
): Promise<ProductDetail | null> {
  if (!businessId) {
    throw new Error('Business id is required');
  }

  const query = parseProductPerformanceQuery(queryInput);
  const products = await prisma.product.findMany({
    where: {
      businessId,
    },
    select: createProductSelect(query, true),
  });
  const product = products.find((candidate) => candidate.id === productId);

  if (!product) {
    return null;
  }

  return buildProductDetail(product, query.now, products);
}

function rankProducts(products: ProductPerformanceSource[], now: Date): ProductMetrics[] {
  const metrics = products.map((product) => toProductMetrics(product, now));
  const totalRevenue = metrics.reduce((total, product) => total + product.revenue, 0);
  const bestSellerIds = new Set(
    [...metrics]
      .filter((product) => product.unitsSold > 0)
      .sort((first, second) => second.unitsSold - first.unitsSold)
      .slice(0, Math.ceil(metrics.length * 0.1))
      .map((product) => product.id),
  );

  let cumulativeRevenuePct = 0;

  return metrics
    .sort((first, second) => second.revenue - first.revenue || first.name.localeCompare(second.name))
    .map((product, index) => {
      const { rawCumulativeRevenuePct, ...abcMetrics } = calculateAbcMetrics(
        product.revenue,
        totalRevenue,
        cumulativeRevenuePct,
        index,
      );
      cumulativeRevenuePct = rawCumulativeRevenuePct;

      return {
        ...product,
        rank: index + 1,
        ...abcMetrics,
        labels: withBestSellerLabel(product.labels, bestSellerIds.has(product.id)),
      };
    });
}

function toProductMetrics(product: ProductPerformanceSource, now: Date): ProductMetrics {
  let unitsSold = 0;
  let revenue = 0;
  let cost = 0;

  const recentSales = product.orderItems.map((item) => {
    const itemRevenue = toNumber(item.totalPrice);
    const itemCost = item.quantity * toNumber(item.costPrice);
    const grossProfit = itemRevenue - itemCost;

    unitsSold += item.quantity;
    revenue += itemRevenue;
    cost += itemCost;

    return {
      orderDate: formatDateOnly(item.order.orderDate),
      orderNumber: item.order.orderNumber,
      channel: item.order.channel,
      quantity: item.quantity,
      revenue: roundTo(itemRevenue, 2),
      grossProfit: roundTo(grossProfit, 2),
    };
  });

  const grossProfit = revenue - cost;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const baseLabels = createProductLabels(product.currentStock, product.lastSoldAt, unitsSold, grossMarginPct, now);

  return {
    id: product.id,
    rank: 0,
    sku: product.sku,
    name: product.name,
    category: product.category,
    vendor: product.vendor,
    unitsSold,
    revenue: roundTo(revenue, 2),
    cost: roundTo(cost, 2),
    grossProfit: roundTo(grossProfit, 2),
    grossMarginPct: roundTo(grossMarginPct, 2),
    abcClass: 'C',
    revenueContributionPct: 0,
    cumulativeRevenuePct: 0,
    currentStock: product.currentStock,
    lastSoldAt: product.lastSoldAt ? formatDateOnly(product.lastSoldAt) : null,
    labels: baseLabels,
    recentSales: recentSales
      .sort((first, second) => second.orderDate.localeCompare(first.orderDate))
      .slice(0, 10),
    stockHistory: (product.snapshots ?? [])
      .map((snapshot) => ({
        date: formatDateOnly(snapshot.snapshotDate),
        stockQuantity: snapshot.stockQuantity,
      }))
      .sort((first, second) => second.date.localeCompare(first.date))
      .slice(0, 30),
  };
}

function calculateAbcMetrics(
  revenue: number,
  totalRevenue: number,
  previousCumulativeRevenuePct: number,
  index: number,
): Pick<ProductPerformanceItem, 'abcClass' | 'revenueContributionPct' | 'cumulativeRevenuePct'> & {
  rawCumulativeRevenuePct: number;
} {
  if (totalRevenue <= 0) {
    return {
      abcClass: 'C',
      revenueContributionPct: 0,
      cumulativeRevenuePct: 0,
      rawCumulativeRevenuePct: 0,
    };
  }

  const revenueContributionPct = (revenue / totalRevenue) * 100;
  const cumulativeRevenuePct = previousCumulativeRevenuePct + revenueContributionPct;

  return {
    abcClass: classifyAbcProduct(cumulativeRevenuePct, index),
    revenueContributionPct: roundTo(revenueContributionPct, 2),
    cumulativeRevenuePct: roundTo(cumulativeRevenuePct, 2),
    rawCumulativeRevenuePct: cumulativeRevenuePct,
  };
}

function classifyAbcProduct(cumulativeRevenuePct: number, index: number): AbcClass {
  if (index === 0 || cumulativeRevenuePct <= ABC_A_CUMULATIVE_REVENUE_THRESHOLD) {
    return 'A';
  }

  if (cumulativeRevenuePct <= ABC_B_CUMULATIVE_REVENUE_THRESHOLD) {
    return 'B';
  }

  return 'C';
}

function createProductLabels(
  currentStock: number,
  lastSoldAt: Date | null,
  unitsSold: number,
  grossMarginPct: number,
  now: Date,
): ProductLabel[] {
  const labels: ProductLabel[] = [];
  const hasHighMargin = grossMarginPct >= HIGH_MARGIN_THRESHOLD && unitsSold > 0;
  const daysSinceLastSale = lastSoldAt ? daysBetween(lastSoldAt, now) : null;
  const isDeadStock = currentStock > 0 && (daysSinceLastSale === null || daysSinceLastSale >= DEAD_STOCK_DAYS);
  const isSlowMover =
    currentStock > 0 &&
    !isDeadStock &&
    daysSinceLastSale !== null &&
    daysSinceLastSale >= SLOW_MOVER_DAYS;

  if (hasHighMargin) {
    labels.push('High Margin');
  }

  if (currentStock <= LOW_STOCK_THRESHOLD) {
    labels.push('Low Stock');
  }

  if (currentStock <= LOW_STOCK_THRESHOLD && unitsSold >= REORDER_SOON_UNITS_THRESHOLD) {
    labels.push('Reorder Soon');
  }

  if (isDeadStock) {
    labels.push('Dead Stock');
  } else if (isSlowMover) {
    labels.push('Slow Mover');
  }

  if ((isDeadStock || isSlowMover) && hasHighMargin) {
    labels.push('Discount Candidate');
  }

  return labels;
}

function withBestSellerLabel(labels: ProductLabel[], isBestSeller: boolean): ProductLabel[] {
  return isBestSeller ? ['Best Seller', ...labels] : labels;
}

function matchesProductFilters(
  product: ProductPerformanceItem,
  query: Pick<ProductPerformanceQuery, 'search' | 'category' | 'status'>,
): boolean {
  const search = query.search?.toLowerCase();

  if (
    search &&
    ![product.sku, product.name, product.category, product.vendor]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(search))
  ) {
    return false;
  }

  if (query.category && product.category?.toLowerCase() !== query.category.toLowerCase()) {
    return false;
  }

  if (query.status && !product.labels.some((label) => label.toLowerCase() === query.status?.toLowerCase())) {
    return false;
  }

  return true;
}

function sortProducts(
  products: ProductMetrics[],
  sort: ProductSort,
  order: SortOrder,
): ProductMetrics[] {
  const sortedProducts = [...products].sort((first, second) => {
    const firstValue = getSortValue(first, sort);
    const secondValue = getSortValue(second, sort);
    const comparison = firstValue === secondValue ? first.name.localeCompare(second.name) : firstValue - secondValue;

    return order === 'asc' ? comparison : -comparison;
  });

  return sortedProducts;
}

function getSortValue(product: ProductMetrics, sort: ProductSort): number {
  if (sort === 'unitsSold') {
    return product.unitsSold;
  }

  if (sort === 'grossMargin') {
    return product.grossMarginPct;
  }

  return product.revenue;
}

function toPerformanceItem(product: ProductMetrics): ProductPerformanceItem {
  return {
    id: product.id,
    rank: product.rank,
    sku: product.sku,
    name: product.name,
    category: product.category,
    vendor: product.vendor,
    unitsSold: product.unitsSold,
    revenue: product.revenue,
    cost: product.cost,
    grossProfit: product.grossProfit,
    grossMarginPct: product.grossMarginPct,
    abcClass: product.abcClass,
    revenueContributionPct: product.revenueContributionPct,
    cumulativeRevenuePct: product.cumulativeRevenuePct,
    currentStock: product.currentStock,
    lastSoldAt: product.lastSoldAt,
    labels: product.labels,
  };
}

function createProductWhereInput(
  businessId: string,
  query: Pick<ProductPerformanceQuery, 'search' | 'category'>,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    businessId,
  };

  if (query.search) {
    where.OR = [
      { sku: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } },
      { category: { contains: query.search, mode: 'insensitive' } },
      { vendor: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.category) {
    where.category = {
      equals: query.category,
      mode: 'insensitive',
    };
  }

  return where;
}

function createProductSelect(query: ProductPerformanceQuery, includeSnapshots = false) {
  return {
    id: true,
    sku: true,
    name: true,
    category: true,
    vendor: true,
    currentStock: true,
    lastSoldAt: true,
    orderItems: {
      where: {
        order: {
          orderDate: {
            gte: query.range.from,
            lte: query.range.to,
          },
        },
      },
      select: {
        quantity: true,
        totalPrice: true,
        costPrice: true,
        order: {
          select: {
            orderDate: true,
            orderNumber: true,
            channel: true,
          },
        },
      },
    },
    snapshots: includeSnapshots
      ? {
          orderBy: {
            snapshotDate: 'desc' as const,
          },
          take: 30,
          select: {
            snapshotDate: true,
            stockQuantity: true,
          },
        }
      : false,
  };
}

function assertSupportedQuery(query: ProductPerformanceQueryInput): void {
  for (const name of Object.keys(query)) {
    if (!ALLOWED_QUERY_PARAMS.has(name)) {
      throw new ProductPerformanceQueryError(`Unsupported query parameter "${name}"`);
    }
  }
}

function parseOptionalDate(name: string, value: string | null): Date | null {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ProductPerformanceQueryError(`${name} must use YYYY-MM-DD`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw new ProductPerformanceQueryError(`${name} must be a valid date`);
  }

  return date;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ProductPerformanceQueryError('page and pageSize must be positive integers');
  }

  return parsed;
}

function parseSort(value: string | null): ProductSort {
  if (!value) {
    return 'revenue';
  }

  if (value === 'revenue' || value === 'unitsSold' || value === 'grossMargin') {
    return value;
  }

  throw new ProductPerformanceQueryError('sort must be revenue, unitsSold, or grossMargin');
}

function parseOrder(value: string | null): SortOrder {
  if (!value) {
    return 'desc';
  }

  if (value === 'asc' || value === 'desc') {
    return value;
  }

  throw new ProductPerformanceQueryError('order must be asc or desc');
}

function readQueryString(query: ProductPerformanceQueryInput, name: string): string | null {
  const value = query[name];

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') {
    const trimmed = value[0].trim();
    return trimmed || null;
  }

  throw new ProductPerformanceQueryError(`${name} must be a string`);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / 86_400_000);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toNumber(value: NumericValue): number {
  return Number(value.toString());
}

function roundTo(value: number, decimalPlaces: number): number {
  const scale = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
