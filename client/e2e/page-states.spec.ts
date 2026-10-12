import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, mockSignedInApi } from './support/app';

// Data fixtures are real API responses recorded from the seeded demo workspace.
type Fixtures = Record<string, unknown>;
type PageState = 'data' | 'empty' | 'error' | 'loading';

const demoApi = JSON.parse(
  readFileSync(new URL('./fixtures/demoApi.json', import.meta.url), 'utf8'),
) as Record<string, Record<string, unknown>>;

const EMPTY: Fixtures = {
  '/api/dashboard/summary': {
    range: { from: '2026-09-13', to: '2026-10-12' },
    kpis: {
      totalSales: 0,
      grossProfit: 0,
      grossMarginPct: 0,
      orders: 0,
      averageOrderValue: 0,
      unitsSold: 0,
      lowStockItems: 0,
      slowMovers: 0,
    },
  },
  '/api/dashboard/sales-trend': { interval: 'day', points: [] },
  '/api/dashboard/channel-breakdown': { channels: [] },
  '/api/inventory/insights': {
    ...demoApi['/api/inventory/insights'],
    summary: {
      lowStock: 0,
      stockoutRisk: 0,
      slowMovers: 0,
      deadStock: 0,
      reorderSoon: 0,
      discountCandidates: 0,
      overstocked: 0,
    },
    reorderSoon: [],
    lowStock: [],
    stockoutRisk: [],
    slowMovers: [],
    deadStock: [],
    discountCandidates: [],
    overstocked: [],
  },
  '/api/products/performance': {
    data: [],
    meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  },
};

type PageCase = {
  path: string;
  title: string;
  endpoints: string[];
  emptyText: string | RegExp;
  emptyOverrides?: Record<string, number>;
};

const PAGES: PageCase[] = [
  {
    path: '/dashboard',
    title: 'Dashboard',
    endpoints: [
      '/api/dashboard/summary',
      '/api/dashboard/sales-trend',
      '/api/dashboard/channel-breakdown',
      '/api/inventory/insights',
      '/api/products/performance',
    ],
    emptyText: '$0.00',
  },
  {
    path: '/inventory',
    title: 'Inventory',
    endpoints: ['/api/inventory/insights'],
    emptyText: 'No inventory risk detected for the current business.',
  },
  {
    path: '/reports/weekly',
    title: 'Reports',
    endpoints: ['/api/reports/weekly', '/api/products/performance'],
    emptyText: 'No weekly report yet',
    emptyOverrides: { '/api/reports/weekly': 404 },
  },
  {
    path: '/channels',
    title: 'Channels',
    endpoints: ['/api/dashboard/channel-breakdown'],
    emptyText: /No channel/,
  },
  {
    path: '/products',
    title: 'Products',
    endpoints: ['/api/products/performance'],
    emptyText: /No products/,
  },
];

async function mockPage(page: Page, pageCase: PageCase, state: PageState) {
  const fixtures = demoApi as Fixtures;

  await mockSignedInApi(page, async (route, path) => {
    if (!pageCase.endpoints.includes(path)) return false;

    if (state === 'loading') {
      // Hold responses long enough to audit the loading UI, then let the page finish.
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      await route.fulfill({ json: fixtures[path] });
      return true;
    }

    if (state === 'error') {
      await route.fulfill({
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Analytics service unavailable' } },
      });
      return true;
    }

    const overrideStatus = state === 'empty' ? pageCase.emptyOverrides?.[path] : undefined;
    if (overrideStatus) {
      await route.fulfill({
        status: overrideStatus,
        json: { error: { code: 'NOT_FOUND', message: 'Not found' } },
      });
      return true;
    }

    await route.fulfill({ json: state === 'empty' ? EMPTY[path] : fixtures[path] });
    return true;
  });
}

for (const pageCase of PAGES) {
  test.describe(`${pageCase.title} page at 375px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
    });

    test('renders seeded data accessibly without overflow', async ({ page }) => {
      await mockPage(page, pageCase, 'data');
      await page.goto(pageCase.path);

      await expect(page.getByRole('heading', { level: 1, name: pageCase.title })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page, `${pageCase.title} data`);
    });

    test('shows an accessible loading state', async ({ page }) => {
      await mockPage(page, pageCase, 'loading');
      await page.goto(pageCase.path);

      await expect(page.getByRole('heading', { level: 1, name: pageCase.title })).toBeVisible();
      await expect(page.locator('.animate-pulse, [role="status"]').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page, `${pageCase.title} loading`);
    });

    test('shows an empty state', async ({ page }) => {
      await mockPage(page, pageCase, 'empty');
      await page.goto(pageCase.path);

      await expect(page.getByText(pageCase.emptyText).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page, `${pageCase.title} empty`);
    });

    test('shows an error state', async ({ page }) => {
      await mockPage(page, pageCase, 'error');
      await page.goto(pageCase.path);

      await expect(page.getByRole('alert').first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectAccessible(page, `${pageCase.title} error`);
    });
  });
}

test.describe('Workspace page at 375px', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('lists businesses accessibly', async ({ page }) => {
    await mockSignedInApi(page, async () => false);
    await page.goto('/workspace');

    await expect(page.getByRole('heading', { level: 1, name: 'Workspace' })).toBeVisible();
    await expect(page.getByText('Auckland Demo Retail').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, 'Workspace data');
  });

  test('guides a new user with no businesses', async ({ page }) => {
    await mockSignedInApi(page, async (route, path) => {
      if (path !== '/api/businesses') return false;
      await route.fulfill({ json: { data: [] } });
      return true;
    });
    await page.goto('/workspace');

    await expect(page.getByText('No businesses yet.')).toBeVisible();
    await expectAccessible(page, 'Workspace empty');
  });

  test('shows an error when businesses cannot load', async ({ page }) => {
    await mockSignedInApi(page, async (route, path) => {
      if (path !== '/api/businesses') return false;
      await route.fulfill({
        status: 500,
        json: { error: { code: 'INTERNAL_ERROR', message: 'Workspace service unavailable' } },
      });
      return true;
    });
    await page.goto('/workspace');

    await expect(page.getByRole('alert').first()).toBeVisible();
    await expectAccessible(page, 'Workspace error');
  });
});

test.describe('desktop layout at 1440px', () => {
  for (const pageCase of PAGES) {
    test(`${pageCase.title} data state is accessible`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await mockPage(page, pageCase, 'data');
      await page.goto(pageCase.path);

      await expect(page.getByRole('heading', { level: 1, name: pageCase.title })).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectAccessible(page, `${pageCase.title} desktop`);
    });
  }

  test('Ask TillTally prompt state is accessible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockSignedInApi(page, async (route, path) => {
      if (path !== '/api/analytics/saved-reports') return false;
      await route.fulfill({ json: { reports: [] } });
      return true;
    });
    await page.goto('/analytics');

    await expect(page.getByRole('heading', { level: 1, name: 'Ask TillTally' })).toBeVisible();
    await expectAccessible(page, 'Ask TillTally desktop');
  });
});
