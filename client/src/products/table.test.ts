import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildProductPerformanceSearchParams } from './api';
import {
  PRODUCT_STATUS_FILTERS,
  formatProductCurrency,
  formatProductLastSoldAt,
  formatProductPercent,
  formatProductStock,
  getProductLabelClass,
} from './table';

describe('product performance table helpers', () => {
  it('builds product performance query params from table controls', () => {
    const searchParams = buildProductPerformanceSearchParams({
      category: 'Women',
      from: '2026-06-15',
      order: 'asc',
      page: 2,
      pageSize: 50,
      search: 'jacket',
      sort: 'unitsSold',
      status: 'High Margin',
      to: '2026-06-21',
    });

    assert.equal(
      searchParams.toString(),
      'sort=unitsSold&order=asc&page=2&pageSize=50&search=jacket&category=Women&status=High+Margin&from=2026-06-15&to=2026-06-21',
    );
  });

  it('omits empty optional filters from product query params', () => {
    const searchParams = buildProductPerformanceSearchParams({
      category: ' ',
      order: 'desc',
      page: 1,
      pageSize: 25,
      search: '',
      sort: 'revenue',
      status: '',
    });

    assert.equal(searchParams.toString(), 'sort=revenue&order=desc&page=1&pageSize=25');
  });

  it('formats product table metrics for compact scanning', () => {
    assert.equal(formatProductCurrency(2157.6), '$2,158');
    assert.equal(formatProductPercent(57.73), '57.7%');
    assert.equal(formatProductStock(3), '3 in stock');
    assert.equal(formatProductStock(0), '0 in stock');
    assert.equal(formatProductLastSoldAt('2026-06-24'), 'Last sold Jun 24');
    assert.equal(formatProductLastSoldAt('2026-06-24T00:00:00.000Z'), 'Last sold Jun 24');
    assert.equal(formatProductLastSoldAt('not-a-date'), 'Last sold date unavailable');
  });

  it('defines selectable status filters and label styling', () => {
    assert.deepEqual(PRODUCT_STATUS_FILTERS, [
      'Best Seller',
      'High Margin',
      'Low Stock',
      'Reorder Soon',
      'Slow Mover',
      'Dead Stock',
      'Discount Candidate',
    ]);
    assert.match(getProductLabelClass('Best Seller'), /emerald/);
    assert.match(getProductLabelClass('Low Stock'), /amber/);
    assert.match(getProductLabelClass('Dead Stock'), /red/);
  });
});
