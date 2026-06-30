import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { normalizeImportJobErrorSummary, parseImportJobPagination } from './importJobService';

describe('import job service', () => {
  it('parses import job pagination with defaults', () => {
    assert.deepEqual(parseImportJobPagination({}), {
      page: 1,
      pageSize: 25,
      skip: 0,
      take: 25,
    });
  });

  it('clamps invalid and oversized pagination values', () => {
    assert.deepEqual(parseImportJobPagination({ page: '0', pageSize: '500' }), {
      page: 1,
      pageSize: 100,
      skip: 0,
      take: 100,
    });
  });

  it('calculates pagination offset from page and page size', () => {
    assert.deepEqual(parseImportJobPagination({ page: '3', pageSize: '10' }), {
      page: 3,
      pageSize: 10,
      skip: 20,
      take: 10,
    });
  });

  it('normalizes stored import job error summaries', () => {
    const storedSummary: Prisma.JsonObject = {
      errors: [
        {
          row: 2,
          column: 'sku',
          message: 'SKU is required',
          severity: 'error',
        },
        {
          row: 'not-a-number',
          message: 'Malformed rows are ignored',
        },
      ],
      warnings: [
        {
          row: 5,
          message: 'Unknown channel mapped to OTHER',
        },
      ],
    };

    assert.deepEqual(normalizeImportJobErrorSummary(storedSummary), {
      errors: [
        {
          row: 2,
          column: 'sku',
          message: 'SKU is required',
          severity: 'error',
        },
      ],
      warnings: [
        {
          row: 5,
          message: 'Unknown channel mapped to OTHER',
          severity: 'warning',
        },
      ],
    });
  });

  it('returns an empty report for missing error summaries', () => {
    assert.deepEqual(normalizeImportJobErrorSummary(null), {
      errors: [],
      warnings: [],
    });
  });
});
