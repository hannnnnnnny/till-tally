import { requireAuth } from '../auth/middleware';
import { requireBusinessAccess } from '../businesses/middleware';
import { env } from '../config/env';
import { createAnalyticsPlanner } from './analyticsPlanner';
import { createAnalyticsRouter } from './analyticsRouterFactory';
import { executeAnalyticsPlan, previewAnalyticsPlan } from './analyticsExecutor';
import { createOllamaPlannerProvider } from './ollamaPlannerProvider';
import { prismaAnalyticsDataSource } from './prismaAnalyticsDataSource';

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
  planAnalytics: (input, options) => analyticsPlanner.plan(input, options),
  previewAnalyticsPlan,
  executeAnalyticsPlan: (businessId, input) =>
    executeAnalyticsPlan(businessId, input, prismaAnalyticsDataSource),
});
