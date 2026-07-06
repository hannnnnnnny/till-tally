import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { importRateLimit } from '../http/rateLimit';
import { createImportRouter, type ImportRouterDependencies } from './importRouterFactory';
import { getImportJobDetail, listImportJobs } from './importJobService';
import { importOrdersCsvFile } from './orderImportService';
import { importProductsCsvFile } from './productImportService';
import { uploadCsvFile } from './uploadMiddleware';

const dependencies: ImportRouterDependencies = {
  requireAuth,
  requireBusinessAccess,
  importRateLimit,
  uploadCsvFile,
  listImportJobs,
  getImportJobDetail,
  importOrdersCsvFile,
  importProductsCsvFile,
};

export const importRouter = createImportRouter(dependencies);
