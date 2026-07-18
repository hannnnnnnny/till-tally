import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { createAnalyticsRouter } from './analyticsRouterFactory';
import { executeAnalyticsPlan, previewAnalyticsPlan } from './analyticsExecutor';
import { prismaAnalyticsDataSource } from './prismaAnalyticsDataSource';

export const analyticsRouter = createAnalyticsRouter({
  requireAuth,
  requireBusinessAccess,
  previewAnalyticsPlan,
  executeAnalyticsPlan: (businessId, input) =>
    executeAnalyticsPlan(businessId, input, prismaAnalyticsDataSource),
});
