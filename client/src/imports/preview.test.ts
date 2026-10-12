import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createCsvPreview,
  createDefaultColumnMapping,
  createMappedCsvFile,
  getMissingRequiredMappedFields,
} from './preview';

function csvFile(text: string, name = 'upload.csv'): File {
  return new File([text], name, { type: 'text/csv' });
}

describe('createCsvPreview', () => {
  it('detects a canonical orders export with high confidence', async () => {
    const preview = await createCsvPreview(
      csvFile('order_number,order_date,channel,total_amount\n1001,2026-06-01,Shopify,89.90\n'),
    );

    assert.equal(preview.detectedType, 'ORDERS');
    assert.equal(preview.confidence, 'high');
    assert.equal(preview.rowsTotal, 1);
  });

  it('detects orders from header aliases used by common POS exports', async () => {
    const preview = await createCsvPreview(
      csvFile('Order ID,Sale Date,Platform,Order Total\nA1,2026-06-01,Shopify,10\n'),
    );

    assert.equal(preview.detectedType, 'ORDERS');
    assert.equal(preview.confidence, 'high');
  });

  it('detects product and inventory exports', async () => {
    const products = await createCsvPreview(csvFile('SKU,Product Name,Unit Cost\nA,Mug,4\n'));
    const inventory = await createCsvPreview(
      csvFile('sku,stock_on_hand,count_date\nA,4,2026-06-01\n'),
    );

    assert.equal(products.detectedType, 'PRODUCTS');
    assert.equal(inventory.detectedType, 'INVENTORY');
  });

  it('returns UNKNOWN with low confidence for unrelated files', async () => {
    const preview = await createCsvPreview(csvFile('colour,size\nred,M\n'));

    assert.equal(preview.detectedType, 'UNKNOWN');
    assert.equal(preview.confidence, 'low');
  });

  it('reports medium confidence when only some required columns match', async () => {
    const preview = await createCsvPreview(
      csvFile('order_number,order_date,notes\n1,2026-06-01,x\n'),
    );

    assert.equal(preview.detectedType, 'ORDERS');
    assert.equal(preview.confidence, 'medium');
  });

  it('strips a byte-order mark, trims cells and pads ragged rows', async () => {
    const preview = await createCsvPreview(csvFile('﻿sku, name ,cost_price\n A1 ,Mug\n'));

    assert.deepEqual(preview.headers, ['sku', 'name', 'cost_price']);
    assert.deepEqual(preview.dataRows, [['A1', 'Mug', '']]);
  });

  it('limits preview rows while keeping every data row for import', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => `S${index},Item,1`).join('\n');
    const preview = await createCsvPreview(csvFile(`sku,name,cost_price\n${rows}\n`));

    assert.equal(preview.previewRows.length, 10);
    assert.equal(preview.dataRows.length, 25);
    assert.equal(preview.rowsTotal, 25);
  });

  it('rejects empty files', async () => {
    await assert.rejects(createCsvPreview(csvFile('  \n ')), /CSV file is empty/);
  });
});

describe('column mapping', () => {
  it('maps alias headers to canonical fields without reusing a header', async () => {
    const preview = await createCsvPreview(
      csvFile('Item SKU,Title,COGS,Supplier,Stock\nA,Mug,4,Local,3\n'),
    );

    assert.deepEqual(createDefaultColumnMapping(preview, 'PRODUCTS'), {
      sku: 'Item SKU',
      name: 'Title',
      cost_price: 'COGS',
      vendor: 'Supplier',
      current_stock: 'Stock',
    });
  });

  it('lists required fields that are still unmapped', () => {
    const missing = getMissingRequiredMappedFields({ sku: 'SKU' }, 'PRODUCTS');

    assert.deepEqual(
      missing.map((field) => field.key),
      ['name', 'cost_price'],
    );
  });
});

describe('createMappedCsvFile', () => {
  it('rewrites headers to canonical names in field order and keeps the file name', async () => {
    const preview = await createCsvPreview(
      csvFile('Cost,Title,SKU\n4,"Mug, large",A\n6,Plate,B\n', 'shop-export.csv'),
    );
    const file = createMappedCsvFile(preview, 'PRODUCTS', {
      sku: 'SKU',
      name: 'Title',
      cost_price: 'Cost',
    });

    assert.equal(file.name, 'shop-export.csv');
    assert.equal(file.type, 'text/csv');
    assert.equal(
      (await file.text()).replace(/\r\n/g, '\n'),
      'sku,name,cost_price\nA,"Mug, large",4\nB,Plate,6',
    );
  });

  it('includes only the selected row indexes when filtering invalid rows', async () => {
    const preview = await createCsvPreview(csvFile('sku,name,cost_price\nA,Mug,4\nB,Plate,x\n'));
    const file = createMappedCsvFile(
      preview,
      'PRODUCTS',
      { sku: 'sku', name: 'name', cost_price: 'cost_price' },
      { includedRowIndexes: new Set([0]) },
    );

    assert.equal((await file.text()).replace(/\r\n/g, '\n'), 'sku,name,cost_price\nA,Mug,4');
  });
});
