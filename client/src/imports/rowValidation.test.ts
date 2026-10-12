import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCsvPreview, createDefaultColumnMapping } from './preview';
import { validateMappedCsvRows } from './rowValidation';
import { type ImportMode } from './types';

const ORDER_HEADER =
  'order_number,order_date,channel,total_amount,discount_amount,sku,quantity,unit_price,total_price,cost_price';
const PRODUCT_HEADER = 'sku,name,cost_price,current_stock,last_sold_at';

async function validate(mode: ImportMode, header: string, rows: string[]) {
  const preview = await createCsvPreview(new File([`${header}\n${rows.join('\n')}\n`], 'x.csv'));
  return validateMappedCsvRows(preview, mode, createDefaultColumnMapping(preview, mode));
}

function issuesFor(result: Awaited<ReturnType<typeof validate>>, row: number) {
  return result.issues
    .filter((issue) => issue.row === row)
    .map((issue) => `${issue.severity}:${issue.column}:${issue.message}`);
}

describe('validateMappedCsvRows for orders', () => {
  it('accepts well-formed order rows with line items', async () => {
    const result = await validate('ORDERS', ORDER_HEADER, [
      '1001,2026-06-01,Shopify,89.90,5.00,WJ-001,1,89.90,89.90,38.00',
      '1002,2026-06-02,Trade Me,45.00,,,,,,',
    ]);

    assert.deepEqual(result.issues, []);
    assert.equal(result.validRows, 2);
    assert.equal(result.importableRows, 2);
  });

  it('reports errors against the spreadsheet row number and column', async () => {
    const result = await validate('ORDERS', ORDER_HEADER, [
      '1001,2026-06-01,Shopify,10,,,,,,',
      ',06/02/2026,Shopify,-1,abc,,,,,',
    ]);

    assert.deepEqual(issuesFor(result, 3), [
      'error:order_number:Required value is missing',
      'error:order_date:Date must use YYYY-MM-DD format',
      'error:total_amount:Value must be greater than or equal to 0',
      'error:discount_amount:Value must be a number',
    ]);
    assert.deepEqual([...result.failedRowIndexes], [1]);
    assert.deepEqual([...result.importableRowIndexes], [0]);
  });

  it('rejects impossible calendar dates', async () => {
    const result = await validate('ORDERS', ORDER_HEADER, ['1001,2026-02-30,Shopify,10,,,,,,']);

    assert.deepEqual(issuesFor(result, 2), ['error:order_date:Date is invalid']);
  });

  it('flags duplicate order numbers as errors', async () => {
    const result = await validate('ORDERS', ORDER_HEADER, [
      '1001,2026-06-01,Shopify,10,,,,,,',
      '1001,2026-06-02,Shopify,12,,,,,,',
    ]);

    assert.deepEqual(issuesFor(result, 3), ['error:order_number:Duplicate order number']);
  });

  it('warns about unknown channels and mismatched line totals without failing the row', async () => {
    const result = await validate('ORDERS', ORDER_HEADER, [
      '1001,2026-06-01,Etsy,20,,A,2,9.00,20.00,4',
    ]);

    assert.deepEqual(issuesFor(result, 2), [
      'warning:channel:Unknown channel "Etsy" will be mapped to OTHER',
      'warning:total_price:total_price does not match quantity * unit_price (18.00)',
    ]);
    assert.equal(result.warningRows, 1);
    assert.equal(result.failedRows, 0);
    assert.equal(result.importableRows, 1);
  });

  it('requires complete line items once any item column is present', async () => {
    const result = await validate('ORDERS', ORDER_HEADER, ['1001,2026-06-01,Shopify,10,,A,0,,,']);

    assert.deepEqual(issuesFor(result, 2), [
      'error:quantity:Value must be greater than 0',
      'error:unit_price:Required value is missing',
      'error:total_price:Required value is missing',
      'error:cost_price:Required value is missing',
    ]);
  });
});

describe('validateMappedCsvRows for products', () => {
  it('rejects fractional stock and warns about duplicate SKUs', async () => {
    const result = await validate('PRODUCTS', PRODUCT_HEADER, [
      'A,Mug,4,2.5,',
      'B,Plate,3,1,2026-06-31',
      'B,Plate copy,3,1,',
    ]);

    assert.deepEqual(issuesFor(result, 2), ['error:current_stock:Value must be a whole number']);
    assert.deepEqual(issuesFor(result, 3), ['error:last_sold_at:Date is invalid']);
    assert.deepEqual(issuesFor(result, 4), [
      'warning:sku:Duplicate SKU in CSV; row will be skipped by the importer',
    ]);
    assert.equal(result.failedRows, 2);
    assert.equal(result.warningRows, 1);
    assert.equal(result.validRows, 0);
  });
});
