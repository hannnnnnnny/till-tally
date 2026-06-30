import { type RequestHandler, type Response, Router } from 'express';
import { ImportStatus } from '@prisma/client';
import { requireAuth as defaultRequireAuth } from '../auth/middleware';
import { requireBusinessAccess as defaultRequireBusinessAccess } from '../businesses/middleware';
import {
  getImportJobDetail as defaultGetImportJobDetail,
  listImportJobs as defaultListImportJobs,
  parseImportJobPagination,
} from './importJobService';
import { importOrdersCsvFile as defaultImportOrdersCsvFile } from './orderImportService';
import { importProductsCsvFile as defaultImportProductsCsvFile } from './productImportService';
import { uploadCsvFile as defaultUploadCsvFile } from './uploadMiddleware';

export type ImportRouterDependencies = {
  requireAuth: RequestHandler;
  requireBusinessAccess: RequestHandler;
  uploadCsvFile: RequestHandler;
  listImportJobs: typeof defaultListImportJobs;
  getImportJobDetail: typeof defaultGetImportJobDetail;
  importOrdersCsvFile: typeof defaultImportOrdersCsvFile;
  importProductsCsvFile: typeof defaultImportProductsCsvFile;
};

const defaultDependencies: ImportRouterDependencies = {
  requireAuth: defaultRequireAuth,
  requireBusinessAccess: defaultRequireBusinessAccess,
  uploadCsvFile: defaultUploadCsvFile,
  listImportJobs: defaultListImportJobs,
  getImportJobDetail: defaultGetImportJobDetail,
  importOrdersCsvFile: defaultImportOrdersCsvFile,
  importProductsCsvFile: defaultImportProductsCsvFile,
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

export function createImportRouter(dependencies = defaultDependencies): Router {
  const router = Router();

  router.get('/jobs', dependencies.requireAuth, dependencies.requireBusinessAccess, async (req, res) => {
    if (!req.businessId) {
      sendImportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
      return;
    }

    const pagination = parseImportJobPagination(req.query);
    const result = await dependencies.listImportJobs(req.businessId, pagination);

    res.json(result);
  });

  router.get(
    '/jobs/:id',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    async (req, res) => {
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
    },
  );

  router.post(
    '/orders',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    dependencies.uploadCsvFile,
    async (req, res) => {
      if (!req.businessId) {
        sendImportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      if (!req.uploadedCsvFile) {
        sendImportError(res, 400, 'BAD_CSV_FORMAT', 'A CSV file is required');
        return;
      }

      const result = await dependencies.importOrdersCsvFile({
        businessId: req.businessId,
        uploadedFile: req.uploadedCsvFile,
      });

      res.status(result.status === ImportStatus.FAILED ? 422 : 201).json(result);
    },
  );

  router.post(
    '/products',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    dependencies.uploadCsvFile,
    async (req, res) => {
      if (!req.businessId) {
        sendImportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      if (!req.uploadedCsvFile) {
        sendImportError(res, 400, 'BAD_CSV_FORMAT', 'A CSV file is required');
        return;
      }

      const result = await dependencies.importProductsCsvFile({
        businessId: req.businessId,
        uploadedFile: req.uploadedCsvFile,
      });

      res.status(result.status === ImportStatus.FAILED ? 422 : 201).json(result);
    },
  );

  return router;
}

export const importRouter = createImportRouter();
