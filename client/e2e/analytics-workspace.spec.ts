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

const dailyPlan = {
  ...readyPlan,
  metrics: ['revenue', 'grossProfit'],
  dimensions: ['day'],
  filters: [],
  sort: [{ field: 'day', direction: 'asc' }],
  chart: { type: 'line' },
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

  await expect(page.getByRole('img', { name: /Bar chart for Revenue and margin/ })).toBeVisible();
  const unavailableLine = page.getByRole('button', { name: 'Line chart' });
  await expect(unavailableLine).toHaveAttribute('aria-disabled', 'true');
  await unavailableLine.focus();
  await expect(unavailableLine).toBeFocused();
  const marginSeries = page.getByRole('button', { name: 'Gross margin series' });
  await marginSeries.click();
  await expect(marginSeries).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'Donut chart' }).click();
  await expect(page.getByRole('img', { name: /Donut chart of Revenue/ })).toBeVisible();
  await expect(page.getByLabel('Donut metric')).toHaveCount(0);

  await page.getByRole('button', { name: 'Data table' }).click();
  await expect(page.getByRole('cell', { name: '$42,800.00' })).toBeVisible();
  await expect(page.getByRole('region', { name: /Exact values/ })).toHaveAttribute('tabindex', '0');

  const primaryNav = page.getByRole('navigation', { name: 'Primary' }).last();
  await expect(primaryNav.getByRole('link', { name: 'Ask TillTally' })).toBeVisible();
  const targetHeights = await primaryNav
    .locator('a, button')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(targetHeights.every((height) => height >= 44)).toBe(true);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/analytics-mobile.png', fullPage: true });
});

test('switches a temporal report between line, bar, and exact values', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/analytics');

  await page.getByLabel('Business analytics question').fill('Show daily revenue this month');
  await page.getByRole('button', { name: 'Review question' }).click();
  await expect(page.getByLabel('Group by')).toHaveValue('day');
  await page.getByRole('button', { name: 'Run analysis' }).click();

  await expect(
    page.getByRole('img', { name: /Line chart for Revenue and gross profit by day/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Donut chart' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.getByRole('button', { name: 'Bar chart' }).click();
  await expect(
    page.getByRole('img', { name: /Bar chart for Revenue and gross profit by day/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Data table' }).click();
  await expect(page.getByRole('cell', { name: '$12,400.00' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/analytics-result-desktop.png', fullPage: true });
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

test('saves, refines, versions, manages, and exports a report on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/analytics');

  await page.getByLabel('Business analytics question').fill('Show daily revenue this month');
  await page.getByRole('button', { name: 'Review question' }).click();
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByRole('button', { name: 'Save report' })).toBeVisible();

  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByRole('dialog', { name: 'Save this report' })).toBeVisible();
  await page.getByLabel('Report name').fill('Daily revenue pulse');
  await page.getByRole('dialog').getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByText(/Saved "Daily revenue pulse" as version 1/)).toBeVisible();

  await page.getByRole('button', { name: /Saved reports/ }).click();
  const originalReport = page.getByRole('article').filter({ hasText: 'Daily revenue pulse' });
  await expect(originalReport.getByText('Current')).toBeVisible();
  await originalReport.getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('Report name').fill('Revenue pulse');
  await page.getByRole('dialog').getByRole('button', { name: 'Rename report' }).click();
  await expect(page.getByRole('article').filter({ hasText: 'Revenue pulse' })).toBeVisible();

  await page
    .getByRole('article')
    .filter({ hasText: 'Revenue pulse' })
    .getByRole('button', { name: 'Duplicate' })
    .click();
  const duplicate = page.getByRole('article').filter({ hasText: 'Revenue pulse copy' });
  await expect(duplicate).toBeVisible();
  await page.screenshot({
    path: 'test-results/analytics-saved-library-mobile.png',
    fullPage: true,
  });
  await duplicate.getByRole('button', { name: 'Delete' }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete saved report?' });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Delete report' }).click();
  await expect(duplicate).toHaveCount(0);

  await page.getByRole('button', { name: 'Close saved reports' }).click();
  await page.getByRole('button', { name: 'Refine report' }).click();
  await page.getByLabel('Business analytics question').fill('Show the top 8 as a table instead');
  await page.getByRole('button', { name: 'Review refinement' }).click();
  await expect(page.getByLabel('Row limit')).toHaveValue('8');
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await page.getByRole('button', { name: 'Save new version' }).click();
  await expect(page.getByText(/Saved version 2 of "Revenue pulse"/)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/revenue-and-gross-profit-by-day-2026-07-19\.csv/);

  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/analytics-saved-mobile.png', fullPage: true });

  await page.getByRole('button', { name: 'New question' }).click();
  await page.getByLabel('Business analytics question').fill('Show daily revenue this month');
  await page.getByRole('button', { name: 'Review question' }).click();
  await page.getByRole('button', { name: 'Run analysis' }).click();
  await expect(page.getByRole('button', { name: 'Save report' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save new version' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

async function mockAnalyticsApi(page: Page) {
  let providerFailureCount = 0;
  let savedReportSequence = 0;
  const savedReports: Array<ReturnType<typeof createSavedReport>> = [];

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
      const body = route.request().postDataJSON() as {
        question: string;
        currentPlan?: typeof readyPlan;
      };

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

      const planned = body.currentPlan
        ? { ...body.currentPlan, limit: 8, chart: { type: 'table' } }
        : /daily/i.test(body.question)
          ? dailyPlan
          : readyPlan;
      await route.fulfill({ json: createReadyPlanningResult(planned) });
      return;
    }

    if (path === '/api/analytics/saved-reports') {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { reports: savedReports } });
        return;
      }

      const body = route.request().postDataJSON() as {
        name: string;
        plan: typeof readyPlan;
        source: 'local' | 'provider';
      };
      const report = createSavedReport(`report-${++savedReportSequence}`, body.name, body.plan);
      savedReports.unshift(report);
      await route.fulfill({ status: 201, json: report });
      return;
    }

    const savedReportMatch = path.match(/^\/api\/analytics\/saved-reports\/([^/]+)(.*)$/);
    if (savedReportMatch) {
      const reportId = decodeURIComponent(savedReportMatch[1] ?? '');
      const suffix = savedReportMatch[2] ?? '';
      const reportIndex = savedReports.findIndex(({ id }) => id === reportId);
      const report = savedReports[reportIndex];
      if (!report) {
        await route.fulfill({
          status: 404,
          json: { error: { message: 'Saved report not found' } },
        });
        return;
      }

      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as { name: string };
        report.name = body.name;
        report.updatedAt = '2026-07-19T13:00:00.000Z';
        await route.fulfill({ json: report });
        return;
      }

      if (route.request().method() === 'DELETE') {
        savedReports.splice(reportIndex, 1);
        await route.fulfill({ status: 204, body: '' });
        return;
      }

      if (suffix === '/duplicate') {
        const copy = createSavedReport(
          `report-${++savedReportSequence}`,
          `${report.name} copy`,
          report.latestVersion.plan,
        );
        savedReports.unshift(copy);
        await route.fulfill({ status: 201, json: copy });
        return;
      }

      if (suffix === '/versions') {
        const body = route.request().postDataJSON() as { plan: typeof readyPlan };
        report.currentVersion += 1;
        report.latestVersion = {
          ...report.latestVersion,
          version: report.currentVersion,
          plan: body.plan,
        };
        report.versions.unshift({
          version: report.currentVersion,
          schemaVersion: 1,
          source: 'provider',
          createdAt: '2026-07-19T14:00:00.000Z',
        });
        await route.fulfill({ status: 201, json: report });
        return;
      }

      await route.fulfill({ json: report });
      return;
    }

    if (path === '/api/analytics/preview') {
      const plan = route.request().postDataJSON() as typeof readyPlan;
      await route.fulfill({ json: createPreview(plan) });
      return;
    }

    if (path === '/api/analytics/execute') {
      const plan = route.request().postDataJSON() as typeof readyPlan;
      await route.fulfill({ json: createExecutionResult(plan) });
      return;
    }

    await route.fulfill({ status: 404, json: { error: 'Not mocked' } });
  });
}

function createSavedReport(id: string, name: string, plan: typeof readyPlan) {
  return {
    id,
    name,
    currentVersion: 1,
    compatible: true,
    compatibilityMessage: null,
    latestVersion: {
      version: 1,
      schemaVersion: 1,
      source: 'provider' as const,
      plan,
      createdAt: '2026-07-19T12:00:00.000Z',
    },
    versions: [
      {
        version: 1,
        schemaVersion: 1,
        source: 'provider' as const,
        createdAt: '2026-07-19T12:00:00.000Z',
      },
    ],
    createdAt: '2026-07-19T12:00:00.000Z',
    updatedAt: '2026-07-19T12:00:00.000Z',
  };
}

function createBusiness(id: string, name: string) {
  return { id, name, industry: 'Retail', city: 'Auckland', role: 'OWNER' };
}

function createReadyPlanningResult(plan = readyPlan) {
  return {
    status: 'ready',
    source: 'provider',
    message: `A bounded ${plan.chart.type} report for the selected period.`,
    plan,
  };
}

function createPreview(plan = readyPlan) {
  const isDaily = plan.dimensions.includes('day');
  return {
    plan,
    title: isDaily ? 'Revenue and gross profit by day' : 'Revenue and margin by channel',
    datasets: ['orders'],
    table: {
      columns: isDaily
        ? [
            { key: 'day', label: 'Day', kind: 'dimension', unit: null },
            { key: 'revenue', label: 'Revenue', kind: 'metric', unit: 'NZD' },
            { key: 'grossProfit', label: 'Gross profit', kind: 'metric', unit: 'NZD' },
          ]
        : [
            { key: 'channel', label: 'Channel', kind: 'dimension', unit: null },
            { key: 'revenue', label: 'Revenue', kind: 'metric', unit: 'NZD' },
            { key: 'grossMarginPct', label: 'Gross margin', kind: 'metric', unit: 'percent' },
          ],
    },
    chart: { type: plan.chart.type, categoryKey: isDaily ? 'day' : 'channel' },
  };
}

function createExecutionResult(plan = readyPlan) {
  const preview = createPreview(plan);
  const isDaily = plan.dimensions.includes('day');
  const rows = isDaily
    ? [
        { day: '2026-07-01', revenue: 12_400, grossProfit: 5_100 },
        { day: '2026-07-02', revenue: 13_800, grossProfit: 5_700 },
        { day: '2026-07-03', revenue: 11_900, grossProfit: 4_800 },
        { day: '2026-07-04', revenue: 15_200, grossProfit: 6_400 },
      ]
    : [
        { channel: 'Shopify', revenue: 42_800, grossMarginPct: 44.2 },
        { channel: 'In store', revenue: 24_100, grossMarginPct: 39.8 },
      ];
  const metricColumns = preview.table.columns.filter(({ kind }) => kind === 'metric');
  const dimensionKey = isDaily ? 'day' : 'channel';

  return {
    ...preview,
    table: {
      ...preview.table,
      rows,
    },
    chart: {
      ...preview.chart,
      series: metricColumns.map((column) => ({
        key: column.key,
        label: column.label,
        unit: column.unit,
        data: rows.map((row) => ({
          category: String(row[dimensionKey as keyof typeof row]),
          value: Number(row[column.key as keyof typeof row]),
        })),
      })),
    },
    meta: {
      rowCount: rows.length,
      totalRows: rows.length,
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
