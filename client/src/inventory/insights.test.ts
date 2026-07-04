import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInventoryInsightsSearchParams } from './api';
import {
  buildInventorySummaryCards,
  formatDailySalesRate,
  formatDaysOfStockLeft,
  formatInventoryLastSoldAt,
  formatInventoryStock,
  formatInventoryWindow,
  getInventoryLabelClass,
} from './insights';
import { type InventoryInsights } from './types';

describe('inventory insights helpers', () => {
  it('builds inventory insight query params from page controls', () => {
    const searchParams = buildInventoryInsightsSearchParams({
      deadStockDays: 120,
      lowStockThreshold: 8,
      overstockDays: 100,
      slowMoverDays: 45,
      to: '2026-07-03',
    });

    assert.equal(
      searchParams.toString(),
      'to=2026-07-03&lowStockThreshold=8&slowMoverDays=45&deadStockDays=120&overstockDays=100',
    );
  });

  it('omits empty inventory insight query params', () => {
    const searchParams = buildInventoryInsightsSearchParams({
      deadStockDays: null,
      lowStockThreshold: undefined,
      overstockDays: null,
      slowMoverDays: undefined,
      to: '',
    });

    assert.equal(searchParams.toString(), '');
  });

  it('builds inventory summary cards in action-priority order', () => {
    const cards = buildInventorySummaryCards(createInventoryInsights());

    assert.deepEqual(
      cards.map((card) => [card.label, card.value]),
      [
        ['Reorder Soon', '3'],
        ['Low Stock', '5'],
        ['Stockout Risk', '2'],
        ['Slow Movers', '4'],
        ['Dead Stock', '1'],
        ['Discount Candidates', '6'],
        ['Overstocked', '7'],
      ],
    );
  });

  it('formats inventory risk metrics for compact scanning', () => {
    assert.equal(formatInventoryWindow(createInventoryInsights()), 'Jun 4 - Jul 3, 2026');
    assert.equal(formatInventoryStock(3), '3 on hand');
    assert.equal(formatDailySalesRate(0.82), '0.82/day');
    assert.equal(formatDaysOfStockLeft(4), '4 days left');
    assert.equal(formatDaysOfStockLeft(null), 'No recent sales pace');
    assert.equal(formatInventoryLastSoldAt('2026-06-24'), 'Last sold Jun 24');
    assert.equal(formatInventoryLastSoldAt(null), 'No recent sale');
  });

  it('styles inventory risk labels by severity', () => {
    assert.match(getInventoryLabelClass('Reorder Soon'), /blue/);
    assert.match(getInventoryLabelClass('Low Stock'), /amber/);
    assert.match(getInventoryLabelClass('Stockout Risk'), /red/);
    assert.match(getInventoryLabelClass('Slow Mover'), /violet/);
    assert.match(getInventoryLabelClass('Overstocked'), /indigo/);
  });
});

function createInventoryInsights(): InventoryInsights {
  return {
    generatedAt: '2026-07-03',
    salesWindow: {
      days: 30,
      from: '2026-06-04',
      to: '2026-07-03',
    },
    summary: {
      deadStock: 1,
      discountCandidates: 6,
      lowStock: 5,
      overstocked: 7,
      reorderSoon: 3,
      slowMovers: 4,
      stockoutRisk: 2,
    },
    deadStock: [],
    discountCandidates: [],
    lowStock: [],
    overstocked: [],
    reorderSoon: [],
    slowMovers: [],
    stockoutRisk: [],
  };
}
