import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWeeklyReport,
  generateWeeklyReport,
  getWeeklyReport,
  WeeklyReportQueryError,
  type WeeklyReportPrismaClient,
  type WeeklyReportOrderSource,
  type WeeklyReportProductSource,
} from './weeklyReportService';

describe('weekly report service', () => {
  it('builds weekly sales, category, inventory, and narrative metrics', () => {
    const report = buildWeeklyReport({
      businessId: 'business-1',
      weekStart: new Date('2026-06-18T10:30:00.000Z'),
      currentOrders: createCurrentOrders(),
      previousOrders: createPreviousOrders(),
      products: createProducts(),
    });

    assert.deepEqual(report, {
      businessId: 'business-1',
      weekStart: '2026-06-15',
      weekEnd: '2026-06-21',
      summary:
        "This week, total sales increased by 20% compared with last week. The best-performing category was Women's Fashion. 1 product is currently low in stock. 1 product has not sold in the last 60 days and may need discounting.",
      salesChangePercent: 20,
      topCategory: "Women's Fashion",
      lowStockCount: 1,
      slowMoverCount: 1,
    });
  });

  it('returns null sales change when the previous week has no sales', () => {
    const report = buildWeeklyReport({
      businessId: 'business-1',
      weekStart: new Date('2026-06-15T00:00:00.000Z'),
      currentOrders: createCurrentOrders(),
      previousOrders: [],
      products: [],
    });

    assert.equal(report.salesChangePercent, null);
    assert.match(report.summary, /No previous-week sales were available for comparison\./);
  });

  it('upserts one persisted report per business and week start', async () => {
    const state: {
      capturedUpsert?: Parameters<WeeklyReportPrismaClient['weeklyReport']['upsert']>[0];
    } = {};
    const db: WeeklyReportPrismaClient = {
      order: {
        findMany: async ({ where }) => {
          const from = where.orderDate.gte.toISOString().slice(0, 10);

          return from === '2026-06-15' ? createCurrentOrders() : createPreviousOrders();
        },
      },
      product: {
        findMany: async () => createProducts(),
      },
      weeklyReport: {
        upsert: async (input) => {
          state.capturedUpsert = input;

          return {
            id: 'report-1',
            ...input.create,
            createdAt: new Date('2026-06-22T00:00:00.000Z'),
          };
        },
        findFirst: async () => createPersistedReport(),
      },
    };

    const report = await generateWeeklyReport(
      'business-1',
      {
        weekStart: '2026-06-18',
      },
      db,
    );

    assert.equal(report.id, 'report-1');
    assert.equal(report.weekStart, '2026-06-15');
    assert.equal(report.weekEnd, '2026-06-21');
    assert.equal(report.salesChangePercent, 20);
    assert.equal(report.topCategory, "Women's Fashion");
    assert.equal(report.lowStockCount, 1);
    assert.equal(report.slowMoverCount, 1);
    assert.deepEqual(state.capturedUpsert?.where, {
      businessId_weekStart: {
        businessId: 'business-1',
        weekStart: new Date('2026-06-15T00:00:00.000Z'),
      },
    });
  });

  it('returns a report by normalized week start', async () => {
    const state: {
      capturedFindFirst?: Parameters<WeeklyReportPrismaClient['weeklyReport']['findFirst']>[0];
    } = {};
    const db = createReadOnlyDb({
      findFirst: async (input) => {
        state.capturedFindFirst = input;

        return createPersistedReport();
      },
    });

    const report = await getWeeklyReport(
      'business-1',
      {
        weekStart: '2026-06-18',
      },
      db,
    );

    assert.equal(report?.id, 'report-1');
    assert.deepEqual(state.capturedFindFirst?.where, {
      businessId: 'business-1',
      weekStart: new Date('2026-06-15T00:00:00.000Z'),
    });
  });

  it('returns the latest report when week start is omitted', async () => {
    let capturedFindFirst:
      | Parameters<WeeklyReportPrismaClient['weeklyReport']['findFirst']>[0]
      | null = null;
    const db = createReadOnlyDb({
      findFirst: async (input) => {
        capturedFindFirst = input;

        return createPersistedReport();
      },
    });

    await getWeeklyReport('business-1', {}, db);

    assert.deepEqual(capturedFindFirst, {
      where: {
        businessId: 'business-1',
      },
      orderBy: {
        weekStart: 'desc',
      },
    });
  });

  it('rejects invalid weekly report query params', async () => {
    const db = createReadOnlyDb({
      findFirst: async () => createPersistedReport(),
    });

    await assert.rejects(
      () =>
        getWeeklyReport(
          'business-1',
          {
            weekStart: '2026/06/18',
          },
          db,
        ),
      WeeklyReportQueryError,
    );
  });
});

function createCurrentOrders(): WeeklyReportOrderSource[] {
  return [
    {
      totalAmount: '900.00',
      items: [
        {
          totalPrice: '900.00',
          product: {
            category: "Women's Fashion",
          },
        },
      ],
    },
    {
      totalAmount: '300.00',
      items: [
        {
          totalPrice: '300.00',
          product: {
            category: 'Accessories',
          },
        },
      ],
    },
  ];
}

function createPreviousOrders(): WeeklyReportOrderSource[] {
  return [
    {
      totalAmount: '1000.00',
      items: [
        {
          totalPrice: '1000.00',
          product: {
            category: "Women's Fashion",
          },
        },
      ],
    },
  ];
}

function createProducts(): WeeklyReportProductSource[] {
  return [
    {
      currentStock: 3,
      lastSoldAt: new Date('2026-06-20T00:00:00.000Z'),
    },
    {
      currentStock: 12,
      lastSoldAt: new Date('2026-03-01T00:00:00.000Z'),
    },
  ];
}

function createReadOnlyDb(
  overrides: Pick<WeeklyReportPrismaClient['weeklyReport'], 'findFirst'>,
): WeeklyReportPrismaClient {
  return {
    order: {
      findMany: async () => [],
    },
    product: {
      findMany: async () => [],
    },
    weeklyReport: {
      upsert: async () => createPersistedReport(),
      findFirst: overrides.findFirst,
    },
  };
}

function createPersistedReport() {
  return {
    id: 'report-1',
    businessId: 'business-1',
    weekStart: new Date('2026-06-15T00:00:00.000Z'),
    weekEnd: new Date('2026-06-21T00:00:00.000Z'),
    summary: 'This week, total sales increased by 20% compared with last week.',
    salesChangePercent: '20.00',
    topCategory: "Women's Fashion",
    lowStockCount: 1,
    slowMoverCount: 1,
    createdAt: new Date('2026-06-22T00:00:00.000Z'),
  };
}
