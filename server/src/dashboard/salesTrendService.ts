import { prisma } from '../db/prisma';
import { DashboardDateRangeError, type DashboardDateRangeQuery } from './summaryService';

const DEFAULT_DASHBOARD_DAYS = 30;
const ALLOWED_SALES_TREND_QUERY_PARAMS = new Set(['from', 'to', 'businessId', 'interval']);

type NumericValue = number | string | { toString(): string };

export type SalesTrendInterval = 'day' | 'week';

export type SalesTrendDateRange = {
  from: Date;
  to: Date;
};

export type SalesTrendQuery = {
  range: SalesTrendDateRange;
  interval: SalesTrendInterval;
};

export type SalesTrendOrder = {
  orderDate: Date;
  totalAmount: NumericValue;
  items: Array<{
    quantity: number;
    totalPrice: NumericValue;
    costPrice: NumericValue;
  }>;
};

export type SalesTrendPoint = {
  date: string;
  sales: number;
  orders: number;
  grossProfit: number;
};

export type SalesTrendResult = {
  interval: SalesTrendInterval;
  points: SalesTrendPoint[];
};

export function parseSalesTrendQuery(
  query: DashboardDateRangeQuery = {},
  now = new Date(),
): SalesTrendQuery {
  assertSupportedSalesTrendQuery(query);

  const interval = parseSalesTrendInterval(readQueryString(query, 'interval'));
  const rawTo = readQueryString(query, 'to');
  const to = rawTo ? parseDateOnly('to', rawTo) : startOfUtcDay(now);
  const rawFrom = readQueryString(query, 'from');
  const from = rawFrom
    ? parseDateOnly('from', rawFrom)
    : addUtcDays(to, -(DEFAULT_DASHBOARD_DAYS - 1));

  if (from > to) {
    throw new DashboardDateRangeError('from must be before or equal to to');
  }

  return {
    interval,
    range: {
      from,
      to,
    },
  };
}

export function calculateSalesTrend(
  range: SalesTrendDateRange,
  interval: SalesTrendInterval,
  orders: SalesTrendOrder[],
): SalesTrendResult {
  const buckets = createEmptyBuckets(range, interval);

  for (const order of orders) {
    const bucketDate = getBucketDate(order.orderDate, interval);
    const bucketKey = formatDateOnly(bucketDate);
    const point = buckets.get(bucketKey);

    if (!point) {
      continue;
    }

    point.sales += toNumber(order.totalAmount);
    point.orders += 1;

    for (const item of order.items) {
      point.grossProfit += toNumber(item.totalPrice) - item.quantity * toNumber(item.costPrice);
    }
  }

  return {
    interval,
    points: Array.from(buckets.values()).map((point) => ({
      ...point,
      sales: roundTo(point.sales, 2),
      grossProfit: roundTo(point.grossProfit, 2),
    })),
  };
}

export async function getDashboardSalesTrend(
  businessId: string,
  query: DashboardDateRangeQuery = {},
): Promise<SalesTrendResult> {
  if (!businessId) {
    throw new Error('Business id is required');
  }

  const { range, interval } = parseSalesTrendQuery(query);
  const orders = await prisma.order.findMany({
    where: {
      businessId,
      orderDate: {
        gte: range.from,
        lte: range.to,
      },
    },
    select: {
      orderDate: true,
      totalAmount: true,
      items: {
        select: {
          quantity: true,
          totalPrice: true,
          costPrice: true,
        },
      },
    },
    orderBy: {
      orderDate: 'asc',
    },
  });

  return calculateSalesTrend(range, interval, orders);
}

function assertSupportedSalesTrendQuery(query: DashboardDateRangeQuery): void {
  for (const name of Object.keys(query)) {
    if (!ALLOWED_SALES_TREND_QUERY_PARAMS.has(name)) {
      throw new DashboardDateRangeError(`Unsupported query parameter "${name}"`);
    }
  }
}

function parseSalesTrendInterval(value: string | null): SalesTrendInterval {
  if (!value) {
    return 'day';
  }

  if (value === 'day' || value === 'week') {
    return value;
  }

  throw new DashboardDateRangeError('interval must be day or week');
}

function createEmptyBuckets(
  range: SalesTrendDateRange,
  interval: SalesTrendInterval,
): Map<string, SalesTrendPoint> {
  const buckets = new Map<string, SalesTrendPoint>();
  let current = getBucketDate(range.from, interval);

  while (current <= range.to) {
    const date = formatDateOnly(current);

    buckets.set(date, {
      date,
      sales: 0,
      orders: 0,
      grossProfit: 0,
    });

    current = addUtcDays(current, interval === 'day' ? 1 : 7);
  }

  return buckets;
}

function getBucketDate(date: Date, interval: SalesTrendInterval): Date {
  const startOfDay = startOfUtcDay(date);

  if (interval === 'day') {
    return startOfDay;
  }

  return startOfUtcWeek(startOfDay);
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

function startOfUtcWeek(date: Date): Date {
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  return addUtcDays(date, -daysSinceMonday);
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
