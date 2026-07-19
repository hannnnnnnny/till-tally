import { expect, test, type Page } from '@playwright/test';

const DESKTOP_VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

for (const viewport of DESKTOP_VIEWPORTS) {
  test(`keeps the centered hero visible at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const heroHeading = page.getByRole('heading', {
      name: 'TillTally',
      level: 1,
    });

    const previewButton = page.getByRole('link', {
      name: 'View dashboard preview',
    });

    await expect(heroHeading).toBeVisible();
    await expect(previewButton).toBeVisible();

    // The decorative dashboard was removed from the hero section.
    await expect(page.getByTestId('hero-dashboard-backdrop')).toHaveCount(0);
    await expect(page.getByTestId('hero-dashboard-clip')).toHaveCount(0);

    const headingBox = await heroHeading.boundingBox();

    expect(headingBox).not.toBeNull();

    if (!headingBox) {
      throw new Error('Hero heading geometry was unavailable');
    }

    expect(headingBox.x).toBeGreaterThanOrEqual(0);
    expect(headingBox.y).toBeGreaterThanOrEqual(0);
    expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(viewport.width);
    expect(headingBox.y + headingBox.height).toBeLessThanOrEqual(viewport.height);

    await expectNoHorizontalOverflow(page);
  });
}

test('keeps the centered hero usable without mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'TillTally',
      level: 1,
    }),
  ).toBeVisible();

  await expect(page.getByRole('link', { name: 'View dashboard preview' })).toBeVisible();

  await expect(page.getByTestId('hero-dashboard-backdrop')).toHaveCount(0);
  await expect(page.getByTestId('hero-dashboard-clip')).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
});

async function expectNoHorizontalOverflow(page: Page) {
  const documentWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));

  expect(documentWidth.scroll).toBeLessThanOrEqual(documentWidth.client);
}
