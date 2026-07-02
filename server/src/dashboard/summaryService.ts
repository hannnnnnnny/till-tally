import { prisma } from '../db/prisma';

const DEFAULT_DASHBOARD_DAYS = 30;
const LOW_STOCK_THRESHOLD = 5;
const ALLOWED_DATE_RANGE_QUERY_PARAMS = new Set(['from', 'to', 'businessId']);

type NumericValue = number | string | { toString(): string };

export type DashboardDateRangeQuery = Record<string, unknown>;

export type DashboardDateRange = {
  from: Date;
  to: Date;
};

export type DashboardOrderItemForSummary = {
  quantity: number;
  totalPrice: NumericValue;
  costPrice: NumericValue;
};

export type DashboardOrderForSummary = {
  totalAmount: NumericValue;
  items: DashboardOrderItemForSummary[];
};

export type DashboardProductForSummary = {
  currentStock: number;
  lastSoldAt: Date | null;
};

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

export type DashboardSummaryMetrics = {
  totalSales: NumericValue;
  orderCount: number;
  items: DashboardOrderItemForSummary[];
  lowStockItems: number;
  slowMovers: number;
};

export class DashboardDateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardDateRangeError';
  }
}

export function parseDashboardDateRange(
  query: DashboardDateRangeQuery = {},
  now = new Date(),
): DashboardDateRange {
  assertSupportedDateRangeQuery(query);

  const rawTo = readQueryString(query, 'to');
  const to = rawTo ? parseDateOnly('to', rawTo) : startOfUtcDay(now);
  const rawFrom = readQueryString(query, 'from');
  const from = rawFrom ? parseDateOnly('from', rawFrom) : addUtcDays(to, -(DEFAULT_DASHBOARD_DAYS - 1));

  if (from > to) {
    throw new DashboardDateRangeError('from must be before or equal to to');
  }

  return {
    from,
    to,
  };
}

export function calculateDashboardSummary(
  range: DashboardDateRange,
  orders: DashboardOrderForSummary[],
  products: DashboardProductForSummary[] = [],
): DashboardSummary {
  return calculateDashboardSummaryFromMetrics(range, {
    totalSales: orders.reduce((sum, order) => sum + toNumber(order.totalAmount), 0),
    orderCount: orders.length,
    items: orders.flatMap((order) => order.items),
    lowStockItems: products.filter((product) => product.currentStock <= LOW_STOCK_THRESHOLD).length,
    slowMovers: products.filter(
      (product) => product.currentStock > 0 && (!product.lastSoldAt || product.lastSoldAt < range.from),
    ).length,
  });
}

export function calculateDashboardSummaryFromMetrics(
  range: DashboardDateRange,
  metrics: DashboardSummaryMetrics,
): DashboardSummary {
  const totalSales = toNumber(metrics.totalSales);
  const orderCount = metrics.orderCount;
  let grossProfit = 0;
  let unitsSold = 0;

  for (const item of metrics.items) {
    unitsSold += item.quantity;
    grossProfit += toNumber(item.totalPrice) - item.quantity * toNumber(item.costPrice);
  }

  const averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
  const grossMarginPct = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

  return {
    range: {
      from: formatDateOnly(range.from),
      to: formatDateOnly(range.to),
    },
    kpis: {
      totalSales: roundTo(totalSales, 2),
      grossProfit: roundTo(grossProfit, 2),
      grossMarginPct: roundTo(grossMarginPct, 2),
      orders: orderCount,
      averageOrderValue: roundTo(averageOrderValue, 2),
      unitsSold,
      lowStockItems: metrics.lowStockItems,
      slowMovers: metrics.slowMovers,
    },
  };
}

export async function getDashboardSummary(
  businessId: string,
  query: DashboardDateRangeQuery = {},
): Promise<DashboardSummary> {
  if (!businessId) {
    throw new Error('Business id is required');
  }

  const range = parseDashboardDateRange(query);
  const [orderAggregate, orderItems, lowStockItems, slowMovers] = await Promise.all([
    prisma.order.aggregate({
      where: {
        businessId,
        orderDate: {
          gte: range.from,
          lte: range.to,
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          businessId,
          orderDate: {
            gte: range.from,
            lte: range.to,
          },
        },
      },
      select: {
        quantity: true,
        totalPrice: true,
        costPrice: true,
      },
    }),
    prisma.product.count({
      where: {
        businessId,
        currentStock: {
          lte: LOW_STOCK_THRESHOLD,
        },
      },
    }),
    prisma.product.count({
      where: {
        businessId,
        currentStock: {
          gt: 0,
        },
        OR: [
          {
            lastSoldAt: null,
          },
          {
            lastSoldAt: {
              lt: range.from,
            },
          },
        ],
      },
    }),
  ]);

  return calculateDashboardSummaryFromMetrics(range, {
    totalSales: orderAggregate._sum.totalAmount ?? 0,
    orderCount: orderAggregate._count._all,
    items: orderItems,
    lowStockItems,
    slowMovers,
  });
}

function assertSupportedDateRangeQuery(query: DashboardDateRangeQuery): void {
  for (const name of Object.keys(query)) {
    if (!ALLOWED_DATE_RANGE_QUERY_PARAMS.has(name)) {
      throw new DashboardDateRangeError(`Unsupported query parameter "${name}"`);
    }
  }
}

function readQueryString(query: DashboardDateRangeQuery, name: string): string | null {
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

  throw new DashboardDateRangeError(`${name} must be a string`);
}

function parseDateOnly(name: string, value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DashboardDateRangeError(`${name} must use YYYY-MM-DD`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw new DashboardDateRangeError(`${name} must be a valid date`);
  }

  return date;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
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
