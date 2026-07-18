import { type RequestHandler, type Response, Router } from 'express';
import {
  parseAnalyticsPlan,
  parseAnalyticsPlannerRequest,
  type AnalyticsPlanningResult,
} from '@till-tally/analytics-contracts';
import { ZodError } from 'zod';
import { asyncHandler } from '../http/asyncHandler';
import {
  AnalyticsExecutionTimeoutError,
  AnalyticsPlanSemanticError,
  type AnalyticsExecutionResult,
  type AnalyticsPlanPreview,
} from './analyticsExecutor';

export type AnalyticsRouterDependencies = {
  requireAuth: RequestHandler;
  requireBusinessAccess: RequestHandler;
  planAnalytics: (
    input: unknown,
    options?: { signal?: AbortSignal },
  ) => Promise<AnalyticsPlanningResult>;
  previewAnalyticsPlan: (input: unknown) => AnalyticsPlanPreview;
  executeAnalyticsPlan: (businessId: string, input: unknown) => Promise<AnalyticsExecutionResult>;
};

export function createAnalyticsRouter(dependencies: AnalyticsRouterDependencies): Router {
  const router = Router();

  router.post(
    '/plan',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    asyncHandler(async (req, res) => {
      if (!assertBusinessContext(req.businessId, res)) return;

      let request;
      try {
        request = parseAnalyticsPlannerRequest(req.body);
      } catch (error) {
        if (error instanceof ZodError) {
          sendInvalidPlannerRequest(error, res);
          return;
        }
        throw error;
      }

      const controller = new AbortController();
      const abortPlanning = () => controller.abort(new Error('Analytics planning request closed'));
      req.once('aborted', abortPlanning);

      try {
        res.json(await dependencies.planAnalytics(request, { signal: controller.signal }));
      } finally {
        req.off('aborted', abortPlanning);
      }
    }),
  );

  router.post(
    '/preview',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    asyncHandler(async (req, res) => {
      if (!assertBusinessContext(req.businessId, res)) return;

      try {
        res.json(dependencies.previewAnalyticsPlan(req.body));
      } catch (error) {
        if (sendKnownAnalyticsError(error, res)) return;
        throw error;
      }
    }),
  );

  router.post(
    '/execute',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    asyncHandler(async (req, res) => {
      if (!assertBusinessContext(req.businessId, res)) return;

      try {
        const plan = parseAnalyticsPlan(req.body);
        res.json(await dependencies.executeAnalyticsPlan(req.businessId, plan));
      } catch (error) {
        if (sendKnownAnalyticsError(error, res)) return;
        throw error;
      }
    }),
  );

  return router;
}

function sendInvalidPlannerRequest(error: ZodError, res: Response): void {
  res.status(400).json({
    error: {
      code: 'INVALID_ANALYTICS_REQUEST',
      message: 'The analytics question is invalid.',
      details: error.issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })),
    },
  });
}

function assertBusinessContext(
  businessId: string | undefined,
  res: Response,
): businessId is string {
  if (businessId) return true;

  res.status(403).json({
    error: {
      code: 'NO_BUSINESS_ACCESS',
      message: 'Missing business context',
    },
  });
  return false;
}

function sendKnownAnalyticsError(error: unknown, res: Response): boolean {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'INVALID_ANALYTICS_PLAN',
        message: 'The analytics plan is invalid.',
        details: error.issues.map((issue) => ({
          path: issue.path,
          code: issue.code,
          message: issue.message,
        })),
      },
    });
    return true;
  }

  if (error instanceof AnalyticsPlanSemanticError) {
    res.status(400).json({
      error: {
        code: 'INVALID_ANALYTICS_PLAN',
        message: 'The analytics plan is invalid.',
        details: [{ path: error.path, code: 'custom', message: error.message }],
      },
    });
    return true;
  }

  if (error instanceof AnalyticsExecutionTimeoutError) {
    res.status(504).json({
      error: {
        code: 'ANALYTICS_TIMEOUT',
        message: 'The analytics query took too long. Try a shorter date range or fewer dimensions.',
      },
    });
    return true;
  }

  return false;
}
