import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDashboardDecisionSignals,
  buildHeadlineMetrics,
  getDashboardRangeQuery,
} from './decisionModel';
import { type ChannelBreakdownResult, type DashboardSummary } from './types';
import { type InventoryInsights } from '../inventory/types';
import { type ProductPerformanceResult } from '../products/types';

describe('dashboard decision model', () => {
  it('builds prioritized headline metrics with previous-period changes', () => {
    const metrics = buildHeadlineMetrics(createSummary(), createPreviousSummary());

    assert.deepEqual(
      metrics.map((metric) => [metric.label, metric.value, metric.changePct, metric.emphasis]),
      [
        ['Revenue', '$12,450.50', 24.5, 'hero'],
        ['Gross margin', '42.0%', 2, 'supporting'],
        ['Orders', '318', 6, 'supporting'],
      ],
    );
  });

  it('builds action-oriented inventory, product, and channel signals', () => {
    const signals = buildDashboardDecisionSignals({
      channels: createChannels(),
      inventory: createInventory(),
      products: createProducts(),
      summary: createSummary(),
    });

    assert.deepEqual(
      signals.map((signal) => [signal.label, signal.value, signal.route, signal.tone]),
      [
        ['Restock attention', '12 low-stock items', '/inventory', 'warning'],
        ['Top product', 'Merino Crew', '/products', 'positive'],
        ['Leading channel', 'Shopify · 64% of revenue', '/channels', 'neutral'],
      ],
    );
  });

  it('does not promote a product or channel when the selected period has no revenue', () => {
    const products = createProducts();
    products.data[0] = { ...products.data[0], revenue: 0, unitsSold: 0 };
    const channels = createChannels();
    channels.channels = channels.channels.map((channel) => ({ ...channel, revenue: 0 }));

    const signals = buildDashboardDecisionSignals({
      channels,
      inventory: createInventory(),
      products,
      summary: { ...createSummary(), kpis: { ...createSummary().kpis, totalSales: 0 } },
    });

    assert.equal(signals[1].value, 'No product sales yet');
    assert.equal(signals[2].value, 'No channel sales yet');
  });

  it('returns current and previous calendar ranges for a selected period', () => {
    assert.deepEqual(getDashboardRangeQuery(7, new Date(2026, 6, 19, 12)), {
      current: { from: '2026-07-13', to: '2026-07-19' },
      previous: { from: '2026-07-06', to: '2026-07-12' },
    });
  });

  it('uses the browser calendar date instead of shifting eastern time zones to UTC', () => {
    const aucklandMidnight = new Date('2026-07-19T00:30:00+12:00');

    assert.equal(getDashboardRangeQuery(7, aucklandMidnight).current.to, '2026-07-19');
  });
});

function createSummary(): DashboardSummary {
  return {
    range: { from: '2026-06-01', to: '2026-06-30' },
    kpis: {
      totalSales: 12450.5,
      grossProfit: 5230.1,
      grossMarginPct: 42.01,
      orders: 318,
      averageOrderValue: 39.15,
      unitsSold: 642,
      lowStockItems: 12,
      slowMovers: 8,
    },
  };
}

function createPreviousSummary(): DashboardSummary {
  return {
    ...createSummary(),
    kpis: {
      ...createSummary().kpis,
      totalSales: 10000,
      grossMarginPct: 40,
      orders: 300,
    },
  };
}

function createChannels(): ChannelBreakdownResult {
  return {
    channels: [
      {
        channel: 'SHOPIFY',
        revenue: 8000,
        orders: 190,
        averageOrderValue: 42.1,
        grossMarginPct: 44,
        unitsSold: 360,
      },
      {
        channel: 'IN_STORE',
        revenue: 4450.5,
        orders: 128,
        averageOrderValue: 34.77,
        grossMarginPct: 38,
        unitsSold: 282,
      },
    ],
  };
}

function createProducts(): ProductPerformanceResult {
  return {
    data: [
      {
        id: 'product-1',
        rank: 1,
        sku: 'MC-01',
        name: 'Merino Crew',
        category: 'Apparel',
        vendor: 'Local Wool',
        unitsSold: 80,
        revenue: 5200,
        cost: 2600,
        grossProfit: 2600,
        grossMarginPct: 50,
        abcClass: 'A',
        revenueContributionPct: 41.8,
        cumulativeRevenuePct: 41.8,
        currentStock: 24,
        lastSoldAt: '2026-06-30T12:00:00.000Z',
        labels: ['Best Seller'],
      },
    ],
    meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
  };
}

function createInventory(): InventoryInsights {
  const product = {
    id: 'product-2',
    sku: 'LS-01',
    name: 'Low-stock item',
    category: 'Apparel',
    vendor: null,
    currentStock: 2,
    lastSoldAt: '2026-06-30T12:00:00.000Z',
    unitsSoldLast30: 20,
    dailySalesRate: 0.67,
    daysOfStockLeft: 3,
    labels: ['Low Stock' as const],
    recommendation: 'Reorder soon',
  };

  return {
    generatedAt: '2026-07-19T12:00:00.000Z',
    salesWindow: { from: '2026-06-20', to: '2026-07-19', days: 30 },
    summary: {
      reorderSoon: 4,
      lowStock: 12,
      stockoutRisk: 3,
      slowMovers: 8,
      deadStock: 2,
      discountCandidates: 3,
      overstocked: 1,
    },
    reorderSoon: [product],
    lowStock: [product],
    stockoutRisk: [product],
    slowMovers: [],
    deadStock: [],
    discountCandidates: [],
    overstocked: [],
  };
}
