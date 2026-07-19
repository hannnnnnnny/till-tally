import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAnalyticsCsv } from './exportCsv';
import { createAnalyticsResult } from './analyticsTestFixtures';

describe('analytics CSV export', () => {
  it('exports the exact displayed columns and raw row values with traceable metadata', () => {
    const result = createAnalyticsResult();
    result.table.columns = [
      { key: 'day', label: 'Day', kind: 'dimension', unit: null },
      { key: 'revenue', label: 'Revenue', kind: 'metric', unit: 'NZD' },
    ];
    result.table.rows = [
      { day: '2026-07-18', revenue: 1250.5 },
      { day: '2026-07-19', revenue: 980 },
    ];
    result.meta.rowCount = 2;

    const csv = createAnalyticsCsv(result, {
      businessName: 'Auckland Demo Retail',
      reportName: 'Daily revenue',
    });

    assert.match(csv, /# Report,Daily revenue/);
    assert.match(csv, /# Business,Auckland Demo Retail/);
    assert.match(csv, /# Filters,"\[\{""field"":""channel""/);
    assert.match(csv, /# Displayed rows,2/);
    assert.match(csv, /Day,Revenue/);
    assert.match(csv, /2026-07-18,1250.5/);
    assert.match(csv, /2026-07-19,980/);
  });

  it('escapes spreadsheet formulas and CSV punctuation', () => {
    const result = createAnalyticsResult();
    result.table.columns = [{ key: 'product', label: 'Product', kind: 'dimension', unit: null }];
    result.table.rows = [{ product: '=HYPERLINK("https://bad.example")' }];

    const csv = createAnalyticsCsv(result, {
      businessName: 'Demo, Inc.',
      reportName: 'Products',
    });

    assert.match(csv, /"Demo, Inc\."/);
    assert.match(csv, /"'=HYPERLINK\(""https:\/\/bad\.example""\)"/);
  });
});
