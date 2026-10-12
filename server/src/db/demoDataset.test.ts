import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SalesChannel } from '@prisma/client';
import {
  calculateInventoryInsights,
  parseInventoryRiskQuery,
  type InventoryRiskProductSource,
} from '../inventory/inventoryRiskService';
import { buildWeeklyReport } from '../reports/weeklyReportService';
import { buildDemoDataset, lastCompleteWeekStart, type DemoDataset } from './demoDataset';

const TODAY = new Date('2026-10-12T09:30:00.000Z'); // a Monday
const DAY_MS = 86_400_000;

function toInventorySources(dataset: DemoDataset, now: Date): InventoryRiskProductSource[] {
  const windowStart = now.getTime() - 30 * DAY_MS;

  return dataset.products.map((product) => ({
    id: product.sku,
    sku: product.sku,
    name: product.name,
    category: product.category,
    vendor: product.vendor,
    currentStock: product.currentStock,
    lastSoldAt: product.lastSoldAt,
    orderItems: dataset.orders.flatMap((order) =>
      order.orderDate.getTime() >= windowStart
        ? order.items
            .filter((item) => item.sku === product.sku)
            .map((item) => ({
              quantity: item.quantity,
              order: { orderDate: order.orderDate, channel: order.channel },
            }))
        : [],
    ),
  }));
}

function ordersBetween(dataset: DemoDataset, from: Date, days: number) {
  const end = from.getTime() + days * DAY_MS;
  const categoryBySku = new Map(dataset.products.map((p) => [p.sku, p.category]));

  return dataset.orders
    .filter(
      (order) => order.orderDate.getTime() >= from.getTime() && order.orderDate.getTime() < end,
    )
    .map((order) => ({
      totalAmount: order.totalAmount,
      items: order.items.map((item) => ({
        totalPrice: item.totalPrice,
        product: { category: categoryBySku.get(item.sku) ?? null },
      })),
    }));
}

describe('buildDemoDataset', () => {
  const dataset = buildDemoDataset(TODAY);

  it('is deterministic for a given seeding day', () => {
    assert.deepEqual(buildDemoDataset(new Date('2026-10-12T23:59:00.000Z')), dataset);
  });

  it('ends with activity yesterday and spans twelve weeks', () => {
    const dates = dataset.orders.map((order) => order.orderDate.toISOString().slice(0, 10));

    assert.equal(dates.at(-1), '2026-10-11');
    assert.equal(dates[0], '2026-07-20');
    assert.ok(dataset.orders.length >= 100, `only ${dataset.orders.length} orders`);
  });

  it('uses unique order numbers and totals that equal the line items', () => {
    const numbers = new Set(dataset.orders.map((order) => order.orderNumber));

    assert.equal(numbers.size, dataset.orders.length);
    for (const order of dataset.orders) {
      const lineTotal = order.items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
      assert.equal(order.totalAmount, lineTotal.toFixed(2));
    }
  });

  it('covers every sales channel', () => {
    const channels = new Set(dataset.orders.map((order) => order.channel));

    for (const channel of [SalesChannel.SHOPIFY, SalesChannel.IN_STORE, SalesChannel.TRADE_ME]) {
      assert.ok(channels.has(channel), `missing ${channel}`);
    }
  });

  it('derives each product last-sold date from its latest order', () => {
    for (const product of dataset.products) {
      const saleDates = dataset.orders
        .filter((order) => order.items.some((item) => item.sku === product.sku))
        .map((order) => order.orderDate.getTime());
      const expected = saleDates.length > 0 ? new Date(Math.max(...saleDates)) : null;

      assert.deepEqual(product.lastSoldAt, expected, product.sku);
    }
  });

  it('demonstrates every inventory risk category', () => {
    const now = parseInventoryRiskQuery({}, TODAY).now;
    const insights = calculateInventoryInsights(
      toInventorySources(dataset, now),
      parseInventoryRiskQuery({}, TODAY),
    );

    assert.ok(insights.summary.lowStock > 0, 'low stock');
    assert.ok(insights.summary.stockoutRisk > 0, 'stockout risk');
    assert.ok(insights.summary.slowMovers > 0, 'slow movers');
    assert.ok(insights.summary.deadStock > 0, 'dead stock');
    assert.ok(insights.summary.overstocked > 0, 'overstocked');
  });

  it('gives the last complete week and the week before it real sales', () => {
    const weekStart = lastCompleteWeekStart(TODAY);
    const previousWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
    const report = buildWeeklyReport({
      businessId: 'demo',
      weekStart,
      currentOrders: ordersBetween(dataset, weekStart, 7),
      previousOrders: ordersBetween(dataset, previousWeekStart, 7),
      products: dataset.products,
    });

    assert.equal(report.weekStart, '2026-10-05');
    assert.notEqual(report.salesChangePercent, -100);
    assert.notEqual(report.topCategory, null);
  });

  it('records weekly stock snapshots ending at current stock', () => {
    for (const product of dataset.products) {
      const snapshots = dataset.snapshots.filter((snapshot) => snapshot.sku === product.sku);

      assert.equal(snapshots.length, 12, product.sku);
      assert.equal(snapshots.at(-1)?.stockQuantity, product.currentStock, product.sku);
    }
  });
});

describe('lastCompleteWeekStart', () => {
  it('returns the Monday of the previous full week', () => {
    assert.equal(lastCompleteWeekStart(TODAY).toISOString().slice(0, 10), '2026-10-05');
    assert.equal(
      lastCompleteWeekStart(new Date('2026-10-18T12:00:00.000Z')).toISOString().slice(0, 10),
      '2026-10-05',
    );
  });
});

describe('buildDemoDataset on any seeding day', () => {
  it('keeps every risk category and a non-empty weekly comparison for two weeks of seed days', () => {
    for (let offset = 0; offset < 14; offset += 1) {
      const today = new Date(TODAY.getTime() + offset * DAY_MS);
      const dataset = buildDemoDataset(today);
      const query = parseInventoryRiskQuery({}, today);
      const { summary } = calculateInventoryInsights(toInventorySources(dataset, query.now), query);
      const weekStart = lastCompleteWeekStart(today);
      const label = today.toISOString().slice(0, 10);

      for (const key of [
        'lowStock',
        'stockoutRisk',
        'slowMovers',
        'deadStock',
        'overstocked',
      ] as const) {
        assert.ok(summary[key] > 0, `${key} empty when seeded on ${label}`);
      }
      assert.ok(ordersBetween(dataset, weekStart, 7).length > 0, `empty week on ${label}`);
      assert.ok(
        ordersBetween(dataset, new Date(weekStart.getTime() - 7 * DAY_MS), 7).length > 0,
        `empty previous week on ${label}`,
      );
    }
  });
});
