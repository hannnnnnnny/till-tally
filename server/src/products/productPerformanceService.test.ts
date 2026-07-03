import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SalesChannel } from '@prisma/client';
import {
  buildProductDetail,
  calculateProductPerformance,
  parseProductPerformanceQuery,
  ProductPerformanceQueryError,
} from './productPerformanceService';

describe('product performance service', () => {
  it('ranks products and applies performance labels', () => {
    const result = calculateProductPerformance(createProducts(), {
      page: 1,
      pageSize: 25,
      sort: 'revenue',
      order: 'desc',
      search: null,
      category: null,
      status: null,
      now: new Date('2026-07-03T00:00:00.000Z'),
    });

    assert.equal(result.meta.total, 3);
    assert.equal(result.data[0].id, 'product-1');
    assert.equal(result.data[0].rank, 1);
    assert.deepEqual(result.data[0].labels, [
      'Best Seller',
      'High Margin',
      'Low Stock',
      'Reorder Soon',
    ]);
    assert.equal(result.data[0].unitsSold, 24);
    assert.equal(result.data[0].revenue, 2157.6);
    assert.equal(result.data[0].cost, 912);
    assert.equal(result.data[0].grossProfit, 1245.6);
    assert.equal(result.data[0].grossMarginPct, 57.73);

    assert.equal(result.data[1].id, 'product-2');
    assert.deepEqual(result.data[1].labels, ['High Margin', 'Dead Stock', 'Discount Candidate']);
  });

  it('filters by status and paginates after ranking', () => {
    const result = calculateProductPerformance(createProducts(), {
      page: 1,
      pageSize: 1,
      sort: 'unitsSold',
      order: 'desc',
      search: null,
      category: null,
      status: 'High Margin',
      now: new Date('2026-07-03T00:00:00.000Z'),
    });

    assert.deepEqual(
      result.data.map((product) => product.id),
      ['product-1'],
    );
    assert.deepEqual(result.meta, {
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('parses product performance query params', () => {
    const query = parseProductPerformanceQuery(
      {
        businessId: 'business-1',
        from: '2026-06-01',
        to: '2026-06-30',
        page: '2',
        pageSize: '50',
        sort: 'unitsSold',
        order: 'asc',
        search: 'jacket',
        category: 'Fashion',
        status: 'Low Stock',
      },
      new Date('2026-07-03T00:00:00.000Z'),
    );

    assert.equal(query.page, 2);
    assert.equal(query.pageSize, 50);
    assert.equal(query.sort, 'unitsSold');
    assert.equal(query.order, 'asc');
    assert.equal(query.search, 'jacket');
    assert.equal(query.category, 'Fashion');
    assert.equal(query.status, 'Low Stock');
    assert.equal(query.range.from.toISOString(), '2026-06-01T00:00:00.000Z');
    assert.equal(query.range.to.toISOString(), '2026-06-30T00:00:00.000Z');
  });

  it('rejects unsupported product performance query params', () => {
    assert.throws(
      () =>
        parseProductPerformanceQuery({
          sort: 'unknown',
        }),
      ProductPerformanceQueryError,
    );
  });

  it('builds product detail with recent sales and stock history', () => {
    const detail = buildProductDetail(createProducts()[0], new Date('2026-07-03T00:00:00.000Z'));

    assert.equal(detail.id, 'product-1');
    assert.equal(detail.rank, 1);
    assert.equal(detail.recentSales.length, 1);
    assert.deepEqual(detail.recentSales[0], {
      orderDate: '2026-06-24',
      orderNumber: '1001',
      channel: SalesChannel.SHOPIFY,
      quantity: 24,
      revenue: 2157.6,
      grossProfit: 1245.6,
    });
    assert.deepEqual(detail.stockHistory, [
      {
        date: '2026-06-24',
        stockQuantity: 3,
      },
    ]);
  });
});

function createProducts() {
  return [
    {
      id: 'product-1',
      sku: 'WJ-001',
      name: "Women's Jacket",
      category: "Women's Fashion",
      vendor: 'Local Supplier',
      currentStock: 3,
      lastSoldAt: new Date('2026-06-24T00:00:00.000Z'),
      orderItems: [
        {
          quantity: 24,
          totalPrice: '2157.60',
          costPrice: '38.00',
          order: {
            orderDate: new Date('2026-06-24T00:00:00.000Z'),
            orderNumber: '1001',
            channel: SalesChannel.SHOPIFY,
          },
        },
      ],
      snapshots: [
        {
          snapshotDate: new Date('2026-06-24T00:00:00.000Z'),
          stockQuantity: 3,
        },
      ],
    },
    {
      id: 'product-2',
      sku: 'TM-001',
      name: 'Trade Me Bundle',
      category: 'Bundles',
      vendor: 'Warehouse',
      currentStock: 12,
      lastSoldAt: new Date('2026-03-01T00:00:00.000Z'),
      orderItems: [
        {
          quantity: 4,
          totalPrice: '600.00',
          costPrice: '60.00',
          order: {
            orderDate: new Date('2026-03-01T00:00:00.000Z'),
            orderNumber: '1002',
            channel: SalesChannel.TRADE_ME,
          },
        },
      ],
      snapshots: [],
    },
    {
      id: 'product-3',
      sku: 'MAN-001',
      name: 'Manual Item',
      category: null,
      vendor: null,
      currentStock: 0,
      lastSoldAt: null,
      orderItems: [],
      snapshots: [],
    },
  ];
}
