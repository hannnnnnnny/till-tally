import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type Route } from '@playwright/test';

export const BUSINESS_ID = 'business-1';

export type ApiHandler = (route: Route, path: string, method: string) => Promise<boolean>;

// Signed-in shell plus page-specific handlers; anything unhandled is a loud 404.
export async function mockSignedInApi(page: Page, handler: ApiHandler): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname === '/api/auth/refresh') {
      await route.fulfill({ json: { accessToken: 'e2e-access-token' } });
      return;
    }

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({
        json: { user: { id: 'user-1', name: 'Demo Owner', email: 'owner@example.com' } },
      });
      return;
    }

    if (url.pathname === '/api/businesses') {
      await route.fulfill({
        json: { data: [{ id: BUSINESS_ID, name: 'Auckland Demo Retail', role: 'OWNER' }] },
      });
      return;
    }

    if (await handler(route, url.pathname, method)) {
      return;
    }

    await route.fulfill({
      status: 404,
      json: { error: { code: 'NOT_FOUND', message: 'Not mocked' } },
    });
  });
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));

  expect(width.scroll).toBeLessThanOrEqual(width.client);
}

export async function expectAccessible(page: Page, state: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = result.violations.filter(
    ({ impact }) => impact === 'serious' || impact === 'critical',
  );
  const diagnostics = blocking
    .map(
      ({ id, help, nodes }) => `${id}: ${help}; ${nodes.map((n) => n.target.join(' ')).join(', ')}`,
    )
    .join('\n');

  expect(blocking, `${state} accessibility violations\n${diagnostics}`).toEqual([]);
}
