import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { type Express } from 'express';
import request from 'supertest';
import {
  authed,
  createTestApp,
  createUserWithBusiness,
  disconnect,
  importSampleCsv,
  resetDatabase,
  SAMPLE_DATA_DIR,
  type TestUser,
} from './testHarness';

const BUSINESS_SCOPED_READS = [
  '/api/dashboard/summary?from=2026-06-01&to=2026-06-30',
  '/api/dashboard/sales-trend?from=2026-06-01&to=2026-06-30',
  '/api/dashboard/channel-breakdown?from=2026-06-01&to=2026-06-30',
  '/api/products/performance?from=2026-06-01&to=2026-06-30',
  '/api/inventory/insights',
  '/api/inventory/low-stock',
  '/api/inventory/slow-movers',
  '/api/import/jobs',
  '/api/reports/weekly',
  '/api/analytics/saved-reports',
];

describe('workspace data isolation (real database)', () => {
  let app: Express;
  let owner: TestUser;
  let outsider: TestUser;
  let ids: { productId: string; jobId: string; reportId: string };
  let plan: object;

  before(async () => {
    await resetDatabase();
    app = createTestApp();
    owner = await createUserWithBusiness(app, 'Owner');
    outsider = await createUserWithBusiness(app, 'Outsider');
    await importSampleCsv(app, owner, 'products', 'products.csv');
    await importSampleCsv(app, owner, 'orders', 'orders_with_items.csv');
    ids = await seedOwnerRecords();
  });

  after(disconnect);

  async function seedOwnerRecords() {
    const products = await request(app)
      .get('/api/products/performance?from=2026-06-01&to=2026-06-30')
      .set(authed(owner))
      .expect(200);
    const jobs = await request(app).get('/api/import/jobs').set(authed(owner)).expect(200);
    const planned = await request(app)
      .post('/api/analytics/plan')
      .set(authed(owner))
      .send({ question: 'Show revenue by channel for the last 30 days', today: '2026-06-30' })
      .expect(200);
    plan = planned.body.plan as object;
    const saved = await request(app)
      .post('/api/analytics/saved-reports')
      .set(authed(owner))
      .send({ name: 'Owner channel report', plan, source: 'local' })
      .expect(201);

    return {
      productId: products.body.data[0].id as string,
      jobId: jobs.body.data[0].id as string,
      reportId: saved.body.id as string,
    };
  }

  it('rejects every business-scoped read of another workspace via header', async () => {
    for (const url of BUSINESS_SCOPED_READS) {
      const response = await request(app).get(url).set(authed(outsider, owner.businessId));
      assert.equal(response.status, 403, `${url} leaked with status ${response.status}`);
    }
  });

  it('rejects every business-scoped read of another workspace via query string', async () => {
    for (const url of BUSINESS_SCOPED_READS) {
      const separator = url.includes('?') ? '&' : '?';
      const response = await request(app)
        .get(`${url}${separator}businessId=${owner.businessId}`)
        .set('authorization', `Bearer ${outsider.token}`);
      assert.equal(response.status, 403, `${url} leaked with status ${response.status}`);
    }
  });

  it('rejects writes into another workspace', async () => {
    const asOutsiderInOwner = authed(outsider, owner.businessId);

    await request(app)
      .post('/api/import/products')
      .set(asOutsiderInOwner)
      .attach('file', path.join(SAMPLE_DATA_DIR, 'products.csv'), {
        filename: 'products.csv',
        contentType: 'text/csv',
      })
      .expect(403);
    await request(app).post('/api/reports/weekly/generate').set(asOutsiderInOwner).expect(403);
    await request(app)
      .post('/api/analytics/plan')
      .set(asOutsiderInOwner)
      .send({ question: 'Show revenue by channel' })
      .expect(403);
    await request(app).post('/api/analytics/execute').set(asOutsiderInOwner).send(plan).expect(403);
    await request(app)
      .post('/api/analytics/saved-reports')
      .set(asOutsiderInOwner)
      .send({ name: 'Hijack', plan, source: 'local' })
      .expect(403);
  });

  it('hides another workspace record ids behind 404 even with a valid own workspace', async () => {
    const asOutsider = authed(outsider);
    const reportUrl = `/api/analytics/saved-reports/${ids.reportId}`;

    await request(app).get(`/api/products/${ids.productId}`).set(asOutsider).expect(404);
    await request(app).get(`/api/import/jobs/${ids.jobId}`).set(asOutsider).expect(404);
    await request(app).get(reportUrl).set(asOutsider).expect(404);
    await request(app).patch(reportUrl).set(asOutsider).send({ name: 'Hijack' }).expect(404);
    await request(app)
      .post(`${reportUrl}/versions`)
      .set(asOutsider)
      .send({ plan, source: 'local' })
      .expect(404);
    await request(app).post(`${reportUrl}/duplicate`).set(asOutsider).send({}).expect(404);
    await request(app).delete(reportUrl).set(asOutsider).expect(404);

    const intact = await request(app).get(reportUrl).set(authed(owner)).expect(200);
    assert.equal(intact.body.name, 'Owner channel report');
  });

  it('rejects reading another business profile directly', async () => {
    await request(app)
      .get(`/api/businesses/${owner.businessId}`)
      .set('authorization', `Bearer ${outsider.token}`)
      .expect(403);
  });

  it('shows the outsider only their own empty workspace', async () => {
    const asOutsider = authed(outsider);
    const businesses = await request(app)
      .get('/api/businesses')
      .set('authorization', `Bearer ${outsider.token}`)
      .expect(200);
    const summary = await request(app)
      .get('/api/dashboard/summary?from=2026-06-01&to=2026-06-30')
      .set(asOutsider)
      .expect(200);
    const products = await request(app)
      .get('/api/products/performance?from=2026-06-01&to=2026-06-30')
      .set(asOutsider)
      .expect(200);
    const jobs = await request(app).get('/api/import/jobs').set(asOutsider).expect(200);
    const reports = await request(app).get('/api/analytics/saved-reports').set(asOutsider);
    const executed = await request(app)
      .post('/api/analytics/execute')
      .set(asOutsider)
      .send(plan)
      .expect(200);

    assert.deepEqual(
      businesses.body.data.map((b: { id: string }) => b.id),
      [outsider.businessId],
    );
    assert.equal(summary.body.kpis.totalSales, 0);
    assert.equal(summary.body.kpis.orders, 0);
    assert.deepEqual(products.body.data, []);
    assert.deepEqual(jobs.body.data, []);
    assert.deepEqual(reports.body.reports, []);
    assert.equal(JSON.stringify(executed.body).includes('SHOPIFY'), false);
  });
});
