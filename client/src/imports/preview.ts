import { parse as parseCsv } from 'csv-parse/sync';
import { type ImportMode, type ImportType } from './types';

export type CsvPreviewConfidence = 'high' | 'medium' | 'low';

export type CsvPreviewDetectedType = ImportType | 'UNKNOWN';

export type CsvPreview = {
  fileName: string;
  fileSize: number;
  headers: string[];
  rowsTotal: number;
  previewRows: string[][];
  detectedType: CsvPreviewDetectedType;
  confidence: CsvPreviewConfidence;
};

type ImportDetectionScore = {
  importType: ImportType;
  requiredMatches: number;
  optionalMatches: number;
  requiredTotal: number;
};

const PREVIEW_ROW_LIMIT = 10;

const IMPORT_TYPES = ['ORDERS', 'PRODUCTS', 'INVENTORY'] as const satisfies readonly ImportType[];

const REQUIRED_COLUMNS: Record<ImportType, readonly string[]> = {
  ORDERS: ['order_number', 'order_date', 'channel', 'total_amount'],
  PRODUCTS: ['sku', 'name', 'cost_price'],
  INVENTORY: ['sku', 'stock_quantity', 'snapshot_date'],
};

const HEADER_ALIASES: Record<ImportType, Map<string, string>> = {
  ORDERS: buildHeaderAliases({
    order_number: ['order_id', 'order_no', 'order', 'receipt_number', 'transaction_id'],
    order_date: ['date', 'sale_date', 'sales_date', 'created_at', 'paid_at'],
    channel: ['platform', 'source', 'sales_channel', 'order_source'],
    total_amount: ['total', 'amount', 'revenue', 'sales', 'gross_sales', 'order_total'],
    discount_amount: ['discount', 'discounts', 'discount_total'],
    customer_region: ['region', 'shipping_region', 'customer_city'],
    sku: ['item_sku', 'product_sku', 'variant_sku'],
    quantity: ['qty', 'quantity_sold', 'item_quantity'],
    unit_price: ['price', 'item_price', 'unit_amount'],
    total_price: ['line_total', 'item_total', 'line_amount'],
    cost_price: ['cost', 'unit_cost', 'item_cost', 'cogs'],
  }),
  PRODUCTS: buildHeaderAliases({
    sku: ['item_sku', 'product_sku', 'variant_sku'],
    name: ['product_name', 'item_name', 'title'],
    category: ['product_category', 'type'],
    vendor: ['supplier', 'brand'],
    cost_price: ['cost', 'unit_cost', 'item_cost', 'cogs'],
    current_stock: ['stock', 'stock_on_hand', 'on_hand', 'quantity_on_hand', 'inventory_quantity'],
    last_sold_at: ['last_sold', 'last_sold_date', 'last_sale_date'],
  }),
  INVENTORY: buildHeaderAliases({
    sku: ['item_sku', 'product_sku', 'variant_sku'],
    stock_quantity: ['stock', 'stock_on_hand', 'on_hand', 'quantity_on_hand', 'inventory_quantity'],
    snapshot_date: ['date', 'stock_date', 'inventory_date', 'count_date'],
  }),
};

export async function createCsvPreview(file: File): Promise<CsvPreview> {
  const rows = parseCsvRows(await file.text());
  const rawHeaders = rows[0] ?? [];
  const headers = rawHeaders.map((header, index) => header.trim() || `Column ${index + 1}`);

  if (headers.length === 0 || headers.every((header) => header.startsWith('Column '))) {
    throw new Error('CSV must include a header row');
  }

  const dataRows = rows.slice(1);
  const detection = detectImportType(headers);

  return {
    fileName: file.name,
    fileSize: file.size,
    headers,
    rowsTotal: dataRows.length,
    previewRows: dataRows.slice(0, PREVIEW_ROW_LIMIT).map((row) => padRow(row, headers.length)),
    detectedType: detection.detectedType,
    confidence: detection.confidence,
  };
}

export function isImportablePreviewType(
  detectedType: CsvPreviewDetectedType,
): detectedType is ImportMode {
  return detectedType === 'ORDERS' || detectedType === 'PRODUCTS';
}

function parseCsvRows(csvText: string): string[][] {
  const trimmedCsv = csvText.trim();

  if (!trimmedCsv) {
    throw new Error('CSV file is empty');
  }

  const rows = parseCsv(trimmedCsv, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as string[][];

  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  return rows;
}

function detectImportType(headers: string[]): {
  detectedType: CsvPreviewDetectedType;
  confidence: CsvPreviewConfidence;
} {
  const scores = IMPORT_TYPES.map((importType) => scoreImportType(headers, importType)).sort(
    (left, right) =>
      right.requiredMatches - left.requiredMatches || right.optionalMatches - left.optionalMatches,
  );
  const [bestScore, nextScore] = scores;

  if (!bestScore || bestScore.requiredMatches === 0) {
    return { detectedType: 'UNKNOWN', confidence: 'low' };
  }

  if (
    nextScore &&
    bestScore.requiredMatches === nextScore.requiredMatches &&
    bestScore.optionalMatches === nextScore.optionalMatches
  ) {
    return { detectedType: 'UNKNOWN', confidence: 'low' };
  }

  if (bestScore.requiredMatches === bestScore.requiredTotal) {
    return { detectedType: bestScore.importType, confidence: 'high' };
  }

  if (bestScore.requiredMatches >= Math.ceil(bestScore.requiredTotal / 2)) {
    return { detectedType: bestScore.importType, confidence: 'medium' };
  }

  return { detectedType: 'UNKNOWN', confidence: 'low' };
}

function scoreImportType(headers: string[], importType: ImportType): ImportDetectionScore {
  const canonicalHeaders = new Set(
    headers.map((header) => normalizeHeader(header, HEADER_ALIASES[importType])),
  );
  const requiredColumns = REQUIRED_COLUMNS[importType];
  const requiredColumnSet = new Set(requiredColumns);
  const requiredMatches = requiredColumns.filter((column) => canonicalHeaders.has(column)).length;
  const optionalMatches = [...canonicalHeaders].filter(
    (column) => !requiredColumnSet.has(column) && HEADER_ALIASES[importType].has(column),
  ).length;

  return {
    importType,
    requiredMatches,
    optionalMatches,
    requiredTotal: requiredColumns.length,
  };
}

function padRow(row: string[], length: number): string[] {
  if (row.length >= length) {
    return row.slice(0, length);
  }

  return [...row, ...Array.from({ length: length - row.length }, () => '')];
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
    .replace(/'/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
