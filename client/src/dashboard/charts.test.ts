import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildChannelChartData,
  buildSalesTrendChartData,
  formatChartCurrency,
  formatChartDate,
  formatCompactCurrency,
  toggleSalesSeries,
  toggleSelectedChannel,
} from './charts';
import { type ChannelBreakdownResult, type SalesTrendResult } from './types';

describe('dashboard chart data', () => {
  it('formats sales trend points for chart axes and tooltips', () => {
    const chartData = buildSalesTrendChartData(createSalesTrendResult());

    assert.deepEqual(chartData, [
      {
        date: '2026-06-01',
        label: 'Jun 1',
        sales: 1200,
        grossProfit: 480,
        orders: 10,
      },
      {
        date: '2026-06-02',
        label: 'Jun 2',
        sales: 950.5,
        grossProfit: 300.25,
        orders: 8,
      },
    ]);
  });

  it('builds channel pie data with labels, colors, and revenue share', () => {
    const chartData = buildChannelChartData(createChannelBreakdownResult());

    assert.deepEqual(
      chartData.map((channel) => ({
        label: channel.label,
        value: channel.value,
        share: channel.share,
        color: channel.color,
      })),
      [
        {
          label: 'Shopify',
          value: 1400,
          share: 70,
          color: '#2563eb',
        },
        {
          label: 'Trade Me',
          value: 600,
          share: 30,
          color: '#0f172a',
        },
      ],
    );
  });

  it('handles empty channel data without dividing by zero', () => {
    assert.deepEqual(buildChannelChartData({ channels: [] }), []);
  });

  it('formats compact currency for chart axes', () => {
    assert.equal(formatCompactCurrency(1250), '$1.3K');
    assert.equal(formatCompactCurrency(0), '$0');
  });

  it('formats exact chart values and dates for tooltips and data tables', () => {
    assert.equal(formatChartCurrency(1250.5), '$1,250.50');
    assert.equal(formatChartDate('2026-06-01'), '1 Jun 2026');
  });

  it('toggles trend series while keeping at least one series visible', () => {
    assert.deepEqual(toggleSalesSeries(['sales', 'grossProfit'], 'grossProfit'), ['sales']);
    assert.deepEqual(toggleSalesSeries(['sales'], 'sales'), ['sales']);
    assert.deepEqual(toggleSalesSeries(['sales'], 'grossProfit'), ['sales', 'grossProfit']);
  });

  it('selects and clears a channel for chart exploration', () => {
    assert.equal(toggleSelectedChannel(null, 'SHOPIFY'), 'SHOPIFY');
    assert.equal(toggleSelectedChannel('SHOPIFY', 'TRADE_ME'), 'TRADE_ME');
    assert.equal(toggleSelectedChannel('SHOPIFY', 'SHOPIFY'), null);
  });
});

function createSalesTrendResult(): SalesTrendResult {
  return {
    interval: 'day',
    points: [
      {
        date: '2026-06-01',
        sales: 1200,
        orders: 10,
        grossProfit: 480,
      },
      {
        date: '2026-06-02',
        sales: 950.5,
        orders: 8,
        grossProfit: 300.25,
      },
    ],
  };
}

function createChannelBreakdownResult(): ChannelBreakdownResult {
  return {
    channels: [
      {
        channel: 'SHOPIFY',
        revenue: 1400,
        orders: 20,
        averageOrderValue: 70,
        grossMarginPct: 45,
        unitsSold: 50,
      },
      {
        channel: 'TRADE_ME',
        revenue: 600,
        orders: 12,
        averageOrderValue: 50,
        grossMarginPct: 35,
        unitsSold: 20,
      },
    ],
  };
}
