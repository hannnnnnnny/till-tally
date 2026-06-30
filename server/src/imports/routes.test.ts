import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ImportStatus, ImportType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { createImportRouter, type ImportRouterDependencies } from './importRouterFactory';
import { type ImportJobDetail, type ImportJobsListResult } from './importJobService';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

describe('import routes', () => {
  it('returns paginated import job history for the active business', async () => {
    let capturedRequest:
      | {
          businessId: string;
          page: number;
          pageSize: number;
          skip: number;
          take: number;
        }
      | null = null;

    const app = createTestApp({
      listImportJobs: async (businessId, pagination) => {
        capturedRequest = {
          businessId,
          page: pagination.page,
          pageSize: pagination.pageSize,
          skip: pagination.skip,
          take: pagination.take,
        };

        return createImportJobsListResult();
      },
    });

    const response = await request(app)
      .get('/api/import/jobs?page=2&pageSize=5')
      .expect(200);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      page: 2,
      pageSize: 5,
      skip: 5,
      take: 5,
    });
    assert.deepEqual(response.body, createImportJobsListResult());
  });

  it('returns import job detail with structured errors', async () => {
    let capturedRequest:
      | {
          businessId: string;
          jobId: string;
        }
      | null = null;

    const app = createTestApp({
      getImportJobDetail: async (businessId, jobId) => {
        capturedRequest = {
          businessId,
          jobId,
        };

        return createImportJobDetail();
      },
    });

    const response = await request(app).get('/api/import/jobs/job-1').expect(200);

    assert.deepEqual(capturedRequest, {
      businessId: 'business-1',
      jobId: 'job-1',
    });
    assert.deepEqual(response.body, createImportJobDetail());
  });

  it('returns 404 when an import job is outside the active business', async () => {
    const app = createTestApp({
      getImportJobDetail: async () => null,
    });

    const response = await request(app).get('/api/import/jobs/missing-job').expect(404);
    const body = response.body as ErrorResponse;

    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(body.error.message, 'Import job not found');
  });
});

function createTestApp(overrides: Partial<ImportRouterDependencies>): express.Express {
  const app = express();

  app.use(express.json());
  app.use('/api/import', createImportRouter({ ...createDefaultDependencies(), ...overrides }));

  return app;
}

function createDefaultDependencies(): ImportRouterDependencies {
  return {
    requireAuth: createAuthMiddleware(),
    requireBusinessAccess: createBusinessAccessMiddleware(),
    uploadCsvFile: (_req, _res, next) => next(),
    listImportJobs: async () => createImportJobsListResult(),
    getImportJobDetail: async () => createImportJobDetail(),
    importOrdersCsvFile: async () => ({
      jobId: 'job-1',
      importType: ImportType.ORDERS,
      status: ImportStatus.COMPLETED,
      rowsTotal: 1,
      rowsImported: 1,
      rowsFailed: 0,
      errors: [],
      warnings: [],
    }),
    importProductsCsvFile: async () => ({
      jobId: 'job-1',
      importType: ImportType.PRODUCTS,
      status: ImportStatus.COMPLETED,
      rowsTotal: 1,
      rowsImported: 1,
      rowsFailed: 0,
      errors: [],
      warnings: [],
    }),
  };
}

function createAuthMiddleware(): RequestHandler {
  return (req, _res, next) => {
    req.userId = 'user-1';
    next();
  };
}

function createBusinessAccessMiddleware(): RequestHandler {
  return (req, _res, next) => {
    req.businessId = 'business-1';
    next();
  };
}

function createImportJobsListResult(): ImportJobsListResult {
  return {
    data: [
      {
        id: 'job-1',
        fileName: 'orders.csv',
        importType: ImportType.ORDERS,
        status: ImportStatus.COMPLETED_WITH_WARNINGS,
        rowsTotal: 3,
        rowsImported: 2,
        rowsFailed: 1,
        createdAt: '2026-06-26T03:21:00.000Z',
      },
    ],
    meta: {
      page: 2,
      pageSize: 5,
      total: 6,
      totalPages: 2,
    },
  };
}

function createImportJobDetail(): ImportJobDetail {
  return {
    id: 'job-1',
    fileName: 'orders.csv',
    importType: ImportType.ORDERS,
    status: ImportStatus.COMPLETED_WITH_WARNINGS,
    rowsTotal: 3,
    rowsImported: 2,
    rowsFailed: 1,
    createdAt: '2026-06-26T03:21:00.000Z',
    errorSummary: {
      errors: [
        {
          row: 4,
          column: 'quantity',
          message: 'Quantity must be greater than 0',
          severity: 'error',
        },
      ],
      warnings: [
        {
          row: 5,
          column: 'sku',
          message: 'SKU "ABC-123" was not matched to a product',
          severity: 'warning',
        },
      ],
    },
  };
}
