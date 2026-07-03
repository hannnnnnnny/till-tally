import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SalesChannel } from '@prisma/client';
import {
  calculateInventoryInsights,
  InventoryRiskQueryError,
  parseInventoryRiskQuery,
} from './inventoryRiskService';

describe('inventory risk service', () => {
  it('groups low stock, stockout risk, slow movers, dead stock, and discount candidates', () => {
    const result = calculateInventoryInsights(createProducts(), {
      now: new Date('2026-07-03T00:00:00.000Z'),
      salesWindowDays: 30,
      lowStockThreshold: 5,
      slowMoverDays: 60,
      deadStockDays: 90,
      overstockDays: 90,
    });

    assert.deepEqual(result.salesWindow, {
      from: '2026-06-04',
      to: '2026-07-03',
      days: 30,
    });

    assert.deepEqual(
      result.reorderSoon.map((product) => product.id),
      ['reorder-product'],
    );
    assert.deepEqual(
      result.stockoutRisk.map((product) => ({
        id: product.id,
        unitsSoldLast30: product.unitsSoldLast30,
        dailySalesRate: product.dailySalesRate,
        daysOfStockLeft: product.daysOfStockLeft,
        labels: product.labels,
        recommendation: product.recommendation,
      })),
      [
        {
          id: 'reorder-product',
          unitsSoldLast30: 24,
          dailySalesRate: 0.8,
          daysOfStockLeft: 4,
          labels: ['Low Stock', 'Stockout Risk', 'Reorder Soon'],
          recommendation: 'Reorder soon',
        },
      ],
    );
    assert.deepEqual(
      result.lowStock.map((product) => product.id),
      ['reorder-product', 'low-stock-product'],
    );
    assert.deepEqual(
      result.slowMovers.map((product) => product.id),
      ['slow-product'],
    );
    assert.deepEqual(
      result.deadStock.map((product) => product.id),
      ['dead-product', 'never-sold-product'],
    );
    assert.deepEqual(
      result.discountCandidates.map((product) => product.id),
      ['slow-product', 'dead-product', 'never-sold-product'],
    );
    assert.equal(result.summary.lowStock, 2);
    assert.equal(result.summary.stockoutRisk, 1);
    assert.equal(result.summary.slowMovers, 1);
    assert.equal(result.summary.deadStock, 2);
    assert.equal(result.summary.reorderSoon, 1);
    assert.equal(result.summary.discountCandidates, 3);
  });

  it('marks products with too much stock relative to sales as overstocked', () => {
    const result = calculateInventoryInsights(createProducts(), {
      now: new Date('2026-07-03T00:00:00.000Z'),
      salesWindowDays: 30,
      lowStockThreshold: 5,
      slowMoverDays: 60,
      deadStockDays: 90,
      overstockDays: 90,
    });

    assert.deepEqual(
      result.overstocked.map((product) => ({
        id: product.id,
        daysOfStockLeft: product.daysOfStockLeft,
        labels: product.labels,
        recommendation: product.recommendation,
      })),
      [
        {
          id: 'overstock-product',
          daysOfStockLeft: 300,
          labels: ['Overstocked'],
          recommendation: 'Review stock level',
        },
      ],
    );
  });

  it('parses inventory risk query thresholds', () => {
    const query = parseInventoryRiskQuery(
      {
        businessId: 'business-1',
        to: '2026-06-30',
        lowStockThreshold: '8',
        slowMoverDays: '45',
        deadStockDays: '120',
        overstockDays: '180',
      },
      new Date('2026-07-03T00:00:00.000Z'),
    );

    assert.equal(query.now.toISOString(), '2026-06-30T00:00:00.000Z');
    assert.equal(query.lowStockThreshold, 8);
    assert.equal(query.slowMoverDays, 45);
    assert.equal(query.deadStockDays, 120);
    assert.equal(query.overstockDays, 180);
  });

  it('rejects invalid inventory risk query params', () => {
    assert.throws(
      () =>
        parseInventoryRiskQuery({
          lowStockThreshold: '0',
        }),
      InventoryRiskQueryError,
    );
  });
});

function createProducts() {
  return [
    createProduct({
      id: 'reorder-product',
      sku: 'RE-001',
      name: 'Reorder Product',
      currentStock: 3,
      lastSoldAt: '2026-06-24',
      quantitySold: 24,
    }),
    createProduct({
      id: 'low-stock-product',
      sku: 'LO-001',
      name: 'Low Stock Product',
      currentStock: 4,
      lastSoldAt: '2026-06-24',
      quantitySold: 2,
    }),
    createProduct({
      id: 'slow-product',
      sku: 'SL-001',
      name: 'Slow Product',
      currentStock: 14,
      lastSoldAt: '2026-04-20',
      quantitySold: 0,
    }),
    createProduct({
      id: 'dead-product',
      sku: 'DE-001',
      name: 'Dead Product',
      currentStock: 18,
      lastSoldAt: '2026-03-01',
      quantitySold: 0,
    }),
    createProduct({
      id: 'never-sold-product',
      sku: 'NE-001',
      name: 'Never Sold Product',
      currentStock: 9,
      lastSoldAt: null,
      quantitySold: 0,
    }),
    createProduct({
      id: 'overstock-product',
      sku: 'OV-001',
      name: 'Overstock Product',
      currentStock: 30,
      lastSoldAt: '2026-06-24',
      quantitySold: 3,
    }),
  ];
}

function createProduct(input: {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  lastSoldAt: string | null;
  quantitySold: number;
}) {
  return {
    id: input.id,
    sku: input.sku,
    name: input.name,
    category: 'Inventory',
    vendor: 'Supplier',
    currentStock: input.currentStock,
    lastSoldAt: input.lastSoldAt ? new Date(`${input.lastSoldAt}T00:00:00.000Z`) : null,
    orderItems:
      input.quantitySold > 0
        ? [
            {
              quantity: input.quantitySold,
              order: {
                orderDate: new Date('2026-06-24T00:00:00.000Z'),
                channel: SalesChannel.SHOPIFY,
              },
            },
          ]
        : [],
  };
}
