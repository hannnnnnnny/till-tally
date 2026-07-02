import { prisma } from '../db/prisma';

const DEFAULT_DASHBOARD_DAYS = 30;
const LOW_STOCK_THRESHOLD = 5;

type NumericValue = number | string | { toString(): string };

export type DashboardDateRangeQuery = Record<string, unknown>;

export type DashboardDateRange = {
  from: Date;
  to: Date;
};

export type DashboardOrderForSummary = {
  totalAmount: NumericValue;
  items: Array<{
    quantity: number;
    totalPrice: NumericValue;
    costPrice: NumericValue;
  }>;
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
  const orderCount = orders.length;
  let totalSales = 0;
  let grossProfit = 0;
  let unitsSold = 0;

  for (const order of orders) {
    totalSales += toNumber(order.totalAmount);

    for (const item of order.items) {
      unitsSold += item.quantity;
      grossProfit += toNumber(item.totalPrice) - item.quantity * toNumber(item.costPrice);
    }
  }

  const averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
  const grossMarginPct = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
  const lowStockItems = products.filter((product) => product.currentStock <= LOW_STOCK_THRESHOLD).length;
  const slowMovers = products.filter(
    (product) => product.currentStock > 0 && (!product.lastSoldAt || product.lastSoldAt < range.from),
  ).length;

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
      lowStockItems,
      slowMovers,
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
  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      where: {
        businessId,
        orderDate: {
          gte: range.from,
          lte: range.to,
        },
      },
      select: {
        totalAmount: true,
        items: {
          select: {
            quantity: true,
            totalPrice: true,
            costPrice: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        businessId,
      },
      select: {
        currentStock: true,
        lastSoldAt: true,
      },
    }),
  ]);

  return calculateDashboardSummary(range, orders, products);
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

  if (Array.isArray(value) && typeof value[0] === 'string') {
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
