import { type RequestHandler, type Response, Router } from 'express';
import { isPrismaMissingTableError } from '../db/migrationDrift';
import { asyncHandler } from '../http/asyncHandler';
import {
  type GenerateWeeklyReportInput,
  type WeeklyReportQueryInput,
  WeeklyReportQueryError,
  type WeeklyReportResponse,
} from './weeklyReportService';

export type ReportsRouterDependencies = {
  requireAuth: RequestHandler;
  requireBusinessAccess: RequestHandler;
  reportRateLimit?: RequestHandler;
  getWeeklyReport: (
    businessId: string,
    query: WeeklyReportQueryInput,
  ) => Promise<WeeklyReportResponse | null>;
  generateWeeklyReport: (
    businessId: string,
    input: GenerateWeeklyReportInput,
  ) => Promise<WeeklyReportResponse>;
};

type ReportErrorCode =
  | 'BAD_REPORT_QUERY'
  | 'NO_BUSINESS_ACCESS'
  | 'NOT_FOUND'
  | 'REPORTS_SCHEMA_NOT_READY';

function sendReportError(
  res: Response,
  statusCode: number,
  code: ReportErrorCode,
  message: string,
): void {
  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}

export function createReportsRouter(dependencies: ReportsRouterDependencies): Router {
  const router = Router();

  router.get(
    '/weekly',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    dependencies.reportRateLimit ?? passthrough,
    asyncHandler(async (req, res) => {
      if (!req.businessId) {
        sendReportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      try {
        const result = await dependencies.getWeeklyReport(req.businessId, req.query);

        if (!result) {
          sendReportError(res, 404, 'NOT_FOUND', 'Weekly report not found');
          return;
        }

        res.json(result);
      } catch (error) {
        if (error instanceof WeeklyReportQueryError) {
          sendReportError(res, 400, 'BAD_REPORT_QUERY', error.message);
          return;
        }

        if (isPrismaMissingTableError(error, 'weekly_reports')) {
          sendReportError(
            res,
            503,
            'REPORTS_SCHEMA_NOT_READY',
            'Weekly reports are unavailable until Prisma migrations have been applied.',
          );
          return;
        }

        throw error;
      }
    }),
  );

  router.post(
    '/weekly/generate',
    dependencies.requireAuth,
    dependencies.requireBusinessAccess,
    dependencies.reportRateLimit ?? passthrough,
    asyncHandler(async (req, res) => {
      if (!req.businessId) {
        sendReportError(res, 403, 'NO_BUSINESS_ACCESS', 'Missing business context');
        return;
      }

      try {
        const result = await dependencies.generateWeeklyReport(req.businessId, req.body ?? {});

        res.status(201).json(result);
      } catch (error) {
        if (error instanceof WeeklyReportQueryError) {
          sendReportError(res, 400, 'BAD_REPORT_QUERY', error.message);
          return;
        }

        if (isPrismaMissingTableError(error, 'weekly_reports')) {
          sendReportError(
            res,
            503,
            'REPORTS_SCHEMA_NOT_READY',
            'Weekly reports are unavailable until Prisma migrations have been applied.',
          );
          return;
        }

        throw error;
      }
    }),
  );

  return router;
}

const passthrough: RequestHandler = (_req, _res, next) => next();
