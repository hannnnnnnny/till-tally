import { expect, test, type Page } from '@playwright/test';

const businessName =
  'Auckland Independent Retail Cooperative with an intentionally long workspace name';

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedApi(page);
});

test('keeps core navigation and product data usable at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/products');

  await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Active business' })).toHaveValue('business-1');
  const productList = page.getByRole('list', { name: 'Products' });
  await expect(productList).toBeVisible();
  await expect(page.getByRole('table')).toBeHidden();
  await expect(
    productList.getByRole('heading', { name: 'Premium Merino Travel Jacket' }),
  ).toBeVisible();

  const primaryNav = page.getByRole('navigation', { name: 'Primary' }).last();
  await expect(primaryNav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(primaryNav.getByRole('link', { name: 'Imports' })).toBeVisible();
  await expect(primaryNav.getByRole('link', { name: 'Products' })).toBeVisible();
  await expect(primaryNav.getByRole('link', { name: 'Inventory' })).toBeVisible();

  const moreButton = primaryNav.getByRole('button', { name: 'More' });
  await moreButton.click();

  const moreNav = page.getByRole('navigation', { name: 'More destinations' });
  await expect(moreNav).toBeVisible();
  await expect(moreNav.getByRole('link', { name: /Channels/ })).toBeFocused();
  await expect(moreNav.getByRole('link', { name: /Reports/ })).toBeVisible();
  await expect(moreNav.getByRole('link', { name: /Workspace/ })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(moreNav).toBeHidden();
  await expect(moreButton).toBeFocused();

  const touchTargetHeights = await primaryNav
    .locator('a, button')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(touchTargetHeights.every((height) => height >= 44)).toBe(true);

  const shellSpacing = await page.evaluate(() => {
    const main = document.querySelector('main');
    const nav = Array.from(document.querySelectorAll('nav')).find(
      (element) => getComputedStyle(element).position === 'fixed',
    );

    return {
      mainPaddingBottom: main ? Number.parseFloat(getComputedStyle(main).paddingBottom) : 0,
      navHeight: nav?.getBoundingClientRect().height ?? 0,
    };
  });

  expect(shellSpacing.mainPaddingBottom).toBeGreaterThanOrEqual(shellSpacing.navHeight);
  await expectNoHorizontalOverflow(page);
});

test('preserves the desktop sidebar and full product table', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/products');

  const primaryNav = page.getByRole('navigation', { name: 'Primary' }).first();
  await expect(primaryNav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'More' })).toBeHidden();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Products' })).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

async function mockAuthenticatedApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path === '/api/auth/refresh') {
      await route.fulfill({ json: { accessToken: 'e2e-access-token' } });
      return;
    }

    if (path === '/api/auth/me') {
      await route.fulfill({
        json: {
          user: { id: 'user-1', name: 'Mobile Test User', email: 'mobile@example.com' },
        },
      });
      return;
    }

    if (path === '/api/businesses') {
      await route.fulfill({
        json: {
          data: [
            {
              id: 'business-1',
              name: businessName,
              industry: 'Independent retail',
              city: 'Auckland',
              role: 'OWNER',
            },
          ],
        },
      });
      return;
    }

    if (path === '/api/products/performance') {
      await route.fulfill({
        json: {
          data: [
            {
              id: 'product-1',
              rank: 1,
              sku: 'MERINO-JACKET-LONG-SKU-001',
              name: 'Premium Merino Travel Jacket',
              category: 'Outerwear',
              vendor: 'Aotearoa Apparel Collective',
              unitsSold: 124,
              revenue: 18765.5,
              cost: 7200,
              grossProfit: 11565.5,
              grossMarginPct: 61.63,
              abcClass: 'A',
              revenueContributionPct: 38.2,
              cumulativeRevenuePct: 38.2,
              currentStock: 8,
              lastSoldAt: '2026-07-18',
              labels: ['Best Seller', 'Reorder Soon'],
            },
          ],
          meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        },
      });
      return;
    }

    await route.fulfill({ status: 404, json: { error: 'Not mocked' } });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const documentWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));

  expect(documentWidth.scroll).toBeLessThanOrEqual(documentWidth.client);
}
