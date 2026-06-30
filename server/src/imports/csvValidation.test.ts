import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SalesChannel } from '@prisma/client';
import { validateInventoryCsv, validateOrdersCsv, validateProductsCsv } from './csvValidation';

describe('csv validation service', () => {
  it('validates product rows and defaults optional stock values', () => {
    const result = validateProductsCsv(`sku,name,cost_price,category,vendor
WJ-001,Womens Jacket,38.50,Outerwear,Local Supplier`);

    assert.equal(result.rowsTotal, 1);
    assert.equal(result.errors.length, 0);
    assert.equal(result.validRows.length, 1);
    assert.deepEqual(result.validRows[0], {
      sourceRow: 2,
      sku: 'WJ-001',
      name: 'Womens Jacket',
      category: 'Outerwear',
      vendor: 'Local Supplier',
      costPrice: 38.5,
      currentStock: 0,
      lastSoldAt: null,
    });
  });

  it('maps product header aliases before validation', () => {
    const result = validateProductsCsv(`Product Name,Item SKU,Cost,Stock,Supplier,Last Sold,Product Category
Womens Jacket,WJ-001,38.50,12,Local Supplier,2026-06-20,Outerwear`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.validRows[0], {
      sourceRow: 2,
      sku: 'WJ-001',
      name: 'Womens Jacket',
      category: 'Outerwear',
      vendor: 'Local Supplier',
      costPrice: 38.5,
      currentStock: 12,
      lastSoldAt: '2026-06-20',
    });
  });

  it('reports missing required columns before validating rows', () => {
    const result = validateProductsCsv(`sku,name
WJ-001,Womens Jacket`);

    assert.equal(result.rowsTotal, 1);
    assert.equal(result.validRows.length, 0);
    assert.deepEqual(result.errors, [
      {
        row: 1,
        column: 'cost_price',
        message: 'Missing required column "cost_price"',
        severity: 'error',
      },
    ]);
  });

  it('validates orders, maps channel aliases, and rejects duplicate order numbers', () => {
    const result = validateOrdersCsv(`order_number,order_date,channel,total_amount,discount_amount
1001,2026-06-20,Trade Me,49.99,5
1001,2026-06-21,Shopify,25.00,0`);

    assert.equal(result.rowsTotal, 2);
    assert.equal(result.validRows.length, 1);
    assert.equal(result.validRows[0]?.channel, SalesChannel.TRADE_ME);
    assert.deepEqual(result.errors, [
      {
        row: 3,
        column: 'order_number',
        message: 'Duplicate order number',
        severity: 'error',
      },
    ]);
  });

  it('maps reordered order header aliases before validation', () => {
    const result = validateOrdersCsv(
      `Revenue,Sale Date,Platform,Order ID,Discount,Region,Item SKU,Qty,Price,Line Total,Item Cost
49.99,2026-06-20,TradeMe,1001,5,Auckland,WJ-001,2,10.00,20.00,4.50`,
    );

    assert.equal(result.errors.length, 0);
    assert.equal(result.validRows.length, 1);
    assert.deepEqual(result.validRows[0], {
      sourceRow: 2,
      orderNumber: '1001',
      orderDate: '2026-06-20',
      channel: SalesChannel.TRADE_ME,
      totalAmount: 49.99,
      discountAmount: 5,
      customerRegion: 'Auckland',
      item: {
        sku: 'WJ-001',
        quantity: 2,
        unitPrice: 10,
        totalPrice: 20,
        costPrice: 4.5,
      },
    });
  });

  it('maps unknown channels to OTHER with a warning', () => {
    const result = validateOrdersCsv(`order_number,order_date,channel,total_amount
1001,2026-06-20,Weekend Market,49.99`);

    assert.equal(result.errors.length, 0);
    assert.equal(result.validRows[0]?.channel, SalesChannel.OTHER);
    assert.deepEqual(result.warnings, [
      {
        row: 2,
        column: 'channel',
        message: 'Unknown channel "Weekend Market" mapped to OTHER',
        severity: 'warning',
      },
    ]);
  });

  it('validates optional order item fields and warns on total mismatch', () => {
    const result = validateOrdersCsv(
      `order_number,order_date,channel,total_amount,sku,quantity,unit_price,total_price,cost_price
1001,2026-06-20,Shopify,49.99,WJ-001,2,10.00,25.00,4.50
1002,2026-06-21,Shopify,12.50,WJ-002,0,12.50,12.50,7.00`,
    );

    assert.equal(result.rowsTotal, 2);
    assert.equal(result.validRows.length, 1);
    assert.equal(result.validRows[0]?.item?.quantity, 2);
    assert.deepEqual(result.errors, [
      {
        row: 3,
        column: 'quantity',
        message: 'Value must be greater than 0',
        severity: 'error',
      },
    ]);
    assert.deepEqual(result.warnings, [
      {
        row: 2,
        column: 'total_price',
        message: 'total_price does not match quantity * unit_price (20.00)',
        severity: 'warning',
      },
    ]);
  });

  it('maps inventory header aliases before validation', () => {
    const result = validateInventoryCsv(`Item SKU,On Hand,Count Date
WJ-001,12,2026-06-20`);

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.validRows[0], {
      sku: 'WJ-001',
      stockQuantity: 12,
      snapshotDate: '2026-06-20',
    });
  });

  it('validates inventory snapshot rows', () => {
    const result = validateInventoryCsv(`sku,stock_quantity,snapshot_date
WJ-001,12,2026-06-20
WJ-002,-1,2026-06-31`);

    assert.equal(result.rowsTotal, 2);
    assert.equal(result.validRows.length, 1);
    assert.deepEqual(result.validRows[0], {
      sku: 'WJ-001',
      stockQuantity: 12,
      snapshotDate: '2026-06-20',
    });
    assert.deepEqual(result.errors, [
      {
        row: 3,
        column: 'stock_quantity',
        message: 'Value must be greater than or equal to 0',
        severity: 'error',
      },
      {
        row: 3,
        column: 'snapshot_date',
        message: 'Date is invalid',
        severity: 'error',
      },
    ]);
  });
});
