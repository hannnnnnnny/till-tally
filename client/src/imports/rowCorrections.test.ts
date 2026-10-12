import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCsvPreview, createDefaultColumnMapping, createMappedCsvFile } from './preview';
import {
  applyCellCorrections,
  countCorrectedRows,
  getFailedRowEditors,
  setCellCorrection,
} from './rowCorrections';
import { validateMappedCsvRows } from './rowValidation';

const CSV = ['Item SKU,Title,COGS', 'A-100,Mug,4.00', 'B-200,,abc', 'C-300,Plate,2.50'].join('\n');

async function setup() {
  const preview = await createCsvPreview(new File([CSV], 'shop.csv'));
  const mapping = createDefaultColumnMapping(preview, 'PRODUCTS');
  return { preview, mapping };
}

describe('setCellCorrection', () => {
  it('records a corrected value without mutating the previous corrections', async () => {
    const { preview } = await setup();
    const empty = {};
    const next = setCellCorrection(empty, preview, 1, 'COGS', '3.00');

    assert.deepEqual(empty, {});
    assert.deepEqual(next, { 1: { COGS: '3.00' } });
  });

  it('drops a correction that restores the original value', async () => {
    const { preview } = await setup();
    const corrected = setCellCorrection({}, preview, 1, 'COGS', '3.00');

    assert.deepEqual(setCellCorrection(corrected, preview, 1, 'COGS', 'abc'), {});
  });

  it('trims values the same way the CSV parser does', async () => {
    const { preview } = await setup();

    assert.deepEqual(setCellCorrection({}, preview, 1, 'Title', '  Bowl  '), {
      1: { Title: 'Bowl' },
    });
  });

  it('ignores headers that do not exist in the file', async () => {
    const { preview } = await setup();

    assert.deepEqual(setCellCorrection({}, preview, 1, 'Unknown', 'x'), {});
  });
});

describe('applyCellCorrections', () => {
  it('returns a preview whose rows include corrections and leaves the original intact', async () => {
    const { preview } = await setup();
    const corrections = { 1: { Title: 'Bowl', COGS: '3.00' } };
    const corrected = applyCellCorrections(preview, corrections);

    assert.deepEqual(corrected.dataRows[1], ['B-200', 'Bowl', '3.00']);
    assert.deepEqual(corrected.previewRows[1], ['B-200', 'Bowl', '3.00']);
    assert.deepEqual(preview.dataRows[1], ['B-200', '', 'abc']);
  });

  it('returns the same preview object when there is nothing to correct', async () => {
    const { preview } = await setup();

    assert.equal(applyCellCorrections(preview, {}), preview);
  });

  it('makes a corrected row pass validation and reach the uploaded file', async () => {
    const { preview, mapping } = await setup();
    const corrected = applyCellCorrections(preview, { 1: { Title: 'Bowl', COGS: '3.00' } });
    const validation = validateMappedCsvRows(corrected, 'PRODUCTS', mapping);
    const file = createMappedCsvFile(corrected, 'PRODUCTS', mapping);

    assert.equal(validation.failedRows, 0);
    assert.match(await file.text(), /B-200,Bowl,3\.00/);
  });
});

describe('getFailedRowEditors', () => {
  it('lists each failed row with its mapped fields and the issues per field', async () => {
    const { preview, mapping } = await setup();
    const validation = validateMappedCsvRows(preview, 'PRODUCTS', mapping);
    const editors = getFailedRowEditors(preview, 'PRODUCTS', mapping, validation);

    assert.equal(editors.length, 1);
    assert.equal(editors[0]?.rowIndex, 1);
    assert.equal(editors[0]?.rowNumber, 3);
    assert.deepEqual(
      editors[0]?.fields.map((field) => [field.key, field.sourceHeader, field.value, field.issues]),
      [
        ['sku', 'Item SKU', 'B-200', []],
        ['name', 'Title', '', ['Required value is missing']],
        ['cost_price', 'COGS', 'abc', ['Value must be a number']],
      ],
    );
  });
});

describe('countCorrectedRows', () => {
  it('counts rows that have at least one correction', () => {
    assert.equal(countCorrectedRows({ 1: { COGS: '3' }, 4: { Title: 'x' } }), 2);
    assert.equal(countCorrectedRows({}), 0);
  });
});
