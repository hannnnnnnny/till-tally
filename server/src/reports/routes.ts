import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { reportRateLimit } from '../http/rateLimit';
import { createReportsRouter, type ReportsRouterDependencies } from './reportsRouterFactory';
import { generateWeeklyReport, getWeeklyReport } from './weeklyReportService';

const dependencies: ReportsRouterDependencies = {
  requireAuth,
  requireBusinessAccess,
  reportRateLimit,
  generateWeeklyReport,
  getWeeklyReport,
};

export const reportsRouter = createReportsRouter(dependencies);
