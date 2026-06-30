import { type Response, Router } from 'express';
import { ImportStatus } from '@prisma/client';
import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { importOrdersCsvFile } from './orderImportService';
import { importProductsCsvFile } from './productImportService';
import { uploadCsvFile } from './uploadMiddleware';

export const importRouter = Router();

type ImportErrorCode = 'BAD_CSV_FORMAT' | 'NO_BUSINESS_ACCESS';

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

importRouter.post(
  '/orders',
  requireAuth,
  requireBusinessAccess,
  uploadCsvFile,
  async (req, res) => {
    if (!req.businessId) {
      sendImportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
      return;
    }

    if (!req.uploadedCsvFile) {
      sendImportError(res, 400, 'BAD_CSV_FORMAT', 'A CSV file is required');
      return;
    }

    const result = await importOrdersCsvFile({
      businessId: req.businessId,
      uploadedFile: req.uploadedCsvFile,
    });

    res.status(result.status === ImportStatus.FAILED ? 422 : 201).json(result);
  },
);

importRouter.post(
  '/products',
  requireAuth,
  requireBusinessAccess,
  uploadCsvFile,
  async (req, res) => {
    if (!req.businessId) {
      sendImportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
      return;
    }

    if (!req.uploadedCsvFile) {
      sendImportError(res, 400, 'BAD_CSV_FORMAT', 'A CSV file is required');
      return;
    }

    const result = await importProductsCsvFile({
      businessId: req.businessId,
      uploadedFile: req.uploadedCsvFile,
    });

    res.status(result.status === ImportStatus.FAILED ? 422 : 201).json(result);
  },
);
