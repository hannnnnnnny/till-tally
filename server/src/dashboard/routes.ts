import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { createDashboardRouter, type DashboardRouterDependencies } from './dashboardRouterFactory';
import { getDashboardSalesTrend } from './salesTrendService';
import { getDashboardSummary } from './summaryService';

const dependencies: DashboardRouterDependencies = {
  requireAuth,
  requireBusinessAccess,
  getDashboardSalesTrend,
  getDashboardSummary,
};

export const dashboardRouter = createDashboardRouter(dependencies);
