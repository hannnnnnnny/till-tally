import { type Prisma, type SalesChannel } from '@prisma/client';
import { prisma } from '../db/prisma';

const SALES_WINDOW_DAYS = 30;
const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const DEFAULT_SLOW_MOVER_DAYS = 60;
const DEFAULT_DEAD_STOCK_DAYS = 90;
const DEFAULT_OVERSTOCK_DAYS = 90;
const STOCKOUT_RISK_UNITS_THRESHOLD = 10;
const ALLOWED_QUERY_PARAMS = new Set([
  'businessId',
  'to',
  'lowStockThreshold',
  'slowMoverDays',
  'deadStockDays',
  'overstockDays',
]);

export type InventoryRiskQueryInput = Record<string, unknown>;

type InventoryRiskLabel =
  | 'Low Stock'
  | 'Stockout Risk'
  | 'Reorder Soon'
  | 'Slow Mover'
  | 'Dead Stock'
  | 'Discount Candidate'
  | 'Overstocked';

export type InventoryRiskQuery = {
  now: Date;
  salesWindowDays: number;
  lowStockThreshold: number;
  slowMoverDays: number;
  deadStockDays: number;
  overstockDays: number;
};

export type InventoryRiskProductSource = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  vendor: string | null;
  currentStock: number;
  lastSoldAt: Date | null;
  orderItems: InventoryRiskOrderItemSource[];
};

type InventoryRiskOrderItemSource = {
  quantity: number;
  order: {
    orderDate: Date;
    channel: SalesChannel;
  };
};

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
  summary: {
    lowStock: number;
    stockoutRisk: number;
    slowMovers: number;
    deadStock: number;
    reorderSoon: number;
    discountCandidates: number;
    overstocked: number;
  };
  reorderSoon: InventoryRiskItem[];
  lowStock: InventoryRiskItem[];
  stockoutRisk: InventoryRiskItem[];
  slowMovers: InventoryRiskItem[];
  deadStock: InventoryRiskItem[];
  discountCandidates: InventoryRiskItem[];
  overstocked: InventoryRiskItem[];
};

export class InventoryRiskQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryRiskQueryError';
  }
}

export function parseInventoryRiskQuery(
  query: InventoryRiskQueryInput = {},
  now = new Date(),
): InventoryRiskQuery {
  assertSupportedQuery(query);

  return {
    now: parseOptionalDate('to', readQueryString(query, 'to')) ?? startOfUtcDay(now),
    salesWindowDays: SALES_WINDOW_DAYS,
    lowStockThreshold: parsePositiveInteger(
      'lowStockThreshold',
      readQueryString(query, 'lowStockThreshold'),
      DEFAULT_LOW_STOCK_THRESHOLD,
    ),
    slowMoverDays: parsePositiveInteger(
      'slowMoverDays',
      readQueryString(query, 'slowMoverDays'),
      DEFAULT_SLOW_MOVER_DAYS,
    ),
    deadStockDays: parsePositiveInteger(
      'deadStockDays',
      readQueryString(query, 'deadStockDays'),
      DEFAULT_DEAD_STOCK_DAYS,
    ),
    overstockDays: parsePositiveInteger(
      'overstockDays',
      readQueryString(query, 'overstockDays'),
      DEFAULT_OVERSTOCK_DAYS,
    ),
  };
}

export function calculateInventoryInsights(
  products: InventoryRiskProductSource[],
  query: InventoryRiskQuery,
): InventoryInsights {
  const items = products.map((product) => buildInventoryRiskItem(product, query));

  const lowStock = items.filter((item) => item.labels.includes('Low Stock'));
  const stockoutRisk = items.filter((item) => item.labels.includes('Stockout Risk'));
  const reorderSoon = items.filter((item) => item.labels.includes('Reorder Soon'));
  const slowMovers = items.filter((item) => item.labels.includes('Slow Mover'));
  const deadStock = items.filter((item) => item.labels.includes('Dead Stock'));
  const discountCandidates = items.filter((item) => item.labels.includes('Discount Candidate'));
  const overstocked = items.filter((item) => item.labels.includes('Overstocked'));

  return {
    generatedAt: formatDateOnly(query.now),
    salesWindow: {
      from: formatDateOnly(getSalesWindowStart(query.now, query.salesWindowDays)),
      to: formatDateOnly(query.now),
      days: query.salesWindowDays,
    },
    summary: {
      lowStock: lowStock.length,
      stockoutRisk: stockoutRisk.length,
      slowMovers: slowMovers.length,
      deadStock: deadStock.length,
      reorderSoon: reorderSoon.length,
      discountCandidates: discountCandidates.length,
      overstocked: overstocked.length,
    },
    reorderSoon,
    lowStock,
    stockoutRisk,
    slowMovers,
    deadStock,
    discountCandidates,
    overstocked,
  };
}

export async function getInventoryInsights(
  businessId: string,
  queryInput: InventoryRiskQueryInput = {},
): Promise<InventoryInsights> {
  if (!businessId) {
    throw new Error('Business id is required');
  }

  const query = parseInventoryRiskQuery(queryInput);
  const products = await prisma.product.findMany({
    where: {
      businessId,
    },
    orderBy: {
      name: 'asc',
    },
    select: createProductSelect(query),
  });

  return calculateInventoryInsights(products, query);
}

function buildInventoryRiskItem(
  product: InventoryRiskProductSource,
  query: InventoryRiskQuery,
): InventoryRiskItem {
  const unitsSoldLast30 = product.orderItems.reduce((total, item) => total + item.quantity, 0);
  const dailySalesRate = unitsSoldLast30 / query.salesWindowDays;
  const daysOfStockLeft = dailySalesRate > 0 ? Math.ceil(product.currentStock / dailySalesRate) : null;
  const labels = createInventoryRiskLabels(product, unitsSoldLast30, daysOfStockLeft, query);

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    vendor: product.vendor,
    currentStock: product.currentStock,
    lastSoldAt: product.lastSoldAt ? formatDateOnly(product.lastSoldAt) : null,
    unitsSoldLast30,
    dailySalesRate: roundTo(dailySalesRate, 2),
    daysOfStockLeft,
    labels,
    recommendation: createRecommendation(labels),
  };
}

function createInventoryRiskLabels(
  product: InventoryRiskProductSource,
  unitsSoldLast30: number,
  daysOfStockLeft: number | null,
  query: InventoryRiskQuery,
): InventoryRiskLabel[] {
  const labels: InventoryRiskLabel[] = [];
  const daysSinceLastSale = product.lastSoldAt ? daysBetween(product.lastSoldAt, query.now) : null;
  const isDeadStock =
    product.currentStock > 0 &&
    (daysSinceLastSale === null || daysSinceLastSale >= query.deadStockDays);
  const isSlowMover =
    product.currentStock > 0 &&
    !isDeadStock &&
    daysSinceLastSale !== null &&
    daysSinceLastSale >= query.slowMoverDays;
  const isLowStock = product.currentStock <= query.lowStockThreshold;
  const isStockoutRisk = isLowStock && unitsSoldLast30 > STOCKOUT_RISK_UNITS_THRESHOLD;
  const isOverstocked =
    product.currentStock > query.lowStockThreshold &&
    daysOfStockLeft !== null &&
    daysOfStockLeft >= query.overstockDays &&
    !isSlowMover &&
    !isDeadStock;

  if (isLowStock) {
    labels.push('Low Stock');
  }

  if (isStockoutRisk) {
    labels.push('Stockout Risk', 'Reorder Soon');
  }

  if (isDeadStock) {
    labels.push('Dead Stock');
  } else if (isSlowMover) {
    labels.push('Slow Mover');
  }

  if (isOverstocked) {
    labels.push('Overstocked');
  }

  if (isSlowMover || isDeadStock) {
    labels.push('Discount Candidate');
  }

  return labels;
}

function createRecommendation(labels: InventoryRiskLabel[]): string {
  if (labels.includes('Reorder Soon')) {
    return 'Reorder soon';
  }

  if (labels.includes('Dead Stock')) {
    return 'Discount or stop reordering';
  }

  if (labels.includes('Slow Mover')) {
    return 'Review placement or discount';
  }

  if (labels.includes('Overstocked')) {
    return 'Review stock level';
  }

  if (labels.includes('Low Stock')) {
    return 'Monitor stock level';
  }

  return 'No immediate action';
}

function createProductSelect(query: InventoryRiskQuery) {
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
            gte: getSalesWindowStart(query.now, query.salesWindowDays),
            lte: query.now,
          },
        },
      },
      select: {
        quantity: true,
        order: {
          select: {
            orderDate: true,
            channel: true,
          },
        },
      },
    },
  } satisfies Prisma.ProductSelect;
}

function assertSupportedQuery(query: InventoryRiskQueryInput): void {
  for (const name of Object.keys(query)) {
    if (!ALLOWED_QUERY_PARAMS.has(name)) {
      throw new InventoryRiskQueryError(`Unsupported query parameter "${name}"`);
    }
  }
}

function readQueryString(query: InventoryRiskQueryInput, name: string): string | null {
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

  throw new InventoryRiskQueryError(`${name} must be a string`);
}

function parseOptionalDate(name: string, value: string | null): Date | null {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InventoryRiskQueryError(`${name} must use YYYY-MM-DD`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw new InventoryRiskQueryError(`${name} must be a valid date`);
  }

  return date;
}

function parsePositiveInteger(name: string, value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InventoryRiskQueryError(`${name} must be a positive integer`);
  }

  return parsed;
}

function getSalesWindowStart(to: Date, days: number): Date {
  return addUtcDays(to, -(days - 1));
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

function roundTo(value: number, decimalPlaces: number): number {
  const scale = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
