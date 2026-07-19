import { expect, test, type Page } from '@playwright/test';

test('walks the demo from landing to a saved analytics report on mobile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Demo mode notice')).toBeVisible();

  await page.getByRole('button', { name: 'Try the live demo' }).first().click();
  await expect(page.getByRole('heading', { name: 'Performance overview' })).toBeVisible();

  // Seeded sample data must produce non-zero KPIs or the demo looks broken.
  const revenueCard = page.getByRole('link', { name: /^Revenue \$/ });
  await expect(revenueCard).toBeVisible();
  await expect(revenueCard).not.toContainText('$0.00');
  await expectNoHorizontalOverflow(page);

  await page.getByRole('link', { name: 'Ask TillTally' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ask TillTally' })).toBeVisible();

  const presetQuestion = 'Show daily revenue this month';
  await page.getByRole('button', { name: presetQuestion }).click();
  await expect(page.getByLabel('Business analytics question')).toHaveValue(presetQuestion);
  await page.getByRole('button', { name: 'Review question' }).click();
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByRole('button', { name: 'Save report' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByRole('dialog', { name: 'Save this report' })).toBeVisible();
  await page.getByLabel('Report name').fill('Demo smoke report');
  await page.getByRole('dialog').getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByText(/Saved "Demo smoke report"/)).toBeVisible();

  // Saved reports and the session both live in localStorage: a reload must
  // come back signed in with the report still present.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Ask TillTally' })).toBeVisible();
  await page.getByRole('button', { name: /Saved reports/ }).click();
  await expect(page.getByRole('article').filter({ hasText: 'Demo smoke report' })).toBeVisible();
  await expect(page.getByRole('article').filter({ hasText: 'Daily revenue pulse' })).toBeVisible();
});

test('supports the pre-filled login path and free-form clarification', async ({ page }) => {
  await page.goto('/#/auth');
  await expect(page.getByText('Demo workspace credentials are pre-filled')).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Performance overview' })).toBeVisible();

  await page.getByRole('link', { name: 'Ask TillTally' }).first().click();
  await page.getByLabel('Business analytics question').fill('What should I stock for winter?');
  await page.getByRole('button', { name: 'Review question' }).click();
  await expect(page.getByText(/What would you like to measure/)).toBeVisible();
});

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
}
