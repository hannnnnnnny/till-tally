import './setupIntegrationEnv';
import assert from 'node:assert/strict';
import path from 'node:path';
import { type Express } from 'express';
import request from 'supertest';
import { createApp } from '../createApp';
import { prisma } from '../db/prisma';

export const SAMPLE_DATA_DIR = path.resolve(__dirname, '../../../sample-data');

export type TestUser = { token: string; businessId: string };

let emailCounter = 0;

// Deletes in foreign-key order so no raw SQL is needed.
export async function resetDatabase(): Promise<void> {
  await prisma.savedReportVersion.deleteMany();
  await prisma.savedReport.deleteMany();
  await prisma.weeklyReport.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.inventorySnapshot.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.businessMember.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();
}

export function createTestApp(): Express {
  return createApp();
}

export async function createUserWithBusiness(app: Express, label: string): Promise<TestUser> {
  emailCounter += 1;
  const registered = await request(app)
    .post('/api/auth/register')
    .send({
      name: `${label} Owner`,
      email: `${label.toLowerCase()}-${emailCounter}@integration.test`,
      password: 'IntegrationPass123!',
    })
    .expect(201);
  const token = registered.body.accessToken as string;
  const business = await request(app)
    .post('/api/businesses')
    .set('authorization', `Bearer ${token}`)
    .send({ name: `${label} Retail` })
    .expect(201);

  return { token, businessId: business.body.id as string };
}

export function authed(user: TestUser, businessId = user.businessId) {
  return {
    authorization: `Bearer ${user.token}`,
    'x-business-id': businessId,
  };
}

export async function importSampleCsv(
  app: Express,
  user: TestUser,
  kind: 'products' | 'orders',
  fileName: string,
): Promise<void> {
  const response = await request(app)
    .post(`/api/import/${kind}`)
    .set(authed(user))
    .attach('file', path.join(SAMPLE_DATA_DIR, fileName), {
      filename: fileName,
      contentType: 'text/csv',
    });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.rowsFailed, 0);
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
