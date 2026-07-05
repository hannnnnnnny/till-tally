import { prisma } from '../db/prisma';

const LOW_STOCK_THRESHOLD = 5;
const SLOW_MOVER_DAYS = 60;
const ALLOWED_WEEKLY_REPORT_QUERY_PARAMS = new Set(['businessId', 'weekStart']);

type NumericValue = number | string | { toString(): string };

export type WeeklyReportOrderSource = {
  totalAmount: NumericValue;
  items: Array<{
    totalPrice: NumericValue;
    product: {
      category: string | null;
    } | null;
  }>;
};

export type WeeklyReportProductSource = {
  currentStock: number;
  lastSoldAt: Date | null;
};

export type BuildWeeklyReportInput = {
  businessId: string;
  weekStart: Date | string;
  currentOrders: WeeklyReportOrderSource[];
  previousOrders: WeeklyReportOrderSource[];
  products: WeeklyReportProductSource[];
};

export type GenerateWeeklyReportInput = {
  weekStart?: unknown;
};

export type WeeklyReportQueryInput = Record<string, unknown>;

export type WeeklyReportDraft = {
  businessId: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  salesChangePercent: number | null;
  topCategory: string | null;
  lowStockCount: number;
  slowMoverCount: number;
};

export type WeeklyReportResponse = WeeklyReportDraft & {
  id: string;
  createdAt: string;
};

type WeeklyReportOrderFindManyInput = {
  where: {
    businessId: string;
    orderDate: {
      gte: Date;
      lte: Date;
    };
  };
  select: {
    totalAmount: true;
    items: {
      select: {
        totalPrice: true;
        product: {
          select: {
            category: true;
          };
        };
      };
    };
  };
};

type WeeklyReportProductFindManyInput = {
  where: {
    businessId: string;
  };
  select: {
    currentStock: true;
    lastSoldAt: true;
  };
};

type WeeklyReportPersistenceFields = {
  weekEnd: Date;
  summary: string;
  salesChangePercent: number | null;
  topCategory: string | null;
  lowStockCount: number;
  slowMoverCount: number;
};

type WeeklyReportUpsertInput = {
  where: {
    businessId_weekStart: {
      businessId: string;
      weekStart: Date;
    };
  };
  update: WeeklyReportPersistenceFields;
  create: WeeklyReportPersistenceFields & {
    businessId: string;
    weekStart: Date;
  };
};

type WeeklyReportFindFirstInput = {
  where: {
    businessId: string;
    weekStart?: Date;
  };
  orderBy?: {
    weekStart: 'desc';
  };
};

type WeeklyReportRecordSource = Omit<WeeklyReportPersistenceFields, 'salesChangePercent'> & {
  id: string;
  businessId: string;
  weekStart: Date;
  createdAt: Date;
  salesChangePercent: NumericValue | null;
};

export type WeeklyReportPrismaClient = {
  order: {
    findMany(input: WeeklyReportOrderFindManyInput): Promise<WeeklyReportOrderSource[]>;
  };
  product: {
    findMany(input: WeeklyReportProductFindManyInput): Promise<WeeklyReportProductSource[]>;
  };
  weeklyReport: {
    upsert(input: WeeklyReportUpsertInput): Promise<WeeklyReportRecordSource>;
    findFirst(input: WeeklyReportFindFirstInput): Promise<WeeklyReportRecordSource | null>;
  };
};

export class WeeklyReportQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeeklyReportQueryError';
  }
}

export function buildWeeklyReport(input: BuildWeeklyReportInput): WeeklyReportDraft {
  if (!input.businessId) {
    throw new Error('Business id is required');
  }

  const weekStart = startOfUtcWeek(parseReportDate(input.weekStart));
  const weekEnd = addUtcDays(weekStart, 6);
  const currentSales = sumOrderSales(input.currentOrders);
  const previousSales = sumOrderSales(input.previousOrders);
  const salesChangePercent = calculateSalesChangePercent(currentSales, previousSales);
  const topCategory = findTopCategory(input.currentOrders);
  const lowStockCount = input.products.filter((product) => product.currentStock <= LOW_STOCK_THRESHOLD).length;
  const slowMoverCutoff = addUtcDays(weekEnd, -SLOW_MOVER_DAYS);
  const slowMoverCount = input.products.filter(
    (product) => product.currentStock > 0 && (!product.lastSoldAt || product.lastSoldAt < slowMoverCutoff),
  ).length;

  return {
    businessId: input.businessId,
    weekStart: formatDateOnly(weekStart),
    weekEnd: formatDateOnly(weekEnd),
    summary: buildWeeklyReportNarrative({
      currentSales,
      salesChangePercent,
      topCategory,
      lowStockCount,
      slowMoverCount,
    }),
    salesChangePercent,
    topCategory,
    lowStockCount,
    slowMoverCount,
  };
}

export async function generateWeeklyReport(
  businessId: string,
  input: GenerateWeeklyReportInput = {},
  db: WeeklyReportPrismaClient = prisma,
): Promise<WeeklyReportResponse> {
  if (!businessId) {
    throw new Error('Business id is required');
  }

  const weekStart = startOfUtcWeek(parseOptionalWeekStart(input.weekStart) ?? new Date());
  const weekEnd = addUtcDays(weekStart, 6);
  const previousWeekStart = addUtcDays(weekStart, -7);
  const previousWeekEnd = addUtcDays(weekStart, -1);
  const [currentOrders, previousOrders, products] = await Promise.all([
    db.order.findMany({
      where: {
        businessId,
        orderDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      select: createOrderSelect(),
    }),
    db.order.findMany({
      where: {
        businessId,
        orderDate: {
          gte: previousWeekStart,
          lte: previousWeekEnd,
        },
      },
      select: createOrderSelect(),
    }),
    db.product.findMany({
      where: {
        businessId,
      },
      select: {
        currentStock: true,
        lastSoldAt: true,
      },
    }),
  ]);
  const draft = buildWeeklyReport({
    businessId,
    weekStart,
    currentOrders,
    previousOrders,
    products,
  });
  const persistedReport = await db.weeklyReport.upsert({
    where: {
      businessId_weekStart: {
        businessId,
        weekStart,
      },
    },
    update: {
      weekEnd,
      summary: draft.summary,
      salesChangePercent: draft.salesChangePercent,
      topCategory: draft.topCategory,
      lowStockCount: draft.lowStockCount,
      slowMoverCount: draft.slowMoverCount,
    },
    create: {
      businessId,
      weekStart,
      weekEnd,
      summary: draft.summary,
      salesChangePercent: draft.salesChangePercent,
      topCategory: draft.topCategory,
      lowStockCount: draft.lowStockCount,
      slowMoverCount: draft.slowMoverCount,
    },
  });

  return toWeeklyReportResponse(persistedReport);
}

export async function getWeeklyReport(
  businessId: string,
  queryInput: WeeklyReportQueryInput = {},
  db: WeeklyReportPrismaClient = prisma,
): Promise<WeeklyReportResponse | null> {
  if (!businessId) {
    throw new Error('Business id is required');
  }

  const weekStart = parseWeeklyReportQuery(queryInput);
  const report = await db.weeklyReport.findFirst(
    weekStart
      ? {
          where: {
            businessId,
            weekStart,
          },
        }
      : {
          where: {
            businessId,
          },
          orderBy: {
            weekStart: 'desc',
          },
        },
  );

  return report ? toWeeklyReportResponse(report) : null;
}

function parseWeeklyReportQuery(query: WeeklyReportQueryInput): Date | null {
  for (const name of Object.keys(query)) {
    if (!ALLOWED_WEEKLY_REPORT_QUERY_PARAMS.has(name)) {
      throw new WeeklyReportQueryError(`Unsupported query parameter "${name}"`);
    }
  }

  const value = query.weekStart;

  if (value === undefined || value === null || value === '') {
    return null;
  }

  const weekStart = parseOptionalWeekStart(value);

  return weekStart ? startOfUtcWeek(weekStart) : null;
}

function createOrderSelect(): WeeklyReportOrderFindManyInput['select'] {
  return {
    totalAmount: true,
    items: {
      select: {
        totalPrice: true,
        product: {
          select: {
            category: true,
          },
        },
      },
    },
  };
}

function calculateSalesChangePercent(currentSales: number, previousSales: number): number | null {
  if (previousSales <= 0) {
    return null;
  }

  return roundTo(((currentSales - previousSales) / previousSales) * 100, 2);
}

function findTopCategory(orders: WeeklyReportOrderSource[]): string | null {
  const categoryRevenue = new Map<string, number>();

  for (const order of orders) {
    for (const item of order.items) {
      const category = item.product?.category?.trim() || 'Uncategorised';
      categoryRevenue.set(category, (categoryRevenue.get(category) ?? 0) + toNumber(item.totalPrice));
    }
  }

  return (
    Array.from(categoryRevenue.entries()).sort(
      ([firstCategory, firstRevenue], [secondCategory, secondRevenue]) =>
        secondRevenue - firstRevenue || firstCategory.localeCompare(secondCategory),
    )[0]?.[0] ?? null
  );
}

function buildWeeklyReportNarrative(input: {
  currentSales: number;
  salesChangePercent: number | null;
  topCategory: string | null;
  lowStockCount: number;
  slowMoverCount: number;
}): string {
  const salesSentence =
    input.salesChangePercent === null
      ? `This week, total sales were ${formatCurrency(input.currentSales)}. No previous-week sales were available for comparison.`
      : `This week, total sales ${formatSalesChange(input.salesChangePercent)} compared with last week.`;
  const categorySentence = input.topCategory
    ? `The best-performing category was ${input.topCategory}.`
    : 'No category generated sales this week.';
  const lowStockSentence = `${input.lowStockCount} ${pluralize('product', input.lowStockCount)} ${
    input.lowStockCount === 1 ? 'is' : 'are'
  } currently low in stock.`;
  const slowMoverSentence = `${input.slowMoverCount} ${pluralize('product', input.slowMoverCount)} ${
    input.slowMoverCount === 1 ? 'has' : 'have'
  } not sold in the last 60 days and may need discounting.`;

  return [salesSentence, categorySentence, lowStockSentence, slowMoverSentence].join(' ');
}

function formatSalesChange(salesChangePercent: number): string {
  if (salesChangePercent > 0) {
    return `increased by ${formatPercent(salesChangePercent)}`;
  }

  if (salesChangePercent < 0) {
    return `decreased by ${formatPercent(Math.abs(salesChangePercent))}`;
  }

  return 'were unchanged';
}

function toWeeklyReportResponse(report: WeeklyReportRecordSource): WeeklyReportResponse {
  return {
    id: report.id,
    businessId: report.businessId,
    weekStart: formatDateOnly(report.weekStart),
    weekEnd: formatDateOnly(report.weekEnd),
    summary: report.summary,
    salesChangePercent:
      report.salesChangePercent === null ? null : roundTo(toNumber(report.salesChangePercent), 2),
    topCategory: report.topCategory,
    lowStockCount: report.lowStockCount,
    slowMoverCount: report.slowMoverCount,
    createdAt: report.createdAt.toISOString(),
  };
}

function parseReportDate(value: Date | string): Date {
  if (value instanceof Date) {
    return startOfUtcDay(value);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new WeeklyReportQueryError('weekStart must use YYYY-MM-DD');
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw new WeeklyReportQueryError('weekStart must be a valid date');
  }

  return date;
}

function parseOptionalWeekStart(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return startOfUtcDay(value);
  }

  if (typeof value !== 'string') {
    throw new WeeklyReportQueryError('weekStart must be a string');
  }

  return parseReportDate(value);
}

function sumOrderSales(orders: WeeklyReportOrderSource[]): number {
  return orders.reduce((total, order) => total + toNumber(order.totalAmount), 0);
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

function formatCurrency(value: number): string {
  return `$${roundTo(value, 2).toLocaleString('en-NZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2)}%`;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date): Date {
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  return addUtcDays(startOfUtcDay(date), -daysSinceMonday);
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
