import { ImportStatus, ImportType, PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { buildDemoDataset, lastCompleteWeekStart, type DemoDataset } from '../src/db/demoDataset';
import { assertSeedIsAllowed } from '../src/db/seedSafety';
import { generateWeeklyReport } from '../src/reports/weeklyReportService';

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

async function main() {
  assertSeedIsAllowed();

  // Generated relative to today so dashboards, risk rules and weekly reports always have data.
  const seededAt = new Date();
  const dataset = buildDemoDataset(seededAt);
  const businessId = await resetDemoBusiness();
  const productIdsBySku = await seedProducts(businessId, dataset, seededAt);

  await seedOrders(businessId, dataset, productIdsBySku, seededAt);
  await seedSnapshots(dataset, productIdsBySku);
  await generateWeeklyReport(businessId, { weekStart: lastCompleteWeekStart(seededAt) }, prisma);

  console.info(
    `Seeded ${DEMO_BUSINESS.name} for ${DEMO_USER.email}: ` +
      `${dataset.products.length} products, ${dataset.orders.length} orders`,
  );
  console.info(`Demo password: ${DEMO_USER.password}`);
}

async function resetDemoBusiness(): Promise<string> {
  const passwordHash = await hashPassword(DEMO_USER.password);
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: { name: DEMO_USER.name, passwordHash },
    create: { name: DEMO_USER.name, email: DEMO_USER.email, passwordHash },
  });

  await prisma.business.deleteMany({ where: { ownerId: user.id, name: DEMO_BUSINESS.name } });

  const business = await prisma.business.create({
    data: {
      ownerId: user.id,
      ...DEMO_BUSINESS,
      members: { create: { userId: user.id, role: Role.OWNER } },
    },
  });

  return business.id;
}

async function seedProducts(
  businessId: string,
  dataset: DemoDataset,
  seededAt: Date,
): Promise<Map<string, string>> {
  const importJobId = await createImportJob(
    businessId,
    'demo-products.csv',
    ImportType.PRODUCTS,
    dataset.products.length,
    new Date(seededAt.getTime() - 60_000),
  );
  const productIdsBySku = new Map<string, string>();

  for (const product of dataset.products) {
    const created = await prisma.product.create({
      data: { businessId, importJobId, ...product },
    });
    productIdsBySku.set(created.sku, created.id);
  }

  return productIdsBySku;
}

async function seedOrders(
  businessId: string,
  dataset: DemoDataset,
  productIdsBySku: Map<string, string>,
  seededAt: Date,
): Promise<void> {
  const importJobId = await createImportJob(
    businessId,
    'demo-orders.csv',
    ImportType.ORDERS,
    dataset.orders.length,
    seededAt,
  );

  for (const { items, ...order } of dataset.orders) {
    await prisma.order.create({
      data: {
        businessId,
        importJobId,
        ...order,
        items: {
          create: items.map((item) => ({
            ...item,
            productId: productIdsBySku.get(item.sku) ?? null,
          })),
        },
      },
    });
  }
}

async function seedSnapshots(
  dataset: DemoDataset,
  productIdsBySku: Map<string, string>,
): Promise<void> {
  await prisma.inventorySnapshot.createMany({
    data: dataset.snapshots.flatMap(({ sku, stockQuantity, snapshotDate }) => {
      const productId = productIdsBySku.get(sku);
      return productId ? [{ productId, stockQuantity, snapshotDate }] : [];
    }),
  });
}

async function createImportJob(
  businessId: string,
  fileName: string,
  importType: ImportType,
  rows: number,
  createdAt: Date,
): Promise<string> {
  const job = await prisma.importJob.create({
    data: {
      businessId,
      fileName,
      importType,
      status: ImportStatus.COMPLETED,
      rowsTotal: rows,
      rowsImported: rows,
      rowsFailed: 0,
      createdAt,
    },
  });

  return job.id;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
