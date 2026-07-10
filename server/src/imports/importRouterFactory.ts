import { type RequestHandler, type Response, Router } from 'express';
import { ImportStatus } from '@prisma/client';
import { asyncHandler } from '../http/asyncHandler';
import { deleteUploadedCsvFile } from './uploadedFileLifecycle';
import {
  type ImportJobDetail,
  type ImportJobsListResult,
  parseImportJobPagination,
} from './importJobService';
import { type ImportOrdersInput, type ImportOrdersResult } from './orderImportService';
import { type ImportProductsInput, type ImportProductsResult } from './productImportService';
import { type UploadedCsvFile } from './uploadMiddleware';

export type ImportRouterDependencies = {
  requireAuth: RequestHandler;
  requireBusinessAccess: RequestHandler;
  importRateLimit?: RequestHandler;
  uploadCsvFile: RequestHandler;
  cleanupUploadedFile?: (uploadedFile: UploadedCsvFile) => Promise<void>;
  listImportJobs: (
    businessId: string,
    pagination: ReturnType<typeof parseImportJobPagination>,
  ) => Promise<ImportJobsListResult>;
  getImportJobDetail: (businessId: string, jobId: string) => Promise<ImportJobDetail | null>;
  importOrdersCsvFile: (input: ImportOrdersInput) => Promise<ImportOrdersResult>;
  importProductsCsvFile: (input: ImportProductsInput) => Promise<ImportProductsResult>;
};

type ImportErrorCode = 'BAD_CSV_FORMAT' | 'NO_BUSINESS_ACCESS' | 'NOT_FOUND';

function sendImportError(
  res: Response,
  statusCode: number,
  code: ImportErrorCode,
  message: string,
): void {
  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}

export function createImportRouter(dependencies: ImportRouterDependencies): Router {
  const router = Router();
  const cleanupUploadedFile = dependencies.cleanupUploadedFile ?? deleteUploadedCsvFile;

  router.get('/jobs', dependencies.requireAuth, dependencies.requireBusinessAccess, asyncHandler(async (req, res) => {
    if (!req.businessId) {
      sendImportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
      return;
    }

    const pagination = parseImportJobPagination(req.query);
    const result = await dependencies.listImportJobs(req.businessId, pagination);

    res.json(result);
  }));

  router.get(
    '/jobs/:id',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    asyncHandler(async (req, res) => {
      if (!req.businessId) {
        sendImportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      const result = await dependencies.getImportJobDetail(req.businessId, req.params.id);

      if (!result) {
        sendImportError(res, 404, 'NOT_FOUND', 'Import job not found');
        return;
      }

      res.json(result);
    }),
  );

  router.post(
    '/orders',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    dependencies.importRateLimit ?? passthrough,
    dependencies.uploadCsvFile,
    asyncHandler(async (req, res) => {
      if (!req.businessId) {
        sendImportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      if (!req.uploadedCsvFile) {
        sendImportError(res, 400, 'BAD_CSV_FORMAT', 'A CSV file is required');
        return;
      }

      const uploadedFile = req.uploadedCsvFile;

      try {
        const result = await dependencies.importOrdersCsvFile({
          businessId: req.businessId,
          uploadedFile,
        });

        res.status(result.status === ImportStatus.FAILED ? 422 : 201).json(result);
      } finally {
        await cleanupUploadedCsvFile(uploadedFile, cleanupUploadedFile);
      }
    }),
  );

  router.post(
    '/products',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    dependencies.importRateLimit ?? passthrough,
    dependencies.uploadCsvFile,
    asyncHandler(async (req, res) => {
      if (!req.businessId) {
        sendImportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      if (!req.uploadedCsvFile) {
        sendImportError(res, 400, 'BAD_CSV_FORMAT', 'A CSV file is required');
        return;
      }

      const uploadedFile = req.uploadedCsvFile;

      try {
        const result = await dependencies.importProductsCsvFile({
          businessId: req.businessId,
          uploadedFile,
        });

        res.status(result.status === ImportStatus.FAILED ? 422 : 201).json(result);
      } finally {
        await cleanupUploadedCsvFile(uploadedFile, cleanupUploadedFile);
      }
    }),
  );

  return router;
}

const passthrough: RequestHandler = (_req, _res, next) => next();

async function cleanupUploadedCsvFile(
  uploadedFile: UploadedCsvFile,
  cleanupUploadedFile: (uploadedFile: UploadedCsvFile) => Promise<void>,
): Promise<void> {
  try {
    await cleanupUploadedFile(uploadedFile);
  } catch (error) {
    console.warn('Failed to clean uploaded CSV file', {
      error: error instanceof Error ? error.message : 'Unknown cleanup error',
      fileName: uploadedFile.fileName,
    });
  }
}
