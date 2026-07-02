import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateDashboardSummary,
  calculateDashboardSummaryFromMetrics,
  DashboardDateRangeError,
  parseDashboardDateRange,
} from './summaryService';

describe('dashboard summary service', () => {
  it('calculates revenue, margin, order, and inventory KPIs', () => {
    const summary = calculateDashboardSummary(
      {
        from: new Date('2026-06-01T00:00:00.000Z'),
        to: new Date('2026-06-30T00:00:00.000Z'),
      },
      [
        {
          totalAmount: '100.00',
          items: [
            {
              quantity: 2,
              totalPrice: '80.00',
              costPrice: '20.00',
            },
          ],
        },
        {
          totalAmount: '50.00',
          items: [
            {
              quantity: 1,
              totalPrice: '50.00',
              costPrice: '25.00',
            },
          ],
        },
      ],
      [
        {
          currentStock: 5,
          lastSoldAt: new Date('2026-06-20T00:00:00.000Z'),
        },
        {
          currentStock: 12,
          lastSoldAt: null,
        },
        {
          currentStock: 2,
          lastSoldAt: new Date('2026-05-01T00:00:00.000Z'),
        },
      ],
    );

    assert.deepEqual(summary, {
      range: {
        from: '2026-06-01',
        to: '2026-06-30',
      },
      kpis: {
        totalSales: 150,
        grossProfit: 65,
        grossMarginPct: 43.33,
        orders: 2,
        averageOrderValue: 75,
        unitsSold: 3,
        lowStockItems: 2,
        slowMovers: 2,
      },
    });
  });

  it('calculates KPIs from database-level summary metrics', () => {
    const summary = calculateDashboardSummaryFromMetrics(
      {
        from: new Date('2026-06-01T00:00:00.000Z'),
        to: new Date('2026-06-30T00:00:00.000Z'),
      },
      {
        totalSales: '150.00',
        orderCount: 2,
        items: [
          {
            quantity: 2,
            totalPrice: '80.00',
            costPrice: '20.00',
          },
          {
            quantity: 1,
            totalPrice: '50.00',
            costPrice: '25.00',
          },
        ],
        lowStockItems: 2,
        slowMovers: 2,
      },
    );

    assert.deepEqual(summary.kpis, {
      totalSales: 150,
      grossProfit: 65,
      grossMarginPct: 43.33,
      orders: 2,
      averageOrderValue: 75,
      unitsSold: 3,
      lowStockItems: 2,
      slowMovers: 2,
    });
  });

  it('returns zero KPIs when there are no matching orders', () => {
    const summary = calculateDashboardSummary(
      {
        from: new Date('2026-06-01T00:00:00.000Z'),
        to: new Date('2026-06-30T00:00:00.000Z'),
      },
      [],
    );

    assert.deepEqual(summary, {
      range: {
        from: '2026-06-01',
        to: '2026-06-30',
      },
      kpis: {
        totalSales: 0,
        grossProfit: 0,
        grossMarginPct: 0,
        orders: 0,
        averageOrderValue: 0,
        unitsSold: 0,
        lowStockItems: 0,
        slowMovers: 0,
      },
    });
  });

  it('defaults to the last 30 calendar days', () => {
    const range = parseDashboardDateRange({}, new Date('2026-07-02T15:30:00.000Z'));

    assert.equal(range.from.toISOString(), '2026-06-03T00:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-07-02T00:00:00.000Z');
  });

  it('rejects invalid dashboard date ranges', () => {
    assert.throws(
      () =>
        parseDashboardDateRange({
          from: '2026-07-02',
          to: '2026-06-01',
        }),
      DashboardDateRangeError,
    );
  });

  it('rejects unsupported dashboard summary query parameters', () => {
    assert.throws(
      () =>
        parseDashboardDateRange({
          interval: 'week',
        }),
      DashboardDateRangeError,
    );
  });

  it('allows businessId query context while parsing date ranges', () => {
    const range = parseDashboardDateRange({
      businessId: 'business-1',
      from: '2026-06-01',
      to: '2026-06-30',
    });

    assert.equal(range.from.toISOString(), '2026-06-01T00:00:00.000Z');
    assert.equal(range.to.toISOString(), '2026-06-30T00:00:00.000Z');
  });
});
