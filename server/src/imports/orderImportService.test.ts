import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ImportStatus, SalesChannel } from '@prisma/client';
import { buildOrderImportPlan } from './orderImportService';
import { type CsvValidationResult, type OrderImportRow } from './csvValidation';

describe('order import service', () => {
  it('plans valid order rows for import', () => {
    const validation = createValidationResult([
      {
        sourceRow: 2,
        orderNumber: '1001',
        orderDate: '2026-06-20',
        channel: SalesChannel.SHOPIFY,
        totalAmount: 49.99,
        discountAmount: 5,
        customerRegion: 'Auckland',
        item: {
          sku: 'WJ-001',
          quantity: 2,
          unitPrice: 20,
          totalPrice: 40,
          costPrice: 10,
        },
      },
    ]);

    const plan = buildOrderImportPlan(
      validation,
      new Set<string>(),
      new Map([['WJ-001', 'product-1']]),
    );

    assert.equal(plan.status, ImportStatus.COMPLETED);
    assert.equal(plan.rowsImported, 1);
    assert.equal(plan.rowsFailed, 0);
    assert.equal(plan.orders[0]?.item?.productId, 'product-1');
    assert.equal(plan.errors.length, 0);
    assert.equal(plan.warnings.length, 0);
  });

  it('skips rows whose order number already exists', () => {
    const validation = createValidationResult([
      {
        sourceRow: 2,
        orderNumber: '1001',
        orderDate: '2026-06-20',
        channel: SalesChannel.SHOPIFY,
        totalAmount: 49.99,
        discountAmount: 0,
        customerRegion: null,
        item: null,
      },
    ]);

    const plan = buildOrderImportPlan(validation, new Set(['1001']), new Map<string, string>());

    assert.equal(plan.status, ImportStatus.FAILED);
    assert.equal(plan.rowsImported, 0);
    assert.equal(plan.rowsFailed, 1);
    assert.deepEqual(plan.warnings, [
      {
        row: 2,
        column: 'order_number',
        message: 'Order number already exists; row skipped',
        severity: 'warning',
      },
    ]);
  });

  it('keeps order items with unmatched SKUs and records a warning', () => {
    const validation = createValidationResult([
      {
        sourceRow: 2,
        orderNumber: '1001',
        orderDate: '2026-06-20',
        channel: SalesChannel.OTHER,
        totalAmount: 25,
        discountAmount: 0,
        customerRegion: null,
        item: {
          sku: 'MISSING-SKU',
          quantity: 1,
          unitPrice: 25,
          totalPrice: 25,
          costPrice: 10,
        },
      },
    ]);

    const plan = buildOrderImportPlan(validation, new Set<string>(), new Map<string, string>());

    assert.equal(plan.status, ImportStatus.COMPLETED_WITH_WARNINGS);
    assert.equal(plan.rowsImported, 1);
    assert.equal(plan.orders[0]?.item?.productId, null);
    assert.deepEqual(plan.warnings, [
      {
        row: 2,
        column: 'sku',
        message: 'SKU "MISSING-SKU" was not matched to a product',
        severity: 'warning',
      },
    ]);
  });

  it('fails imports with no valid order rows', () => {
    const validation = createValidationResult([]);
    const plan = buildOrderImportPlan(validation, new Set<string>(), new Map<string, string>());

    assert.equal(plan.status, ImportStatus.FAILED);
    assert.equal(plan.rowsTotal, 0);
    assert.equal(plan.rowsImported, 0);
    assert.equal(plan.rowsFailed, 0);
    assert.deepEqual(plan.errors, [
      {
        row: 1,
        message: 'CSV must include at least one order row',
        severity: 'error',
      },
    ]);
  });
});

function createValidationResult(validRows: OrderImportRow[]): CsvValidationResult<OrderImportRow> {
  return {
    rowsTotal: validRows.length,
    validRows,
    errors: [],
    warnings: [],
  };
}
