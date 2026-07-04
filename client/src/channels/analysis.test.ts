import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildChannelMetricCards,
  buildChannelTableRows,
  formatChannelCurrency,
  formatChannelNumber,
  formatChannelPercent,
  getChannelLabel,
} from './analysis';
import { type ChannelBreakdownResult } from '../dashboard/types';

describe('channel analysis helpers', () => {
  it('builds headline metric cards from channel breakdown totals', () => {
    const cards = buildChannelMetricCards(createChannelBreakdownResult());

    assert.deepEqual(
      cards.map((card) => [card.label, card.value, card.helper]),
      [
        ['Revenue', '$2,000.00', 'Shopify leads with $1,400.00'],
        ['Orders', '32', 'Shopify leads with 20 orders'],
        ['Average Order Value', '$62.50', 'Shopify leads with $70.00'],
        ['Gross Margin', '42.0%', 'Shopify leads with 45.0%'],
        ['Units Sold', '70', 'Shopify leads with 50 units'],
      ],
    );
  });

  it('builds ranked channel table rows with share and labels', () => {
    const rows = buildChannelTableRows(createChannelBreakdownResult());

    assert.deepEqual(
      rows.map((row) => ({
        averageOrderValue: row.averageOrderValue,
        channel: row.channel,
        label: row.label,
        orders: row.orders,
        revenue: row.revenue,
        revenueShare: row.revenueShare,
        unitsSold: row.unitsSold,
      })),
      [
        {
          averageOrderValue: 70,
          channel: 'SHOPIFY',
          label: 'Shopify',
          orders: 20,
          revenue: 1400,
          revenueShare: 70,
          unitsSold: 50,
        },
        {
          averageOrderValue: 50,
          channel: 'TRADE_ME',
          label: 'Trade Me',
          orders: 12,
          revenue: 600,
          revenueShare: 30,
          unitsSold: 20,
        },
      ],
    );
  });

  it('formats channel metrics for the page', () => {
    assert.equal(formatChannelCurrency(1250), '$1,250.00');
    assert.equal(formatChannelNumber(1200), '1,200');
    assert.equal(formatChannelPercent(42.04), '42.0%');
    assert.equal(getChannelLabel('IN_STORE'), 'In store');
  });
});

function createChannelBreakdownResult(): ChannelBreakdownResult {
  return {
    channels: [
      {
        averageOrderValue: 70,
        channel: 'SHOPIFY',
        grossMarginPct: 45,
        orders: 20,
        revenue: 1400,
        unitsSold: 50,
      },
      {
        averageOrderValue: 50,
        channel: 'TRADE_ME',
        grossMarginPct: 35,
        orders: 12,
        revenue: 600,
        unitsSold: 20,
      },
    ],
  };
}
