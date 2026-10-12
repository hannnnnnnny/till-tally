import { expect, test, type Page } from '@playwright/test';

// Seeded by server/prisma/seed.ts; local disposable test database only.
const DEMO_EMAIL = 'demo@tilltally.local';
const DEMO_PASSWORD = 'DemoPass123!';

function yesterdayIso(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

function newOrdersCsv(runId: string): string {
  const date = yesterdayIso();

  return [
    'order_number,order_date,channel,total_amount,discount_amount,customer_region,sku,quantity,unit_price,total_price,cost_price',
    `E2E-${runId}-1,${date},Shopify,89.90,0.00,Auckland,WJ-001,1,89.90,89.90,38.00`,
    `E2E-${runId}-2,${date},In-store,45.00,0.00,Wellington,HM-002,2,22.50,45.00,10.00`,
  ].join('\n');
}

async function readRevenueKpi(page: Page): Promise<number> {
  await page.goto('/dashboard');
  const revenueCard = page.getByRole('link').filter({ hasText: /^Revenue/ });
  const value = await revenueCard.locator('p.tabular-nums').innerText();

  return Number(value.replace(/[^0-9.]/g, ''));
}

async function signIn(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email').fill(DEMO_EMAIL);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function importOrders(page: Page, csv: string) {
  await page.goto('/imports');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.locator('#csv-file').setInputFiles({
    name: 'new-orders.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText('All mapped rows passed preflight validation.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import' }).click();
  const imported = page.getByRole('definition').filter({
    has: page.locator('xpath=preceding-sibling::dt[normalize-space()="Imported"]'),
  });
  await expect(imported).toHaveText('2');
}

async function askPlannerAndSave(page: Page, reportName: string) {
  await page.goto('/analytics');
  await page
    .getByLabel('Business analytics question')
    .fill('Show revenue by channel for the last 30 days');
  await page.getByRole('button', { name: 'Review question' }).click();
  await expect(page.getByLabel('Group by')).toHaveValue('channel');
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByRole('img', { name: /Bar chart/ })).toBeVisible();

  await page.getByRole('button', { name: 'Save report' }).click();
  await page.getByLabel('Report name').fill(reportName);
  await page.getByRole('dialog').getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByText(`Saved "${reportName}" as version 1`)).toBeVisible();
}

test('imports a CSV, sees KPIs move, asks the planner and keeps the saved report', async ({
  page,
}) => {
  const runId = String(Date.now());
  const reportName = `Channel revenue ${runId}`;

  await signIn(page);
  const revenueBefore = await readRevenueKpi(page);

  await importOrders(page, newOrdersCsv(runId));
  const revenueAfter = await readRevenueKpi(page);
  expect(Math.round((revenueAfter - revenueBefore) * 100) / 100).toBe(134.9);

  await askPlannerAndSave(page, reportName);

  await page.reload();
  await page.getByRole('button', { name: /Saved reports/ }).click();
  await expect(page.getByRole('article').filter({ hasText: reportName })).toBeVisible();
});
