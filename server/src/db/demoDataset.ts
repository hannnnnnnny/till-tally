import { SalesChannel } from '@prisma/client';

const DAY_MS = 86_400_000;
const HISTORY_DAYS = 84;
const SNAPSHOT_WEEKS = 12;
const SLOW_MOVER_SALE_DAYS_AGO = 70;
// Fixed seed: the dataset shape is identical on every seeding day, only shifted in time.
const RANDOM_SEED = 20_260_712;

type ProductRole = 'seller' | 'slow-mover' | 'dead-stock';

type CatalogueEntry = {
  sku: string;
  name: string;
  category: string;
  vendor: string;
  unitPrice: number;
  costPrice: number;
  currentStock: number;
  role: ProductRole;
  weight: number;
  maxQuantity: number;
};

export type DemoProduct = {
  sku: string;
  name: string;
  category: string;
  vendor: string;
  costPrice: string;
  currentStock: number;
  lastSoldAt: Date | null;
};

export type DemoOrderItem = {
  sku: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  costPrice: string;
};

export type DemoOrder = {
  orderNumber: string;
  orderDate: Date;
  channel: SalesChannel;
  totalAmount: string;
  discountAmount: string;
  customerRegion: string;
  items: DemoOrderItem[];
};

export type DemoSnapshot = { sku: string; stockQuantity: number; snapshotDate: Date };

export type DemoDataset = {
  products: DemoProduct[];
  orders: DemoOrder[];
  snapshots: DemoSnapshot[];
};

// Each product is tuned to land in a specific inventory-risk bucket for the demo.
const CATALOGUE: CatalogueEntry[] = [
  entry('WJ-001', "Women's Jacket", "Women's Fashion", 'Local Supplier', 89.9, 38, 4, 0.2, 1),
  entry('HM-002', 'Homeware Mug Set', 'Homeware', 'Donated Stock', 22.5, 10, 20, 0.14, 2),
  entry('TS-004', 'T-shirt', "Men's Fashion", 'Local Supplier', 32, 12, 3, 0.04, 1),
  entry('BN-008', 'Bamboo Notebook', 'Stationery', 'Market Wholesale', 7, 4.5, 140, 0.08, 3),
  entry('SC-011', 'Scented Candle', 'Homeware', 'Local Supplier', 18, 6.75, 12, 0.14, 2),
  entry('BK-020', 'Canvas Backpack', 'Accessories', 'Trade Distributor', 76, 22, 7, 0.08, 1),
  entry('WS-012', 'Wool Scarf', 'Accessories', 'Local Supplier', 39, 14, 15, 0.12, 1),
  entry('KR-015', 'Kids Raincoat', 'Kids', 'Trade Distributor', 45, 19, 10, 0.1, 1),
  {
    ...entry('LT-030', 'Linen Tea Towel', 'Homeware', 'Local Supplier', 14, 5, 18, 0, 1),
    role: 'slow-mover',
  },
  {
    ...entry('CP-040', 'Ceramic Planter', 'Garden', 'Market Wholesale', 34, 15, 9, 0, 1),
    role: 'dead-stock',
  },
];

const CHANNELS: Array<[SalesChannel, number]> = [
  [SalesChannel.SHOPIFY, 0.35],
  [SalesChannel.IN_STORE, 0.3],
  [SalesChannel.TRADE_ME, 0.15],
  [SalesChannel.SOCIAL, 0.12],
  [SalesChannel.MANUAL, 0.08],
];

const REGIONS = ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin'];

export function buildDemoDataset(today: Date): DemoDataset {
  const todayStart = startOfUtcDay(today);
  const orders = generateOrders(todayStart);

  return {
    products: CATALOGUE.map((item) => toDemoProduct(item, orders)),
    orders,
    snapshots: buildSnapshots(todayStart, orders),
  };
}

export function lastCompleteWeekStart(today: Date): Date {
  const todayStart = startOfUtcDay(today);
  const daysSinceMonday = (todayStart.getUTCDay() + 6) % 7;

  return addDays(todayStart, -daysSinceMonday - 7);
}

function generateOrders(todayStart: Date): DemoOrder[] {
  const random = createRandom(RANDOM_SEED);
  const sellers = CATALOGUE.filter((item) => item.role === 'seller');
  const orders: DemoOrder[] = [];

  for (let daysAgo = HISTORY_DAYS; daysAgo >= 1; daysAgo -= 1) {
    const orderDate = addDays(todayStart, -daysAgo);
    const isWeekend = orderDate.getUTCDay() === 0 || orderDate.getUTCDay() === 6;
    const orderCount = 1 + (random() < 0.55 ? 1 : 0) + (isWeekend ? 1 : 0);

    for (let index = 0; index < orderCount; index += 1) {
      const items = pickOrderItems(random, sellers);
      orders.push(createOrder(orders.length, orderDate, items, random));
    }

    if (daysAgo === SLOW_MOVER_SALE_DAYS_AGO) {
      const slowMover = CATALOGUE.filter((item) => item.role === 'slow-mover');
      orders.push(createOrder(orders.length, orderDate, slowMover.map(toLine(1)), random));
    }
  }

  return orders;
}

function pickOrderItems(random: () => number, sellers: CatalogueEntry[]): DemoOrderItem[] {
  const lineCount = random() < 0.3 ? 2 : 1;
  const picked = new Map<string, DemoOrderItem>();

  while (picked.size < lineCount) {
    const item = pickWeighted(
      random,
      sellers.map((seller) => [seller, seller.weight]),
    );
    const quantity = 1 + Math.floor(random() * item.maxQuantity);
    picked.set(item.sku, toLine(quantity)(item));
  }

  return [...picked.values()];
}

function createOrder(
  index: number,
  orderDate: Date,
  items: DemoOrderItem[],
  random: () => number,
): DemoOrder {
  const total = items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  const hasDiscount = total > 50 && random() < 0.2;

  return {
    orderNumber: String(1001 + index),
    orderDate,
    channel: pickWeighted(random, CHANNELS),
    totalAmount: total.toFixed(2),
    discountAmount: hasDiscount ? '5.00' : '0.00',
    customerRegion: REGIONS[Math.floor(random() * REGIONS.length)] ?? 'Auckland',
    items,
  };
}

function toLine(quantity: number) {
  return (item: CatalogueEntry): DemoOrderItem => ({
    sku: item.sku,
    quantity,
    unitPrice: item.unitPrice.toFixed(2),
    totalPrice: (item.unitPrice * quantity).toFixed(2),
    costPrice: item.costPrice.toFixed(2),
  });
}

function toDemoProduct(item: CatalogueEntry, orders: DemoOrder[]): DemoProduct {
  const saleTimes = orders
    .filter((order) => order.items.some((line) => line.sku === item.sku))
    .map((order) => order.orderDate.getTime());

  return {
    sku: item.sku,
    name: item.name,
    category: item.category,
    vendor: item.vendor,
    costPrice: item.costPrice.toFixed(2),
    currentStock: item.currentStock,
    lastSoldAt: saleTimes.length > 0 ? new Date(Math.max(...saleTimes)) : null,
  };
}

// Back-calculates weekly stock: stock on a date = current stock + units sold after it.
function buildSnapshots(todayStart: Date, orders: DemoOrder[]): DemoSnapshot[] {
  return CATALOGUE.flatMap((item) =>
    Array.from({ length: SNAPSHOT_WEEKS }, (_, week) => {
      const snapshotDate = addDays(todayStart, -1 - (SNAPSHOT_WEEKS - 1 - week) * 7);
      const unitsSoldAfter = orders
        .filter((order) => order.orderDate.getTime() > snapshotDate.getTime())
        .flatMap((order) => order.items)
        .filter((line) => line.sku === item.sku)
        .reduce((sum, line) => sum + line.quantity, 0);

      return { sku: item.sku, stockQuantity: item.currentStock + unitsSoldAfter, snapshotDate };
    }),
  );
}

function pickWeighted<T>(random: () => number, options: Array<[T, number]>): T {
  const totalWeight = options.reduce((sum, [, weight]) => sum + weight, 0);
  let threshold = random() * totalWeight;

  for (const [value, weight] of options) {
    threshold -= weight;
    if (threshold < 0) return value;
  }

  const last = options.at(-1);
  if (!last) throw new Error('pickWeighted requires at least one option');
  return last[0];
}

// mulberry32: tiny deterministic PRNG so the demo data is reproducible.
function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function entry(
  sku: string,
  name: string,
  category: string,
  vendor: string,
  unitPrice: number,
  costPrice: number,
  currentStock: number,
  weight: number,
  maxQuantity: number,
): CatalogueEntry {
  return {
    sku,
    name,
    category,
    vendor,
    unitPrice,
    costPrice,
    currentStock,
    role: 'seller',
    weight,
    maxQuantity,
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
