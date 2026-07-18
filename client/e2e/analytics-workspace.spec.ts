import { expect, test, type Page, type Route } from '@playwright/test';

const readyPlan = {
  schemaVersion: 1,
  metrics: ['revenue', 'grossMarginPct'],
  dimensions: ['channel'],
  dateRange: {
    from: '2026-07-01',
    to: '2026-07-19',
    timezone: 'Pacific/Auckland',
  },
  filters: [],
  sort: [{ field: 'revenue', direction: 'desc' }],
  limit: 25,
  chart: { type: 'bar' },
};

test.beforeEach(async ({ page }) => {
  await mockAnalyticsApi(page);
});

test('reviews and runs a question on mobile without layout overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/analytics');

  await expect(page.getByRole('heading', { level: 1, name: 'Ask TillTally' })).toBeVisible();
  const question = page.getByLabel('Business analytics question');
  await question.fill('Compare revenue and gross margin by channel this month');
  await page.getByRole('button', { name: 'Review question' }).click();

  await expect(page.getByRole('heading', { name: 'Review before running' })).toBeVisible();
  await expect(page.getByText('AI-assisted draft')).toBeVisible();
  await expect(page.getByLabel('Metric 1')).toHaveValue('revenue');
  await expect(page.getByLabel('Group by')).toHaveValue('channel');

  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByRole('heading', { name: 'Revenue and margin by channel' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '$42,800.00' })).toBeVisible();

  const primaryNav = page.getByRole('navigation', { name: 'Primary' }).last();
  await expect(primaryNav.getByRole('link', { name: 'Ask TillTally' })).toBeVisible();
  const targetHeights = await primaryNav
    .locator('a, button')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(targetHeights.every((height) => height >= 44)).toBe(true);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/analytics-mobile.png', fullPage: true });
});

test('supports clarification, provider retry, cancellation, and business isolation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/analytics');
  const question = page.getByLabel('Business analytics question');

  await question.fill('Help me understand performance');
  await page.getByRole('button', { name: 'Review question' }).click();
  await expect(page.getByRole('heading', { name: 'Clarify the business question' })).toBeVisible();

  await question.fill('Trigger provider failure');
  await page.getByRole('button', { name: 'Review question' }).click();
  await expect(page.getByText('Ask TillTally could not complete the request')).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Review before running' })).toBeVisible();

  await page.getByRole('button', { name: 'New question' }).click();
  await question.fill('Slow revenue question');
  await page.getByRole('button', { name: 'Review question' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'Your plan will appear here' })).toBeVisible();

  await question.fill('Slow revenue question');
  await page.getByRole('button', { name: 'Review question' }).click();
  await page.getByRole('combobox', { name: 'Active business' }).selectOption('business-2');
  await page.waitForTimeout(1_100);
  await expect(page.getByRole('heading', { name: 'Your plan will appear here' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review before running' })).toBeHidden();

  await question.fill('Revenue by channel');
  await page.getByRole('button', { name: 'Review question' }).click();
  await expect(page.getByRole('heading', { name: 'Review before running' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Active business' }).selectOption('business-1');
  await expect(page.getByRole('heading', { name: 'Your plan will appear here' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review before running' })).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/analytics-desktop.png', fullPage: true });
});

async function mockAnalyticsApi(page: Page) {
  let providerFailureCount = 0;

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path === '/api/auth/refresh') {
      await route.fulfill({ json: { accessToken: 'e2e-access-token' } });
      return;
    }

    if (path === '/api/auth/me') {
      await route.fulfill({
        json: { user: { id: 'user-1', name: 'Analytics User', email: 'analytics@example.com' } },
      });
      return;
    }

    if (path === '/api/businesses') {
      await route.fulfill({
        json: {
          data: [
            createBusiness('business-1', 'Auckland Retail'),
            createBusiness('business-2', 'Wellington Retail'),
          ],
        },
      });
      return;
    }

    if (path === '/api/analytics/plan') {
      const body = route.request().postDataJSON() as { question: string };

      if (/help me/i.test(body.question)) {
        await route.fulfill({
          json: {
            status: 'clarification',
            source: 'local',
            message: 'Name a metric and how you want it grouped.',
            examples: ['Show revenue by channel this month'],
          },
        });
        return;
      }

      if (/provider failure/i.test(body.question) && providerFailureCount++ === 0) {
        await route.fulfill({
          status: 503,
          json: {
            error: { code: 'ANALYTICS_PLANNER_UNAVAILABLE', message: 'Planner unavailable' },
          },
        });
        return;
      }

      if (/slow/i.test(body.question)) {
        await fulfillAfterDelay(route, 1_000, createReadyPlanningResult());
        return;
      }

      await route.fulfill({ json: createReadyPlanningResult() });
      return;
    }

    if (path === '/api/analytics/preview') {
      await route.fulfill({ json: createPreview() });
      return;
    }

    if (path === '/api/analytics/execute') {
      await route.fulfill({ json: createExecutionResult() });
      return;
    }

    await route.fulfill({ status: 404, json: { error: 'Not mocked' } });
  });
}

function createBusiness(id: string, name: string) {
  return { id, name, industry: 'Retail', city: 'Auckland', role: 'OWNER' };
}

function createReadyPlanningResult() {
  return {
    status: 'ready',
    source: 'provider',
    message: 'Revenue and gross margin grouped by channel for the selected period.',
    plan: readyPlan,
  };
}

function createPreview() {
  return {
    plan: readyPlan,
    title: 'Revenue and margin by channel',
    datasets: ['orders'],
    table: {
      columns: [
        { key: 'channel', label: 'Channel', kind: 'dimension', unit: null },
        { key: 'revenue', label: 'Revenue', kind: 'metric', unit: 'NZD' },
        { key: 'grossMarginPct', label: 'Gross margin', kind: 'metric', unit: 'percent' },
      ],
    },
    chart: { type: 'bar', categoryKey: 'channel' },
  };
}

function createExecutionResult() {
  return {
    ...createPreview(),
    table: {
      ...createPreview().table,
      rows: [
        { channel: 'Shopify', revenue: 42_800, grossMarginPct: 44.2 },
        { channel: 'In store', revenue: 24_100, grossMarginPct: 39.8 },
      ],
    },
    chart: {
      ...createPreview().chart,
      series: [
        { key: 'revenue', label: 'Revenue', unit: 'NZD' },
        { key: 'grossMarginPct', label: 'Gross margin', unit: 'percent' },
      ],
    },
    meta: {
      rowCount: 2,
      totalRows: 2,
      truncated: false,
      durationMs: 18,
      executedAt: '2026-07-19T12:00:00.000Z',
    },
  };
}

async function fulfillAfterDelay(route: Route, delayMs: number, json: unknown): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  try {
    await route.fulfill({ json });
  } catch {
    // The browser can cancel the in-flight request before the delayed response is ready.
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
}
