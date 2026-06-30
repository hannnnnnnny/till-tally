import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { createImportRouter, type ImportRouterDependencies } from './importRouterFactory';
import { getImportJobDetail, listImportJobs } from './importJobService';
import { importOrdersCsvFile } from './orderImportService';
import { importProductsCsvFile } from './productImportService';
import { uploadCsvFile } from './uploadMiddleware';

const dependencies: ImportRouterDependencies = {
  requireAuth,
  requireBusinessAccess,
  uploadCsvFile,
  listImportJobs,
  getImportJobDetail,
  importOrdersCsvFile,
  importProductsCsvFile,
};

export const importRouter = createImportRouter(dependencies);
