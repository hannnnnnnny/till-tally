import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { getDashboardChannelBreakdown } from './channelBreakdownService';
import { createDashboardRouter, type DashboardRouterDependencies } from './dashboardRouterFactory';
import { getDashboardSalesTrend } from './salesTrendService';
import { getDashboardSummary } from './summaryService';

const dependencies: DashboardRouterDependencies = {
  requireAuth,
  requireBusinessAccess,
  getDashboardChannelBreakdown,
  getDashboardSalesTrend,
  getDashboardSummary,
};

export const dashboardRouter = createDashboardRouter(dependencies);
