import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { type Express } from 'express';
import request from 'supertest';
import {
  authed,
  createTestApp,
  createUserWithBusiness,
  disconnect,
  importSampleCsv,
  resetDatabase,
  type TestUser,
} from './testHarness';

const JUNE = 'from=2026-06-01&to=2026-06-30';

describe('CSV import to KPIs (real database)', () => {
  let app: Express;
  let owner: TestUser;

  before(async () => {
    await resetDatabase();
    app = createTestApp();
    owner = await createUserWithBusiness(app, 'Kpi');
    await importSampleCsv(app, owner, 'products', 'products.csv');
    await importSampleCsv(app, owner, 'orders', 'orders_with_items.csv');
  });

  after(disconnect);

  it('computes dashboard KPIs and gross margin from imported rows', async () => {
    const response = await request(app)
      .get(`/api/dashboard/summary?${JUNE}`)
      .set(authed(owner))
      .expect(200);

    // Hand-checked from sample-data/orders_with_items.csv: revenue minus unit cost x quantity.
    assert.equal(response.body.kpis.totalSales, 793.7);
    assert.equal(response.body.kpis.grossProfit, 486.95);
    assert.equal(response.body.kpis.grossMarginPct, 61.35);
    assert.equal(response.body.kpis.orders, 12);
    assert.equal(response.body.kpis.averageOrderValue, 66.14);
    assert.equal(response.body.kpis.unitsSold, 23);
  });

  it('breaks revenue down by channel and ranks products', async () => {
    const channels = await request(app)
      .get(`/api/dashboard/channel-breakdown?${JUNE}`)
      .set(authed(owner))
      .expect(200);
    const products = await request(app)
      .get(`/api/products/performance?${JUNE}`)
      .set(authed(owner))
      .expect(200);
    const shopify = channels.body.channels.find(
      (c: { channel: string }) => c.channel === 'SHOPIFY',
    );
    const channelTotal = channels.body.channels.reduce(
      (sum: number, c: { revenue: number }) => sum + c.revenue,
      0,
    );

    assert.equal(shopify.revenue, 311.7);
    assert.equal(shopify.orders, 4);
    assert.equal(Math.round(channelTotal * 100) / 100, 793.7);
    assert.equal(products.body.data[0].sku, 'WJ-001');
    assert.equal(products.body.data[0].revenue, 269.7);
    assert.equal(products.body.data[0].grossProfit, 155.7);
  });

  it('skips duplicate orders on re-import so KPIs do not double count', async () => {
    const reimport = await request(app)
      .post('/api/import/orders')
      .set(authed(owner))
      .attach('file', Buffer.from(SAMPLE_ORDER_ROWS), {
        filename: 'repeat.csv',
        contentType: 'text/csv',
      })
      .expect(422);
    const summary = await request(app)
      .get(`/api/dashboard/summary?${JUNE}`)
      .set(authed(owner))
      .expect(200);

    assert.equal(reimport.body.rowsImported, 0);
    assert.match(reimport.body.warnings[0].message, /already exists/);
    assert.equal(summary.body.kpis.totalSales, 793.7);
  });

  it('reports row-level errors for invalid rows and records them in import history', async () => {
    const response = await request(app)
      .post('/api/import/orders')
      .set(authed(owner))
      .attach('file', Buffer.from(INVALID_ORDER_ROWS), {
        filename: 'invalid.csv',
        contentType: 'text/csv',
      });

    assert.ok([201, 422].includes(response.status), JSON.stringify(response.body));
    assert.equal(response.body.rowsImported, 1);
    assert.equal(response.body.rowsFailed, 2);
    const failedRows = response.body.errors.map((e: { row: number }) => e.row).sort();
    assert.deepEqual(failedRows, [3, 4]);

    const job = await request(app)
      .get(`/api/import/jobs/${response.body.jobId}`)
      .set(authed(owner))
      .expect(200);
    assert.equal(job.body.rowsFailed, 2);
  });

  it('moves product last-sold dates forward when newer orders are imported, never back', async () => {
    const lastSoldAt = async (sku: string) => {
      const response = await request(app)
        .get(`/api/products/performance?${JUNE}`)
        .set(authed(owner))
        .expect(200);
      return response.body.data.find((product: { sku: string }) => product.sku === sku)
        ?.lastSoldAt as string;
    };
    const importRows = (rows: string) =>
      request(app)
        .post('/api/import/orders')
        .set(authed(owner))
        .attach('file', Buffer.from(`${ORDER_HEADER}\n${rows}\n`), {
          filename: 'sales.csv',
          contentType: 'text/csv',
        })
        .expect(201);

    assert.equal(await lastSoldAt('BN-008'), '2026-06-20');

    await importRows('3001,2026-07-29,Shopify,7.00,0.00,Auckland,BN-008,1,7.00,7.00,4.50');
    assert.equal(await lastSoldAt('BN-008'), '2026-07-29');

    await importRows('3002,2026-07-02,Shopify,7.00,0.00,Auckland,BN-008,1,7.00,7.00,4.50');
    assert.equal(await lastSoldAt('BN-008'), '2026-07-29');
  });

  it('generates a weekly report comparing against the previous week', async () => {
    const response = await request(app)
      .post('/api/reports/weekly/generate')
      .set(authed(owner))
      .send({ weekStart: '2026-06-08' })
      .expect(201);

    // Week of 8 June: 288.50; previous week: 505.20.
    assert.equal(response.body.weekStart, '2026-06-08');
    assert.equal(response.body.salesChangePercent, -42.89);
  });

  it('answers a planner question with the same revenue the dashboard reports', async () => {
    const planned = await request(app)
      .post('/api/analytics/plan')
      .set(authed(owner))
      .send({ question: 'Show revenue by channel for the last 30 days', today: '2026-06-30' })
      .expect(200);
    const executed = await request(app)
      .post('/api/analytics/execute')
      .set(authed(owner))
      .send(planned.body.plan)
      .expect(200);
    const rows = executed.body.table.rows as Array<{ revenue: number }>;
    const total = rows.reduce((sum, row) => sum + row.revenue, 0);

    assert.equal(planned.body.status, 'ready');
    assert.equal(Math.round(total * 100) / 100, 793.7);
  });
});

const ORDER_HEADER =
  'order_number,order_date,channel,total_amount,discount_amount,customer_region,sku,quantity,unit_price,total_price,cost_price';

const SAMPLE_ORDER_ROWS = `order_number,order_date,channel,total_amount,discount_amount,customer_region,sku,quantity,unit_price,total_price,cost_price
1001,2026-06-01,Shopify,89.90,5.00,Auckland,WJ-001,1,89.90,89.90,38.00
`;

const INVALID_ORDER_ROWS = `order_number,order_date,channel,total_amount,discount_amount,customer_region,sku,quantity,unit_price,total_price,cost_price
2001,2026-07-20,Shopify,30.00,0.00,Auckland,HM-002,1,30.00,30.00,10.00
2002,not-a-date,Shopify,30.00,0.00,Auckland,HM-002,1,30.00,30.00,10.00
2003,2026-07-21,Shopify,-5.00,0.00,Auckland,HM-002,1,30.00,30.00,10.00
`;
