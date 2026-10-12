import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMappingSuggestions, mergeSuggestionsIntoMapping } from './mappingSuggestions';
import { createCsvPreview } from './preview';

async function previewOf(text: string) {
  return createCsvPreview(new File([text], 'x.csv'));
}

function byField(suggestions: ReturnType<typeof createMappingSuggestions>) {
  return Object.fromEntries(suggestions.map((s) => [s.field.key, s]));
}

describe('createMappingSuggestions', () => {
  it('suggests alias matches with high confidence', async () => {
    const preview = await previewOf('Order ID,Date,Platform,Total\nA1,2026-06-01,Shopify,10\n');
    const suggestions = byField(createMappingSuggestions(preview, 'ORDERS'));

    assert.equal(suggestions.order_number?.sourceHeader, 'Order ID');
    assert.equal(suggestions.order_number?.confidence, 'high');
    assert.equal(suggestions.order_number?.reason, 'Header alias match');
    assert.equal(suggestions.total_amount?.sourceHeader, 'Total');
  });

  it('suggests fuzzy header matches backed by sample values', async () => {
    const preview = await previewOf(
      'Receipt #,Sold Date,Sales Channel Name,Grand Total NZD\nR1,2026-06-01,Shopify,10.50\n',
    );
    const suggestions = byField(createMappingSuggestions(preview, 'ORDERS'));

    assert.equal(suggestions.channel?.sourceHeader, 'Sales Channel Name');
    assert.equal(suggestions.channel?.confidence, 'high');
    assert.equal(suggestions.channel?.reason, 'Header resembles Channel');
    assert.equal(suggestions.total_amount?.sourceHeader, 'Grand Total NZD');
    assert.equal(suggestions.order_date?.sourceHeader, 'Sold Date');
  });

  it('does not suggest an unrelated text column on sample values alone', async () => {
    const preview = await previewOf('SKU,Title,COGS,Maker\nA1,Mug,4,Acme\n');
    const suggested = createMappingSuggestions(preview, 'PRODUCTS').map((s) => s.sourceHeader);

    assert.equal(suggested.includes('Maker'), false);
  });

  it('still suggests typed columns from sample values when the header is opaque', async () => {
    const preview = await previewOf('SKU,Title,COGS,Col 4\nA1,Mug,4,2026-06-01\n');
    const suggestions = byField(createMappingSuggestions(preview, 'PRODUCTS'));

    assert.equal(suggestions.last_sold_at?.sourceHeader, 'Col 4');
    assert.equal(suggestions.last_sold_at?.reason, 'Sample values look like Last sold date');
  });

  it('never assigns the same source header to two fields', async () => {
    const preview = await previewOf(
      'Order ID,Date,Platform,Total,Cost\nA1,2026-06-01,Shopify,10,4\n',
    );
    const headers = createMappingSuggestions(preview, 'ORDERS').map((s) => s.sourceHeader);

    assert.equal(new Set(headers).size, headers.length);
  });
});

describe('mergeSuggestionsIntoMapping', () => {
  it('applies suggestions and drops manual mappings whose header a suggestion now uses', async () => {
    const preview = await previewOf('SKU,Title,COGS\nA1,Mug,4\n');
    const merged = mergeSuggestionsIntoMapping(
      { sku: 'Title', vendor: 'COGS' },
      createMappingSuggestions(preview, 'PRODUCTS'),
    );

    assert.equal(merged.sku, 'SKU');
    assert.equal(merged.name, 'Title');
    assert.equal(merged.cost_price, 'COGS');
    assert.equal(merged.vendor, undefined);
  });

  it('keeps manual mappings that do not conflict with suggestions', async () => {
    const preview = await previewOf('SKU,Title,COGS,Maker\nA1,Mug,4,Acme\n');
    const merged = mergeSuggestionsIntoMapping(
      { vendor: 'Maker' },
      createMappingSuggestions(preview, 'PRODUCTS').filter((s) => s.field.key !== 'vendor'),
    );

    assert.equal(merged.vendor, 'Maker');
  });
});
