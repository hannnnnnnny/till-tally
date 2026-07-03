import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SalesChannel } from '@prisma/client';
import { calculateChannelBreakdown } from './channelBreakdownService';

describe('channel breakdown service', () => {
  it('aggregates revenue, orders, AOV, margin, and units by channel', () => {
    const result = calculateChannelBreakdown([
      {
        channel: SalesChannel.SHOPIFY,
        totalAmount: '100.00',
        items: [
          {
            quantity: 2,
            totalPrice: '80.00',
            costPrice: '20.00',
          },
        ],
      },
      {
        channel: SalesChannel.TRADE_ME,
        totalAmount: '50.00',
        items: [
          {
            quantity: 1,
            totalPrice: '50.00',
            costPrice: '25.00',
          },
        ],
      },
      {
        channel: SalesChannel.SHOPIFY,
        totalAmount: '40.00',
        items: [
          {
            quantity: 1,
            totalPrice: '40.00',
            costPrice: '10.00',
          },
        ],
      },
    ]);

    assert.deepEqual(result, {
      channels: [
        {
          channel: SalesChannel.SHOPIFY,
          revenue: 140,
          orders: 2,
          averageOrderValue: 70,
          grossMarginPct: 50,
          unitsSold: 3,
        },
        {
          channel: SalesChannel.TRADE_ME,
          revenue: 50,
          orders: 1,
          averageOrderValue: 50,
          grossMarginPct: 50,
          unitsSold: 1,
        },
      ],
    });
  });

  it('returns an empty channel list when there are no matching orders', () => {
    assert.deepEqual(calculateChannelBreakdown([]), {
      channels: [],
    });
  });
});
