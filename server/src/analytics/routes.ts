import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { env } from '../config/env';
import { analyticsExecutionRateLimit, analyticsPlanRateLimit } from '../http/rateLimit';
import { analyticsAudit } from './analyticsAudit';
import { createAnalyticsPlanner } from './analyticsPlanner';
import { createAnalyticsRouter } from './analyticsRouterFactory';
import { executeAnalyticsPlan, previewAnalyticsPlan } from './analyticsExecutor';
import { createOllamaPlannerProvider } from './ollamaPlannerProvider';
import { prismaAnalyticsDataSource } from './prismaAnalyticsDataSource';
import { prismaSavedReportRepository } from './prismaSavedReportRepository';
import { createSavedReportService } from './savedReportService';
import { createSavedReportsRouter } from './savedReportsRouterFactory';

const analyticsPlanner = createAnalyticsPlanner({
  ...(env.analyticsPlannerProvider === 'ollama'
    ? {
        provider: createOllamaPlannerProvider({
          baseUrl: env.ollamaBaseUrl,
          model: env.ollamaModel,
        }),
      }
    : {}),
  timeoutMs: env.analyticsPlannerTimeoutMs,
  maxRetries: env.analyticsPlannerMaxRetries,
});

export const analyticsRouter = createAnalyticsRouter({
  requireAuth,
  requireBusinessAccess,
  planRateLimit: analyticsPlanRateLimit,
  executeRateLimit: analyticsExecutionRateLimit,
  audit: analyticsAudit,
  planAnalytics: (input, options) => analyticsPlanner.plan(input, options),
  previewAnalyticsPlan,
  executeAnalyticsPlan: (businessId, input) =>
    executeAnalyticsPlan(businessId, input, prismaAnalyticsDataSource),
});

analyticsRouter.use(
  '/saved-reports',
  createSavedReportsRouter({
    requireAuth,
    requireBusinessAccess,
    service: createSavedReportService(prismaSavedReportRepository),
  }),
);
