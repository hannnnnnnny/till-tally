import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateSalesTrend,
  parseSalesTrendQuery,
} from './salesTrendService';
import { DashboardDateRangeError } from './summaryService';

describe('sales trend service', () => {
  it('calculates daily trend points with zero-filled dates', () => {
    const result = calculateSalesTrend(
      {
        from: new Date('2026-06-01T00:00:00.000Z'),
        to: new Date('2026-06-03T00:00:00.000Z'),
      },
      'day',
      [
        {
          orderDate: new Date('2026-06-01T00:00:00.000Z'),
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
          orderDate: new Date('2026-06-03T00:00:00.000Z'),
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
    );

    assert.deepEqual(result, {
      interval: 'day',
      points: [
        {
          date: '2026-06-01',
          sales: 100,
          orders: 1,
          grossProfit: 40,
        },
        {
          date: '2026-06-02',
          sales: 0,
          orders: 0,
          grossProfit: 0,
        },
        {
          date: '2026-06-03',
          sales: 50,
          orders: 1,
          grossProfit: 25,
        },
      ],
    });
  });

  it('groups trend points by ISO week start date', () => {
    const result = calculateSalesTrend(
      {
        from: new Date('2026-06-01T00:00:00.000Z'),
        to: new Date('2026-06-14T00:00:00.000Z'),
      },
      'week',
      [
        {
          orderDate: new Date('2026-06-01T00:00:00.000Z'),
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
          orderDate: new Date('2026-06-08T00:00:00.000Z'),
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
    );

    assert.deepEqual(result, {
      interval: 'week',
      points: [
        {
          date: '2026-06-01',
          sales: 100,
          orders: 1,
          grossProfit: 40,
        },
        {
          date: '2026-06-08',
          sales: 50,
          orders: 1,
          grossProfit: 25,
        },
      ],
    });
  });

  it('defaults sales trend query to daily interval and the last 30 calendar days', () => {
    const query = parseSalesTrendQuery({}, new Date('2026-07-03T12:00:00.000Z'));

    assert.equal(query.interval, 'day');
    assert.equal(query.range.from.toISOString(), '2026-06-04T00:00:00.000Z');
    assert.equal(query.range.to.toISOString(), '2026-07-03T00:00:00.000Z');
  });

  it('accepts weekly interval and businessId query context', () => {
    const query = parseSalesTrendQuery({
      businessId: 'business-1',
      interval: 'week',
      from: '2026-06-01',
      to: '2026-06-30',
    });

    assert.equal(query.interval, 'week');
    assert.equal(query.range.from.toISOString(), '2026-06-01T00:00:00.000Z');
    assert.equal(query.range.to.toISOString(), '2026-06-30T00:00:00.000Z');
  });

  it('rejects invalid sales trend intervals', () => {
    assert.throws(
      () =>
        parseSalesTrendQuery({
          interval: 'month',
        }),
      DashboardDateRangeError,
    );
  });
});
