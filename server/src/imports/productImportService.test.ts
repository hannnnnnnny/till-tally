import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ImportStatus } from '@prisma/client';
import { type CsvValidationResult, type ProductImportRow } from './csvValidation';
import { buildProductImportPlan } from './productImportService';

describe('product import service', () => {
  it('plans valid product rows for upsert', () => {
    const validation = createValidationResult([
      {
        sourceRow: 2,
        sku: 'WJ-001',
        name: 'Womens Jacket',
        category: 'Womens Fashion',
        vendor: 'Local Supplier',
        costPrice: 38,
        currentStock: 5,
        lastSoldAt: null,
      },
    ]);

    const plan = buildProductImportPlan(validation);

    assert.equal(plan.status, ImportStatus.COMPLETED);
    assert.equal(plan.rowsImported, 1);
    assert.equal(plan.rowsFailed, 0);
    assert.deepEqual(plan.products, validation.validRows);
    assert.equal(plan.errors.length, 0);
    assert.equal(plan.warnings.length, 0);
  });

  it('skips duplicate SKUs within the same CSV file', () => {
    const validation = createValidationResult([
      createProductRow(2, 'WJ-001'),
      createProductRow(3, 'WJ-001'),
    ]);

    const plan = buildProductImportPlan(validation);

    assert.equal(plan.status, ImportStatus.COMPLETED_WITH_WARNINGS);
    assert.equal(plan.rowsImported, 1);
    assert.equal(plan.rowsFailed, 1);
    assert.deepEqual(plan.warnings, [
      {
        row: 3,
        column: 'sku',
        message: 'Duplicate SKU in CSV; row skipped',
        severity: 'warning',
      },
    ]);
  });

  it('fails imports with no valid product rows', () => {
    const validation = createValidationResult([]);
    const plan = buildProductImportPlan(validation);

    assert.equal(plan.status, ImportStatus.FAILED);
    assert.equal(plan.rowsTotal, 0);
    assert.equal(plan.rowsImported, 0);
    assert.equal(plan.rowsFailed, 0);
    assert.deepEqual(plan.errors, [
      {
        row: 1,
        message: 'CSV must include at least one product row',
        severity: 'error',
      },
    ]);
  });
});

function createValidationResult(
  validRows: ProductImportRow[],
): CsvValidationResult<ProductImportRow> {
  return {
    rowsTotal: validRows.length,
    validRows,
    errors: [],
    warnings: [],
  };
}

function createProductRow(sourceRow: number, sku: string): ProductImportRow {
  return {
    sourceRow,
    sku,
    name: 'Womens Jacket',
    category: 'Womens Fashion',
    vendor: 'Local Supplier',
    costPrice: 38,
    currentStock: 5,
    lastSoldAt: null,
  };
}
