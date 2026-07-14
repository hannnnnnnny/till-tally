import { expect, test, type Page } from '@playwright/test';

const DESKTOP_VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

for (const viewport of DESKTOP_VIEWPORTS) {
  test(`keeps the full hero preview visible at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/till-tally/');

    const preview = page.getByTestId('hero-dashboard-backdrop');
    const clippingArea = page.getByTestId('hero-dashboard-clip');

    await expect(preview).toBeVisible();
    await expect(clippingArea).toBeVisible();

    const previewBox = await preview.boundingBox();
    const clippingBox = await clippingArea.boundingBox();

    expect(previewBox).not.toBeNull();
    expect(clippingBox).not.toBeNull();

    if (!previewBox || !clippingBox) {
      throw new Error('Hero preview geometry was unavailable');
    }

    expect(previewBox.x).toBeGreaterThanOrEqual(clippingBox.x);
    expect(previewBox.y).toBeGreaterThanOrEqual(clippingBox.y);
    expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(
      clippingBox.x + clippingBox.width + 0.5,
    );
    expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(
      clippingBox.y + clippingBox.height + 0.5,
    );

    await expectNoHorizontalOverflow(page);
  });
}

test('hides the decorative preview without mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/till-tally/');

  await expect(page.getByTestId('hero-dashboard-backdrop')).toBeHidden();
  await expectNoHorizontalOverflow(page);
});

async function expectNoHorizontalOverflow(page: Page) {
  const documentWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));

  expect(documentWidth.scroll).toBeLessThanOrEqual(documentWidth.client);
}
