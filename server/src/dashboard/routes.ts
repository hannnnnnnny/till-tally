import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { createDashboardRouter, type DashboardRouterDependencies } from './dashboardRouterFactory';
import { getDashboardSummary } from './summaryService';

const dependencies: DashboardRouterDependencies = {
  requireAuth,
  requireBusinessAccess,
  getDashboardSummary,
};

export const dashboardRouter = createDashboardRouter(dependencies);
