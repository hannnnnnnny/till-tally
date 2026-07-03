import { type SalesChannel } from '@prisma/client';
import { prisma } from '../db/prisma';
import { parseDashboardDateRange, type DashboardDateRangeQuery } from './summaryService';

type NumericValue = number | string | { toString(): string };

export type ChannelBreakdownOrder = {
  channel: SalesChannel;
  totalAmount: NumericValue;
  items: Array<{
    quantity: number;
    totalPrice: NumericValue;
    costPrice: NumericValue;
  }>;
};

export type ChannelBreakdownItem = {
  channel: SalesChannel;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  grossMarginPct: number;
  unitsSold: number;
};

export type ChannelBreakdownResult = {
  channels: ChannelBreakdownItem[];
};

type ChannelMetrics = {
  channel: SalesChannel;
  revenue: number;
  orders: number;
  grossProfit: number;
  unitsSold: number;
};

export function calculateChannelBreakdown(orders: ChannelBreakdownOrder[]): ChannelBreakdownResult {
  const channelMetrics = new Map<SalesChannel, ChannelMetrics>();

  for (const order of orders) {
    const metrics = getOrCreateChannelMetrics(channelMetrics, order.channel);

    metrics.revenue += toNumber(order.totalAmount);
    metrics.orders += 1;

    for (const item of order.items) {
      metrics.unitsSold += item.quantity;
      metrics.grossProfit += toNumber(item.totalPrice) - item.quantity * toNumber(item.costPrice);
    }
  }

  return {
    channels: Array.from(channelMetrics.values())
      .map((metrics) => ({
        channel: metrics.channel,
        revenue: roundTo(metrics.revenue, 2),
        orders: metrics.orders,
        averageOrderValue: roundTo(metrics.orders > 0 ? metrics.revenue / metrics.orders : 0, 2),
        grossMarginPct: roundTo(metrics.revenue > 0 ? (metrics.grossProfit / metrics.revenue) * 100 : 0, 2),
        unitsSold: metrics.unitsSold,
      }))
      .sort((first, second) => second.revenue - first.revenue || first.channel.localeCompare(second.channel)),
  };
}

export async function getDashboardChannelBreakdown(
  businessId: string,
  query: DashboardDateRangeQuery = {},
): Promise<ChannelBreakdownResult> {
  if (!businessId) {
    throw new Error('Business id is required');
  }

  const range = parseDashboardDateRange(query);
  const orders = await prisma.order.findMany({
    where: {
      businessId,
      orderDate: {
        gte: range.from,
        lte: range.to,
      },
    },
    select: {
      channel: true,
      totalAmount: true,
      items: {
        select: {
          quantity: true,
          totalPrice: true,
          costPrice: true,
        },
      },
    },
  });

  return calculateChannelBreakdown(orders);
}

function getOrCreateChannelMetrics(
  channelMetrics: Map<SalesChannel, ChannelMetrics>,
  channel: SalesChannel,
): ChannelMetrics {
  const existingMetrics = channelMetrics.get(channel);

  if (existingMetrics) {
    return existingMetrics;
  }

  const metrics: ChannelMetrics = {
    channel,
    revenue: 0,
    orders: 0,
    grossProfit: 0,
    unitsSold: 0,
  };

  channelMetrics.set(channel, metrics);
  return metrics;
}

function toNumber(value: NumericValue): number {
  return Number(value.toString());
}

function roundTo(value: number, decimalPlaces: number): number {
  const scale = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}
