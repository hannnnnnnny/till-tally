import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalOverflow, mockSignedInApi } from './support/app';

const PRODUCTS_WITH_BAD_ROW = [
  'Item SKU,Title,COGS,Stock',
  'WJ-001,Women Jacket,38.00,5',
  'HM-002,Mug Set,not-a-price,20',
  'TS-004,T-shirt,12.00,3',
].join('\n');

type ImportState = { uploadedCsv: string | null; failUpload: boolean };

async function mockImportsApi(page: Page, state: ImportState) {
  await mockSignedInApi(page, async (route, path, method) => {
    if (path === '/api/import/jobs' && method === 'GET') {
      await route.fulfill({
        json: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      });
      return true;
    }

    if (path === '/api/import/products' && method === 'POST') {
      state.uploadedCsv = route.request().postData();

      if (state.failUpload) {
        await route.fulfill({
          status: 500,
          json: { error: { code: 'INTERNAL_ERROR', message: 'Import service unavailable' } },
        });
        return true;
      }

      await route.fulfill({
        status: 201,
        json: {
          jobId: 'job-1',
          importType: 'PRODUCTS',
          status: 'COMPLETED',
          rowsTotal: 2,
          rowsImported: 2,
          rowsFailed: 0,
          errors: [],
          warnings: [],
        },
      });
      return true;
    }

    return false;
  });
}

async function chooseCsv(page: Page, contents: string) {
  await page.locator('#csv-file').setInputFiles({
    name: 'shop-products.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(contents),
  });
}

test('previews, maps aliases, reviews rows and imports only valid rows at 375px', async ({
  page,
}) => {
  const state: ImportState = { uploadedCsv: null, failUpload: false };
  await mockImportsApi(page, state);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/imports');

  await expect(page.getByRole('heading', { level: 2, name: 'CSV imports' })).toBeVisible();
  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await chooseCsv(page, PRODUCTS_WITH_BAD_ROW);

  await expect(page.getByRole('heading', { name: 'shop-products.csv' })).toBeVisible();
  await expect(page.getByText('3 rows checked')).toBeVisible();
  await expect(page.getByText('1 failed rows need a decision before import.')).toBeVisible();
  const issueRow = page.getByRole('row').filter({ hasText: 'Value must be a number' });
  await expect(issueRow).toContainText('3');
  await expect(issueRow).toContainText('cost_price');
  await expect(page.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  await expectAccessible(page, 'row review');

  await page.getByRole('button', { name: 'Skip invalid rows' }).click();
  await page.getByRole('button', { name: 'Confirm import' }).click();

  await expect(page.getByText('Import result')).toBeVisible();
  expect(state.uploadedCsv).toContain('sku,name,cost_price,current_stock');
  expect(state.uploadedCsv).toContain('WJ-001,Women Jacket,38.00,5');
  expect(state.uploadedCsv).not.toContain('HM-002');
  await expectNoHorizontalOverflow(page);
});

test('corrects a failed row inline and imports the corrected value at 375px', async ({ page }) => {
  const state: ImportState = { uploadedCsv: null, failUpload: false };
  await mockImportsApi(page, state);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/imports');

  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await chooseCsv(page, PRODUCTS_WITH_BAD_ROW);
  await page.getByRole('button', { name: 'Fix row 3' }).click();

  const form = page.getByRole('form', { name: 'Correct row 3' });
  const costInput = form.getByLabel('Cost price');
  await expect(costInput).toHaveValue('not-a-price');
  await expect(costInput).toHaveAttribute('aria-invalid', 'true');
  await expect(costInput).toHaveAccessibleDescription('Value must be a number');
  await expectAccessible(page, 'row correction form');
  await expectNoHorizontalOverflow(page);

  await costInput.fill('10.00');
  await form.getByRole('button', { name: 'Save correction' }).click();

  await expect(page.getByText('All failed rows have been corrected.')).toBeVisible();
  await expect(page.getByText('All mapped rows passed preflight validation.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import' }).click();

  await expect(page.getByText('Import result')).toBeVisible();
  expect(state.uploadedCsv).toContain('HM-002,Mug Set,10.00,20');
  expect(state.uploadedCsv).not.toContain('not-a-price');
});

test('asks for confirmation before undoing corrections', async ({ page }) => {
  await mockImportsApi(page, { uploadedCsv: null, failUpload: false });
  await page.goto('/imports');

  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await chooseCsv(page, PRODUCTS_WITH_BAD_ROW);
  await page.getByRole('button', { name: 'Fix row 3' }).click();
  await page.getByRole('form', { name: 'Correct row 3' }).getByLabel('Cost price').fill('10.00');
  await page.getByRole('button', { name: 'Save correction' }).click();

  await page.getByRole('button', { name: 'Undo corrections (1)' }).click();
  await expect(page.getByText('Undo 1 corrected row?')).toBeVisible();
  await page.getByRole('button', { name: 'Keep' }).click();
  await expect(page.getByText('All failed rows have been corrected.')).toBeVisible();

  await page.getByRole('button', { name: 'Undo corrections (1)' }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('1 failed rows need a decision before import.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fix row 3' })).toBeVisible();
});

test('shows an error state when the import request fails', async ({ page }) => {
  const state: ImportState = { uploadedCsv: null, failUpload: true };
  await mockImportsApi(page, state);
  await page.goto('/imports');

  await page.getByRole('button', { name: 'Products', exact: true }).click();
  await chooseCsv(page, 'sku,name,cost_price\nA-100,Mug,4.00\n');
  await page.getByRole('button', { name: 'Confirm import' }).click();

  await expect(page.getByText('Import service unavailable')).toBeVisible();
  await expectAccessible(page, 'upload error');
});

test('explains that a non-CSV header row cannot be previewed', async ({ page }) => {
  await mockImportsApi(page, { uploadedCsv: null, failUpload: false });
  await page.goto('/imports');

  await chooseCsv(page, '   \n');

  await expect(page.getByText('CSV file is empty')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm import' })).toBeDisabled();
});
