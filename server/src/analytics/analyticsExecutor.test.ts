import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAnalyticsPlan } from '@till-tally/analytics-contracts';
import {
  AnalyticsExecutionTimeoutError,
  executeAnalyticsPlan,
  previewAnalyticsPlan,
  type AnalyticsDataSource,
  type AnalyticsSourceDataset,
  type CompiledAnalyticsQuery,
} from './analyticsExecutor';

const channelPlan = parseAnalyticsPlan({
  schemaVersion: 1,
  metrics: ['revenue', 'grossProfit', 'orders'],
  dimensions: ['channel'],
  dateRange: {
    from: '2026-06-01',
    to: '2026-06-30',
    timezone: 'Pacific/Auckland',
  },
  filters: [],
  sort: [{ field: 'revenue', direction: 'desc' }],
  limit: 10,
  chart: { type: 'bar' },
});

const categoryStockPlan = parseAnalyticsPlan({
  schemaVersion: 1,
  metrics: ['currentStock', 'lowStockProducts'],
  dimensions: ['category'],
  dateRange: {
    from: '2026-06-01',
    to: '2026-06-30',
    timezone: 'UTC',
  },
  filters: [],
  sort: [{ field: 'currentStock', direction: 'desc' }],
  limit: 10,
  chart: { type: 'bar' },
});

describe('analytics plan executor', () => {
  it('builds deterministic table rows and chart series from a business-scoped query', async () => {
    const source = new RecordingAnalyticsDataSource({
      orders: [
        {
          id: 'order-shopify',
          orderDate: new Date('2026-06-05T00:00:00.000Z'),
          channel: 'SHOPIFY',
          items: [
            {
              quantity: 2,
              totalPrice: 100,
              costPrice: 30,
              product: createProduct({ id: 'product-a', name: 'Apron' }),
            },
          ],
        },
        {
          id: 'order-store',
          orderDate: new Date('2026-06-06T00:00:00.000Z'),
          channel: 'IN_STORE',
          items: [
            {
              quantity: 1,
              totalPrice: 70,
              costPrice: 40,
              product: createProduct({ id: 'product-b', name: 'Bottle' }),
            },
          ],
        },
      ],
      products: [],
    });

    const result = await executeAnalyticsPlan('business-a', channelPlan, source, {
      timeoutMs: 100,
    });

    assert.equal(source.queries.length, 1);
    assert.equal(source.queries[0]?.businessId, 'business-a');
    assert.equal(source.queries[0]?.needsOrders, true);
    assert.equal(source.queries[0]?.needsProducts, false);
    assert.deepEqual(result.table.rows, [
      { channel: 'SHOPIFY', revenue: 100, grossProfit: 40, orders: 1 },
      { channel: 'IN_STORE', revenue: 70, grossProfit: 30, orders: 1 },
    ]);
    assert.equal(result.chart.series[0]?.key, 'revenue');
    assert.deepEqual(result.chart.series[0]?.data, [
      { category: 'SHOPIFY', value: 100 },
      { category: 'IN_STORE', value: 70 },
    ]);
    assert.equal(result.meta.rowCount, 2);
    assert.equal(result.meta.truncated, false);
  });

  it('executes inventory metrics without querying order data', async () => {
    const source = new RecordingAnalyticsDataSource({
      orders: [],
      products: [
        createProduct({ id: 'product-a', name: 'Apron', category: 'Home', currentStock: 3 }),
        createProduct({ id: 'product-b', name: 'Bottle', category: 'Home', currentStock: 8 }),
        createProduct({ id: 'product-c', name: 'Cap', category: 'Apparel', currentStock: 2 }),
      ],
    });

    const result = await executeAnalyticsPlan('business-a', categoryStockPlan, source);

    assert.equal(source.queries[0]?.needsOrders, false);
    assert.equal(source.queries[0]?.needsProducts, true);
    assert.deepEqual(result.table.rows, [
      { category: 'Home', currentStock: 11, lowStockProducts: 1 },
      { category: 'Apparel', currentStock: 2, lowStockProducts: 1 },
    ]);
  });

  it('rejects unknown plan fields before loading business data', async () => {
    const source = new RecordingAnalyticsDataSource({ orders: [], products: [] });
    const unsafePlan = { ...channelPlan, rawSql: 'select * from orders' };

    await assert.rejects(() => executeAnalyticsPlan('business-a', unsafePlan, source));
    assert.equal(source.queries.length, 0);
  });

  it('rejects unsupported channel values before loading business data', async () => {
    const source = new RecordingAnalyticsDataSource({ orders: [], products: [] });
    const invalidChannelPlan = {
      ...channelPlan,
      filters: [{ field: 'channel', operator: 'eq', value: 'UNTRUSTED_CHANNEL' }],
    };

    await assert.rejects(
      () => executeAnalyticsPlan('business-a', invalidChannelPlan, source),
      /Unsupported channel value/,
    );
    assert.equal(source.queries.length, 0);
  });

  it('enforces the validated row limit and reports truncation', async () => {
    const source = new RecordingAnalyticsDataSource({
      orders: [
        {
          id: 'order-shopify',
          orderDate: new Date('2026-06-05T00:00:00.000Z'),
          channel: 'SHOPIFY',
          items: [
            {
              quantity: 1,
              totalPrice: 100,
              costPrice: 50,
              product: createProduct(),
            },
          ],
        },
        {
          id: 'order-store',
          orderDate: new Date('2026-06-06T00:00:00.000Z'),
          channel: 'IN_STORE',
          items: [
            {
              quantity: 1,
              totalPrice: 70,
              costPrice: 40,
              product: createProduct({ id: 'product-2' }),
            },
          ],
        },
      ],
      products: [],
    });
    const limitedPlan = { ...channelPlan, limit: 1 };

    const result = await executeAnalyticsPlan('business-a', limitedPlan, source);

    assert.equal(result.table.rows.length, 1);
    assert.equal(result.meta.totalRows, 2);
    assert.equal(result.meta.truncated, true);
  });

  it('times out a stalled data source with a typed error', async () => {
    const stalledSource: AnalyticsDataSource = {
      load: async () => new Promise<AnalyticsSourceDataset>(() => undefined),
    };

    await assert.rejects(
      () => executeAnalyticsPlan('business-a', channelPlan, stalledSource, { timeoutMs: 5 }),
      AnalyticsExecutionTimeoutError,
    );
  });

  it('previews a validated plan without loading data', () => {
    const preview = previewAnalyticsPlan(channelPlan);

    assert.equal(preview.title, 'Revenue, Gross profit, and Orders by Channel');
    assert.deepEqual(preview.datasets, ['orders']);
    assert.equal(preview.table.columns[0]?.key, 'channel');
    assert.equal(preview.chart.categoryKey, 'channel');
  });
});

class RecordingAnalyticsDataSource implements AnalyticsDataSource {
  readonly queries: CompiledAnalyticsQuery[] = [];

  constructor(private readonly dataset: AnalyticsSourceDataset) {}

  async load(query: CompiledAnalyticsQuery): Promise<AnalyticsSourceDataset> {
    this.queries.push(query);
    return this.dataset;
  }
}

function createProduct(
  overrides: Partial<AnalyticsSourceDataset['products'][number]> = {},
): AnalyticsSourceDataset['products'][number] {
  return {
    id: 'product-1',
    sku: 'SKU-1',
    name: 'Product',
    category: null,
    vendor: null,
    currentStock: 20,
    lastSoldAt: new Date('2026-06-10T00:00:00.000Z'),
    recentUnitsSold: 5,
    ...overrides,
  };
}
