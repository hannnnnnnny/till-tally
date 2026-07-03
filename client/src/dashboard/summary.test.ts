import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDashboardKpiCards, formatDashboardRange } from './summary';
import { type DashboardSummary } from './types';

describe('dashboard summary KPI cards', () => {
  it('builds the seven dashboard KPI cards in display order', () => {
    const cards = buildDashboardKpiCards(createDashboardSummary());

    assert.deepEqual(
      cards.map((card) => [card.label, card.value]),
      [
        ['Total Sales', '$12,450.50'],
        ['Gross Profit', '$5,230.10'],
        ['Gross Margin', '42.0%'],
        ['Orders', '318'],
        ['Average Order Value', '$39.15'],
        ['Low Stock Items', '12'],
        ['Slow Movers', '8'],
      ],
    );
  });

  it('formats empty dashboard KPIs without NaN or placeholder values', () => {
    const cards = buildDashboardKpiCards({
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

    assert.deepEqual(
      cards.map((card) => card.value),
      ['$0.00', '$0.00', '0.0%', '0', '$0.00', '0', '0'],
    );
  });

  it('formats the dashboard date range for compact page context', () => {
    assert.equal(formatDashboardRange(createDashboardSummary()), 'Jun 1 - Jun 30, 2026');
  });
});

function createDashboardSummary(): DashboardSummary {
  return {
    range: {
      from: '2026-06-01',
      to: '2026-06-30',
    },
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
