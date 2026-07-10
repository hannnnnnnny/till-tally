import { SalesChannel } from '@prisma/client';
import { parse as parseCsv } from 'csv-parse/sync';

export type CsvIssueSeverity = 'error' | 'warning';

export type CsvIssue = {
  row: number;
  column?: string;
  message: string;
  severity: CsvIssueSeverity;
};

export type CsvValidationResult<T> = {
  rowsTotal: number;
  validRows: T[];
  errors: CsvIssue[];
  warnings: CsvIssue[];
};

export type ProductImportRow = {
  sourceRow: number;
  sku: string;
  name: string;
  category: string | null;
  vendor: string | null;
  costPrice: number;
  currentStock: number;
  lastSoldAt: string | null;
};

export type OrderImportItemRow = {
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  costPrice: number;
};

export type OrderImportRow = {
  sourceRow: number;
  orderNumber: string;
  orderDate: string;
  channel: SalesChannel;
  totalAmount: number;
  discountAmount: number;
  customerRegion: string | null;
  item: OrderImportItemRow | null;
};

export type InventoryImportRow = {
  sku: string;
  stockQuantity: number;
  snapshotDate: string;
};

type RawCsvRecord = {
  rowNumber: number;
  values: Map<string, string>;
};

type ParsedCsv = {
  headers: Set<string>;
  records: RawCsvRecord[];
  errors: CsvIssue[];
};

type RowContext = {
  record: RawCsvRecord;
  errors: CsvIssue[];
  warnings: CsvIssue[];
};

const PRODUCT_REQUIRED_COLUMNS = ['sku', 'name', 'cost_price'] as const;
const ORDER_REQUIRED_COLUMNS = ['order_number', 'order_date', 'channel', 'total_amount'] as const;
const ORDER_ITEM_COLUMNS = ['sku', 'quantity', 'unit_price', 'total_price', 'cost_price'] as const;
const INVENTORY_REQUIRED_COLUMNS = ['sku', 'stock_quantity', 'snapshot_date'] as const;

const PRODUCT_HEADER_ALIASES = buildHeaderAliases({
  sku: ['item_sku', 'product_sku', 'variant_sku'],
  name: ['product_name', 'item_name', 'title'],
  category: ['product_category', 'type'],
  vendor: ['supplier', 'brand'],
  cost_price: ['cost', 'unit_cost', 'item_cost', 'cogs'],
  current_stock: ['stock', 'stock_on_hand', 'on_hand', 'quantity_on_hand', 'inventory_quantity'],
  last_sold_at: ['last_sold', 'last_sold_date', 'last_sale_date'],
});

const ORDER_HEADER_ALIASES = buildHeaderAliases({
  order_number: ['order_id', 'order_no', 'order', 'receipt_number', 'transaction_id'],
  order_date: ['date', 'sale_date', 'sales_date', 'created_at', 'paid_at'],
  channel: ['platform', 'source', 'sales_channel', 'order_source'],
  total_amount: ['total', 'amount', 'revenue', 'sales', 'gross_sales', 'order_total'],
  discount_amount: ['discount', 'discounts', 'discount_total'],
  customer_region: ['region', 'customer_region', 'shipping_region', 'customer_city'],
  sku: ['item_sku', 'product_sku', 'variant_sku'],
  quantity: ['qty', 'quantity_sold', 'item_quantity'],
  unit_price: ['price', 'item_price', 'unit_amount'],
  total_price: ['line_total', 'item_total', 'line_amount'],
  cost_price: ['cost', 'unit_cost', 'item_cost', 'cogs'],
});

const INVENTORY_HEADER_ALIASES = buildHeaderAliases({
  sku: ['item_sku', 'product_sku', 'variant_sku'],
  stock_quantity: ['stock', 'stock_on_hand', 'on_hand', 'quantity_on_hand', 'inventory_quantity'],
  snapshot_date: ['date', 'stock_date', 'inventory_date', 'count_date'],
});

const SALES_CHANNEL_ALIASES = new Map<string, SalesChannel>([
  ['shopify', SalesChannel.SHOPIFY],
  ['trade_me', SalesChannel.TRADE_ME],
  ['trademe', SalesChannel.TRADE_ME],
  ['trade_me_nz', SalesChannel.TRADE_ME],
  ['in_store', SalesChannel.IN_STORE],
  ['instore', SalesChannel.IN_STORE],
  ['store', SalesChannel.IN_STORE],
  ['retail', SalesChannel.IN_STORE],
  ['social', SalesChannel.SOCIAL],
  ['manual', SalesChannel.MANUAL],
  ['other', SalesChannel.OTHER],
]);

export function validateProductsCsv(csvText: string): CsvValidationResult<ProductImportRow> {
  const parsed = parseCsvRecords(csvText, PRODUCT_HEADER_ALIASES);
  const setupErrors = requireColumns(parsed.headers, PRODUCT_REQUIRED_COLUMNS);

  return validateRecords(parsed, setupErrors, (context) => {
    const sku = readRequiredString(context, 'sku');
    const name = readRequiredString(context, 'name');
    const costPrice = readNonNegativeNumber(context, 'cost_price', { required: true });
    const currentStock = readNonNegativeInteger(context, 'current_stock', {
      required: false,
      fallback: 0,
    });
    const lastSoldAt = readOptionalDate(context, 'last_sold_at');

    if (!sku || !name || costPrice === null || currentStock === null || hasRowErrors(context)) {
      return null;
    }

    return {
      sourceRow: context.record.rowNumber,
      sku,
      name,
      category: readOptionalString(context, 'category'),
      vendor: readOptionalString(context, 'vendor'),
      costPrice,
      currentStock,
      lastSoldAt,
    };
  });
}

export function validateOrdersCsv(csvText: string): CsvValidationResult<OrderImportRow> {
  const parsed = parseCsvRecords(csvText, ORDER_HEADER_ALIASES);
  const setupErrors = requireColumns(parsed.headers, ORDER_REQUIRED_COLUMNS);
  const seenOrderNumbers = new Set<string>();

  return validateRecords(parsed, setupErrors, (context) => {
    const orderNumber = readRequiredString(context, 'order_number');
    const orderDate = readRequiredDate(context, 'order_date');
    const channel = readSalesChannel(context, 'channel');
    const totalAmount = readNonNegativeNumber(context, 'total_amount', { required: true });
    const discountAmount = readNonNegativeNumber(context, 'discount_amount', {
      required: false,
      fallback: 0,
    });
    const item = readOptionalOrderItem(context);

    if (orderNumber && seenOrderNumbers.has(orderNumber)) {
      addIssue(context.errors, context.record.rowNumber, 'order_number', 'Duplicate order number');
    }

    if (orderNumber) {
      seenOrderNumbers.add(orderNumber);
    }

    if (
      !orderNumber ||
      !orderDate ||
      channel === null ||
      totalAmount === null ||
      discountAmount === null ||
      hasRowErrors(context)
    ) {
      return null;
    }

    return {
      sourceRow: context.record.rowNumber,
      orderNumber,
      orderDate,
      channel,
      totalAmount,
      discountAmount,
      customerRegion: readOptionalString(context, 'customer_region'),
      item,
    };
  });
}

export function validateInventoryCsv(csvText: string): CsvValidationResult<InventoryImportRow> {
  const parsed = parseCsvRecords(csvText, INVENTORY_HEADER_ALIASES);
  const setupErrors = requireColumns(parsed.headers, INVENTORY_REQUIRED_COLUMNS);

  return validateRecords(parsed, setupErrors, (context) => {
    const sku = readRequiredString(context, 'sku');
    const stockQuantity = readNonNegativeInteger(context, 'stock_quantity', { required: true });
    const snapshotDate = readRequiredDate(context, 'snapshot_date');

    if (!sku || stockQuantity === null || !snapshotDate || hasRowErrors(context)) {
      return null;
    }

    return {
      sku,
      stockQuantity,
      snapshotDate,
    };
  });
}

function parseCsvRecords(csvText: string, headerAliases: Map<string, string>): ParsedCsv {
  const trimmedCsv = csvText.trim();

  if (!trimmedCsv) {
    return {
      headers: new Set<string>(),
      records: [],
      errors: [{ row: 1, message: 'CSV file is empty', severity: 'error' }],
    };
  }

  try {
    const rows = parseCsv(trimmedCsv, {
      bom: true,
      relax_column_count: false,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];

    if (rows.length === 0) {
      return {
        headers: new Set<string>(),
        records: [],
        errors: [{ row: 1, message: 'CSV file is empty', severity: 'error' }],
      };
    }

    const rawHeaders = rows[0] ?? [];
    const normalizedHeaders = rawHeaders.map((header) => normalizeHeader(header, headerAliases));
    const duplicateHeaders = findDuplicates(normalizedHeaders.filter(Boolean));
    const errors = duplicateHeaders.map((header) => ({
      row: 1,
      column: header,
      message: `Duplicate column "${header}"`,
      severity: 'error' as const,
    }));

    const headers = new Set(normalizedHeaders.filter(Boolean));
    const records = rows.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      values: mapRowValues(normalizedHeaders, row),
    }));

    return { headers, records, errors };
  } catch (error) {
    return {
      headers: new Set<string>(),
      records: [],
      errors: [
        {
          row: 1,
          message: error instanceof Error ? error.message : 'Invalid CSV format',
          severity: 'error',
        },
      ],
    };
  }
}

function validateRecords<T>(
  parsed: ParsedCsv,
  setupErrors: CsvIssue[],
  validateRecord: (context: RowContext) => T | null,
): CsvValidationResult<T> {
  const errors = [...parsed.errors, ...setupErrors];
  const warnings: CsvIssue[] = [];
  const validRows: T[] = [];

  if (errors.length > 0) {
    return {
      rowsTotal: parsed.records.length,
      validRows,
      errors,
      warnings,
    };
  }

  for (const record of parsed.records) {
    const context: RowContext = { record, errors, warnings };
    const validatedRow = validateRecord(context);

    if (validatedRow) {
      validRows.push(validatedRow);
    }
  }

  return {
    rowsTotal: parsed.records.length,
    validRows,
    errors,
    warnings,
  };
}

function requireColumns(headers: Set<string>, requiredColumns: readonly string[]): CsvIssue[] {
  return requiredColumns
    .filter((column) => !headers.has(column))
    .map((column) => ({
      row: 1,
      column,
      message: `Missing required column "${column}"`,
      severity: 'error' as const,
    }));
}

function readOptionalOrderItem(context: RowContext): OrderImportItemRow | null {
  const hasAnyItemValue = ORDER_ITEM_COLUMNS.some(
    (column) => readCell(context.record, column) !== '',
  );

  if (!hasAnyItemValue) {
    return null;
  }

  const sku = readRequiredString(context, 'sku');
  const quantity = readPositiveInteger(context, 'quantity');
  const unitPrice = readNonNegativeNumber(context, 'unit_price', { required: true });
  const totalPrice = readNonNegativeNumber(context, 'total_price', { required: true });
  const costPrice = readNonNegativeNumber(context, 'cost_price', { required: true });

  if (quantity !== null && unitPrice !== null && totalPrice !== null) {
    const expectedTotal = roundCurrency(quantity * unitPrice);

    if (Math.abs(expectedTotal - totalPrice) > 0.01) {
      addIssue(
        context.warnings,
        context.record.rowNumber,
        'total_price',
        `total_price does not match quantity * unit_price (${expectedTotal.toFixed(2)})`,
        'warning',
      );
    }
  }

  if (
    !sku ||
    quantity === null ||
    unitPrice === null ||
    totalPrice === null ||
    costPrice === null
  ) {
    return null;
  }

  return {
    sku,
    quantity,
    unitPrice,
    totalPrice,
    costPrice,
  };
}

function readRequiredString(context: RowContext, column: string): string | null {
  const value = readCell(context.record, column);

  if (!value) {
    addIssue(context.errors, context.record.rowNumber, column, 'Required value is missing');
    return null;
  }

  return value;
}

function readOptionalString(context: RowContext, column: string): string | null {
  return readCell(context.record, column) || null;
}

function readRequiredDate(context: RowContext, column: string): string | null {
  const value = readRequiredString(context, column);

  if (!value) {
    return null;
  }

  return validateDate(context, column, value);
}

function readOptionalDate(context: RowContext, column: string): string | null {
  const value = readCell(context.record, column);

  if (!value) {
    return null;
  }

  return validateDate(context, column, value);
}

function validateDate(context: RowContext, column: string, value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    addIssue(context.errors, context.record.rowNumber, column, 'Date must use YYYY-MM-DD format');
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  const isRealDate = !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;

  if (!isRealDate) {
    addIssue(context.errors, context.record.rowNumber, column, 'Date is invalid');
    return null;
  }

  return value;
}

function readSalesChannel(context: RowContext, column: string): SalesChannel | null {
  const rawValue = readRequiredString(context, column);

  if (!rawValue) {
    return null;
  }

  const mappedChannel = SALES_CHANNEL_ALIASES.get(normalizeChannel(rawValue));

  if (!mappedChannel) {
    addIssue(
      context.warnings,
      context.record.rowNumber,
      column,
      `Unknown channel "${rawValue}" mapped to OTHER`,
      'warning',
    );
    return SalesChannel.OTHER;
  }

  return mappedChannel;
}

function readNonNegativeNumber(
  context: RowContext,
  column: string,
  options: { required: boolean; fallback?: number },
): number | null {
  const value = readCell(context.record, column);

  if (!value && !options.required) {
    return options.fallback ?? null;
  }

  if (!value) {
    addIssue(context.errors, context.record.rowNumber, column, 'Required value is missing');
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    addIssue(context.errors, context.record.rowNumber, column, 'Value must be a number');
    return null;
  }

  if (parsed < 0) {
    addIssue(
      context.errors,
      context.record.rowNumber,
      column,
      'Value must be greater than or equal to 0',
    );
    return null;
  }

  return parsed;
}

function readNonNegativeInteger(
  context: RowContext,
  column: string,
  options: { required: boolean; fallback?: number },
): number | null {
  const value = readNonNegativeNumber(context, column, options);

  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value)) {
    addIssue(context.errors, context.record.rowNumber, column, 'Value must be a whole number');
    return null;
  }

  return value;
}

function readPositiveInteger(context: RowContext, column: string): number | null {
  const value = readNonNegativeInteger(context, column, { required: true });

  if (value === null) {
    return null;
  }

  if (value <= 0) {
    addIssue(context.errors, context.record.rowNumber, column, 'Value must be greater than 0');
    return null;
  }

  return value;
}

function hasRowErrors(context: RowContext): boolean {
  return context.errors.some((error) => error.row === context.record.rowNumber);
}

function readCell(record: RawCsvRecord, column: string): string {
  return record.values.get(column) ?? '';
}

function mapRowValues(headers: string[], row: string[]): Map<string, string> {
  const values = new Map<string, string>();

  headers.forEach((header, index) => {
    if (header) {
      values.set(header, row[index]?.trim() ?? '');
    }
  });

  return values;
}

function buildHeaderAliases(
  aliasesByColumn: Record<string, readonly string[]>,
): Map<string, string> {
  const aliases = new Map<string, string>();

  for (const [canonicalColumn, aliasColumns] of Object.entries(aliasesByColumn)) {
    for (const aliasColumn of [canonicalColumn, ...aliasColumns]) {
      aliases.set(normalizeHeaderKey(aliasColumn), canonicalColumn);
    }
  }

  return aliases;
}

function normalizeHeader(header: string, headerAliases: Map<string, string>): string {
  const normalizedHeader = normalizeHeaderKey(header);

  return headerAliases.get(normalizedHeader) ?? normalizedHeader;
}

function normalizeHeaderKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeChannel(channel: string): string {
  return normalizeHeaderKey(channel);
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  }

  return [...duplicates];
}

function addIssue(
  issues: CsvIssue[],
  row: number,
  column: string,
  message: string,
  severity: CsvIssueSeverity = 'error',
): void {
  issues.push({ row, column, message, severity });
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
