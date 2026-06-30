import {
  createDefaultColumnMapping,
  getImportFieldDefinitions,
  type ColumnMapping,
  type CsvPreview,
  type ImportFieldDefinition,
} from './preview';
import { type ImportMode } from './types';

export type MappingSuggestionConfidence = 'high' | 'medium' | 'low';

export type MappingSuggestion = {
  field: ImportFieldDefinition;
  sourceHeader: string;
  confidence: MappingSuggestionConfidence;
  reason: string;
};

type CandidateScore = {
  sourceHeader: string;
  score: number;
  reason: string;
};

const MIN_SUGGESTION_SCORE = 35;

const FIELD_HEADER_HINTS: Record<ImportMode, Record<string, readonly string[]>> = {
  ORDERS: {
    order_number: ['order', 'order number', 'order id', 'receipt', 'transaction'],
    order_date: ['date', 'order date', 'sale date', 'created', 'paid'],
    channel: ['channel', 'platform', 'source', 'marketplace'],
    total_amount: ['total', 'amount', 'revenue', 'sales', 'gross'],
    discount_amount: ['discount'],
    customer_region: ['region', 'city', 'area', 'location'],
    sku: ['sku', 'item sku', 'product sku', 'variant'],
    quantity: ['quantity', 'qty', 'units'],
    unit_price: ['unit price', 'price', 'unit amount'],
    total_price: ['line total', 'item total', 'line amount'],
    cost_price: ['cost', 'cogs', 'unit cost'],
  },
  PRODUCTS: {
    sku: ['sku', 'item sku', 'product sku', 'variant'],
    name: ['name', 'product name', 'title', 'item name'],
    category: ['category', 'type', 'department'],
    vendor: ['vendor', 'supplier', 'brand'],
    cost_price: ['cost', 'cogs', 'unit cost'],
    current_stock: ['stock', 'inventory', 'on hand', 'quantity on hand'],
    last_sold_at: ['last sold', 'last sale', 'sold at'],
  },
};

export function createMappingSuggestions(
  preview: CsvPreview,
  mode: ImportMode,
): MappingSuggestion[] {
  const deterministicMapping = createDefaultColumnMapping(preview, mode);
  const selectedHeaders = new Set<string>();
  const suggestions: MappingSuggestion[] = [];

  for (const field of getImportFieldDefinitions(mode)) {
    const deterministicHeader = deterministicMapping[field.key];

    if (deterministicHeader && !selectedHeaders.has(deterministicHeader)) {
      selectedHeaders.add(deterministicHeader);
      suggestions.push({
        field,
        sourceHeader: deterministicHeader,
        confidence: 'high',
        reason: 'Header alias match',
      });
      continue;
    }

    const bestCandidate = getBestCandidate(field, preview, mode, selectedHeaders);

    if (!bestCandidate) {
      continue;
    }

    selectedHeaders.add(bestCandidate.sourceHeader);
    suggestions.push({
      field,
      sourceHeader: bestCandidate.sourceHeader,
      confidence: scoreToConfidence(bestCandidate.score),
      reason: bestCandidate.reason,
    });
  }

  return suggestions;
}

export function mergeSuggestionsIntoMapping(
  currentMapping: ColumnMapping,
  suggestions: MappingSuggestion[],
): ColumnMapping {
  return {
    ...currentMapping,
    ...Object.fromEntries(
      suggestions.map((suggestion) => [suggestion.field.key, suggestion.sourceHeader]),
    ),
  };
}

function getBestCandidate(
  field: ImportFieldDefinition,
  preview: CsvPreview,
  mode: ImportMode,
  selectedHeaders: Set<string>,
): CandidateScore | null {
  const candidates = preview.headers
    .map((header, columnIndex) => ({ header, columnIndex }))
    .filter(({ header }) => !selectedHeaders.has(header))
    .map(({ header, columnIndex }) => scoreCandidate(field, header, preview, mode, columnIndex))
    .filter((candidate) => candidate.score >= MIN_SUGGESTION_SCORE)
    .sort((left, right) => right.score - left.score);

  return candidates[0] ?? null;
}

function scoreCandidate(
  field: ImportFieldDefinition,
  sourceHeader: string,
  preview: CsvPreview,
  mode: ImportMode,
  columnIndex: number,
): CandidateScore {
  const headerScore = scoreHeaderName(field.key, sourceHeader, mode);
  const valueScore = scoreSampleValues(field.key, preview.previewRows, columnIndex);
  const score = Math.min(100, headerScore + valueScore);
  const reason =
    headerScore >= valueScore
      ? `Header resembles ${field.label}`
      : `Sample values look like ${field.label}`;

  return {
    sourceHeader,
    score,
    reason,
  };
}

function scoreHeaderName(fieldKey: string, sourceHeader: string, mode: ImportMode): number {
  const normalizedHeader = normalizeText(sourceHeader);
  const headerTokens = new Set(normalizedHeader.split(' ').filter(Boolean));
  const hints = FIELD_HEADER_HINTS[mode][fieldKey] ?? [fieldKey];
  let bestScore = 0;

  for (const hint of hints) {
    const normalizedHint = normalizeText(hint);
    const hintTokens = normalizedHint.split(' ').filter(Boolean);

    if (normalizedHeader === normalizedHint) {
      bestScore = Math.max(bestScore, 85);
      continue;
    }

    if (normalizedHeader.includes(normalizedHint) || normalizedHint.includes(normalizedHeader)) {
      bestScore = Math.max(bestScore, 70);
      continue;
    }

    const matchedTokens = hintTokens.filter((token) => headerTokens.has(token)).length;

    if (matchedTokens > 0) {
      bestScore = Math.max(bestScore, 35 + matchedTokens * 15);
    }
  }

  return bestScore;
}

function scoreSampleValues(fieldKey: string, previewRows: string[][], columnIndex: number): number {
  const sampleValues = previewRows.map((row) => row[columnIndex] ?? '').filter(Boolean);

  if (sampleValues.length === 0) {
    return 0;
  }

  const matchRate = getSampleMatchRate(sampleValues, getValueMatcher(fieldKey));

  return Math.round(matchRate * 35);
}

function getSampleMatchRate(values: string[], matcher: (value: string) => boolean): number {
  return values.filter(matcher).length / values.length;
}

function getValueMatcher(fieldKey: string): (value: string) => boolean {
  if (fieldKey.includes('date') || fieldKey.endsWith('_at')) {
    return looksLikeDate;
  }

  if (
    fieldKey.includes('amount') ||
    fieldKey.includes('price') ||
    fieldKey.includes('cost') ||
    fieldKey.includes('stock') ||
    fieldKey === 'quantity'
  ) {
    return looksLikeNumber;
  }

  if (fieldKey === 'sku') {
    return looksLikeSku;
  }

  if (fieldKey === 'channel') {
    return looksLikeChannel;
  }

  return (value) => value.trim().length > 0;
}

function looksLikeDate(value: string): boolean {
  const trimmedValue = value.trim();

  return (
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmedValue) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmedValue) ||
    !Number.isNaN(Date.parse(trimmedValue))
  );
}

function looksLikeNumber(value: string): boolean {
  return /^-?\$?\d+(?:,\d{3})*(?:\.\d+)?$/.test(value.trim());
}

function looksLikeSku(value: string): boolean {
  const trimmedValue = value.trim();

  return /^[A-Z0-9][A-Z0-9_-]{2,}$/i.test(trimmedValue) && /\d/.test(trimmedValue);
}

function looksLikeChannel(value: string): boolean {
  return ['shopify', 'trade me', 'trademe', 'in store', 'in-store', 'social', 'manual'].includes(
    normalizeText(value),
  );
}

function scoreToConfidence(score: number): MappingSuggestionConfidence {
  if (score >= 75) {
    return 'high';
  }

  if (score >= 50) {
    return 'medium';
  }

  return 'low';
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
