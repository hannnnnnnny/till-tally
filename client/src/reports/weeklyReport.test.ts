import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWeeklyReportMetricCards,
  buildWeeklyReportSuggestedActions,
  buildWeeklyReportWarnings,
  formatWeeklyReportRange,
} from './weeklyReport';
import { type WeeklyReport } from './types';

describe('weekly report presentation helpers', () => {
  it('builds metric cards, warnings, and suggested actions from a risk report', () => {
    const report = createWeeklyReport({
      lowStockCount: 3,
      salesChangePercent: -12.35,
      slowMoverCount: 2,
      topCategory: 'Vintage denim',
    });

    assert.deepEqual(
      buildWeeklyReportMetricCards(report).map((card) => ({
        helper: card.helper,
        label: card.label,
        tone: card.tone,
        value: card.value,
      })),
      [
        {
          helper: 'Compared with previous week',
          label: 'Sales Change',
          tone: 'warning',
          value: '-12.4%',
        },
        {
          helper: 'Highest revenue category',
          label: 'Top Category',
          tone: 'success',
          value: 'Vintage denim',
        },
        {
          helper: 'Needs replenishment',
          label: 'Low Stock',
          tone: 'warning',
          value: '3',
        },
        {
          helper: 'Consider markdowns',
          label: 'Slow Movers',
          tone: 'warning',
          value: '2',
        },
      ],
    );

    assert.deepEqual(
      buildWeeklyReportWarnings(report).map((warning) => warning.title),
      ['Sales decreased by 12.4%', '3 products are low in stock', '2 products are slow movers'],
    );

    assert.deepEqual(
      buildWeeklyReportSuggestedActions(report).map((action) => action.title),
      [
        'Investigate the sales drop',
        'Restock low inventory',
        'Review slow movers',
        'Lean into Vintage denim',
      ],
    );
  });

  it('keeps a healthy report useful without fake warnings', () => {
    const report = createWeeklyReport({
      lowStockCount: 0,
      salesChangePercent: null,
      slowMoverCount: 0,
      topCategory: null,
    });

    assert.equal(formatWeeklyReportRange(report), 'Jun 15 - Jun 21, 2026');
    assert.deepEqual(buildWeeklyReportWarnings(report), []);
    assert.deepEqual(buildWeeklyReportSuggestedActions(report), [
      {
        description: 'No urgent inventory or sales risks were detected for this week.',
        title: 'Keep monitoring the weekly trend',
        tone: 'success',
      },
    ]);
  });
});

function createWeeklyReport(overrides: Partial<WeeklyReport>): WeeklyReport {
  return {
    businessId: 'business-1',
    createdAt: '2026-06-22T00:00:00.000Z',
    id: 'report-1',
    lowStockCount: 0,
    salesChangePercent: 12,
    slowMoverCount: 0,
    summary: 'Weekly summary',
    topCategory: 'Accessories',
    weekEnd: '2026-06-21',
    weekStart: '2026-06-15',
    ...overrides,
  };
}
