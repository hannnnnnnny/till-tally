import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ImportStatus,
  ImportType,
  PrismaClient,
  Role,
  SalesChannel,
} from '@prisma/client';
import { parse as parseCsv } from 'csv-parse/sync';
import { hashPassword } from '../src/auth/password';

const prisma = new PrismaClient();

const DEMO_USER = {
  name: 'Demo Owner',
  email: 'demo@tilltally.local',
  password: 'DemoPass123!',
};

const DEMO_BUSINESS = {
  name: 'Auckland Demo Retail',
  industry: 'Retail',
  city: 'Auckland',
};

type ProductCsvRow = {
  sku: string;
  name: string;
  category: string;
  vendor: string;
  cost_price: string;
  current_stock: string;
  last_sold_at: string;
};

type OrderCsvRow = {
  order_number: string;
  order_date: string;
  channel: string;
  total_amount: string;
  discount_amount: string;
  customer_region: string;
};

type OrderItemCsvRow = {
  order_number: string;
  sku: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  total_price: string;
  cost_price: string;
};

type InventorySnapshotCsvRow = {
  sku: string;
  stock_quantity: string;
  snapshot_date: string;
};

async function main() {
  const [products, orders, orderItems, inventorySnapshots] = await Promise.all([
    readSampleCsv<ProductCsvRow>('products.csv'),
    readSampleCsv<OrderCsvRow>('orders.csv'),
    readSampleCsv<OrderItemCsvRow>('order_items.csv'),
    readSampleCsv<InventorySnapshotCsvRow>('inventory_snapshots.csv'),
  ]);

  const passwordHash = await hashPassword(DEMO_USER.password);
  const user = await prisma.user.upsert({
    where: {
      email: DEMO_USER.email,
    },
    update: {
      name: DEMO_USER.name,
      passwordHash,
    },
    create: {
      name: DEMO_USER.name,
      email: DEMO_USER.email,
      passwordHash,
    },
  });

  await prisma.business.deleteMany({
    where: {
      ownerId: user.id,
      name: DEMO_BUSINESS.name,
    },
  });

  const business = await prisma.business.create({
    data: {
      ownerId: user.id,
      name: DEMO_BUSINESS.name,
      industry: DEMO_BUSINESS.industry,
      city: DEMO_BUSINESS.city,
      members: {
        create: {
          userId: user.id,
          role: Role.OWNER,
        },
      },
    },
  });

  const productImportJob = await prisma.importJob.create({
    data: {
      businessId: business.id,
      fileName: 'products.csv',
      importType: ImportType.PRODUCTS,
      status: ImportStatus.COMPLETED,
      rowsTotal: products.length,
      rowsImported: products.length,
      rowsFailed: 0,
      createdAt: toUtcDate('2026-06-24'),
    },
  });

  const productsBySku = new Map<string, string>();

  for (const product of products) {
    const createdProduct = await prisma.product.create({
      data: {
        businessId: business.id,
        importJobId: productImportJob.id,
        sku: product.sku,
        name: product.name,
        category: product.category || null,
        vendor: product.vendor || null,
        costPrice: product.cost_price,
        currentStock: toInteger(product.current_stock),
        lastSoldAt: product.last_sold_at ? toUtcDate(product.last_sold_at) : null,
      },
    });

    productsBySku.set(createdProduct.sku, createdProduct.id);
  }

  const orderImportJob = await prisma.importJob.create({
    data: {
      businessId: business.id,
      fileName: 'orders.csv',
      importType: ImportType.ORDERS,
      status: ImportStatus.COMPLETED,
      rowsTotal: orders.length,
      rowsImported: orders.length,
      rowsFailed: 0,
      createdAt: toUtcDate('2026-06-25'),
    },
  });

  const orderItemsByOrderNumber = groupOrderItemsByOrderNumber(orderItems);

  for (const order of orders) {
    await prisma.order.create({
      data: {
        businessId: business.id,
        importJobId: orderImportJob.id,
        orderNumber: order.order_number,
        orderDate: toUtcDate(order.order_date),
        channel: mapSalesChannel(order.channel),
        totalAmount: order.total_amount,
        discountAmount: order.discount_amount || '0.00',
        customerRegion: order.customer_region || null,
        items: {
          create: (orderItemsByOrderNumber.get(order.order_number) ?? []).map((item) => ({
            productId: productsBySku.get(item.sku) ?? null,
            sku: item.sku,
            quantity: toInteger(item.quantity),
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
            costPrice: item.cost_price,
          })),
        },
      },
    });
  }

  await prisma.importJob.create({
    data: {
      businessId: business.id,
      fileName: 'inventory_snapshots.csv',
      importType: ImportType.INVENTORY,
      status: ImportStatus.COMPLETED,
      rowsTotal: inventorySnapshots.length,
      rowsImported: inventorySnapshots.length,
      rowsFailed: 0,
      createdAt: toUtcDate('2026-06-26'),
    },
  });

  for (const snapshot of inventorySnapshots) {
    const productId = productsBySku.get(snapshot.sku);

    if (!productId) {
      continue;
    }

    await prisma.inventorySnapshot.create({
      data: {
        productId,
        stockQuantity: toInteger(snapshot.stock_quantity),
        snapshotDate: toUtcDate(snapshot.snapshot_date),
      },
    });
  }

  console.info(`Seeded ${DEMO_BUSINESS.name} for ${DEMO_USER.email}`);
  console.info(`Demo password: ${DEMO_USER.password}`);
}

async function readSampleCsv<T extends Record<string, string>>(fileName: string): Promise<T[]> {
  const filePath = path.join(__dirname, '..', '..', 'sample-data', fileName);
  const csvText = await readFile(filePath, 'utf8');

  return parseCsv(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}

function groupOrderItemsByOrderNumber(
  orderItems: OrderItemCsvRow[],
): Map<string, OrderItemCsvRow[]> {
  const groupedItems = new Map<string, OrderItemCsvRow[]>();

  for (const item of orderItems) {
    const currentItems = groupedItems.get(item.order_number) ?? [];
    currentItems.push(item);
    groupedItems.set(item.order_number, currentItems);
  }

  return groupedItems;
}

function mapSalesChannel(value: string): SalesChannel {
  const normalizedValue = value.toLowerCase().replace(/[\s-]+/g, '_');
  const salesChannels: Record<string, SalesChannel> = {
    shopify: SalesChannel.SHOPIFY,
    trade_me: SalesChannel.TRADE_ME,
    in_store: SalesChannel.IN_STORE,
    social: SalesChannel.SOCIAL,
    manual: SalesChannel.MANUAL,
  };

  return salesChannels[normalizedValue] ?? SalesChannel.OTHER;
}

function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toInteger(value: string): number {
  return Number.parseInt(value, 10);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
