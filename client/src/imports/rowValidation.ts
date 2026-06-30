import {
  createMappedCsvData,
  type ColumnMapping,
  type CsvPreview,
  type MappedCsvRow,
} from './preview';
import { type ImportIssueSeverity, type ImportMode } from './types';

export type PreflightIssue = {
  row: number;
  rowIndex: number;
  column?: string;
  message: string;
  severity: ImportIssueSeverity;
};

export type PreflightValidation = {
  rowsTotal: number;
  validRows: number;
  warningRows: number;
  failedRows: number;
  importableRows: number;
  issues: PreflightIssue[];
  importableRowIndexes: ReadonlySet<number>;
  failedRowIndexes: ReadonlySet<number>;
};

type FieldReader = {
  row: MappedCsvRow;
  issues: PreflightIssue[];
};

const ORDER_ITEM_COLUMNS = ['sku', 'quantity', 'unit_price', 'total_price', 'cost_price'] as const;

const KNOWN_ORDER_CHANNELS = new Set([
  'shopify',
  'trade_me',
  'trademe',
  'trade_me_nz',
  'in_store',
  'instore',
  'store',
  'retail',
  'social',
  'manual',
  'other',
]);

export function validateMappedCsvRows(
  preview: CsvPreview,
  mode: ImportMode,
  mapping: ColumnMapping,
): PreflightValidation {
  const mappedCsv = createMappedCsvData(preview, mode, mapping);
  const issues: PreflightIssue[] = [];

  if (mode === 'ORDERS') {
    validateOrderRows(mappedCsv.rows, issues);
  } else {
    validateProductRows(mappedCsv.rows, issues);
  }

  const failedRowIndexes = new Set(
    issues.filter((issue) => issue.severity === 'error').map((issue) => issue.rowIndex),
  );
  const warningRowIndexes = new Set(
    issues
      .filter((issue) => issue.severity === 'warning' && !failedRowIndexes.has(issue.rowIndex))
      .map((issue) => issue.rowIndex),
  );
  const importableRowIndexes = new Set(
    mappedCsv.rows.filter((row) => !failedRowIndexes.has(row.rowIndex)).map((row) => row.rowIndex),
  );

  return {
    rowsTotal: mappedCsv.rows.length,
    validRows: mappedCsv.rows.length - failedRowIndexes.size - warningRowIndexes.size,
    warningRows: warningRowIndexes.size,
    failedRows: failedRowIndexes.size,
    importableRows: importableRowIndexes.size,
    issues: issues.sort(
      (left, right) => left.row - right.row || left.severity.localeCompare(right.severity),
    ),
    importableRowIndexes,
    failedRowIndexes,
  };
}

function validateOrderRows(rows: MappedCsvRow[], issues: PreflightIssue[]) {
  const seenOrderNumbers = new Set<string>();

  for (const row of rows) {
    const reader = { row, issues };
    const orderNumber = readRequiredString(reader, 'order_number');

    readRequiredDate(reader, 'order_date');
    readOrderChannel(reader, 'channel');
    readNonNegativeNumber(reader, 'total_amount', true);
    readNonNegativeNumber(reader, 'discount_amount', false);
    readOptionalOrderItem(reader);

    if (orderNumber && seenOrderNumbers.has(orderNumber)) {
      addIssue(reader, 'order_number', 'Duplicate order number');
    }

    if (orderNumber) {
      seenOrderNumbers.add(orderNumber);
    }
  }
}

function validateProductRows(rows: MappedCsvRow[], issues: PreflightIssue[]) {
  const seenSkus = new Set<string>();

  for (const row of rows) {
    const reader = { row, issues };
    const sku = readRequiredString(reader, 'sku');

    readRequiredString(reader, 'name');
    readNonNegativeNumber(reader, 'cost_price', true);
    readNonNegativeInteger(reader, 'current_stock', false);
    readOptionalDate(reader, 'last_sold_at');

    if (sku && seenSkus.has(sku)) {
      addIssue(
        reader,
        'sku',
        'Duplicate SKU in CSV; row will be skipped by the importer',
        'warning',
      );
    }

    if (sku) {
      seenSkus.add(sku);
    }
  }
}

function readOptionalOrderItem(reader: FieldReader) {
  const hasAnyItemValue = ORDER_ITEM_COLUMNS.some((column) => readCell(reader.row, column) !== '');

  if (!hasAnyItemValue) {
    return;
  }

  readRequiredString(reader, 'sku');
  const quantity = readPositiveInteger(reader, 'quantity');
  const unitPrice = readNonNegativeNumber(reader, 'unit_price', true);
  const totalPrice = readNonNegativeNumber(reader, 'total_price', true);
  readNonNegativeNumber(reader, 'cost_price', true);

  if (quantity !== null && unitPrice !== null && totalPrice !== null) {
    const expectedTotal = roundCurrency(quantity * unitPrice);

    if (Math.abs(expectedTotal - totalPrice) > 0.01) {
      addIssue(
        reader,
        'total_price',
        `total_price does not match quantity * unit_price (${expectedTotal.toFixed(2)})`,
        'warning',
      );
    }
  }
}

function readRequiredString(reader: FieldReader, column: string): string | null {
  const value = readCell(reader.row, column);

  if (!value) {
    addIssue(reader, column, 'Required value is missing');
    return null;
  }

  return value;
}

function readRequiredDate(reader: FieldReader, column: string): string | null {
  const value = readRequiredString(reader, column);

  return value ? validateDate(reader, column, value) : null;
}

function readOptionalDate(reader: FieldReader, column: string): string | null {
  const value = readCell(reader.row, column);

  return value ? validateDate(reader, column, value) : null;
}

function validateDate(reader: FieldReader, column: string, value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    addIssue(reader, column, 'Date must use YYYY-MM-DD format');
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  const isRealDate = !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;

  if (!isRealDate) {
    addIssue(reader, column, 'Date is invalid');
    return null;
  }

  return value;
}

function readOrderChannel(reader: FieldReader, column: string): string | null {
  const value = readRequiredString(reader, column);

  if (!value) {
    return null;
  }

  if (!KNOWN_ORDER_CHANNELS.has(normalizeText(value))) {
    addIssue(reader, column, `Unknown channel "${value}" will be mapped to OTHER`, 'warning');
  }

  return value;
}

function readNonNegativeNumber(
  reader: FieldReader,
  column: string,
  required: boolean,
): number | null {
  const value = readCell(reader.row, column);

  if (!value && !required) {
    return null;
  }

  if (!value) {
    addIssue(reader, column, 'Required value is missing');
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    addIssue(reader, column, 'Value must be a number');
    return null;
  }

  if (parsedValue < 0) {
    addIssue(reader, column, 'Value must be greater than or equal to 0');
    return null;
  }

  return parsedValue;
}

function readNonNegativeInteger(
  reader: FieldReader,
  column: string,
  required: boolean,
): number | null {
  const value = readNonNegativeNumber(reader, column, required);

  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value)) {
    addIssue(reader, column, 'Value must be a whole number');
    return null;
  }

  return value;
}

function readPositiveInteger(reader: FieldReader, column: string): number | null {
  const value = readNonNegativeInteger(reader, column, true);

  if (value === null) {
    return null;
  }

  if (value <= 0) {
    addIssue(reader, column, 'Value must be greater than 0');
    return null;
  }

  return value;
}

function readCell(row: MappedCsvRow, column: string): string {
  return row.valuesByField[column]?.trim() ?? '';
}

function addIssue(
  reader: FieldReader,
  column: string,
  message: string,
  severity: ImportIssueSeverity = 'error',
): void {
  reader.issues.push({
    row: reader.row.sourceRowNumber,
    rowIndex: reader.row.rowIndex,
    column,
    message,
    severity,
  });
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
