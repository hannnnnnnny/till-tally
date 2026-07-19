import { type Prisma, type SalesChannel } from '@prisma/client';
import { prisma } from '../db/prisma';
import {
  type AnalyticsDataSource,
  type AnalyticsSourceDataset,
  type CompiledAnalyticsQuery,
} from './analyticsExecutor';

export const prismaAnalyticsDataSource: AnalyticsDataSource = {
  async load(query) {
    const [orders, products] = await Promise.all([
      query.needsOrders ? loadOrders(query) : Promise.resolve([]),
      query.needsProducts ? loadProducts(query) : Promise.resolve([]),
    ]);

    return { orders, products };
  },
};

async function loadOrders(
  query: CompiledAnalyticsQuery,
): Promise<AnalyticsSourceDataset['orders']> {
  const orders = await prisma.order.findMany({
    where: {
      businessId: query.businessId,
      orderDate: { gte: query.from, lte: query.to },
      ...createChannelWhere(query),
    },
    orderBy: [{ orderDate: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      orderDate: true,
      channel: true,
      items: {
        orderBy: { id: 'asc' },
        select: {
          quantity: true,
          totalPrice: true,
          costPrice: true,
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              category: true,
              vendor: true,
              currentStock: true,
              lastSoldAt: true,
            },
          },
        },
      },
    },
  });

  return orders;
}

async function loadProducts(
  query: CompiledAnalyticsQuery,
): Promise<AnalyticsSourceDataset['products']> {
  const recentSalesFrom = new Date(query.to);
  recentSalesFrom.setUTCDate(recentSalesFrom.getUTCDate() - 29);

  const products = await prisma.product.findMany({
    where: { businessId: query.businessId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      vendor: true,
      currentStock: true,
      lastSoldAt: true,
      orderItems: {
        where: {
          order: {
            businessId: query.businessId,
            orderDate: { gte: recentSalesFrom, lte: query.to },
          },
        },
        select: { quantity: true },
      },
    },
  });

  return products.map(({ orderItems, ...product }) => ({
    ...product,
    recentUnitsSold: orderItems.reduce((total, item) => total + item.quantity, 0),
  }));
}

function createChannelWhere(query: CompiledAnalyticsQuery): Prisma.OrderWhereInput {
  const channelFilters = query.filters.filter((filter) => filter.field === 'channel');
  if (channelFilters.length === 0) return {};

  return {
    AND: channelFilters.map((filter) => {
      const values = (
        Array.isArray(filter.value) ? filter.value : [filter.value]
      ) as SalesChannel[];

      switch (filter.operator) {
        case 'eq':
          return { channel: { equals: values[0] } };
        case 'in':
          return { channel: { in: values } };
        case 'notIn':
          return { channel: { notIn: values } };
        default:
          return {};
      }
    }),
  };
}
