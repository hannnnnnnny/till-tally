import { type RequestHandler, type Response, Router } from 'express';
import {
  DashboardDateRangeError,
  type DashboardDateRangeQuery,
  type DashboardSummary,
} from './summaryService';
import { type SalesTrendResult } from './salesTrendService';

export type DashboardRouterDependencies = {
  requireAuth: RequestHandler;
  requireBusinessAccess: RequestHandler;
  getDashboardSummary: (
    businessId: string,
    query: DashboardDateRangeQuery,
  ) => Promise<DashboardSummary>;
  getDashboardSalesTrend: (
    businessId: string,
    query: DashboardDateRangeQuery,
  ) => Promise<SalesTrendResult>;
};

type DashboardErrorCode = 'BAD_DATE_RANGE' | 'NO_BUSINESS_ACCESS';

function sendDashboardError(
  res: Response,
  statusCode: number,
  code: DashboardErrorCode,
  message: string,
): void {
  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}

export function createDashboardRouter(dependencies: DashboardRouterDependencies): Router {
  const router = Router();

  router.get(
    '/summary',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    async (req, res) => {
      if (!req.businessId) {
        sendDashboardError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      try {
        const result = await dependencies.getDashboardSummary(req.businessId, req.query);

        res.json(result);
      } catch (error) {
        if (error instanceof DashboardDateRangeError) {
          sendDashboardError(res, 400, 'BAD_DATE_RANGE', error.message);
          return;
        }

        throw error;
      }
    },
  );

  router.get(
    '/sales-trend',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    async (req, res) => {
      if (!req.businessId) {
        sendDashboardError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      try {
        const result = await dependencies.getDashboardSalesTrend(req.businessId, req.query);

        res.json(result);
      } catch (error) {
        if (error instanceof DashboardDateRangeError) {
          sendDashboardError(res, 400, 'BAD_DATE_RANGE', error.message);
          return;
        }

        throw error;
      }
    },
  );

  return router;
}
